# Dedicated Edge Media Proxy and Zero Playlist Caching

We route all live HLS video streams, segments, and subtitle files through a dedicated Cloudflare Worker (`workers/media-proxy`) in production rather than through the Vercel Node runtime. This keeps high-volume media byte transfer completely off Vercel Fast Origin Transfer to eliminate egress billing limits and edge execution timeouts, while keeping local Node proxy endpoints as development fallbacks.

Furthermore, HLS playlists (`.m3u8`) are proxied with strict `Cache-Control: no-store` without time-based caching. Upstream CDN segment URLs contain presigned tokens that expire within seconds, so any time-based playlist caching causes Hls.js to fetch expired segment signatures and buffer permanently. Concurrent identical playlist requests are handled via in-flight request coalescing instead of storage caching.
