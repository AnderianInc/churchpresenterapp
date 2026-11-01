import React from 'react';
import ReactDOM from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import FadeSlide from '../components/FadeSlide';

// Regression: changing only the text of a slide while the same background video
// continues must not remount the <video> element (a remount restarts the video).
describe('FadeSlide background video continuity', () => {
  let container;
  let root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.appendChild(container);
    root = ReactDOM.createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  test('same video background keeps the same <video> node across slides', () => {
    const item = { background: { type: 'video', value: 'media:///loop.mp4' } };
    act(() => root.render(<FadeSlide slide={{ id: 's1', lines: 'First line', item }} item={item} />));
    const before = container.querySelector('video');

    act(() => root.render(<FadeSlide slide={{ id: 's2', lines: 'Second line', item }} item={item} />));
    const after = container.querySelector('video');

    expect(before).not.toBeNull();
    expect(after).toBe(before);
    expect(container.textContent).toContain('Second line');
  });
});
