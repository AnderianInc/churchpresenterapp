// Layout style for a video background, driven by the background's fit/scale.
//   fit 'cover' (default): fill the slide and crop the overflow.
//   fit 'contain':         show the whole video. scale < 1 shrinks the video box
//                          inside the slide; areas outside it show the slide base.
export function videoFitStyle(bg) {
  if (bg?.fit !== 'contain') {
    return { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' };
  }
  const scale = typeof bg.scale === 'number' ? Math.max(0.1, Math.min(1, bg.scale)) : 1;
  if (scale >= 0.999) {
    return { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' };
  }
  const pct = `${Math.round(scale * 100)}%`;
  return {
    position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%)',
    width: pct, height: pct, objectFit: 'contain',
  };
}
