import { BROADCAST_CHANNEL, makeBroadcastMsg } from '../store/AppContext';

describe('BroadcastChannel contract', () => {
  it('exports the canonical channel name', () => {
    expect(BROADCAST_CHANNEL).toBe('cp_presentation');
  });

  it('makeBroadcastMsg produces correct shape for slide-program', () => {
    const slide = { id: 's1', lines: 'Amazing grace', item: { title: 'Amazing Grace' } };
    const msg = makeBroadcastMsg('slide-program', slide);
    expect(msg.type).toBe('slide-program');
    expect(msg.payload).toBe(slide);
    expect(msg).not.toHaveProperty('data'); // old broken key must not exist
  });

  it('makeBroadcastMsg supports slide-stage for independent stage output', () => {
    const slide = { id: 's2', lines: 'Stage line', item: { title: 'Other' } };
    const msg = makeBroadcastMsg('slide-stage', slide);
    expect(msg.type).toBe('slide-stage');
    expect(msg.payload).toBe(slide);
  });

  it('makeBroadcastMsg produces correct shape for blackout', () => {
    const msg = makeBroadcastMsg('blackout', true);
    expect(msg.type).toBe('blackout');
    expect(msg.payload).toBe(true);
  });

  it('makeBroadcastMsg produces correct shape for clear', () => {
    const msg = makeBroadcastMsg('clear', false);
    expect(msg.type).toBe('clear');
    expect(msg.payload).toBe(false);
  });

  it('receiver can destructure the contract without error', () => {
    const msg = makeBroadcastMsg('slide-program', { lines: 'test' });
    const { type, payload } = msg;
    expect(type).toBe('slide-program');
    expect(payload).toEqual({ lines: 'test' });
  });
});
