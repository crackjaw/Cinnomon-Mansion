/* Cinnamoroll Mansion — Duck Round-Up (hosted by My Melody) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------------- pool layout ----------------
     The pool water fills most of the canvas. Ducks bob and drift across it on
     gentle wavy paths. Tapping a duck scoops it up. The deck frames the pool;
     My Melody cheers from the poolside on the left. */
  const POOL = { x: 70, y: 150, w: 820, h: 410 };      // water rectangle (inner)
  const MELODY = { x: 64, y: 470 };                    // host on the left deck
  const GAME_TIME = 60;
  const TARGET_DUCKS = 8;
  const SPAWN_TRIES = 16;                              // capped retry loop
  const MAX_PARTS = 110;

  // Duck types: weighted spawn bag (golden handled separately, max ~1 on screen).
  const TYPES = {
    yellow: { value: 10, body: '#ffdc5e', belly: '#ffe9a0', beak: '#f2962c', r: 24, speed: 1.0 },
    pink:   { value: 20, body: '#ff9ec7', belly: '#ffd1e6', beak: '#f06292', r: 24, speed: 1.05 },
    golden: { value: 40, body: '#ffd24a', belly: '#fff0b0', beak: '#e8951c', r: 26, speed: 1.55 }
  };
  const SPAWN_BAG = ['yellow', 'yellow', 'yellow', 'yellow', 'yellow', 'pink', 'pink', 'pink'];

  function anyTap() { return CM.input.mouse.clicked; }

  CM.registerGame({
    id: 'ducks',
    name: 'Duck Round-Up',

    /* ================= lifecycle ================= */
    enter() {
      // FULL re-init — this object is reused for "Play Again".
      this.state = 'howto';      // howto -> count -> play -> done (-> finish once)
      this.timeLeft = GAME_TIME;
      this.score = 0;
      this.scooped = 0;
      this.finished = false;

      this.ducks = [];
      this.parts = [];
      this.shake = 0;
      this.countT = 0;
      this.lastSeg = -1;
      this.lastTick = -1;
      this.doneT = 0;
      this.goldCd = CM.rand(3, 7);   // wait before the first golden duck
      this.idSeq = 0;

      this.hostBubble = { text: '', t: 0 };
      this.hostHappy = 0;            // >0 = My Melody bounces happily

      // pre-fill the pool with ducks already drifting
      for (let i = 0; i < TARGET_DUCKS; i++) this.spawnDuck(this.rollType(), true);
    },

    exit() {},

    /* ================= spawning ================= */
    rollType() {
      const hasGold = this.ducks && this.ducks.some((d) => d.type === 'golden');
      if (!hasGold && this.goldCd <= 0 && Math.random() < 0.6) {
        this.goldCd = CM.rand(8, 14);
        return 'golden';
      }
      return CM.pick(SPAWN_BAG);
    },

    // Pick a drift heading + an off-edge start so the duck floats IN, unless
    // `anywhere` (used to pre-fill the pool so it isn't empty at the start).
    spawnDuck(type, anywhere) {
      const def = TYPES[type];
      // mostly horizontal drift with a gentle vertical lean
      const goRight = Math.random() < 0.5;
      const ang = (goRight ? 0 : Math.PI) + CM.rand(-0.5, 0.5);
      const baseSpeed = CM.rand(26, 42) * def.speed;
      const vx = Math.cos(ang) * baseSpeed;
      const vy = Math.sin(ang) * baseSpeed * 0.5;

      let x, y;
      if (anywhere) {
        // scatter across the water with a few capped tries to avoid overlap
        x = CM.rand(POOL.x + 40, POOL.x + POOL.w - 40);
        y = CM.rand(POOL.y + 50, POOL.y + POOL.h - 30);
        for (let i = 0; i < SPAWN_TRIES; i++) {
          if (this.spotOk(x, y)) break;
          x = CM.rand(POOL.x + 40, POOL.x + POOL.w - 40);
          y = CM.rand(POOL.y + 50, POOL.y + POOL.h - 30);
        }
      } else {
        // enter from the edge the duck is heading away from
        y = CM.rand(POOL.y + 50, POOL.y + POOL.h - 30);
        x = vx >= 0 ? POOL.x - 30 : POOL.x + POOL.w + 30;
      }

      this.ducks.push({
        id: this.idSeq++,
        type: type,
        x: x, y: y,
        vx: vx, vy: vy,
        value: def.value,
        r: def.r,
        wph: CM.rand(0, Math.PI * 2),   // bob phase
        wamp: CM.rand(3, 6),            // bob amplitude
        sway: CM.rand(0.6, 1.2),        // wavy-path sway speed
        swayPh: CM.rand(0, Math.PI * 2),
        born: 0,
        flip: vx < 0
      });
    },

    spotOk(x, y) {
      for (const d of this.ducks) {
        if (CM.dist(x, y, d.x, d.y) < 64) return false;
      }
      return true;
    },

    /* ================= particles ================= */
    addPart(p) { if (this.parts.length < MAX_PARTS) this.parts.push(p); },

    splash(x, y, big) {
      // water droplets fly up & out
      const n = big ? 12 : 8;
      for (let i = 0; i < n; i++) {
        const a = -Math.PI / 2 + CM.rand(-1.0, 1.0);
        const sp = CM.rand(80, big ? 220 : 160);
        this.addPart({
          kind: 'drop', x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          t: 0, life: CM.rand(0.4, 0.75), size: CM.rand(3, big ? 7 : 5),
          color: Math.random() < 0.5 ? '#ffffff' : '#bfe7ff'
        });
      }
      // a couple of hearts on the scoop
      const hearts = big ? 4 : 2;
      for (let i = 0; i < hearts; i++) {
        this.addPart({
          kind: 'heart', x: x + CM.rand(-14, 14), y: y - 8,
          vx: CM.rand(-26, 26), vy: CM.rand(-120, -64),
          t: 0, life: 1.0, size: CM.rand(8, 12)
        });
      }
      // sparkles for the golden scoop
      if (big) {
        for (let i = 0; i < 6; i++) {
          this.addPart({
            kind: 'spark', x: x + CM.rand(-18, 18), y: y + CM.rand(-18, 18),
            vx: CM.rand(-40, 40), vy: CM.rand(-90, -20),
            t: 0, life: CM.rand(0.5, 0.9), size: CM.rand(6, 11), color: '#ffe07a'
          });
        }
      }
    },

    floatText(x, y, str, color) {
      this.addPart({ kind: 'txt', x: x, y: y, str: str, color: color, vx: 0, vy: -40, t: 0, life: 1.1 });
    },

    tickParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.t += dt;
        if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'drop') { p.vy += 360 * dt; p.vx *= 1 - dt * 0.6; }
        else if (p.kind === 'heart') p.vy += 30 * dt;
        else if (p.kind === 'spark') { p.vy += 90 * dt; }
      }
    },

    /* ================= scoop ================= */
    scoop(d, idx) {
      this.score += d.value;
      this.scooped++;
      const big = d.type === 'golden';
      this.shake = big ? 7 : (d.type === 'pink' ? 4 : 3);
      CM.audio.play(big ? 'ding' : 'pop');
      CM.audio.play('splash');
      this.splash(d.x, d.y, big);
      this.floatText(d.x, d.y - 22, '+' + d.value,
        big ? '#e0a81f' : (d.type === 'pink' ? P.pinkDeep : '#c98a1f'));

      if (big) { this.say('GOLDEN!! ✨', 2.0); CM.audio.play('cheer'); }
      else if (d.type === 'pink') this.say('Pretty! 💕', 1.3);
      else this.say('Got it!', 1.0);

      // remove + immediately drift a fresh duck in to keep the pool full
      this.ducks.splice(idx, 1);
      this.spawnDuck(this.rollType(), false);
    },

    say(text, t) {
      this.hostBubble = { text: text, t: t };
      this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    beginCount() {
      this.state = 'count';
      this.countT = 0;
      this.lastSeg = -1;
      this.say('Scoop them up!', 2.6);
    },

    /* ================= update ================= */
    update(dt) {
      const inp = CM.input;
      this.shake = Math.max(0, this.shake - dt * 16);
      if (this.hostBubble.t > 0) this.hostBubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      this.tickParts(dt);
      for (const d of this.ducks) d.born += dt;

      /* ----- howto ----- */
      if (this.state === 'howto') {
        if (inp.pressed('action') || CM.input.mouse.clicked) this.beginCount();
        return;
      }

      /* ----- count-in: 3..2..1..Go ----- */
      if (this.state === 'count') {
        // ducks keep drifting during the count-in so the scene feels alive
        this.driftDucks(dt, false);
        this.countT += dt;
        const seg = Math.floor(this.countT / 0.8);
        if (seg !== this.lastSeg && seg <= 3) {
          this.lastSeg = seg;
          if (seg < 3) CM.audio.tone(620 + seg * 90, 0.14, 'triangle', 0.12);
          else CM.audio.play('ding');
        }
        if (this.countT >= 3.4) {
          this.state = 'play';
          this.lastTick = -1;
        }
        return;
      }

      /* ----- done: brief celebrate, then finish exactly once ----- */
      if (this.state === 'done') {
        this.driftDucks(dt, false);
        if (this.parts.length < 70 && Math.random() < 0.3) {
          this.addPart({
            kind: 'spark', x: CM.rand(POOL.x + 40, POOL.x + POOL.w - 40),
            y: CM.rand(POOL.y + 40, POOL.y + POOL.h - 40),
            vx: CM.rand(-30, 30), vy: CM.rand(-70, -20),
            t: 0, life: 0.9, size: CM.rand(6, 12),
            color: CM.pick(['#ffe07a', '#ffb7d5', '#bfe7ff', '#ffffff'])
          });
        }
        this.doneT -= dt;
        if (this.doneT <= 0 && !this.finished) {
          this.finished = true;
          CM.finishGame('ducks', this.score, CM.clamp(Math.ceil(this.score / 15), 5, 30));
        }
        return;
      }

      /* ----- play ----- */
      this.goldCd -= dt;
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
        this.say('Great round-up!', 3);
        CM.audio.play('tada');
        return;
      }

      // drift + remove off-screen ducks (replacing them)
      this.driftDucks(dt, true);

      // tap to scoop — pick the closest duck under the tap (generous radius)
      if (anyTap()) {
        const mx = inp.mouse.x, my = inp.mouse.y;
        let bestIdx = -1, bestDist = Infinity;
        for (let i = 0; i < this.ducks.length; i++) {
          const d = this.ducks[i];
          const hitR = d.r + 14; // forgiving tap target
          const dd = CM.dist(mx, my, d.x, d.y - d.r * 0.3);
          if (dd < hitR && dd < bestDist) { bestDist = dd; bestIdx = i; }
        }
        if (bestIdx >= 0) {
          this.scoop(this.ducks[bestIdx], bestIdx);
        }
      }
    },

    // Move ducks along their gentle wavy paths; optionally recycle off-edge ones.
    driftDucks(dt, recycle) {
      for (let i = this.ducks.length - 1; i >= 0; i--) {
        const d = this.ducks[i];
        d.swayPh += dt * d.sway;
        // wavy vertical wander layered on top of base velocity
        const swayV = Math.cos(d.swayPh) * 14;
        d.x += d.vx * dt;
        d.y += (d.vy + swayV) * dt;
        // keep ducks from wandering off the top/bottom: soft bounce inside pool
        if (d.y < POOL.y + 36) { d.y = POOL.y + 36; d.vy = Math.abs(d.vy) + 4; }
        else if (d.y > POOL.y + POOL.h - 24) { d.y = POOL.y + POOL.h - 24; d.vy = -Math.abs(d.vy) - 4; }
        d.flip = d.vx < 0;

        if (recycle) {
          // drifted off the left/right edge: leave, no penalty, send a new one
          if (d.x < POOL.x - 60 || d.x > POOL.x + POOL.w + 60) {
            this.ducks.splice(i, 1);
            this.spawnDuck(this.rollType(), false);
          }
        }
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

      // ducks, sorted by y so lower ones overlap higher ones
      const sorted = this.ducks.slice().sort((a, b) => a.y - b.y);
      for (const d of sorted) this.drawDuck(g, d, t);

      // My Melody cheering on the left deck
      const happy = this.hostHappy > 0 || this.state === 'done';
      const bob = happy ? (t * 2.4) % 1 : ((t * 0.8) % 1) * 0.35;
      CM.drawFriend(g, 'mymelody', MELODY.x, MELODY.y, 1.12, { bob: bob });

      // particles
      for (const p of this.parts) {
        g.globalAlpha = Math.max(0, 1 - p.t / p.life);
        if (p.kind === 'drop') D.circle(g, p.x, p.y, p.size, p.color);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, P.pink);
        else if (p.kind === 'spark') D.star(g, p.x, p.y, p.size, p.color || P.yellowDeep);
        else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, { size: 22, color: p.color || '#c98a1f', weight: 800, stroke: '#ffffff', strokeWidth: 5 });
        }
      }
      g.globalAlpha = 1;

      // My Melody speech bubble on good moments
      if (this.hostBubble.t > 0 && this.state !== 'howto') {
        const txt = this.hostBubble.text;
        const cw = Math.max(110, txt.length * 9.5 + 28);
        const bx = CM.clamp(MELODY.x - 6, 8, CM.W - cw - 8);
        D.bubble(g, bx, MELODY.y - 150, cw, 42, MELODY.x + 16);
        D.text(g, txt, bx + cw / 2, MELODY.y - 129, { size: 16, weight: 800, color: P.pinkDeep });
      }

      // count-in overlay
      if (this.state === 'count') {
        const SEGS = ['3', '2', '1', 'Go!'];
        const seg = Math.min(3, Math.floor(this.countT / 0.8));
        const frac = (this.countT - seg * 0.8) / 0.8;
        const size = (seg === 3 ? 70 : 92) * (1 + 0.3 * Math.max(0, 1 - frac * 3));
        D.text(g, SEGS[seg], 480, 290, {
          size: Math.round(size), color: P.pinkDeep, weight: 800, stroke: '#ffffff', strokeWidth: 10
        });
      }

      g.restore(); // end screen-shake — context back to normal

      /* ----- HUD (not shaken) ----- */
      if (this.state !== 'howto') {
        // big friendly countdown, top-center
        const tl = Math.max(0, Math.ceil(this.timeLeft));
        const urgent = tl <= 8 && this.state === 'play';
        const pulse = urgent ? 1 + Math.sin(t * 7) * 0.07 : 1;
        D.rr(g, 416, 10, 128, 46, 22, 'rgba(255,255,255,0.92)', urgent ? P.red : '#f0b9d2', 3);
        D.text(g, '⏱ ' + tl, 480, 34, {
          size: Math.round(28 * pulse), color: urgent ? P.red : P.blueDeep, weight: 800
        });
        // score, top-left
        D.rr(g, 14, 12, 156, 42, 21, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
        D.text(g, '🦆', 36, 33, { size: 20 });
        D.text(g, String(this.score), 112, 33, { size: 22, color: '#c98a1f', weight: 800 });
        // early control hint
        if (this.state === 'play' && CM.sceneTime < 11) {
          D.rr(g, 320, 60, 320, 26, 13, 'rgba(255,255,255,0.6)');
          D.text(g, 'Tap a duck to scoop it up!', 480, 73, { size: 14, color: '#7a6b75', weight: 700 });
        }
      }

      /* ----- done banner ----- */
      if (this.state === 'done') {
        D.text(g, "Time's up! 🎉", 480, 230, {
          size: 46, color: P.pinkDeep, weight: 800, stroke: '#ffffff', strokeWidth: 10
        });
        D.text(g, 'You scooped ' + this.scooped + ' ducks for ' + this.score + ' points!',
          480, 278, { size: 22, color: P.ink, weight: 800, stroke: '#ffffff', strokeWidth: 6 });
        D.star(g, 250, 210 + Math.sin(t * 5) * 6, 16, P.yellowDeep);
        D.star(g, 710, 210 + Math.cos(t * 5) * 6, 16, P.yellowDeep);
      }

      /* ----- howto overlay ----- */
      if (this.state === 'howto') {
        g.fillStyle = 'rgba(70,40,70,0.25)';
        g.fillRect(0, 0, CM.W, CM.H);
        CM.ui.panel(g, 165, 86, 630, 404, { title: '🦆 Duck Round-Up 🦆' });
        CM.drawFriend(g, 'mymelody', 270, 392, 1.25, { bob: ((t * 1.1) % 1) * 0.5 });
        D.text(g, 'My Melody', 270, 416, { size: 14, color: P.pinkDeep, weight: 800 });
        D.text(g, 'Cute rubber ducks bob in the pool!', 565, 156, { size: 20, color: P.ink, weight: 800 });
        D.text(g, 'Tap a duck to scoop it up', 565, 200, { size: 17, color: P.ink });
        D.text(g, 'for splashy points! 💦', 565, 226, { size: 17, color: P.ink });
        D.text(g, 'Catch the golden duck for a BIG bonus!', 565, 270, { size: 17, color: P.yellowDeep, weight: 800 });
        D.text(g, 'Scoop as many as you can in 60s!', 565, 314, { size: 18, color: P.pinkDeep, weight: 800 });
        D.text(g, 'Tap anywhere or press Space to start', 565, 352, { size: 14, color: '#9a8a94' });
        if (CM.ui.button(g, 460, 396, 200, 58, '▶ Start!', { color: P.mintDeep, size: 22 })) {
          this.beginCount();
        }
      }
    },

    /* ---------------- poolside scene ---------------- */
    drawScene(g, t) {
      // soft blue sky band
      const sg = g.createLinearGradient(0, 0, 0, 150);
      sg.addColorStop(0, '#cdeeff');
      sg.addColorStop(1, '#e6f6ff');
      g.fillStyle = sg;
      g.fillRect(0, 0, CM.W, 150);
      // a couple of fluffy clouds + a little sun
      g.fillStyle = 'rgba(255,255,255,0.9)';
      this.cloud(g, 150, 54, 1);
      this.cloud(g, 640, 40, 0.8);
      D.circle(g, 110, 44, 26, '#fff3b0');
      D.circle(g, 110, 44, 20, '#ffe98c');

      // pale tile pool deck fills behind everything below the sky
      g.fillStyle = '#f3e6d3';
      g.fillRect(0, 130, CM.W, CM.H - 130);
      // tile grid lines
      g.strokeStyle = 'rgba(180,150,120,0.18)';
      g.lineWidth = 2;
      for (let x = 0; x <= CM.W; x += 60) {
        g.beginPath(); g.moveTo(x, 130); g.lineTo(x, CM.H); g.stroke();
      }
      for (let y = 150; y <= CM.H; y += 60) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(CM.W, y); g.stroke();
      }

      // poolside props on the deck (drawn before the water so the water frames sit on top)
      this.drawUmbrella(g, 760, 138, t);
      this.drawDeckChair(g, 700, 558);
      this.drawLadder(g, POOL.x + POOL.w - 70, t);
      this.drawRingFloat(g, 150, 560, t);

      // pool basin rim (rounded tile lip around the water)
      D.rr(g, POOL.x - 14, POOL.y - 14, POOL.w + 28, POOL.h + 28, 34, '#ffffff', '#e7d6c2', 4);

      // sparkling pool water
      g.save();
      D.rrPath(g, POOL.x, POOL.y, POOL.w, POOL.h, 24);
      g.clip();
      const wg = g.createLinearGradient(0, POOL.y, 0, POOL.y + POOL.h);
      wg.addColorStop(0, P.skyDeep);
      wg.addColorStop(0.55, P.blue);
      wg.addColorStop(1, P.blueDeep);
      g.fillStyle = wg;
      g.fillRect(POOL.x, POOL.y, POOL.w, POOL.h);
      // moving ripple highlights — gentle horizontal wavy lines
      g.strokeStyle = 'rgba(255,255,255,0.22)';
      g.lineWidth = 3;
      for (let row = 0; row < 7; row++) {
        const yy = POOL.y + 36 + row * 56;
        g.beginPath();
        for (let x = POOL.x - 10; x <= POOL.x + POOL.w + 10; x += 14) {
          const off = Math.sin(x * 0.04 + t * 1.3 + row * 0.7) * 6;
          if (x === POOL.x - 10) g.moveTo(x, yy + off);
          else g.lineTo(x, yy + off);
        }
        g.stroke();
      }
      // little sparkle dots that twinkle on the surface
      for (let i = 0; i < 16; i++) {
        const sx = POOL.x + ((i * 137) % (POOL.w - 30)) + 15;
        const sy = POOL.y + ((i * 83) % (POOL.h - 30)) + 15;
        const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.7);
        if (tw > 0.72) {
          g.globalAlpha = (tw - 0.72) / 0.28;
          D.star(g, sx, sy, 3.5, 'rgba(255,255,255,0.95)');
        }
      }
      g.globalAlpha = 1;
      g.restore();
    },

    cloud(g, x, y, s) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      D.ellipse(g, -26, 4, 22, 16, 'rgba(255,255,255,0.92)');
      D.ellipse(g, 0, -4, 28, 20, 'rgba(255,255,255,0.92)');
      D.ellipse(g, 26, 4, 22, 16, 'rgba(255,255,255,0.92)');
      D.rr(g, -44, 4, 88, 14, 7, 'rgba(255,255,255,0.92)');
      g.restore();
    },

    drawUmbrella(g, x, baseY, t) {
      // pole
      D.rr(g, x - 3, baseY - 96, 6, 116, 3, '#c98a55', '#a86c3c', 1.5);
      // canopy with pink/white panels
      const sway = Math.sin(t * 0.7) * 0.05;
      g.save();
      g.translate(x, baseY - 96);
      g.rotate(sway);
      const segs = 6, rad = 78;
      for (let i = 0; i < segs; i++) {
        const a0 = Math.PI + (i / segs) * Math.PI;
        const a1 = Math.PI + ((i + 1) / segs) * Math.PI;
        g.fillStyle = i % 2 ? '#ff9ec7' : '#ffffff';
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a0) * rad, Math.sin(a0) * rad * 0.42);
        g.lineTo(Math.cos(a1) * rad, Math.sin(a1) * rad * 0.42);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = 'rgba(180,120,150,0.35)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(0, 0, rad, rad * 0.42, 0, Math.PI, Math.PI * 2);
      g.stroke();
      D.circle(g, 0, 0, 4, '#f06292');
      g.restore();
    },

    drawDeckChair(g, x, y) {
      D.shadow(g, x, y + 4, 46);
      // seat
      g.save();
      g.translate(x, y);
      // back rest (slanted)
      D.rr(g, -42, -56, 16, 56, 6, '#8ecdf6', '#6aaede', 2);
      // seat slats
      for (let i = 0; i < 4; i++) {
        D.rr(g, -40 + i * 18, -8, 14, 10, 4, i % 2 ? '#ffffff' : '#8ecdf6', '#6aaede', 1.5);
      }
      D.rr(g, -44, -10, 80, 12, 6, '#bfe7ff', '#6aaede', 2);
      // legs
      D.rr(g, -40, 2, 6, 16, 3, '#6aaede');
      D.rr(g, 28, 2, 6, 16, 3, '#6aaede');
      g.restore();
    },

    drawLadder(g, x, t) {
      // two rails going into the water + a couple of rungs above the rim
      const topY = POOL.y - 24;
      const botY = POOL.y + 60;
      g.strokeStyle = '#dfe5ea';
      g.lineWidth = 6;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 12, topY); g.lineTo(x - 12, botY); g.stroke();
      g.beginPath(); g.moveTo(x + 12, topY); g.lineTo(x + 12, botY); g.stroke();
      // curved handle tops
      g.lineWidth = 6;
      g.beginPath(); g.arc(x - 6, topY, 6, Math.PI, Math.PI * 1.5); g.stroke();
      g.beginPath(); g.arc(x + 6, topY, 6, Math.PI * 1.5, Math.PI * 2); g.stroke();
      g.lineWidth = 5;
      for (let i = 0; i < 2; i++) {
        const ry = topY + 16 + i * 18;
        g.beginPath(); g.moveTo(x - 12, ry); g.lineTo(x + 12, ry); g.stroke();
      }
    },

    drawRingFloat(g, x, y, t) {
      D.shadow(g, x, y + 6, 40);
      const bob = Math.sin(t * 1.2) * 2;
      g.save();
      g.translate(x, y + bob);
      // pink-and-white ring float on the deck
      D.circle(g, 0, 0, 36, '#ff9ec7', '#f06292', 3);
      D.circle(g, 0, 0, 18, '#f3e6d3');
      // white quarter stripes
      g.fillStyle = '#ffffff';
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        g.save();
        g.rotate(a);
        g.beginPath();
        g.arc(0, 0, 36, -0.35, 0.35);
        g.arc(0, 0, 18, 0.35, -0.35, true);
        g.closePath();
        g.fill();
        g.restore();
      }
      D.circle(g, 0, 0, 18, null, '#f06292', 2);
      g.restore();
    },

    /* ---------------- a single rubber duck ---------------- */
    drawDuck(g, d, t) {
      const def = TYPES[d.type];
      const bob = Math.sin(t * 2.4 + d.wph) * d.wamp;
      const x = d.x, y = d.y + bob;
      // pop-in scale for a freshly arrived duck
      const s = d.born < 0.3 ? CM.clamp(d.born / 0.3, 0.25, 1) : 1;
      const r = d.r;

      // water ripple ring around the duck where it meets the surface
      g.save();
      g.globalAlpha = 0.4;
      D.ellipse(g, x, y + r * 0.5, r * (1.1 + Math.sin(t * 2 + d.wph) * 0.08), r * 0.34, null, 'rgba(255,255,255,0.6)', 2);
      g.globalAlpha = 1;
      g.restore();

      g.save();
      g.translate(x, y);
      g.scale(d.flip ? -s : s, s);

      // golden glow halo
      if (d.type === 'golden') {
        const tw = 0.5 + 0.5 * Math.sin(t * 5 + d.wph);
        g.globalAlpha = 0.3 + tw * 0.25;
        D.circle(g, 0, -2, r * 1.5, '#fff3b0');
        g.globalAlpha = 1;
      }

      const ol = d.type === 'pink' ? '#f06292' : (d.type === 'golden' ? '#d99a1f' : '#e8a93a');

      // tail
      g.fillStyle = def.body;
      g.beginPath();
      g.moveTo(-r * 0.8, -2);
      g.lineTo(-r * 1.3, -r * 0.55);
      g.lineTo(-r * 0.55, -r * 0.35);
      g.closePath();
      g.fill();
      // body
      D.ellipse(g, 0, 0, r, r * 0.78, def.body, ol, 2.5);
      // belly highlight
      D.ellipse(g, 2, r * 0.18, r * 0.6, r * 0.4, def.belly);
      // wing
      D.ellipse(g, -r * 0.18, -r * 0.05, r * 0.45, r * 0.32, def.belly, ol, 1.8);
      // head
      const hx = r * 0.62, hy = -r * 0.62;
      D.circle(g, hx, hy, r * 0.52, def.body, ol, 2.5);
      // beak
      g.fillStyle = def.beak;
      g.beginPath();
      g.moveTo(hx + r * 0.34, hy + r * 0.02);
      g.lineTo(hx + r * 0.92, hy + r * 0.04);
      g.lineTo(hx + r * 0.9, hy + r * 0.22);
      g.lineTo(hx + r * 0.34, hy + r * 0.2);
      g.closePath();
      g.fill();
      g.strokeStyle = ol; g.lineWidth = 1; g.stroke();
      // eye
      D.circle(g, hx + r * 0.18, hy - r * 0.08, r * 0.11, '#3c3c3c');
      D.circle(g, hx + r * 0.14, hy - r * 0.12, r * 0.04, '#ffffff');
      // cheek blush
      g.fillStyle = 'rgba(255,140,160,0.45)';
      g.beginPath();
      g.ellipse(hx + r * 0.04, hy + r * 0.2, r * 0.13, r * 0.09, 0, 0, Math.PI * 2);
      g.fill();

      // golden crown sparkle on top
      if (d.type === 'golden') {
        D.star(g, hx, hy - r * 0.62, r * 0.22, '#fff3b0');
      }
      g.restore();
    }
  });
})();
