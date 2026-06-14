/* Cinnamoroll Mansion — Bowling (hosted by Hello Kitty) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---- lane geometry ----
     Lane space: x in [-120, 120] (units), y from 0 (foul line, near player)
     to 430 (back of lane, where the pins live). proj() maps lane space to
     screen space as a trapezoid narrowing toward the top. */
  const L = { cx: 480, bottomY: 540, topY: 150, bottomHalf: 235, topHalf: 100, len: 430, halfU: 120 };
  const PIN_ROWS = [340, 368, 396, 424]; // 1,2,3,4 pins front-to-back
  const PIN_GAP = 30;
  const BALL_R = 15;       // lane units
  const HIT_DIST = 27;     // ball-vs-pin collision distance (generous)
  const KNOCK_RADIUS = 40; // falling pin knocks neighbors within this
  const KNOCK_CHANCE = 0.7;
  const FRICTION = 90;     // lane units / s^2
  const MAX_PARTS = 90;
  const KITTY = { x: 802, y: 514 };
  const METER = { x: 880, y: 170, w: 34, h: 350 };

  function proj(lx, ly) {
    const t = CM.clamp(ly / L.len, 0, 1.06);
    const half = CM.lerp(L.bottomHalf, L.topHalf, t);
    return { x: L.cx + (lx / L.halfU) * half, y: CM.lerp(L.bottomY, L.topY, t), k: half / L.halfU };
  }

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'bowling',
    name: 'Bowling',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';
      this.score = 0;
      this.fIdx = 0;     // frame 0..4
      this.rollIdx = 0;  // 0 or 1
      this.frames = [];
      for (let i = 0; i < 5; i++) {
        this.frames.push({ r1: null, r2: null, strike: false, spare: false, pts: 0, done: false });
      }
      this.buildPins();
      this.downBefore = 0;
      this.aimT = 0;
      this.aimU = 0;
      this.power = 0;
      this.powerT = 0;
      this.ball = { lx: 0, ly: 26, vx: 0, vy: 0, active: false };
      this.parts = [];
      this.shk = { t: 0, dur: 1, mag: 0 };
      this.crashCd = 0;
      this.msg = '';
      this.bigMsg = '';
      this.lastPins = 0;
      this.resultT = 0;
      this.resultDur = 1;
      this.settleT = 0;
      this.goT = 0;
      this.finished = false;
    },

    exit() {},

    /* ================= setup helpers ================= */
    buildPins() {
      this.pins = [];
      for (let r = 0; r < 4; r++) {
        for (let i = 0; i <= r; i++) {
          this.pins.push({
            lx: (i - r / 2) * PIN_GAP,
            ly: PIN_ROWS[r],
            up: true, fall: 0, dir: 1, chainT: 0,
            wob: Math.random() * 7
          });
        }
      }
    },

    startAim() {
      this.state = 'aim';
      this.aimT = 0;
      this.aimU = 0;
      this.power = 0;
      this.powerT = 0;
      this.ball.lx = 0;
      this.ball.ly = 26;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.active = false;
      this.settleT = 0;
      this.msg = '';
      this.bigMsg = '';
    },

    throwBall() {
      CM.audio.play('whoosh');
      this.ball.lx = this.aimU;
      this.ball.ly = 26;
      this.ball.vx = (1 - this.power) * CM.rand(-24, 24); // weak rolls drift a little
      this.ball.vy = CM.lerp(230, 620, this.power);       // weakest stops just short of the pins
      this.ball.active = true;
      this.settleT = 0;
      this.state = 'rolling';
    },

    /* ================= update ================= */
    update(dt) {
      if (this.shk.t > 0) this.shk.t -= dt;
      if (this.crashCd > 0) this.crashCd -= dt;
      this.updateParts(dt);

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.startAim();
          break;

        case 'aim':
          this.aimT += dt;
          this.aimU = Math.sin(this.aimT * 3.0) * 92;
          this.ball.lx = this.aimU;
          if (anyPress()) {
            CM.audio.play('pop');
            this.state = 'power';
            this.powerT = 0;
            this.power = 0;
          }
          break;

        case 'power':
          this.powerT += dt;
          this.power = (1 - Math.cos(this.powerT * 3.4)) / 2; // 0 → 1 → 0 ...
          if (anyPress()) {
            CM.audio.play('click');
            this.throwBall();
          }
          break;

        case 'rolling':
          this.updateRolling(dt);
          break;

        case 'pinResult':
          this.resultT -= dt;
          if (this.resultDur - this.resultT > 0.55 && anyPress()) this.resultT = 0; // tap to skip
          if (this.resultT <= 0) this.afterRoll();
          break;

        case 'gameOver':
          this.goT -= dt;
          if (this.goT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('bowling', this.score, Math.ceil(this.score / 25));
          }
          break;
      }
    },

    updateRolling(dt) {
      const b = this.ball;
      if (b.active) {
        b.vy -= FRICTION * dt;
        b.ly += b.vy * dt;
        b.lx += b.vx * dt;
        // bumpers! (kid-friendly: ball bounces back instead of guttering)
        if (Math.abs(b.lx) > L.halfU - BALL_R) {
          b.lx = CM.clamp(b.lx, -(L.halfU - BALL_R), L.halfU - BALL_R);
          b.vx *= -0.6;
          CM.audio.play('boing');
        }
        // ball vs pins (circle collision in lane space)
        for (const pin of this.pins) {
          if (pin.up && CM.dist(b.lx, b.ly, pin.lx, pin.ly) < HIT_DIST) {
            this.knockPin(pin, (pin.lx - b.lx) || CM.rand(-1, 1));
            b.vy *= 0.93;
            b.vx += CM.clamp((b.lx - pin.lx) * 0.8, -22, 22);
          }
        }
        if (b.ly > L.len + 45 || b.vy <= 8) b.active = false;
      }

      // falling pins + chain reaction
      let busy = false;
      for (const pin of this.pins) {
        if (!pin.up && pin.fall < 1) {
          pin.fall = Math.min(1, pin.fall + dt / 0.45);
          if (pin.fall < 1) busy = true;
        }
        if (pin.chainT > 0) {
          pin.chainT -= dt;
          if (pin.chainT > 0) busy = true;
          else {
            for (const o of this.pins) {
              if (o.up && o !== pin && CM.dist(pin.lx, pin.ly, o.lx, o.ly) < KNOCK_RADIUS &&
                  Math.random() < KNOCK_CHANCE) {
                this.knockPin(o, (o.lx - pin.lx) || CM.rand(-1, 1));
                busy = true;
              }
            }
          }
        }
      }

      if (!b.active && !busy) {
        this.settleT += dt;
        if (this.settleT > 0.45) this.endRoll();
      }
    },

    knockPin(pin, dir) {
      if (!pin.up) return;
      pin.up = false;
      pin.fall = 0;
      pin.dir = dir >= 0 ? 1 : -1;
      pin.chainT = 0.12;
      if (this.crashCd <= 0) {
        CM.audio.play('crash');
        this.crashCd = 0.14;
      }
      this.burst(pin.lx, pin.ly, 5);
    },

    endRoll() {
      const down = this.pins.filter((p) => !p.up).length;
      const n = down - this.downBefore;
      this.lastPins = n;
      const f = this.frames[this.fIdx];
      if (this.rollIdx === 0) f.r1 = n; else f.r2 = n;
      f.strike = this.rollIdx === 0 && n === 10;
      f.spare = !f.strike && this.rollIdx === 1 && (f.r1 || 0) + (f.r2 || 0) === 10;

      if (f.strike) {
        this.msg = 'Strike!! Amazing!!';
        this.bigMsg = 'STRIKE!!';
        CM.audio.play('tada');
        this.doShake(0.5, 8);
        this.celebrate(34);
      } else if (f.spare) {
        this.msg = 'Spare!! Woohoo!!';
        this.bigMsg = 'SPARE!!';
        CM.audio.play('cheer');
        this.doShake(0.35, 5);
        this.celebrate(24);
      } else if (n >= 7) {
        this.msg = 'Wow! Great roll!';
        CM.audio.play('ding');
        this.celebrate(14);
      } else if (n >= 4) {
        this.msg = 'Nice one!';
        CM.audio.play('pop');
        this.celebrate(8);
      } else if (n >= 1) {
        this.msg = 'Good try!';
        CM.audio.play('pop');
      } else {
        this.msg = 'So close!';
        CM.audio.play('miss');
      }

      this.state = 'pinResult';
      this.resultDur = f.strike || f.spare ? 2.0 : 1.5;
      this.resultT = this.resultDur;
    },

    afterRoll() {
      const f = this.frames[this.fIdx];
      if (this.rollIdx === 0 && !f.strike) {
        // roll 2 of the same frame — knocked pins stay down
        this.rollIdx = 1;
        this.downBefore = this.pins.filter((p) => !p.up).length;
        this.startAim();
        return;
      }
      // frame is over — simple kid scoring: 10/pin, +30 strike, +15 spare
      const total = (f.r1 || 0) + (f.r2 || 0);
      f.pts = total * 10 + (f.strike ? 30 : f.spare ? 15 : 0);
      f.done = true;
      this.score += f.pts;
      if (this.fIdx === 4) {
        this.state = 'gameOver';
        this.goT = 1.4;
        CM.audio.play('coin');
      } else {
        this.fIdx++;
        this.rollIdx = 0;
        this.buildPins();
        this.downBefore = 0;
        this.startAim();
      }
    },

    /* ================= juice ================= */
    doShake(t, mag) {
      this.shk = { t: t, dur: t, mag: mag };
    },

    spawnPart(pt) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      pt.maxLife = pt.life;
      this.parts.push(pt);
    },

    burst(lx, ly, n) {
      const p = proj(lx, ly);
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: p.x, y: p.y - 18,
          vx: CM.rand(-110, 110), vy: CM.rand(-170, -30),
          life: CM.rand(0.35, 0.7),
          type: 'spark',
          color: Math.random() < 0.5 ? '#fff' : P.yellow,
          size: CM.rand(2.5, 4.5), rot: 0, vr: 0
        });
      }
    },

    celebrate(n) {
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: CM.rand(320, 640), y: CM.rand(130, 270),
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
        pt.vy += 240 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.rot += pt.vr * dt;
      }
    },

    /* ================= draw ================= */
    draw(g) {
      // screen shake (always inside save/restore — context never stays transformed)
      g.save();
      if (this.shk.t > 0) {
        const m = this.shk.mag * (this.shk.t / this.shk.dur);
        g.translate(CM.rand(-m, m), CM.rand(-m, m));
      }

      this.drawBackdrop(g);
      this.drawLane(g);

      // depth-sorted lane objects (far first)
      const items = [];
      for (const pin of this.pins) {
        if (!pin.up && pin.fall >= 0.95) continue;
        const pp = pin;
        items.push({ ly: pp.ly, f: () => this.drawPin(g, pp) });
      }
      const showBall = (this.state === 'aim' || this.state === 'power' ||
        this.state === 'rolling' || this.state === 'pinResult') && this.ball.ly < L.len + 38;
      if (showBall) items.push({ ly: this.ball.ly, f: () => this.drawBall(g) });
      items.sort((a, b) => b.ly - a.ly);
      for (const it of items) it.f();

      // the bowler (player's customized character) at the bottom of the lane
      const px = proj(this.aimU, 0).x;
      CM.drawPlayer(g, px, 568, 1.02, 'up', 0);

      // Hello Kitty cheering at the side of the lane
      const excited = this.state === 'pinResult' && this.lastPins >= 4;
      CM.drawFriend(g, 'hellokitty', KITTY.x, KITTY.y, 1.08, {
        bob: excited ? (CM.time * 2.4) % 1 : ((CM.time * 0.9) % 1) * 0.45,
        flip: true
      });

      this.drawParts(g);
      g.restore(); // end shake

      /* ---- HUD (not shaken) ---- */
      this.drawScoreboard(g);
      D.rr(g, 14, 12, 160, 62, 14, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      D.text(g, 'Score ' + this.score, 94, 32, { size: 20, color: '#c98a1f', weight: 800 });
      D.text(g, 'Frame ' + (this.fIdx + 1) + '/5 · Roll ' + (this.rollIdx + 1), 94, 56,
        { size: 14, color: P.ink });

      if (this.state === 'power') this.drawMeter(g);

      // Hello Kitty's reaction bubble
      if (this.state === 'pinResult' && this.msg) {
        D.bubble(g, 636, 346, 240, 52, KITTY.x);
        D.text(g, this.msg, 756, 373, { size: 16, weight: 800, color: P.ink });
      }
      // big banner for strikes / spares
      if (this.state === 'pinResult' && this.bigMsg) {
        const el = this.resultDur - this.resultT;
        const sc = Math.min(1, el * 4);
        D.text(g, this.bigMsg, 480, 296, {
          size: 26 + 44 * sc, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
        });
        D.star(g, 332, 296, 20, P.yellowDeep, CM.time * 2.5);
        D.star(g, 628, 296, 20, P.yellowDeep, -CM.time * 2.5);
      }

      // hint bar
      let hint = '';
      if (this.state === 'aim') hint = CM.touchMode ? 'Tap to lock your aim!' : 'Click or SPACE to lock your aim!';
      else if (this.state === 'power') hint = 'Stop the meter — gold zone = mighty roll!';
      if (hint) {
        D.rr(g, 260, 574, 440, 24, 12, 'rgba(255,255,255,0.75)');
        D.text(g, hint, 480, 586, { size: 14, color: P.pinkDeep, weight: 800 });
      }

      if (this.state === 'howto') this.drawHowto(g);
      if (this.state === 'gameOver') {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(0, 0, CM.W, CM.H);
        D.text(g, 'Great game!!', 480, 272, { size: 54, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10 });
        D.text(g, 'Score: ' + this.score, 480, 332, { size: 28, color: P.blueDeep, weight: 800 });
      }
    },

    drawBackdrop(g) {
      // wall
      const wg = g.createLinearGradient(0, 0, 0, 170);
      wg.addColorStop(0, '#e6d9fb');
      wg.addColorStop(1, '#f6e3ff');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, 170);
      // floor
      const fg = g.createLinearGradient(0, 150, 0, CM.H);
      fg.addColorStop(0, '#ffd7ea');
      fg.addColorStop(1, '#ffeaf4');
      g.fillStyle = fg;
      g.fillRect(0, 150, CM.W, CM.H - 150);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(0, 148, CM.W, 5);
      // floor dots
      g.fillStyle = 'rgba(255,255,255,0.45)';
      for (let i = 0; i < 12; i++) {
        const dx = (i * 197 + 60) % 940;
        const dy = 200 + ((i * 131) % 360);
        g.beginPath();
        g.ellipse(dx, dy, 10, 4.5, 0, 0, Math.PI * 2);
        g.fill();
      }
      // bunting
      const cols = [P.pink, P.mint, P.yellow, P.lavender];
      for (let i = 0; i * 56 < CM.W; i++) {
        g.fillStyle = cols[i % 4];
        g.beginPath();
        g.moveTo(i * 56, 0);
        g.lineTo(i * 56 + 56, 0);
        g.lineTo(i * 56 + 28, 26);
        g.closePath();
        g.fill();
      }
      // wall stars
      D.star(g, 70, 92, 9, 'rgba(255,255,255,0.8)');
      D.star(g, 168, 64, 6, 'rgba(255,255,255,0.7)');
      D.star(g, 812, 86, 8, 'rgba(255,255,255,0.8)');
      // pin pit + sign
      D.rr(g, L.cx - 130, 70, 260, 34, 12, 'rgba(255,255,255,0.92)', '#f0b9d2', 2.5);
      D.text(g, '★ KITTY BOWL ★', L.cx, 88, { size: 17, color: P.pinkDeep, weight: 800 });
      D.rr(g, L.cx - 152, 108, 304, 66, 16, '#8a6fae', '#76598f', 3);
      D.rr(g, L.cx - 140, 116, 280, 44, 10, '#5d4378');
    },

    drawLane(g) {
      // gutters (with friendly bumpers)
      g.fillStyle = '#d6c2ef';
      g.beginPath();
      g.moveTo(L.cx - L.bottomHalf - 36, L.bottomY);
      g.lineTo(L.cx - L.topHalf - 18, L.topY);
      g.lineTo(L.cx - L.topHalf, L.topY);
      g.lineTo(L.cx - L.bottomHalf, L.bottomY);
      g.closePath();
      g.fill();
      g.beginPath();
      g.moveTo(L.cx + L.bottomHalf + 36, L.bottomY);
      g.lineTo(L.cx + L.topHalf + 18, L.topY);
      g.lineTo(L.cx + L.topHalf, L.topY);
      g.lineTo(L.cx + L.bottomHalf, L.bottomY);
      g.closePath();
      g.fill();
      // lane
      const lg = g.createLinearGradient(0, L.topY, 0, L.bottomY);
      lg.addColorStop(0, '#edd0a4');
      lg.addColorStop(1, '#f9e7c8');
      g.fillStyle = lg;
      g.beginPath();
      g.moveTo(L.cx - L.bottomHalf, L.bottomY);
      g.lineTo(L.cx - L.topHalf, L.topY);
      g.lineTo(L.cx + L.topHalf, L.topY);
      g.lineTo(L.cx + L.bottomHalf, L.bottomY);
      g.closePath();
      g.fill();
      g.strokeStyle = '#d9b282';
      g.lineWidth = 3;
      g.stroke();
      // board seams
      g.strokeStyle = 'rgba(160,110,60,0.13)';
      g.lineWidth = 2;
      for (let u = -0.75; u <= 0.76; u += 0.25) {
        g.beginPath();
        g.moveTo(L.cx + u * L.bottomHalf, L.bottomY);
        g.lineTo(L.cx + u * L.topHalf, L.topY);
        g.stroke();
      }
      // lane arrow decals
      for (const alx of [-60, -30, 0, 30, 60]) {
        const aly = 175 - Math.abs(alx) * 0.55;
        const ap = proj(alx, aly);
        const asz = 8 * ap.k;
        g.fillStyle = 'rgba(240,98,146,0.3)';
        g.beginPath();
        g.moveTo(ap.x, ap.y - asz * 1.6);
        g.lineTo(ap.x - asz, ap.y);
        g.lineTo(ap.x + asz, ap.y);
        g.closePath();
        g.fill();
      }
      // foul line
      const f1 = proj(-120, 30);
      const f2 = proj(120, 30);
      g.strokeStyle = 'rgba(240,98,146,0.5)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(f1.x, f1.y);
      g.lineTo(f2.x, f2.y);
      g.stroke();

      // aim guide
      if (this.state === 'aim' || this.state === 'power') {
        g.save();
        g.strokeStyle = this.state === 'aim' ? 'rgba(240,98,146,0.55)' : 'rgba(240,98,146,0.25)';
        g.lineWidth = 3;
        g.setLineDash([10, 12]);
        const a0 = proj(this.aimU, 34);
        const a1 = proj(this.aimU, L.len - 16);
        g.beginPath();
        g.moveTo(a0.x, a0.y);
        g.lineTo(a1.x, a1.y);
        g.stroke();
        g.restore();
        if (this.state === 'aim') {
          // sweeping arrow marker
          g.fillStyle = P.pinkDeep;
          g.beginPath();
          g.moveTo(a0.x, a0.y - 26);
          g.lineTo(a0.x - 13, a0.y);
          g.lineTo(a0.x + 13, a0.y);
          g.closePath();
          g.fill();
        }
      }
    },

    drawPin(g, pin) {
      const pr = proj(pin.lx, pin.ly);
      const s = pr.k * 1.02;
      const alpha = pin.up ? 1 : Math.max(0, 1 - pin.fall * 1.12);
      if (alpha <= 0) return;
      g.save();
      g.translate(pr.x, pr.y);
      g.scale(s, s);
      if (pin.up) {
        D.shadow(g, 0, 0, 12);
        g.rotate(Math.sin(CM.time * 1.7 + pin.wob) * 0.018);
      } else {
        g.globalAlpha = alpha;
        g.rotate(pin.dir * pin.fall * 1.5);
      }
      // body + head
      D.ellipse(g, 0, -14, 10.5, 14.5, '#fff', '#e7d8e2', 2);
      D.circle(g, 0, -36, 8, '#fff', '#e7d8e2', 2);
      D.rr(g, -5, -33, 10, 8, 3, '#fff');
      // pink neck stripes
      D.rr(g, -7.5, -27.5, 15, 3.4, 1.7, P.pink);
      D.rr(g, -6.8, -22.5, 13.6, 3, 1.5, P.pink);
      // cute face
      g.fillStyle = '#4a3b46';
      g.beginPath();
      g.ellipse(-2.8, -37, 1.2, 1.7, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(2.8, -37, 1.2, 1.7, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#4a3b46';
      g.lineWidth = 1.1;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(0, -34.5, 2, 0.2 * Math.PI, 0.8 * Math.PI);
      g.stroke();
      g.fillStyle = 'rgba(255,140,160,0.5)';
      g.beginPath();
      g.ellipse(-5.5, -34, 1.7, 1.2, 0, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.ellipse(5.5, -34, 1.7, 1.2, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    },

    drawBall(g) {
      const b = this.ball;
      const p = proj(b.lx, b.ly);
      const r = BALL_R * p.k * 0.88;
      const cy = p.y - r * 0.55;
      D.shadow(g, p.x, p.y, r * 0.95);
      D.circle(g, p.x, cy, r, P.pinkDeep, '#d44f80', 2);
      // finger holes spin as it rolls
      const rot = b.ly * 0.045 + 0.8;
      for (let i = 0; i < 3; i++) {
        const a = rot + (i * Math.PI * 2) / 3;
        D.circle(g, p.x + Math.cos(a) * r * 0.38, cy + Math.sin(a) * r * 0.38, r * 0.15, '#b23a66');
      }
      D.circle(g, p.x - r * 0.34, cy - r * 0.38, r * 0.26, 'rgba(255,255,255,0.55)');
    },

    drawScoreboard(g) {
      for (let i = 0; i < 5; i++) {
        const x = 252 + i * 94;
        const f = this.frames[i];
        const cur = i === this.fIdx && this.state !== 'gameOver' && this.state !== 'howto';
        D.rr(g, x, 8, 86, 58, 10, 'rgba(255,255,255,0.92)', cur ? P.yellowDeep : '#f0b9d2', cur ? 3 : 2);
        D.text(g, 'F' + (i + 1), x + 18, 20, { size: 14, color: '#b9a8b3', weight: 800 });
        if (f.strike) {
          D.star(g, x + 24, 36, 8, P.yellowDeep);
          D.text(g, 'X!', x + 50, 36, { size: 20, color: P.pinkDeep, weight: 800 });
        } else {
          const a = f.r1 === null ? '·' : String(f.r1);
          const b = f.r2 === null ? '·' : String(f.r2);
          D.text(g, a + '+' + b, x + 43, 36, { size: 17, weight: 800, color: f.spare ? P.pinkDeep : P.ink });
        }
        if (f.done) D.text(g, '+' + f.pts, x + 43, 55, { size: 14, color: '#c98a1f', weight: 800 });
      }
    },

    drawMeter(g) {
      const M = METER;
      D.rr(g, M.x - 8, M.y - 36, M.w + 16, M.h + 60, 14, 'rgba(255,255,255,0.88)', '#f0b9d2', 2);
      D.text(g, 'POWER', M.x + M.w / 2, M.y - 18, { size: 14, color: P.pinkDeep, weight: 800 });
      D.rr(g, M.x, M.y, M.w, M.h, 10, '#ffe9f3', '#f0b9d2', 2);
      // gold sweet zone at the top
      D.rr(g, M.x + 2, M.y + 2, M.w - 4, M.h * 0.28, 8, 'rgba(246,207,90,0.6)');
      D.star(g, M.x + M.w / 2, M.y + M.h * 0.14, 9, P.yellowDeep);
      // oscillating fill
      const fh = Math.max(5, M.h * this.power);
      D.rr(g, M.x + 3, M.y + M.h - fh, M.w - 6, fh, 8, this.power >= 0.72 ? P.yellowDeep : P.pinkDeep);
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(70,40,70,0.3)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 220, 104, 520, 380, { title: '🎳 Bowling with Hello Kitty' });
      CM.drawFriend(g, 'hellokitty', 305, 436, 1.25, { bob: ((CM.time * 1.2) % 1) * 0.5 });
      D.text(g, '1. Tap to stop the sliding arrow', 560, 182, { size: 17, color: P.ink, weight: 700 });
      D.text(g, 'and aim your ball!', 560, 206, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '2. Tap again to lock the power —', 560, 248, { size: 17, color: P.ink, weight: 700 });
      D.text(g, 'gold zone = mighty roll!', 560, 272, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '3. Knock down all 10 pins', 560, 314, { size: 17, color: P.ink, weight: 700 });
      D.text(g, 'for a STRIKE!', 560, 338, { size: 17, color: P.pinkDeep, weight: 800 });
      D.text(g, '5 frames · 2 rolls each · Have fun!', 480, 372, { size: 14, color: '#9a8a94' });
      if (CM.ui.button(g, 390, 398, 200, 56, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.startAim();
      }
    },

    drawParts(g) {
      for (const pt of this.parts) {
        g.globalAlpha = CM.clamp(pt.life / pt.maxLife, 0, 1);
        if (pt.type === 'star') D.star(g, pt.x, pt.y, pt.size, pt.color, pt.rot);
        else if (pt.type === 'heart') D.heart(g, pt.x, pt.y, pt.size, pt.color);
        else D.circle(g, pt.x, pt.y, pt.size, pt.color);
      }
      g.globalAlpha = 1;
    }
  });
})();
