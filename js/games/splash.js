/* Cinnamoroll Mansion — Water Balloon Toss (hosted by Badtz-Maru) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---- layout (side-on backyard) ----
     Player lobs from the lower-left; targets sit across the field on a fence
     rail. The balloon flies a real parabola in screen space (gravity). */
  const THROW = { x: 150, y: 470 };     // balloon launch point (player's hand)
  const GRAVITY = 1500;                 // px/s^2 on the arc
  const GROUND_Y = 520;                 // grass level where stray balloons splash
  const FENCE_Y = 372;                  // top of the fence rail (target baseline)
  const BADTZ = { x: 96, y: 560 };      // host cheering on the left
  const TOSSES = 12;
  const HIT_PAD = 30;                    // extra forgiveness added to target radius
  const MAX_PARTS = 110;

  // Angle sweeps between these (radians above horizontal); power maps to speed.
  const ANG_MIN = 0.16 * Math.PI;
  const ANG_MAX = 0.46 * Math.PI;
  const SPD_MIN = 560;
  const SPD_MAX = 1080;

  const METER = { x: 884, y: 168, w: 34, h: 340 };

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'splash',
    name: 'Water Balloon Toss',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';   // howto -> angle -> power -> throw -> result -> (repeat) -> done
      this.score = 0;
      this.tossIdx = 0;       // 0..TOSSES-1
      this.finished = false;

      this.buildTargets();

      this.angle = ANG_MIN;
      this.angT = 0;
      this.power = 0;
      this.powerT = 0;

      // active balloon in flight
      this.b = { x: THROW.x, y: THROW.y, vx: 0, vy: 0, active: false };
      this.splashes = [];     // lingering splash decals on the grass
      this.parts = [];
      this.shk = { t: 0, dur: 1, mag: 0 };

      this.msg = '';
      this.bigMsg = '';
      this.lastHitVal = 0;
      this.resultT = 0;
      this.resultDur = 1;
      this.doneT = 0;

      this.hostBubble = { text: '', t: 0 };
      this.hostHappy = 0;
      this.armPhase = 0;      // player throw animation 0..1 (0 = idle)
      this.clouds = [
        { x: 220, y: 70, s: 1.0, v: 6 },
        { x: 560, y: 50, s: 1.3, v: 9 },
        { x: 800, y: 92, s: 0.85, v: 5 }
      ];
    },

    exit() {},

    /* ================= setup ================= */
    buildTargets() {
      // A cute row of can/ring targets on the fence rail, plus a dunk seat and
      // one or two slow movers for variety. value: small can 15, big tub 10,
      // moving ring / dunk bonus 25.
      this.targets = [
        { kind: 'can', x: 430, y: FENCE_Y - 18, r: 24, value: 15, alive: true, wob: 0, fall: 0, move: 0 },
        { kind: 'can', x: 520, y: FENCE_Y - 18, r: 24, value: 15, alive: true, wob: 1.4, fall: 0, move: 0 },
        { kind: 'tub', x: 640, y: FENCE_Y - 6, r: 38, value: 10, alive: true, wob: 0.7, fall: 0, move: 0 },
        // dunk-tank seat (bonus)
        { kind: 'dunk', x: 805, y: FENCE_Y - 40, r: 34, value: 25, alive: true, wob: 0, fall: 0, move: 0 },
        // slow floating ring that drifts side to side (bonus)
        {
          kind: 'ring', x: 560, y: FENCE_Y - 92, r: 30, value: 25, alive: true,
          wob: 0, fall: 0, move: 1, baseX: 560, range: 150, ph: 0, speed: 0.55
        }
      ];
    },

    /* ================= state transitions ================= */
    startAngle() {
      this.state = 'angle';
      this.angT = 0;
      this.angle = ANG_MIN;
      this.power = 0;
      this.powerT = 0;
      this.b.active = false;
      this.b.x = THROW.x;
      this.b.y = THROW.y;
      this.msg = '';
      this.bigMsg = '';
    },

    throwBalloon() {
      CM.audio.play('whoosh');
      this.armPhase = 0.0001;
      this.b.x = THROW.x;
      this.b.y = THROW.y;
      const spd = CM.lerp(SPD_MIN, SPD_MAX, this.power);
      this.b.vx = Math.cos(this.angle) * spd;
      this.b.vy = -Math.sin(this.angle) * spd;
      this.b.active = true;
      this.state = 'throw';
      this.scored = false;
    },

    /* ================= update ================= */
    update(dt) {
      if (this.shk.t > 0) this.shk.t -= dt;
      if (this.hostBubble.t > 0) this.hostBubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      if (this.armPhase > 0) {
        this.armPhase += dt * 3.2;
        if (this.armPhase >= 1) this.armPhase = 0;
      }
      this.updateParts(dt);
      this.updateSplashes(dt);
      this.moveTargets(dt);
      // clouds drift gently
      for (const c of this.clouds) {
        c.x += c.v * dt;
        if (c.x > CM.W + 70) c.x = -70;
      }

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.startAngle();
          break;

        case 'angle':
          this.angT += dt;
          // sweep up and down between min..max
          this.angle = ANG_MIN + (ANG_MAX - ANG_MIN) * (1 - Math.cos(this.angT * 2.6)) / 2;
          if (anyPress()) {
            CM.audio.play('pop');
            this.state = 'power';
            this.powerT = 0;
            this.power = 0;
          }
          break;

        case 'power':
          this.powerT += dt;
          this.power = (1 - Math.cos(this.powerT * 3.6)) / 2; // 0 -> 1 -> 0 ...
          if (anyPress()) {
            CM.audio.play('click');
            this.throwBalloon();
          }
          break;

        case 'throw':
          this.updateThrow(dt);
          break;

        case 'result':
          this.resultT -= dt;
          if (this.resultDur - this.resultT > 0.4 && anyPress()) this.resultT = 0; // tap to skip
          if (this.resultT <= 0) this.afterToss();
          break;

        case 'done':
          // gentle celebration sprinkle
          if (this.parts.length < 70 && Math.random() < 0.3) {
            this.spawnPart({
              x: CM.rand(280, 680), y: CM.rand(140, 300),
              vx: CM.rand(-50, 50), vy: CM.rand(-150, -40),
              life: CM.rand(0.6, 1.2),
              type: Math.random() < 0.5 ? 'star' : 'heart',
              color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.blueDeep]),
              size: CM.rand(7, 12), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
            });
          }
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('splash', this.score, CM.clamp(Math.ceil(this.score / 16), 5, 30));
          }
          break;
      }
    },

    moveTargets(dt) {
      for (const t of this.targets) {
        if (t.move && t.alive) {
          t.ph += dt * t.speed;
          t.x = t.baseX + Math.sin(t.ph * Math.PI * 2) * t.range * 0.5;
        }
        if (!t.alive && t.fall < 1) t.fall = Math.min(1, t.fall + dt / 0.5);
      }
    },

    updateThrow(dt) {
      const b = this.b;
      if (b.active) {
        b.vy += GRAVITY * dt;
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        // check target hits while descending / passing through (generous radius)
        if (!this.scored) {
          for (const t of this.targets) {
            if (!t.alive) continue;
            if (CM.dist(b.x, b.y, t.x, t.y) < t.r + HIT_PAD) {
              this.hitTarget(t);
              b.active = false;
              this.scored = true;
              break;
            }
          }
        }

        // landed on grass (a harmless splash)
        if (b.active && b.y >= GROUND_Y) {
          b.y = GROUND_Y;
          b.active = false;
          if (!this.scored) this.missSplash(b.x, b.y);
        }
        // flew off the right/left edge
        if (b.active && (b.x > CM.W + 40 || b.x < -40)) {
          b.active = false;
          if (!this.scored) this.missSplash(CM.clamp(b.x, 20, CM.W - 20), GROUND_Y);
        }
      } else {
        // brief beat after the balloon stops, then show the result
        this.endThrow();
      }
    },

    /* ================= hits & misses ================= */
    hitTarget(t) {
      t.alive = false;
      t.fall = 0;
      this.score += t.value;
      this.lastHitVal = t.value;
      this.splash(t.x, t.y, true);
      this.doShake(t.value >= 25 ? 0.45 : 0.28, t.value >= 25 ? 8 : 5);
      this.floatText(t.x, t.y - t.r - 6, '+' + t.value, t.value >= 25 ? '#e0a81f' : P.blueDeep);

      if (t.value >= 25) {
        this.bigMsg = t.kind === 'dunk' ? 'DUNK!! 💦' : 'BONUS!! ✨';
        this.msg = 'WOW!! Bullseye!!';
        CM.audio.play('tada');
        this.celebrate(28);
        this.say('WOOHOO!!', 1.8);
      } else if (t.value >= 15) {
        this.msg = 'Great shot!';
        CM.audio.play('ding');
        this.celebrate(14);
        this.say('Nice one!', 1.3);
      } else {
        this.msg = 'Splash! Nice!';
        CM.audio.play('ding');
        this.celebrate(10);
        this.say('Yeah!', 1.2);
      }
      CM.audio.play('splash');
    },

    missSplash(x, y) {
      this.splash(x, y, false);
      CM.audio.play('splash');
      this.msg = CM.pick(['So close!', 'Good try!', 'Almost!', 'Nearly!']);
    },

    endThrow() {
      // decide the result message if the balloon vanished without setting one
      this.state = 'result';
      const good = this.scored;
      this.resultDur = (good && this.lastHitVal >= 25) ? 1.7 : (good ? 1.25 : 0.95);
      this.resultT = this.resultDur;
      if (good) this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    afterToss() {
      this.tossIdx++;
      this.bigMsg = '';
      // refill any dunk/can occasionally so there's always something to aim at?
      // Keep it simple: targets stay down once hit (skill: clear the field).
      // If everything is down, respawn a fresh set so later balloons still score.
      if (this.targets.every((t) => !t.alive)) {
        this.buildTargets();
      }
      if (this.tossIdx >= TOSSES) {
        this.state = 'done';
        this.doneT = 1.8;
        this.shk = { t: 0.5, dur: 0.5, mag: 7 };
        this.say('Great tossing!', 3);
        CM.audio.play('cheer');
        this.celebrate(24);
      } else {
        this.startAngle();
      }
    },

    say(text, t) {
      this.hostBubble = { text: text, t: t };
      this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    /* ================= juice ================= */
    doShake(t, mag) { this.shk = { t: t, dur: t, mag: mag }; },

    spawnPart(pt) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      pt.maxLife = pt.life;
      this.parts.push(pt);
    },

    // a burst of water droplets (and a lingering puddle decal)
    splash(x, y, big) {
      const n = big ? 16 : 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + CM.rand(-0.3, 0.3);
        const sp = CM.rand(70, big ? 230 : 150);
        this.spawnPart({
          x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - CM.rand(40, 120),
          life: CM.rand(0.35, 0.7),
          type: 'drop',
          color: CM.pick(['#bfe7ff', '#8ecdf6', '#dff3ff', '#ffffff']),
          size: CM.rand(3, big ? 6 : 4.5), rot: 0, vr: 0
        });
      }
      if (this.splashes.length >= 14) this.splashes.shift();
      this.splashes.push({ x: x, y: Math.min(y, GROUND_Y), t: 0, life: 1.4, r: big ? 30 : 20 });
    },

    celebrate(n) {
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: CM.rand(300, 660), y: CM.rand(120, 250),
          vx: CM.rand(-90, 90), vy: CM.rand(-190, -40),
          life: CM.rand(0.6, 1.25),
          type: Math.random() < 0.5 ? 'star' : 'heart',
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep]),
          size: CM.rand(7, 13), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
        });
      }
    },

    floatText(x, y, str, color) {
      this.spawnPart({
        x: x, y: y, vx: 0, vy: -42, life: 1.1, type: 'txt',
        str: str, color: color, size: 22, rot: 0, vr: 0
      });
    },

    updateParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const pt = this.parts[i];
        pt.life -= dt;
        if (pt.life <= 0) { this.parts.splice(i, 1); continue; }
        if (pt.type === 'drop') pt.vy += 520 * dt;
        else if (pt.type === 'txt') { /* floats straight up */ }
        else pt.vy += 240 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.rot += pt.vr * dt;
      }
    },

    updateSplashes(dt) {
      for (let i = this.splashes.length - 1; i >= 0; i--) {
        const s = this.splashes[i];
        s.t += dt;
        if (s.t >= s.life) this.splashes.splice(i, 1);
      }
    },

    /* ================= draw ================= */
    draw(g) {
      g.save();
      if (this.shk.t > 0) {
        const m = this.shk.mag * (this.shk.t / this.shk.dur);
        g.translate(CM.rand(-m, m), CM.rand(-m, m));
      }

      this.drawBackyard(g);

      // grass splash decals (under everything)
      for (const s of this.splashes) {
        const a = CM.clamp(1 - s.t / s.life, 0, 1);
        const r = s.r * (0.6 + (s.t / s.life) * 0.6);
        g.globalAlpha = a * 0.5;
        D.ellipse(g, s.x, s.y, r, r * 0.4, 'rgba(140,205,246,0.8)');
        g.globalAlpha = a * 0.7;
        D.ellipse(g, s.x, s.y, r * 0.6, r * 0.24, null, '#bfe7ff', 2);
        g.globalAlpha = 1;
      }

      // targets (far first by y)
      const ts = this.targets.slice().sort((a, b) => a.y - b.y);
      for (const t of ts) this.drawTarget(g, t);

      // balloon in flight
      if (this.state === 'throw' && this.b.active) this.drawBalloon(g, this.b.x, this.b.y);

      // player (the kid) — lobbing from the lower left, facing right
      this.drawThrower(g);

      // Badtz-Maru cheering on the left
      const excited = this.hostHappy > 0 || this.state === 'done';
      CM.drawFriend(g, 'badtzmaru', BADTZ.x, BADTZ.y, 1.1, {
        bob: excited ? (CM.time * 2.4) % 1 : ((CM.time * 0.8) % 1) * 0.4
      });

      this.drawParts(g);
      g.restore(); // end shake

      /* ---- HUD (not shaken) ---- */
      // balloon count + score, top-left
      D.rr(g, 14, 12, 196, 62, 14, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      this.drawBalloonIcon(g, 34, 34, 9);
      D.text(g, 'Balloon ' + Math.min(this.tossIdx + 1, TOSSES) + '/' + TOSSES, 124, 30,
        { size: 17, color: P.pinkDeep, weight: 800 });
      D.coin(g, 36, 56, 9);
      D.text(g, 'Score ' + this.score, 124, 56, { size: 17, color: '#c98a1f', weight: 800 });

      // angle gauge / power meter
      if (this.state === 'angle') this.drawAngleGauge(g);
      if (this.state === 'power') this.drawMeter(g);

      // host reaction bubble on good plays
      if ((this.state === 'result' || this.state === 'done') && this.hostBubble.t > 0) {
        const txt = this.hostBubble.text;
        const cw = Math.max(96, txt.length * 9 + 26);
        const bx = CM.clamp(BADTZ.x - 16, 8, CM.W - cw - 8);
        D.bubble(g, bx, BADTZ.y - 170, cw, 40, BADTZ.x + 10);
        D.text(g, txt, bx + cw / 2, BADTZ.y - 150, { size: 15, weight: 800, color: P.pinkDeep });
      }

      // big banner for bonus hits
      if (this.state === 'result' && this.bigMsg) {
        const el = this.resultDur - this.resultT;
        const sc = Math.min(1, el * 4);
        D.text(g, this.bigMsg, 480, 250, {
          size: 26 + 40 * sc, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
        });
        D.star(g, 322, 250, 18, P.yellowDeep, CM.time * 2.5);
        D.star(g, 638, 250, 18, P.yellowDeep, -CM.time * 2.5);
      } else if (this.state === 'result' && this.msg) {
        D.text(g, this.msg, 480, 250, {
          size: 30, color: this.scored ? P.pinkDeep : P.blueDeep, weight: 800,
          stroke: '#fff', strokeWidth: 8
        });
      }

      // hint bar
      let hint = '';
      if (this.state === 'angle') hint = CM.touchMode ? 'Tap to lock your ANGLE!' : 'Click or SPACE to lock your ANGLE!';
      else if (this.state === 'power') hint = 'Stop the meter — more power throws farther!';
      if (hint) {
        D.rr(g, 250, 574, 460, 24, 12, 'rgba(255,255,255,0.78)');
        D.text(g, hint, 480, 586, { size: 14, color: P.pinkDeep, weight: 800 });
      }

      if (this.state === 'howto') this.drawHowto(g);
      if (this.state === 'done') {
        D.text(g, 'Great game!! 🎉', 480, 232, {
          size: 50, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
        });
        D.text(g, 'Score: ' + this.score, 480, 288, { size: 28, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6 });
        D.star(g, 280, 220 + Math.sin(CM.time * 5) * 6, 16, P.yellowDeep);
        D.star(g, 680, 220 + Math.cos(CM.time * 5) * 6, 16, P.yellowDeep);
      }
    },

    /* ---- scene art ---- */
    drawBackyard(g) {
      // sky band
      const sg = g.createLinearGradient(0, 0, 0, 300);
      sg.addColorStop(0, '#bfe7ff');
      sg.addColorStop(1, '#e6f6ff');
      g.fillStyle = sg;
      g.fillRect(0, 0, CM.W, 300);
      // sun
      D.circle(g, 858, 70, 34, '#fff3b0');
      g.globalAlpha = 0.5;
      D.circle(g, 858, 70, 46, '#fff7cf');
      g.globalAlpha = 1;
      // fluffy clouds
      for (const c of this.clouds) this.drawCloud(g, c.x, c.y, c.s);

      // grass field
      const gg = g.createLinearGradient(0, 280, 0, CM.H);
      gg.addColorStop(0, '#bdeccd');
      gg.addColorStop(1, '#9fe0b6');
      g.fillStyle = gg;
      g.fillRect(0, 300, CM.W, CM.H - 300);
      // a softer line where grass meets sky
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect(0, 298, CM.W, 5);
      // gentle grass tufts
      g.strokeStyle = 'rgba(103,197,135,0.55)';
      g.lineWidth = 2.5;
      g.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const x = ((i * 137 + 30) % 940) + 10;
        const y = 330 + ((i * 71) % 240);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x - 4, y - 9);
        g.moveTo(x, y);
        g.lineTo(x + 4, y - 9);
        g.stroke();
      }

      // wooden fence behind the targets
      this.drawFence(g);

      // a couple of cheerful flowers near the player
      this.drawFlower(g, 70, 500, '#ff9ec7');
      this.drawFlower(g, 250, 540, '#ffe9a8');
      this.drawFlower(g, 900, 500, '#d8c9f2');
    },

    drawCloud(g, x, y, s) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      D.circle(g, -26, 4, 18);
      D.circle(g, 0, -6, 24);
      D.circle(g, 26, 4, 18);
      D.rr(g, -40, 2, 80, 18, 9, 'rgba(255,255,255,0.95)');
      g.restore();
    },

    drawFence(g) {
      const railY = FENCE_Y + 8;
      // back rail
      D.rr(g, 360, railY, 580, 16, 4, '#e8c39a', '#caa172', 2);
      D.rr(g, 360, railY + 30, 580, 16, 4, '#e8c39a', '#caa172', 2);
      // pickets
      for (let x = 360; x < 940; x += 46) {
        D.rr(g, x, railY - 36, 30, 96, 5, '#f0d2ac', '#caa172', 2);
        // pointed top
        g.fillStyle = '#f0d2ac';
        g.beginPath();
        g.moveTo(x, railY - 36);
        g.lineTo(x + 15, railY - 52);
        g.lineTo(x + 30, railY - 36);
        g.closePath();
        g.fill();
        g.strokeStyle = '#caa172';
        g.lineWidth = 2;
        g.stroke();
      }
      // re-draw rails over pickets so they read as a fence
      D.rr(g, 360, railY, 580, 14, 4, '#eccba0', '#caa172', 2);
      D.rr(g, 360, railY + 30, 580, 14, 4, '#eccba0', '#caa172', 2);
    },

    drawFlower(g, x, y, col) {
      D.shadow(g, x, y, 12);
      g.strokeStyle = '#67c587';
      g.lineWidth = 3;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y - 22);
      g.stroke();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        D.circle(g, x + Math.cos(a) * 7, y - 26 + Math.sin(a) * 7, 5, col);
      }
      D.circle(g, x, y - 26, 4, '#ffe9a8');
    },

    /* ---- targets ---- */
    drawTarget(g, t) {
      const alpha = t.alive ? 1 : Math.max(0, 1 - t.fall * 1.15);
      if (alpha <= 0) return;
      const wob = t.alive ? Math.sin(CM.time * 2 + t.wob) * 0.04 : 0;
      g.save();
      g.translate(t.x, t.y);
      g.globalAlpha = alpha;
      if (!t.alive) {
        // knocked over / dunked
        g.rotate((t.kind === 'dunk' ? 1 : -1) * t.fall * 1.4);
        g.translate(0, t.fall * 18);
      } else {
        g.rotate(wob);
      }

      if (t.kind === 'can') {
        D.shadow(g, 0, t.r + 4, t.r * 0.8);
        // tin can with a cute face
        D.rr(g, -t.r * 0.7, -t.r, t.r * 1.4, t.r * 2, 7, '#cfd9e2', '#9fb0bd', 2.5);
        D.ellipse(g, 0, -t.r, t.r * 0.7, t.r * 0.22, '#e7eef4', '#9fb0bd', 2);
        // pink label stripe
        D.rr(g, -t.r * 0.7, -t.r * 0.35, t.r * 1.4, t.r * 0.7, 3, P.pink);
        this.cuteFace(g, 0, -t.r * 0.02, t.r * 0.32);
      } else if (t.kind === 'tub') {
        D.shadow(g, 0, t.r * 0.6 + 4, t.r * 0.9);
        // wide bucket target
        g.fillStyle = '#a8d8f8';
        g.beginPath();
        g.moveTo(-t.r, -t.r * 0.55);
        g.lineTo(t.r, -t.r * 0.55);
        g.lineTo(t.r * 0.8, t.r * 0.6);
        g.lineTo(-t.r * 0.8, t.r * 0.6);
        g.closePath();
        g.fill();
        g.strokeStyle = '#6aaede'; g.lineWidth = 2.5; g.stroke();
        D.ellipse(g, 0, -t.r * 0.55, t.r, t.r * 0.26, '#cdeaff', '#6aaede', 2.5);
        this.cuteFace(g, 0, -t.r * 0.05, t.r * 0.3);
      } else if (t.kind === 'ring') {
        // floating ring target (bonus) — concentric rings
        D.circle(g, 0, 0, t.r, null, P.pinkDeep, 6);
        D.circle(g, 0, 0, t.r * 0.68, null, '#fff', 5);
        D.circle(g, 0, 0, t.r * 0.36, P.yellowDeep);
        D.star(g, 0, 0, t.r * 0.22, '#fff');
        // little dangling string up to nothing (floaty)
      } else if (t.kind === 'dunk') {
        D.shadow(g, 0, t.r + 14, t.r);
        // dunk-tank: water tub + a seat with Cinnamoroll-ish blob sitting
        D.rr(g, -t.r * 1.1, t.r * 0.2, t.r * 2.2, t.r * 1.1, 8, '#a8d8f8', '#6aaede', 2.5);
        D.ellipse(g, 0, t.r * 0.2, t.r * 1.1, t.r * 0.3, '#cdeaff', '#6aaede', 2);
        // seat post
        D.rr(g, -3, -t.r * 0.2, 6, t.r * 0.5, 2, '#caa172');
        D.rr(g, -t.r * 0.5, -t.r * 0.3, t.r, 8, 3, '#caa172', '#a07a4f', 1.5);
        // a smiley plush sitting on the seat (the dunk buddy)
        D.circle(g, 0, -t.r * 0.7, t.r * 0.5, '#fff', '#dfe9f5', 2);
        this.cuteFace(g, 0, -t.r * 0.7, t.r * 0.28);
        // target ring on the side to aim at
        D.circle(g, t.r * 0.75, -t.r * 0.3, t.r * 0.28, P.red, '#fff', 3);
        D.circle(g, t.r * 0.75, -t.r * 0.3, t.r * 0.13, '#fff');
      }

      // value tag
      if (t.alive) {
        g.globalAlpha = 1;
        D.text(g, t.value + '', 0, -t.r - 14, { size: 14, color: '#fff', weight: 800, stroke: P.pinkDeep, strokeWidth: 4 });
      }
      g.restore();
      g.globalAlpha = 1;
    },

    cuteFace(g, x, y, r) {
      g.fillStyle = '#4a3b46';
      g.beginPath(); g.ellipse(x - r * 0.7, y, r * 0.22, r * 0.3, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x + r * 0.7, y, r * 0.22, r * 0.3, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#4a3b46'; g.lineWidth = Math.max(1, r * 0.18); g.lineCap = 'round';
      g.beginPath(); g.arc(x, y + r * 0.2, r * 0.45, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      g.fillStyle = 'rgba(255,140,160,0.5)';
      g.beginPath(); g.ellipse(x - r * 1.15, y + r * 0.2, r * 0.3, r * 0.2, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(x + r * 1.15, y + r * 0.2, r * 0.3, r * 0.2, 0, 0, Math.PI * 2); g.fill();
    },

    /* ---- balloon ---- */
    drawBalloon(g, x, y) {
      D.shadow(g, x, GROUND_Y, 14);
      g.save();
      g.translate(x, y);
      // wobble in the direction of travel
      const ang = Math.atan2(this.b.vy, this.b.vx) * 0.15;
      g.rotate(ang);
      const r = 13;
      g.fillStyle = P.pink;
      g.beginPath();
      g.ellipse(0, 0, r, r * 1.12, 0, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#e87fb2'; g.lineWidth = 2; g.stroke();
      // knot
      g.fillStyle = '#e87fb2';
      g.beginPath();
      g.moveTo(-3, r * 1.05); g.lineTo(3, r * 1.05); g.lineTo(0, r * 1.3); g.closePath();
      g.fill();
      // highlight
      D.circle(g, -r * 0.35, -r * 0.4, r * 0.3, 'rgba(255,255,255,0.7)');
      g.restore();
    },

    drawBalloonIcon(g, x, y, r) {
      g.save();
      g.translate(x, y);
      g.fillStyle = P.pink;
      g.beginPath(); g.ellipse(0, 0, r, r * 1.12, 0, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#e87fb2'; g.lineWidth = 1.5; g.stroke();
      D.circle(g, -r * 0.35, -r * 0.4, r * 0.3, 'rgba(255,255,255,0.7)');
      g.restore();
    },

    /* ---- the player throwing ---- */
    drawThrower(g) {
      // a little arm wind-up: when armPhase>0 the kid hops slightly
      const hop = this.armPhase > 0 ? Math.sin(this.armPhase * Math.PI) * 4 : 0;
      CM.drawPlayer(g, THROW.x - 14, GROUND_Y + 6 - hop, 1.08, 'right', 0);
      // a held balloon in hand during aim/power
      if (this.state === 'angle' || this.state === 'power') {
        const bx = THROW.x - 2 + Math.cos(this.angle) * 6;
        const by = THROW.y - 6 - (this.state === 'power' ? this.power * 4 : 0);
        this.drawBalloon(g, bx, by);
      }
    },

    /* ---- angle gauge (drawn at the launch point) ---- */
    drawAngleGauge(g) {
      const ox = THROW.x, oy = THROW.y;
      const len = 120;
      const ex = ox + Math.cos(this.angle) * len;
      const ey = oy - Math.sin(this.angle) * len;
      // arc guide between min and max
      g.save();
      g.strokeStyle = 'rgba(240,98,146,0.25)';
      g.lineWidth = 3;
      g.beginPath();
      g.arc(ox, oy, len, -ANG_MAX, -ANG_MIN);
      g.stroke();
      // the sweeping arrow
      g.strokeStyle = P.pinkDeep;
      g.lineWidth = 6;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(ox, oy);
      g.lineTo(ex, ey);
      g.stroke();
      // arrowhead
      const a = this.angle;
      g.fillStyle = P.pinkDeep;
      g.beginPath();
      g.translate(ex, ey);
      g.rotate(-a);
      g.moveTo(0, 0); g.lineTo(-14, -7); g.lineTo(-14, 7); g.closePath();
      g.fill();
      g.restore();
      // faint predicted arc preview (forgiving helper, at mid power)
      this.drawArcPreview(g, this.angle, 0.62, 'rgba(255,255,255,0.5)');
    },

    drawArcPreview(g, angle, power, color) {
      const spd = CM.lerp(SPD_MIN, SPD_MAX, power);
      let x = THROW.x, y = THROW.y;
      let vx = Math.cos(angle) * spd, vy = -Math.sin(angle) * spd;
      g.save();
      g.fillStyle = color;
      const step = 0.026;
      for (let i = 0; i < 26; i++) {
        vy += GRAVITY * step;
        x += vx * step;
        y += vy * step;
        if (y > GROUND_Y || x > CM.W) break;
        if (i % 2 === 0) D.circle(g, x, y, 3, color);
      }
      g.restore();
    },

    drawMeter(g) {
      const M = METER;
      D.rr(g, M.x - 8, M.y - 36, M.w + 16, M.h + 60, 14, 'rgba(255,255,255,0.88)', '#f0b9d2', 2);
      D.text(g, 'POWER', M.x + M.w / 2, M.y - 18, { size: 14, color: P.pinkDeep, weight: 800 });
      D.rr(g, M.x, M.y, M.w, M.h, 10, '#eaf7ff', '#9ed0f0', 2);
      // strong zone near the top
      D.rr(g, M.x + 2, M.y + 2, M.w - 4, M.h * 0.3, 8, 'rgba(142,205,246,0.55)');
      D.star(g, M.x + M.w / 2, M.y + M.h * 0.15, 9, P.blueDeep);
      const fh = Math.max(5, M.h * this.power);
      D.rr(g, M.x + 3, M.y + M.h - fh, M.w - 6, fh, 8, this.power >= 0.7 ? P.blueDeep : P.pink);
      // a faint arc preview at the live power so kids can read the throw
      this.drawArcPreview(g, this.angle, this.power, 'rgba(74,159,220,0.45)');
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(70,40,70,0.3)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 210, 100, 540, 388, { title: '💦 Water Balloon Toss 💦' });
      CM.drawFriend(g, 'badtzmaru', 300, 440, 1.25, { bob: ((CM.time * 1.1) % 1) * 0.5 });
      D.text(g, 'Badtz-Maru', 300, 462, { size: 14, color: P.pinkDeep, weight: 800 });
      D.text(g, '1. Tap to lock your ANGLE', 560, 178, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '(the arrow swings up & down)', 560, 202, { size: 14, color: '#9a8a94' });
      D.text(g, '2. Tap again to lock POWER', 560, 244, { size: 17, color: P.ink, weight: 700 });
      D.text(g, 'and lob the balloon!', 560, 268, { size: 14, color: '#9a8a94' });
      D.text(g, '3. Splash the targets for points!', 560, 310, { size: 17, color: P.ink, weight: 700 });
      D.text(g, 'Rings & dunk seat = BIG bonus!', 560, 338, { size: 15, color: P.pinkDeep, weight: 800 });
      D.text(g, '12 balloons · just have fun!', 480, 372, { size: 14, color: '#9a8a94' });
      if (CM.ui.button(g, 380, 398, 200, 56, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.startAngle();
      }
    },

    drawParts(g) {
      for (const pt of this.parts) {
        g.globalAlpha = CM.clamp(pt.life / pt.maxLife, 0, 1);
        if (pt.type === 'star') D.star(g, pt.x, pt.y, pt.size, pt.color, pt.rot);
        else if (pt.type === 'heart') D.heart(g, pt.x, pt.y, pt.size, pt.color);
        else if (pt.type === 'txt') {
          D.text(g, pt.str, pt.x, pt.y, { size: pt.size, color: pt.color, weight: 800, stroke: '#fff', strokeWidth: 5 });
        } else {
          // water drop
          D.circle(g, pt.x, pt.y, pt.size, pt.color);
        }
      }
      g.globalAlpha = 1;
    }
  });
})();
