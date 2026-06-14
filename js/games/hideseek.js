/* Cinnamoroll Mansion — Hide & Seek (the mansion garden) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  /* ---------------- static garden layout ---------------- */
  const BOUNDS = { x1: 58, y1: 150, x2: 902, y2: 535 };
  const CINNA = { x: 560, y: 586 };          // Cinnamoroll cheering at the gate
  const SPAWN = { x: 480, y: 470 };

  const TREES = [
    { x: 140, y: 235 }, { x: 350, y: 170 }, { x: 845, y: 335 }, { x: 165, y: 490 }
  ];
  const BUSHES = [
    { x: 590, y: 210 }, { x: 255, y: 335 }, { x: 690, y: 470 }, { x: 390, y: 465 }
  ];
  const HEDGE = { x: 565, y: 329, w: 150 };           // base line at y ~355
  const SHED = { x: 715, y: 120, w: 150, h: 92 };     // walls; base at 212
  const FOUNTAIN = { x: 480, y: 295 };
  const BED = { x: 480, y: 200 };                     // flower bed (decor + solid)

  const SOLIDS = [
    { x: 712, y: 150, w: 158, h: 66 },   // shed
    { x: 408, y: 264, w: 144, h: 62 },   // fountain
    { x: 565, y: 332, w: 150, h: 24 },   // hedge
    { x: 430, y: 186, w: 100, h: 28 }    // flower bed
  ];
  for (const t of TREES) SOLIDS.push({ x: t.x - 13, y: t.y - 26, w: 26, h: 26 });
  for (const b of BUSHES) SOLIDS.push({ x: b.x - 42, y: b.y - 26, w: 84, h: 28 });

  // 10 hiding spots. px/py: where you peek + where the friend pops out.
  // pkx/pky: where tiny ears peek out. sy: draw-order y for the ears.
  const SPOTS = [
    { px: 590, py: 224, pkx: 590, pky: 150, sy: 211 },   // bush NE
    { px: 255, py: 349, pkx: 255, pky: 275, sy: 336 },   // bush W
    { px: 690, py: 484, pkx: 690, pky: 410, sy: 471 },   // bush SE
    { px: 390, py: 479, pkx: 390, pky: 405, sy: 466 },   // bush S
    { px: 152, py: 250, pkx: 156, pky: 197, sy: 236 },   // tree NW
    { px: 362, py: 185, pkx: 366, pky: 132, sy: 171 },   // tree N
    { px: 833, py: 350, pkx: 849, pky: 297, sy: 336 },   // tree E
    { px: 698, py: 215, pkx: 709, pky: 168, sy: 215 },   // shed
    { px: 480, py: 352, pkx: 516, pky: 258, sy: 333 },   // fountain
    { px: 640, py: 369, pkx: 640, pky: 318, sy: 358 }    // hedge
  ];

  // deterministic little grass tufts / daisies so they don't flicker
  const DECOR = [];
  for (let i = 0; i < 26; i++) {
    const x = 80 + ((i * 167) % 800);
    const y = 152 + ((i * 233) % 368);
    if (Math.abs(x - 480) < 34 && y > 350) continue;   // keep the path clear
    DECOR.push({ x: x, y: y, kind: i % 4 });
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function blocked(px, py) {
    if (px < BOUNDS.x1 || px > BOUNDS.x2 || py < BOUNDS.y1 || py > BOUNDS.y2) return true;
    const bx1 = px - 10, bx2 = px + 10, by1 = py - 8, by2 = py + 2;
    for (const s of SOLIDS) {
      if (bx2 > s.x && bx1 < s.x + s.w && by2 > s.y && by1 < s.y + s.h) return true;
    }
    return false;
  }

  /* ---------------- garden art ---------------- */
  function drawGround(g) {
    const gr = g.createLinearGradient(0, 0, 0, CM.H);
    gr.addColorStop(0, '#cdeebb');
    gr.addColorStop(1, '#a9dda4');
    g.fillStyle = gr;
    g.fillRect(-12, -12, CM.W + 24, CM.H + 24);
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (let y = 130; y < CM.H + 20; y += 76) g.fillRect(-12, y, CM.W + 24, 38);
    // stone path: gate up to the fountain
    for (let i = 0; i < 6; i++) {
      D.ellipse(g, 480 + (i % 2 ? 9 : -9), 540 - i * 34, 22, 12, '#ece5d2', '#d8cfb6', 2);
    }
    // tufts & daisies
    for (const d of DECOR) {
      if (d.kind < 2) {
        g.strokeStyle = '#8fce9d';
        g.lineWidth = 2;
        g.lineCap = 'round';
        g.beginPath();
        g.moveTo(d.x - 3, d.y); g.lineTo(d.x - 5, d.y - 7);
        g.moveTo(d.x, d.y); g.lineTo(d.x, d.y - 9);
        g.moveTo(d.x + 3, d.y); g.lineTo(d.x + 5, d.y - 7);
        g.stroke();
      } else if (d.kind === 2) {
        for (let k = 0; k < 5; k++) {
          const a = (k / 5) * Math.PI * 2;
          D.circle(g, d.x + Math.cos(a) * 3.4, d.y + Math.sin(a) * 3.4, 2.6, '#ffffff');
        }
        D.circle(g, d.x, d.y, 2.2, '#f6d44d');
      } else {
        D.circle(g, d.x, d.y, 3, '#ffd9e8');
        D.circle(g, d.x, d.y, 1.4, '#ff9ec7');
      }
    }
    // hedge walls: top + sides
    g.fillStyle = '#7cc98f';
    g.fillRect(-12, -12, CM.W + 24, 122);
    g.fillRect(-12, 90, 58, CM.H - 78 + 24);
    g.fillRect(CM.W - 46, 90, 58, CM.H - 78 + 24);
    for (let x = 0; x <= CM.W; x += 40) D.circle(g, x + 20, 108, 22, '#7cc98f');
    for (let y = 120; y < CM.H; y += 44) {
      D.circle(g, 44, y, 18, '#7cc98f');
      D.circle(g, CM.W - 44, y, 18, '#7cc98f');
    }
    // soft highlights + flowers on the walls
    for (let x = 50; x < CM.W; x += 130) {
      D.circle(g, x, 96, 16, '#92d6a2');
      D.circle(g, x + 40, 60, 4, x % 260 < 130 ? '#ffd9e8' : '#ffe9a8');
    }
  }

  function drawBush(g, b, t) {
    D.shadow(g, b.x, b.y, 44);
    const sw = Math.sin(t * 1.1 + b.x * 0.05) * 1.5;
    D.ellipse(g, b.x + sw, b.y - 24, 46, 30, '#74c489');
    D.circle(g, b.x - 26 + sw, b.y - 34, 22, '#74c489');
    D.circle(g, b.x + 26 + sw, b.y - 34, 22, '#74c489');
    D.circle(g, b.x + sw, b.y - 44, 24, '#74c489');
    D.circle(g, b.x - 12 + sw, b.y - 48, 11, '#92d6a2');
    D.circle(g, b.x + 16 + sw, b.y - 40, 9, '#92d6a2');
    D.circle(g, b.x - 30 + sw, b.y - 26, 4, '#ff9ec7');
    D.circle(g, b.x + 30 + sw, b.y - 30, 4, '#ffe9a8');
    D.circle(g, b.x + 4 + sw, b.y - 58, 4, '#ffd9e8');
  }

  function drawTree(g, tr, t) {
    D.shadow(g, tr.x, tr.y, 36);
    D.rr(g, tr.x - 9, tr.y - 48, 18, 48, 7, '#b97a4e', '#96603a', 2);
    const sw = Math.sin(t * 0.8 + tr.x) * 2;
    D.circle(g, tr.x - 24 + sw, tr.y - 62, 27, '#74c489');
    D.circle(g, tr.x + 24 + sw, tr.y - 62, 27, '#74c489');
    D.circle(g, tr.x + sw, tr.y - 82, 38, '#74c489');
    D.circle(g, tr.x - 13 + sw, tr.y - 88, 10, '#92d6a2');
    D.circle(g, tr.x + 17 + sw, tr.y - 94, 7, '#92d6a2');
    D.circle(g, tr.x - 22 + sw, tr.y - 70, 4, '#ffd9e8');
    D.circle(g, tr.x + 27 + sw, tr.y - 76, 4, '#ffd9e8');
    D.circle(g, tr.x + 3 + sw, tr.y - 58, 4, '#ffd9e8');
  }

  function drawShed(g) {
    const s = SHED;
    D.ellipse(g, s.x + s.w / 2, s.y + s.h + 4, s.w * 0.55, 15, 'rgba(60,40,60,0.10)');
    D.rr(g, s.x, s.y, s.w, s.h, 8, '#f2dcb8', '#d9bd92', 3);
    g.fillStyle = '#f0a8c4';
    g.strokeStyle = '#d886a8';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(s.x - 14, s.y + 6);
    g.lineTo(s.x + s.w / 2, s.y - 36);
    g.lineTo(s.x + s.w + 14, s.y + 6);
    g.closePath();
    g.fill();
    g.stroke();
    D.rr(g, s.x + s.w / 2 - 20, s.y + 32, 40, 60, 9, '#b97a4e', '#96603a', 2.5);
    D.circle(g, s.x + s.w / 2 + 11, s.y + 63, 3, '#f6cf5a');
    D.circle(g, s.x + 32, s.y + 46, 14, '#cdeaff', '#ffffff', 4);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(s.x + 32, s.y + 34); g.lineTo(s.x + 32, s.y + 58);
    g.moveTo(s.x + 20, s.y + 46); g.lineTo(s.x + 44, s.y + 46);
    g.stroke();
  }

  function drawFountain(g, t) {
    const f = FOUNTAIN;
    D.ellipse(g, f.x, f.y + 36, 88, 24, 'rgba(60,40,60,0.10)');
    D.ellipse(g, f.x, f.y + 8, 84, 44, '#ccd5e3', '#abb8ce', 3);
    D.ellipse(g, f.x, f.y + 2, 70, 34, '#9ed8f8', '#7db9dd', 2);
    for (let i = 0; i < 2; i++) {
      const rp = (t * 0.5 + i * 0.5) % 1;
      g.globalAlpha = 0.5 * (1 - rp);
      D.ellipse(g, f.x, f.y + 2, 18 + rp * 46, 8 + rp * 22, null, '#ffffff', 2);
      g.globalAlpha = 1;
    }
    D.rr(g, f.x - 10, f.y - 38, 20, 38, 6, '#ccd5e3', '#abb8ce', 2);
    D.ellipse(g, f.x, f.y - 38, 22, 9, '#ccd5e3', '#abb8ce', 2);
    D.ellipse(g, f.x, f.y - 40, 15, 5, '#9ed8f8');
    for (let i = 0; i < 6; i++) {
      const ph = (t * 1.3 + i / 6) % 1;
      const a = (i / 6) * Math.PI * 2 + t * 0.4;
      D.circle(g, f.x + Math.cos(a) * ph * 26, f.y - 44 - Math.sin(ph * Math.PI) * 16 + ph * 24,
        3 - ph * 1.6, 'rgba(200,235,255,0.9)');
    }
  }

  function drawHedgeBlock(g) {
    const h = HEDGE;
    D.ellipse(g, h.x + h.w / 2, 356, h.w * 0.55, 12, 'rgba(60,40,60,0.10)');
    D.rr(g, h.x, h.y, h.w, 26, 10, '#6fbc82');
    for (let x = h.x + 14; x < h.x + h.w; x += 26) D.circle(g, x, h.y + 2, 13, '#6fbc82');
    D.circle(g, h.x + 30, h.y - 4, 4, '#ffe9a8');
    D.circle(g, h.x + 86, h.y - 6, 4, '#ffd9e8');
    D.circle(g, h.x + 124, h.y - 3, 4, '#ffffff');
  }

  function drawFlowerBed(g) {
    D.ellipse(g, BED.x, BED.y + 6, 58, 20, '#e6c79c', '#cfa97a', 2.5);
    const cols = ['#ff9ec7', '#ffe9a8', '#d8c9f2', '#ff9ec7', '#ffe9a8'];
    for (let i = 0; i < 5; i++) {
      const fx = BED.x - 44 + i * 22;
      const fy = BED.y + 2 - (i % 2) * 5;
      g.strokeStyle = '#67c587';
      g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(fx, fy); g.lineTo(fx, fy - 14); g.stroke();
      D.ellipse(g, fx, fy - 18, 6, 7, cols[i]);
      D.circle(g, fx, fy - 21, 2.4, '#ffffff');
    }
  }

  function drawFence(g) {
    D.rr(g, -12, 552, 424, 9, 4, '#f3e8ee');
    D.rr(g, 548, 552, CM.W - 548 + 12, 9, 4, '#f3e8ee');
    for (let x = 18; x < CM.W - 12; x += 36) {
      if (x > 400 && x < 548) continue;   // gate opening
      D.rr(g, x, 538, 15, 48, 6, '#ffffff', '#e7d8e0', 2);
    }
    // gate posts + arch + sign
    D.rr(g, 398, 498, 18, 90, 6, '#e8c39a', '#c9a06f', 2);
    D.rr(g, 544, 498, 18, 90, 6, '#e8c39a', '#c9a06f', 2);
    g.strokeStyle = '#e8c39a';
    g.lineWidth = 10;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(407, 506);
    g.quadraticCurveTo(480, 452, 553, 506);
    g.stroke();
    D.rr(g, 428, 446, 104, 30, 12, '#ffffff', '#f0b9d2', 2.5);
    D.text(g, '🌼 Garden', 480, 461, { size: 14, color: CM.palette.ink, weight: 800 });
  }

  function drawEars(g, x, y, color) {
    const bob = Math.sin(CM.time * 8) * 2.5;
    g.save();
    g.globalAlpha = 0.92;
    D.ellipse(g, x - 8, y + bob, 5, 9, '#ffffff', color, 2);
    D.ellipse(g, x + 8, y + bob, 5, 9, '#ffffff', color, 2);
    g.restore();
  }

  /* ---------------- the game ---------------- */
  CM.registerGame({
    id: 'hideseek',
    name: 'Hide & Seek',
    joystick: true,

    enter() {
      this.state = 'howto';        // howto -> count -> seek -> done
      this.timeLeft = 90;
      this.found = 0;
      this.score = 0;
      this.finished = false;
      this.p = { x: SPAWN.x, y: SPAWN.y, facing: 'down', phase: 0 };
      this.target = null;
      this.moving = false;
      this.trail = [];
      this.parts = [];
      this.shake = 0;
      this.peekCd = 0;
      this.countT = 0;
      this.lastSeg = -1;
      this.lastTick = -1;
      this.doneMode = null;
      this.doneT = 0;
      this.congaCount = 0;
      this.giggle = null;
      this.giggleTimer = 2.2;
      this.cheer = { text: '', t: 0 };
      // pick 5 friends (never the host) and 5 of the 10 spots
      const ids = shuffle(Object.keys(CM.FRIENDS).filter((id) => id !== 'cinnamoroll')).slice(0, 5);
      const spots = shuffle(SPOTS).slice(0, 5);
      this.hiders = ids.map((id, i) => ({
        id: id,
        spot: spots[i],
        state: 'wait',                              // wait -> run -> hidden -> reveal -> conga
        sx: 480 + (i - 2) * 46,
        sy: 522 + (i % 2) * 12,
        x: 480 + (i - 2) * 46,
        y: 522 + (i % 2) * 12,
        delay: 0.15 + i * 0.18,
        flip: false,
        revealT: 0,
        congaIdx: -1
      }));
    },

    beginCount() {
      this.state = 'count';
      this.countT = 0;
      this.lastSeg = -1;
      for (const h of this.hiders) h.state = 'run';
      this.cheer = { text: 'Go hide, everyone!', t: 3.4 };
    },

    addPart(p) { if (this.parts.length < 90) this.parts.push(p); },

    puffLeaves(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.addPart({
          kind: 'leaf', x: x + CM.rand(-14, 14), y: y + CM.rand(-8, 8),
          vx: CM.rand(-70, 70), vy: CM.rand(-110, -30),
          rot: CM.rand(0, 6.3), vr: CM.rand(-5, 5), t: 0, life: CM.rand(0.7, 1.1)
        });
      }
    },

    burst(x, y) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.addPart({
          kind: 'star', x: x, y: y - 50,
          vx: Math.cos(a) * CM.rand(60, 130), vy: Math.sin(a) * CM.rand(60, 130) - 60,
          t: 0, life: 0.9, size: CM.rand(7, 12)
        });
      }
      for (let i = 0; i < 4; i++) {
        this.addPart({
          kind: 'heart', x: x + CM.rand(-26, 26), y: y - 60,
          vx: CM.rand(-30, 30), vy: CM.rand(-120, -60), t: 0, life: 1.1, size: CM.rand(7, 11)
        });
      }
    },

    floatText(x, y, str) {
      this.addPart({ kind: 'txt', x: x, y: y, str: str, vx: 0, vy: -34, t: 0, life: 1.2 });
    },

    tickParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.t += dt;
        if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'leaf') { p.vy += 170 * dt; p.rot += p.vr * dt; p.vx *= 1 - dt * 1.5; }
        else if (p.kind !== 'txt') p.vy += 40 * dt;
      }
    },

    peekAt(spot) {
      if (this.peekCd > 0) return;
      this.peekCd = 0.45;
      const hh = this.hiders.find((o) => o.spot === spot && o.state === 'hidden');
      if (hh) this.revealFriend(hh);
      else {
        CM.audio.play('whoosh');
        this.puffLeaves(spot.px, spot.py - 26, 6);
        this.floatText(spot.px, spot.py - 64, 'no one here…');
      }
    },

    revealFriend(h) {
      h.state = 'reveal';
      h.revealT = 0;
      h.x = h.spot.px;
      h.y = h.spot.py;
      this.found++;
      this.shake = 5;
      CM.audio.play('cheer');
      this.burst(h.spot.px, h.spot.py);
      this.cheer = { text: 'Yay! You found ' + CM.FRIENDS[h.id].name + '!', t: 2.4 };
      if (this.giggle && this.giggle.h === h) this.giggle = null;
    },

    tickHiders(dt) {
      for (const h of this.hiders) {
        if (h.state !== 'reveal') continue;
        h.revealT += dt;
        if (h.revealT >= 1.05) {
          h.state = 'conga';
          h.congaIdx = this.congaCount++;
          if (this.found >= 5 && this.state === 'seek') {
            this.state = 'done';
            this.doneMode = 'win';
            this.doneT = 1.6;
            this.giggle = null;
            this.score = this.found * 60 + Math.ceil(this.timeLeft);
            this.shake = 8;
            CM.audio.play('tada');
            this.burst(this.p.x, this.p.y);
            this.cheer = { text: 'You found everyone!!', t: 3 };
          }
        }
      }
    },

    congaPos(idx) {
      if (!this.trail.length) return { x: this.p.x, y: Math.min(BOUNDS.y2, this.p.y + 20) };
      const back = 26 * (idx + 1);
      const i = Math.max(0, this.trail.length - 1 - back);
      return this.trail[i];
    },

    update(dt) {
      const inp = CM.input;
      // only claim touches for the joystick while actually seeking
      this.joystick = this.state === 'seek';
      this.shake = Math.max(0, this.shake - dt * 16);
      if (this.cheer.t > 0) this.cheer.t -= dt;
      this.tickParts(dt);

      /* ----- howto ----- */
      if (this.state === 'howto') {
        if (inp.pressed('action')) this.beginCount();
        return;
      }

      /* ----- count-in: 3..2..1.. go hide! ----- */
      if (this.state === 'count') {
        this.countT += dt;
        const seg = Math.floor(this.countT / 0.9);
        if (seg !== this.lastSeg && seg <= 3) {
          this.lastSeg = seg;
          if (seg < 3) CM.audio.tone(640 + seg * 90, 0.14, 'triangle', 0.12);
          else CM.audio.play('whoosh');
        }
        for (const h of this.hiders) {
          if (h.state !== 'run') continue;
          const pr = CM.clamp((this.countT - h.delay) / 2.5, 0, 1);
          const e = pr * pr * (3 - 2 * pr);
          h.x = CM.lerp(h.sx, h.spot.px, e);
          h.y = CM.lerp(h.sy, h.spot.py, e);
          h.flip = h.spot.px < h.sx;
          if (pr >= 1) {
            h.state = 'hidden';
            this.puffLeaves(h.spot.px, h.spot.py - 22, 4);
            CM.audio.play('pop');
          }
        }
        if (this.countT >= 3.6) {
          for (const h of this.hiders) if (h.state !== 'hidden') h.state = 'hidden';
          this.state = 'seek';
          this.cheer = { text: 'Go find them!', t: 2.2 };
          CM.audio.play('ding');
        }
        return;
      }

      /* ----- done: celebration moment, then finish exactly once ----- */
      if (this.state === 'done') {
        this.tickHiders(dt);
        if (this.doneMode === 'win' && this.parts.length < 60 && Math.random() < 0.3) {
          this.addPart({
            kind: 'star', x: CM.rand(120, 840), y: CM.rand(120, 380),
            vx: CM.rand(-30, 30), vy: CM.rand(-70, -20), t: 0, life: 0.9, size: CM.rand(7, 13)
          });
        }
        this.doneT -= dt;
        if (this.doneT <= 0 && !this.finished) {
          this.finished = true;
          CM.finishGame('hideseek', this.score, CM.clamp(Math.ceil(this.score / 15), 5, 30));
        }
        return;
      }

      /* ----- seek ----- */
      this.timeLeft -= dt;
      const tl = Math.ceil(this.timeLeft);
      if (tl <= 10 && tl >= 1 && tl !== this.lastTick) {
        this.lastTick = tl;
        CM.audio.tone(760, 0.06, 'sine', 0.06);
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.state = 'done';
        this.doneMode = this.found >= 5 ? 'win' : 'time';
        this.doneT = 2.0;
        this.giggle = null;
        this.score = this.found * 60;
        this.cheer = { text: 'Good seeking!', t: 2.5 };
        CM.audio.play('ding');
        return;
      }

      // mouse: click to walk — or click a bush/tree to run over and peek behind it
      if (inp.mouse.clicked) {
        const mx = inp.mouse.x, my = inp.mouse.y;
        let spot = null, sd = 64;
        for (const s of SPOTS) {
          const d2 = CM.dist(mx, my, s.px, s.py - 16);
          if (d2 < sd) { sd = d2; spot = s; }
        }
        if (spot && CM.dist(this.p.x, this.p.y, spot.px, spot.py) < 70) {
          this.peekAt(spot); // already close — peek right away
          this.target = null;
        } else {
          this.target = {
            x: CM.clamp(spot ? spot.px : mx, BOUNDS.x1, BOUNDS.x2),
            y: CM.clamp(spot ? spot.py + 26 : my, BOUNDS.y1, BOUNDS.y2),
            spot: spot, t: 0, stuck: 0
          };
        }
      }

      // movement (mansion-style; keyboard / joystick takes over from a click target)
      let ax = inp.axisX();
      let ay = inp.axisY();
      if (Math.hypot(ax, ay) > 0.15) {
        this.target = null;
      } else if (this.target) {
        const dx = this.target.x - this.p.x;
        const dy = this.target.y - this.p.y;
        const d = Math.hypot(dx, dy);
        if (d > 5) { ax = dx / d; ay = dy / d; }
      }
      const len = Math.hypot(ax, ay);
      const ox = this.p.x, oy = this.p.y;
      if (len > 0.15) {
        const speed = 225 * Math.min(1, len);
        const nx = this.p.x + (ax / (len || 1)) * speed * dt;
        const ny = this.p.y + (ay / (len || 1)) * speed * dt;
        if (!blocked(nx, this.p.y)) this.p.x = nx;
        if (!blocked(this.p.x, ny)) this.p.y = ny;
        this.p.facing = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : (ay > 0 ? 'down' : 'up');
        this.p.phase = (this.p.phase + dt * 2.6) % 1 || 0.01;
      } else {
        this.p.phase = 0;
      }
      this.moving = Math.hypot(this.p.x - ox, this.p.y - oy) > 0.5;
      if (this.moving) {
        this.trail.push({ x: this.p.x, y: this.p.y });
        if (this.trail.length > 180) this.trail.shift();
      }

      // click-target arrival, auto-peek, and give-up-when-blocked
      this.peekCd = Math.max(0, this.peekCd - dt);
      if (this.target) {
        const tgt = this.target;
        tgt.t += dt;
        if (len > 0.15 && !this.moving) tgt.stuck += dt;
        else tgt.stuck = 0;
        if (tgt.spot && CM.dist(this.p.x, this.p.y, tgt.spot.px, tgt.spot.py) < 64) {
          this.peekAt(tgt.spot);
          this.target = null;
        } else if (CM.dist(this.p.x, this.p.y, tgt.x, tgt.y) < 6 || tgt.stuck > 0.5) {
          this.target = null;
        }
      }

      // peek (SPACE / ★ near a hiding spot)
      if (inp.pressed('action') && this.peekCd <= 0) {
        let best = null, bd = 70;
        for (const s of SPOTS) {
          const d2 = CM.dist(this.p.x, this.p.y, s.px, s.py);
          if (d2 < bd) { bd = d2; best = s; }
        }
        if (best) this.peekAt(best);
      }

      this.tickHiders(dt);

      // giggle tells
      if (this.giggle) {
        this.giggle.t -= dt;
        if (this.giggle.t <= 0) this.giggle = null;
      } else {
        this.giggleTimer -= dt;
        if (this.giggleTimer <= 0) {
          const hidden = this.hiders.filter((o) => o.state === 'hidden');
          if (hidden.length) {
            const h = CM.pick(hidden);
            this.giggle = {
              h: h, t: 1.2,
              bx: CM.clamp(h.spot.px + (Math.random() < 0.5 ? -1 : 1) * CM.rand(36, 62) - 48, 14, CM.W - 110),
              by: CM.clamp(h.spot.pky - CM.rand(52, 74), 64, CM.H - 90)
            };
            CM.audio.play('pop');
          }
          this.giggleTimer = CM.rand(2.4, 4.0);
        }
      }
    },

    draw(g) {
      const t = CM.time;
      g.save();
      if (this.shake > 0.2) {
        g.translate(CM.rand(-this.shake, this.shake) * 0.7, CM.rand(-this.shake, this.shake) * 0.7);
      }
      drawGround(g);

      /* ----- depth-sorted sprites ----- */
      const sprites = [];
      sprites.push({ y: 216, fn: () => drawFlowerBed(g) });
      for (const tr of TREES) sprites.push({ y: tr.y, fn: () => drawTree(g, tr, t) });
      for (const b of BUSHES) sprites.push({ y: b.y, fn: () => drawBush(g, b, t) });
      sprites.push({ y: SHED.y + SHED.h + 2, fn: () => drawShed(g) });
      sprites.push({ y: 332, fn: () => drawFountain(g, t) });
      sprites.push({ y: 357, fn: () => drawHedgeBlock(g) });

      // tiny peeking ears during a giggle tell
      if (this.giggle && this.giggle.h.state === 'hidden') {
        const gg = this.giggle;
        sprites.push({
          y: gg.h.spot.sy,
          fn: () => drawEars(g, gg.h.spot.pkx, gg.h.spot.pky, CM.FRIENDS[gg.h.id].color)
        });
      }

      // hiders
      for (let i = 0; i < this.hiders.length; i++) {
        const h = this.hiders[i];
        if (h.state === 'wait' || h.state === 'run') {
          const bob = h.state === 'run' ? (t * 2 + i * 0.2) % 1 : ((t * 0.9 + i * 0.2) % 1) * 0.3;
          sprites.push({ y: h.y, fn: () => CM.drawFriend(g, h.id, h.x, h.y, 0.95, { bob: bob, flip: h.flip }) });
        } else if (h.state === 'reveal') {
          const hop = Math.sin(Math.min(1, h.revealT / 0.7) * Math.PI) * 44;
          sprites.push({ y: h.y, fn: () => CM.drawFriend(g, h.id, h.x, h.y - hop, 1, { bob: (h.revealT * 2) % 1 }) });
        } else if (h.state === 'conga') {
          const pos = this.congaPos(h.congaIdx);
          const j = Math.min(this.trail.length - 1, this.trail.indexOf(pos) + 5);
          if (j >= 0 && this.trail[j]) {
            const dx = this.trail[j].x - pos.x;
            if (dx < -1) h.flip = true;
            else if (dx > 1) h.flip = false;
          }
          let hop = 0;
          if (this.state === 'done' && this.doneMode === 'win') hop = Math.abs(Math.sin(t * 5 + h.congaIdx)) * 12;
          const bob = this.moving ? (t * 1.9 + h.congaIdx * 0.17) % 1 : 0;
          sprites.push({ y: pos.y, fn: () => CM.drawFriend(g, h.id, pos.x, pos.y - hop, 0.95, { bob: bob, flip: h.flip }) });
        }
      }

      // player (the seeker!)
      sprites.push({ y: this.p.y, fn: () => CM.drawPlayer(g, this.p.x, this.p.y, 1.05, this.p.facing, this.p.phase) });

      sprites.sort((a, b) => a.y - b.y);
      for (const s of sprites) s.fn();

      // click-to-walk target marker
      if (this.target && this.state === 'seek') {
        const tg = this.target;
        const pulse = 1 - (tg.t % 0.7) / 0.7;
        g.globalAlpha = 0.3 + pulse * 0.45;
        D.circle(g, tg.x, tg.y, 7 + pulse * 10, null, CM.palette.pinkDeep, 2.5);
        D.star(g, tg.x, tg.y, 5, CM.palette.pinkDeep);
        g.globalAlpha = 1;
      }

      // "you can peek here" hint above the nearest spot in range
      if (this.state === 'seek') {
        let best = null, bd = 70;
        for (const s of SPOTS) {
          const d2 = CM.dist(this.p.x, this.p.y, s.px, s.py);
          if (d2 < bd) { bd = d2; best = s; }
        }
        if (best) {
          const bobble = Math.sin(t * 5) * 3;
          D.circle(g, best.px, best.py - 96 + bobble, 13, 'rgba(255,255,255,0.92)', '#f0b9d2', 2.5);
          D.text(g, '?', best.px, best.py - 95 + bobble, { size: 17, color: CM.palette.pinkDeep, weight: 800 });
        }
      }

      drawFence(g);

      // Cinnamoroll cheering at the gate
      const excited = this.cheer.t > 0 || (this.state === 'done' && this.doneMode === 'win');
      CM.drawFriend(g, 'cinnamoroll', CINNA.x, CINNA.y, 1.05, {
        bob: excited ? (t * 2.3) % 1 : ((t * 0.8) % 1) * 0.35,
        flip: true
      });
      if (this.cheer.t > 0 && this.state !== 'howto') {
        const cw = Math.max(150, this.cheer.text.length * 8.5 + 26);
        const bx = CM.clamp(CINNA.x - cw + 36, 8, CM.W - cw - 8);
        D.bubble(g, bx, 414, cw, 42, CINNA.x - 14);
        D.text(g, this.cheer.text, bx + cw / 2, 435, { size: 15, weight: 800, color: CM.palette.ink });
      }

      /* ----- particles ----- */
      for (const p of this.parts) {
        g.globalAlpha = Math.max(0, 1 - p.t / p.life);
        if (p.kind === 'leaf') {
          g.save();
          g.translate(p.x, p.y);
          g.rotate(p.rot);
          D.ellipse(g, 0, 0, 7, 3.5, '#8fce9d');
          g.restore();
        } else if (p.kind === 'star') D.star(g, p.x, p.y, p.size, CM.palette.yellowDeep);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, CM.palette.pink);
        else if (p.kind === 'txt') D.text(g, p.str, p.x, p.y, { size: 16, color: '#7a6b75', weight: 800, stroke: '#ffffff', strokeWidth: 4 });
      }
      g.globalAlpha = 1;

      // giggle bubble (near, not on, the hiding spot)
      if (this.giggle) {
        const gg = this.giggle;
        D.bubble(g, gg.bx, gg.by, 96, 34, gg.h.spot.px);
        D.text(g, 'hee hee ♪', gg.bx + 48, gg.by + 17, { size: 14, color: CM.palette.pinkDeep, weight: 800 });
      }

      // count-in overlay
      if (this.state === 'count') {
        const SEGS = ['3', '2', '1', 'Go hide!'];
        const seg = Math.min(3, Math.floor(this.countT / 0.9));
        const frac = (this.countT - seg * 0.9) / 0.9;
        const size = (seg === 3 ? 58 : 92) * (1 + 0.3 * Math.max(0, 1 - frac * 3));
        D.text(g, SEGS[seg], 480, 250, {
          size: Math.round(size), color: CM.palette.pinkDeep, weight: 800,
          stroke: '#ffffff', strokeWidth: 10
        });
      }

      g.restore();   // end screen-shake — context is back to normal

      /* ----- HUD ----- */
      if (this.state !== 'howto') {
        // timer, big and friendly, top-center
        const tl = Math.max(0, Math.ceil(this.timeLeft));
        const urgent = tl <= 10 && this.state === 'seek';
        const pulse = urgent ? 1 + Math.sin(t * 7) * 0.07 : 1;
        D.rr(g, 416, 10, 128, 44, 22, 'rgba(255,255,255,0.9)', urgent ? CM.palette.red : '#f0b9d2', 3);
        D.text(g, '⏱ ' + tl, 480, 33, {
          size: Math.round(27 * pulse),
          color: urgent ? CM.palette.red : CM.palette.blueDeep, weight: 800
        });
        // found counter, top-left
        D.rr(g, 14, 12, 208, 40, 20, 'rgba(255,255,255,0.88)', '#f0b9d2', 2);
        D.text(g, 'Found', 52, 32, { size: 16, weight: 800, color: CM.palette.ink });
        for (let i = 0; i < this.hiders.length; i++) {
          const h = this.hiders[i];
          const got = h.state === 'reveal' || h.state === 'conga';
          const cx = 102 + i * 22;
          D.circle(g, cx, 32, 9, got ? CM.FRIENDS[h.id].color : '#ffffff', got ? 'rgba(0,0,0,0.12)' : '#d8c8d2', 2);
          if (got) D.star(g, cx, 32, 5, '#ffffff');
        }
        // small control hint
        if (this.state === 'seek' && CM.sceneTime < 14) {
          const hint = CM.touchMode ? 'Drag left side to walk  ·  ★ to peek' : 'Walk: WASD / Arrows  ·  Peek: SPACE';
          D.rr(g, 318, 58, 324, 26, 13, 'rgba(255,255,255,0.55)');
          D.text(g, hint, 480, 71, { size: 15, color: '#7a6b75' });
        }
      }

      /* ----- done banner ----- */
      if (this.state === 'done') {
        if (this.doneMode === 'win') {
          D.text(g, 'You found everyone!!', 480, 230, {
            size: 46, color: CM.palette.pinkDeep, weight: 800, stroke: '#ffffff', strokeWidth: 10
          });
          D.star(g, 250, 200 + Math.sin(t * 5) * 6, 16, CM.palette.yellowDeep);
          D.star(g, 710, 200 + Math.cos(t * 5) * 6, 16, CM.palette.yellowDeep);
        } else {
          D.text(g, "Time's up!", 480, 220, {
            size: 42, color: CM.palette.blueDeep, weight: 800, stroke: '#ffffff', strokeWidth: 9
          });
          D.text(g, 'Good seeking! You found ' + this.found + ' friend' + (this.found === 1 ? '' : 's') + '!',
            480, 268, { size: 22, color: CM.palette.ink, weight: 800, stroke: '#ffffff', strokeWidth: 6 });
        }
      }

      /* ----- howto overlay ----- */
      if (this.state === 'howto') {
        g.fillStyle = 'rgba(70,40,70,0.25)';
        g.fillRect(0, 0, CM.W, CM.H);
        CM.ui.panel(g, 165, 88, 630, 400, { title: '🌼 Hide & Seek 🌼' });
        CM.drawFriend(g, 'cinnamoroll', 270, 388, 1.25, { bob: ((t * 1.1) % 1) * 0.5 });
        D.text(g, 'Cinnamoroll', 270, 412, { size: 14, color: CM.palette.pinkDeep, weight: 800 });
        D.text(g, '5 friends are hiding in the garden!', 545, 160, { size: 20, color: CM.palette.ink, weight: 800 });
        D.text(g, 'Walk close to bushes, trees, the shed', 545, 204, { size: 17, color: CM.palette.ink });
        D.text(g, 'and the fountain — then peek!', 545, 230, { size: 17, color: CM.palette.ink });
        D.text(g, 'Listen for giggles… hee hee ♪', 545, 274, { size: 17, color: CM.palette.lavenderDeep, weight: 800 });
        D.text(g, 'Find all 5 before time runs out!', 545, 318, { size: 18, color: CM.palette.pinkDeep, weight: 800 });
        const hint = CM.touchMode ? 'Drag left side to walk · tap ★ to peek' : 'Walk: WASD / Arrows · Peek: SPACE';
        D.text(g, hint, 545, 354, { size: 14, color: '#9a8a94' });
        if (CM.ui.button(g, 445, 396, 200, 58, '▶ Start!', { color: CM.palette.mintDeep, size: 22 })) {
          this.beginCount();
        }
      }
    },

    exit() {}
  });
})();
