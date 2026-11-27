// Fit / size / aspect helpers for image and video slide backgrounds.
//
// Background fields used here (all optional):
//   fit:    'cover' (default) fills and crops. 'contain' shows the whole picture.
//   scale:  0..1, only used with 'contain'. Shrinks the picture inside the slide;
//           the area around it shows the slide's base colour.
//   aspect: video only. 'slide' / undefined = the video frame is the whole slide.
//           '16:9' | '4:3' | '1:1' | '9:16' | '21:9' = the video is stretched to a
//           frame of that ratio, fitted inside the slide (fit does not apply;
//           scale shrinks the frame). 'stretch' = video is stretched to fill the slide.

export const VIDEO_ASPECT_RATIOS = {
  '16:9': 16 / 9,
  '4:3': 4 / 3,
  '1:1': 1,
  '9:16': 9 / 16,
  '21:9': 21 / 9,
};

export const VIDEO_ASPECT_OPTIONS = [
  { key: 'slide', label: 'Slide (default)' },
  { key: '16:9', label: '16:9' },
  { key: '4:3', label: '4:3' },
  { key: '1:1', label: '1:1' },
  { key: '9:16', label: '9:16 (portrait)' },
  { key: '21:9', label: '21:9 (ultrawide)' },
  { key: 'stretch', label: 'Stretch to fill' },
];

function clampScale(scale) {
  return typeof scale === 'number' ? Math.max(0.1, Math.min(1, scale)) : 1;
}

/** backgroundSize for an image background layer. */
export function imageBackgroundSize(bg) {
  if (bg?.fit !== 'contain') return 'cover';
  const scale = clampScale(bg.scale);
  // A single percentage sets the width; height follows the aspect ratio.
  return scale >= 0.999 ? 'contain' : `${Math.round(scale * 100)}%`;
}

/** True when the video frame uses a fixed ratio, which needs a sized container. */
export function hasVideoAspectRatio(bg) {
  return VIDEO_ASPECT_RATIOS[bg?.aspect] != null;
}

/**
 * Extra style for the slide element that holds a ratio-framed video.
 * Container query units (cqw/cqh) on the video need this element to be a size container.
 */
export function videoContainerStyle(bg) {
  return hasVideoAspectRatio(bg) ? { containerType: 'size' } : {};
}

/**
 * Layout style for a video background element.
 * The element must sit inside a slide container (position: relative).
 */
export function videoFitStyle(bg) {
  if (bg?.aspect === 'stretch') {
    return { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'fill' };
  }

  const contain = bg?.fit === 'contain';
  const scale = contain ? clampScale(bg.scale) : 1;
  const objectFit = contain ? 'contain' : 'cover';
  const ratio = VIDEO_ASPECT_RATIOS[bg?.aspect];

  if (ratio != null) {
    // Largest box of the requested ratio that fits inside the slide, shrunk by
    // the size slider. The whole video is stretched into that box (objectFit
    // 'fill'), so the chosen ratio really changes the picture and nothing is
    // cropped. Fit does not apply to ratio frames.
    const size = clampScale(bg.scale);
    const frameW = `min(100cqw, calc(100cqh * ${ratio}))`;
    const frameH = `min(100cqh, calc(100cqw / ${ratio}))`;
    const centred = { position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)', objectFit: 'fill' };
    if (size >= 0.999) return { ...centred, width: frameW, height: frameH };
    return { ...centred, width: `calc(${frameW} * ${size})`, height: `calc(${frameH} * ${size})` };
  }

  // Slide frame (default).
  if (!contain || scale >= 0.999) {
    return { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit };
  }
  const pct = `${Math.round(scale * 100)}%`;
  return {
    position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
    width: pct, height: pct, objectFit: 'contain',
  };
}
