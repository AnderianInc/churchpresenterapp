/**
 * Tests for the PPTX parser helpers. These exercise the XML-level pieces in
 * isolation (no zip required), which gives us deterministic coverage of the
 * structures that real-world .pptx files emit.
 */

import { __test } from '../utils/pptxParser';

const { parseXml, collectParagraphs, extractTitle, extractBgColor, slideHasImageEls, resolveRelTarget, bytesToDataUrl } = __test;

// Common XML wrapper — declares the namespaces used inside <p:sld>
const wrap = (body) => `<?xml version="1.0" encoding="UTF-8"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"
       xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"
       xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  ${body}
</p:sld>`;

describe('collectParagraphs', () => {
  it('extracts simple text from one paragraph with one run', () => {
    const xml = wrap(`<p:cSld><p:spTree><p:sp><p:txBody>
      <a:p><a:r><a:t>Hello world</a:t></a:r></a:p>
    </p:txBody></p:sp></p:spTree></p:cSld>`);
    const paras = collectParagraphs(parseXml(xml));
    expect(paras).toEqual(['Hello world']);
  });

  it('joins multiple text runs within one paragraph', () => {
    const xml = wrap(`<p:cSld><p:spTree><p:sp><p:txBody>
      <a:p>
        <a:r><a:rPr lang="en-US"/><a:t>Hello, </a:t></a:r>
        <a:r><a:rPr lang="en-US" b="1"/><a:t>world!</a:t></a:r>
      </a:p>
    </p:txBody></p:sp></p:spTree></p:cSld>`);
    const paras = collectParagraphs(parseXml(xml));
    expect(paras).toEqual(['Hello, world!']);
  });

  it('emits one entry per <a:p>', () => {
    const xml = wrap(`<p:cSld><p:spTree><p:sp><p:txBody>
      <a:p><a:r><a:t>First line</a:t></a:r></a:p>
      <a:p><a:r><a:t>Second line</a:t></a:r></a:p>
    </p:txBody></p:sp></p:spTree></p:cSld>`);
    const paras = collectParagraphs(parseXml(xml));
    expect(paras).toEqual(['First line', 'Second line']);
  });

  it('treats <a:br/> within a paragraph as a newline inside that paragraph', () => {
    const xml = wrap(`<p:cSld><p:spTree><p:sp><p:txBody>
      <a:p>
        <a:r><a:t>Line A</a:t></a:r>
        <a:br/>
        <a:r><a:t>Line B</a:t></a:r>
      </a:p>
    </p:txBody></p:sp></p:spTree></p:cSld>`);
    const paras = collectParagraphs(parseXml(xml));
    expect(paras).toEqual(['Line A\nLine B']);
  });

  it('decodes XML entities including &apos; and numeric entities', () => {
    const xml = wrap(`<p:cSld><p:spTree><p:sp><p:txBody>
      <a:p><a:r><a:t>It&apos;s &quot;great&quot; &amp; cool &#x2014; yes</a:t></a:r></a:p>
    </p:txBody></p:sp></p:spTree></p:cSld>`);
    const paras = collectParagraphs(parseXml(xml));
    expect(paras).toEqual(['It\'s "great" & cool — yes']);
  });

  it('skips empty paragraphs', () => {
    const xml = wrap(`<p:cSld><p:spTree><p:sp><p:txBody>
      <a:p><a:endParaRPr lang="en-US"/></a:p>
      <a:p><a:r><a:t>Only line</a:t></a:r></a:p>
    </p:txBody></p:sp></p:spTree></p:cSld>`);
    const paras = collectParagraphs(parseXml(xml));
    expect(paras).toEqual(['Only line']);
  });

  it('collects text from text in multiple shapes on the slide', () => {
    const xml = wrap(`<p:cSld><p:spTree>
      <p:sp><p:txBody><a:p><a:r><a:t>Shape one</a:t></a:r></a:p></p:txBody></p:sp>
      <p:sp><p:txBody><a:p><a:r><a:t>Shape two</a:t></a:r></a:p></p:txBody></p:sp>
    </p:spTree></p:cSld>`);
    const paras = collectParagraphs(parseXml(xml));
    expect(paras).toEqual(['Shape one', 'Shape two']);
  });

  it('preserves Unicode characters', () => {
    const xml = wrap(`<p:cSld><p:spTree><p:sp><p:txBody>
      <a:p><a:r><a:t>Hallelujah — 哈利路亚 — שָׁלוֹם</a:t></a:r></a:p>
    </p:txBody></p:sp></p:spTree></p:cSld>`);
    const paras = collectParagraphs(parseXml(xml));
    expect(paras).toEqual(['Hallelujah — 哈利路亚 — שָׁלוֹם']);
  });

  it('returns [] for a slide with no text bodies', () => {
    const xml = wrap(`<p:cSld><p:spTree><p:sp><p:nvSpPr><p:nvPr/></p:nvSpPr></p:sp></p:spTree></p:cSld>`);
    const paras = collectParagraphs(parseXml(xml));
    expect(paras).toEqual([]);
  });
});

describe('extractTitle', () => {
  it('extracts text from a title placeholder', () => {
    const xml = wrap(`<p:cSld><p:spTree>
      <p:sp>
        <p:nvSpPr><p:nvPr><p:ph type="title"/></p:nvPr></p:nvSpPr>
        <p:txBody><a:p><a:r><a:t>Sermon Title</a:t></a:r></a:p></p:txBody>
      </p:sp>
      <p:sp><p:txBody><a:p><a:r><a:t>Body text</a:t></a:r></a:p></p:txBody></p:sp>
    </p:spTree></p:cSld>`);
    expect(extractTitle(parseXml(xml))).toBe('Sermon Title');
  });

  it('matches ctrTitle and subTitle placeholders', () => {
    const xml = wrap(`<p:cSld><p:spTree>
      <p:sp>
        <p:nvSpPr><p:nvPr><p:ph type="ctrTitle"/></p:nvPr></p:nvSpPr>
        <p:txBody><a:p><a:r><a:t>Centered Title</a:t></a:r></a:p></p:txBody>
      </p:sp>
    </p:spTree></p:cSld>`);
    expect(extractTitle(parseXml(xml))).toBe('Centered Title');
  });

  it('returns null when no title placeholder is present', () => {
    const xml = wrap(`<p:cSld><p:spTree>
      <p:sp><p:txBody><a:p><a:r><a:t>Just a body</a:t></a:r></a:p></p:txBody></p:sp>
    </p:spTree></p:cSld>`);
    expect(extractTitle(parseXml(xml))).toBeNull();
  });
});

describe('extractBgColor', () => {
  it('extracts the slide background hex when present', () => {
    const xml = wrap(`<p:cSld>
      <p:bg><p:bgPr><a:solidFill><a:srgbClr val="1A2B3C"/></a:solidFill></p:bgPr></p:bg>
      <p:spTree/>
    </p:cSld>`);
    expect(extractBgColor(parseXml(xml))).toBe('#1a2b3c');
  });

  it('returns null when no background is set', () => {
    const xml = wrap(`<p:cSld><p:spTree/></p:cSld>`);
    expect(extractBgColor(parseXml(xml))).toBeNull();
  });
});

describe('slideHasImageEls', () => {
  it('detects <a:blip> references', () => {
    const xml = wrap(`<p:cSld><p:spTree><p:pic><p:blipFill><a:blip r:embed="rId2"/></p:blipFill></p:pic></p:spTree></p:cSld>`);
    expect(slideHasImageEls(parseXml(xml))).toBe(true);
  });

  it('returns false when there are no image elements', () => {
    const xml = wrap(`<p:cSld><p:spTree><p:sp><p:txBody><a:p><a:r><a:t>Just text</a:t></a:r></a:p></p:txBody></p:sp></p:spTree></p:cSld>`);
    expect(slideHasImageEls(parseXml(xml))).toBe(false);
  });
});

describe('resolveRelTarget', () => {
  it('resolves ../media/imageN.png relative to a slide rels file', () => {
    expect(resolveRelTarget('ppt/slides/slide3.xml', '../media/image2.png')).toBe('ppt/media/image2.png');
  });

  it('resolves a same-directory target', () => {
    expect(resolveRelTarget('ppt/slides/slide1.xml', 'media/img.jpg')).toBe('ppt/slides/media/img.jpg');
  });
});

describe('bytesToDataUrl', () => {
  it('builds a data URL with the correct mime from the filename extension', () => {
    const bytes = new Uint8Array([0x89, 0x50, 0x4e, 0x47]); // PNG magic prefix
    const url = bytesToDataUrl(bytes, 'ppt/media/image1.png');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('falls back to image/png for unknown extensions', () => {
    const url = bytesToDataUrl(new Uint8Array([1, 2, 3]), 'ppt/media/blob');
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
  });

  it('maps .jpg to image/jpeg', () => {
    const url = bytesToDataUrl(new Uint8Array([0xff, 0xd8]), 'ppt/media/photo.jpg');
    expect(url.startsWith('data:image/jpeg;base64,')).toBe(true);
  });
});
