/* Cinnamoroll Mansion — Swing Jump (hosted by My Melody) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------------- layout ----------------
     A swing set on the left, a long sand pit stretching right with distance
     markers. The swing pivots at PIVOT; the seat hangs ROPE_LEN below it and
     swings through an angle. Ground line at GROUND_Y. */
  const GROUND_Y = 470;            // top of the grass / sand
  const PIVOT = { x: 235, y: 150 };
  const ROPE_LEN = 250;            // pivot -> seat
  const REST_X = PIVOT.x;          // seat x when hanging straight down
  const REST_Y = PIVOT.y + ROPE_LEN;

  // swing angle (radians from straight-down). forward = positive (toward sand/right).
  const MIN_AMP = 0.30;            // starting arc
  const MAX_AMP = 0.92;            // capped arc after good pumping
  const PUMP_GAIN = 0.115;         // amplitude added per well-timed pump
  const PUMP_WINDOW = 0.34;        // |phase| within this of the forward peak = good
  const SWING_SPEED = 1.9;         // base angular frequency

  // sand pit / distance mapping
  const SAND_X0 = 360;             // pixel x of the 0m marker (under the swing-ish)
  const PX_PER_M = 52;             // pixels per metre
  const MAX_M = 10;                // furthest marker / cap

  const LAUNCH = { x: 320, y: 70, w: 360, h: 30 };  // launch timing bar
  const MELODY = { x: 832, y: 452 };                 // host on the right
  const MAX_PARTS = 90;
  const JUMPS = 5;
  const FLY_G = 760;               // flight gravity (px/s^2) — used to aim the jump

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'swingjump',
    name: 'Swing Jump',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';   // howto -> pump -> launch -> flying -> result -> (repeat) -> done -> finish
      this.score = 0;
      this.jump = 0;          // 0..JUMPS-1
      this.finished = false;

      // swing state
      this.amp = MIN_AMP;     // current swing amplitude (radians)
      this.swingT = 0;        // phase clock
      this.angle = 0;
      this.pumps = 0;
      this.pumpFlash = 0;     // visual flash timer after a pump
      this.maxedMsg = 0;
      this.maxedHold = 0;     // time held at max amplitude (for idle auto-leap)

      // launch state
      this.launchT = 0;
      this.launchMark = 0;    // 0..1 sweeping marker
      this.launchDir = 1;

      // flight state
      this.fly = { x: 0, y: 0, vx: 0, vy: 0, t: 0, landed: false, rot: 0 };
      this.landM = 0;         // metres landed this jump
      this.bestM = 0;         // best distance so far (for the marker flag)
      this.flagWave = 0;

      // feedback
      this.parts = [];
      this.shk = { t: 0, dur: 1, mag: 0 };
      this.msg = '';
      this.bigMsg = '';
      this.hostBubble = { text: '', t: 0 };
      this.resultT = 0;
      this.doneT = 0;
      this.quality = 0;       // 0..1 last launch timing quality

      // clouds drift for life
      this.clouds = [
        { x: 150, y: 70, s: 1.0, v: 6 },
        { x: 560, y: 48, s: 0.8, v: 9 },
        { x: 800, y: 96, s: 1.15, v: 5 }
      ];
    },

    exit() {},

    /* ================= phase starts ================= */
    startPump() {
      this.state = 'pump';
      this.amp = MIN_AMP;
      this.swingT = 0;
      this.pumps = 0;
      this.pumpFlash = 0;
      this.maxedMsg = 0;
      this.maxedHold = 0;
      this.msg = '';
      this.bigMsg = '';
      this.say('Pump high!', 1.6);
    },

    startLaunch() {
      this.state = 'launch';
      this.launchT = 0;
      this.launchMark = 0;
      this.launchDir = 1;
      this.say('Now LEAP!', 1.4);
      CM.audio.play('pop');
    },

    doLaunch() {
      // timing quality: 1 in the centre gold zone, falling off to the edges
      const d = Math.abs(this.launchMark - 0.5) * 2; // 0 at centre, 1 at edge
      const q = CM.clamp(1 - d, 0, 1);
      const quality = 0.32 + q * q * 0.68;            // even a poor tap flies a bit
      this.quality = quality;

      // distance: swing height (amp) scaled by launch timing. Always > 0.
      const ampFrac = (this.amp - MIN_AMP) / (MAX_AMP - MIN_AMP); // 0..1
      const reach = (0.32 + ampFrac * 0.68) * quality;            // 0..1
      const metres = CM.clamp(reach * MAX_M, 0.6, MAX_M);
      this.landM = Math.round(metres * 10) / 10;

      // launch the flier from the current seat position, forward + up
      const seat = this.seatPos(true); // forward-most-ish
      this.fly.x = seat.x;
      this.fly.y = seat.y;
      this.fly.t = 0;
      this.fly.landed = false;
      this.fly.rot = 0;

      // Solve the projectile so it ACTUALLY lands at the target marker.
      // Gravity G must match updateFlying. Pick an upward launch speed (bigger
      // arc for better jumps), then derive the exact flight time to the ground
      // and set vx so x lands at landX. Keeps the bubble + marker in sync.
      const G = FLY_G;
      const landX = SAND_X0 + this.landM * PX_PER_M;
      const landY = GROUND_Y + 8;
      const vy0 = 230 + reach * 230;                 // upward speed (px/s)
      // y(t) = y0 - vy0*t + 0.5*G*t^2 = landY  → quadratic in t, take the
      // later (descending) root.
      const dyTarget = landY - this.fly.y;           // downward drop to ground
      const disc = vy0 * vy0 + 2 * G * dyTarget;
      const flightT = (vy0 + Math.sqrt(Math.max(0, disc))) / G;
      this.fly.vx = (landX - this.fly.x) / flightT;
      this.fly.vy = -vy0;

      this.state = 'flying';
      CM.audio.play('boing');
      CM.audio.play('whoosh');
      if (quality > 0.82) {
        this.say('Perfect leap!', 1.6);
        this.burstAt(this.fly.x, this.fly.y, 10);
      }
    },

    /* ================= update ================= */
    update(dt) {
      if (this.shk.t > 0) this.shk.t -= dt;
      if (this.pumpFlash > 0) this.pumpFlash -= dt;
      if (this.maxedMsg > 0) this.maxedMsg -= dt;
      if (this.hostBubble.t > 0) this.hostBubble.t -= dt;
      this.flagWave += dt;
      for (const c of this.clouds) {
        c.x += c.v * dt;
        if (c.x > CM.W + 60) c.x = -60;
      }
      this.updateParts(dt);

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.startPump();
          break;

        case 'pump':
          this.updatePump(dt);
          break;

        case 'launch':
          this.updateLaunch(dt);
          break;

        case 'flying':
          this.updateFlying(dt);
          break;

        case 'result':
          this.resultT -= dt;
          if (this.resultT < 1.1 && anyPress()) this.resultT = 0; // tap to continue
          if (this.resultT <= 0) this.afterJump();
          break;

        case 'done':
          // gentle confetti drizzle, then finish once
          if (this.parts.length < 60 && Math.random() < 0.25) {
            this.spawnPart({
              x: CM.rand(180, 820), y: CM.rand(120, 300),
              vx: CM.rand(-30, 30), vy: CM.rand(-40, 10),
              life: CM.rand(0.7, 1.2), type: Math.random() < 0.5 ? 'star' : 'heart',
              color: CM.pick([P.pink, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
              size: CM.rand(7, 12), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
            });
          }
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('swingjump', this.score, CM.clamp(Math.ceil(this.score / 16), 5, 30));
          }
          break;
      }
    },

    updatePump(dt) {
      this.swingT += dt * SWING_SPEED;
      // phase: -1..1, where forward peak is at sin == +1
      const s = Math.sin(this.swingT);
      this.angle = s * this.amp;

      // The on-screen LEAP button is the explicit way to jump (drawn in
      // drawPumpUI). It only appears once the swing has some height so the
      // player can't accidentally bail on the very first arc.
      const canLeap = this.amp > MIN_AMP + 0.001 || this.pumps > 0;
      this._canLeap = canLeap;

      // tap the LEAP button, or press Space/Enter once the swing has lift, to jump off
      const m = CM.input.mouse;
      const tappedLeapBtn = m.clicked && canLeap && this.inLeapBtn(m.x, m.y);
      if (tappedLeapBtn || (canLeap && CM.input.pressed('action'))) {
        if (tappedLeapBtn) m.clicked = false;
        this.startLaunch();
        return;
      }

      // gentle idle auto-leap: once maxed out, an unattended swing leaps on its
      // own after a few seconds so the session always ends and scores.
      if (this.amp >= MAX_AMP - 0.001) {
        this.maxedHold += dt;
        if (this.maxedHold > 3) { this.startLaunch(); return; }
      } else {
        this.maxedHold = 0;
      }

      if (anyPress()) {
        // how close are we to the forward peak? peak when sin'(t)≈0 & sin(t)>0
        const cosv = Math.cos(this.swingT);           // 0 at a peak
        const nearForwardPeak = s > 0.55 && Math.abs(cosv) < PUMP_WINDOW;
        if (nearForwardPeak) {
          this.amp = Math.min(MAX_AMP, this.amp + PUMP_GAIN);
          this.pumps++;
          this.pumpFlash = 0.4;
          CM.audio.play('pop');
          CM.audio.tone(520 + this.pumps * 40, 0.1, 'sine', 0.08);
          const sp = this.seatPos();
          this.burstAt(sp.x, sp.y, 4);
          if (this.amp >= MAX_AMP - 0.001 && this.maxedMsg <= 0) {
            this.maxedMsg = 1.2;
            this.say('So high! Jump now!', 1.8);
            CM.audio.play('ding');
          }
        } else {
          // off-beat tap: tiny nudge so it never feels dead, plus a soft cue
          this.amp = Math.min(MAX_AMP, this.amp + PUMP_GAIN * 0.18);
          CM.audio.play('click');
        }
      }
    },

    // hit-test for the on-screen LEAP button (bottom-centre, big tap target)
    inLeapBtn(x, y) {
      const b = this.leapBtnRect();
      return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
    },
    leapBtnRect() {
      return { x: 360, y: 520, w: 240, h: 56 };
    },

    updateLaunch(dt) {
      this.launchT += dt;
      // sweep the marker back and forth across the bar
      this.launchMark += this.launchDir * dt * 1.25;
      if (this.launchMark > 1) { this.launchMark = 1; this.launchDir = -1; }
      else if (this.launchMark < 0) { this.launchMark = 0; this.launchDir = 1; }
      // gentle idle auto-fire so an unattended session still ends and scores
      if (anyPress() || this.launchT > 4) this.doLaunch();
    },

    updateFlying(dt) {
      const f = this.fly;
      if (!f.landed) {
        f.t += dt;
        f.vy += FLY_G * dt;               // gravity
        f.x += f.vx * dt;
        f.y += f.vy * dt;
        f.rot += dt * 3.2;
        // little sparkle trail
        if (Math.random() < 0.5) {
          this.spawnPart({
            x: f.x + CM.rand(-6, 6), y: f.y + CM.rand(-6, 6),
            vx: CM.rand(-20, 20), vy: CM.rand(-10, 30),
            life: CM.rand(0.3, 0.6), type: 'spark',
            color: CM.pick(['#fff', P.yellow, P.pinkSoft]),
            size: CM.rand(2.5, 4.5), rot: 0, vr: 0
          });
        }
        const landY = GROUND_Y + 8;
        if (f.y >= landY) {
          f.y = landY;
          // snap to the exact target marker so the distance call-out lines up
          f.x = SAND_X0 + this.landM * PX_PER_M;
          f.landed = true;
          this.onLand();
        }
      }
    },

    onLand() {
      const m = this.landM;
      // score: distance points, generous and always positive — even a weak jump
      // scores a nice chunk so a whole 5-jump session totals ~150-400.
      const pts = Math.round(16 + m * 8);   // ~21 (weak) .. ~96 (max) per jump
      this.score += pts;
      this.lastPts = pts;
      if (m > this.bestM) this.bestM = m;

      // sand puff + landing juice
      this.sandPuff(this.fly.x, GROUND_Y + 6, Math.round(8 + m));
      const big = this.quality > 0.82 || m >= 7;
      this.doShake(big ? 0.45 : 0.28, big ? 8 : 5);

      if (m >= 8.5) {
        this.bigMsg = 'AMAZING!!';
        this.msg = m + ' metres!! Wow!!';
        CM.audio.play('tada');
        this.celebrate(28);
        this.say('Incredible!!', 2.0);
      } else if (m >= 6) {
        this.bigMsg = 'GREAT JUMP!';
        this.msg = m + ' metres! Super!';
        CM.audio.play('cheer');
        this.celebrate(18);
        this.say('Woohoo!', 1.8);
      } else if (m >= 3.5) {
        this.msg = m + ' metres! Nice!';
        CM.audio.play('ding');
        this.celebrate(10);
        this.say('Nice one!', 1.5);
      } else {
        this.msg = m + ' metres! Good try!';
        CM.audio.play('pop');
        this.say('Good try!', 1.5);
      }
      CM.audio.play('splash'); // soft sand landing
      this.state = 'result';
      this.resultT = big ? 2.4 : 2.0;
    },

    afterJump() {
      this.jump++;
      if (this.jump >= JUMPS) {
        this.state = 'done';
        this.doneT = 1.8;
        this.say('What a champ!', 3);
        CM.audio.play('coin');
        this.celebrate(20);
        return;
      }
      this.startPump();
    },

    /* ================= geometry ================= */
    // Seat position for the current angle. forwardBias nudges toward the
    // forward peak so the flier launches from a believable spot.
    seatPos(forwardBias) {
      const a = forwardBias ? Math.max(this.angle, this.amp * 0.7) : this.angle;
      return {
        x: PIVOT.x + Math.sin(a) * ROPE_LEN,
        y: PIVOT.y + Math.cos(a) * ROPE_LEN,
        a: a
      };
    },

    /* ================= juice ================= */
    say(text, t) {
      this.hostBubble = { text: text, t: t };
    },

    doShake(t, mag) { this.shk = { t: t, dur: t, mag: mag }; },

    spawnPart(pt) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      pt.maxLife = pt.life;
      this.parts.push(pt);
    },

    burstAt(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: x, y: y,
          vx: CM.rand(-90, 90), vy: CM.rand(-150, -20),
          life: CM.rand(0.35, 0.7), type: 'spark',
          color: Math.random() < 0.5 ? '#fff' : P.yellow,
          size: CM.rand(2.5, 4.5), rot: 0, vr: 0
        });
      }
    },

    sandPuff(x, y, n) {
      n = Math.min(n, 22);
      for (let i = 0; i < n; i++) {
        const a = CM.rand(-Math.PI, 0); // upward fan
        const sp = CM.rand(40, 150);
        this.spawnPart({
          x: x + CM.rand(-10, 10), y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 20,
          life: CM.rand(0.4, 0.8), type: 'sand',
          color: CM.pick(['#f4dca6', '#ecc987', '#fbeaca']),
          size: CM.rand(3, 6), rot: 0, vr: 0
        });
      }
    },

    celebrate(n) {
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: CM.rand(260, 760), y: CM.rand(120, 260),
          vx: CM.rand(-90, 90), vy: CM.rand(-190, -40),
          life: CM.rand(0.6, 1.25),
          type: Math.random() < 0.5 ? 'star' : 'heart',
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep]),
          size: CM.rand(7, 13), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
        });
      }
    },

    updateParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const pt = this.parts[i];
        pt.life -= dt;
        if (pt.life <= 0) { this.parts.splice(i, 1); continue; }
        pt.vy += (pt.type === 'sand' ? 380 : 240) * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.rot += pt.vr * dt;
      }
    },

    /* ================= draw ================= */
    draw(g) {
      g.save();
      if (this.shk.t > 0) {
        const m = this.shk.mag * (this.shk.t / this.shk.dur);
        g.translate(CM.rand(-m, m), CM.rand(-m, m));
      }

      this.drawScene(g);
      this.drawSwingSet(g);

      // player: on the swing during pump/launch, in the air during flight,
      // sitting in the sand during result.
      if (this.state === 'pump' || this.state === 'launch') {
        this.drawPlayerOnSwing(g);
      } else if (this.state === 'flying') {
        this.drawFlier(g);
      } else if (this.state === 'result') {
        this.drawLandedPlayer(g);
        this.drawPlayerOnSwing(g, true); // empty swing gently swaying
      } else {
        this.drawPlayerOnSwing(g, true);
      }

      // My Melody host, cheering with a flag on the right
      this.drawHost(g);

      this.drawParts(g);
      g.restore(); // end shake

      /* ---- HUD (never shaken) ---- */
      this.drawHud(g);

      if (this.state === 'launch') this.drawLaunchBar(g);

      // pump hint / leap cue
      if (this.state === 'pump') this.drawPumpUI(g);

      // result banner + distance call-out
      if (this.state === 'result') this.drawResult(g);

      if (this.state === 'howto') this.drawHowto(g);

      if (this.state === 'done') {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(0, 0, CM.W, CM.H);
        D.text(g, 'What a champ!!', 480, 250, {
          size: 52, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
        });
        D.text(g, 'Total: ' + this.score + ' points', 480, 312, {
          size: 28, color: P.blueDeep, weight: 800
        });
        D.text(g, 'Best leap: ' + this.bestM + ' m', 480, 352, {
          size: 20, color: P.ink, weight: 700
        });
      }
    },

    /* ---- background scene: sky, clouds, grass, sand pit, fence ---- */
    drawScene(g) {
      // sky gradient
      const sky = g.createLinearGradient(0, 0, 0, GROUND_Y);
      sky.addColorStop(0, '#bfe7ff');
      sky.addColorStop(1, '#e6f6ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, CM.W, GROUND_Y);

      // sun in the corner
      D.circle(g, 905, 58, 30, '#fff3b0');
      D.circle(g, 905, 58, 22, '#ffe07a');

      // clouds
      for (const c of this.clouds) this.drawCloud(g, c.x, c.y, c.s);

      // low picket fence behind, along the horizon
      this.drawFence(g);

      // grass band
      const grass = g.createLinearGradient(0, GROUND_Y, 0, CM.H);
      grass.addColorStop(0, '#bfe8a8');
      grass.addColorStop(1, '#9fd685');
      g.fillStyle = grass;
      g.fillRect(0, GROUND_Y, CM.W, CM.H - GROUND_Y);
      // grass top trim
      g.fillStyle = '#a9e08f';
      g.fillRect(0, GROUND_Y, CM.W, 6);

      // sand pit (the landing zone) — a big rounded rectangle of sand
      const sx = SAND_X0 - 40;
      const sw = CM.W - sx - 6;
      D.rr(g, sx, GROUND_Y - 4, sw, CM.H - GROUND_Y + 4, 26, '#f6e2b6', '#e6c98a', 4);
      // soft inner shade
      D.rr(g, sx + 8, GROUND_Y + 6, sw - 16, CM.H - GROUND_Y - 8, 20, '#fbeccb');
      // wood-chip / grass speckles on the grass area (left of pit)
      g.fillStyle = 'rgba(120,170,90,0.5)';
      for (let i = 0; i < 14; i++) {
        const gx = (i * 53 + 20) % (sx - 10);
        const gy = GROUND_Y + 18 + ((i * 71) % 90);
        g.fillRect(gx, gy, 5, 3);
      }

      // distance markers along the sand
      this.drawMarkers(g);
    },

    drawCloud(g, x, y, s) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      D.circle(g, -20, 4, 16);
      D.circle(g, 0, -6, 22);
      D.circle(g, 22, 2, 17);
      D.rr(g, -34, 2, 70, 16, 8, 'rgba(255,255,255,0.95)');
      g.restore();
    },

    drawFence(g) {
      const fy = GROUND_Y - 30;
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#e7d3df';
      g.lineWidth = 2;
      // rail
      D.rr(g, 0, fy + 12, CM.W, 8, 4, '#ffffff', '#e7d3df', 2);
      // pickets
      for (let x = 10; x < CM.W; x += 46) {
        g.beginPath();
        g.moveTo(x, fy + 30);
        g.lineTo(x, fy + 6);
        g.lineTo(x + 9, fy - 6);
        g.lineTo(x + 18, fy + 6);
        g.lineTo(x + 18, fy + 30);
        g.closePath();
        g.fillStyle = '#ffffff';
        g.fill();
        g.stroke();
      }
    },

    drawMarkers(g) {
      for (let m = 2; m <= MAX_M; m += 2) {
        const x = SAND_X0 + m * PX_PER_M;
        if (x > CM.W - 14) continue;
        // little striped post
        g.strokeStyle = 'rgba(140,110,70,0.35)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, GROUND_Y + 4);
        g.lineTo(x, GROUND_Y + 46);
        g.stroke();
        D.rr(g, x - 13, GROUND_Y + 8, 26, 17, 6, 'rgba(255,255,255,0.9)', '#e6c98a', 1.5);
        D.text(g, m + 'm', x, GROUND_Y + 17, { size: 14, color: '#b07a3a', weight: 800 });
      }
      // best-so-far flag
      if (this.bestM > 0) {
        const bx = SAND_X0 + this.bestM * PX_PER_M;
        const wob = Math.sin(this.flagWave * 4) * 3;
        g.strokeStyle = '#9b7bd4';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(bx, GROUND_Y + 6);
        g.lineTo(bx, GROUND_Y - 36);
        g.stroke();
        g.fillStyle = P.lavenderDeep;
        g.beginPath();
        g.moveTo(bx, GROUND_Y - 36);
        g.lineTo(bx + 24 + wob, GROUND_Y - 28);
        g.lineTo(bx, GROUND_Y - 20);
        g.closePath();
        g.fill();
      }
    },

    /* ---- the swing set frame + ropes + seat ---- */
    drawSwingSet(g) {
      // A-frame legs
      g.strokeStyle = '#c98a55';
      g.lineWidth = 12;
      g.lineCap = 'round';
      // left pair
      g.beginPath();
      g.moveTo(PIVOT.x - 8, PIVOT.y);
      g.lineTo(PIVOT.x - 96, GROUND_Y + 4);
      g.moveTo(PIVOT.x - 8, PIVOT.y);
      g.lineTo(PIVOT.x - 30, GROUND_Y + 4);
      g.stroke();
      // right pair
      g.beginPath();
      g.moveTo(PIVOT.x + 70, PIVOT.y);
      g.lineTo(PIVOT.x + 30, GROUND_Y + 4);
      g.moveTo(PIVOT.x + 70, PIVOT.y);
      g.lineTo(PIVOT.x + 120, GROUND_Y + 4);
      g.stroke();
      // top beam
      g.strokeStyle = '#b5793f';
      g.lineWidth = 14;
      g.beginPath();
      g.moveTo(PIVOT.x - 14, PIVOT.y);
      g.lineTo(PIVOT.x + 76, PIVOT.y);
      g.stroke();
      // pivot bolts
      D.circle(g, PIVOT.x, PIVOT.y, 5, '#7d5a3a');

      // ropes + seat (only when the swing is in use or swaying)
      const sway = (this.state === 'result' || this.state === 'done' || this.state === 'flying')
        ? Math.sin(this.flagWave * 1.6) * 0.12
        : this.angle;
      const seatX = PIVOT.x + Math.sin(sway) * ROPE_LEN;
      const seatY = PIVOT.y + Math.cos(sway) * ROPE_LEN;
      g.strokeStyle = '#8a5a3b';
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(PIVOT.x - 8, PIVOT.y);
      g.lineTo(seatX - 14, seatY);
      g.moveTo(PIVOT.x + 8, PIVOT.y);
      g.lineTo(seatX + 14, seatY);
      g.stroke();
      // seat plank
      g.save();
      g.translate(seatX, seatY);
      g.rotate(sway);
      D.rr(g, -22, -4, 44, 10, 4, '#e8a04a', '#c47f2e', 2);
      g.restore();
      this._seat = { x: seatX, y: seatY, a: sway };
    },

    drawPlayerOnSwing(g, empty) {
      if (empty) return; // seat already drawn; nobody on it
      const seat = this.seatPos();
      // place the kid sitting on the seat: feet hang just below the plank.
      // We tilt the whole character with the swing angle for a fun lean.
      g.save();
      g.translate(seat.x, seat.y);
      g.rotate(seat.a * 0.8);
      // draw player with feet a touch below seat; facing 'right' (toward sand)
      const bob = 0;
      CM.drawPlayer(g, 0, 30, 0.92, 'right', bob);
      g.restore();

      // pump flash ring
      if (this.pumpFlash > 0) {
        const a = this.pumpFlash / 0.4;
        g.globalAlpha = a * 0.7;
        D.circle(g, seat.x, seat.y - 30, 34 + (1 - a) * 22, null, P.yellowDeep, 4);
        g.globalAlpha = 1;
      }
    },

    drawFlier(g) {
      const f = this.fly;
      // happy tumbling kid in the air
      g.save();
      g.translate(f.x, f.y - 30);
      g.rotate(Math.sin(f.rot) * 0.5);
      CM.drawPlayer(g, 0, 0, 0.92, 'right', 0);
      g.restore();
      // motion whoosh lines
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 3;
      g.lineCap = 'round';
      for (let i = 0; i < 3; i++) {
        g.beginPath();
        g.moveTo(f.x - 30 - i * 12, f.y - 30 + i * 8);
        g.lineTo(f.x - 12 - i * 12, f.y - 30 + i * 8);
        g.stroke();
      }
    },

    drawLandedPlayer(g) {
      // sitting in the sand where they landed
      const x = this.fly.x;
      CM.drawPlayer(g, x, GROUND_Y + 12, 0.92, 'right', 0);
    },

    /* ---- My Melody host with a little flag ---- */
    drawHost(g) {
      const excited = (this.state === 'result' && this.lastPts >= 40) ||
        this.state === 'done' || this.hostBubble.t > 0;
      const bob = excited ? (CM.time * 2.4) % 1 : ((CM.time * 0.9) % 1) * 0.4;
      CM.drawFriend(g, 'mymelody', MELODY.x, MELODY.y, 1.12, { bob: bob, flip: true });

      // a waving flag on a stick in her paw
      const wave = Math.sin(CM.time * (excited ? 9 : 4)) * 0.25;
      const hx = MELODY.x - 26, hy = MELODY.y - 44;
      g.save();
      g.translate(hx, hy);
      g.rotate(-0.5 + wave);
      g.strokeStyle = '#b5793f';
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(0, -34);
      g.stroke();
      g.fillStyle = P.pinkDeep;
      g.beginPath();
      g.moveTo(0, -34);
      g.lineTo(22, -29);
      g.lineTo(0, -24);
      g.closePath();
      g.fill();
      D.star(g, 9, -29, 4, '#fff');
      g.restore();

      // name tag
      D.rr(g, MELODY.x - 48, MELODY.y + 6, 96, 19, 9, 'rgba(255,255,255,0.85)');
      D.text(g, 'My Melody', MELODY.x, MELODY.y + 16, { size: 14, color: P.ink, weight: 800 });

      // speech bubble on good moments
      if (this.hostBubble.t > 0 && this.state !== 'howto') {
        const txt = this.hostBubble.text;
        const cw = Math.max(96, txt.length * 9 + 26);
        const bx = CM.clamp(MELODY.x - cw + 30, 8, CM.W - cw - 8);
        D.bubble(g, bx, MELODY.y - 152, cw, 40, MELODY.x - 6);
        D.text(g, txt, bx + cw / 2, MELODY.y - 132, { size: 15, weight: 800, color: P.pinkDeep });
      }
    },

    /* ---- HUD: score + jump counter ---- */
    drawHud(g) {
      D.rr(g, 14, 12, 168, 62, 14, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      D.coin(g, 36, 33, 12);
      D.text(g, String(this.score), 64, 33, { size: 22, color: '#c98a1f', weight: 800, align: 'left' });
      const jn = Math.min(this.jump + 1, JUMPS);
      D.text(g, 'Jump ' + jn + ' / ' + JUMPS, 98, 58, { size: 15, color: P.ink, weight: 700 });
    },

    /* ---- pump phase on-screen guidance ---- */
    drawPumpUI(g) {
      // height bar on the far left showing how high the swing is
      const frac = (this.amp - MIN_AMP) / (MAX_AMP - MIN_AMP);
      const bx = 24, by = 150, bw = 22, bh = 250;
      D.rr(g, bx - 6, by - 28, bw + 12, bh + 40, 12, 'rgba(255,255,255,0.85)', '#f0b9d2', 2);
      D.text(g, 'HIGH', bx + bw / 2, by - 16, { size: 14, color: P.pinkDeep, weight: 800 });
      D.rr(g, bx, by, bw, bh, 8, '#ffe9f3', '#f0b9d2', 2);
      // gold cap zone at top
      D.rr(g, bx + 2, by + 2, bw - 4, bh * 0.18, 6, 'rgba(246,207,90,0.6)');
      const fh = Math.max(6, bh * frac);
      D.rr(g, bx + 3, by + bh - fh, bw - 6, fh, 6, frac >= 0.95 ? P.yellowDeep : P.pink);

      const maxed = this.amp >= MAX_AMP - 0.001;

      // pump hint (top area so it never collides with the LEAP button)
      const hint = CM.touchMode ? 'Tap at the TOP of each swing to pump higher!'
        : 'Tap / SPACE at the top of each swing to pump higher!';
      D.rr(g, 250, 100, 460, 26, 13, 'rgba(255,255,255,0.78)');
      D.text(g, hint, 480, 113, { size: 14, color: P.pinkDeep, weight: 800 });

      // big LEAP button once the swing has lift
      if (this._canLeap) {
        const b = this.leapBtnRect();
        const pulse = maxed ? 1 + Math.sin(CM.time * 8) * 0.05 : 1;
        const col = maxed ? P.pinkDeep : P.mintDeep;
        g.save();
        g.translate(b.x + b.w / 2, b.y + b.h / 2);
        g.scale(pulse, pulse);
        D.rr(g, -b.w / 2, -b.h / 2 + 4, b.w, b.h, 18, 'rgba(90,40,70,0.18)');
        D.rr(g, -b.w / 2, -b.h / 2, b.w, b.h, 18, col, 'rgba(255,255,255,0.8)', 3);
        D.text(g, '🦋 LEAP! 🦋', 0, 1, { size: 24, color: '#fff', weight: 800 });
        g.restore();
        if (maxed) {
          D.star(g, b.x - 18, b.y + b.h / 2, 12, P.yellowDeep, CM.time * 3);
          D.star(g, b.x + b.w + 18, b.y + b.h / 2, 12, P.yellowDeep, -CM.time * 3);
        }
      }

      if (this.maxedMsg > 0) {
        const a = Math.min(1, this.maxedMsg * 3);
        g.globalAlpha = a;
        D.text(g, 'SO HIGH! LEAP NOW!', 480, 160, {
          size: 30, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 8
        });
        g.globalAlpha = 1;
      }
    },

    /* ---- launch timing bar ---- */
    drawLaunchBar(g) {
      const b = LAUNCH;
      D.rr(g, b.x - 12, b.y - 30, b.w + 24, b.h + 54, 14, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      D.text(g, 'LEAP!', b.x + b.w / 2, b.y - 16, { size: 16, color: P.pinkDeep, weight: 800 });
      // track
      D.rr(g, b.x, b.y, b.w, b.h, 12, '#ffe9f3', '#f0b9d2', 2);
      // gold zone in the centre
      const gz = b.w * 0.22;
      D.rr(g, b.x + b.w / 2 - gz / 2, b.y + 2, gz, b.h - 4, 8, 'rgba(246,207,90,0.7)');
      D.star(g, b.x + b.w / 2, b.y + b.h / 2, 9, P.yellowDeep);
      // sweeping marker
      const mx = b.x + this.launchMark * b.w;
      g.fillStyle = P.pinkDeep;
      g.beginPath();
      g.moveTo(mx, b.y - 8);
      g.lineTo(mx - 9, b.y - 22);
      g.lineTo(mx + 9, b.y - 22);
      g.closePath();
      g.fill();
      D.rr(g, mx - 3, b.y, 6, b.h, 3, P.pinkDeep);

      D.rr(g, 250, 574, 460, 24, 12, 'rgba(255,255,255,0.78)');
      D.text(g, CM.touchMode ? 'Tap on the gold for the best leap!' : 'Tap / SPACE on the gold for the best leap!',
        480, 586, { size: 14, color: P.pinkDeep, weight: 800 });
    },

    /* ---- result banner + distance ---- */
    drawResult(g) {
      // distance call-out near the landing spot
      const lx = CM.clamp(this.fly.x, 120, 840);
      D.bubble(g, lx - 70, GROUND_Y - 96, 140, 44, lx);
      D.text(g, this.landM + ' metres!', lx, GROUND_Y - 74, { size: 19, color: P.pinkDeep, weight: 800 });
      D.text(g, '+' + (this.lastPts || 0), lx, GROUND_Y - 56, { size: 14, color: '#c98a1f', weight: 800 });

      if (this.bigMsg) {
        const el = (this.state === 'result') ? (2.4 - this.resultT) : 0;
        const sc = Math.min(1, el * 4);
        D.text(g, this.bigMsg, 480, 150, {
          size: 30 + 36 * sc, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
        });
        D.star(g, 320, 150, 18, P.yellowDeep, CM.time * 2.5);
        D.star(g, 640, 150, 18, P.yellowDeep, -CM.time * 2.5);
      }

      // continue hint
      if (this.resultT < 1.1) {
        D.rr(g, 320, 574, 320, 24, 12, 'rgba(255,255,255,0.78)');
        D.text(g, CM.touchMode ? 'Tap to swing again!' : 'Tap / SPACE to swing again!',
          480, 586, { size: 14, color: P.pinkDeep, weight: 800 });
      }
    },

    /* ---- particles ---- */
    drawParts(g) {
      for (const pt of this.parts) {
        g.globalAlpha = CM.clamp(pt.life / pt.maxLife, 0, 1);
        if (pt.type === 'star') D.star(g, pt.x, pt.y, pt.size, pt.color, pt.rot);
        else if (pt.type === 'heart') D.heart(g, pt.x, pt.y, pt.size, pt.color);
        else D.circle(g, pt.x, pt.y, pt.size, pt.color);
      }
      g.globalAlpha = 1;
    },

    /* ---- how to play ---- */
    drawHowto(g) {
      g.fillStyle = 'rgba(70,40,70,0.3)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 210, 96, 540, 392, { title: '🌸 Swing Jump with My Melody' });
      CM.drawFriend(g, 'mymelody', 300, 440, 1.25, { bob: ((CM.time * 1.2) % 1) * 0.5 });
      D.text(g, '1. Tap at the TOP of each swing', 560, 178, { size: 17, color: P.ink, weight: 700 });
      D.text(g, 'to pump higher and higher!', 560, 202, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '2. When you are super high,', 560, 244, { size: 17, color: P.ink, weight: 700 });
      D.text(g, 'tap to LEAP off the swing!', 560, 268, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '3. Land in the sand far away', 560, 310, { size: 17, color: P.ink, weight: 700 });
      D.text(g, 'for big points! 🏖️', 560, 334, { size: 17, color: P.pinkDeep, weight: 800 });
      D.text(g, '5 jumps · fly as far as you can!', 480, 374, { size: 14, color: '#9a8a94' });
      if (CM.ui.button(g, 380, 400, 200, 56, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.startPump();
      }
    }
  });
})();
