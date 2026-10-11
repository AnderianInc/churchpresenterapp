// Canvas-based stream compositor.
//
// Draws a live video source (an output window's own rendered content, captured via
// its Electron mediaSourceId — plus an optional lower-third / text overlay) onto an
// off-screen canvas, captures THAT canvas as a MediaStream, and emits webm chunks
// for the ffmpeg→RTMP pipe. The output window chosen as the source is never itself
// one of the stream's own destinations, so there's no feedback loop.

export function bestWebmMimeType() {
  if (typeof MediaRecorder === 'undefined') return 'video/webm';
  return ['video/webm;codecs=vp8', 'video/webm;codecs=vp9', 'video/webm']
    .find(t => MediaRecorder.isTypeSupported(t)) || 'video/webm';
}

// Cover-fit source (sw×sh) into dest (dw×dh): returns the source crop rectangle.
export function coverRect(sw, sh, dw, dh) {
  if (!sw || !sh) return { sx: 0, sy: 0, sWidth: sw, sHeight: sh };
  const scale = Math.max(dw / sw, dh / sh);
  const cropW = dw / scale;
  const cropH = dh / scale;
  return {
    sx: (sw - cropW) / 2,
    sy: (sh - cropH) / 2,
    sWidth: cropW,
    sHeight: cropH,
  };
}

// Greedy word-wrap using a canvas 2D context's measureText.
export function wrapText(ctx, text, maxWidth) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const lines = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const test = `${current} ${words[i]}`;
    if (ctx.measureText(test).width <= maxWidth) {
      current = test;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines;
}

// Compute the overlay band geometry for a given position.
export function overlayLayout(position, width, height) {
  const bandH = Math.round(height * 0.26);
  if (position === 'top') return { bandY: 0, bandH, fromTop: true };
  if (position === 'center') return { bandY: Math.round((height - bandH) / 2), bandH, fromTop: false };
  return { bandY: height - bandH, bandH, fromTop: false }; // bottom (default)
}

const ACCENT = '#4f8ef7';

// Draw a lower-third / text overlay onto a canvas 2D context.
// overlay: { active, text, label, source, fontFamily, fontScale, position, align }
export function drawOverlay(ctx, overlay, width, height) {
  if (!overlay || !overlay.active || !overlay.text) return;

  const position = overlay.position || 'bottom';
  const align = overlay.align || 'left';
  const fontFamily = overlay.fontFamily || 'Georgia, serif';
  const fontScale = typeof overlay.fontScale === 'number' ? overlay.fontScale : 1;
  const { bandY, bandH } = overlayLayout(position, width, height);

  // Scrim so text is readable over any footage
  const grad = ctx.createLinearGradient(0, bandY, 0, bandY + bandH);
  if (position === 'top') {
    grad.addColorStop(0, 'rgba(0,0,0,0.85)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
  } else if (position === 'center') {
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.75)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
  } else {
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.85)');
  }
  ctx.fillStyle = grad;
  ctx.fillRect(0, bandY, width, bandH);

  const padX = Math.round(width * 0.06);
  const maxTextW = width - padX * 2 - (align === 'left' ? 20 : 0);
  const textSize = Math.round(height * 0.055 * fontScale);
  const labelSize = Math.round(textSize * 0.42);
  const sourceSize = Math.round(textSize * 0.5);

  ctx.textAlign = align === 'center' ? 'center' : align === 'right' ? 'right' : 'left';
  const anchorX = align === 'center' ? width / 2 : align === 'right' ? width - padX : padX + (align === 'left' ? 20 : 0);

  // Wrap the main text
  ctx.font = `${textSize}px ${fontFamily}`;
  const lines = wrapText(ctx, overlay.text, maxTextW);
  const lineH = Math.round(textSize * 1.3);
  const hasLabel = !!overlay.label;
  const hasSource = !!overlay.source;
  const blockH = (hasLabel ? Math.round(labelSize * 1.6) : 0) + lines.length * lineH + (hasSource ? Math.round(sourceSize * 1.6) : 0);

  // Vertically place the text block within the band (toward the inner edge)
  let y;
  if (position === 'top') y = bandY + Math.round(bandH * 0.22);
  else if (position === 'center') y = bandY + Math.round((bandH - blockH) / 2) + labelSize;
  else y = bandY + bandH - blockH - Math.round(height * 0.04) + labelSize;

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.9)';
  ctx.shadowBlur = Math.round(textSize * 0.25);

  // Accent bar (left-aligned only)
  if (align === 'left') {
    ctx.fillStyle = ACCENT;
    ctx.fillRect(padX, y - labelSize, 4, blockH);
  }

  if (hasLabel) {
    ctx.font = `700 ${labelSize}px Inter, sans-serif`;
    ctx.fillStyle = '#7cb9fa';
    ctx.fillText(String(overlay.label).toUpperCase(), anchorX, y);
    y += Math.round(labelSize * 1.6);
  }

  ctx.font = `${textSize}px ${fontFamily}`;
  ctx.fillStyle = '#ffffff';
  for (const line of lines) {
    y += textSize * 0.1;
    ctx.fillText(line, anchorX, y + textSize * 0.8);
    y += lineH;
  }

  if (hasSource) {
    ctx.font = `italic ${sourceSize}px ${fontFamily}`;
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillText(overlay.source, anchorX, y + sourceSize * 0.6);
  }

  ctx.restore();
}

export class StreamCompositor {
  constructor({ width = 1280, height = 720, fps = 30 } = {}) {
    this.width = width;
    this.height = height;
    this.fps = fps;
    this.canvas = null;
    this.ctx = null;
    this.video = null;
    this.camStream = null;
    this.micStream = null;
    this.outStream = null;
    this.recorder = null;
    this.rafId = null;
    this.stopped = false;
    this._getOverlay = null;
  }

  /**
   * @param {object} opts
   * @param {string} opts.mediaSourceId          an output window's Electron capture source id — the stream's video source
   * @param {string} opts.cameraDeviceId         legacy: a raw camera device id (used only if mediaSourceId isn't given)
   * @param {boolean} opts.audio                 capture microphone audio (default true)
   * @param {function} opts.getOverlay           () => overlay object drawn each frame
   * @param {number} opts.videoBitsPerSecond
   * @param {function} opts.onChunk              (Uint8Array) => void
   * @param {function} opts.onError              (string) => void
   * @param {number} opts.timeslice              MediaRecorder timeslice ms (default 500)
   */
  async start(opts) {
    const {
      mediaSourceId, cameraDeviceId, audio = true, getOverlay,
      videoBitsPerSecond = 2_500_000, onChunk, onError, timeslice = 500,
    } = opts || {};
    this._getOverlay = getOverlay || null;

    if (mediaSourceId) {
      // Capture an output window's own rendered content (chosen in the UI) instead
      // of a physical camera — this is the normal path. Audio is not requestable
      // alongside chromeMediaSource:'desktop' video reliably, so it's acquired
      // separately below (microphone), independent of the video source.
      try {
        // Try the modern constraint syntax first (more reliable)
        try {
          this.camStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              mandatory: {
                chromeMediaSource: 'desktop',
                chromeMediaSourceId: mediaSourceId,
              },
            },
          });
        } catch (legacyErr) {
          // Fallback to sourceId constraint syntax (older Electron versions)
          this.camStream = await navigator.mediaDevices.getUserMedia({
            audio: false,
            video: {
              sourceId: mediaSourceId,
            },
          });
        }
      } catch (err) {
        throw new Error(`Desktop capture failed (mediaSourceId may be stale or invalid): ${err.message}`);
      }
    } else {
      // Legacy fallback: a raw camera device as the video source.
      const videoConstraint = cameraDeviceId
        ? { deviceId: { ideal: cameraDeviceId }, width: { ideal: this.width }, height: { ideal: this.height } }
        : { width: { ideal: this.width }, height: { ideal: this.height } };
      this.camStream = await navigator.mediaDevices.getUserMedia({ video: videoConstraint, audio: false });
    }

    if (audio) {
      try {
        this.micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (_) {
        this.micStream = null; // mic denied/unavailable — stream video-only
      }
    }

    this.video = document.createElement('video');
    this.video.muted = true;
    this.video.playsInline = true;
    this.video.srcObject = this.camStream;

    // Wait for video to start playing and have frames ready before starting recorder.
    // This prevents ffmpeg from receiving an empty stream.
    try {
      await this.video.play();
      // Wait up to 2 seconds for the first frame to arrive (readyState >= 2 means HAVE_CURRENT_DATA)
      const frameReady = await new Promise((resolve) => {
        if (this.video.readyState >= 2) {
          resolve(true);
          return;
        }
        const onCanPlay = () => {
          this.video.removeEventListener('canplay', onCanPlay);
          resolve(true);
        };
        this.video.addEventListener('canplay', onCanPlay);
        setTimeout(() => {
          this.video.removeEventListener('canplay', onCanPlay);
          resolve(false); // timeout — no frames yet, but proceed anyway
        }, 2000);
      });
      if (!frameReady) {
        console.warn('[StreamCompositor] No video frames received within 2s, proceeding anyway');
      }
    } catch (err) {
      throw new Error(`Video playback failed: ${err.message}`);
    }

    this.canvas = document.createElement('canvas');
    this.canvas.width = this.width;
    this.canvas.height = this.height;
    this.ctx = this.canvas.getContext('2d');

    const draw = () => {
      if (this.stopped) return;
      try {
        const vw = this.video.videoWidth || this.width;
        const vh = this.video.videoHeight || this.height;
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.width, this.height);
        const { sx, sy, sWidth, sHeight } = coverRect(vw, vh, this.width, this.height);
        this.ctx.drawImage(this.video, sx, sy, sWidth, sHeight, 0, 0, this.width, this.height);
        const overlay = this._getOverlay?.();
        if (overlay) drawOverlay(this.ctx, overlay, this.width, this.height);
      } catch (_) { /* frame skipped */ }
      this.rafId = requestAnimationFrame(draw);
    };
    draw();

    // Capture the canvas + combine with the separately-acquired mic audio track
    this.outStream = this.canvas.captureStream(this.fps);
    const audioTracks = this.micStream ? this.micStream.getAudioTracks() : [];
    audioTracks.forEach(t => this.outStream.addTrack(t));

    const mimeType = bestWebmMimeType();
    this.recorder = new MediaRecorder(this.outStream, { mimeType, videoBitsPerSecond });
    this.recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0 && onChunk) {
        e.data.arrayBuffer().then(buf => onChunk(new Uint8Array(buf))).catch(() => {});
      }
    };
    this.recorder.onerror = (e) => onError?.(e?.error?.message || 'Recorder error');
    this.recorder.start(timeslice);
    return true;
  }

  stop() {
    this.stopped = true;
    if (this.rafId) { cancelAnimationFrame(this.rafId); this.rafId = null; }
    if (this.recorder) { try { this.recorder.stop(); } catch (_) {} this.recorder = null; }
    if (this.outStream) { this.outStream.getTracks().forEach(t => t.stop()); this.outStream = null; }
    if (this.camStream) { this.camStream.getTracks().forEach(t => t.stop()); this.camStream = null; }
    if (this.micStream) { this.micStream.getTracks().forEach(t => t.stop()); this.micStream = null; }
    if (this.video) { try { this.video.srcObject = null; } catch (_) {} this.video = null; }
    this.canvas = null;
    this.ctx = null;
  }
}
