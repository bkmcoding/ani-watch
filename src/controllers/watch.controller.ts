import { Context } from 'hono';
import { validationError } from '../utils/errors';
import { proxiedHlsUrl, requestOrigin } from '../utils/streamUrls';

const ALLOWED_HOST_SUFFIXES = [
  'megaplay.buzz',
  'shiora.top',
  'tiktokcdn.com',
  'tiktokcdn-us.com',
  'hiddenvertex.top',
];

function hostAllowed(hostname: string): boolean {
  const host = hostname.toLowerCase();
  return ALLOWED_HOST_SUFFIXES.some((s) => host === s || host.endsWith('.' + s));
}

const watchController = async (c: Context) => {
  const target = c.req.query('url');
  if (!target) throw new validationError('url is required');

  let parsed: URL;
  try {
    parsed = new URL(target);
  } catch {
    throw new validationError('url must be absolute');
  }

  if (!/^https?:$/i.test(parsed.protocol) || !hostAllowed(parsed.hostname)) {
    throw new validationError('url host not allowed');
  }

  const origin = requestOrigin(c);
  const streamSrc = proxiedHlsUrl(origin, parsed.href);

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Watch</title>
  <style>
    html, body { margin: 0; height: 100%; background: #0b0b0b; color: #eee; font-family: system-ui, sans-serif; }
    .wrap { min-height: 100%; display: grid; place-items: center; padding: 12px; box-sizing: border-box; }
    video { width: min(100%, 1100px); max-height: 100vh; background: #000; border-radius: 8px; }
    .err { color: #f88; margin-top: 12px; max-width: 40rem; text-align: center; }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js"></script>
</head>
<body>
  <div class="wrap">
    <div>
      <video id="v" controls autoplay playsinline></video>
      <p class="err" id="err" hidden></p>
    </div>
  </div>
  <script>
    (function () {
      var src = ${JSON.stringify(streamSrc)};
      var video = document.getElementById('v');
      var err = document.getElementById('err');
      function fail(msg) { err.hidden = false; err.textContent = msg; }
      if (window.Hls && Hls.isSupported()) {
        var hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hls.loadSource(src);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, function (_e, data) {
          if (data && data.fatal) fail('Playback failed (' + data.type + '). Try refreshing.');
        });
      } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = src;
      } else {
        fail('This browser cannot play HLS. Open the link in Chrome/Firefox/Safari.');
      }
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
