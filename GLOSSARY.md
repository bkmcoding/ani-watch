# Anime Playback & Media Streaming

Defines the core vocabulary for resolving, proxying, and playing anime video streams and subtitles.

## Language

**Provider**:
A third-party video host or embed source (e.g., MegaPlay, Zoko) that serves raw media playlists and video chunks.
_Avoid_: Host, upstream, scraper source

**Server**:
A catalog-level playback endpoint option for an episode (e.g., HD-1, HD-2).
_Avoid_: Machine, host, node

**Stream**:
The HLS playlist (`.m3u8`) and associated media segments delivering the audio/video payload for an episode.
_Avoid_: Video file, download, link

**Media Proxy**:
An intermediary edge service (Cloudflare Worker or Node handler) that relays requests for playlists, TS segments, and subtitles with required headers (Referer, Origin) to bypass CORS and hotlink protections.
_Avoid_: Scraper, VPN, tunnel

**Subtitle Track**:
Timed text cues formatted in WebVTT or ASS, delivered alongside or embedded within the stream to provide translated dialogue.
_Avoid_: Closed caption, CC, sub file

**Episode Metadata**:
Header information identifying an episode (such as anime title, episode number, and episode name) displayed in page titles and player chrome.
_Avoid_: Subtitle, sub-header, episode subtitle
