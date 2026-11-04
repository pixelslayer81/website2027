---
name: video-in-stitched-pages
description: Page <video> elements fail in the stitched site until load() is called after the src rebase; page 01 hero is a looping video since 2026-10-22; no ffmpeg on the machine
metadata:
  type: project
---

On 2026-10-22 the page 01 hero photo (`#hero-photo`) became a looping muted autoplay
`<video>` (`assets/slowmo_807a-4492905731f2_loop.mp4`). The user asked for "a gif". There
was no ffmpeg, and PIL can't decode MP4, so the clip stays an MP4 and loops on the page like a GIF.

**Why:** in the stitched site, `site.js` parses each page's markup before `rebaseTree()`
fixes relative `src` values. A `<video>` starts fetching the un-rebased URL, gets a 404
and ends up with `error.code 4`. Setting the corrected `src` afterwards does not recover it.
Standalone `file://`/direct page loads are fine.

**How to apply:**
- Any page sketch that uses `<video>` should, on mount, call
  `if (v.error || v.readyState === 0) v.load();` and then `v.play().catch(() => {})`,
  as `pages/01-intro/sketch.js` `mountGlitch` does.
- The 01 glitch sketch reads media size through `mediaW()/mediaH()` (videoWidth or
  naturalWidth), so the glitch effect works with either an img or a video, and `drawImage` samples the
  live frame.
- `hero-scribble.png` (the pen-drawing reveal) was made for the old `hero.png`, so it
  no longer lines up with the video. `hero.png` is still the banner pill image.
- For real GIF/frame conversion, install ffmpeg first (see [[no-toolchain-verify-in-browser-manually]]).

**2026-10-30: hero video replaced** by `pages/01-intro/assets/splash_loop_h264.mp4` (1440x1440,
10 s, from the user's `pages/00-splash/assets/hf_20261023_192524_...mp4`). The source was HEVC
(`hvc1`): headless Edge decodes no picture from it (0x0) and Firefox cannot play HEVC at all,
so always check the codec (scan the file for `avc1` / `hvc1`) before using a user's video.
No ffmpeg here, but Windows' own transcoder works from PowerShell 5.1 via WinRT:
`Windows.Media.Transcoding.MediaTranscoder` + `MediaEncodingProfile::CreateMp4(HD1080p)`
(set Video.Width/Height/Bitrate, Audio = $null), awaiting the WinRT ops with
`System.WindowsRuntimeSystemExtensions.AsTask`. It worked for HEVC -> H.264.
Framing: page 01 now has `--hero-focus-y` (0.3) for where the wide hero crops the taller
video; page 01's glitch mapping and the splash's no-scale picture offset both read it.
