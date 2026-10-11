export function isScriptureSlide(slide) {
  if (!slide) return false;
  const type = slide.type || slide.item?.type || slide.item?.kind || '';
  return type === 'scripture';
}

export function buildScriptureLowerThird(slide) {
  if (!isScriptureSlide(slide)) return null;

  const label = slide.item?.title || slide.label || 'Scripture';
  const reference = slide.reference || slide.label || slide.item?.reference || label;
  const version = slide.item?.version || slide.version || '';

  return {
    active: true,
    label: 'Scripture',
    text: reference,
    source: version,
  };
}
