---
name: splash-page-00
description: Page 00 splash plays over page 01 (CT index) after a CT Index click and lands on its layout; how it is wired, its reference video, and how to verify animations headlessly
metadata:
  type: project
---

Built 2026-10-30 from the user's reference `pages/00-splash/assets/splash_anim_ref_v001.mp4`
(4.2 s, 1440x900): a big red "PXLSLYR!" on cream with the photo below; the photo rises and
covers the type, landing as the hero band under the header. The user's brief added: the
page 01 girl video shows from frame one, DESIGN / & TECHNOLOGY mask on from inside the photo
while PXLSLYR masks off, and the project rows cascade in top-down with overlap using the CT
index's hover banner (the red `.marquee` wipe).

**Design decision:** the splash animates page 01's real elements (not a copy), so its last
frame IS the CT index: no handoff, no video jump. Wiring is in README "Stitching rules"
(site.js hook: splash style.css into page 01's shadow root, `mount(shadow)` before first
paint, `ready()` after page 01's sketch mounts, header calls `start()`).
`pages/00-splash/index.html` just redirects to the site with `?splash`.

**Behaviour the user settled on (2026-10-30, after a misread):** the splash is the site's
LANDING PAGE, not an intro that auto-plays. The site opens on the start frame (PXLSLYR! + girl)
and waits; the CT Index button plays the transition in place (no reload); Pixelslayer.tv takes
you back to the splash (reload to the start frame). The transition ONLY runs from the splash:
CT Index from anywhere else (further down the site: reload with a one-shot sessionStorage
"skip" flag; the About page: link to `index.html#intro`) opens the CT index already formed,
no animation. An earlier version that only played after a CT Index reload (plain load = CT
index) was rejected: "that did not work".
Start frame: photo inset by a border = the window-edge-to-P ink gap (left/right/bottom); on
CT Index the borders (a clip-path) animate out with the rise and the picture parallaxes inside.
The user said "do not scale the image": the box and the picture keep the CT index size/scale
throughout; only the clip and positions animate.
Tunables are the `SPLASH` object in its sketch.js (rise 1200 ms, row stagger 90 ms; transition
about 2.5 s).

**Gotchas:**
- The hero video's lighting pulses dark/bright on its own; dark frames are not a bug.
- To see an animation over time, a one-shot `tools/headless-shot.js` per delay is useless
  (load timing varies). A burst variant capturing every ~100 ms in one session, then a
  file:// contact-sheet page, worked. Seeking an MP4 in headless Edge returned the same frame
  for every seek; sample during playback with `requestVideoFrameCallback` instead.
- PowerShell 5.1 strips inner double quotes from native-exe args: pass JS to headless-shot
  from Bash, not PowerShell.

Related: [[video-in-stitched-pages]], [[site-vision-and-page-workflow]]

**Start-frame redesign (2026-10-30, user mockup):** PXLSLYR! was replaced by a masthead built
by sketch.js from the `SPLASH` text settings: a light (400) PIXELSLAYER wordmark (Inter,
-0.04em, 14.8vw, ending ~90% across like the mockup), a rule, then an info row (red mono tags
left, one-line description a third in, credentials + [CREATIVE TECH ->] (plays the
transition) and [MOTION DESIGN ->] (not wired) right). The photo starts just under the
masthead (drop measured from it), borders = the 24px page margin. Animation kept identical,
as asked. The site's black header stays (the mockup showed a light one) because the landing
must match the CT index. "Est. 2005" and "Palm Springs" came from the user's mockup.
Previous PXLSLYR! version: `pages/00-splash/versions/pxlslyr-2026-10-30/`.
Glitch (2026-10-30): the CT index glitch starts the moment Creative Tech is pressed. Page 01's
sketch gained `IntroSketch.burst(ms)` (a big pocket near the middle + 3 small ones); the
splash calls it at the start of the transition (`SPLASH.glitchMs`), and its CSS shows the
glitch layer from `is-wide` on with the picture's parallax offset so it stays registered.
