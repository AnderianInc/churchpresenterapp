import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react-dom/test-utils';
import useAutosave from '../hooks/useAutosave';

jest.useFakeTimers();

function mount(element) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  let root;
  act(() => { root = createRoot(container); root.render(element); });
  return {
    container,
    rerender: (next) => act(() => root.render(next)),
    unmount: () => act(() => root.unmount()),
  };
}

function Probe({ initial, save, opts, onStatus }) {
  const [v, setV] = useState(initial);
  const status = useAutosave(v, save, opts);
  React.useEffect(() => { onStatus?.(status); }, [status, onStatus]);
  return <button data-testid="bump" onClick={() => setV(x => x + 1)}>{v}</button>;
}

const click = (container) =>
  act(() => { container.querySelector('[data-testid="bump"]').click(); });

describe('useAutosave', () => {
  it('does not fire save on initial render', () => {
    const save = jest.fn();
    mount(<Probe initial={0} save={save} />);
    act(() => { jest.advanceTimersByTime(2000); });
    expect(save).not.toHaveBeenCalled();
  });

  it('fires save once after the debounce window elapses', () => {
    const save = jest.fn();
    const { container } = mount(<Probe initial={0} save={save} />);
    click(container);
    expect(save).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(399); });
    expect(save).not.toHaveBeenCalled();
    act(() => { jest.advanceTimersByTime(1); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(1);
  });

  it('coalesces rapid edits into a single save', () => {
    const save = jest.fn();
    const { container } = mount(<Probe initial={0} save={save} />);
    click(container);
    act(() => { jest.advanceTimersByTime(200); });
    click(container);
    act(() => { jest.advanceTimersByTime(200); });
    click(container);
    act(() => { jest.advanceTimersByTime(400); });
    expect(save).toHaveBeenCalledTimes(1);
    expect(save).toHaveBeenCalledWith(3);
  });

  it('does not call save when enabled is false', () => {
    const save = jest.fn();
    const { container } = mount(<Probe initial={0} save={save} opts={{ enabled: false }} />);
    click(container);
    act(() => { jest.advanceTimersByTime(1000); });
    expect(save).not.toHaveBeenCalled();
  });
});
