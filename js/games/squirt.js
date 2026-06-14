/* Cinnamoroll Mansion — Squirt-a-Splash (hosted by Kuromi) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  const GAME_TIME = 60;
  const MAX_PARTS = 110;

  // Six fixed "spots" — inner tubes / floats around the pool where targets pop up.
  // Each target rises from behind its float, so we draw the head clipped at the
  // float's waterline. cy is the float (and water surface) centre.
  const SPOTS = [
    { cx: 250, cy: 360, tube: '#ff9ec7' },
    { cx: 480, cy: 330, tube: '#ffe9a8' },
    { cx: 710, cy: 360, tube: '#bdeccd' },
    { cx: 200, cy: 470, tube: '#d8c9f2' },
    { cx: 480, cy: 500, tube: '#8ecdf6' },
    { cx: 760, cy: 470, tube: '#ff9ec7' }
  ];

  // Target kinds. friend = a cute Sanrio head, bull = bullseye, star = bonus.
  const KINDS = {
    friend: { points: 5, color: '#ff9ec7' },
    bull:   { points: 9, color: '#ef5b5b' },
    star:   { points: 15, color: '#ffe07a' }
  };
  const FRIEND_IDS = ['cinnamoroll', 'mymelody', 'pompompurin', 'keroppi', 'pochacco', 'hellokitty'];

  const KURO = { x: 882, y: 250 };   // Kuromi cheering on the right deck

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'squirt',
    name: 'Squirt-a-Splash',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';          // howto -> count -> play -> done (-> finish once)
      this.timeLeft = GAME_TIME;
      this.score = 0;
      this.hits = 0;
      this.finished = false;

      // per-spot target state
      this.spots = SPOTS.map(function (s, i) {
        return {
          cx: s.cx, cy: s.cy, tube: s.tube,
          active: false, kind: 'friend', friend: FRIEND_IDS[i % FRIEND_IDS.length],
          up: 0,            // 0 hidden .. 1 fully up
          phase: 'rest',    // 'rest' | 'rise' | 'hold' | 'duck' | 'hit'
          t: 0, hold: 1.4,
          react: 0,         // happy wobble after a squirt
          bob: CM.rand(0, Math.PI * 2),
          ripple: 0
        };
      });

      this.spawnCd = 0.6;
      this.parts = [];
      this.crosshair = { x: 480, y: 360 };
      this.gun = { x: 480, y: 600, t: 0 };  // recoil timer for the water gun
      this.shake = 0;
      this.countT = 0;
      this.lastSeg = -1;
      this.lastTick = -1;
      this.doneT = 0;
      this.bubble = { text: '', t: 0 };
      this.hostHappy = 0;
      this.combo = 0;
      this.comboT = 0;
    },

    exit() {},

    /* ================= spawning ================= */
    // difficulty ramps gently: targets stay up plenty long for a 6-year-old,
    // but the gap between pop-ups shrinks and holds get a touch shorter.
    progress() {
      return CM.clamp(1 - this.timeLeft / GAME_TIME, 0, 1);
    },

    rollKind() {
      const r = Math.random();
      if (r < 0.16) return 'star';
      if (r < 0.48) return 'bull';
      return 'friend';
    },

    popRandom() {
      const idle = [];
      for (let i = 0; i < this.spots.length; i++) {
        if (this.spots[i].phase === 'rest') idle.push(i);
      }
      if (!idle.length) return;
      const sp = this.spots[CM.pick(idle)];
      sp.kind = this.rollKind();
      sp.friend = CM.pick(FRIEND_IDS);
      sp.phase = 'rise';
      sp.t = 0;
      // hold time shrinks with progress but never below a comfortable window
      const pr = this.progress();
      sp.hold = CM.lerp(1.7, 1.0, pr) + (sp.kind === 'star' ? -0.15 : 0);
      sp.up = 0;
      sp.ripple = 1;
    },

    /* ================= particles ================= */
    addPart(p) { if (this.parts.length < MAX_PARTS) this.parts.push(p); },

    splash(x, y, n, color, strong) {
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + CM.rand(-1, 1) * (strong ? 1.4 : 1.0);
        const sp = CM.rand(strong ? 130 : 80, strong ? 320 : 200);
        this.addPart({
          kind: 'drop', x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          t: 0, life: CM.rand(0.4, 0.8),
          size: CM.rand(3, strong ? 7 : 5),
          color: color || '#bfe7ff'
        });
      }
    },

    celebrate(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.addPart({
          kind: Math.random() < 0.5 ? 'star' : 'heart',
          x: x + CM.rand(-16, 16), y: y - 8,
          vx: CM.rand(-90, 90), vy: CM.rand(-200, -60),
          t: 0, life: CM.rand(0.6, 1.15),
          size: CM.rand(7, 13),
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep]),
          rot: CM.rand(0, 6), vr: CM.rand(-5, 5)
        });
      }
    },

    floatText(x, y, str, color) {
      this.addPart({ kind: 'txt', x: x, y: y, str: str, color: color, vx: 0, vy: -42, t: 0, life: 1.0 });
    },

    tickParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.t += dt;
        if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'drop') { p.vy += 520 * dt; p.vx *= 1 - dt * 0.6; }
        else if (p.kind === 'star' || p.kind === 'heart') { p.vy += 260 * dt; p.rot += p.vr * dt; }
      }
    },

    /* ================= squirting ================= */
    say(text, t) {
      this.bubble = { text: text, t: t };
      this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    // pick the front-most active target under (x,y)
    targetAt(x, y) {
      let best = null;
      for (const sp of this.spots) {
        if ((sp.phase === 'rise' || sp.phase === 'hold') && sp.up > 0.35) {
          const hx = sp.cx;
          const hy = sp.cy - 36 - sp.up * 30;   // head centre while popped up
          const r = 46;
          if (CM.dist(x, y, hx, hy) < r) {
            if (!best || sp.cy > best.cy) best = sp;   // nearer (lower) wins
          }
        }
      }
      return best;
    },

    fireAt(x, y) {
      // aim the gun + recoil
      this.crosshair.x = x;
      this.crosshair.y = y;
      this.gun.t = 0.18;
      CM.audio.play('splash');

      const sp = this.targetAt(x, y);
      if (sp) {
        this.hit(sp);
      } else {
        // harmless little splash — no penalty, just a gentle plip
        this.splash(x, y, 7, '#cdeeff', false);
        this.combo = 0;
      }
    },

    hit(sp) {
      const def = KINDS[sp.kind];
      this.combo += 1;
      this.comboT = 1.2;
      const bonus = Math.min(this.combo - 1, 4) * 1;   // gentle combo sweetener
      const gained = def.points + bonus;
      this.score += gained;
      this.hits += 1;

      sp.phase = 'hit';
      sp.t = 0;
      sp.react = 1;

      const hx = sp.cx, hy = sp.cy - 36 - sp.up * 30;
      this.splash(hx, hy, sp.kind === 'star' ? 16 : 11, def.color, sp.kind !== 'friend');
      this.splash(hx, hy + 8, 8, '#bfe7ff', false);
      this.floatText(hx, hy - 30, '+' + gained, sp.kind === 'star' ? '#e0a81f' : (sp.kind === 'bull' ? P.pinkDeep : P.blueDeep));

      if (sp.kind === 'star') {
        this.shake = 8;
        this.celebrate(hx, hy, 16);
        CM.audio.play('tada');
        this.say('SO good!! ✨', 1.6);
      } else if (sp.kind === 'bull') {
        this.shake = 5;
        this.celebrate(hx, hy, 8);
        CM.audio.play('ding');
        this.say(CM.pick(['Bullseye!', 'Direct hit!', 'Splash!']), 1.2);
      } else {
        this.shake = 3;
        this.celebrate(hx, hy, 5);
        CM.audio.play('pop');
        if (this.combo >= 3) this.say('Combo x' + this.combo + '!', 1.2);
        else this.say(CM.pick(['Gotcha!', 'Squirt!', 'Hehe!']), 1.0);
      }
    },

    beginCount() {
      this.state = 'count';
      this.countT = 0;
      this.lastSeg = -1;
      this.say('Soak \'em all!', 2.4);
    },

    /* ================= update ================= */
    update(dt) {
      if (this.shake > 0.2) this.shake = Math.max(0, this.shake - dt * 16);
      if (this.bubble.t > 0) this.bubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      if (this.comboT > 0) { this.comboT -= dt; if (this.comboT <= 0) this.combo = 0; }
      if (this.gun.t > 0) this.gun.t -= dt;
      this.tickParts(dt);

      // gentle idle bob for floats + ripple decay (every state, for liveliness)
      for (const sp of this.spots) {
        sp.bob += dt;
        if (sp.ripple > 0) sp.ripple = Math.max(0, sp.ripple - dt * 1.6);
        if (sp.react > 0) sp.react = Math.max(0, sp.react - dt * 2.2);
      }

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.beginCount();
          return;

        case 'count': {
          this.countT += dt;
          const seg = Math.floor(this.countT / 0.8);
          if (seg !== this.lastSeg && seg <= 3) {
            this.lastSeg = seg;
            if (seg < 3) CM.audio.tone(620 + seg * 90, 0.14, 'triangle', 0.12);
            else CM.audio.play('ding');
          }
          if (this.countT >= 3.4) { this.state = 'play'; this.lastTick = -1; }
          return;
        }

        case 'done': {
          if (this.parts.length < 70 && Math.random() < 0.3) {
            this.addPart({
              kind: 'star', x: CM.rand(160, 800), y: CM.rand(150, 360),
              vx: CM.rand(-40, 40), vy: CM.rand(-90, -30),
              t: 0, life: 1.0, size: CM.rand(7, 13),
              color: CM.pick(['#ffe07a', '#ffb7d5', '#9ed8f8', '#bdeccd']),
              rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
            });
          }
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('squirt', this.score, CM.clamp(Math.ceil(this.score / 20), 5, 30));
          }
          return;
        }
      }

      /* ----- play ----- */
      this.timeLeft -= dt;
      const tl = Math.ceil(this.timeLeft);
      if (tl <= 8 && tl >= 1 && tl !== this.lastTick) {
        this.lastTick = tl;
        CM.audio.tone(780, 0.06, 'sine', 0.06);
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.state = 'done';
        this.doneT = 1.9;
        this.shake = 7;
        this.say('Great splashing!', 3);
        CM.audio.play('cheer');
        this.celebrate(480, 300, 16);
        return;
      }

      // advance each spot's pop-up cycle
      for (const sp of this.spots) {
        sp.t += dt;
        if (sp.phase === 'rise') {
          sp.up = CM.clamp(sp.up + dt / 0.22, 0, 1);
          if (sp.up >= 1) { sp.phase = 'hold'; sp.t = 0; }
        } else if (sp.phase === 'hold') {
          if (sp.t >= sp.hold) { sp.phase = 'duck'; sp.t = 0; }
        } else if (sp.phase === 'duck') {
          sp.up = CM.clamp(sp.up - dt / 0.26, 0, 1);
          if (sp.up <= 0) { sp.phase = 'rest'; sp.t = 0; sp.ripple = 0.7; }
        } else if (sp.phase === 'hit') {
          // happy little duck after being squirted
          sp.up = CM.clamp(sp.up - dt / 0.2, 0, 1);
          if (sp.up <= 0) { sp.phase = 'rest'; sp.t = 0; sp.ripple = 0.8; }
        }
      }

      // spawn pacing — keep 1-3 targets up; faster as the game goes on
      this.spawnCd -= dt;
      const activeCount = this.spots.filter(function (s) { return s.phase === 'rise' || s.phase === 'hold'; }).length;
      const pr = this.progress();
      if (this.spawnCd <= 0 && activeCount < (pr > 0.5 ? 3 : 2)) {
        this.popRandom();
        this.spawnCd = CM.lerp(1.1, 0.55, pr) + CM.rand(0, 0.35);
      }

      // fire on tap/click anywhere (mouse = touch). Keyboard action squirts the centre.
      if (CM.input.mouse.clicked) {
        this.fireAt(CM.input.mouse.x, CM.input.mouse.y);
      } else if (CM.input.pressed('action')) {
        // keyboard: snap the crosshair to the nearest active target before firing
        let tgt = null, bd = 1e9;
        for (const sp of this.spots) {
          if ((sp.phase === 'rise' || sp.phase === 'hold') && sp.up > 0.35) {
            const hy = sp.cy - 36 - sp.up * 30;
            const d = CM.dist(this.crosshair.x, this.crosshair.y, sp.cx, hy);
            if (d < bd) { bd = d; tgt = { x: sp.cx, y: hy }; }
          }
        }
        if (tgt) { this.crosshair.x = tgt.x; this.crosshair.y = tgt.y; }
        this.fireAt(this.crosshair.x, this.crosshair.y);
      }
      // crosshair follows the pointer for a friendly aiming reticle
      if (CM.input.mouse.x > -500) {
        this.crosshair.x = CM.lerp(this.crosshair.x, CM.input.mouse.x, 0.5);
        this.crosshair.y = CM.lerp(this.crosshair.y, CM.input.mouse.y, 0.5);
      }
    },

    /* ================= draw ================= */
    draw(g) {
      const t = CM.time;
      g.save();
      if (this.shake > 0.2) {
        g.translate(CM.rand(-this.shake, this.shake) * 0.7, CM.rand(-this.shake, this.shake) * 0.7);
      }

      this.drawScene(g, t);

      // depth-sorted: floats + their targets, far (higher) first
      const ordered = this.spots.slice().sort(function (a, b) { return a.cy - b.cy; });
      for (const sp of ordered) this.drawSpot(g, sp, t);

      // Kuromi cheering on the right deck (drawn over the water edge)
      const happy = this.hostHappy > 0 || this.state === 'done';
      const bob = happy ? (t * 2.4) % 1 : ((t * 0.8) % 1) * 0.35;
      CM.drawFriend(g, 'kuromi', KURO.x, KURO.y, 1.12, { bob: bob, flip: true });

      // the player aiming a water gun from the bottom-centre deck
      this.drawPlayerGun(g, t);

      this.drawParts(g);
      g.restore();   // end screen-shake — context is balanced

      /* ----- HUD (never shaken) ----- */
      if (this.state !== 'howto') this.drawHud(g, t);

      // crosshair (during play only)
      if (this.state === 'play') this.drawCrosshair(g, t);

      // count-in overlay
      if (this.state === 'count') {
        const SEGS = ['3', '2', '1', 'Go!'];
        const seg = Math.min(3, Math.floor(this.countT / 0.8));
        const frac = (this.countT - seg * 0.8) / 0.8;
        const size = (seg === 3 ? 70 : 92) * (1 + 0.3 * Math.max(0, 1 - frac * 3));
        D.text(g, SEGS[seg], 480, 250, {
          size: Math.round(size), color: P.lavenderDeep, weight: 800,
          stroke: '#ffffff', strokeWidth: 10
        });
      }

      // Kuromi speech bubble on good moments
      if (this.bubble.t > 0 && this.state !== 'howto') {
        const txt = this.bubble.text;
        const cw = Math.max(110, txt.length * 9.5 + 26);
        const bx = CM.clamp(KURO.x - cw + 30, 8, CM.W - cw - 8);
        D.bubble(g, bx, KURO.y - 168, cw, 42, KURO.x - 16);
        D.text(g, txt, bx + cw / 2, KURO.y - 147, { size: 15, weight: 800, color: P.lavenderDeep });
      }

      if (this.state === 'done') this.drawDone(g, t);
      if (this.state === 'howto') this.drawHowto(g, t);
    },

    /* ----- poolside scene ----- */
    drawScene(g, t) {
      // soft blue sky
      const sky = g.createLinearGradient(0, 0, 0, 220);
      sky.addColorStop(0, '#d6f0ff');
      sky.addColorStop(1, '#eaf8ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, CM.W, 220);
      // fluffy clouds
      this.cloud(g, 150, 60, 1.0);
      this.cloud(g, 640, 44, 1.3);
      this.cloud(g, 420, 96, 0.8);
      // warm little sun
      D.circle(g, 70, 56, 26, '#fff3b0');
      g.globalAlpha = 0.5;
      D.circle(g, 70, 56, 34, '#fff7d0');
      g.globalAlpha = 1;

      // pale tile pool deck
      const deck = g.createLinearGradient(0, 180, 0, CM.H);
      deck.addColorStop(0, '#fdeede');
      deck.addColorStop(1, '#ffe6cf');
      g.fillStyle = deck;
      g.fillRect(0, 180, CM.W, CM.H - 180);
      // tile seams
      g.strokeStyle = 'rgba(210,170,130,0.25)';
      g.lineWidth = 2;
      for (let x = 0; x <= CM.W; x += 80) { g.beginPath(); g.moveTo(x, 180); g.lineTo(x, CM.H); g.stroke(); }
      for (let y = 220; y < CM.H; y += 60) { g.beginPath(); g.moveTo(0, y); g.lineTo(CM.W, y); g.stroke(); }

      // the pool — a big rounded basin of sparkling water
      const px = 90, py = 250, pw = 780, ph = 290;
      D.rr(g, px - 8, py - 8, pw + 16, ph + 16, 60, '#cfe8ff', '#bcd9f0', 6); // tile lip
      const water = g.createLinearGradient(0, py, 0, py + ph);
      water.addColorStop(0, P.blue);
      water.addColorStop(0.55, P.skyDeep);
      water.addColorStop(1, P.blueDeep);
      g.save();
      D.rrPath(g, px, py, pw, ph, 52);
      g.clip();
      g.fillStyle = water;
      g.fillRect(px, py, pw, ph);
      // gentle ripple highlights
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 3;
      for (let i = 0; i < 6; i++) {
        const yy = py + 30 + i * 46;
        g.beginPath();
        for (let xx = px; xx <= px + pw; xx += 10) {
          const yo = Math.sin(xx * 0.03 + t * 1.3 + i) * 4;
          if (xx === px) g.moveTo(xx, yy + yo); else g.lineTo(xx, yy + yo);
        }
        g.stroke();
      }
      // sparkles
      for (let i = 0; i < 10; i++) {
        const sx = px + ((i * 137 + 40) % pw);
        const sy = py + 24 + ((i * 91 + t * 18) % (ph - 40));
        const tw = 0.5 + 0.5 * Math.sin(t * 3 + i);
        if (tw > 0.55) {
          g.globalAlpha = (tw - 0.55) / 0.45;
          D.star(g, sx, sy, 4, 'rgba(255,255,255,0.9)');
          g.globalAlpha = 1;
        }
      }
      g.restore();

      // poolside props
      this.drawUmbrella(g, 58, 250);
      this.drawChair(g, 884, 470);
      this.drawLadder(g, 858, 300);
      // beach ball resting on the deck
      this.drawBeachBall(g, 120, 545, t);
    },

    cloud(g, x, y, s) {
      g.fillStyle = 'rgba(255,255,255,0.92)';
      D.ellipse(g, x, y, 34 * s, 20 * s, 'rgba(255,255,255,0.92)');
      D.ellipse(g, x - 28 * s, y + 6 * s, 22 * s, 15 * s, 'rgba(255,255,255,0.92)');
      D.ellipse(g, x + 30 * s, y + 6 * s, 24 * s, 16 * s, 'rgba(255,255,255,0.92)');
    },

    drawUmbrella(g, x, y) {
      D.shadow(g, x, y + 8, 30);
      g.strokeStyle = '#c79a6a'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y - 96); g.lineTo(x, y + 8); g.stroke();
      // canopy — pink/white panels
      const cols = ['#ff9ec7', '#ffffff'];
      for (let i = 0; i < 6; i++) {
        const a0 = Math.PI + (i / 6) * Math.PI;
        const a1 = Math.PI + ((i + 1) / 6) * Math.PI;
        g.fillStyle = cols[i % 2];
        g.beginPath();
        g.moveTo(x, y - 96);
        g.lineTo(x + Math.cos(a0) * 58, y - 96 - Math.sin(a0) * 24 + 24);
        g.lineTo(x + Math.cos(a1) * 58, y - 96 - Math.sin(a1) * 24 + 24);
        g.closePath(); g.fill();
      }
      D.circle(g, x, y - 100, 4, '#f06292');
    },

    drawChair(g, x, y) {
      D.shadow(g, x, y + 6, 28);
      g.save();
      g.translate(x, y);
      D.rr(g, -34, -6, 56, 12, 5, '#ffd9e8', '#f0b9d2', 2);   // seat
      D.rr(g, 14, -52, 12, 50, 5, '#ffd9e8', '#f0b9d2', 2);   // backrest
      g.strokeStyle = '#f0b9d2'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-30, 6); g.lineTo(-36, 26); g.stroke();
      g.beginPath(); g.moveTo(14, 6); g.lineTo(20, 26); g.stroke();
      g.restore();
    },

    drawLadder(g, x, y) {
      g.strokeStyle = '#cfd8e0'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 12, y - 40); g.lineTo(x - 12, y + 40); g.stroke();
      g.beginPath(); g.moveTo(x + 12, y - 40); g.lineTo(x + 12, y + 40); g.stroke();
      for (let i = 0; i < 3; i++) {
        const yy = y - 24 + i * 24;
        g.beginPath(); g.moveTo(x - 12, yy); g.lineTo(x + 12, yy); g.stroke();
      }
    },

    drawBeachBall(g, x, y, t) {
      D.shadow(g, x, y + 16, 22);
      const r = 20;
      const wob = Math.sin(t * 1.5) * 0.1;
      D.circle(g, x, y, r, '#ffffff', '#e6dbe0', 2);
      const cols = ['#ff9ec7', '#8ecdf6', '#ffe9a8', '#bdeccd'];
      for (let i = 0; i < 4; i++) {
        const a = wob + (i / 4) * Math.PI;
        g.fillStyle = cols[i];
        g.beginPath();
        g.moveTo(x, y);
        g.arc(x, y, r, a, a + Math.PI / 4);
        g.closePath(); g.fill();
      }
      D.circle(g, x, y, 4, '#fff', '#e6dbe0', 1.5);
      D.circle(g, x - 6, y - 7, 4, 'rgba(255,255,255,0.7)');
    },

    /* ----- a spot: float + (maybe) a popped-up target ----- */
    drawSpot(g, sp, t) {
      const bobY = Math.sin(sp.bob * 1.4) * 3;
      const cx = sp.cx, cy = sp.cy + bobY;

      // ripple ring on the water when something pops/ducks
      if (sp.ripple > 0) {
        g.globalAlpha = sp.ripple * 0.6;
        const rr = (1 - sp.ripple) * 44 + 22;
        D.ellipse(g, cx, cy + 6, rr, rr * 0.4, null, 'rgba(255,255,255,0.8)', 3);
        g.globalAlpha = 1;
      }

      // the target head rises from behind the float, clipped at the waterline
      if (sp.up > 0.02) {
        const rise = sp.up * 64;
        g.save();
        // clip so the head only shows above the float's waterline
        g.beginPath();
        g.rect(cx - 70, 0, 140, (cy - 4) - 0);
        g.clip();
        const wob = sp.react > 0 ? Math.sin(sp.react * 18) * 0.12 : Math.sin(sp.bob * 2) * 0.04;
        g.translate(cx, cy + 18 - rise);
        g.rotate(wob);
        this.drawTargetHead(g, sp);
        g.restore();
      }

      // the inner-tube float itself (drawn over the head's base = sitting in the tube)
      this.drawFloat(g, cx, cy, sp.tube);
    },

    drawFloat(g, cx, cy, tube) {
      // water shadow under the tube
      g.globalAlpha = 0.18;
      D.ellipse(g, cx, cy + 14, 50, 14, '#1a4f7a');
      g.globalAlpha = 1;
      // ring
      D.ellipse(g, cx, cy, 48, 26, tube, 'rgba(255,255,255,0.7)', 3);
      // white stripe segments
      g.save();
      D.ellipse(g, cx, cy, 48, 26, null);
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let i = 0; i < 4; i++) {
        g.save();
        g.translate(cx, cy);
        g.rotate((i / 4) * Math.PI);
        g.fillRect(-6, -30, 12, 60);
        g.restore();
      }
      g.restore();
      // inner hole = water
      D.ellipse(g, cx, cy + 1, 26, 13, '#5fb0e6', 'rgba(255,255,255,0.5)', 2);
      // little shine
      D.ellipse(g, cx - 24, cy - 10, 9, 4, 'rgba(255,255,255,0.7)');
    },

    drawTargetHead(g, sp) {
      // feet-anchored character art is ~95px tall; we want just the head bobbing
      // out of the tube, so draw the friend with feet a bit below origin.
      if (sp.kind === 'friend') {
        CM.drawFriend(g, sp.friend, 0, 34, 0.92, { shadow: false });
      } else if (sp.kind === 'bull') {
        this.drawBullseye(g, 0, -8, 30);
      } else { // star
        this.drawStarTarget(g, 0, -8, 30);
      }
    },

    drawBullseye(g, x, y, r) {
      D.circle(g, x, y, r, '#ffffff', '#e6dbe0', 3);
      D.circle(g, x, y, r * 0.72, '#ef5b5b');
      D.circle(g, x, y, r * 0.46, '#ffffff');
      D.circle(g, x, y, r * 0.22, '#ef5b5b');
      // cute little face
      g.fillStyle = '#4a3b46';
      D.ellipse(g, x - 8, y - 3, 2, 3, '#4a3b46');
      D.ellipse(g, x + 8, y - 3, 2, 3, '#4a3b46');
      g.strokeStyle = '#4a3b46'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.arc(x, y + 4, 5, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    },

    drawStarTarget(g, x, y, r) {
      g.globalAlpha = 0.4;
      D.star(g, x, y, r * 1.4, '#fff3b0');
      g.globalAlpha = 1;
      D.star(g, x, y, r + 3, '#e8be3a');
      D.star(g, x, y, r, '#ffe07a');
      // sweet face
      D.circle(g, x - 8, y - 2, 2.4, '#4a3b46');
      D.circle(g, x + 8, y - 2, 2.4, '#4a3b46');
      g.strokeStyle = '#4a3b46'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.arc(x, y + 3, 5, 0.1 * Math.PI, 0.9 * Math.PI); g.stroke();
      D.ellipse(g, x - 12, y + 3, 3, 2, 'rgba(255,140,160,0.6)');
      D.ellipse(g, x + 12, y + 3, 3, 2, 'rgba(255,140,160,0.6)');
    },

    /* ----- the player + water gun at the bottom ----- */
    drawPlayerGun(g, t) {
      const recoil = this.gun.t > 0 ? this.gun.t / 0.18 : 0;
      const px = 480 + recoil * CM.rand(-1.5, 1.5);
      // player peeking up from the bottom deck, facing up toward the pool
      CM.drawPlayer(g, px, 600, 1.05, 'up', 0);
      // water gun held up, aimed at the crosshair
      const gx = px + 20, gy = 540;
      const aimX = this.crosshair.x, aimY = this.crosshair.y;
      const ang = Math.atan2(aimY - gy, aimX - gx);
      g.save();
      g.translate(gx, gy);
      g.rotate(ang);
      // gun body
      D.rr(g, -6, -7, 34, 14, 5, P.mintDeep, '#4f9c6f', 2);
      D.rr(g, 26, -5, 12, 6, 3, '#bfe7ff', '#9cc7e0', 1.5);  // nozzle
      D.rr(g, -10, 4, 10, 16, 4, P.mint, '#4f9c6f', 2);      // grip
      // tank
      D.circle(g, 2, -10, 7, '#bfe7ff', '#9cc7e0', 1.5);
      g.restore();
      // a quick water spray burst when firing
      if (recoil > 0) {
        g.globalAlpha = recoil;
        for (let i = 0; i < 4; i++) {
          const f = i / 4;
          const sx = CM.lerp(gx + Math.cos(ang) * 34, aimX, f);
          const sy = CM.lerp(gy + Math.sin(ang) * 34, aimY, f);
          D.circle(g, sx, sy, 4 * (1 - f) + 2, 'rgba(180,225,255,0.8)');
        }
        g.globalAlpha = 1;
      }
    },

    drawCrosshair(g, t) {
      const c = this.crosshair;
      const pulse = 1 + Math.sin(t * 6) * 0.12;
      g.save();
      g.globalAlpha = 0.85;
      g.strokeStyle = P.pinkDeep;
      g.lineWidth = 3;
      g.beginPath(); g.arc(c.x, c.y, 16 * pulse, 0, Math.PI * 2); g.stroke();
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(c.x - 22, c.y); g.lineTo(c.x - 9, c.y);
      g.moveTo(c.x + 9, c.y); g.lineTo(c.x + 22, c.y);
      g.moveTo(c.x, c.y - 22); g.lineTo(c.x, c.y - 9);
      g.moveTo(c.x, c.y + 9); g.lineTo(c.x, c.y + 22);
      g.stroke();
      D.circle(g, c.x, c.y, 2.5, P.pinkDeep);
      g.restore();
    },

    /* ----- particles ----- */
    drawParts(g) {
      for (const p of this.parts) {
        g.globalAlpha = Math.max(0, 1 - p.t / p.life);
        if (p.kind === 'drop') {
          D.circle(g, p.x, p.y, p.size, p.color);
          g.globalAlpha = Math.max(0, (1 - p.t / p.life)) * 0.5;
          D.circle(g, p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.4, '#ffffff');
        } else if (p.kind === 'star') {
          D.star(g, p.x, p.y, p.size, p.color, p.rot);
        } else if (p.kind === 'heart') {
          D.heart(g, p.x, p.y, p.size, p.color);
        } else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, { size: 22, color: p.color, weight: 800, stroke: '#ffffff', strokeWidth: 5 });
        }
      }
      g.globalAlpha = 1;
    },

    /* ----- HUD ----- */
    drawHud(g, t) {
      // big friendly countdown, top-center
      const tl = Math.max(0, Math.ceil(this.timeLeft));
      const urgent = tl <= 8 && this.state === 'play';
      const pulse = urgent ? 1 + Math.sin(t * 7) * 0.07 : 1;
      D.rr(g, 416, 10, 128, 44, 22, 'rgba(255,255,255,0.9)', urgent ? P.red : '#bcd9f0', 3);
      D.text(g, '💦 ' + tl, 480, 33, {
        size: Math.round(27 * pulse),
        color: urgent ? P.red : P.blueDeep, weight: 800
      });
      // score, top-left
      D.rr(g, 14, 12, 168, 44, 20, 'rgba(255,255,255,0.9)', '#bcd9f0', 2);
      D.text(g, 'Splashes', 26, 25, { size: 14, color: '#7a8fa6', weight: 800, align: 'left' });
      D.text(g, String(this.score), 26, 44, { size: 22, color: P.blueDeep, weight: 800, align: 'left' });
      // combo chip
      if (this.combo >= 2 && this.comboT > 0) {
        g.globalAlpha = CM.clamp(this.comboT / 1.2 + 0.3, 0, 1);
        D.rr(g, 192, 16, 86, 36, 18, P.lavender, '#fff', 2);
        D.text(g, 'x' + this.combo, 235, 35, { size: 20, color: '#fff', weight: 800 });
        g.globalAlpha = 1;
      }
    },

    drawDone(g, t) {
      g.fillStyle = 'rgba(255,255,255,0.3)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.text(g, 'Time\'s up! 🎉', 480, 230, {
        size: 48, color: P.lavenderDeep, weight: 800, stroke: '#ffffff', strokeWidth: 10
      });
      D.text(g, 'You squirted ' + this.hits + ' targets for ' + this.score + ' points!',
        480, 282, { size: 22, color: P.ink, weight: 800, stroke: '#ffffff', strokeWidth: 6 });
      D.star(g, 250, 218 + Math.sin(t * 5) * 6, 16, P.yellowDeep);
      D.star(g, 710, 218 + Math.cos(t * 5) * 6, 16, P.yellowDeep);
    },

    drawHowto(g, t) {
      g.fillStyle = 'rgba(70,40,70,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 165, 90, 630, 396, { title: '💦 Squirt-a-Splash 💦' });
      CM.drawFriend(g, 'kuromi', 268, 392, 1.28, { bob: ((t * 1.1) % 1) * 0.5 });
      D.text(g, 'Kuromi', 268, 416, { size: 14, color: P.lavenderDeep, weight: 800 });
      D.text(g, 'Cute targets pop out of the pool!', 562, 160, { size: 20, color: P.ink, weight: 800 });
      D.text(g, 'Tap a target to SQUIRT it', 562, 204, { size: 17, color: P.ink });
      D.text(g, 'with your water gun for points!', 562, 230, { size: 17, color: P.ink });
      D.text(g, 'Bullseyes & golden ★ are worth more!', 562, 274, { size: 17, color: P.yellowDeep, weight: 800 });
      D.text(g, 'Soak as many as you can in 60s!', 562, 318, { size: 18, color: P.lavenderDeep, weight: 800 });
      D.text(g, CM.touchMode ? 'Just tap the targets!' : 'Click the targets (or press Space)', 562, 354, { size: 14, color: '#9a8a94' });
      if (CM.ui.button(g, 462, 398, 200, 58, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.beginCount();
      }
    }
  });
})();
