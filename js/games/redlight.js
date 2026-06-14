/* Cinnamoroll Mansion — Red Light, Green Light (Badtz-Maru's hallway) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------------- layout ---------------- */
  const WALL_H = 110;                                  // pastel wall strip across the top
  const FINISH_Y = WALL_H + 36;                        // y of the finish ribbon line
  const PLAY = { x1: 70, y1: FINISH_Y + 8, x2: 890, y2: 560 };   // AABB the player lives in
  const SPAWN = { x: 480, y: 540 };                    // bottom-center start
  const SPEED = 210;                                   // px/s while held
  const GRACE = 0.35;                                  // reaction window after red starts
  const STUN = 0.6;                                    // freeze after being caught
  const CALLER = { x: 740, y: FINISH_Y + 4 };          // Badtz-Maru, the strict caller (top-right-ish, clear of corner)
  const HOST = 'badtzmaru';

  // deterministic floor decorations so they don't flicker
  const DECOR = [
    { kind: 'plant', x: 120, y: 250 },
    { kind: 'toybox', x: 820, y: 470 },
    { kind: 'window', x: 250, y: WALL_H * 0.5 }
  ];

  function clampToPlay(p) {
    p.x = CM.clamp(p.x, PLAY.x1, PLAY.x2);
    p.y = CM.clamp(p.y, PLAY.y1, PLAY.y2);
  }

  // progress 0 (bottom) .. 1 (finish line)
  function progressOf(y) {
    return CM.clamp((PLAY.y2 - y) / (PLAY.y2 - PLAY.y1), 0, 1);
  }

  /* ---------------- room art ---------------- */
  function drawRoom(g, t) {
    // warm wood floor
    g.fillStyle = P.wood;
    g.fillRect(0, WALL_H, CM.W, CM.H - WALL_H);
    // faint floorboard lines
    g.strokeStyle = 'rgba(140,90,50,0.16)';
    g.lineWidth = 2;
    for (let y = WALL_H + 40; y < CM.H; y += 40) {
      g.beginPath(); g.moveTo(0, y); g.lineTo(CM.W, y); g.stroke();
    }
    // a few vertical seams for a planked look
    g.strokeStyle = 'rgba(140,90,50,0.08)';
    for (let x = 90; x < CM.W; x += 150) {
      g.beginPath(); g.moveTo(x, WALL_H); g.lineTo(x, CM.H); g.stroke();
    }
    // pastel wall strip across the top
    g.fillStyle = '#e7d7f4';
    g.fillRect(0, 0, CM.W, WALL_H);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    for (let x = 16; x < CM.W; x += 60) g.fillRect(x, 0, 22, WALL_H - 14);
    g.fillStyle = '#fff';
    g.fillRect(0, WALL_H - 14, CM.W, 14);
    g.fillStyle = 'rgba(0,0,0,0.05)';
    g.fillRect(0, WALL_H, CM.W, 4);

    // soft round rug in the middle of the hallway
    D.ellipse(g, 480, 360, 170, 92, '#ffe6f1', '#f3c6dd', 4);
    D.ellipse(g, 480, 360, 132, 70, null, '#ffffff', 3);
    D.star(g, 480, 358, 18, '#ffd24a');
  }

  function drawDecor(g, d, t) {
    if (d.kind === 'plant') {
      D.shadow(g, d.x, d.y, 26);
      D.rr(g, d.x - 16, d.y - 24, 32, 24, 6, '#d98a5a', '#b56f42', 2);
      const sw = Math.sin(t * 0.9 + d.x) * 2;
      D.ellipse(g, d.x + sw, d.y - 40, 22, 18, '#8fd6a0', '#6fbc82', 2);
      D.ellipse(g, d.x - 12 + sw, d.y - 50, 12, 10, '#a5dfae');
      D.ellipse(g, d.x + 12 + sw, d.y - 50, 12, 10, '#a5dfae');
      D.circle(g, d.x + sw, d.y - 56, 4, '#ffd9e8');
    } else if (d.kind === 'toybox') {
      D.shadow(g, d.x, d.y, 40);
      D.rr(g, d.x - 38, d.y - 40, 76, 40, 8, '#ffd9a8', '#e6b577', 3);
      D.rr(g, d.x - 42, d.y - 50, 84, 16, 6, '#ffc7dd', '#f0a8c4', 3);
      D.heart(g, d.x, d.y - 42, 12, '#ff7eb6');
      // a ball + block poking out
      D.circle(g, d.x - 22, d.y - 52, 9, '#8ecdf6', '#6aaede', 2);
      D.rr(g, d.x + 14, d.y - 60, 16, 16, 3, '#bdeccd', '#67c587', 2);
      D.text(g, 'A', d.x + 22, d.y - 51, { size: 14, color: '#3f8f5a', weight: 800 });
    } else if (d.kind === 'window') {
      // window on the wall strip
      D.rr(g, d.x - 34, 14, 68, 70, 8, '#cdeaff', '#fff', 5);
      g.strokeStyle = '#fff'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(d.x, 18); g.lineTo(d.x, 80); g.stroke();
      g.beginPath(); g.moveTo(d.x - 30, 49); g.lineTo(d.x + 30, 49); g.stroke();
      g.fillStyle = '#ffb7d5';
      g.beginPath(); g.moveTo(d.x - 34, 12); g.lineTo(d.x - 18, 52); g.lineTo(d.x - 34, 52); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(d.x + 34, 12); g.lineTo(d.x + 18, 52); g.lineTo(d.x + 34, 52); g.closePath(); g.fill();
    }
  }

  // cute finish gate: ribbon banner + star posts spanning the top
  function drawFinish(g, t) {
    const y = FINISH_Y;
    // posts
    D.rr(g, 56, y - 14, 14, 60, 6, '#f0a8c4', '#d886a8', 2);
    D.rr(g, CM.W - 70, y - 14, 14, 60, 6, '#f0a8c4', '#d886a8', 2);
    D.star(g, 63, y - 20, 10, '#ffd24a');
    D.star(g, CM.W - 63, y - 20, 10, '#ffd24a');
    // draped ribbon
    g.strokeStyle = '#ff7eb6';
    g.lineWidth = 8;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(63, y - 6);
    for (let x = 63; x <= CM.W - 63; x += 24) {
      const yy = y - 6 + Math.sin((x + t * 60) * 0.04) * 4;
      g.lineTo(x, yy);
    }
    g.stroke();
    // little bows along the ribbon
    for (let x = 120; x < CM.W - 90; x += 120) {
      const yy = y - 6 + Math.sin((x + t * 60) * 0.04) * 4;
      D.circle(g, x, yy, 5, '#fff', '#f0a8c4', 2);
      D.heart(g, x, yy + 1, 8, '#ff5f8f');
    }
    // FINISH cake on the left post
    D.text(g, '🎀 FINISH 🎀', 270, y + 4, { size: 16, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 5 });
  }

  /* ---------------- the game ---------------- */
  CM.registerGame({
    id: 'redlight',
    name: 'Red Light, Green Light',
    joystick: true,

    enter() {
      this.state = 'howto';        // howto -> count -> play -> done
      this.finished = false;

      this.timeLeft = 60;
      this.score = 0;
      this.crossings = 0;
      this.difficulty = 0;         // ramps up each crossing / over time

      this.p = { x: SPAWN.x, y: SPAWN.y, facing: 'up', phase: 0 };
      this.bestProgress = 0;       // furthest progress this run (for forward-progress points)

      // light state machine
      this.light = 'green';        // 'green' | 'warn' | 'red'
      this.lightT = 0;             // time spent in current light phase
      this.lightDur = CM.rand(1.6, 2.6);
      this.redGrace = 0;           // counts up after red starts
      this.stun = 0;               // > 0 = player frozen from being caught

      // caller (Badtz) facing + reaction
      this.callerLook = 0;         // 0 = looking away (green), 1 = staring (red)
      this.callerBubble = { text: '', t: 0 };

      this.countT = 0;
      this.lastSeg = -1;
      this.lastTick = -1;
      this.doneT = 0;

      this.parts = [];
      this.shake = 0;
      this.bannerFlash = 0;        // brief pop when light changes

      // keep the touch joystick from grabbing taps outside of play
      this.joystick = false;
    },

    /* ----- helpers ----- */
    beginCount() {
      this.state = 'count';
      this.countT = 0;
      this.lastSeg = -1;
      CM.audio.play('whoosh');
    },

    addPart(p) { if (this.parts.length < 110) this.parts.push(p); },

    burst(x, y, big) {
      const n = big ? 14 : 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.addPart({
          kind: 'star', x: x, y: y,
          vx: Math.cos(a) * CM.rand(70, big ? 170 : 120),
          vy: Math.sin(a) * CM.rand(70, big ? 170 : 120) - 50,
          t: 0, life: big ? 1.1 : 0.8, size: CM.rand(7, big ? 13 : 10)
        });
      }
      for (let i = 0; i < (big ? 6 : 3); i++) {
        this.addPart({
          kind: 'heart', x: x + CM.rand(-24, 24), y: y - 20,
          vx: CM.rand(-30, 30), vy: CM.rand(-130, -70), t: 0, life: 1.1, size: CM.rand(7, 11)
        });
      }
    },

    confetti(x, y) {
      const cols = ['#ff9ec7', '#8ecdf6', '#ffe9a8', '#bdeccd', '#d8c9f2', '#f06292'];
      for (let i = 0; i < 22; i++) {
        this.addPart({
          kind: 'conf', x: x + CM.rand(-40, 40), y: y,
          vx: CM.rand(-120, 120), vy: CM.rand(-220, -90),
          rot: CM.rand(0, 6.3), vr: CM.rand(-6, 6),
          color: CM.pick(cols), size: CM.rand(5, 10), t: 0, life: CM.rand(1.0, 1.6)
        });
      }
    },

    floatText(x, y, str, color) {
      this.addPart({ kind: 'txt', x: x, y: y, str: str, color: color || '#7a6b75', vx: 0, vy: -36, t: 0, life: 1.2 });
    },

    tickParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.t += dt;
        if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'conf') { p.vy += 230 * dt; p.rot += p.vr * dt; p.vx *= 1 - dt * 1.4; }
        else if (p.kind !== 'txt') p.vy += 60 * dt;
      }
    },

    // pick the next light phase (speeds up with difficulty)
    nextLight() {
      const d = this.difficulty;
      if (this.light === 'green') {
        this.light = 'warn';
        this.lightDur = 0.25;                                  // clear blink warning
      } else if (this.light === 'warn') {
        this.light = 'red';
        this.lightDur = CM.clamp(CM.rand(1.6, 1.8) - d * 0.18, 1.0, 1.8);
        this.redGrace = 0;
        this.callerBubble = { text: 'Freeze!', t: 1.1 };
        CM.audio.play('miss');                                  // short alert
        this.bannerFlash = 1;
        this.shake = 4;
      } else {
        this.light = 'green';
        this.lightDur = CM.clamp(CM.rand(2.0, 2.6) - d * 0.28, 1.2, 2.6);
        CM.audio.tone(560, 0.1, 'sine', 0.1, 0, 740);           // soft go chime
        CM.audio.tone(740, 0.12, 'sine', 0.08, 0.08);
        this.bannerFlash = 1;
      }
      this.lightT = 0;
    },

    caught() {
      // gentle, recoverable: nudge back a few steps, brief stun, never eliminate
      this.stun = STUN;
      this.shake = 7;
      CM.audio.play('boing');
      this.p.y = CM.clamp(this.p.y + 56, PLAY.y1, PLAY.y2);     // lose a little progress (toward bottom)
      this.p.phase = 0;
      this.callerBubble = { text: CM.pick(['Caught you!', 'No moving!', 'Freeze!']), t: 1.2 };
      this.floatText(this.p.x, this.p.y - 96, 'Oops!', P.pinkDeep);
      this.burst(this.p.x, this.p.y - 50, false);
    },

    crossFinish() {
      this.crossings++;
      this.score += 100;                                         // big bonus per crossing
      this.difficulty += 1;
      this.shake = 9;
      CM.audio.play('tada');
      this.confetti(this.p.x, this.p.y - 40);
      this.burst(this.p.x, this.p.y - 50, true);
      this.callerBubble = { text: CM.pick(['…not bad.', 'Hmph! Lucky.', 'Impressive…']), t: 1.8 };
      this.bestProgress = 0;
      // reset to the bottom for a fresh (harder) round
      this.p.x = SPAWN.x;
      this.p.y = SPAWN.y;
      this.p.facing = 'up';
      this.p.phase = 0;
      // start the new round on green so the kid can set off
      this.light = 'green';
      this.lightT = 0;
      this.lightDur = CM.clamp(CM.rand(1.8, 2.4) - this.difficulty * 0.28, 1.2, 2.6);
      this.callerLook = 0;
    },

    update(dt) {
      const inp = CM.input;
      this.joystick = this.state === 'play';
      this.shake = Math.max(0, this.shake - dt * 18);
      this.bannerFlash = Math.max(0, this.bannerFlash - dt * 3);
      if (this.callerBubble.t > 0) this.callerBubble.t -= dt;
      this.tickParts(dt);

      // caller turns to face the player smoothly based on light
      const wantLook = (this.light === 'red' || this.light === 'warn') ? 1 : 0;
      this.callerLook = CM.lerp(this.callerLook, wantLook, Math.min(1, dt * 8));

      /* ----- howto ----- */
      if (this.state === 'howto') {
        if (inp.pressed('action')) this.beginCount();
        return;
      }

      /* ----- count-in: 3..2..1..Go ----- */
      if (this.state === 'count') {
        this.countT += dt;
        const seg = Math.floor(this.countT / 0.75);
        if (seg !== this.lastSeg && seg <= 3) {
          this.lastSeg = seg;
          if (seg < 3) CM.audio.tone(620 + seg * 90, 0.14, 'triangle', 0.12);
          else CM.audio.play('ding');
        }
        if (this.countT >= 3.0) {
          this.state = 'play';
          this.light = 'green';
          this.lightT = 0;
          this.callerBubble = { text: 'Green Light!', t: 1.2 };
        }
        return;
      }

      /* ----- done: short celebration, then finish once ----- */
      if (this.state === 'done') {
        if (this.parts.length < 80 && Math.random() < 0.35) {
          this.confetti(CM.rand(140, 820), 120);
        }
        this.doneT -= dt;
        if (this.doneT <= 0 && !this.finished) {
          this.finished = true;
          CM.finishGame('redlight', this.score, CM.clamp(Math.ceil(this.score / 18), 5, 30));
        }
        return;
      }

      /* ----- play ----- */
      // global timer
      this.timeLeft -= dt;
      const tl = Math.ceil(this.timeLeft);
      if (tl <= 10 && tl >= 1 && tl !== this.lastTick) {
        this.lastTick = tl;
        CM.audio.tone(760, 0.06, 'sine', 0.06);
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.state = 'done';
        this.doneT = 2.2;
        CM.audio.play('cheer');
        this.confetti(480, 200);
        this.callerBubble = { text: this.crossings > 0 ? 'Well played!' : 'Good try!', t: 3 };
        return;
      }

      // slow global difficulty creep over the 60s
      this.difficulty = Math.min(this.difficulty, 6);
      const creep = (60 - this.timeLeft) / 60 * 1.2;          // up to +1.2 over the session

      // advance the light phase machine
      this.lightT += dt;
      if (this.light === 'red') this.redGrace += dt;
      if (this.lightT >= this.lightDur) this.nextLight();

      // ----- gather held input (HOLD-to-move; release = stop on a dime) -----
      let ax = 0, ay = 0;
      // keyboard / joystick
      const kx = inp.axisX(), ky = inp.axisY();
      if (Math.hypot(kx, ky) > 0.001) { ax = kx; ay = ky; }
      // mouse/touch: steer toward cursor only while held
      if (Math.hypot(ax, ay) <= 0.15 && inp.mouse.down) {
        const dx = inp.mouse.x - this.p.x;
        const dy = inp.mouse.y - this.p.y;
        const d = Math.hypot(dx, dy);
        if (d > 6) { ax = dx / d; ay = dy / d; }
      }
      let len = Math.hypot(ax, ay);
      const wantsMove = len > 0.15;

      // tick down a stun (frozen, can't move)
      if (this.stun > 0) {
        this.stun -= dt;
        this.p.phase = 0;
      } else if (wantsMove) {
        const speed = SPEED * Math.min(1, len);
        const nx = this.p.x + (ax / (len || 1)) * speed * dt;
        const ny = this.p.y + (ay / (len || 1)) * speed * dt;
        this.p.x = nx; this.p.y = ny;
        clampToPlay(this.p);
        this.p.facing = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : (ay > 0 ? 'down' : 'up');
        this.p.phase = (this.p.phase + dt * 2.8) % 1 || 0.01;
      } else {
        this.p.phase = 0;
      }

      // ----- "moving while red" check (after the grace window) -----
      const moving = wantsMove && this.stun <= 0;
      if (this.light === 'red' && this.redGrace > GRACE && moving) {
        this.caught();
      }

      // ----- forward-progress scoring -----
      const prog = progressOf(this.p.y);
      if (prog > this.bestProgress) {
        // small points for newly-gained forward progress (1 pt per ~2% of the hall)
        const gained = prog - this.bestProgress;
        this.score += gained * 60;
        this.bestProgress = prog;
      }

      // ----- reaching the finish line -----
      if (this.p.y <= PLAY.y1 + 6) {
        this.crossFinish();
      }

      // round the score so the HUD stays tidy
      // (kept as a float internally; displayed rounded)
    },

    draw(g) {
      const t = CM.time;
      g.save();
      if (this.shake > 0.2) {
        g.translate(CM.rand(-this.shake, this.shake) * 0.7, CM.rand(-this.shake, this.shake) * 0.7);
      }

      drawRoom(g, t);

      /* ---- depth-sorted sprites ---- */
      const sprites = [];
      for (const d of DECOR) {
        if (d.kind === 'window') continue;             // drawn on the wall, not depth-sorted
        sprites.push({ y: d.y, fn: () => drawDecor(g, d, t) });
      }

      // Badtz-Maru the caller — turns to "stare" on red
      const looking = this.callerLook > 0.5;
      sprites.push({ y: CALLER.y + 60, fn: () => {
        // strict bob when staring, sleepy sway otherwise
        const bob = looking ? (t * 3) % 1 * 0.5 : ((t * 0.8) % 1) * 0.3;
        CM.drawFriend(g, HOST, CALLER.x, CALLER.y + 56, 1.15, { bob: bob, flip: !looking });
        // wagging "no-no" finger on red
        if (looking) {
          const wag = Math.sin(t * 14) * 6;
          g.strokeStyle = '#3a3a3a'; g.lineWidth = 5; g.lineCap = 'round';
          g.beginPath();
          g.moveTo(CALLER.x - 26, CALLER.y + 6);
          g.lineTo(CALLER.x - 26 + wag, CALLER.y - 16);
          g.stroke();
          D.circle(g, CALLER.x - 26 + wag, CALLER.y - 18, 4, '#f2b53c');
        }
        // name tag
        D.rr(g, CALLER.x - 56, CALLER.y + 62, 112, 22, 10, 'rgba(255,255,255,0.85)');
        D.text(g, 'Badtz-Maru', CALLER.x, CALLER.y + 72, { size: 14, color: P.ink, weight: 800 });
      } });

      // player
      sprites.push({ y: this.p.y, fn: () => {
        CM.drawPlayer(g, this.p.x, this.p.y, 1.05, this.p.facing, this.p.phase);
        // little "Z"-free freeze sparkle when stunned
        if (this.stun > 0) {
          const a = (this.stun / STUN);
          g.globalAlpha = a;
          D.star(g, this.p.x - 16, this.p.y - 96, 6, '#fff');
          D.star(g, this.p.x + 16, this.p.y - 90, 5, '#ffd24a');
          g.globalAlpha = 1;
        }
      } });

      sprites.sort((a, b) => a.y - b.y);
      for (const s of sprites) s.fn();

      // window + finish ribbon (always above the floor, framing the top)
      for (const d of DECOR) if (d.kind === 'window') drawDecor(g, d, t);
      drawFinish(g, t);

      // caller speech bubble
      if (this.callerBubble.t > 0 && this.state !== 'howto') {
        const txt = this.callerBubble.text;
        const cw = Math.max(96, txt.length * 9 + 24);
        const bx = CM.clamp(CALLER.x - cw / 2, 8, CM.W - cw - 8);
        D.bubble(g, bx, CALLER.y - 70, cw, 38, CALLER.x);
        D.text(g, txt, bx + cw / 2, CALLER.y - 51, { size: 15, weight: 800, color: P.ink });
      }

      /* ---- particles ---- */
      for (const p of this.parts) {
        g.globalAlpha = Math.max(0, 1 - p.t / p.life);
        if (p.kind === 'star') D.star(g, p.x, p.y, p.size, P.yellowDeep);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, P.pink);
        else if (p.kind === 'conf') {
          g.save(); g.translate(p.x, p.y); g.rotate(p.rot);
          g.fillStyle = p.color; g.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
          g.restore();
        } else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, { size: 18, color: p.color, weight: 800, stroke: '#fff', strokeWidth: 5 });
        }
      }
      g.globalAlpha = 1;

      // count-in overlay
      if (this.state === 'count') {
        const SEGS = ['3', '2', '1', 'Go!'];
        const seg = Math.min(3, Math.floor(this.countT / 0.75));
        const frac = (this.countT - seg * 0.75) / 0.75;
        const size = (seg === 3 ? 80 : 96) * (1 + 0.3 * Math.max(0, 1 - frac * 3));
        D.text(g, SEGS[seg], 480, 320, {
          size: Math.round(size), color: seg === 3 ? P.mintDeep : P.pinkDeep, weight: 800,
          stroke: '#fff', strokeWidth: 10
        });
      }

      g.restore();   // ---- end screen-shake; context normal again ----

      /* ---- BIG light signal (top, very obvious) ---- */
      if (this.state === 'play' || this.state === 'count' || this.state === 'done') {
        this.drawSignal(g, t);
      }

      /* ---- HUD ---- */
      if (this.state !== 'howto') {
        // big friendly countdown, top-center
        const tl = Math.max(0, Math.ceil(this.timeLeft));
        const urgent = tl <= 10 && this.state === 'play';
        const pulse = urgent ? 1 + Math.sin(t * 7) * 0.08 : 1;
        D.rr(g, 416, 10, 128, 44, 22, 'rgba(255,255,255,0.92)', urgent ? P.red : '#f0b9d2', 3);
        D.text(g, '⏱ ' + tl, 480, 33, {
          size: Math.round(27 * pulse), color: urgent ? P.red : P.blueDeep, weight: 800
        });
        // score, top-left
        D.rr(g, 14, 12, 150, 40, 20, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
        D.star(g, 36, 32, 10, '#ffd24a');
        D.text(g, String(Math.round(this.score)), 100, 33, { size: 20, color: P.blueDeep, weight: 800 });
        // crossings, below score
        D.rr(g, 14, 58, 150, 30, 15, 'rgba(255,255,255,0.75)');
        D.text(g, 'Crossings: ' + this.crossings, 89, 73, { size: 14, color: P.pinkDeep, weight: 800 });
      }

      /* ---- big GREEN/RED banner ---- */
      if (this.state === 'play') {
        this.drawLightBanner(g, t);
      }

      /* ---- done banner ---- */
      if (this.state === 'done') {
        D.text(g, this.crossings > 0 ? 'Time! Amazing!' : 'Time! Good try!', 480, 250, {
          size: 46, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
        });
        D.text(g, 'You crossed ' + this.crossings + ' time' + (this.crossings === 1 ? '' : 's') + '!',
          480, 300, { size: 24, color: P.ink, weight: 800, stroke: '#fff', strokeWidth: 6 });
        D.star(g, 250, 240 + Math.sin(t * 5) * 6, 16, P.yellowDeep);
        D.star(g, 710, 240 + Math.cos(t * 5) * 6, 16, P.yellowDeep);
      }

      /* ---- howto overlay ---- */
      if (this.state === 'howto') {
        g.fillStyle = 'rgba(70,40,70,0.28)';
        g.fillRect(0, 0, CM.W, CM.H);
        CM.ui.panel(g, 165, 92, 630, 404, { title: '🚦 Red Light, Green Light 🚦' });
        CM.drawFriend(g, HOST, 268, 392, 1.25, { bob: ((t * 1.1) % 1) * 0.4 });
        D.text(g, 'Badtz-Maru', 268, 414, { size: 14, color: P.pinkDeep, weight: 800 });
        D.text(g, 'GREEN light: dash to the finish ribbon!', 552, 168, { size: 19, color: P.mintDeep, weight: 800 });
        D.text(g, 'RED light: FREEZE — stop moving!', 552, 210, { size: 19, color: P.red, weight: 800 });
        D.text(g, 'Move while red and Badtz nudges', 552, 250, { size: 16, color: P.ink });
        D.text(g, 'you back — but you never lose!', 552, 274, { size: 16, color: P.ink });
        D.text(g, 'Cross the line for big points!', 552, 314, { size: 18, color: P.pinkDeep, weight: 800 });
        const hint = CM.touchMode
          ? 'Hold & drag to walk · let go to freeze'
          : 'Hold Arrows / WASD to walk · release to freeze · or hold the mouse';
        D.text(g, hint, 552, 352, { size: 14, color: '#9a8a94' });
        if (CM.ui.button(g, 452, 398, 200, 58, '▶ Start!', { color: P.mintDeep, size: 22 })) {
          this.beginCount();
        }
      }
    },

    // Big traffic-style signal in the top-center-left (clear of the reserved top-right corner)
    drawSignal(g, t) {
      const sx = 250, sy = 12, sw = 120, sh = 38;
      const on = this.light;
      // housing
      D.rr(g, sx, sy, sw, sh, 12, '#4a4450', '#2f2b35', 3);
      // red lamp (left)
      const redOn = on === 'red';
      const warnBlink = on === 'warn' && (Math.floor(t * 10) % 2 === 0);
      D.circle(g, sx + 30, sy + sh / 2, 13, redOn ? '#ff5b5b' : (warnBlink ? '#ffb14a' : '#6e3030'),
        redOn ? '#fff' : 'rgba(0,0,0,0.2)', redOn ? 3 : 1.5);
      if (redOn || warnBlink) { D.circle(g, sx + 30, sy + sh / 2, 13 + (Math.sin(t * 9) + 1) * 3, null, redOn ? 'rgba(255,90,90,0.4)' : 'rgba(255,180,80,0.4)', 3); }
      // green lamp (right)
      const greenOn = on === 'green';
      D.circle(g, sx + 90, sy + sh / 2, 13, greenOn ? '#67e08a' : '#2e5e3c',
        greenOn ? '#fff' : 'rgba(0,0,0,0.2)', greenOn ? 3 : 1.5);
      if (greenOn) D.circle(g, sx + 90, sy + sh / 2, 13 + (Math.sin(t * 9) + 1) * 3, null, 'rgba(103,224,138,0.4)', 3);
    },

    // The HUGE, obvious word across the screen
    drawLightBanner(g, t) {
      let txt, col;
      if (this.light === 'green') { txt = 'GREEN LIGHT!'; col = P.mintDeep; }
      else if (this.light === 'warn') { txt = 'Get Ready…'; col = P.yellowDeep; }
      else { txt = 'RED LIGHT!'; col = P.red; }
      const pop = 1 + this.bannerFlash * 0.18;
      // soft tinted strip behind so it reads against the floor
      const stripY = 128;
      g.save();
      g.globalAlpha = 0.16 + this.bannerFlash * 0.12;
      g.fillStyle = col;
      g.fillRect(0, stripY, CM.W, 70);
      g.restore();
      D.text(g, txt, 480, stripY + 36, {
        size: Math.round(48 * pop), color: col, weight: 800, stroke: '#fff', strokeWidth: 9
      });
    },

    exit() {}
  });
})();
