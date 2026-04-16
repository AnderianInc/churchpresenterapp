import React, { useState, useEffect } from 'react';
import SlideRenderer from './SlideRenderer';
import { readLiveState } from '../store/liveStateSync';
import { makeBroadcastMsg, BROADCAST_CHANNEL } from '../store/AppContext';

function getQueryParams() {
  const search = window.location.search || '';
  if (search) return new URLSearchParams(search);

  const hash = window.location.hash || '';
  const queryIndex = hash.indexOf('?');
  if (queryIndex !== -1) {
    return new URLSearchParams(hash.slice(queryIndex));
  }
  return new URLSearchParams();
}

function resolveSlideForRole(role, outputId, payload) {
  if (!payload) return null;
  if (outputId && payload.outputs?.[outputId]?.slide) {
    return payload.outputs[outputId].slide;
  }
  if (payload.roleSlides?.[role]) {
    return payload.roleSlides[role];
  }
  if (role === 'stage') {
    const mirror = payload.stageMirror !== false;
    return mirror ? payload.programSlide : (payload.stageSlide || payload.programSlide);
  }
  if (role === 'announcement') {
    return payload.announcementSlide || payload.programSlide;
  }
  if (role === 'background') {
    return payload.backgroundSlide || payload.programSlide;
  }
  if (role === 'confidence') {
    return payload.confidenceSlide || payload.programSlide;
  }
  return payload.programSlide;
}

export default function OutputView() {
  const params = getQueryParams();
  const role = params.get('role') || 'presentation';
  const outputId = params.get('id');
  const [slide, setSlide] = useState(null);
  const [isBlackout, setIsBlackout] = useState(false);
  const [isClear, setIsClear] = useState(false);
  const [roleLabel, setRoleLabel] = useState(role.replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()));

  useEffect(() => {
    const initial = readLiveState();
    const startSlide = resolveSlideForRole(role, outputId, initial);
    setSlide(startSlide);
    setIsBlackout(initial.isBlackout);
    setIsClear(initial.isClear);

    if (window.electronAPI) {
      window.electronAPI.onReceiveOutput((data) => {
        setSlide(resolveSlideForRole(role, outputId, data));
        setRoleLabel((data.outputs?.[outputId]?.role || role).replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()));
        setIsBlackout(!!data.isBlackout);
        setIsClear(!!data.isClear);
      });
      return () => {
        window.electronAPI.removeAllListeners('receive-output');
      };
    }

    if (typeof BroadcastChannel === 'undefined') return undefined;
    const channel = new BroadcastChannel(BROADCAST_CHANNEL);
    channel.onmessage = (e) => {
      const { type, payload } = e.data || {};
      if (type === 'state-sync') {
        setSlide(resolveSlideForRole(role, outputId, payload));
        setRoleLabel((payload.outputs?.[outputId]?.role || role).replace(/[-_]/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase()));
        setIsBlackout(!!payload?.isBlackout);
        setIsClear(!!payload?.isClear);
      }
      if (type === 'blackout') setIsBlackout(payload);
      if (type === 'clear') setIsClear(payload);
      if (type === 'slide-program' && role !== 'stage') {
        setSlide(payload);
        setIsBlackout(false);
        setIsClear(false);
      }
      if (type === 'slide-stage' && role === 'stage') {
        setSlide(payload);
        setIsBlackout(false);
        setIsClear(false);
      }
      if (type === 'output-target' && outputId && payload?.id === outputId) {
        setSlide(payload.slide);
        setIsBlackout(false);
        setIsClear(false);
      }
      if (type === 'output-role-target' && payload?.role === role) {
        setSlide(payload.slide);
        setIsBlackout(false);
        setIsClear(false);
      }
    };
    channel.postMessage(makeBroadcastMsg('state-request', null));
    return () => channel.close();
  }, [role, outputId]);

  if (isBlackout) {
    return <div style={{ width: '100vw', height: '100vh', background: '#000000' }} />;
  }

  if (isClear || !slide) {
    return (
      <div style={{ width: '100vw', height: '100vh', background: '#111111', display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
        {(isClear || !slide) && (
          <div style={{ position: 'absolute', top: 16, left: 16, color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
            {roleLabel}
          </div>
        )}
        <div style={{ textAlign: 'center', color: 'rgba(255,255,255,0.15)' }}>
          {isClear ? (
            <div style={{ fontSize: 24, marginBottom: 8 }}>CLEAR</div>
          ) : (
            <>
              <div style={{ fontSize: 64, marginBottom: 16 }}>✝</div>
              <div style={{ fontSize: 16, fontFamily: 'Georgia', letterSpacing: '0.1em' }}>Waiting for content</div>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
      <div style={{ position: 'absolute', top: 16, left: 16, zIndex: 2, color: 'rgba(255,255,255,0.7)', fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.14em' }}>
        {roleLabel}
      </div>
      <SlideRenderer slide={slide} item={slide?.item} fullscreen />
    </div>
  );
}
