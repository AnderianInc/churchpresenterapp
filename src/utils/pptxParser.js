/**
 * src/utils/pptxParser.js
 *
 * Parses a .pptx file and extracts per-slide text, title, background colour,
 * and the slide's primary embedded image (if any). Zero external deps:
 *   - arrayBuffer() / DataView / Uint8Array for binary access
 *   - DecompressionStream (Chrome 80+ / Electron 12+) for DEFLATE entries
 *   - DOMParser (built-in) for namespace-aware XML parsing — much more robust
 *     than regex against the many flavours of PPTX produced by PowerPoint,
 *     Keynote, Google Slides, LibreOffice, etc.
 *
 * Returns: { fileName, slideCount, slides }
 * Each slide: { num, title, text, lines, bgColor, bgImage, hasImage }
 *   - bgImage is a data URL of the slide's primary embedded image, or null.
 *     If present, the importer should use it as an image background so the
 *     slide isn't visually empty for image-heavy decks (announcement slides).
 */

const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const P_NS = 'http://schemas.openxmlformats.org/presentationml/2006/main';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';

// Lazy globals — instantiated on first use so the module loads cleanly in
// environments (Jest/jsdom) that haven't yet polyfilled these Web APIs.
let _textDecoder = null;
const decodeText = (bytes) => {
  if (!_textDecoder) _textDecoder = new TextDecoder();
  return _textDecoder.decode(bytes);
};
const DOM_PARSER = typeof DOMParser !== 'undefined' ? new DOMParser() : null;

// ── ZIP reader ────────────────────────────────────────────────────────────────

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

  let eocdPos = -1;
  const EOCD_SIG = 0x06054b50;
  for (let i = bytes.length - 22; i >= 0 && i >= bytes.length - 22 - 65536; i--) {
    if (view.getUint32(i, true) === EOCD_SIG) { eocdPos = i; break; }
  }
  if (eocdPos === -1) throw new Error('Not a valid ZIP/PPTX file (EOCD not found)');

  const cdCount  = view.getUint16(eocdPos + 10, true);
  const cdOffset = view.getUint32(eocdPos + 16, true);

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
    const fileName        = decodeText(bytes.slice(pos + 46, pos + 46 + fileNameLen));

    pos += 46 + fileNameLen + extraLen + commentLen;

    if (fileName.endsWith('/')) continue;

    const lfnLen   = view.getUint16(localHdrOffset + 26, true);
    const lfExtraLen = view.getUint16(localHdrOffset + 28, true);
    const dataStart  = localHdrOffset + 30 + lfnLen + lfExtraLen;
    const raw = bytes.slice(dataStart, dataStart + compressedSz);

    if (compression === 0) {
      entries[fileName] = raw;
    } else if (compression === 8) {
      entries[fileName] = await decompressDeflateRaw(raw);
    }
  }

  return entries;
}

// ── XML parsing helpers (DOMParser-based) ─────────────────────────────────────

function parseXml(xmlString) {
  if (!DOM_PARSER) throw new Error('DOMParser unavailable in this environment.');
  const doc = DOM_PARSER.parseFromString(xmlString, 'application/xml');
  // application/xml surfaces parse errors as a <parsererror> element
  if (doc.getElementsByTagName('parsererror').length > 0) return null;
  return doc;
}

/**
 * Collect text from every <a:t> descendant of the given element, joining
 * runs within a paragraph and emitting one paragraph per <a:p>. Handles
 * <a:br/> line breaks within a paragraph.
 */
function collectParagraphs(root) {
  if (!root) return [];
  const paras = [];
  const pNodes = root.getElementsByTagNameNS(A_NS, 'p');
  for (let i = 0; i < pNodes.length; i++) {
    const p = pNodes[i];
    const parts = [];
    // Walk paragraph children in document order so <a:br/> becomes a real newline
    const walker = (node) => {
      for (let c = node.firstChild; c; c = c.nextSibling) {
        if (c.nodeType !== 1) continue; // ELEMENT_NODE
        const local = c.localName;
        if (local === 't' && c.namespaceURI === A_NS) {
          parts.push(c.textContent || '');
        } else if (local === 'br' && c.namespaceURI === A_NS) {
          parts.push('\n');
        } else {
          walker(c);
        }
      }
    };
    walker(p);
    const line = parts.join('').replace(/ /g, ' ').trim();
    if (line) paras.push(line);
  }
  return paras;
}

/**
 * Extract title: first <p:ph type="title|ctrTitle|subTitle"> placeholder's
 * <p:txBody> content; falls back to null if no title placeholder is present.
 */
function extractTitle(doc) {
  if (!doc) return null;
  const phs = doc.getElementsByTagNameNS(P_NS, 'ph');
  for (let i = 0; i < phs.length; i++) {
    const type = phs[i].getAttribute('type');
    if (!type || !['title', 'ctrTitle', 'subTitle'].includes(type)) continue;
    // Walk up to the enclosing <p:sp>
    let sp = phs[i];
    while (sp && !(sp.localName === 'sp' && sp.namespaceURI === P_NS)) sp = sp.parentNode;
    if (!sp) continue;
    const txBodies = sp.getElementsByTagNameNS(P_NS, 'txBody');
    if (txBodies.length === 0) continue;
    const paras = collectParagraphs(txBodies[0]);
    if (paras.length) return paras[0];
  }
  return null;
}

/**
 * Solid hex background colour from <p:bg><a:solidFill><a:srgbClr val="..."/>
 * Returns "#aabbcc" or null.
 */
function extractBgColor(doc) {
  if (!doc) return null;
  const bgs = doc.getElementsByTagNameNS(P_NS, 'bg');
  if (bgs.length === 0) return null;
  const clrs = bgs[0].getElementsByTagNameNS(A_NS, 'srgbClr');
  if (clrs.length === 0) return null;
  const val = clrs[0].getAttribute('val');
  if (val && /^[0-9A-Fa-f]{6}$/.test(val)) return '#' + val.toLowerCase();
  return null;
}

function slideHasImageEls(doc) {
  if (!doc) return false;
  return doc.getElementsByTagNameNS(A_NS, 'blip').length > 0
      || doc.getElementsByTagNameNS(P_NS, 'pic').length > 0;
}

// ── Image extraction ──────────────────────────────────────────────────────────

const IMG_EXT_MIME = {
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg',
  gif: 'image/gif', webp: 'image/webp', bmp: 'image/bmp', svg: 'image/svg+xml',
};

function bytesToBase64(bytes) {
  // Avoid stack overflow on large inputs by chunking
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  return typeof btoa !== 'undefined' ? btoa(binary) : Buffer.from(binary, 'binary').toString('base64');
}

function bytesToDataUrl(bytes, fileName) {
  const ext = (fileName.split('.').pop() || '').toLowerCase();
  const mime = IMG_EXT_MIME[ext] || 'image/png';
  return `data:${mime};base64,${bytesToBase64(bytes)}`;
}

/**
 * Resolve a relationship Target path (relative to the slide rels location)
 * to an absolute path within the zip (e.g. "ppt/media/image1.png").
 */
function resolveRelTarget(slidePath, target) {
  // slidePath like "ppt/slides/slide1.xml"; rels are at "ppt/slides/_rels/slide1.xml.rels"
  // Target like "../media/image1.png" → ppt/media/image1.png
  const base = slidePath.split('/').slice(0, -1); // ["ppt","slides"]
  const segs = target.split('/');
  const stack = base.slice();
  for (const s of segs) {
    if (s === '..') stack.pop();
    else if (s === '.' || s === '') continue;
    else stack.push(s);
  }
  return stack.join('/');
}

/**
 * Find the primary embedded image for a slide and return it as a data URL,
 * or null if none. Strategy:
 *   1. Read ppt/slides/_rels/slideN.xml.rels
 *   2. Find relationships of type ".../image"
 *   3. For each, look up the bytes in `entries`; pick the largest by length
 *   4. Convert to data URL
 */
function extractPrimarySlideImage(slidePath, entries) {
  const relsPath = slidePath.replace(/slides\/(slide\d+)\.xml$/, 'slides/_rels/$1.xml.rels');
  const relsBytes = entries[relsPath];
  if (!relsBytes) return null;
  const relsXml = decodeText(relsBytes);
  const doc = parseXml(relsXml);
  if (!doc) return null;

  const rels = doc.getElementsByTagNameNS(REL_NS, 'Relationship');
  let best = null; // { path, bytes }
  for (let i = 0; i < rels.length; i++) {
    const r = rels[i];
    const type = r.getAttribute('Type') || '';
    if (!type.endsWith('/image')) continue;
    const target = r.getAttribute('Target') || '';
    if (!target) continue;
    const abs = resolveRelTarget(slidePath, target);
    const bytes = entries[abs];
    if (!bytes) continue;
    if (!best || bytes.length > best.bytes.length) best = { path: abs, bytes };
  }
  if (!best) return null;
  return bytesToDataUrl(best.bytes, best.path);
}

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Parse a .pptx File and extract per-slide content.
 *
 * @param {File} file   A .pptx file from <input type="file"> or drag-drop
 * @returns {Promise<{fileName, slideCount, slides}>}
 *   slide: { num, title, text, lines, bgColor, bgImage, hasImage }
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

  // ── Determine ordered slide list from presentation.xml.rels ───────────────
  let slideFileOrder = null;
  const relsBytes = entries['ppt/_rels/presentation.xml.rels'];
  const presBytes = entries['ppt/presentation.xml'];
  if (relsBytes && presBytes) {
    const relsDoc = parseXml(decodeText(relsBytes));
    const presDoc = parseXml(decodeText(presBytes));
    if (relsDoc && presDoc) {
      const relMap = {};
      const rels = relsDoc.getElementsByTagNameNS(REL_NS, 'Relationship');
      for (let i = 0; i < rels.length; i++) {
        const r = rels[i];
        const type = r.getAttribute('Type') || '';
        if (!type.endsWith('/slide')) continue;
        const id = r.getAttribute('Id');
        const target = (r.getAttribute('Target') || '').replace(/^\.\.\//, '').replace(/^slides\//, 'ppt/slides/');
        if (id && target) relMap[id] = target;
      }
      const ordered = [];
      const sldIds = presDoc.getElementsByTagNameNS(P_NS, 'sldId');
      for (let i = 0; i < sldIds.length; i++) {
        // r:id attribute — namespace is "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
        const rId = sldIds[i].getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id')
                 || sldIds[i].getAttribute('r:id');
        const path = relMap[rId];
        if (path) ordered.push(path);
      }
      if (ordered.length) slideFileOrder = ordered;
    }
  }

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
    const xml = decodeText(raw);
    const doc = parseXml(xml);

    const title    = extractTitle(doc);
    const paras    = collectParagraphs(doc);
    const allText  = paras.join('\n');
    const bgColor  = extractBgColor(doc);
    const hasImage = slideHasImageEls(doc);
    const bgImage  = hasImage ? extractPrimarySlideImage(slidePath, entries) : null;

    return {
      num:      idx + 1,
      title:    title || (paras[0] ? paras[0].slice(0, 60) : `Slide ${idx + 1}`),
      text:     allText,
      lines:    allText,
      bgColor:  bgColor,
      bgImage:  bgImage,
      hasImage: hasImage,
    };
  }).filter(Boolean);

  return { fileName: file.name, slideCount: slides.length, slides };
}

// ── Test helpers (exported for unit tests; not part of the public API) ────────

export const __test = {
  parseXml,
  collectParagraphs,
  extractTitle,
  extractBgColor,
  slideHasImageEls,
  resolveRelTarget,
  bytesToDataUrl,
};
