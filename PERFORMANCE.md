# Performance Guide — Church Presenter

This document covers the instrumentation built into the app, how to interpret metrics, how to run repeatable benchmarks, and what to expect on different hardware.

---

## 1. Performance Overlay (F9)

Press **F9** in any window (main, presentation, stage, output) to toggle a floating debug HUD.

```
┌─────────────────────┐
│  PERF  F9          ✕│
├─────────────────────┤
│ RENDERER            │
│ FPS      59 fps     │  ← green ≥55, yellow ≥30, red <30
│ Heap     84.2 MB    │  ← green <200, yellow <400, red ≥400
│ Latency  18 ms      │  ← green <50, yellow <150, red ≥150
│ Uptime   4m 22s     │
├─────────────────────┤
│ MAIN PROCESS        │
│ RSS      210.4 MB   │
│ Heap     55.1 MB    │
│ CPU      3%         │
│ Slides   47         │  ← total slide changes this session
│ Startup  1823 ms    │
└─────────────────────┘
```

The overlay is **draggable** — click and drag the header to reposition it.

### Metric definitions

| Metric | What it measures | Good | Warn | Bad |
|--------|-----------------|------|------|-----|
| FPS | Chromium compositor frame rate in the renderer window | ≥55 | ≥30 | <30 |
| Heap (renderer) | JS heap used in the renderer process | <200 MB | <400 MB | ≥400 MB |
| Latency | Time from operator "go live" click to slide data arriving in the presentation window (IPC + serialisation) | <50 ms | <150 ms | ≥150 ms |
| Uptime | Time since this renderer window started | — | — | — |
| RSS (main) | Resident Set Size of the main process — total physical RAM used | <300 MB | <600 MB | ≥600 MB |
| Heap (main) | JS heap used by the main process | <200 MB | <400 MB | ≥400 MB |
| CPU (main) | Main process CPU % averaged over the last 5 s | — | >20% | >50% |
| Slides | Slide-change events dispatched since launch | — | — | — |
| Startup | Time from process launch to main window `did-finish-load` | <3000 ms | <6000 ms | ≥6000 ms |

---

## 2. Performance Log

Metrics are written to an NDJSON log file automatically while the app is running.

**Location:** `<userData>/logs/perf.ndjson`

- macOS: `~/Library/Application Support/church-presenter/logs/perf.ndjson`
- Windows: `%APPDATA%\church-presenter\logs\perf.ndjson`
- Linux: `~/.config/church-presenter/logs/perf.ndjson`

### Log format

Each line is a JSON object:

```json
{"ts":1714900000000,"type":"session-start","platform":"darwin","arch":"arm64","nodeVersion":"v18.18.2","cpuModel":"Apple M2","totalRamMb":16384,"appVersion":"1.0.0"}
{"ts":1714900002341,"type":"startup","startupMs":2341}
{"ts":1714900005000,"type":"sample","heapUsedMb":88.3,"heapTotalMb":128.0,"rssMb":214.5,"mainCpuPercent":2,"slideChanges":0,"lastSlideTs":0,"sessionUptimeSec":5,"startupMs":2341}
{"ts":1714900010000,"type":"sample","heapUsedMb":91.1,...,"slideChanges":3,...}
```

### Parsing the log

```bash
# Show startup times across sessions
grep '"type":"startup"' perf.ndjson | jq '.startupMs'

# Memory growth over a session (MB every 5 s)
grep '"type":"sample"' perf.ndjson | jq '{t: .sessionUptimeSec, heap: .heapUsedMb, rss: .rssMb}'

# Average CPU over the session
grep '"type":"sample"' perf.ndjson | jq '[.mainCpuPercent] | add/length'

# Slide change rate
grep '"type":"sample"' perf.ndjson | jq 'select(.slideChanges > 0) | {t: .sessionUptimeSec, changes: .slideChanges}'
```

Logs rotate automatically at 5 MB. Previous files are renamed with a timestamp suffix.

---

## 3. Repeatable Benchmark (Section 2 of Checklist)

### Generate a large test presentation

```bash
node scripts/generate-test-presentation.js
# Produces 15 items × 8 slides = 120 slides by default

# Custom size:
node scripts/generate-test-presentation.js --slides 10 --items 20
# → 200 slides
```

The script writes directly to `schedules.json` in the app's userData folder. Restart the app to load it.

### Benchmark run procedure

1. Launch the app (`npm run electron:dev` or the production build).
2. Open the Presentation window on your second display.
3. Press **F9** in the main window — note the **Startup** time.
4. Press **F9** in the Presentation window — note initial **Heap** and **FPS**.
5. Click the first slide to go live.
6. Using arrow keys, advance through all slides at approximately **1 slide per second**.
7. After the last slide, stop and record from the overlay:
   - Minimum FPS seen
   - Maximum latency seen
   - Heap MB at end vs start
   - Main-process RSS at end

8. Wait 5 minutes without interacting (long-session test).
9. Record heap and RSS again — growth > 50 MB in 5 min suggests a leak.

### Standard metrics table (fill in per run)

| Run | Date | Hardware | Slides | Min FPS | Max Latency | End Heap MB | End RSS MB | Startup ms |
|-----|------|----------|--------|---------|-------------|-------------|------------|------------|
| 1   |      |          |        |         |             |             |            |            |
| 2   |      |          |        |         |             |             |            |            |

### Baseline targets

| Metric | Minimum acceptable | Target |
|--------|-------------------|--------|
| FPS (presentation window) | 55 fps | 60 fps |
| Slide IPC latency | <100 ms | <30 ms |
| Heap growth over 2 h session | <200 MB | <50 MB |
| Startup time (production build) | <4 000 ms | <2 000 ms |
| Main process RSS at rest | <400 MB | <250 MB |

---

## 4. Architecture Notes (Checklist Sections 3–5)

### Rendering pipeline
- **Technology:** HTML/CSS via React — not Canvas/WebGL.
- **Why:** Easier styling, accessible, supports system fonts and CSS transitions without custom shader code.
- **Trade-off:** Heavy backgrounds (1080p video in 3+ windows) will stress the GPU compositor more than a WebGL path would.
- **SlideRenderer** is wrapped in `React.memo` — it only re-renders when its props change (slide content, background, fonts).

### IPC architecture
```
Operator (main window)
  │
  │  ipcRenderer.send('send-slide-program', {slide, _sentAt})
  ▼
Electron main process (main.js)
  │  stamps _sentAt = Date.now() for latency measurement
  │  webContents.send('receive-slide', stampedSlide) to each output window
  ▼
Presentation / Output windows
  │  onReceiveSlide → perfMonitor.recordSlideArrival(_sentAt)
  │                 → setState → React re-render
  ▼
SlideRenderer (memo'd) → paints new slide
```

### sendOutputState debounce
`sendOutputState` aggregates slide assignments for all open output windows and sends a single IPC message. It used to fire on every individual state change. It is now **debounced at 50 ms** so rapid state transitions (e.g. opening the app with a saved schedule) coalesce into a single IPC round-trip.

### IPC listener safety
All `onXxx` listener registrations in the preload return a typed `unsubscribe` function. Components use it in their effect cleanup:

```js
useEffect(() => {
  const off = window.electronAPI.onReceiveSlide(handler);
  return off; // removes only this component's listener, not all listeners on the channel
}, []);
```

This replaces the previous `removeAllListeners` pattern, which was unsafe in any window that had multiple components subscribing to the same channel.

---

## 5. Memory Management (Checklist Section 6)

### Common leak patterns to watch for

| Pattern | Where | Mitigation |
|---------|-------|------------|
| IPC listeners not removed | Output windows | Fixed: all `onXxx` return `unsubscribe()` |
| `setInterval` in hooks | StageView (clock), StreamPanel (audio meter) | Cleared in useEffect cleanup ✓ |
| MediaStream tracks not stopped | StreamView | `getTracks().forEach(t => t.stop())` in cleanup ✓ |
| AudioContext not closed | StreamPanel, SettingsPanel | `audioCtx.close()` in cleanup ✓ |
| BroadcastChannel not closed | AppContext, OutputView, StageView | `channel.close()` in cleanup ✓ |
| `requestAnimationFrame` leak | perfMonitor | `cancelAnimationFrame` in `stop()` ✓ |

### Long-session monitoring

For a 2–4 hour service, watch the **Heap** metric in the overlay. Expected pattern:
- Heap grows ~5–15 MB in the first 5 minutes (React tree stabilises, V8 JIT warms up).
- After warmup, heap should remain flat or grow < 20 MB/hour.
- If heap grows > 50 MB/hour, open Chrome DevTools (Ctrl+Shift+I in the main window) and take a heap snapshot to find the retained objects.

---

## 6. Startup Optimisation (Checklist Section 7)

### Current startup sequence
1. Electron main process starts → `perf.start()` begins timing
2. `ensureDataDir()` — reads/creates JSON files (synchronous, ~1–5 ms on SSD)
3. `createMainWindow()` → loads React app
4. React renders → parallel `Promise.all` loads songs, schedules, settings
5. `did-finish-load` fires → `perf.recordStartup()` logs the total

### To improve startup time
- **Production build is significantly faster** than dev (`npm run electron:build`). Dev mode includes CRA dev server, source maps, and React DevTools.
- The largest startup cost in production is **initial file reads**. If `songs.json` grows large (>1000 songs), consider paginating the load.
- The Bible data is NOT loaded on startup (it uses lazy imports). This is correct.

---

## 7. Recommended Hardware

### Minimum (will work, some limits)
- CPU: Intel Core i5 (8th gen) / AMD Ryzen 5 3000 / Apple M1
- RAM: 8 GB
- GPU: Any with hardware video decode (Intel UHD 620+, AMD Vega, Apple M1 GPU)
- Display: 1 × 1920×1080 (operator) + 1 × 1920×1080 (projector)

### Recommended (comfortable for live services)
- CPU: Intel Core i7 (11th gen+) / AMD Ryzen 7 5000 / Apple M2
- RAM: 16 GB
- GPU: Dedicated GPU (NVIDIA GTX 1650+ / AMD RX 570+) if running 3+ output windows with video backgrounds
- Storage: SSD (media files load significantly faster)
- Display: 1 × 2K/4K (operator) + 2× 1080p (audience + stage)

### Notes on video backgrounds
- A single 1080p video background on one output window uses the GPU decoder — minimal CPU impact.
- Running the same video on 3+ windows (presentation + stage + confidence) plays 3 independent `<video>` elements. On integrated graphics this can push GPU decode utilisation to 80%+. Consider encoding backgrounds at 720p if you're on integrated graphics.

---

## 8. Safe Mode for Low-End Systems

Add `?safeMode=1` to the URL (or set `localStorage.setItem('cp_safe_mode', '1')`) to disable:
- CSS `backdrop-filter` effects
- Transition animations on slide changes
- Video backgrounds (replaced by the first frame as a static image)

*(Safe mode UI implementation is a suggested future enhancement.)*

---

## 9. Open Source Readiness (Checklist Section 11)

### Developer tools included
- **Performance overlay** — press F9 in any window
- **Performance log** — NDJSON at `<userData>/logs/perf.ndjson`
- **Benchmark generator** — `node scripts/generate-test-presentation.js`

### Suggested `package.json` script additions
```json
{
  "scripts": {
    "benchmark:generate": "node scripts/generate-test-presentation.js",
    "benchmark:large": "node scripts/generate-test-presentation.js --slides 12 --items 20",
    "perf:log": "tail -f \"$(node -e \"const {app}=require('electron');console.log(require('path').join(app.getPath('userData'),'logs','perf.ndjson'))\")\""
  }
}
```

### Known limitations
1. **Slide change latency** includes the full IPC serialisation round-trip (main process → renderer). On Windows with many output windows open, this may be 30–60 ms vs ~10 ms on macOS.
2. **YouTube backgrounds** require an internet connection and are subject to YouTube's embed rate limits. Do not rely on YouTube for critical slides.
3. **RTMP streaming** requires FFmpeg to be installed separately. The app ships an auto-detect helper but does not bundle FFmpeg due to licensing.
4. **Web Speech Recognition** (sermon assistant) requires Chrome/Electron's proprietary speech API. It is not available in all regions or network environments.
