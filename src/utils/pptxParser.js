/**
 * src/utils/pptxParser.js
 *
 * Parses a .pptx file and extracts per-slide text, title, and background
 * color without any external dependencies. Uses:
 *   - The FileReader / arrayBuffer() API for binary access
 *   - The built-in DecompressionStream API (Chrome 80+ / Electron 12+) for
 *     DEFLATE-compressed ZIP entries
 *   - Regex-based XML parsing (avoids namespace pitfalls with DOMParser on
 *     PPTX files in headless/test environments)
 *
 * Returns: { fileName, slideCount, slides }
 * Each slide: { num, title, text, lines, bgColor, hasImage }
 */

// ── ZIP reader ────────────────────────────────────────────────────────────────

const TEXT_DECODER = new TextDecoder();

async function decompressDeflateRaw(data) {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  writer.write(data);
  writer.close();

  const chunks = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
    total += value.length;
  }
  const out = new Uint8Array(total);
  let pos = 0;
  for (const c of chunks) { out.set(c, pos); pos += c.length; }
  return out;
}

/**
 * Read all files from a ZIP archive.
 * Returns { [filename]: Uint8Array } for every non-directory entry.
 */
export async function readZipEntries(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const bytes = new Uint8Array(arrayBuffer);
  const entries = {};

  // ── Find End-of-Central-Directory record ──────────────────────────────────
  // Scan backwards from the last possible position (min record is 22 bytes)
  let eocdPos = -1;
  const EOCD_SIG = 0x06054b50;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65536; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) { eocdPos = i; break; }
  }
  if (eocdPos === -1) throw new Error('Not a valid ZIP/PPTX file (EOCD not found)');

  const cdCount  = view.getUint16(eocdPos + 10, true);
  const cdOffset = view.getUint32(eocdPos + 16, true);

  // ── Walk Central Directory ────────────────────────────────────────────────
  const CD_SIG = 0x02014b50;
  let pos = cdOffset;
  for (let i = 0; i < cdCount; i++) {
    if (view.getUint32(pos, true) !== CD_SIG) break;

    const compression     = view.getUint16(pos + 10, true);
    const compressedSz    = view.getUint32(pos + 20, true);
    const fileNameLen     = view.getUint16(pos + 28, true);
    const extraLen        = view.getUint16(pos + 30, true);
    const commentLen      = view.getUint16(pos + 32, true);
    const localHdrOffset  = view.getUint32(pos + 42, true);
    const fileName        = TEXT_DECODER.decode(bytes.slice(pos + 46, pos + 46 + fileNameLen));

    pos += 46 + fileNameLen + extraLen + commentLen;

    if (fileName.endsWith('/')) continue; // directory entry

    // Locate data: skip local file header
    const lfnLen   = view.getUint16(localHdrOffset + 26, true);
    const lfExtraLen = view.getUint16(localHdrOffset + 28, true);
    const dataStart  = localHdrOffset + 30 + lfnLen + lfExtraLen;
    const raw = bytes.slice(dataStart, dataStart + compressedSz);

    if (compression === 0) {
      entries[fileName] = raw; // STORE — no decompression needed
    } else if (compression === 8) {
      entries[fileName] = await decompressDeflateRaw(raw); // DEFLATE
    }
    // Other methods (bzip2, lzma …) are not used by PPTX in practice
  }

  return entries;
}

// ── PPTX XML helpers ──────────────────────────────────────────────────────────

/**
 * Extract visible text from a slide XML string.
 * Returns an array of paragraph strings (one entry per <a:p> block).
 */
function extractParagraphs(xml) {
  const paras = [];
  // Split on paragraph boundaries
  const paraRe = /<a:p\b[^>]*>([\s\S]*?)<\/a:p>/g;
  let pm;
  while ((pm = paraRe.exec(xml)) !== null) {
    const paraXml = pm[1];
    // Collect all <a:t> runs within this paragraph
    const runRe = /<a:t(?:\s[^>]*)?>([^<]*)<\/a:t>/g;
    let rm;
    const runs = [];
    while ((rm = runRe.exec(paraXml)) !== null) {
      const decoded = rm[1]
        .replace(/&amp;/g, '&').replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'");
      if (decoded) runs.push(decoded);
    }
    const line = runs.join('').trim();
    if (line) paras.push(line);
  }
  return paras;
}

/**
 * Extract title text: first text body inside a placeholder of type "title",
 * "ctrTitle", or "subTitle"; falls back to the first text body at all.
 */
function extractTitle(xml) {
  // Look for title placeholders
  const titlePh = /<p:sp>(?:(?!<\/p:sp>)[\s\S])*?<p:ph[^>]*\btype="(?:title|ctrTitle|subTitle)"[^>]*\/?>[\s\S]*?<p:txBody>([\s\S]*?)<\/p:txBody>[\s\S]*?<\/p:sp>/;
  const m = titlePh.exec(xml);
  if (m) {
    const paras = extractParagraphs(m[1]);
    if (paras.length) return paras[0];
  }
  return null;
}

/**
 * Extract hex background color from slide XML.
 * Returns a CSS hex string like "#1a2b3c" or null.
 */
function extractBgColor(xml) {
  // <p:bg> section
  const bgMatch = xml.match(/<p:bg>([\s\S]*?)<\/p:bg>/);
  if (bgMatch) {
    const bgXml = bgMatch[1];
    const solidClr = bgXml.match(/<a:srgbClr\s+val="([0-9A-Fa-f]{6})"/);
    if (solidClr) return '#' + solidClr[1].toLowerCase();
  }
  return null;
}

/** Returns true if the slide XML contains any image references. */
function slideHasImages(xml) {
  return /<a:blip\b/.test(xml) || /<p:pic\b/.test(xml);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a .pptx File object and extract slide content.
 *
 * @param {File} file   A .pptx file from an <input type="file"> or drag-drop
 * @returns {Promise<{fileName:string, slideCount:number, slides:Array}>}
 *
 * Each slide in the array:
 *   { num, title, text, lines, bgColor, hasImage }
 *   - num:      1-based slide number
 *   - title:    first placeholder title (or null)
 *   - text:     full text joined with newlines
 *   - lines:    same as text (alias used by the schedule item format)
 *   - bgColor:  CSS hex colour or null
 *   - hasImage: true if the slide contains image elements
 */
export async function parsePptx(file) {
  if (!file.name.toLowerCase().match(/\.pptx?$/)) {
    throw new Error('Only .pptx files are supported. Please save your file in the .pptx format.');
  }
  if (!file.name.toLowerCase().endsWith('.pptx')) {
    throw new Error('The older .ppt binary format is not supported. Open the file in PowerPoint and save it as .pptx, then try again.');
  }

  const arrayBuffer = await file.arrayBuffer();
  const entries = await readZipEntries(arrayBuffer);

  // ── Get ordered slide list from presentation.xml.rels ────────────────────
  // This gives the correct display order (slide files may not be sequential).
  let slideFileOrder = null;
  const relsXml = entries['ppt/_rels/presentation.xml.rels']
    ? TEXT_DECODER.decode(entries['ppt/_rels/presentation.xml.rels'])
    : '';
  if (relsXml) {
    // Build rId → target map for slides only
    const relMap = {};
    const relRe = /<Relationship[^>]*\bId="(rId\d+)"[^>]*\bType="[^"]*\/slide"[^>]*\bTarget="([^"]+)"/g;
    let rm;
    while ((rm = relRe.exec(relsXml)) !== null) {
      // Targets are like "slides/slide1.xml" (relative to ppt/)
      relMap[rm[1]] = rm[2].replace(/^\.\.\//, '').replace(/^slides\//, 'ppt/slides/');
    }

    // Get ordered rIds from presentation.xml
    const presXml = entries['ppt/presentation.xml']
      ? TEXT_DECODER.decode(entries['ppt/presentation.xml'])
      : '';
    const sldIdRe = /<p:sldId\b[^>]*\br:id="(rId\d+)"/g;
    const ordered = [];
    let sm;
    while ((sm = sldIdRe.exec(presXml)) !== null) {
      const path = relMap[sm[1]];
      if (path) ordered.push(path);
    }
    if (ordered.length) slideFileOrder = ordered;
  }

  // Fallback: sort slide*.xml files numerically
  if (!slideFileOrder) {
    slideFileOrder = Object.keys(entries)
      .filter(n => /^ppt\/slides\/slide\d+\.xml$/.test(n))
      .sort((a, b) => {
        const na = parseInt(a.match(/slide(\d+)\.xml/)[1], 10);
        const nb = parseInt(b.match(/slide(\d+)\.xml/)[1], 10);
        return na - nb;
      });
  }

  if (slideFileOrder.length === 0) {
    throw new Error('No slides found in this file. The file may be corrupted or use an unsupported PPTX variant.');
  }

  // ── Parse each slide ──────────────────────────────────────────────────────
  const slides = slideFileOrder.map((slidePath, idx) => {
    const raw = entries[slidePath];
    if (!raw) return null;
    const xml = TEXT_DECODER.decode(raw);

    const title     = extractTitle(xml);
    const paras     = extractParagraphs(xml);
    const allText   = paras.join('\n');
    const bgColor   = extractBgColor(xml);
    const hasImage  = slideHasImages(xml);

    return {
      num:      idx + 1,
      title:    title || (paras[0] ? paras[0].slice(0, 60) : `Slide ${idx + 1}`),
      text:     allText,
      lines:    allText,
      bgColor:  bgColor,
      hasImage: hasImage,
    };
  }).filter(Boolean);

  return { fileName: file.name, slideCount: slides.length, slides };
}
