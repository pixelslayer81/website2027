// Page 08: Excel cell art. The experiential page from Claude_immersive/site
// (index.html, 2026-03-16), ported whole: the start box, the click-to-expand,
// the scroll-driven phases, the X that slides the spreadsheet up, the cell art
// and saved thumbnails all run as in the original. Changes for the stitched
// site: it reads its own section (not the window) for its size, finds its
// elements in its own root, never captures the wheel (after the click the
// page pins while a runway of page scroll drives the phases, then the site
// scrolls on: RUNWAY), and its start guides sit on page 07's grid (GUIDES)
// so the guides run straight on from the page above.
// Exposes window.ExcelArtSketch = { mount(container), unmount() } so the
// stitched site can host it as one section. Classic script (not a module) so
// the page works when opened straight from file://.

(function () {
"use strict";

// Asset URLs resolve against this script's own folder (standalone and stitched).
const BASE = document.currentScript && document.currentScript.src ? new URL("./", document.currentScript.src).href : "";
const asset = (p) => BASE + p;

// Page 07's columns (its units: the page is 1440 wide) the start guides sit on:
// left/right guides on 72 and 1368 (= 1440 - 72), the column guide on 432,
// the start box between 432 and 454.82, the CLICK strip on to 576.
// 2026-11-05: the start box 40% larger (16.3 -> 22.82 square), its guides
// with it (page 07's 448.3 column moved to 454.82 to match), and the CLICK
// strip moved up into the box's own row, between the two guides at its edges.
// The white box (the tweet) runs from page 07's 504 column, clear of the
// heart artwork, to its 1296 column.
// The photo's right edge (expanded) sits on page 07's 792 column.
const GUIDES = { left: 72, col: 432, box: 454.82, click: 576, tweet: 504, white: 1296, photo: 792 };
// The original's photo keeps this share of itself after its exit collapse
// (its globeLeftX-colX1 span is 695.6px at every width: (695.6 - 170) / (1.1 * 695.6)).
const ORIGINAL_SHARE = (695.6 - 170) / (1.1 * 695.6);
// the start boxes are square: the two guides they sit under are this far apart
const START_BOX = { gap: 22.82 };
// After the expand, this much page scroll (px) runs the phases (scrollProgress
// 1 -> 1 + PHASES): the original's wheel rate, 0.003 per px, over the 3.4 its
// phases span (the second exit phase ends at 4.37).
const PHASES = 3.4;
const RUNWAY = Math.round(PHASES / 0.003); // (unused since 2026-11-05: the phases play on the clock)
// 2026-11-05: the phases play from the first exit (1.5) to the end (1 + PHASES)
// at this many phase units a second, on average
const PHASE_FROM = 1.5;
// the heart sheets: the height they show above their guide (249 at full size;
// 30% smaller, then 15% back up: 0.7 x 1.15)
const CHART_H = 249 * 0.805;
const CHART_STAGGER = 700; // ms between the Excel sheet clips' starts (lowest first)
const CHART_RATE = 1.5;    // the Excel sheet clips play 50% faster (2026-11-05)
const PHASE_RATE = 0.85; // eased in and out: about 3.4s in all
// 2026-11-05: the Excel art the sheet opens with (a horse, sampled cell by cell
// from the reference image hf_20261105_233042_...png) at its full resolution:
// its square cells are half one of ours (30 x 15), so each of our cells shows
// two, left and right, each with its own fill and digit. One string per row,
// two chars per half cell: '..' empty, else a fill level (a lightest .. d
// darkest, the four colour swatches) and the digit typed in it. Erased (like "erase all")
// the first time the X opens the tools.
const SHEET_ART = [
  '......................................................b3..c4d8..............',
  '......................................................b3c4c6................',
  '..............................................b3a1a0a2d6b3c5a1c5............',
  '..........................................c5d7a1b4c5d7c5b2a1a2a1d6..........',
  '......................................c4b2a1a2c4b3d7d6b3a0a2a0c6b3d7........',
  '....................................b3b2b2b3c6c6c5c6b4a0c5b3a0a0a2a0a1d7....',
  '..................................c4b3d7d7c4a1b4d7b3a1b3d8c5b4b4b4b2a1a2c6..',
  '......................................d6a1b2b3d7d6a1a2b4d8d8d6d6c5b4b3c6d8..',
  '................................c5d7b3a1c4c4c5d8c5b2b3b3c5d8d9......d7c5d7..',
  '..................................c4c4c5c5b3d7d6b2b3b4a1c4d7................',
  '....................................b4b3a1b3d7c5b3b3b3a1c4c6................',
  '..................................c5b3b3c6d7c6b2b3c4a2a0a2c5................',
  '................................d6d7c6d6d8d7b3b4b3a0a2a1a2c5................',
  '......................................d6c4b3a2a0a0b3b4c4b2c5................',
  '......................c5a1a0a0a1b3c4c4b4b2a1a0a0a0a0a2b4c4c5................',
  '..........b4a1a0d6d6a2a0a1b2a1a2b3b2b2a2a0a0a0a0a2a0a0b2d7c6d8..............',
  '........c5a0a1b4c5b2a2b3b3a1a0a0a0a0a0a0a0a0a0a2b3b3a1a0c4d8................',
  '......b4a1a2b3d7a2a1b4b2a0a0a1a1a0a0a0a0a0a0a0b3b3b4b3a1c4d7................',
  '......a2a1c4d7..b3b3a1a0a2b4c4b2a1a0a0a0a0a1b3c4b3b4b2b3c5d7................',
  '....c4a2c4d7....c5b4a1a0a0b3c5c5b4b3a2b3b4b3b4d7c4a2b3c5d8..................',
  '....c4c5c5d7....c6c5b3a1a0a2c4d7c5b4b4b4b4b4c5d8c5b2a1d7c5d8................',
  '....c5b4c5c5d7..d7c6c4b4a1a2b3d7d8d6c5c5c5c6d7d9c6b3b2a2a2a2a0c6............',
  '..c5c4b3c4d7......d7c5b3b3a1b3d8d9d8d8d8d8d8......d7c5c5c4b4b4a2d6..........',
  '..d7b3c4c4d6........c4b3a2a2d6d9d8....................d8d8d7d6c4d7..........',
  'c5b3b3c5b4d6........c5a2a2d7d8d6d8......................d8d7..c6d7..........',
  '....b4b3c6..........d7c4c5d7d8..........................c6d8..c5d7..........',
  '..c5b2c5d6........c5c5c5d6c5d7........................d6....b4a1c6..........',
  'c5c4d6............d8b4b3d6..c6d7....................d7c5....c5b4d7..........',
  '....................d7c5d7..d7c5d6..............d8d7c6....d7b3d6............',
  '....................d6c4c6....d7c5d7............d8........d7................',
  '......................d7b4d7..d7c5d7........................................',
  '......................d7b3d7....d8..........................................',
  '........................d7b3c5..............................................',
  '..........................d7c4d7............................................',
];
const SHEET_ART_FILLS = { a: '#BEE1B0', b: '#7BD960', c: '#48A346', d: '#005E31' };
const SHEET_ART_AT = { row: 3, col: 4 }; // its top-left cell in the sheet (E4)

let alive = false;
let raf = 0;
let sheetRaf = 0;
let listeners = [];

function on(target, type, fn, opts) {
  if (!target) return;
  target.addEventListener(type, fn, opts);
  listeners.push(() => target.removeEventListener(type, fn, opts));
}

function mount(page) {
  alive = true;
  const doc = page.getRootNode(); // the section's shadow root, or the document standalone
  const $ = (id) => doc.getElementById(id);
  // the stitched site parses the page before rebasing src: the clip needs a fresh load
  const scribbleClip = $('scribble');
  if (scribbleClip && (scribbleClip.error || scribbleClip.readyState === 0)) scribbleClip.load();
  // 2026-11-05: the three Excel sheet clips (looping) need the same
  const chartClips = ['chart-img1', 'chart-img2', 'chart-img3'].map((id) => $(id));
  chartClips.forEach((v) => { if (v && (v.error || v.readyState === 0)) v.load(); });

  // The scroll, not a captured wheel, drives the phases after the expand: the
  // click gives the page's runway (its wrapper) RUNWAY px of extra height, the
  // page stays pinned (sticky) under the site header while that scrolls by,
  // and how far into it you are sets scrollProgress. Past either end the site
  // simply scrolls on, up to page 07 or down to whatever follows.
  const runway = page.parentElement;
  // the site header's live height (fluid since 2026-11-11; --header-h is no longer plain px)
  const headerH = () => { const h = document.querySelector('.site-header'); return h ? h.getBoundingClientRect().height : 0; };
  const runwayProgress = () => {
    const into = headerH() - runway.getBoundingClientRect().top; // px scrolled into the runway
    return 1 + Math.max(0, Math.min(1, into / RUNWAY)) * PHASES;
  };
  const onScreen = () => {
    const r = page.getBoundingClientRect();
    return r.bottom > 0 && r.top < window.innerHeight;
  };

  // ─── Layout constants (matching page 1) ────────────────────────────────────
  const lerp = (a, b, t) => a + (b - a) * t;
  let emojiAdded = false;
  let scribblePlayed = false;
  let typeStartTime = null;
  let exitCapH = null; // the headline font's cap height, per px of size (measured once)
  let wrTextW = null;
  // how far a label's x-height middle sits below its 1em line box's middle,
  // per font (canvas metrics), so it can be shifted up onto the box's centre
  const xOffCache = {};
  const xHeightOffset = (span) => {
    const cs = getComputedStyle(span);
    const key = cs.fontStyle + ' ' + cs.fontWeight + ' ' + cs.fontSize + ' ' + cs.fontFamily;
    if (xOffCache[key] === undefined) {
      const ctx = document.createElement('canvas').getContext('2d');
      ctx.font = key;
      const m = ctx.measureText('x');
      const size = parseFloat(cs.fontSize);
      const A = m.fontBoundingBoxAscent, D = m.fontBoundingBoxDescent;
      const baseline = (size - (A + D)) / 2 + A; // in a line-height: 1 box
      xOffCache[key] = (A === undefined) ? 0 : baseline - m.actualBoundingBoxAscent / 2 - size / 2;
    }
    return xOffCache[key];
  }; // the white box's longest line, px per px of font size (measured once)

  // ─── Scribble ended → color "art." light green ─────────────────────────────
  let scribbleEnded = false;
  const artTextEl = $('art-text');
  on($('scribble'), 'ended', () => {
    artTextEl.style.color = '#73D961';
    scribbleEnded = true;
  });

  // ─── Start box scrolling text ────────────────────────────────────────────────
  const startBox2Inner = $('start-box2-inner');
  const sb2Unit = 'CLICK\u00A0\u00A0<<<<<<<< \u00A0\u00A0';
  startBox2Inner.textContent = sb2Unit.repeat(20);

  // ─── Click banner setup ─────────────────────────────────────────────────────
  const clickBanner = $('click-banner');
  const clickBannerInner = $('click-banner-inner');
  const bannerFromWord = 'SCROLL';
  const bannerToWord = 'CLICK';
  const bannerDrawWord = 'DRAW'; // once the X opens the tools
  const bannerSep = '\u00A0\u00A0>>>>>>>> \u00A0\u00A0';
  const bannerMaxLen = Math.max(bannerFromWord.length, bannerToWord.length);
  let bannerHTML = '';
  for (let r = 0; r < 20; r++) {
    for (let i = 0; i < bannerMaxLen; i++) {
      const fc = bannerFromWord[i] || '';
      const tc = bannerToWord[i] || '';
      const display = fc === ' ' ? '\u00A0' : fc;
      const displayTo = tc || '';
      const displayDraw = bannerDrawWord[i] || '';
      bannerHTML += `<span class="bw-slot" style="display:inline-block;position:relative"><span class="bw-from" style="transition:opacity 0.4s ease">${display}</span><span class="bw-to" style="position:absolute;left:0;top:0;opacity:0;transition:opacity 0.4s ease">${displayTo}</span><span class="bw-draw" style="position:absolute;left:0;top:0;opacity:0;transition:opacity 0.4s ease">${displayDraw}</span></span>`;
    }
    bannerHTML += bannerSep;
  }
  clickBannerInner.innerHTML = bannerHTML;
  const bannerSlots = Array.from(clickBannerInner.querySelectorAll('.bw-slot'));
  let bannerWord = 'from'; // which word the strip shows: from (SCROLL), to (CLICK), draw (DRAW)
  // swaps the strip to a word letter by letter, 180ms apart, as the original did
  const setBannerWord = (word) => {
    if (word === bannerWord) return;
    bannerWord = word;
    bannerSlots.forEach((slot, idx) => {
      const delay = (idx % bannerMaxLen) * 180;
      setTimeout(() => {
        if (bannerWord !== word) return; // a newer swap took over
        for (const k of ['from', 'to', 'draw']) slot.querySelector('.bw-' + k).style.opacity = k === word ? '1' : '0';
      }, delay);
    });
  };

  let scrollProgress = 0, smoothScroll = 0;
  // One way only: once the last phase lands (the headline and spreadsheet:
  // the final layout), the journey locks there until the page is reloaded.
  // The progress stays at its end, the runway goes and the page is no longer
  // pinned, so the site scrolls on past it either way (up to page 07, down to
  // what follows) and the start and tweet layouts never come back.
  let journeyDone = false;
  const finishJourney = () => {
    journeyDone = true;
    scrollProgress = 1 + PHASES;
    const before = page.getBoundingClientRect().top;
    runway.style.height = ''; // back to one screen: nothing left to pin through
    const after = page.getBoundingClientRect().top;
    if (after !== before) window.scrollBy(0, after - before); // keep the page exactly where it is on screen
  };
  let expandStartTime = 0, expandStarted = false;
  const expandDuration = 2.0; // seconds for expand animation
  let xClickTime = 0, xClickProgress = 0, xClickFrom = 0, xClickTo = 0, xIsUp = false;
  let sheetEraseAll = null, sheetPaintArt = null, sheetArtShown = false; // set by the sheet below

  // ─── Green box click → start expand ─────────────────────────────────────────
  $('start-box1').addEventListener('click', () => {
    if (!expandStarted) {
      expandStarted = true;
      expandStartTime = performance.now();
      // the sheet clips start as they slide in, staggered: the lowest (3) first,
      // then the middle, then the top, CHART_STAGGER ms apart; each plays once
      // and holds on its last frame (no loop)
      [chartClips[2], chartClips[1], chartClips[0]].forEach((v, i) => {
        if (!v) return;
        const t = setTimeout(() => { if (alive) { v.currentTime = 0; v.defaultPlaybackRate = v.playbackRate = CHART_RATE; v.play().catch(() => {}); } }, i * CHART_STAGGER);
        listeners.push(() => clearTimeout(t));
      });
    }
  });

  // 2026-11-05: the first scroll after the click starts the phases, and they
  // play on their own clock (PHASE_RATE phase units a second, from the first
  // exit at PHASE_FROM to the end) instead of being scrubbed by the scroll.
  // The page holds still while they play: downward wheel / touch / key
  // scrolling is swallowed from the click until the journey is done (a scroll
  // during the expand queues the phases for when it ends). Upward scrolling
  // still leaves.
  let playStart = 0;
  const startPlay = () => {
    if (!expandStarted || journeyDone || playStart) return;
    playStart = Math.max(performance.now(), expandStartTime + expandDuration * 1000);
  };
  const holding = () => expandStarted && !journeyDone && onScreen();
  on(window, 'wheel', (e) => {
    if (!holding() || e.deltaY <= 0) return;
    e.preventDefault();
    startPlay();
  }, { passive: false });
  on(window, 'touchmove', (e) => {
    if (!holding()) return;
    e.preventDefault();
    startPlay();
  }, { passive: false });
  on(window, 'keydown', (e) => {
    if (!holding() || !['ArrowDown', 'PageDown', 'End', ' ', 'Spacebar'].includes(e.key)) return;
    e.preventDefault();
    startPlay();
  });
  let lastY = window.scrollY;
  on(window, 'scroll', () => { // a scrollbar drag (downward)
    const y = window.scrollY;
    if (y > lastY + 2 && holding()) startPlay();
    lastY = y;
  }, { passive: true });

  // (2026-11-05: the "create" word, #create-text, removed)
  $('x-square').addEventListener('click', () => {
    if (!scribbleEnded && !xIsUp) return;
    xClickFrom = xClickProgress;
    xClickTo = xIsUp ? 0 : 1;
    xIsUp = !xIsUp;
    xClickTime = performance.now();
    // the first time the tools open, the starting art erases itself
    if (xIsUp && sheetArtShown && sheetEraseAll) { sheetArtShown = false; sheetEraseAll(); }
    // and when they close, it fades back on (erase all in reverse)
    else if (!xIsUp && !sheetArtShown && sheetPaintArt) { sheetArtShown = true; sheetPaintArt(); }
  });


  function frame() {
    if (!alive) return;
    raf = requestAnimationFrame(frame);
    if (!onScreen()) return;
    const vw = page.clientWidth;
    const vh = page.clientHeight;

    const U = vw / 1440; // page 07's unit
    const fixedLeft = GUIDES.col * U + 39; // colX1 (= fixedLeft - 39) on page 07's column at 432
    const fixedTop = vh / 2 - 200;
    const fixedH = 400;
    const padX = 80;
    const padY = 40;
    const finalW = vw - fixedLeft + padX;
    const finalH = fixedH + padY * 2 + 25 + 16;

    const bxTop = fixedTop - padY - 16;
    const bxBot = bxTop + finalH;

    const colX1 = fixedLeft - 39;
    const colX2 = fixedLeft;

    // Expanded positions (page 1 reference)
    const h1 = bxTop - 145;
    const h2 = bxTop - 98;
    const h3 = bxTop;
    const h4 = bxBot;
    const h5 = bxBot + 46;
    const h6 = bxBot + 107;

    const centerY = vh / 2;

    // Collapsed positions (sr = 0, matching end of page 1)
    const rh1 = centerY + (h1 - centerY) * 0.6;
    const rh2 = centerY;
    const rh3 = centerY;
    const rh4 = centerY;
    const rh5 = centerY;
    const rh6 = centerY;

    const midH23 = (rh2 + rh3) / 2;
    const globeLeftX = GUIDES.left * U; // and vw - globeLeftX on its column at 1368
    const globeRightX = fixedLeft - 38;

    // Page 2 new horizontal guides
    // Two guides near top (below banner), two near bottom
    const p2h1Final = vh * 0.525;
    const p2h2 = vh * 0.565 - 15;
    // 2026-11-04: the gap between the photo's top (p2h2) and the white text
    // box's top (p2h5) is halved (GAP_CUT); the text box, its dashed guides, the
    // photo's bottom (p2h3) and the SCROLL strip (p2h4) all move up by the same
    // amount, so the photo is that much shorter. The cut fades out over the
    // exit phase (same timing as exitT below, a frame behind), so the closing
    // layout (headline + spreadsheet) keeps its original room.
    const p2h3Base = vh * 1.225 - 15 + 39 + 40;
    const p2h5Base = p2h2 + (p2h3Base - p2h2) * 0.75 - 120;
    const cutExitRaw = Math.max(0, Math.min(1, (smoothScroll - 1.5) / 1.69));
    const cutKeep = Math.pow(1 - cutExitRaw, 3); // = 1 - exitT
    const GAP_CUT = Math.max(0, p2h5Base - p2h2) * 0.5 * cutKeep;
    const p2h5Final = p2h5Base - GAP_CUT;
    const p2h6Final = p2h5Final + 240;
    const p2d1Final = p2h5Final + 60;
    const p2d2Final = p2h5Final + 120;
    const p2d3Final = p2h5Final + 180;
    const p2h3Final = p2h3Base - GAP_CUT;
    const p2h4Final = vh * 1.275 + 40 - GAP_CUT;

    const container = $('container');

    // ── Scroll animation ────────────────────────────────────────────────────
    // Expand phase: time-based, triggered by green box click
    let expandRaw = 0;
    if (expandStarted) {
      const now = performance.now();
      const expandElapsed = (now - expandStartTime) / 1000;
      expandRaw = Math.min(1, expandElapsed / expandDuration);
      // Once expand finishes, the phases wait for the first scroll, then play
      // through on the clock (PHASE_RATE), not at the scroll's pace
      if (expandRaw >= 1) {
        // the clock eases in (and out): the phases' own ease-outs start at full
        // speed, so a linear clock made them pop on the first frame
        const span = 1 + PHASES - PHASE_FROM;
        const u = (playStart && now >= playStart) ? Math.min(1, (now - playStart) / 1000 * PHASE_RATE / span) : 0;
        const eased = (1 - Math.cos(Math.PI * u)) / 2; // ease-in-out sine
        smoothScroll = playStart ? PHASE_FROM + eased * span : 1;
      }
    }
    const expandScroll = 1 - Math.pow(1 - expandRaw, 3);

    // Container offset (matching page 1 collapse, shifts up 75px at start)
    const collapseShift = -120 * (1 - expandScroll);
    const initialShift = -8 * (1 - expandScroll);
    // The original sat its centre guides (rh3, at vh / 2) 0.1vh - 128 below the
    // top: off screen on short screens, a few px down on tall ones, which left
    // a white sliver under page 07. Anchored so they start exactly on the seam
    // at every height (the original's offset was vh * -0.4).
    const offset = -vh / 2 + 128 + collapseShift + initialShift;
    container.style.transform = `translateY(${offset}px)`;
    // Photo edges (guides wipe the photo on from top-left)
    // 2026-11-04: the white gap left of the photo halved (170 -> 85) and the
    // photo widened left to fill it, at every phase (the closing layout's
    // photo, CLICK strip and tool column start at this x too)
    const photoLeft = globeLeftX + 85;
    const photoW = GUIDES.photo * U - photoLeft; // wider than the original's 1.1 x span, to page 07's 792 column
    const photoH = p2h3Final - p2h2;
    const p2h1 = lerp(rh3, p2h1Final, expandScroll);
    const photoTop = lerp(rh3, p2h2, expandScroll);
    const p2h5 = lerp(rh3, p2h5Final, expandScroll);
    const p2d1 = lerp(rh3, p2d1Final, expandScroll);
    const p2d2 = lerp(rh3, p2d2Final, expandScroll);
    const p2d3 = lerp(rh3, p2d3Final, expandScroll);
    const p2h6 = lerp(rh3, p2h6Final, expandScroll);
    const p2h3 = lerp(rh3, p2h3Final, expandScroll);
    const p2h4 = lerp(rh3, p2h4Final, expandScroll);
    const photoLeftDraw = lerp(globeLeftX, photoLeft, expandScroll);
    const photoRight = lerp(photoLeft, photoLeft + photoW, expandScroll);
    const photoBottom = p2h3;
    const colX2Draw = Math.max(colX2, photoRight);

    // ── Exit animation (white box + guides collapse up) ───────────────────
    const exitStart = 1.5;
    const exitDuration = 1.69;
    const exitRaw = Math.max(0, Math.min(1, (smoothScroll - exitStart) / exitDuration));
    const exitT = 1 - Math.pow(1 - exitRaw, 3);
    const wrVisibleHFull = p2d3Final - p2h5Final;
    const moveUp = exitT * (wrVisibleHFull + 20);

    // Photo collapses to colX2 (third vertical guide)
    const photoTargetExpand = (colX1 - photoLeft) / photoW;
    const photoExpandExit = lerp(expandScroll, photoTargetExpand, exitT);
    const photoExpandExitV = lerp(expandScroll, ORIGINAL_SHARE, exitT); // the original's vertical collapse
    let photoTopDraw = lerp(rh3, p2h2, photoExpandExitV);
    let p2h1Draw = lerp(p2h1, (rh3 + photoTopDraw) / 2, exitT);
    const photoBottomBase = lerp(rh3, p2h3Final, photoExpandExitV);
    let photoBottomDraw = photoBottomBase - 200 * exitT;

    // Collapse dashed guides, p2h5 and p2h6 into photoBottomDraw
    const photoBottomFinal = lerp(rh3, p2h3Final, ORIGINAL_SHARE) - 200;
    // 2026-11-05: these guides collapse on a quicker clock (COLLAPSE_SHARE of
    // the exit) and are fully closed before the dashed guides start opening
    // up (dashStart) to reveal the headline and wipe off the heart sheets
    const COLLAPSE_SHARE = 0.55;
    const collapseRaw = Math.max(0, Math.min(1, (smoothScroll - exitStart) / (exitDuration * COLLAPSE_SHARE)));
    const collapseT = 1 - Math.pow(1 - collapseRaw, 3);
    let p2h5Draw = lerp(p2h5, photoBottomDraw, collapseT);
    let p2d1Draw = lerp(p2d1, photoBottomDraw, collapseT);
    let p2d2Draw = lerp(p2d2, photoBottomDraw, collapseT);
    let p2d3Draw = lerp(p2d3, photoBottomDraw, collapseT);
    let p2h6Draw = lerp(p2h6, photoBottomDraw, collapseT);
    // 2026-11-05: the white box's top guide (p2h5) is drawn higher, level with
    // the top of the top heart sheet (its bottom sits one cell under the
    // first dashed guide: p2h5 + 2 cells - CHART_H); in step with the cells,
    // so it opens and closes with them. The box spans from it down to the
    // first dashed guide (p2d1), the same size as before, one cell higher.
    const dashCell = p2d1Draw - p2h5Draw; // 60 once open
    const p2h5Guide = p2h5Draw - Math.max(0, CHART_H / 60 - 2) * dashCell; // 2026-11-05: level with the top heart sheet's top
    let photoRightDraw = lerp(photoLeftDraw, photoLeft + photoW, photoExpandExit);
    let p2h4Draw = lerp(rh3, p2h4Final, photoExpandExitV) - 200 * exitT;
    let colX2DrawExit = lerp(colX2Draw, colX1, exitT);
    let exitGuideY = lerp(p2h4Draw, vh * 1.4, exitT);
    const xBoxSize = p2h4Draw - photoBottomDraw;
    let exitGuideX = lerp(photoRightDraw, photoRightDraw + xBoxSize, exitT);
    // Guide 5 line: sticks to photo right edge, then expands after delay
    const g5DelayedRaw = Math.max(0, (exitT - 0.9) / 0.1);
    const g5DelayedT = 1 - Math.pow(1 - g5DelayedRaw, 3);
    const exitGuideXLine = lerp(photoRightDraw, photoRightDraw + xBoxSize, g5DelayedT);
    const rightGuideX = vw - globeLeftX;
    let exitGuideXRight = lerp(photoRightDraw, (exitGuideX + rightGuideX) / 2 + 830, exitT);

    // Phase 2: dashed lines + text (after white box fully collapses)
    const exit2Start = exitStart + exitDuration * 0.7;
    const exit2Duration = 1.69;
    const exit2Raw = Math.max(0, Math.min(1, (smoothScroll - exit2Start) / exit2Duration));
    const exit2T = 1 - Math.pow(1 - exit2Raw, 3);
    if (!journeyDone && exit2T > 0.97) finishJourney(); // the final layout is in (the scribble starts here); the easing finishes on its own

    // 3 dashed lines expanding upward from photo bottom
    // 2026-11-05: on their own, sooner clock: they start halfway through the
    // first exit (phase 2 starts at 70% of it) and open over the same span
    const dashStart = exitStart + exitDuration * COLLAPSE_SHARE; // right as the collapse closes
    const dashRaw = Math.max(0, Math.min(1, (smoothScroll - dashStart) / exit2Duration));
    const dashT = 1 - Math.pow(1 - dashRaw, 3);
    const photoSpan = photoBottomDraw - photoTopDraw;
    let exitDash1 = lerp(photoBottomDraw, photoBottomDraw - photoSpan * 0.25, dashT);
    let exitDash2 = lerp(photoBottomDraw, photoBottomDraw - photoSpan * 0.5, dashT);
    let exitDash3 = lerp(photoBottomDraw, photoBottomDraw - photoSpan * 0.75, dashT);

    // 2 white guides animate down from photo bottom into green box
    const greenBoxBot = exitGuideY;
    const greenBoxSpan = greenBoxBot - p2h4Draw;
    const whiteGuideTop = lerp(p2h4Draw, p2h4Draw + greenBoxSpan * 0.33 - 185, exit2T);
    const whiteGuideBot = lerp(p2h4Draw, p2h4Draw + greenBoxSpan * 0.66 + 193, exit2T);

    // White box right edge — driven by expand animation
    const wrTEarlyRaw = Math.min(1, Math.max(0, (expandRaw - 0.33) / 0.67));
    const wrTEarly = 1 - Math.pow(1 - wrTEarlyRaw, 2);
    const wrRightXBase = colX1 + lerp(0, GUIDES.white * U - colX1, wrTEarly);
    let wrRightX = lerp(wrRightXBase, exitGuideX, exitT);

    // ── Phase 3: X-button click — slide excel up / back down ──────────────
    if (xClickTime > 0) {
      const elapsed = (performance.now() - xClickTime) / 1000;
      const duration = 1.4;
      const raw = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - raw, 3);
      xClickProgress = lerp(xClickFrom, xClickTo, eased);
    }
    const cT = xClickProgress;
    // 2026-11-05: the guide on the photo's left edge slides left with the exit
    // scroll and collapses into the left guide (globeLeftX), and stays there:
    // the tools open in the one column from that guide to colX1 (toolsLeft).
    const photoLeftGuideX = lerp(photoLeftDraw, globeLeftX, exitT);

    // The original slid the photo, headline and spreadsheet up to make room
    // for the tools. Here they stay where they are and the tools open in place
    // under the CLICK strip, down the column beside the spreadsheet: the same
    // dashed guides grow down from p2h4Draw, starting right at the strip.

    // dashed guides expand down from p2h4Draw, aligned with excel rows (16px
    // each); the color row starts right at the strip. On short screens the
    // rows tighten (to 14px at least) so the stack down to save fits the page.
    const toolsFloor = vh - offset - 2; // the page's bottom edge, in the container's coordinates
    const rowH = Math.max(14, Math.min(16, (toolsFloor - p2h4Draw) / 26)); // 16 = 15px cell + 1px border (2026-11-05: cells 25% smaller, was 21)
    const clickDashOffset = -rowH * 2;
    const clickDash1 = lerp(p2h4Draw, p2h4Draw + clickDashOffset + rowH * 2, cT);
    const clickDash2 = lerp(p2h4Draw, p2h4Draw + clickDashOffset + rowH * 4, cT);
    const clickDash3 = lerp(p2h4Draw, p2h4Draw + clickDashOffset + rowH * 6, cT);
    const clickDash4 = lerp(p2h4Draw, p2h4Draw + clickDashOffset + rowH * 8, cT);
    const clickDash5 = lerp(p2h4Draw, p2h4Draw + clickDashOffset + rowH * 10, cT);
    const clickDash6 = lerp(p2h4Draw, p2h4Draw + clickDashOffset + rowH * 12, cT);
    const clickDash7 = lerp(p2h4Draw, p2h4Draw + clickDashOffset + rowH * 20, cT);
    const clickDash10 = lerp(p2h4Draw, p2h4Draw + clickDashOffset + rowH * 22, cT);
    const thumbRowH = 100 + 4; // thumbnail height + gap
    // the saved thumbnails take what is left of the screen: save sits at the
    // page's bottom edge (or where the original put it, if that is higher)
    const clickDash8Target = Math.max(p2h4Draw + clickDashOffset + rowH * 26, Math.min(p2h4Draw + clickDashOffset + rowH * 22 + 2 + 3 + thumbRowH * 4 + 4 + rowH * 4, toolsFloor));
    const clickDash11Target = clickDash8Target - rowH * 4;
    const clickDash11 = lerp(p2h4Draw, clickDash11Target, cT);
    const clickDash9 = lerp(p2h4Draw, clickDash11Target + rowH * 2, cT);
    const clickDash8 = lerp(p2h4Draw, clickDash8Target, cT);

    // Position click labels between dashed guides
    const clickLabels = [
      { el: $('click-label4'), top: clickDash1, bot: clickDash2 },
      { el: $('click-label7'), top: clickDash3, bot: clickDash4 },
      { el: $('click-label1'), top: clickDash4, bot: clickDash5 },
      { el: $('click-label5'), top: clickDash5, bot: clickDash6 },
      { el: $('click-label6'), top: clickDash7, bot: clickDash10, leftAt: 'exitGuideX', swatchSize: true },
      { el: $('click-label8'), top: clickDash11, bot: clickDash9 }, // 2026-11-05: half cells, the row above save
      { el: $('click-label2'), top: clickDash9, bot: clickDash8, centered: true },
    ];
    // The tools (swatches, prompt, generate, saved thumbs) ended 26px short of
    // exitGuideX, one X-box past the column guide (colX1), so they fell short of
    // the guide or ran over it with the screen's height. They now end exactly
    // on the guide: no gap, no overlap.
    const toolsRight = colX1;
    // 2026-11-05: one column now (the photo's left guide stays collapsed): the
    // labels sit in it, color's swatches one row down under it (dash2-3),
    // erase and erase all one row down (dash3-5); tools span toolsLeft-toolsRight
    const toolsLeft = globeLeftX;
    const swatchW = (toolsRight - toolsLeft) / 4;
    const swatchHSize = Math.max(0, clickDash3 - clickDash2);
    for (const { el, top, bot, halfWidth, offsetY, leftAt, swatchSize, textOffsetY, centered } of clickLabels) {
      if (cT > 0.01) {
        const lx = toolsLeft;
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = (leftAt === 'exitGuideX' || centered) ? 'center' : 'flex-start';
        el.style.paddingLeft = (leftAt === 'exitGuideX' || centered) ? '0' : '20px';
        el.style.left = lx + 'px';
        el.style.top = (top + (offsetY || 0)) + 'px';
        el.style.paddingBottom = '0';
        // 2026-11-05: the text centred exactly: its x-height's middle on the box's
        const span = el.firstElementChild;
        if (span) span.style.transform = `translateY(${-xHeightOffset(span)}px)`;
        el.style.width = (toolsRight - toolsLeft) + 'px';
        const elH = swatchSize ? swatchHSize : (bot - top);
        el.style.height = elH + 'px';
        const clipTop = Math.max(0, elH - elH * cT);
        // 2026-11-04: the label column halved (photoLeft), so a word longer than
        // it ("erase all", "prompt") runs on past its right edge into the empty
        // tool row beside it instead of being cut (no right clip, overflow shown)
        el.style.overflow = 'visible';
        el.style.clipPath = `inset(${clipTop}px -400px 0px 0px)`;
        el.style.opacity = Math.min(1, elH / 10);
      } else {
        el.style.display = 'none';
      }
    }

    // 2026-11-05: one unbroken light green fill under the whole tool column,
    // color's row to save's; its edges ride the outer dashed guides as they
    // open, so the grid masks it on (the guides draw on top of it)
    const toolsFill = $('tools-fill');
    if (cT > 0.01) {
      toolsFill.style.display = 'block';
      toolsFill.style.left = toolsLeft + 'px';
      toolsFill.style.top = clickDash1 + 'px';
      toolsFill.style.width = (toolsRight - toolsLeft) + 'px';
      toolsFill.style.height = Math.max(0, clickDash8 - clickDash1) + 'px';
    } else {
      toolsFill.style.display = 'none';
    }

    // Position color swatches — top sticks to clickDash1, bottom sticks to clickDash2
    const swatchesEl = $('color-swatches');
    if (cT > 0.01) {
      const swatchH = Math.max(0, clickDash3 - clickDash2);
      swatchesEl.style.display = 'flex';
      swatchesEl.style.left = toolsLeft + 'px';
      swatchesEl.style.top = clickDash2 + 'px';
      swatchesEl.style.width = (toolsRight - toolsLeft) + 'px';
      swatchesEl.style.height = swatchH + 'px';
      swatchesEl.style.clipPath = '';
      swatchesEl.querySelectorAll('.color-swatch').forEach(s => {
        s.style.background = s.dataset.color;
      });
    } else {
      swatchesEl.style.display = 'none';
    }

    // Grid hover boxes under erase (clickDash3-4 and clickDash4-5)
    const gh1 = $('grid-hover1');
    const gh2 = $('grid-hover2');
    if (cT > 0.01) {
      const ghLeft = globeLeftX;
      const ghWidth = photoLeft - globeLeftX;
      gh1.style.display = 'none'; // its empty row is erase all's now
      gh1.style.left = ghLeft + 'px';
      gh1.style.top = clickDash4 + 'px';
      gh1.style.width = ghWidth + 'px';
      gh1.style.height = Math.max(0, clickDash5 - clickDash4) + 'px';
      gh2.style.display = 'none';
    } else {
      gh1.style.display = 'none';
      gh2.style.display = 'none';
    }

    // Prompt fill between horizontal lines 6-7, vertical lines 2-3
    const promptFill = $('prompt-fill');
    if (cT > 0.01) {
      promptFill.style.position = 'absolute';
      promptFill.style.zIndex = '21'; // over the tools fill
      promptFill.style.left = toolsLeft + 'px';
      promptFill.style.top = clickDash6 + 'px';
      promptFill.style.width = (toolsRight - toolsLeft) + 'px';
      promptFill.style.height = Math.max(0, clickDash7 - clickDash6) + 'px';
      promptFill.style.background = 'transparent'; // 2026-11-05: the tools fill shows through
      promptFill.style.display = 'flex';
    } else {
      promptFill.style.display = 'none';
    }

    // Position saved thumbnails between clickDash8 and clickDash9, right of photoLeft
    const savedThumbs = $('saved-thumbs');
    if (cT > 0.01) {
      // the saved thumbnails stack in the white column right of the
      // spreadsheet (its right guide to the page edge), from the top of the
      // sheet down to the bottom of the page, each as wide as the column
      const thumbsLeft = vw - globeLeftX;
      const thumbsW = vw - thumbsLeft;
      savedThumbs.style.display = 'flex';
      savedThumbs.style.left = thumbsLeft + 'px';
      savedThumbs.style.top = p2h4Draw + 'px';
      savedThumbs.style.width = thumbsW + 'px';
      savedThumbs.style.height = Math.max(0, (toolsFloor - p2h4Draw) * cT) + 'px'; // grows down with the tools
      savedThumbs.style.setProperty('--thumb', Math.max(0, thumbsW - 8) + 'px');
    } else {
      savedThumbs.style.display = 'none';
    }

    // (the original collapsed the headline's guides here as the block slid up;
    // nothing slides now, so they stay with the headline)

    // ── Gridlines (matching page 1 at sr=0) ────────────────────────────────
    const sbOpacity = Math.max(0, 1 - expandScroll);
    const sbCollapseT = Math.min(1, expandScroll / 0.6);
    const sbGuide1X = lerp(GUIDES.box * U, colX1, sbCollapseT); // page 07's 448.3 and 576 columns
    const sbGuide2X = lerp(GUIDES.click * U, colX1, sbCollapseT);
    const sbGuide1XOpacity = Math.min(1, (sbGuide1X - colX1) / 5);
    const sbGuide2XOpacity = Math.min(1, (sbGuide2X - colX1) / 5);
    const sbGuide1Y = Math.max(rh3 + 387.5, p2h4Draw);
    const sbGuide2Y = Math.max(rh3 + 387.5 + START_BOX.gap * U, p2h4Draw);
    const sbGuide3Y = p2h4Draw;
    const sbGuide1YOpacity = Math.max(0, 1 - exitT * 2);
    const sbGuide2YOpacity = Math.max(0, 1 - exitT * 2);
    const glEl = $('gridlines');

    glEl.innerHTML =
      `<svg width="${vw}" height="${vh * 2}" style="position:absolute;left:0;top:0">` +
      `<line x1="0" y1="${midH23}" x2="${vw}" y2="${midH23}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4" opacity="0"/>` +
      `<line x1="0" y1="${rh1}" x2="${vw}" y2="${rh1}" stroke="#0F4F32" stroke-width="0.7"/>` +
      `<line x1="0" y1="${rh2}" x2="${vw}" y2="${rh2}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4" opacity="0"/>` +
      `<line x1="0" y1="${rh3}" x2="${vw}" y2="${rh3}" stroke="#0F4F32" stroke-width="0.7"/>` +
      `<line x1="0" y1="${rh4}" x2="${vw}" y2="${rh4}" stroke="#0F4F32" stroke-width="0.7"/>` +
      `<line x1="0" y1="${rh5}" x2="${vw}" y2="${rh5}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4" opacity="0"/>` +
      `<line x1="0" y1="${rh6}" x2="${vw}" y2="${rh6}" stroke="#0F4F32" stroke-width="0.7"/>` +
      `<line x1="0" y1="${p2h1Draw}" x2="${vw}" y2="${p2h1Draw}" stroke="#0F4F32" stroke-width="0.7"/>` +
      `<line x1="0" y1="${photoTopDraw}" x2="${vw}" y2="${photoTopDraw}" stroke="#0F4F32" stroke-width="0.7"/>` +
      `<line x1="0" y1="${photoBottomDraw}" x2="${vw}" y2="${photoBottomDraw}" stroke="#0F4F32" stroke-width="0.7"/>` +
      `<line x1="0" y1="${p2d1Draw}" x2="${vw}" y2="${p2d1Draw}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` +
      `<line x1="0" y1="${p2d2Draw}" x2="${vw}" y2="${p2d2Draw}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` +
      `<line x1="0" y1="${p2d3Draw}" x2="${vw}" y2="${p2d3Draw}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` +
      `<line x1="0" y1="${p2h6Draw}" x2="${vw}" y2="${p2h6Draw}" stroke="#0F4F32" stroke-width="0.7" opacity="${Math.max(0, 1 - exitT * 2)}"/>` +
      `<line x1="0" y1="${p2h4Draw}" x2="${vw}" y2="${p2h4Draw}" stroke="#0F4F32" stroke-width="0.7" opacity="${Math.max(0, 1 - exitT * 2)}"/>` +
      (exitT > 0 ? `<line x1="0" y1="${exitGuideY}" x2="${vw}" y2="${exitGuideY}" stroke="#0F4F32" stroke-width="0.7"/>` : '') +
      (g5DelayedT > 0.01 ? `<line x1="${exitGuideXLine}" y1="0" x2="${exitGuideXLine}" y2="${vh * 2}" stroke="#0F4F32" stroke-width="0.7"/>` : '') +
      (exitT > 0 ? `<line x1="${exitGuideXRight}" y1="0" x2="${exitGuideXRight}" y2="${vh * 2}" stroke="#0F4F32" stroke-width="0.7"/>` : '') +
      (dashT > 0 ? `<line x1="0" y1="${exitDash1}" x2="${vw}" y2="${exitDash1}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` : '') +
      (dashT > 0 ? `<line x1="0" y1="${exitDash2}" x2="${vw}" y2="${exitDash2}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` : '') +
      (dashT > 0 ? `<line x1="0" y1="${exitDash3}" x2="${vw}" y2="${exitDash3}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` : '') +
      `<line x1="${photoLeftGuideX}" y1="0" x2="${photoLeftGuideX}" y2="${vh * 2}" stroke="#0F4F32" stroke-width="0.7"/>` +
      `<line x1="${Math.min(colX1, photoRightDraw)}" y1="0" x2="${Math.min(colX1, photoRightDraw)}" y2="${vh * 2}" stroke="#0F4F32" stroke-width="0.7"/>` +
      `<line x1="${photoRightDraw >= colX1 ? photoRightDraw : Math.min(colX1, photoRightDraw)}" y1="0" x2="${photoRightDraw >= colX1 ? photoRightDraw : Math.min(colX1, photoRightDraw)}" y2="${vh * 2}" stroke="#0F4F32" stroke-width="0.7"/>` +
      `<line x1="${wrRightX}" y1="0" x2="${wrRightX}" y2="${vh * 2}" stroke="#0F4F32" stroke-width="0.7"/>` +
      `<line x1="${vw - globeLeftX}" y1="0" x2="${vw - globeLeftX}" y2="${vh * 2}" stroke="#0F4F32" stroke-width="0.7"/>` +
      `<line x1="0" y1="${sbGuide1Y}" x2="${vw}" y2="${sbGuide1Y}" stroke="#0F4F32" stroke-width="0.7" opacity="${sbGuide1YOpacity}"/>` +
      `<line x1="0" y1="${sbGuide2Y}" x2="${vw}" y2="${sbGuide2Y}" stroke="#0F4F32" stroke-width="0.7" opacity="${sbGuide2YOpacity}"/>` +
      `<line x1="0" y1="${sbGuide3Y}" x2="${vw}" y2="${sbGuide3Y}" stroke="#0F4F32" stroke-width="0.7"/>` +
      `<line x1="${sbGuide1X}" y1="0" x2="${sbGuide1X}" y2="${vh * 2}" stroke="#0F4F32" stroke-width="0.7" opacity="${sbGuide1XOpacity}"/>` +
      `<line x1="${sbGuide2X}" y1="0" x2="${sbGuide2X}" y2="${vh * 2}" stroke="#0F4F32" stroke-width="0.7" opacity="${sbGuide2XOpacity}"/>` +
      (cT > 0 ? `<line x1="0" y1="${clickDash1}" x2="${exitGuideX}" y2="${clickDash1}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` : '') +
      (cT > 0 ? `<line x1="0" y1="${clickDash2}" x2="${exitGuideX}" y2="${clickDash2}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` : '') +
      (cT > 0 ? `<line x1="0" y1="${clickDash3}" x2="${exitGuideX}" y2="${clickDash3}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` : '') +
      (cT > 0 ? `<line x1="0" y1="${clickDash4}" x2="${exitGuideX}" y2="${clickDash4}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` : '') +
      (cT > 0 ? `<line x1="0" y1="${clickDash5}" x2="${exitGuideX}" y2="${clickDash5}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` : '') +
      (cT > 0 ? `<line x1="0" y1="${clickDash6}" x2="${exitGuideX}" y2="${clickDash6}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` : '') +
      (cT > 0 ? `<line x1="0" y1="${clickDash7}" x2="${exitGuideX}" y2="${clickDash7}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` : '') +
      (cT > 0 ? `<line x1="0" y1="${clickDash10}" x2="${exitGuideX}" y2="${clickDash10}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` : '') +
      (cT > 0 ? `<line x1="0" y1="${clickDash11}" x2="${exitGuideX}" y2="${clickDash11}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` : '') +
      (cT > 0 ? `<line x1="0" y1="${clickDash9}" x2="${exitGuideX}" y2="${clickDash9}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` : '') +
      (cT > 0 ? `<line x1="0" y1="${clickDash8}" x2="${exitGuideX}" y2="${clickDash8}" stroke="#0F4F32" stroke-width="0.7" stroke-dasharray="4,4"/>` : '') +
      `</svg>`;

    // ── Gridlines overlay (on top of photo) ──────────────────────────────
    const glOver = $('gridlines-over');
    glOver.innerHTML =
      `<svg width="${vw}" height="${vh * 2}" style="position:absolute;left:0;top:0">` +
      `<line x1="0" y1="${p2h5Guide}" x2="${vw}" y2="${p2h5Guide}" stroke="#0F4F32" stroke-width="0.7"/>` +
      `</svg>`;

    // ── Globe vertical guides (matching page 1) ───────────────────────────
    const glUnder = $('gridlines-under');
    glUnder.innerHTML =
      `<svg width="${vw}" height="${vh * 2}" style="position:absolute;left:0;top:0">` +
      `<line x1="${globeLeftX}" y1="0" x2="${globeLeftX}" y2="${vh * 2}" stroke="#0F4F32" stroke-width="0.7"/>` +
      `</svg>`;

    // ── Beyond banner ──────────────────────────────────────────────────────
    const beyondBanner = $('beyond-banner');
    const bbTop = rh1;
    const bbHeight = rh2 - rh1;
    const bbFullHeight = h2 - h1;
    beyondBanner.style.left = globeLeftX + 'px';
    beyondBanner.style.top = bbTop + 'px';
    beyondBanner.style.width = (colX1 - globeLeftX) + 'px';
    beyondBanner.style.height = bbHeight + 'px';
    const bbFontSize = Math.max(12, bbFullHeight * 0.7);
    beyondBanner.querySelector('span').style.fontSize = bbFontSize + 'px';
    beyondBanner.style.clipPath = `inset(${Math.max(0, rh1 - bbTop)}px 0 ${Math.max(0, (bbTop + bbHeight) - rh2)}px 0)`;

    // ── Photo: scales with guides ──────────────────────────────────────────────
    const photo1 = $('photo1');
    // 2026-11-05: the photo's left edge follows its guide (photoLeftGuideX) left
    // through the exit, filling the gap, and back as the X opens the tools
    const visibleW = photoRightDraw - photoLeftGuideX;
    const visibleH = photoBottomDraw - photoTopDraw;
    photo1.style.left = photoLeftGuideX + 'px';
    photo1.style.top = photoTopDraw + 'px';
    photo1.style.width = Math.max(0, visibleW) + 'px';
    photo1.style.height = Math.max(0, visibleH) + 'px';
    photo1.style.objectPosition = 'top';
    photo1.style.clipPath = '';
    photo1.style.transform = '';

    // ── White rectangle on top of dashed lines (delayed) ───────────────────────
    const wrLeft = GUIDES.tweet * U;
    const wrFullW = GUIDES.white * U - wrLeft;
    const wrFullH = p2d3Final - p2h5Final;
    const whiteRect = $('white-rect');
    whiteRect.style.left = wrLeft + 'px';
    whiteRect.style.top = p2h5Guide + 'px';
    whiteRect.style.width = wrFullW + 'px';
    whiteRect.style.height = wrFullH + 'px';
    // 2026-11-05: the box (and its type) drawn 30% smaller, scaled from its
    // top-right corner so its right edge stays on page 07's 1296 column; the
    // clips below are in the box's own (unscaled) px, hence the / WR_SCALE
    // scaled so it runs from the raised top guide down to the second dashed
    // guide (p2d2) once open: (120 + the lift) / 180
    const WR_SCALE = (p2d1Final - p2h5Final + Math.max(0, CHART_H / 60 - 2) * 60) / wrFullH;
    whiteRect.style.transformOrigin = 'right top';
    whiteRect.style.transform = `scale(${WR_SCALE})`;
    const wrClipRight = Math.max(0, ((wrLeft + wrFullW) - wrRightX) / WR_SCALE);
    const wrClipBottom = Math.max(0, (p2h5Guide + wrFullH * WR_SCALE - p2d1Draw) / WR_SCALE);
    // the type fits the box's width (28px at most): its longest line, plus the
    // emoji, inside the box's 58px of side padding, with a little to spare
    if (wrTextW === null) {
      const mctx = document.createElement('canvas').getContext('2d');
      mctx.font = '28px Arial, Helvetica, sans-serif';
      wrTextW = Math.max(
        mctx.measureText('My secret talent is that I can make an amazing, beautiful,').width,
        mctx.measureText('detailed chart in Excel and then IMMEDIATELY forget').width,
        mctx.measureText('how I did it and never be able to recreate it ').width + 34
      ) / 28; // px of width per px of font size
    }
    const wrFont = Math.min(28, (wrFullW - 58 - 8) / wrTextW);
    if (whiteRect.dataset.font !== wrFont.toFixed(1)) {
      whiteRect.dataset.font = wrFont.toFixed(1);
      whiteRect.querySelectorAll('.text-line').forEach(l => { l.style.fontSize = wrFont + 'px'; });
    }
    whiteRect.style.clipPath = `inset(0 ${wrClipRight}px ${wrClipBottom}px 0)`;
    whiteRect.style.visibility = p2d1Draw - p2h5Guide < 1 ? 'hidden' : ''; // closed: no sliver of its border
    whiteRect.style.pointerEvents = expandRaw >= 1 ? 'auto' : 'none';

    // ── Text lines: type on driven by expand animation ──────────────────────────
    if (expandStarted && !typeStartTime) typeStartTime = performance.now();
    {
      const lineTexts = [
        'My secret talent is that I can make an amazing, beautiful,',
        'detailed chart in Excel and then IMMEDIATELY forget',
        'how I did it and never be able to recreate it '
      ];
      // Map expandRaw (0→1) to typing progress across all 3 lines
      const typeT = expandRaw;
      const lineShare = 1 / 3;
      for (let i = 0; i < 3; i++) {
        const line = $('tline' + (i + 1));
        const lineStart = i * lineShare;
        const lineT = Math.max(0, Math.min(1, (typeT - lineStart) / lineShare));
        const chars = Math.round(lineT * lineTexts[i].length);
        if (i === 2 && chars >= lineTexts[2].length && !emojiAdded) {
          let html = '';
          for (const ch of lineTexts[2]) html += `<span>${ch === ' ' ? '&nbsp;' : ch}</span>`;
          html += '<span class="emoji-spring">\u{1F612}</span>';
          line.innerHTML = html;
          emojiAdded = true;
        } else if (i === 2 && emojiAdded) {
          // keep emoji, don't update
        } else if (lineT >= 1 && !line.dataset.wrapped) {
          // Typing done for this line — wrap each char in a span for hover
          let html = '';
          for (const ch of lineTexts[i]) html += `<span>${ch === ' ' ? '&nbsp;' : ch}</span>`;
          line.innerHTML = html;
          line.dataset.wrapped = '1';
        } else if (!line.dataset.wrapped) {
          line.textContent = lineTexts[i].substring(0, chars);
        }
      }
    }

    // ── Exit green fill: wipes down with guide (only after exit phase 2 starts) ─
    const exitGreen = $('exit-green-fill');
    if (exitT > 0) {
      exitGreen.style.left = exitGuideX + 'px';
      exitGreen.style.top = p2h4Draw + 'px';
      exitGreen.style.width = ((vw - globeLeftX) - exitGuideX) + 'px';
      exitGreen.style.height = Math.max(0, exitGuideY - p2h4Draw) + 'px';
      exitGreen.style.clipPath = `inset(0 0 0 0)`;
      exitGreen.style.opacity = Math.min(1, exitT * 5);
      exitGreen.style.display = 'block';
    } else {
      exitGreen.style.display = 'none';
    }

    // ── Exit text: positioned below each dashed line, clipped between lines ─────
    const exitTextEls = [
      { el: $('exit-text1'), top: exitDash3, clipTop: exitDash3, clipBot: exitDash2 },
      { el: $('exit-text2'), top: exitDash2, clipTop: exitDash2, clipBot: exitDash1 },
      { el: $('exit-text3'), top: exitDash1, clipTop: exitDash1, clipBot: photoBottomDraw, topOffset: -15 },
    ];
    const textLeft = colX2DrawExit + 40;
    // 2026-11-05: the headline's size fits its longest line ("amazing,
    // beautiful chart.") between textLeft and the right guide (vw - globeLeftX),
    // with 24px to spare; it never crosses that guide, and stays at most 80px
    // 2026-11-06: shown from the moment the guides start to open (dashT), not
    // from phase 2 (exit2T): by then the bands were ~40% open and the lines
    // popped on; now each band opens from closed and masks its line on
    const headlineOn = dashT > 0;
    if (headlineOn) {
      const longest = $('exit-text3');
      longest.style.display = 'block';
      const curSize = parseFloat(longest.style.fontSize) || 80;
      const perPx = longest.offsetWidth / curSize; // width per px of font size
      const room = (vw - globeLeftX) - 24 - textLeft;
      // and its rows: each line fits between its dashed guides (a quarter of the
      // photo apart once they open; 1.15 em covers the glyphs plus the 5px inset)
      const rowRoom = photoSpan * 0.25 / 1.15;
      const size = Math.max(10, Math.min(80, rowRoom, perPx > 0 ? room / perPx : 80));
      if (Math.abs(size - curSize) > 0.25) for (const { el } of exitTextEls) el.style.fontSize = size + 'px';
    }
    // 2026-11-05: each line sits dead centre between its two guides: its
    // capitals (cap height, measured once from the font) are centred on the
    // band's middle, found from the line's own baseline (a zero-size marker
    // span at its end), so the line-heights and fallback fonts don't matter
    if (exitCapH === null) {
      const mctx = document.createElement('canvas').getContext('2d');
      mctx.font = getComputedStyle($('exit-text1')).fontWeight + ' 100px ' + getComputedStyle($('exit-text1')).fontFamily;
      exitCapH = (mctx.measureText('H').actualBoundingBoxAscent || 66) / 100;
    }
    // each line rises into its band from behind the lower guide (a mask-on),
    // on its own ease-out clock from when the guides start to open, a beat
    // apart top to bottom
    const HEADLINE_RISE = { duration: 1.3, stagger: 0.12 };
    exitTextEls.forEach((t, i) => {
      const raw = Math.max(0, Math.min(1, (smoothScroll - dashStart - i * HEADLINE_RISE.stagger) / HEADLINE_RISE.duration));
      t.rise = 1 - Math.pow(1 - raw, 3);
    });
    for (const { el, clipTop, clipBot, rise } of exitTextEls) {
      if (headlineOn) {
        el.style.left = textLeft + 'px';
        el.style.display = 'block';
        let mark = el.querySelector(':scope > .baseline-mark');
        if (!mark) {
          mark = document.createElement('span');
          mark.className = 'baseline-mark';
          mark.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline';
          el.appendChild(mark);
        }
        const size = parseFloat(getComputedStyle(el).fontSize);
        const baseline = mark.offsetTop; // from the line's top
        const top = (clipTop + clipBot) / 2 + exitCapH * size / 2 - baseline + (1 - rise) * el.offsetHeight;
        el.style.top = top + 'px';
        const ct = Math.max(0, clipTop - top);
        const cb = Math.max(0, (top + el.offsetHeight) - clipBot);
        el.style.clipPath = `inset(${ct}px 0 ${cb}px 0)`;
      } else {
        el.style.display = 'none';
      }
    }

    // ── Scribble video over "ch" in chart ───────────────────────────────────────
    const scribbleEl = $('scribble');
    if (exit2T > 0.97 && !scribblePlayed) {
      scribbleEl.style.opacity = 1;
      scribbleEl.play();
      scribblePlayed = true;
    } else if (exit2T <= 0.97 && scribblePlayed) {
      scribbleEl.style.opacity = 0;
      scribbleEl.pause();
      scribbleEl.currentTime = 0;
      scribblePlayed = false;
      scribbleEnded = false;
      artTextEl.style.color = '#0F4F32';
    }

    // ── X square: bottom-right corner of photo ─────────────────────────────────
    const xSquare = $('x-square');
    const xSize = p2h4Draw - photoBottomDraw;
    xSquare.style.left = photoRightDraw + 'px';
    xSquare.style.top = photoBottomDraw + 'px';
    xSquare.style.width = xSize + 'px';
    xSquare.style.height = xSize + 'px';
    xSquare.style.fontSize = (xSize * 0.7) + 'px';

    // ── Banner word animation: SCROLL → CLICK, and CLICK → DRAW while the X has the tools open ──
    setBannerWord(exitT <= 0.01 ? 'from' : (xIsUp ? 'draw' : 'to'));

    // ── Click banner: strip under photo, cropped to photo edges ─────────────────
    const bannerH = p2h4Draw - photoBottomDraw;
    const bannerLeft = exitT > 0 ? photoLeftGuideX : photoLeft; // under the photo, its left edge too
    clickBanner.style.left = bannerLeft + 'px';
    clickBanner.style.top = photoBottomDraw + 'px';
    clickBanner.style.width = Math.max(0, photoRightDraw - bannerLeft) + 'px';
    clickBanner.style.height = bannerH + 'px';
    clickBanner.style.lineHeight = bannerH + 'px';

    // ── Chart images: stacked in lower-left of photo ────────────────────────────
    // 2026-11-05: all three hearts sit one cell lower (one dashed-guide gap,
    // which closes up with the guides through the exit)
    // 2026-11-05: each heart sits on the guide under it (the second and third
    // dashed guides, then p2h6) and rides it down through the exit, while it is
    // masked off by the collapsing guides: shown only between the top guide
    // (p2h5Guide) and the bottom one (p2h6Draw), which close onto the photo's
    // bottom before the dashed guides open on the headline
    const chartMask = (top, h) => collapseT > 0 ? [Math.max(0, p2h5Guide - top), Math.max(0, top + h - p2h6Draw)] : [0, 0]; // (only once the collapse starts)
    // 2026-11-05: the hearts 30% smaller (250 -> 175 wide), shrunk toward their
    // left edges (same lefts) and still sitting on their guides; CHART_H is the
    // height they show above their guide (249 at full size)
    // (CHART_H: the module constant)
    const chartImg = $('chart-img1');
    const chartT1 = Math.max(0, Math.min(1, (expandScroll - 0.5) / 0.5));
    const chartT2 = Math.max(0, Math.min(1, (expandScroll - 0.625) / 0.375));
    const chartT3 = Math.max(0, Math.min(1, (expandScroll - 0.75) / 0.25));
    const chartTranslateX = lerp(-395, 0, chartT1);
    chartImg.style.left = (globeLeftX + 1) + 'px';
    chartImg.style.top = (p2d2Draw - CHART_H) + 'px';
    chartImg.style.transform = `translateX(${chartTranslateX}px)`;
    const chartImgLeft = globeLeftX + 1 + chartTranslateX;
    const chartLeftClip = Math.max(0, globeLeftX - chartImgLeft);
    const chartImgH = chartImg.offsetHeight || 250;
    const chartBottomClip = Math.max(0, chartImgH - CHART_H);
    const chartTop = p2d2Draw - CHART_H;
    const chartBottom = chartTop + chartImgH;
    const chartWipeClip = Math.max(0, chartBottom - exitDash3);
    const [mTop1, mBot1] = chartMask(chartTop, chartImgH);
    const chartClipBottom1 = Math.max(chartBottomClip, chartWipeClip, mBot1);
    chartImg.style.clipPath = `inset(${mTop1}px 0 ${chartClipBottom1}px ${chartLeftClip}px)`;
    chartImg.style.opacity = exit2T >= 1 ? 0 : 1;

    // ── Chart image 2: at second dashed line, 50px right ──────────────────────
    const chartImg2 = $('chart-img2');
    const chartTranslateX2 = lerp(-395, 0, chartT2);
    chartImg2.style.left = (globeLeftX + 66) + 'px';
    chartImg2.style.top = (p2d3Draw - CHART_H) + 'px';
    const chartDropY2 = exit2T * 40;
    chartImg2.style.transform = `translateX(${chartTranslateX2}px) translateY(${chartDropY2}px)`;
    const chartImg2Left = globeLeftX + 66 + chartTranslateX2;
    const chartLeftClip2 = Math.max(0, globeLeftX - chartImg2Left);
    const chartImgH2 = chartImg2.offsetHeight || 250;
    const chartBottomClip2 = Math.max(0, chartImgH2 - CHART_H);
    const chartTop2 = p2d3Draw - CHART_H + chartDropY2;
    const chartBottom2 = chartTop2 + chartImgH2;
    const chartWipeClip2 = Math.max(0, chartBottom2 - exitDash2);
    const [mTop2, mBot2] = chartMask(chartTop2, chartImgH2);
    const chartClipBottom2 = Math.max(chartBottomClip2, chartWipeClip2, mBot2);
    chartImg2.style.clipPath = `inset(${mTop2}px 0 ${chartClipBottom2}px ${chartLeftClip2}px)`;
    chartImg2.style.opacity = exit2T >= 1 ? 0 : 1;

    // ── Chart image 3: at third dashed line, 50px right ───────────────────────
    const chartImg3 = $('chart-img3');
    const chartTranslateX3 = lerp(-395, 0, chartT3);
    chartImg3.style.left = (globeLeftX + 141) + 'px';
    chartImg3.style.top = (p2h6Draw - CHART_H) + 'px';
    const chartDropY3 = exit2T * CHART_H;
    chartImg3.style.transform = `translateX(${chartTranslateX3}px) translateY(${chartDropY3}px)`;
    const chartImg3Left = globeLeftX + 141 + chartTranslateX3;
    const chartLeftClip3 = Math.max(0, globeLeftX - chartImg3Left);
    const chartImgH3 = chartImg3.offsetHeight || 250;
    const chartBottomClip3 = Math.max(0, chartImgH3 - CHART_H);
    const chartTop3 = p2h6Draw - CHART_H + chartDropY3;
    const chartBottom3 = chartTop3 + chartImgH3;
    const chartWipeClip3 = Math.max(0, chartBottom3 - exitDash1);
    const [mTop3, mBot3] = chartMask(chartTop3, chartImgH3);
    const chartClipBottom3 = Math.max(chartBottomClip3, chartWipeClip3, mBot3);
    chartImg3.style.clipPath = `inset(${mTop3}px 0 ${chartClipBottom3}px ${chartLeftClip3}px)`;
    chartImg3.style.opacity = exit2T >= 1 ? 0 : 1;
    if (exit2T >= 1) chartClips.forEach((v) => { if (v && !v.paused) v.pause(); }); // masked off for good: stop decoding

    // ── Username: slides in from left ─────────────────────────────────────────
    const usernameEl = $('username');
    const usernameT = Math.max(0, (expandScroll - 0.18) / 0.82);
    // 2026-11-05: the box rests on the left guide (it was 15px past it, so the
    // clip there hid its dashed left edge) and, at the end, sits fully above
    // the top dashed guide (that clip hid its dashed bottom edge)
    const usernameRestX = globeLeftX;
    const usernameX = lerp(-300, usernameRestX, usernameT);
    const usernameBaseY = lerp(rh3, p2h2, expandScroll) + 40; // 2026-11-05: up 60 (was + 100), clear of the hearts
    const uHScaled = usernameEl.offsetHeight * (expandScroll > 0 ? photoExpandExitV / expandScroll : 1);
    const usernameExitY = Math.min((p2h1 + photoTopDraw) / 2 + 36, photoBottomDraw - photoSpan * 0.75 - uHScaled - 3);
    const usernameY = lerp(usernameBaseY, usernameExitY, exitT);
    const usernameScale = expandScroll > 0 ? photoExpandExitV / expandScroll : 1;
    usernameEl.style.left = usernameX + 'px';
    usernameEl.style.top = usernameY + 'px';
    usernameEl.style.transform = `scale(${usernameScale})`;
    usernameEl.style.transformOrigin = 'left top';
    // the box is one copy of the scrolling name wide (+ its padding and dashed border)
    const uCopy = usernameEl.querySelector('.u-copy');
    if (uCopy) usernameEl.style.width = (uCopy.offsetWidth + 27.2 + 4) + 'px'; // + side padding (2 x 13.6) + border
    const uRawH = usernameEl.offsetHeight;
    const uRawW = usernameEl.offsetWidth;
    const uClipLeftPx = Math.max(0, (globeLeftX - usernameX) / usernameScale);
    const uClipBottomPx = Math.max(0, uRawH - (exitDash3 - usernameY) / usernameScale);
    usernameEl.style.clipPath = `inset(0px 0px ${uClipBottomPx}px ${uClipLeftPx}px)`;

    // Letter-by-letter fade up
    // (every copy of the marquee fades in together: letter i of each copy at once)
    const letters = usernameEl.querySelectorAll('span');
    const perCopy = uCopy ? uCopy.querySelectorAll('span').length : letters.length;
    const staggerWindow = 0.15; // portion of scroll each letter takes to fade in
    for (let i = 0; i < letters.length; i++) {
      const start = ((i % perCopy) / perCopy) * (1 - staggerWindow);
      const t = Math.max(0, Math.min(1, (usernameT - start) / staggerWindow));
      letters[i].style.opacity = t;
      letters[i].style.transform = `translateY(${(1 - t) * 6}px)`;
      letters[i].style.display = 'inline-block';
    }

    // ── Start boxes: visible at beginning, fade out with expand ──────────────
    const startBox1 = $('start-box1');
    const startBox2 = $('start-box2');
    startBox1.style.left = colX1 + 'px';
    startBox1.style.top = (rh3 + 387.5) + 'px';
    startBox1.style.width = Math.max(0, sbGuide1X - colX1) + 'px';
    // once collapsed they go: at zero width the CLICK strip's border still drew a dark tick on the guide
    startBox1.style.visibility = sbGuide1X - colX1 < 0.5 ? 'hidden' : '';
    const sb1TopClip = Math.max(0, sbGuide1Y - (rh3 + 387.5));
    startBox1.style.clipPath = `inset(${sb1TopClip}px 0 0 0)`;
    startBox2.style.left = sbGuide1X + 'px';
    startBox2.style.top = (rh3 + 387.5) + 'px'; // in the box's row, between the two guides
    startBox2.style.width = Math.max(0, sbGuide2X - sbGuide1X) + 'px';
    startBox2.style.visibility = sbGuide2X - sbGuide1X < 0.5 ? 'hidden' : '';
    const sb2TopClip = Math.max(0, sbGuide1Y - (rh3 + 387.5));
    startBox2.style.clipPath = `inset(${sb2TopClip}px 0 0 0)`;

  }

  raf = requestAnimationFrame(frame);

  // ─── Embedded spreadsheet ────────────────────────────────────────────────────
  (function() {
    const S_ROWS = 65;
    const S_COLS = 41;
    const sheetTable = $('sheetTable');
    const exitGreenEl = $('exit-green-fill');
    // locked to its frame: focusing a cell's editor could still scroll it, so it snaps back
    const sheetScrollEl = $('sheet-scroll');
    on(sheetScrollEl, 'scroll', () => { if (sheetScrollEl.scrollTop || sheetScrollEl.scrollLeft) { sheetScrollEl.scrollTop = 0; sheetScrollEl.scrollLeft = 0; } });

    function colLetter(c) {
      let s = '', n = c;
      while (n >= 0) { s = String.fromCharCode(65 + (n % 26)) + s; n = Math.floor(n / 26) - 1; }
      return s;
    }

    // Build table
    const thead = document.createElement('thead');
    const hRow = document.createElement('tr');
    const corner = document.createElement('th');
    corner.className = 'sh-corner';
    hRow.appendChild(corner);
    for (let c = 0; c < S_COLS; c++) {
      const th = document.createElement('th');
      th.className = 'sh-col';
      th.textContent = colLetter(c);
      th.dataset.col = c;
      hRow.appendChild(th);
    }
    thead.appendChild(hRow);
    sheetTable.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let r = 0; r < S_ROWS; r++) {
      const tr = document.createElement('tr');
      const rh = document.createElement('th');
      rh.className = 'sh-row';
      rh.textContent = r + 1;
      rh.dataset.row = r;
      tr.appendChild(rh);
      for (let c = 0; c < S_COLS; c++) {
        const td = document.createElement('td');
        td.className = 'sh-cell';
        td.dataset.row = r;
        td.dataset.col = c;
        const inp = document.createElement('input');
        inp.className = 'sh-editor';
        inp.type = 'text';
        inp.spellcheck = false;
        inp.maxLength = 5;
        td.appendChild(inp);
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    sheetTable.appendChild(tbody);

    // Selection state
    let dragging = false, ancR = 0, ancC = 0, curR = 0, curC = 0, editCell = null;
    let activeColor = '#73D961';
    let eraseMode = false;
    // 2026-11-05: half cells mode: a stroke paints only the half (left or
    // right) of each cell under the cursor; the halves live in data-hl / -hr
    let halfMode = false, curSide = '';
    const CELL_BG = '#0F4F32';
    const sideOf = (cell, e) => { const r = cell.getBoundingClientRect(); return (e.clientX - r.left) < r.width / 2 ? 'hl' : 'hr'; };
    const showHalves = (cell) => {
      const l = cell.dataset.hl || CELL_BG, r = cell.dataset.hr || CELL_BG;
      // 2026-11-05: the right half is an inset shadow over the left half's fill (not
      // a gradient): both fade smoothly, so cells don't flash as they animate
      cell.style.background = l;
      cell.style.boxShadow = l === r ? '' : `inset -15px 0 0 0 ${r}`;
      cell.style.borderColor = l === r ? l : '#1a6b45';
    };
    const clearHalves = (cell) => { delete cell.dataset.hl; delete cell.dataset.hr; };

    // Color swatch selection
    doc.querySelectorAll('.color-swatch').forEach(s => {
      s.addEventListener('click', () => {
        doc.querySelectorAll('.color-swatch').forEach(sw => sw.classList.remove('swatch-active'));
        s.classList.add('swatch-active');
        activeColor = s.dataset.color;
      });
    });

    function getC(r, c) { return sheetTable.querySelector(`td[data-row="${r}"][data-col="${c}"]`); }

    function clearSel() {
      sheetTable.querySelectorAll('.sh-hl,.sh-anchor').forEach(e => e.classList.remove('sh-hl','sh-anchor'));
      sheetTable.querySelectorAll('.sh-active').forEach(e => e.classList.remove('sh-active'));
    }

    function hlCell(cell, e) {
      if (!cell) return;
      if (halfMode && e) {
        if (!cell.classList.contains('sh-hl')) clearHalves(cell);
        else if (!cell.dataset.hl && !cell.dataset.hr) cell.dataset.hl = cell.dataset.hr = cell.style.background; // a whole fill: both halves
        cell.dataset[sideOf(cell, e)] = activeColor;
        cell.classList.add('sh-hl');
        showHalves(cell);
      } else {
        cell.classList.add('sh-hl');
        cell.dataset.hl = cell.dataset.hr = activeColor;
        cell.style.background = activeColor;
        cell.style.boxShadow = '';
        cell.style.borderColor = activeColor;
      }
      const c = cell.dataset.col, r = cell.dataset.row;
      const colH = sheetTable.querySelector(`th.sh-col[data-col="${c}"]`);
      const rowH = sheetTable.querySelector(`th.sh-row[data-row="${r}"]`);
      if (colH) colH.classList.add('sh-active');
      if (rowH) rowH.classList.add('sh-active');
    }

    function stopEdit() {
      if (!editCell) return;
      const inp = editCell.querySelector('.sh-editor');
      const val = inp.value;
      editCell.dataset.value = val;
      editCell.classList.remove('sh-editing');
      editCell.childNodes.forEach(n => { if (n.nodeType === 3) n.remove(); });
      if (val) editCell.insertBefore(document.createTextNode(val), editCell.firstChild);
      editCell = null;
    }

    function startEdit(cell) {
      stopEdit();
      editCell = cell;
      cell.classList.add('sh-editing');
      const inp = cell.querySelector('.sh-editor');
      inp.value = cell.dataset.value || '';
      inp.focus();
    }

    function eraseCell(cell) {
      if (!cell || !cell.classList.contains('sh-hl')) return;
      let opacity = parseFloat(cell.style.opacity);
      if (isNaN(opacity)) opacity = 1;
      opacity = Math.max(0, opacity - 0.2);
      cell.style.opacity = opacity;
      if (opacity <= 0) {
        cell.style.opacity = '';
        cell.style.background = '';
        cell.style.boxShadow = '';
        cell.style.borderColor = '';
        cell.classList.remove('sh-hl', 'sh-anchor');
        clearHalves(cell);
        cell.dataset.value = '';
        cell.childNodes.forEach(n => { if (n.nodeType === 3) n.remove(); });
      }
    }

    function deactivateEraseMode() {
      eraseMode = false;
      const eraseBtn = $('click-label7');
      eraseBtn.classList.remove('erase-active');
    }

    // Mouse events on table — each cell highlights independently
    sheetTable.addEventListener('mousedown', e => {
      const td = e.target.closest('td.sh-cell');
      if (!td) return;
      if (eraseMode) {
        dragging = true;
        eraseCell(td);
        e.preventDefault();
        return;
      }
      stopEdit();
      dragging = true;
      ancR = +td.dataset.row; ancC = +td.dataset.col;
      curR = ancR; curC = ancC;
      td.classList.add('sh-anchor');
      curSide = halfMode ? sideOf(td, e) : '';
      hlCell(td, e);
      e.preventDefault();
    });

    sheetTable.addEventListener('mousemove', e => {
      if (!dragging) return;
      const td = e.target.closest('td.sh-cell');
      if (!td) return;
      if (eraseMode) {
        eraseCell(td);
        return;
      }
      const r = +td.dataset.row, c = +td.dataset.col;
      const side = halfMode ? sideOf(td, e) : '';
      if (r !== curR || c !== curC || side !== curSide) {
        curR = r; curC = c; curSide = side;
        hlCell(td, e);
      }
    });

    on(window, 'mouseup', () => { dragging = false; });

    sheetTable.addEventListener('dblclick', e => {
      const td = e.target.closest('td.sh-cell');
      if (td) startEdit(td);
    });

    // Keyboard
    sheetTable.addEventListener('keydown', e => {
      if (editCell) {
        if (e.key === 'Enter') { stopEdit(); if (ancR < S_ROWS-1) { ancR++; curR=ancR; hlRange(ancR,ancC,ancR,ancC); } e.preventDefault(); }
        else if (e.key === 'Escape') { editCell.classList.remove('sh-editing'); editCell = null; e.preventDefault(); }
        else if (e.key === 'Tab') { stopEdit(); if(ancC<S_COLS-1){ancC++;curC=ancC;hlRange(ancR,ancC,ancR,ancC);} e.preventDefault(); }
        return;
      }
      if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Tab','Enter'].includes(e.key)) {
        e.preventDefault();
        if (e.key==='ArrowUp') ancR=Math.max(0,ancR-1);
        else if (e.key==='ArrowDown'||e.key==='Enter') ancR=Math.min(S_ROWS-1,ancR+1);
        else if (e.key==='ArrowLeft') ancC=Math.max(0,ancC-1);
        else if (e.key==='ArrowRight'||e.key==='Tab') ancC=Math.min(S_COLS-1,ancC+1);
        curR=ancR; curC=ancC;
        hlRange(ancR,ancC,ancR,ancC);
        const cell = getC(ancR,ancC);
        // (2026-11-05: no scrollIntoView: the sheet is locked to its frame)
      }
      if (e.key.length===1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        const cell = getC(ancR,ancC);
        if (cell) { cell.dataset.value=''; cell.childNodes.forEach(n=>{if(n.nodeType===3)n.remove();}); startEdit(cell); cell.querySelector('.sh-editor').value=e.key; }
      }
      if (e.key==='Delete'||e.key==='Backspace') {
        const minR=Math.min(ancR,curR),maxR=Math.max(ancR,curR),minC=Math.min(ancC,curC),maxC=Math.max(ancC,curC);
        for(let r=minR;r<=maxR;r++) for(let c=minC;c<=maxC;c++){const cell=getC(r,c);if(cell){cell.dataset.value='';cell.childNodes.forEach(n=>{if(n.nodeType===3)n.remove();});}}
        e.preventDefault();
      }
    });

    // Activate sheet once green fill is visible
    let sheetActive = false;
    function checkSheet() {
      const w = parseFloat(exitGreenEl.style.width) || 0;
      const h = parseFloat(exitGreenEl.style.height) || 0;
      if (w > 50 && h > 50 && !sheetActive) {
        exitGreenEl.classList.add('active-sheet');
        sheetActive = true;
      } else if ((w <= 50 || h <= 50) && sheetActive) {
        exitGreenEl.classList.remove('active-sheet');
        sheetActive = false;
      }
      if (alive) sheetRaf = requestAnimationFrame(checkSheet);
    }
    checkSheet();

    const artComments = [
      'Hate how good this is.',
      'Annoyingly strong.',
      'This slaps. Unfortunately.',
      "You didn't have to go this hard.",
      'Rude amount of talent here.',
      'Disgusting. Keep it.',
      'This is stupid good.',
      'Unfairly effective.',
      "It's almost irritating how solid this is.",
      'Painfully clean.',
      'This is the keeper. Stop touching it.',
      'Brutal in the best way.',
      "You're making the rest of us look bad.",
      'This works. Like, really works.',
      'Offensive levels of polish.',
      'Nasty. In a good way.',
      'Gross. Frame it.',
      "Don't improve it. You'll ruin it.",
      'Too good to be accidental.',
      "I'm mad at how right this feels.",
      'Suspiciously strong choice.',
      'Overqualified for this brief.',
      'This is the one. End of discussion.',
      'You nailed it. I hate that you nailed it.',
      'Keep. Ship. Walk away.'
    ];
    let commentIndex = Math.floor(Math.random() * artComments.length);

    // Save button captures excel grid art as thumbnail (max 20)
    $('click-label2').addEventListener('click', () => {
      const thumbContainer = $('saved-thumbs');
      if (thumbContainer.querySelectorAll('.thumb-wrap').length >= 20) return;
      const cells = sheetTable.querySelectorAll('td.sh-cell');
      if (!cells.length) return;
      const cols = S_COLS;
      const rows = S_ROWS;
      const dpr = 3;
      const cellW = 40 * dpr, cellH = 20 * dpr, hdrW = 34 * dpr, hdrH = 20 * dpr;
      const cw = hdrW + cols * cellW;
      const ch = hdrH + rows * cellH;
      const canvas = document.createElement('canvas');
      canvas.width = cw;
      canvas.height = ch;
      canvas.style.width = '100px';
      canvas.style.height = '100px';
      const ctx = canvas.getContext('2d');
      // Fill background
      ctx.fillStyle = '#0F4F32';
      ctx.fillRect(0, 0, cw, ch);
      // Draw corner header
      ctx.fillStyle = '#0a3d26';
      ctx.fillRect(0, 0, hdrW, hdrH);
      // Draw column headers
      ctx.font = `600 ${10 * dpr}px Segoe UI, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      for (let c = 0; c < cols; c++) {
        const x = hdrW + c * cellW;
        ctx.fillStyle = '#0a3d26';
        ctx.fillRect(x, 0, cellW, hdrH);
        ctx.strokeStyle = '#1a6b45';
        ctx.lineWidth = dpr;
        ctx.strokeRect(x, 0, cellW, hdrH);
        ctx.fillStyle = '#73D961';
        let letter = '', n = c;
        while (n >= 0) { letter = String.fromCharCode(65 + (n % 26)) + letter; n = Math.floor(n / 26) - 1; }
        ctx.fillText(letter, x + cellW / 2, hdrH / 2);
      }
      // Draw row headers
      for (let r = 0; r < rows; r++) {
        const y = hdrH + r * cellH;
        ctx.fillStyle = '#0a3d26';
        ctx.fillRect(0, y, hdrW, cellH);
        ctx.strokeStyle = '#1a6b45';
        ctx.lineWidth = dpr;
        ctx.strokeRect(0, y, hdrW, cellH);
        ctx.fillStyle = '#73D961';
        ctx.fillText(String(r + 1), hdrW / 2, y + cellH / 2);
      }
      // Draw all cells with their colors, text, and highlights
      cells.forEach(c => {
        const r = +c.dataset.row;
        const col = +c.dataset.col;
        const x = hdrW + col * cellW;
        const y = hdrH + r * cellH;
        if (c.classList.contains('sh-hl') && (c.dataset.hl !== undefined || c.dataset.hr !== undefined)) {
          ctx.fillStyle = c.dataset.hl || '#0F4F32';
          ctx.fillRect(x, y, cellW / 2, cellH);
          ctx.fillStyle = c.dataset.hr || '#0F4F32';
          ctx.fillRect(x + cellW / 2, y, cellW - cellW / 2, cellH);
        } else {
          ctx.fillStyle = c.classList.contains('sh-hl') ? (c.style.background || '#73D961') : '#0F4F32';
          ctx.fillRect(x, y, cellW, cellH);
        }
        // Cell border — highlighted cells get their color border
        if (c.classList.contains('sh-hl') && c.style.borderColor) {
          ctx.strokeStyle = c.style.borderColor;
        } else {
          ctx.strokeStyle = '#1a6b45';
        }
        ctx.lineWidth = dpr;
        ctx.strokeRect(x, y, cellW, cellH);
        // Draw anchor/editing outline
        if (c.classList.contains('sh-anchor') || c.classList.contains('sh-editing')) {
          ctx.strokeStyle = '#73D961';
          ctx.lineWidth = 2 * dpr;
          ctx.strokeRect(x + dpr, y + dpr, cellW - 2 * dpr, cellH - 2 * dpr);
        }
        // Draw cell text
        const val = c.dataset.value || '';
        if (val) {
          ctx.fillStyle = '#fff';
          ctx.font = `${10 * dpr}px Segoe UI, sans-serif`;
          ctx.textAlign = 'left';
          ctx.textBaseline = 'middle';
          ctx.fillText(val, x + 2 * dpr, y + cellH / 2, cellW - 4 * dpr);
        }
      });
      // Draw active column/row highlights
      sheetTable.querySelectorAll('th.sh-col.sh-active').forEach(th => {
        const ci = +th.dataset.col;
        const x = hdrW + ci * cellW;
        ctx.fillStyle = '#135a38';
        ctx.fillRect(x, 0, cellW, hdrH);
        ctx.strokeStyle = '#1a6b45';
        ctx.lineWidth = dpr;
        ctx.strokeRect(x, 0, cellW, hdrH);
        ctx.fillStyle = '#fff';
        ctx.font = `600 ${10 * dpr}px Segoe UI, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        let letter = '', n = ci;
        while (n >= 0) { letter = String.fromCharCode(65 + (n % 26)) + letter; n = Math.floor(n / 26) - 1; }
        ctx.fillText(letter, x + cellW / 2, hdrH / 2);
      });
      sheetTable.querySelectorAll('th.sh-row.sh-active').forEach(th => {
        const ri = +th.dataset.row;
        const y = hdrH + ri * cellH;
        ctx.fillStyle = '#135a38';
        ctx.fillRect(0, y, hdrW, cellH);
        ctx.strokeStyle = '#1a6b45';
        ctx.lineWidth = dpr;
        ctx.strokeRect(0, y, hdrW, cellH);
        ctx.fillStyle = '#fff';
        ctx.font = `600 ${10 * dpr}px Segoe UI, sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(ri + 1), hdrW / 2, y + cellH / 2);
      });
      // Assign a cycling random comment
      canvas._comment = artComments[commentIndex];
      commentIndex = (commentIndex + 1) % artComments.length;

      const wrap = document.createElement('div');
      wrap.className = 'thumb-wrap';
      wrap.appendChild(canvas);

      // Click thumbnail to select and display on grid, stacking overlays
      wrap.addEventListener('click', () => {
        const wasSelected = wrap.classList.contains('thumb-selected');
        if (wasSelected) {
          wrap.classList.remove('thumb-selected');
          if (wrap._overlay) {
            const ol = wrap._overlay;
            if (ol._collapse) ol._collapse(); else ol.style.opacity = '0';
            setTimeout(() => { if (ol.parentNode) ol.parentNode.removeChild(ol); }, 500);
            wrap._overlay = null;
          }
          return;
        }
        wrap.classList.add('thumb-selected');

        // 2026-11-05: it opens centred on the screen (the visible window), over
        // the whole page: its layer (#thumb-overlays) sits on the page now, not
        // in the sheet, which clipped it. As large as fits 80% of the window's
        // width and 80% of its height, at the sheet's proportions.
        const container = $('thumb-overlays');
        const greenEl = $('exit-green-fill');
        const aspect = (parseFloat(greenEl.style.width) || 4) / (parseFloat(greenEl.style.height) || 3);
        const vw = window.innerWidth, vh = window.innerHeight;
        const ow = Math.min(vw * 0.8, vh * 0.8 * aspect);
        const oh = ow / aspect;
        const lRect = container.getBoundingClientRect(); // the layer's place on screen
        const baseX = (vw - ow) / 2 - lRect.left;
        const baseY = (vh - oh) / 2 - lRect.top;

        // Count currently selected thumbnails for offset
        const selected = doc.querySelectorAll('.thumb-wrap.thumb-selected').length - 1;
        const offsetX = selected * 20;
        const offsetY = selected * 20;

        const frame = document.createElement('div');
        frame.className = 'overlay-frame';
        frame.style.width = ow + 'px';
        frame.style.height = oh + 'px';
        frame.style.left = (baseX + offsetX) + 'px';
        frame.style.top = (baseY + offsetY) + 'px';
        frame.style.opacity = '0';
        frame.style.transform = 'scale(0.1)';

        const overlay = document.createElement('canvas');
        overlay.width = canvas.width;
        overlay.height = canvas.height;
        const octx = overlay.getContext('2d');
        octx.drawImage(canvas, 0, 0);

        const closeBtn = document.createElement('div');
        closeBtn.className = 'overlay-close';
        closeBtn.textContent = '\u2715';
        closeBtn.addEventListener('click', () => {
          wrap.classList.remove('thumb-selected');
          if (frame._collapse) frame._collapse(); else frame.style.opacity = '0';
          setTimeout(() => { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 500);
          wrap._overlay = null;
        });

        const expandBtn = document.createElement('div');
        expandBtn.className = 'overlay-btn overlay-expand';
        expandBtn.innerHTML = '&#x2197;';
        expandBtn.addEventListener('click', () => {
          const dl = document.createElement('a');
          dl.download = 'excel-art.png';
          dl.href = canvas.toDataURL('image/png');
          dl.click();
        });

        const trashBtn = document.createElement('div');
        trashBtn.className = 'overlay-btn overlay-trash';
        trashBtn.innerHTML = '&#x1F5D1;';
        trashBtn.addEventListener('click', () => {
          wrap.classList.remove('thumb-selected');
          frame.style.opacity = '0';
          setTimeout(() => { if (frame.parentNode) frame.parentNode.removeChild(frame); }, 400);
          wrap._overlay = null;
          // Remove the thumbnail itself
          setTimeout(() => { if (wrap.parentNode) wrap.parentNode.removeChild(wrap); }, 400);
        });

        frame.appendChild(overlay);
        const commentEl = document.createElement('div');
        commentEl.className = 'overlay-comment';
        commentEl.textContent = canvas._comment;

        frame.appendChild(closeBtn);
        frame.appendChild(commentEl);
        frame.appendChild(expandBtn);
        frame.appendChild(trashBtn);
        container.appendChild(frame);
        wrap._overlay = frame;

        // Animate in: it expands out of its thumbnail (scaled from the thumb's
        // centre), committing the small start first so the transition always runs
        const gRect = container.getBoundingClientRect(), tRect = wrap.getBoundingClientRect();
        const ox = tRect.left + tRect.width / 2 - (gRect.left + baseX + offsetX);
        const oy = tRect.top + tRect.height / 2 - (gRect.top + baseY + offsetY);
        frame.style.transformOrigin = ox + 'px ' + oy + 'px';
        frame.style.transform = 'scale(0.05)';
        void frame.offsetWidth;
        frame.style.transition = 'opacity 0.35s ease, transform 0.6s cubic-bezier(0.22, 1, 0.36, 1)';
        frame.style.opacity = '1';
        frame.style.transform = 'scale(1)';
        setTimeout(() => { frame.style.transition = ''; frame.style.transformOrigin = ''; }, 650);
        // closing shrinks it back into the thumbnail
        frame._collapse = () => {
          frame.style.transformOrigin = ox + 'px ' + oy + 'px';
          frame.style.transition = 'opacity 0.35s ease 0.1s, transform 0.4s cubic-bezier(0.55, 0, 1, 0.45)';
          frame.style.transform = 'scale(0.05)';
          frame.style.opacity = '0';
        };
      });

      $('saved-thumbs').appendChild(wrap);
    });

    // Draggable overlay frames — all connected, drift back on release
    (function() {
      let dragFrame = null, startX = 0, startY = 0;
      const origPositions = new Map();

      on(doc, 'mousedown', (e) => {
        const frame = e.target.closest('.overlay-frame');
        if (!frame || e.target.closest('.overlay-close') || e.target.closest('.overlay-btn')) return;
        dragFrame = frame;
        startX = e.clientX;
        startY = e.clientY;
        // Store original positions of all frames
        const frames = doc.querySelectorAll('.overlay-frame');
        frames.forEach(f => {
          f.style.transition = 'none';
          origPositions.set(f, {
            left: parseFloat(f.style.left) || 0,
            top: parseFloat(f.style.top) || 0
          });
        });
        frame.style.cursor = 'grabbing';
        e.preventDefault();
      });

      on(window, 'mousemove', (e) => {
        if (!dragFrame) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        const container = $('thumb-overlays');
        const frames = Array.from(container.querySelectorAll('.overlay-frame'));
        const dragIdx = frames.indexOf(dragFrame);
        const total = frames.length;

        frames.forEach((f, i) => {
          const orig = origPositions.get(f);
          if (!orig) return;
          let factor;
          if (f === dragFrame) {
            factor = 1;
          } else {
            // Closer layers move more, further layers move less
            const dist = Math.abs(i - dragIdx);
            factor = Math.max(0.1, 1 - dist * 0.25);
          }
          f.style.left = (orig.left + dx * factor) + 'px';
          f.style.top = (orig.top + dy * factor) + 'px';
        });
      });

      on(window, 'mouseup', () => {
        if (!dragFrame) return;
        dragFrame.style.cursor = '';
        // Drift all frames back to original positions
        const frames = doc.querySelectorAll('.overlay-frame');
        frames.forEach(f => {
          const orig = origPositions.get(f);
          if (!orig) return;
          f.style.transition = 'left 0.8s cubic-bezier(0.16, 1, 0.3, 1), top 0.8s cubic-bezier(0.16, 1, 0.3, 1)';
          f.style.left = orig.left + 'px';
          f.style.top = orig.top + 'px';
          setTimeout(() => { f.style.transition = ''; }, 800);
        });
        dragFrame = null;
        origPositions.clear();
      });
    })();

    // Erase button clears all highlighted cells with random staggered fade
    // Erase toggle button
    $('click-label7').addEventListener('click', () => {
      if (eraseMode) {
        deactivateEraseMode();
      } else {
        eraseMode = true;
        $('click-label7').classList.add('erase-active');
      }
    });

    $('click-label8').addEventListener('click', () => {
      halfMode = !halfMode;
      $('click-label8').classList.toggle('half-active', halfMode);
    });

    // Deactivate erase mode when other buttons are clicked
    ['click-label4','click-label1','click-label5','click-label6','click-label2','click-label8'].forEach(id => {
      $(id).addEventListener('click', () => { deactivateEraseMode(); });
    });

    // the pending per-cell steps of an erase or a paint, so a newer one can
    // cancel the older (closing the X mid-erase, or opening it mid-paint)
    let artTimers = [];
    const clearArtTimers = () => { artTimers.forEach(clearTimeout); artTimers = []; };

    const eraseAll = () => {
      // Temporarily switch to auto layout to get current widths, then animate back
      const cols = sheetTable.querySelectorAll('th.sh-col');
      const currentWidths = Array.from(cols).map(th => th.offsetWidth);

      clearArtTimers(); // a paint still fading in stops where it is
      const highlighted = sheetTable.querySelectorAll('td.sh-cell.sh-hl');
      const fadeDuration = 1.2;
      highlighted.forEach((cell) => {
        const delay = Math.random() * 1500;
        artTimers.push(setTimeout(() => {
          cell.style.transition = `background ${fadeDuration}s ease, box-shadow ${fadeDuration}s ease, border-color ${fadeDuration}s ease, opacity ${fadeDuration}s ease`;
          cell.style.background = '';
          // the right half (an inset shadow) keeps its full width and only fades
          // to the sheet's colour: animating it to none would shrink it, showing
          // the left half's colour through it (a flash)
          if (cell.style.boxShadow) cell.style.boxShadow = 'inset -15px 0 0 0 #0F4F32';
          cell.style.borderColor = '';
          cell.style.color = '';
          cell.style.textAlign = '';
          cell.style.padding = '';
          cell.style.textIndent = '';
          cell.style.letterSpacing = '';
          cell.style.textOverflow = '';
          cell.classList.remove('sh-hl', 'sh-anchor');
          clearHalves(cell);
          cell.dataset.value = '';
          cell.childNodes.forEach(n => { if (n.nodeType === 3) n.remove(); });
          const op = cell._artOp = (cell._artOp || 0) + 1;
          setTimeout(() => {
            if (cell._artOp !== op) return; // a newer paint / erase owns the cell now
            cell.style.transition = '';
            if (!cell.classList.contains('sh-hl')) cell.style.boxShadow = '';
          }, fadeDuration * 1000);
        }, delay));
      });
      sheetTable.querySelectorAll('.sh-active').forEach(e => e.classList.remove('sh-active'));

      // After all cells cleared, animate columns back to default width
      const maxDelay = 1500 + fadeDuration * 1000;
      cols.forEach((th, i) => {
        if (currentWidths[i] > 30) {
          th.style.width = currentWidths[i] + 'px';
          th.style.minWidth = currentWidths[i] + 'px';
          setTimeout(() => {
            th.style.transition = 'width 0.8s ease-out, min-width 0.8s ease-out';
            th.style.width = '30px';
            th.style.minWidth = '30px';
            setTimeout(() => {
              th.style.transition = '';
              th.style.width = '';
              th.style.minWidth = '';
            }, 800);
          }, maxDelay);
        }
      });
    };
    $('click-label1').addEventListener('click', eraseAll);
    sheetEraseAll = eraseAll;

    // Paint the starting art (SHEET_ART): each cell split in two halves (a hard
    // two-stop gradient), each half its own swatch fill and digit, the digits
    // spaced to sit centred in their halves (figure spaces keep an empty half)
    // 2026-11-05: animated = erase all in reverse (each cell fades its fill and
    // digits on after a random delay up to 1.5s, over 1.2s): the horse comes
    // back when the X closes the tools
    const SHEET_BG = '#0F4F32';
    const paintArt = (animated) => {
    clearArtTimers();
    const fadeDuration = 1.2;
    SHEET_ART.forEach((line, r) => {
      for (let c = 0; c * 4 < line.length; c++) {
        const L = line.substr(c * 4, 2), R = line.substr(c * 4 + 2, 2);
        if (L === '..' && R === '..') continue;
        const cell = getC(r + SHEET_ART_AT.row, c + SHEET_ART_AT.col);
        if (!cell) continue;
        const apply = () => {
        const op = cell._artOp = (cell._artOp || 0) + 1;
        if (animated) {
          // the right half starts full width in the cell's current colour (no
          // transition), so only its colour animates: growing it from none
          // showed the left half's colour through it (a flash)
          cell.style.transition = '';
          if (!cell.style.boxShadow) cell.style.boxShadow = 'inset -15px 0 0 0 ' + getComputedStyle(cell).backgroundColor;
          void cell.offsetWidth; // commit that start before the transition
          cell.style.transition = `background ${fadeDuration}s ease, box-shadow ${fadeDuration}s ease, border-color ${fadeDuration}s ease, opacity ${fadeDuration}s ease`;
        }
        cell.childNodes.forEach(n => { if (n.nodeType === 3) n.remove(); }); // whatever was typed there
        const fl = L === '..' ? SHEET_BG : SHEET_ART_FILLS[L[0]];
        const fr = R === '..' ? SHEET_BG : SHEET_ART_FILLS[R[0]];
        const light = (code) => code[0] === 'a' || code[0] === 'b';
        cell.classList.add('sh-hl');
        cell.dataset.hl = L === '..' ? '' : fl;
        cell.dataset.hr = R === '..' ? '' : fr;
        cell.style.background = fl; // the left half; the right half an inset shadow (fades smoothly, no flash)
        cell.style.boxShadow = `inset -15px 0 0 0 ${fr}`; // (also when both halves match: same colour, and it keeps its width)
        cell.style.borderColor = '#1a6b45'; // the sheet's own grid lines, over the art as in the reference
        // one type colour per cell: dark when both filled halves are light
        const codes = [L, R].filter(x => x !== '..');
        cell.style.color = codes.every(light) ? '#0F4F32' : '#d0f0d0';
        cell.style.padding = '0';
        cell.style.textAlign = 'left';
        cell.style.textIndent = 'calc(7.5px - 0.28em)'; // half a 30px cell: digit centres at 7.5 and 22.5
        cell.style.letterSpacing = 'calc(15px - 0.56em)';
        cell.style.textOverflow = 'clip'; // the spacing after the 2nd digit overflows: no ellipsis
        const txt = (L === '..' ? ' ' : L[1]) + (R === '..' ? ' ' : R[1]);
        cell.dataset.value = txt;
        cell.insertBefore(document.createTextNode(txt), cell.firstChild);
        if (animated) setTimeout(() => { if (cell._artOp === op) cell.style.transition = ''; }, fadeDuration * 1000);
        };
        if (animated) artTimers.push(setTimeout(apply, Math.random() * 1500));
        else apply();
      }
    });
    };
    paintArt(false);
    sheetPaintArt = () => paintArt(true);
    sheetArtShown = true;
  })();
}

function unmount() {
  alive = false;
  cancelAnimationFrame(raf);
  cancelAnimationFrame(sheetRaf);
  raf = sheetRaf = 0;
  for (const off of listeners) off();
  listeners = [];
}

window.ExcelArtSketch = { mount, unmount, asset };
})();
