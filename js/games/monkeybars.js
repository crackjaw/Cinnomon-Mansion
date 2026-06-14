/* Cinnamoroll Mansion — Monkey Bars (hosted by Badtz-Maru) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------------- playground layout ----------------
     The monkey-bar frame is a horizontal ladder up in the air. The player
     hangs from the bar they are holding and swings like a pendulum. Tapping
     while the swing is in the forward "grab zone" lets them reach the NEXT
     bar and move one step across. Mistimes are gentle — they swing back and
     dangle, then try again. No falling, ever. */
  const BARS = 7;                 // bars per crossing (so 6 grabs to cross)
  const BAR_X0 = 250;             // x of the first bar
  const BAR_GAP = 78;             // spacing between bars
  const BAR_Y = 248;              // y of the bar rail (where hands grip)
  const PLAT_W = 96;              // landing platform width
  const SESSION = 58;             // seconds of play

  // arm length / pendulum geometry (in screen units)
  const ARM = 86;                 // hand-to-hip distance while hanging
  const BADTZ = { x: 96, y: 470 };

  const MAX_PARTS = 80;

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'monkeybars',
    name: 'Monkey Bars',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';   // howto -> count -> swing -> crossingDone -> next -> done (-> finish once)
      this.score = 0;
      this.barsGrabbed = 0;
      this.crossings = 0;
      this.lastBonus = 0;
      this.timeLeft = SESSION;
      this.finished = false;

      // swing state
      this.barIndex = 0;       // which bar the player currently holds (0..BARS-1)
      this.swingSpeed = 1.0;   // radians-per-second base for the pendulum (grows per crossing)
      this.swingPhase = 0;     // pendulum phase, angle = swingAmp * sin(phase)
      this.swingAmp = 0.62;    // max swing angle (radians) — generous
      this.reaching = false;   // mid-grab lurch animation
      this.reachT = 0;
      this.slip = 0;           // >0 = a gentle slip wobble is playing
      this.dangle = 0;         // settle timer after a slip
      this.justGrabbedGlow = 0;

      // bookkeeping
      this.countT = 0;
      this.lastSeg = -1;
      this.lastTick = -1;
      this.doneT = 0;
      this.nextT = 0;
      this.crossT = 0;         // crossingDone banner timer
      this.shake = 0;
      this.parts = [];

      // host reactions
      this.bubble = { text: '', t: 0 };
      this.bubbleSmirk = false; // smirk vs cheer pose
      this.hostHappy = 0;

      // decorative clouds (computed once)
      this.clouds = [
        { x: 180, y: 90, s: 1.0, v: 5 },
        { x: 600, y: 60, s: 0.8, v: 7 },
        { x: 820, y: 120, s: 1.15, v: 4 }
      ];
      this.flowers = [];
      for (let i = 0; i < 7; i++) {
        this.flowers.push({ x: 40 + i * 130 + CM.rand(-18, 18), c: CM.pick([P.pink, P.yellow, P.lavender, P.white]) });
      }
    },

    exit() {},

    /* ================= geometry helpers ================= */
    barX(i) { return BAR_X0 + i * BAR_GAP; },

    // the platform start x (left of bar 0) and the goal platform x (right of last bar)
    startPlatX() { return this.barX(0) - 78; },
    goalPlatX() { return this.barX(BARS - 1) + 78; },

    // current pendulum angle (0 = straight down, + = swung toward the goal/right)
    swingAngle() {
      return this.swingAmp * Math.sin(this.swingPhase);
    },

    // hand grip point of the currently held bar
    gripX() { return this.barX(this.barIndex); },

    // hip/body position given a grip and an angle
    bodyPos(gx, ang) {
      return { x: gx + Math.sin(ang) * ARM, y: BAR_Y + Math.cos(ang) * ARM };
    },

    /* ================= flow ================= */
    beginCount() {
      this.state = 'count';
      this.countT = 0;
      this.lastSeg = -1;
      this.say('Bet you can\'t!', 2.4, true);
    },

    startCrossing(faster) {
      this.barIndex = 0;
      this.swingPhase = -Math.PI / 2;  // start hanging straight, swinging up toward goal
      this.reaching = false;
      this.reachT = 0;
      this.slip = 0;
      this.dangle = 0;
      if (faster) this.swingSpeed = Math.min(2.4, this.swingSpeed + 0.28);
    },

    say(text, t, smirk) {
      this.bubble = { text: text, t: t };
      this.bubbleSmirk = !!smirk;
      this.hostHappy = smirk ? 0 : Math.max(this.hostHappy, 1.1);
    },

    /* ================= update ================= */
    update(dt) {
      this.shake = Math.max(0, this.shake - dt * 16);
      if (this.bubble.t > 0) this.bubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      this.justGrabbedGlow = Math.max(0, this.justGrabbedGlow - dt);
      this.tickParts(dt);

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.beginCount();
          break;

        case 'count':
          this.updateCount(dt);
          break;

        case 'swing':
          this.updateSwing(dt);
          break;

        case 'crossingDone':
          this.crossT -= dt;
          // gentle celebration sparkles
          if (this.parts.length < 50 && Math.random() < 0.35) this.confettiOne();
          if (this.crossT <= 0) {
            this.state = 'next';
            this.nextT = 0.5;
          }
          break;

        case 'next':
          this.nextT -= dt;
          // keep the timer ticking through the tiny breather
          this.tickClock(dt);
          if (this.timeLeft <= 0) { this.endSession(); break; }
          if (this.nextT <= 0) {
            this.startCrossing(true);
            this.state = 'swing';
            this.say('Again?! Show-off.', 2.0, true);
          }
          break;

        case 'done':
          if (this.parts.length < 60 && Math.random() < 0.3) this.confettiOne();
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('monkeybars', this.score, CM.clamp(Math.ceil(this.score / 15), 5, 30));
          }
          break;
      }
    },

    updateCount(dt) {
      this.countT += dt;
      const seg = Math.floor(this.countT / 0.8);
      if (seg !== this.lastSeg && seg <= 3) {
        this.lastSeg = seg;
        if (seg < 3) CM.audio.tone(620 + seg * 90, 0.14, 'triangle', 0.12);
        else CM.audio.play('ding');
      }
      if (this.countT >= 3.4) {
        this.startCrossing(false);
        this.state = 'swing';
        this.say('Go on then...', 2.0, true);
      }
    },

    tickClock(dt) {
      this.timeLeft -= dt;
      const tl = Math.ceil(this.timeLeft);
      if (tl <= 8 && tl >= 1 && tl !== this.lastTick) {
        this.lastTick = tl;
        CM.audio.tone(780, 0.06, 'sine', 0.06);
      }
      if (this.timeLeft < 0) this.timeLeft = 0;
    },

    updateSwing(dt) {
      this.tickClock(dt);
      if (this.timeLeft <= 0) { this.endSession(); return; }

      // settle a slip wobble first (still swinging, just can't grab yet)
      if (this.slip > 0) {
        this.slip -= dt;
        if (this.slip < 0) this.slip = 0;
      }

      // advance the pendulum
      this.swingPhase += this.swingSpeed * dt;

      // reaching animation: a quick lurch to the next bar
      if (this.reaching) {
        this.reachT += dt;
        if (this.reachT >= 0.16) {
          // land the grab — now hanging from the next bar, swinging forward again
          this.reaching = false;
          this.reachT = 0;
          this.barIndex++;
          this.swingPhase = -Math.PI / 2; // re-hang and swing up toward goal
          if (this.barIndex >= BARS - 1) {
            // reached the far platform!
            this.completeCrossing();
            return;
          }
        }
        return; // ignore input mid-lurch
      }

      // input: try to grab the next bar
      if (anyPress() && this.slip <= 0) {
        this.tryGrab();
      }
    },

    // how good is the current moment to grab? returns 'perfect' | 'good' | 'miss'
    grabQuality() {
      const ang = this.swingAngle();
      // best when swung forward (toward goal, ang > 0) AND near the top of the
      // forward arc (velocity slowing). The sweet spot is generous.
      const aNorm = ang / this.swingAmp; // -1..1
      if (aNorm > 0.62) return 'perfect';
      if (aNorm > 0.18) return 'good';
      return 'miss';
    },

    tryGrab() {
      const q = this.grabQuality();
      if (q === 'miss') {
        this.gentleSlip();
        return;
      }
      // good grab — start the lurch animation toward the next bar
      this.reaching = true;
      this.reachT = 0;
      this.barsGrabbed++;
      const pts = q === 'perfect' ? 18 : 10;
      this.score += pts;
      this.justGrabbedGlow = 0.4;

      const gx = this.barX(this.barIndex + 1);
      this.popBurst(gx, BAR_Y, q === 'perfect');
      this.floatText(gx, BAR_Y - 26, '+' + pts, q === 'perfect' ? P.pinkDeep : '#c98a1f');

      if (q === 'perfect') {
        CM.audio.play('pop');
        CM.audio.tone(880, 0.1, 'sine', 0.1, 0.02);
        this.shake = Math.max(this.shake, 2.5);
        if (Math.random() < 0.5) this.say(CM.pick(['Lucky.', 'Tch, nice.', 'Not bad!']), 1.2, true);
      } else {
        CM.audio.play('pop');
      }
    },

    gentleSlip() {
      // no falling — just a little dangle wobble, then they can try again
      this.slip = 0.5;
      CM.audio.play('boing');
      this.floatText(this.gripX(), BAR_Y + ARM * 0.7, 'oops!', P.blueDeep);
      this.say(CM.pick(['Heh, slipped!', 'Too soon!', 'Hang on tight!']), 1.4, true);
    },

    completeCrossing() {
      this.crossings++;
      this.barsGrabbed++;            // the final reach onto the platform counts
      // crossing bonus grows a little each time (150, 200, 250, ...) capped at 400
      const bonus = Math.min(400, 150 + (this.crossings - 1) * 50);
      this.score += bonus;
      this.lastBonus = bonus;
      this.barIndex = BARS - 1;
      this.state = 'crossingDone';
      this.crossT = 1.8;
      this.shake = 7;
      CM.audio.play('cheer');
      this.celebrate(22);
      this.floatText(this.goalPlatX(), BAR_Y - 4, '+' + bonus + '!', P.pinkDeep);
      this.say(CM.pick(['Whoa, you made it!', 'Okay okay, impressive!', 'Crossing done!']), 2.2, false);
    },

    endSession() {
      this.state = 'done';
      this.doneT = 1.9;
      this.shake = 6;
      this.timeLeft = 0;
      CM.audio.play('tada');
      this.celebrate(20);
      this.say('Good run, kid!', 3, false);
    },

    /* ================= particles ================= */
    addPart(p) { if (this.parts.length < MAX_PARTS) { p.maxLife = p.life; this.parts.push(p); } },

    popBurst(x, y, big) {
      const n = big ? 9 : 5;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.addPart({
          kind: 'spark', x: x, y: y,
          vx: Math.cos(a) * CM.rand(60, big ? 160 : 110),
          vy: Math.sin(a) * CM.rand(60, big ? 150 : 110) - 30,
          t: 0, life: CM.rand(0.4, 0.7), size: CM.rand(3, big ? 6 : 5),
          color: big ? CM.pick([P.yellow, P.white, P.pink]) : P.white
        });
      }
      if (big) {
        for (let i = 0; i < 3; i++) {
          this.addPart({
            kind: 'heart', x: x + CM.rand(-14, 14), y: y - 8,
            vx: CM.rand(-30, 30), vy: CM.rand(-110, -60),
            t: 0, life: 0.95, size: CM.rand(8, 12)
          });
        }
      }
    },

    celebrate(n) {
      for (let i = 0; i < n; i++) {
        this.addPart({
          kind: Math.random() < 0.5 ? 'star' : 'heart',
          x: CM.rand(260, 760), y: CM.rand(150, 300),
          vx: CM.rand(-90, 90), vy: CM.rand(-180, -40),
          t: 0, life: CM.rand(0.7, 1.25),
          size: CM.rand(7, 13), rot: CM.rand(0, 6), vr: CM.rand(-4, 4),
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep])
        });
      }
    },

    confettiOne() {
      this.addPart({
        kind: 'star', x: CM.rand(220, 740), y: CM.rand(140, 220),
        vx: CM.rand(-30, 30), vy: CM.rand(-50, 30),
        t: 0, life: CM.rand(0.8, 1.2), size: CM.rand(6, 11),
        rot: CM.rand(0, 6), vr: CM.rand(-3, 3),
        color: CM.pick([P.pink, P.yellow, P.mint, P.lavender, P.white])
      });
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
        if (p.kind === 'spark') { p.vy += 200 * dt; p.vx *= 1 - dt * 1.1; }
        else if (p.kind === 'heart') p.vy += 50 * dt;
        else if (p.kind === 'star') { p.vy += 120 * dt; if (p.vr) p.rot += p.vr * dt; }
      }
    },

    /* ================= draw ================= */
    draw(g) {
      g.save();
      if (this.shake > 0.2) {
        g.translate(CM.rand(-this.shake, this.shake) * 0.7, CM.rand(-this.shake, this.shake) * 0.7);
      }

      this.drawScene(g);
      this.drawFrame(g);

      // player hanging / swinging (skip during the final done overlay swap)
      if (this.state !== 'howto') this.drawPlayer(g);

      // host Badtz-Maru cheering / smirking on the left
      this.drawHost(g);

      this.drawParts(g);
      g.restore(); // end shake

      /* ---- HUD (not shaken) ---- */
      if (this.state !== 'howto') this.drawHud(g);

      // banners / overlays
      if (this.state === 'count') this.drawCountIn(g);
      if (this.state === 'crossingDone') this.drawCrossBanner(g);
      if (this.state === 'done') this.drawDone(g);
      if (this.state === 'howto') this.drawHowto(g);

      // host speech bubble
      if (this.bubble.t > 0 && this.state !== 'howto') this.drawBubble(g);
    },

    drawScene(g) {
      // sky gradient
      const sg = g.createLinearGradient(0, 0, 0, CM.H);
      sg.addColorStop(0, '#bfe7ff');
      sg.addColorStop(0.62, '#dff3ff');
      sg.addColorStop(0.62, '#cfeccb');
      sg.addColorStop(1, '#a9d99e');
      g.fillStyle = sg;
      g.fillRect(0, 0, CM.W, CM.H);

      // sun
      D.circle(g, 856, 78, 34, '#fff3b0');
      D.circle(g, 856, 78, 26, '#ffe07a');

      // clouds
      for (const c of this.clouds) {
        c.x += c.v * CM.dt;
        if (c.x > CM.W + 60) c.x = -60;
        this.drawCloud(g, c.x, c.y, c.s);
      }

      // grass band
      const groundY = CM.H * 0.62;
      g.fillStyle = '#9fd17f';
      g.fillRect(0, groundY, CM.W, CM.H - groundY);
      // wood-chip play area patch under the bars
      D.ellipse(g, 480, 520, 430, 70, '#e8c39a', '#d9af82', 3);
      // little wood-chip flecks
      g.fillStyle = 'rgba(160,110,60,0.25)';
      for (let i = 0; i < 26; i++) {
        const fx = 90 + ((i * 137) % 780);
        const fy = 482 + ((i * 53) % 70);
        g.save(); g.translate(fx, fy); g.rotate((i * 1.3) % Math.PI);
        g.fillRect(-4, -1.4, 8, 2.8); g.restore();
      }

      // low pastel fence along the grass line
      this.drawFence(g, groundY);

      // a few flowers in the grass
      for (const f of this.flowers) this.drawFlower(g, f.x, groundY + 30, f.c);
    },

    drawCloud(g, x, y, s) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      D.circle(g, -22, 4, 18);
      D.circle(g, 0, -6, 22);
      D.circle(g, 22, 4, 18);
      D.rr(g, -34, 2, 68, 16, 8, 'rgba(255,255,255,0.95)');
      g.restore();
    },

    drawFence(g, gy) {
      const fy = gy - 6;
      g.strokeStyle = '#ffffff';
      g.lineWidth = 6;
      g.lineCap = 'round';
      // two rails
      g.beginPath(); g.moveTo(0, fy - 18); g.lineTo(CM.W, fy - 18); g.stroke();
      g.beginPath(); g.moveTo(0, fy - 4); g.lineTo(CM.W, fy - 4); g.stroke();
      // pickets
      g.fillStyle = '#ffffff';
      for (let x = 16; x < CM.W; x += 56) {
        g.beginPath();
        g.moveTo(x, fy - 30);
        g.lineTo(x + 10, fy - 30);
        g.lineTo(x + 10, fy + 4);
        g.lineTo(x + 5, fy + 9);
        g.lineTo(x, fy + 4);
        g.closePath();
        g.fill();
        g.strokeStyle = '#e7dff0'; g.lineWidth = 1.5; g.stroke();
      }
    },

    drawFlower(g, x, y, c) {
      // stem
      g.strokeStyle = '#5fa84e'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 22); g.stroke();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        D.circle(g, x + Math.cos(a) * 5, y - 24 + Math.sin(a) * 5, 4, c);
      }
      D.circle(g, x, y - 24, 3, '#ffd24a');
    },

    drawFrame(g) {
      // support posts at each end of the bar rail
      const x0 = this.barX(0) - 28;
      const x1 = this.barX(BARS - 1) + 28;
      const topY = BAR_Y - 70;
      const baseY = 470;

      g.strokeStyle = '#d98a5a';
      g.lineWidth = 12;
      g.lineCap = 'round';
      // angled A-frame legs (left)
      this.leg(g, x0, topY, x0 - 30, baseY);
      this.leg(g, x0, topY, x0 + 22, baseY);
      // angled A-frame legs (right)
      this.leg(g, x1, topY, x1 + 30, baseY);
      this.leg(g, x1, topY, x1 - 22, baseY);

      // top side rails (the two long beams the rungs connect)
      g.strokeStyle = '#c97a48';
      g.lineWidth = 11;
      g.beginPath(); g.moveTo(x0, topY); g.lineTo(x1, topY); g.stroke();          // upper beam
      g.beginPath(); g.moveTo(x0, BAR_Y); g.lineTo(x1, BAR_Y); g.stroke();        // grip rail
      // soft highlight on the grip rail
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = 3;
      g.beginPath(); g.moveTo(x0, BAR_Y - 4); g.lineTo(x1, BAR_Y - 4); g.stroke();

      // landing platforms (start + goal)
      this.drawPlatform(g, this.startPlatX(), false);
      this.drawPlatform(g, this.goalPlatX(), true);

      // the rungs/bars themselves
      for (let i = 0; i < BARS; i++) {
        const bx = this.barX(i);
        const held = i === this.barIndex;
        const nextTarget = (this.state === 'swing' && !this.reaching && i === this.barIndex + 1);
        // bar pill
        const col = held ? '#f2b53c' : '#e8b06a';
        D.rr(g, bx - 9, topY - 2, 18, BAR_Y - topY + 4, 9, col, '#b9783f', 2.5);
        D.circle(g, bx, BAR_Y, 8, held ? '#ffd86a' : '#f0c98a', '#b9783f', 2.5);
        // highlight the bar we want to grab next
        if (nextTarget) {
          const glow = 0.5 + 0.5 * Math.sin(CM.time * 6);
          g.globalAlpha = 0.35 + glow * 0.4;
          D.circle(g, bx, BAR_Y, 16, null, P.pinkDeep, 3);
          g.globalAlpha = 1;
        }
      }
    },

    leg(g, x1, y1, x2, y2) {
      g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.stroke();
    },

    drawPlatform(g, cx, goal) {
      const y = BAR_Y + ARM + 16; // a bit below the lowest hang
      D.shadow(g, cx, y + 30, PLAT_W * 0.55);
      // posts
      g.fillStyle = '#c97a48';
      g.fillRect(cx - PLAT_W / 2 + 8, y, 9, 60);
      g.fillRect(cx + PLAT_W / 2 - 17, y, 9, 60);
      // deck
      D.rr(g, cx - PLAT_W / 2, y - 16, PLAT_W, 18, 6, goal ? '#ffd9a1' : '#e8c39a', '#c97a48', 3);
      D.rr(g, cx - PLAT_W / 2, y - 22, PLAT_W, 8, 4, goal ? '#ffe9c4' : '#f3d9b5');
      if (goal) {
        // little flag to mark the finish
        g.strokeStyle = '#b9783f'; g.lineWidth = 4; g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx, y - 22); g.lineTo(cx, y - 58); g.stroke();
        g.fillStyle = P.pinkDeep;
        g.beginPath();
        g.moveTo(cx, y - 58); g.lineTo(cx + 26, y - 50); g.lineTo(cx, y - 42); g.closePath();
        g.fill();
        D.star(g, cx + 11, y - 50, 4, '#fff');
      }
    },

    drawPlayer(g) {
      let gx, ang, dangleWobble = 0;

      if (this.state === 'crossingDone' || this.state === 'next') {
        // standing happy on the goal platform
        const py = BAR_Y + ARM + 16 - 22;
        CM.drawPlayer(g, this.goalPlatX(), py, 1.0, 'left', 0);
        // raised cheer arms hint via a couple of stars
        if (this.state === 'crossingDone') {
          const b = Math.sin(CM.time * 8) * 4;
          D.star(g, this.goalPlatX() - 22, py - 92 + b, 7, P.yellowDeep, CM.time * 3);
          D.star(g, this.goalPlatX() + 22, py - 92 - b, 7, P.yellowDeep, -CM.time * 3);
        }
        return;
      }

      // swinging / reaching
      gx = this.gripX();
      ang = this.swingAngle();
      if (this.slip > 0) {
        // gentle slip wobble — extra little jiggle on the angle
        dangleWobble = Math.sin(this.slip * 30) * 0.06 * (this.slip / 0.5);
        ang += dangleWobble;
      }

      // when reaching, blend the grip toward the next bar and reduce arm bend
      let reachX = null;
      if (this.reaching) {
        const tFrac = CM.clamp(this.reachT / 0.16, 0, 1);
        const nx = this.barX(this.barIndex + 1);
        reachX = nx; // far hand reaching out
        // body slides toward the next bar
        gx = CM.lerp(gx, nx, tFrac);
        ang = CM.lerp(ang, -0.1, tFrac); // straighten under the new bar
      }

      const body = this.bodyPos(gx, ang);

      // arms: from the held bar grip down to the player's "shoulders"
      const shX = body.x;
      const shY = body.y - 58;   // approx shoulder height above feet anchor used by drawPlayer
      g.strokeStyle = '#f0c89a';
      g.lineWidth = 7;
      g.lineCap = 'round';
      // gripping arm (to current bar)
      g.beginPath(); g.moveTo(shX, shY); g.lineTo(gx, BAR_Y + 2); g.stroke();
      // hand on bar
      D.circle(g, gx, BAR_Y + 2, 5.5, '#ffe3cf', '#d8b89a', 1.5);
      // reaching arm toward next bar
      if (reachX !== null) {
        g.strokeStyle = '#f0c89a'; g.lineWidth = 7;
        g.beginPath(); g.moveTo(shX, shY); g.lineTo(reachX, BAR_Y + 2); g.stroke();
        D.circle(g, reachX, BAR_Y + 2, 5.5, '#ffe3cf', '#d8b89a', 1.5);
      }

      // the kid: feet hang in the air; drawPlayer anchors at the feet, so place
      // feet at body.y and let the body rise above. facing right toward the goal.
      g.save();
      // tilt the whole kid slightly with the swing for life
      g.translate(body.x, body.y);
      g.rotate(ang * 0.35);
      g.translate(-body.x, -body.y);
      CM.drawPlayer(g, body.x, body.y, 1.0, 'right', 0);
      g.restore();

      // little "dangle" motion lines on a slip
      if (this.slip > 0.15) {
        g.strokeStyle = 'rgba(74,159,220,0.6)';
        g.lineWidth = 2; g.lineCap = 'round';
        for (let i = -1; i <= 1; i += 2) {
          g.beginPath();
          g.moveTo(body.x + i * 18, body.y - 40);
          g.lineTo(body.x + i * 24, body.y - 30);
          g.stroke();
        }
      }

      // grab-glow ring at the new grip right after a successful grab
      if (this.justGrabbedGlow > 0 && !this.reaching) {
        g.globalAlpha = this.justGrabbedGlow / 0.4;
        D.circle(g, gx, BAR_Y + 2, 10 + (0.4 - this.justGrabbedGlow) * 40, null, P.yellowDeep, 3);
        g.globalAlpha = 1;
      }
    },

    drawHost(g) {
      const happy = this.hostHappy > 0 || this.state === 'crossingDone' || this.state === 'done';
      const bob = happy ? (CM.time * 2.6) % 1 : ((CM.time * 0.8) % 1) * 0.3;
      CM.drawFriend(g, 'badtzmaru', BADTZ.x, BADTZ.y, 1.12, { bob: bob });
      // name plate
      D.rr(g, BADTZ.x - 46, BADTZ.y + 6, 92, 19, 9, 'rgba(255,255,255,0.85)');
      D.text(g, 'Badtz-Maru', BADTZ.x, BADTZ.y + 16, { size: 13, color: P.ink, weight: 800 });
      // a little pennant he waves when cheering
      if (happy) {
        const w = Math.sin(CM.time * 9) * 6;
        g.strokeStyle = '#b9783f'; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(BADTZ.x + 30, BADTZ.y - 56); g.lineTo(BADTZ.x + 34, BADTZ.y - 86); g.stroke();
        g.fillStyle = P.yellowDeep;
        g.beginPath();
        g.moveTo(BADTZ.x + 34, BADTZ.y - 86);
        g.lineTo(BADTZ.x + 34 + 22 + w, BADTZ.y - 80);
        g.lineTo(BADTZ.x + 34, BADTZ.y - 74);
        g.closePath(); g.fill();
      }
    },

    drawBubble(g) {
      const txt = this.bubble.text;
      const cw = Math.max(110, txt.length * 9 + 26);
      const bx = CM.clamp(BADTZ.x - 6, 8, CM.W - cw - 8);
      D.bubble(g, bx, BADTZ.y - 150, cw, 42, BADTZ.x + 14);
      D.text(g, txt, bx + cw / 2, BADTZ.y - 129, {
        size: 15, weight: 800, color: this.bubbleSmirk ? P.lavenderDeep : P.pinkDeep
      });
    },

    drawHud(g) {
      // timer top-center
      const tl = Math.max(0, Math.ceil(this.timeLeft));
      const urgent = tl <= 8 && (this.state === 'swing' || this.state === 'next');
      const pulse = urgent ? 1 + Math.sin(CM.time * 7) * 0.07 : 1;
      D.rr(g, 416, 10, 128, 44, 22, 'rgba(255,255,255,0.9)', urgent ? P.red : '#f0b9d2', 3);
      D.text(g, '⏱ ' + tl, 480, 33, {
        size: Math.round(27 * pulse), color: urgent ? P.red : P.blueDeep, weight: 800
      });

      // score top-left
      D.rr(g, 14, 12, 168, 40, 20, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      D.star(g, 36, 32, 11, P.yellowDeep);
      D.text(g, String(this.score), 116, 32, { size: 22, color: '#c98a1f', weight: 800 });

      // crossings + bars stat top-right-ish (kept left of engine chrome at x>860)
      D.rr(g, 660, 12, 188, 40, 20, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      D.text(g, '🏁 ' + this.crossings + '  ·  bars ' + this.barsGrabbed, 754, 32,
        { size: 15, color: P.ink, weight: 800 });

      // hint while swinging
      if (this.state === 'swing' && CM.sceneTime < 14) {
        const hint = CM.touchMode ? 'Tap when you swing FORWARD to grab the next bar!'
                                   : 'Tap / SPACE when you swing FORWARD to grab!';
        D.rr(g, 250, 560, 460, 26, 13, 'rgba(255,255,255,0.7)');
        D.text(g, hint, 480, 573, { size: 14, color: P.pinkDeep, weight: 800 });
      }
    },

    drawCountIn(g) {
      const SEGS = ['3', '2', '1', 'Go!'];
      const seg = Math.min(3, Math.floor(this.countT / 0.8));
      const frac = (this.countT - seg * 0.8) / 0.8;
      const size = (seg === 3 ? 70 : 92) * (1 + 0.3 * Math.max(0, 1 - frac * 3));
      D.text(g, SEGS[seg], 480, 300, {
        size: Math.round(size), color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
      });
    },

    drawCrossBanner(g) {
      const el = 1.8 - this.crossT;
      const sc = Math.min(1, el * 4);
      D.text(g, 'CROSSED!!', 480, 150, {
        size: 26 + 30 * sc, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
      });
      D.text(g, '+' + (this.lastBonus || 0) + ' bonus!', 480, 196, {
        size: 22, color: '#c98a1f', weight: 800, stroke: '#fff', strokeWidth: 6
      });
      D.star(g, 330, 152, 18, P.yellowDeep, CM.time * 2.5);
      D.star(g, 630, 152, 18, P.yellowDeep, -CM.time * 2.5);
    },

    drawDone(g) {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.text(g, 'Time\'s up! 🎉', 480, 232, {
        size: 50, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
      });
      D.text(g, this.crossings + (this.crossings === 1 ? ' crossing' : ' crossings') +
        ' · ' + this.barsGrabbed + ' bars!', 480, 286,
        { size: 24, color: P.ink, weight: 800, stroke: '#fff', strokeWidth: 6 });
      D.text(g, 'Score: ' + this.score, 480, 330, { size: 26, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6 });
      D.star(g, 250, 220 + Math.sin(CM.time * 5) * 6, 16, P.yellowDeep);
      D.star(g, 710, 220 + Math.cos(CM.time * 5) * 6, 16, P.yellowDeep);
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(70,40,70,0.3)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 200, 96, 560, 392, { title: '🐵 Monkey Bars with Badtz-Maru' });
      CM.drawFriend(g, 'badtzmaru', 300, 432, 1.3, { bob: ((CM.time * 1.1) % 1) * 0.5 });
      D.text(g, 'Badtz-Maru', 300, 456, { size: 14, color: P.lavenderDeep, weight: 800 });

      D.text(g, 'Swing across the monkey bars!', 560, 168, { size: 20, color: P.ink, weight: 800 });
      D.text(g, '1. You swing back and forth.', 560, 214, { size: 17, color: P.ink });
      D.text(g, '2. Tap when you swing FORWARD', 560, 248, { size: 17, color: P.ink });
      D.text(g, '    to grab the next bar!', 560, 272, { size: 17, color: P.pinkDeep, weight: 800 });
      D.text(g, '3. Reach the far platform to win', 560, 306, { size: 17, color: P.ink });
      D.text(g, '    a crossing — then go again!', 560, 330, { size: 17, color: P.ink });
      D.text(g, 'Mistime it? You just dangle — try again!', 480, 372, { size: 14, color: '#9a8a94' });

      if (CM.ui.button(g, 380, 400, 200, 56, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.beginCount();
      }
    },

    drawParts(g) {
      for (const p of this.parts) {
        g.globalAlpha = CM.clamp(1 - p.t / p.life, 0, 1);
        if (p.kind === 'star') D.star(g, p.x, p.y, p.size, p.color || P.yellowDeep, p.rot || 0);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, p.color || P.pink);
        else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, { size: 20, color: p.color || '#c98a1f', weight: 800, stroke: '#fff', strokeWidth: 5 });
        } else {
          D.circle(g, p.x, p.y, p.size, p.color || P.white);
        }
      }
      g.globalAlpha = 1;
    }
  });
})();
