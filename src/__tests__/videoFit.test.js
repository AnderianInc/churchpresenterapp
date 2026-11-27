import {
  videoFitStyle, videoContainerStyle, imageBackgroundSize, hasVideoAspectRatio,
} from '../utils/videoFit';

describe('videoFitStyle', () => {
  it('defaults to filling the slide with cover', () => {
    expect(videoFitStyle({ type: 'video' })).toMatchObject({ inset: 0, width: '100%', height: '100%', objectFit: 'cover' });
  });

  it('contain at full size fills the slide with contain', () => {
    expect(videoFitStyle({ fit: 'contain', scale: 1 })).toMatchObject({ inset: 0, objectFit: 'contain' });
  });

  it('contain below full size centres a percentage-sized box', () => {
    expect(videoFitStyle({ fit: 'contain', scale: 0.5 })).toMatchObject({
      left: '50%', top: '50%', width: '50%', height: '50%', objectFit: 'contain',
    });
  });

  it('stretch ignores fit and fills the slide with fill', () => {
    expect(videoFitStyle({ aspect: 'stretch', fit: 'contain', scale: 0.5 })).toMatchObject({ inset: 0, objectFit: 'fill' });
  });

  it('a 16:9 frame is sized with container units and cropped with cover', () => {
    const style = videoFitStyle({ aspect: '16:9' });
    expect(style.width).toBe('min(100cqw, calc(100cqh * 1.7777777777777777))');
    expect(style.height).toBe('min(100cqh, calc(100cqw / 1.7777777777777777))');
  });

  it('a ratio frame stretches the whole video (nothing cropped), whatever the fit', () => {
    expect(videoFitStyle({ aspect: '4:3' }).objectFit).toBe('fill');
    expect(videoFitStyle({ aspect: '4:3', fit: 'cover' }).objectFit).toBe('fill');
    expect(videoFitStyle({ aspect: '4:3', fit: 'contain' }).objectFit).toBe('fill');
  });

  it('a ratio frame shrinks by the size slider regardless of fit', () => {
    const expected = { width: 'calc(min(100cqw, calc(100cqh * 1)) * 0.5)', height: 'calc(min(100cqh, calc(100cqw / 1)) * 0.5)' };
    expect(videoFitStyle({ aspect: '1:1', fit: 'contain', scale: 0.5 })).toMatchObject(expected);
    expect(videoFitStyle({ aspect: '1:1', fit: 'cover', scale: 0.5 })).toMatchObject(expected);
  });
});

describe('videoContainerStyle / hasVideoAspectRatio', () => {
  it('only ratio frames need a size container', () => {
    expect(hasVideoAspectRatio({ aspect: '9:16' })).toBe(true);
    expect(hasVideoAspectRatio({ aspect: 'stretch' })).toBe(false);
    expect(hasVideoAspectRatio({})).toBe(false);
    expect(videoContainerStyle({ aspect: '16:9' })).toEqual({ containerType: 'size' });
    expect(videoContainerStyle({ aspect: 'stretch' })).toEqual({});
  });
});

describe('imageBackgroundSize', () => {
  it('uses cover unless contain is chosen', () => {
    expect(imageBackgroundSize({})).toBe('cover');
    expect(imageBackgroundSize({ fit: 'cover', scale: 0.5 })).toBe('cover');
  });

  it('uses contain at full size and a percentage below it', () => {
    expect(imageBackgroundSize({ fit: 'contain', scale: 1 })).toBe('contain');
    expect(imageBackgroundSize({ fit: 'contain', scale: 0.6 })).toBe('60%');
  });
});
