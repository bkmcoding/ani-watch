import { Context } from 'hono';
import { validationError } from '../utils/errors';
import { isAllowedStreamHost, proxiedHlsUrl, requestOrigin } from '../utils/streamUrls';

function parseAllowedUrl(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    const u = new URL(raw);
    if (!/^https?:$/i.test(u.protocol) || !isAllowedStreamHost(u.hostname)) return null;
    return u.href;
  } catch {
    return null;
  }
}

const watchController = async (c: Context) => {
  const subCdn = parseAllowedUrl(c.req.query('sub') || undefined);
  const dubCdn = parseAllowedUrl(c.req.query('dub') || undefined);
  const legacy = parseAllowedUrl(c.req.query('url') || undefined);
  const preferredRaw = (c.req.query('t') || 'sub').toLowerCase();

  const sub = subCdn || (preferredRaw !== 'dub' ? legacy : null) || legacy;
  const dub = dubCdn || (preferredRaw === 'dub' && !dubCdn ? legacy : null);

  if (!sub && !dub) {
    throw new validationError('sub, dub, or url query param required (allowed CDN hosts only)');
  }

  const initial = preferredRaw === 'dub' && dub ? 'dub' : sub ? 'sub' : 'dub';
  const origin = requestOrigin(c);
  const streams = {
    sub: sub ? proxiedHlsUrl(origin, sub) : null,
    dub: dub ? proxiedHlsUrl(origin, dub) : null,
  };

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="color-scheme" content="dark" />
  <title>Watch</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Syne:wght@600;700&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600&display=swap" rel="stylesheet" />
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js"></script>
  <style>
    :root {
      --bg0: #0a0c10;
      --ink: #e8edf5;
      --muted: #8b95a8;
      --accent: #3dd6c6;
      --accent-dim: rgba(61, 214, 198, 0.18);
      --danger: #ff7b72;
      --line: rgba(255, 255, 255, 0.1);
      --radius: 18px;
      --ease: cubic-bezier(0.22, 1, 0.36, 1);
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; min-height: 100%; background: var(--bg0); color: var(--ink); font-family: "DM Sans", system-ui, sans-serif; }
    body {
      min-height: 100dvh;
      background:
        radial-gradient(1200px 600px at 50% -10%, rgba(61, 214, 198, 0.12), transparent 55%),
        radial-gradient(900px 500px at 100% 100%, rgba(80, 110, 180, 0.1), transparent 50%),
        linear-gradient(180deg, #0d1118 0%, var(--bg0) 45%, #080a0e 100%);
    }
    .page {
      min-height: 100dvh;
      display: grid;
      grid-template-rows: auto 1fr auto;
      padding: clamp(16px, 3vw, 28px);
      gap: 18px;
    }
    header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
      max-width: 1120px;
      width: 100%;
      margin: 0 auto;
    }
    .brand {
      font-family: Syne, sans-serif;
      font-weight: 700;
      font-size: clamp(1.35rem, 2.4vw, 1.75rem);
      letter-spacing: -0.03em;
      margin: 0;
    }
    .brand span { color: var(--accent); }
    .header-right { display: flex; align-items: center; gap: 14px; flex-wrap: wrap; }
    .hint { color: var(--muted); font-size: 0.85rem; margin: 0; }
    .audio-toggle {
      display: inline-flex;
      padding: 4px;
      border-radius: 999px;
      background: rgba(255,255,255,0.06);
      border: 1px solid var(--line);
      gap: 2px;
    }
    .audio-toggle[hidden] { display: none !important; }
    .audio-btn {
      appearance: none;
      border: 0;
      background: transparent;
      color: var(--muted);
      font: inherit;
      font-size: 0.82rem;
      font-weight: 600;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      padding: 8px 14px;
      border-radius: 999px;
      cursor: pointer;
      transition: background 0.2s ease, color 0.2s ease;
    }
    .audio-btn:hover { color: var(--ink); }
    .audio-btn.is-active {
      background: var(--accent-dim);
      color: var(--accent);
    }
    .stage-wrap { display: grid; place-items: center; width: 100%; }
    .stage {
      position: relative;
      width: min(100%, 1120px);
      aspect-ratio: 16 / 9;
      background: #000;
      border-radius: var(--radius);
      overflow: hidden;
      box-shadow: 0 0 0 1px var(--line), 0 30px 80px rgba(0, 0, 0, 0.55);
      isolation: isolate;
    }
    video {
      width: 100%;
      height: 100%;
      display: block;
      background: #000;
      object-fit: contain;
      cursor: pointer;
    }
    .overlay {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
      pointer-events: none;
      background: radial-gradient(circle at center, transparent 30%, rgba(0,0,0,0.25) 100%);
      opacity: 0;
      transition: opacity 0.35s var(--ease);
    }
    .stage.is-paused .overlay,
    .stage.is-loading .overlay { opacity: 1; }
    .big-btn {
      width: 76px; height: 76px; border-radius: 999px;
      border: 1px solid rgba(255,255,255,0.18);
      background: rgba(12, 16, 24, 0.55);
      backdrop-filter: blur(10px);
      color: var(--ink);
      display: grid; place-items: center;
      pointer-events: auto; cursor: pointer;
      transition: transform 0.25s var(--ease), background 0.25s ease;
    }
    .big-btn:hover { transform: scale(1.05); background: rgba(61, 214, 198, 0.2); }
    .big-btn svg { width: 28px; height: 28px; }
    .spinner {
      width: 42px; height: 42px; border-radius: 50%;
      border: 3px solid rgba(255,255,255,0.15);
      border-top-color: var(--accent);
      animation: spin 0.8s linear infinite;
      display: none;
    }
    .stage.is-loading .big-btn { display: none; }
    .stage.is-loading .spinner { display: block; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .controls {
      position: absolute; left: 0; right: 0; bottom: 0;
      padding: 48px 14px 12px;
      background: linear-gradient(transparent, rgba(0,0,0,0.85) 55%);
      opacity: 0; transform: translateY(6px);
      transition: opacity 0.28s var(--ease), transform 0.28s var(--ease);
    }
    .stage:hover .controls,
    .stage.is-paused .controls,
    .stage.show-controls .controls,
    .stage:focus-within .controls {
      opacity: 1; transform: translateY(0);
    }
    .seek {
      width: 100%; height: 6px; appearance: none;
      background: transparent; cursor: pointer; margin: 0 0 10px;
    }
    .seek::-webkit-slider-runnable-track {
      height: 6px; border-radius: 999px;
      background: linear-gradient(90deg, var(--accent) var(--progress, 0%), rgba(255,255,255,0.18) var(--progress, 0%));
    }
    .seek::-webkit-slider-thumb {
      appearance: none; width: 14px; height: 14px; margin-top: -4px;
      border-radius: 50%; background: var(--ink); box-shadow: 0 0 0 4px var(--accent-dim);
    }
    .seek::-moz-range-track { height: 6px; border-radius: 999px; background: rgba(255,255,255,0.18); }
    .seek::-moz-range-progress { height: 6px; border-radius: 999px; background: var(--accent); }
    .seek::-moz-range-thumb { width: 14px; height: 14px; border: 0; border-radius: 50%; background: var(--ink); }
    .row { display: flex; align-items: center; gap: 6px; }
    .row .spacer { flex: 1; }
    .ctrl {
      appearance: none; border: 0; background: transparent; color: var(--ink);
      width: 40px; height: 40px; border-radius: 10px;
      display: grid; place-items: center; cursor: pointer;
      transition: background 0.2s ease;
    }
    .ctrl:hover { background: rgba(255,255,255,0.08); }
    .ctrl svg { width: 20px; height: 20px; }
    .time {
      font-variant-numeric: tabular-nums; font-size: 0.82rem;
      color: var(--muted); padding: 0 8px; min-width: 9.5rem;
    }
    .vol { width: 84px; height: 5px; appearance: none; background: transparent; cursor: pointer; }
    .vol::-webkit-slider-runnable-track {
      height: 5px; border-radius: 999px;
      background: linear-gradient(90deg, var(--accent) var(--vol, 100%), rgba(255,255,255,0.18) var(--vol, 100%));
    }
    .vol::-webkit-slider-thumb {
      appearance: none; width: 12px; height: 12px; margin-top: -3.5px;
      border-radius: 50%; background: var(--ink);
    }
    .vol::-moz-range-track { height: 5px; border-radius: 999px; background: rgba(255,255,255,0.18); }
    .vol::-moz-range-progress { height: 5px; border-radius: 999px; background: var(--accent); }
    .vol::-moz-range-thumb { width: 12px; height: 12px; border: 0; border-radius: 50%; background: var(--ink); }
    .err {
      max-width: 1120px; width: 100%; margin: 0 auto; color: var(--danger);
      background: rgba(255, 123, 114, 0.08); border: 1px solid rgba(255, 123, 114, 0.25);
      border-radius: 12px; padding: 12px 14px; font-size: 0.92rem;
    }
    footer {
      max-width: 1120px; width: 100%; margin: 0 auto;
      color: var(--muted); font-size: 0.8rem;
    }
    @media (max-width: 640px) {
      .vol, .hint { display: none; }
      .time { min-width: auto; }
      .stage { aspect-ratio: 16 / 10; border-radius: 14px; }
      .big-btn { width: 64px; height: 64px; }
    }
  </style>
</head>
<body>
  <div class="page">
    <header>
      <h1 class="brand">ani<span>.</span>watch</h1>
      <div class="header-right">
        <div class="audio-toggle" id="audioToggle" ${sub && dub ? '' : 'hidden'}>
          <button type="button" class="audio-btn ${initial === 'sub' ? 'is-active' : ''}" data-track="sub" ${sub ? '' : 'hidden'}>Sub</button>
          <button type="button" class="audio-btn ${initial === 'dub' ? 'is-active' : ''}" data-track="dub" ${dub ? '' : 'hidden'}>Dub</button>
        </div>
        <p class="hint">Space play/pause · F fullscreen · S/D audio · ← → seek</p>
      </div>
    </header>

    <div class="stage-wrap">
      <div class="stage is-loading is-paused" id="stage">
        <video id="v" playsinline preload="auto"></video>
        <div class="overlay">
          <button type="button" class="big-btn" id="bigPlay" aria-label="Play">
            <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5v14l11-7z"/></svg>
          </button>
          <div class="spinner" aria-hidden="true"></div>
        </div>
        <div class="controls" id="controls">
          <input class="seek" id="seek" type="range" min="0" max="1000" value="0" step="1" aria-label="Seek" />
          <div class="row">
            <button type="button" class="ctrl" id="play" aria-label="Play">
              <svg id="playIcon" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
            </button>
            <button type="button" class="ctrl" id="mute" aria-label="Mute">
              <svg id="muteIcon" viewBox="0 0 24 24" fill="currentColor"><path d="M5 9v6h4l5 5V4L9 9H5zm11.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/></svg>
            </button>
            <input class="vol" id="vol" type="range" min="0" max="1" step="0.01" value="1" aria-label="Volume" />
            <span class="time" id="time">0:00 / 0:00</span>
            <span class="spacer"></span>
            <button type="button" class="ctrl" id="fs" aria-label="Fullscreen">
              <svg viewBox="0 0 24 24" fill="currentColor"><path d="M7 14H5v5h5v-2H7v-3zm0-4h2V7h3V5H5v5h2zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>
            </button>
          </div>
        </div>
      </div>
    </div>

    <p class="err" id="err" hidden></p>
    <footer>Use Sub / Dub above when both exist · refresh if the video stalls</footer>
  </div>

  <script>
    (function () {
      var streams = ${JSON.stringify(streams)};
      var track = ${JSON.stringify(initial)};
      var video = document.getElementById('v');
      var stage = document.getElementById('stage');
      var err = document.getElementById('err');
      var seek = document.getElementById('seek');
      var vol = document.getElementById('vol');
      var timeEl = document.getElementById('time');
      var playBtn = document.getElementById('play');
      var bigPlay = document.getElementById('bigPlay');
      var muteBtn = document.getElementById('mute');
      var fsBtn = document.getElementById('fs');
      var playIcon = document.getElementById('playIcon');
      var muteIcon = document.getElementById('muteIcon');
      var hideTimer = null;
      var hls = null;
      var resumeAt = 0;

      var ICONS = {
        play: '<path d="M8 5v14l11-7z"/>',
        pause: '<path d="M6 5h4v14H6zm8 0h4v14h-4z"/>',
        vol: '<path d="M5 9v6h4l5 5V4L9 9H5zm11.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4z"/>',
        muted: '<path d="M5 9v6h4l5 5V4L9 9H5zm12.5 1.5 1.8-1.8 1.4 1.4-1.8 1.8 1.8 1.8-1.4 1.4-1.8-1.8-1.8 1.8-1.4-1.4 1.8-1.8-1.8-1.8 1.4-1.4 1.8 1.8z"/>'
      };

      function fail(msg) {
        err.hidden = false;
        err.textContent = msg;
        stage.classList.remove('is-loading');
      }

      function clearErr() { err.hidden = true; err.textContent = ''; }

      function fmt(sec) {
        if (!isFinite(sec) || sec < 0) return '0:00';
        var s = Math.floor(sec % 60);
        var m = Math.floor((sec / 60) % 60);
        var h = Math.floor(sec / 3600);
        var pad = function (n) { return n < 10 ? '0' + n : '' + n; };
        return h > 0 ? h + ':' + pad(m) + ':' + pad(s) : m + ':' + pad(s);
      }

      function setPlaying(playing) {
        stage.classList.toggle('is-paused', !playing);
        playIcon.innerHTML = playing ? ICONS.pause : ICONS.play;
        playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        bigPlay.setAttribute('aria-label', playing ? 'Pause' : 'Play');
        bigPlay.querySelector('svg').innerHTML = playing ? ICONS.pause : ICONS.play;
      }

      function setMuted(muted) {
        muteIcon.innerHTML = muted || video.volume === 0 ? ICONS.muted : ICONS.vol;
        muteBtn.setAttribute('aria-label', muted ? 'Unmute' : 'Mute');
      }

      function updateProgress() {
        var d = video.duration || 0;
        var t = video.currentTime || 0;
        if (!seek.matches(':active')) seek.value = String(d ? (t / d) * 1000 : 0);
        seek.style.setProperty('--progress', (d ? (t / d) * 100 : 0) + '%');
        timeEl.textContent = fmt(t) + ' / ' + fmt(d);
      }

      function pokeControls() {
        stage.classList.add('show-controls');
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function () {
          if (!video.paused) stage.classList.remove('show-controls');
        }, 2500);
      }

      function togglePlay() {
        if (video.paused) video.play().catch(function () {});
        else video.pause();
      }

      function toggleMute() {
        video.muted = !video.muted;
        setMuted(video.muted);
      }

      function toggleFs() {
        if (!document.fullscreenElement) stage.requestFullscreen?.() || stage.webkitRequestFullscreen?.();
        else document.exitFullscreen?.();
      }

      function destroyHls() {
        if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
      }

      function loadTrack(next, keepTime) {
        var src = streams[next];
        if (!src) return;
        clearErr();
        track = next;
        resumeAt = keepTime ? (video.currentTime || 0) : 0;
        document.querySelectorAll('.audio-btn').forEach(function (btn) {
          btn.classList.toggle('is-active', btn.getAttribute('data-track') === next);
        });
        try {
          var u = new URL(location.href);
          u.searchParams.set('t', next);
          history.replaceState(null, '', u);
        } catch (e) {}

        stage.classList.add('is-loading');
        destroyHls();
        video.removeAttribute('src');
        video.load();

        function afterReady() {
          stage.classList.remove('is-loading');
          if (resumeAt > 0) {
            try { video.currentTime = resumeAt; } catch (e) {}
          }
          video.play().catch(function () { setPlaying(false); });
        }

        if (window.Hls && Hls.isSupported()) {
          hls = new Hls({ enableWorker: true, lowLatencyMode: false });
          hls.loadSource(src);
          hls.attachMedia(video);
          hls.on(Hls.Events.MANIFEST_PARSED, afterReady);
          hls.on(Hls.Events.ERROR, function (_e, data) {
            if (data && data.fatal) fail('Playback failed (' + data.type + '). Try the other audio track or refresh.');
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = src;
          video.addEventListener('loadedmetadata', afterReady, { once: true });
        } else {
          fail('This browser cannot play HLS. Try Chrome, Firefox, or Safari.');
        }
      }

      playBtn.addEventListener('click', togglePlay);
      bigPlay.addEventListener('click', togglePlay);
      video.addEventListener('click', togglePlay);
      muteBtn.addEventListener('click', toggleMute);
      fsBtn.addEventListener('click', toggleFs);

      seek.addEventListener('input', function () {
        if (!video.duration) return;
        video.currentTime = (Number(seek.value) / 1000) * video.duration;
        updateProgress();
      });

      vol.addEventListener('input', function () {
        video.volume = Number(vol.value);
        video.muted = video.volume === 0;
        vol.style.setProperty('--vol', video.volume * 100 + '%');
        setMuted(video.muted);
      });

      video.addEventListener('timeupdate', updateProgress);
      video.addEventListener('loadedmetadata', updateProgress);
      video.addEventListener('play', function () { setPlaying(true); stage.classList.remove('is-loading'); });
      video.addEventListener('pause', function () { setPlaying(false); });
      video.addEventListener('waiting', function () { stage.classList.add('is-loading'); });
      video.addEventListener('playing', function () { stage.classList.remove('is-loading'); });
      video.addEventListener('canplay', function () { stage.classList.remove('is-loading'); });

      stage.addEventListener('mousemove', pokeControls);
      stage.addEventListener('touchstart', pokeControls, { passive: true });

      document.querySelectorAll('.audio-btn').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var next = btn.getAttribute('data-track');
          if (next && next !== track && streams[next]) loadTrack(next, true);
        });
      });

      document.addEventListener('keydown', function (e) {
        if (e.target && /input|textarea/i.test(e.target.tagName)) return;
        if (e.code === 'Space') { e.preventDefault(); togglePlay(); }
        else if (e.key === 'f' || e.key === 'F') toggleFs();
        else if (e.key === 'm' || e.key === 'M') toggleMute();
        else if (e.key === 's' || e.key === 'S') { if (streams.sub) loadTrack('sub', true); }
        else if (e.key === 'd' || e.key === 'D') { if (streams.dub) loadTrack('dub', true); }
        else if (e.key === 'ArrowRight') video.currentTime = Math.min((video.duration || 0), video.currentTime + 10);
        else if (e.key === 'ArrowLeft') video.currentTime = Math.max(0, video.currentTime - 10);
        pokeControls();
      });

      setPlaying(false);
      setMuted(false);
      vol.style.setProperty('--vol', '100%');
      loadTrack(track, false);
    })();
  </script>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
    },
  });
};

export default watchController;
