/* Cinnamoroll Mansion — Penalty Kicks (hosted by Pochacco) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---- goal geometry ----
     The goal mouth spans the upper-middle of the field. Aim is a horizontal
     marker that sweeps across the mouth; it lands in one of three thirds
     (0 = left, 1 = center, 2 = right). The goalie dives to a random third.
     The ball launches from the penalty spot and arcs up to the aimed spot. */
  const GOAL = { x: 232, y: 138, w: 496, h: 150 }; // mouth (inside the posts)
  const POST = 12;                                  // post thickness
  const SPOT = { x: 480, y: 512 };                  // penalty / kick spot
  const KEEPER_Y = GOAL.y + GOAL.h - 8;             // goalie feet on the goal line
  const POCHA = { x: 858, y: 470 };                 // host cheering on the right
  const AIM_Y = GOAL.y + GOAL.h + 26;               // sweeping aim marker line
  const METER = { x: 884, y: 150, w: 32, h: 320 };  // power meter (right side)
  const TOTAL_KICKS = 8;
  const MAX_PARTS = 110;

  // third boundaries inside the goal mouth (left/center/right)
  function thirdOf(x) {
    const rel = (x - GOAL.x) / GOAL.w; // 0..1
    return rel < 0.34 ? 0 : rel < 0.66 ? 1 : 2;
  }
  function thirdCenterX(third) {
    return GOAL.x + GOAL.w * (third === 0 ? 0.18 : third === 1 ? 0.5 : 0.82);
  }

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'soccer',
    name: 'Penalty Kicks',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';      // howto -> aim -> power -> kicking -> result -> (next aim / done)
      this.score = 0;
      this.goals = 0;
      this.kick = 0;             // kicks taken so far (0..8)
      this.finished = false;

      // aim sweep
      this.aimT = 0;
      this.aimX = GOAL.x + GOAL.w / 2;
      this.aimThird = 1;

      // power oscillator
      this.powerT = 0;
      this.power = 0;

      // the ball
      this.ball = this.freshBall();

      // goalie
      this.keeper = { x: GOAL.x + GOAL.w / 2, baseX: GOAL.x + GOAL.w / 2, dive: 1, t: 0, anim: 0, caught: false };

      // feedback
      this.parts = [];
      this.shk = { t: 0, dur: 1, mag: 0 };
      this.msg = '';
      this.bigMsg = '';
      this.bigCol = P.pinkDeep;
      this.resultT = 0;
      this.resultDur = 1;
      this.netBulge = 0;         // 0..1 net wobble after a goal
      this.bulgeX = 0;
      this.hostBubble = { text: '', t: 0 };
      this.hostHappy = 0;
      this.runup = 0;            // player run-up phase 0..1 during a kick
      this.doneT = 0;
    },

    exit() {},

    /* ================= setup helpers ================= */
    freshBall() {
      return {
        x: SPOT.x, y: SPOT.y, z: 0,         // z = visual lift (drawn as -y offset + scale)
        sx: SPOT.x, sy: SPOT.y,             // launch start
        tx: SPOT.x, ty: SPOT.y,             // launch target (in goal)
        t: 0, dur: 0.7, flying: false,
        peak: 70, scale: 1, spin: 0,
        saved: false, settled: false
      };
    },

    beginKick() {
      this.state = 'aim';
      this.aimT = 0;
      this.power = 0;
      this.powerT = 0;
      this.ball = this.freshBall();
      this.keeper.caught = false;
      this.keeper.x = this.keeper.baseX;
      this.keeper.anim = 0;
      this.netBulge = 0;
      this.runup = 0;
      this.msg = '';
      this.bigMsg = '';
    },

    lockAim() {
      CM.audio.play('pop');
      this.aimThird = thirdOf(this.aimX);
      this.state = 'power';
      this.powerT = 0;
      this.power = 0;
    },

    fireKick() {
      CM.audio.play('click');
      // goalie commits to a RANDOM third (chosen now, revealed as the ball flies)
      this.keeper.dive = CM.randInt(0, 2);
      this.keeper.t = 0;
      this.keeper.anim = 0;
      this.keeper.caught = false;

      const b = this.ball;
      b.sx = SPOT.x; b.sy = SPOT.y;
      b.tx = thirdCenterX(this.aimThird) + CM.rand(-18, 18);
      // higher power = ball aimed higher in the goal (harder to save), bigger arc
      b.ty = CM.lerp(GOAL.y + GOAL.h - 18, GOAL.y + 30, this.power);
      b.peak = CM.lerp(46, 120, this.power);
      b.dur = CM.lerp(0.92, 0.66, this.power);
      b.t = 0;
      b.flying = true;
      b.settled = false;
      b.saved = false;
      b.spin = 0;

      this.state = 'kicking';
      this.runup = 0;
      CM.audio.play('whoosh');
    },

    resolveShot() {
      // decide goal vs save the instant the ball reaches the goal line
      const b = this.ball;
      const match = this.aimThird === this.keeper.dive;
      // very low power = scuffed shot that never really threatens -> miss (no goal)
      const scuffed = this.power < 0.16;
      // generous: a matching dive is still beaten by a strong, high shot
      const beatKeeper = !match || (this.power >= 0.6 && Math.random() < 0.66);

      if (scuffed) {
        // ball trickles, keeper scoops it
        b.saved = true;
        this.keeper.caught = true;
        this.onSave('Aw, scuffed it!');
      } else if (beatKeeper) {
        this.onGoal();
      } else {
        b.saved = true;
        this.keeper.caught = true;
        this.onSave('So close!');
      }
    },

    onGoal() {
      this.goals++;
      this.score += 50;
      this.netBulge = 1;
      this.bulgeX = this.ball.tx;
      this.msg = 'GOAL!! Woohoo!!';
      this.bigMsg = 'GOAL!!';
      this.bigCol = P.pinkDeep;
      CM.audio.play(this.power >= 0.7 ? 'tada' : 'cheer');
      CM.audio.play('ding');
      this.doShake(0.42, 7);
      this.celebrate(this.power >= 0.7 ? 30 : 22);
      this.say(CM.pick(['GOOOAL!', 'Amazing!', 'Wow!!', 'Nice shot!']), 1.8);
      this.hostHappy = 1.4;
    },

    onSave(line) {
      this.msg = line;
      this.bigMsg = 'Saved!';
      this.bigCol = P.blueDeep;
      CM.audio.play('miss');
      this.say('So close!', 1.6);
      this.burst(this.ball.tx, this.ball.ty + 4, 6, '#cfe6ff');
    },

    say(text, t) {
      this.hostBubble = { text: text, t: t };
    },

    /* ================= update ================= */
    update(dt) {
      if (this.shk.t > 0) this.shk.t -= dt;
      if (this.hostBubble.t > 0) this.hostBubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      if (this.netBulge > 0) this.netBulge = Math.max(0, this.netBulge - dt * 1.6);
      this.updateParts(dt);
      // idle keeper sway between kicks
      if (this.state !== 'kicking' && this.state !== 'result') {
        this.keeper.x = this.keeper.baseX + Math.sin(CM.time * 1.6) * 10;
      }

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.beginKick();
          break;

        case 'aim':
          this.aimT += dt;
          this.aimX = GOAL.x + GOAL.w / 2 + Math.sin(this.aimT * 2.6) * (GOAL.w / 2 - 26);
          if (anyPress()) this.lockAim();
          break;

        case 'power':
          this.powerT += dt;
          this.power = (1 - Math.cos(this.powerT * 3.4)) / 2; // 0 -> 1 -> 0 ...
          if (anyPress()) this.fireKick();
          break;

        case 'kicking':
          this.updateKicking(dt);
          break;

        case 'result':
          this.resultT -= dt;
          if (this.resultDur - this.resultT > 0.5 && anyPress()) this.resultT = 0; // tap to skip
          if (this.resultT <= 0) this.afterKick();
          break;

        case 'done':
          this.doneT -= dt;
          if (this.parts.length < 70 && Math.random() < 0.3) {
            this.spawnPart({
              x: CM.rand(260, 700), y: CM.rand(150, 320),
              vx: CM.rand(-40, 40), vy: CM.rand(-80, -20),
              life: CM.rand(0.6, 1.1), type: Math.random() < 0.5 ? 'star' : 'heart',
              color: CM.pick([P.pink, P.yellowDeep, P.mintDeep, P.lavenderDeep]),
              size: CM.rand(7, 12), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
            });
          }
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('soccer', this.score, CM.clamp(Math.ceil(this.score / 16), 5, 30));
          }
          break;
      }
    },

    updateKicking(dt) {
      const b = this.ball;
      // run-up before the ball launches a touch (purely visual)
      this.runup = Math.min(1, this.runup + dt * 2.4);

      // goalie dive animation
      this.keeper.t += dt;
      this.keeper.anim = Math.min(1, this.keeper.t / 0.34);
      const dx = thirdCenterX(this.keeper.dive) - this.keeper.baseX;
      this.keeper.x = this.keeper.baseX + dx * this.ease(this.keeper.anim);

      if (b.flying) {
        b.t += dt;
        const u = CM.clamp(b.t / b.dur, 0, 1);
        b.x = CM.lerp(b.sx, b.tx, u);
        b.y = CM.lerp(b.sy, b.ty, u);
        b.z = Math.sin(u * Math.PI) * b.peak;     // arc lift
        b.scale = CM.lerp(1, 0.62, u);            // shrink as it flies away
        b.spin += dt * 14;

        // resolve outcome right as it crosses the line
        if (u >= 1) {
          b.flying = false;
          this.resolveShot();
          this.state = 'result';
          this.resultDur = b.saved ? 1.4 : 1.8;
          this.resultT = this.resultDur;
          if (b.saved) {
            // tuck ball into the keeper's hands
            b.x = this.keeper.x;
            b.y = KEEPER_Y - 36;
            b.z = 0;
          }
        }
      }
    },

    ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; },

    afterKick() {
      this.kick++;
      if (this.kick >= TOTAL_KICKS) {
        this.state = 'done';
        this.doneT = 2.0;
        this.shk = { t: 0.4, dur: 0.4, mag: 6 };
        CM.audio.play('coin');
        this.say('Great game!', 3);
      } else {
        this.beginKick();
      }
    },

    /* ================= juice ================= */
    doShake(t, mag) { this.shk = { t: t, dur: t, mag: mag }; },

    spawnPart(pt) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      pt.maxLife = pt.life;
      this.parts.push(pt);
    },

    burst(x, y, n, color) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.spawnPart({
          x: x, y: y,
          vx: Math.cos(a) * CM.rand(60, 150), vy: Math.sin(a) * CM.rand(60, 150) - 30,
          life: CM.rand(0.4, 0.7), type: 'spark',
          color: color || '#fff', size: CM.rand(3, 5), rot: 0, vr: 0
        });
      }
    },

    celebrate(n) {
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: CM.rand(300, 660), y: CM.rand(150, 320),
          vx: CM.rand(-100, 100), vy: CM.rand(-200, -50),
          life: CM.rand(0.6, 1.25),
          type: Math.random() < 0.55 ? 'star' : 'heart',
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
      g.save();
      if (this.shk.t > 0) {
        const m = this.shk.mag * (this.shk.t / this.shk.dur);
        g.translate(CM.rand(-m, m), CM.rand(-m, m));
      }

      this.drawBackdrop(g);
      this.drawGoal(g);

      // aim guide / marker
      if (this.state === 'aim' || this.state === 'power') this.drawAim(g);

      // goalie inside the goal
      this.drawKeeper(g);

      // the player (kid) running up & kicking from the bottom
      this.drawKicker(g);

      // the ball (drawn after kicker so it sits in front while flying up)
      if (this.state === 'aim' || this.state === 'power' ||
          this.state === 'kicking' || this.state === 'result') {
        this.drawBall(g);
      }

      // Pochacco cheering on the side
      const excited = this.hostHappy > 0 || this.state === 'done';
      CM.drawFriend(g, 'pochacco', POCHA.x, POCHA.y, 1.08, {
        bob: excited ? (CM.time * 2.4) % 1 : ((CM.time * 0.9) % 1) * 0.4,
        flip: true
      });
      // host thumbs-up sparkle on goals
      if (this.hostHappy > 0) {
        const lift = Math.abs(Math.sin(((CM.time * 2.4) % 1) * Math.PI * 2)) * 5;
        D.star(g, POCHA.x - 24, POCHA.y - 74 - lift, 7, P.yellowDeep);
      }

      this.drawParts(g);
      g.restore(); // end shake

      /* ---- HUD (not shaken) ---- */
      this.drawHud(g);

      // power meter while charging
      if (this.state === 'power') this.drawMeter(g);

      // host bubble
      if (this.hostBubble.t > 0 && this.state !== 'howto') {
        const txt = this.hostBubble.text;
        const cw = Math.max(96, txt.length * 10 + 26);
        const bx = CM.clamp(POCHA.x - cw + 30, 8, CM.W - cw - 8);
        D.bubble(g, bx, POCHA.y - 168, cw, 40, POCHA.x - 14);
        D.text(g, txt, bx + cw / 2, POCHA.y - 148, { size: 15, weight: 800, color: P.pinkDeep });
      }

      // big banner on result
      if (this.state === 'result' && this.bigMsg) {
        const el = this.resultDur - this.resultT;
        const sc = Math.min(1, el * 4);
        D.text(g, this.bigMsg, 480, 350, {
          size: 30 + 46 * sc, color: this.bigCol, weight: 800, stroke: '#fff', strokeWidth: 10
        });
        if (this.bigMsg === 'GOAL!!') {
          D.star(g, 320, 350, 20, P.yellowDeep, CM.time * 2.5);
          D.star(g, 640, 350, 20, P.yellowDeep, -CM.time * 2.5);
        }
      }

      // hint bar
      let hint = '';
      if (this.state === 'aim') hint = CM.touchMode ? 'Tap to aim where to shoot!' : 'Click or SPACE to lock your aim!';
      else if (this.state === 'power') hint = 'Stop the meter — higher = harder to save!';
      if (hint) {
        D.rr(g, 250, 574, 460, 24, 12, 'rgba(255,255,255,0.78)');
        D.text(g, hint, 480, 586, { size: 14, color: P.pinkDeep, weight: 800 });
      }

      if (this.state === 'howto') this.drawHowto(g);
      if (this.state === 'done') {
        g.fillStyle = 'rgba(255,255,255,0.32)';
        g.fillRect(0, 0, CM.W, CM.H);
        D.text(g, 'Full time!! 🎉', 480, 250, { size: 50, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10 });
        D.text(g, this.goals + ' goal' + (this.goals === 1 ? '' : 's') + ' · ' + this.score + ' points!',
          480, 312, { size: 26, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6 });
      }
    },

    drawBackdrop(g) {
      // sky band
      const sky = g.createLinearGradient(0, 0, 0, 300);
      sky.addColorStop(0, '#bfe7ff');
      sky.addColorStop(1, '#e3f5ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, CM.W, 320);

      // sun
      D.circle(g, 92, 78, 30, '#fff3b0');
      D.circle(g, 92, 78, 22, '#ffe07a');

      // fluffy clouds
      this.cloud(g, 250, 70, 1.1);
      this.cloud(g, 690, 56, 0.85);
      this.cloud(g, 540, 104, 0.7);

      // grass field
      const grass = g.createLinearGradient(0, 300, 0, CM.H);
      grass.addColorStop(0, '#a7e08a');
      grass.addColorStop(1, '#7fce6a');
      g.fillStyle = grass;
      g.fillRect(0, 300, CM.W, CM.H - 300);
      // mowed stripes
      g.fillStyle = 'rgba(255,255,255,0.07)';
      for (let i = 0; i < 7; i++) g.fillRect(0, 320 + i * 42, CM.W, 21);

      // wooden fence behind the goal
      this.fence(g);

      // penalty arc + spot
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 4;
      g.beginPath();
      g.ellipse(SPOT.x, SPOT.y - 10, 150, 40, 0, Math.PI * 1.08, Math.PI * 1.92);
      g.stroke();
      D.circle(g, SPOT.x, SPOT.y - 6, 5, 'rgba(255,255,255,0.9)');

      // little flowers dotting the grass
      this.flower(g, 120, 470, '#ff9ec7');
      this.flower(g, 70, 540, '#ffe07a');
      this.flower(g, 900, 360, '#fff');
      this.flower(g, 836, 560, '#ff9ec7');
    },

    cloud(g, x, y, s) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      D.ellipse(g, -26, 6, 26, 18, 'rgba(255,255,255,0.95)');
      D.ellipse(g, 6, 0, 30, 22, 'rgba(255,255,255,0.95)');
      D.ellipse(g, 34, 8, 22, 16, 'rgba(255,255,255,0.95)');
      g.restore();
    },

    fence(g) {
      const fy = 250, fh = 56;
      g.fillStyle = '#e8c39a';
      g.fillRect(0, fy + 18, CM.W, 10);          // top rail
      g.fillStyle = '#dcb184';
      g.fillRect(0, fy + 40, CM.W, 8);           // bottom rail
      for (let x = 6; x < CM.W; x += 46) {
        D.rr(g, x, fy, 30, fh, 6, '#f0cf9f', '#d3a877', 2);
        // pointed top
        g.fillStyle = '#f0cf9f';
        g.beginPath();
        g.moveTo(x, fy); g.lineTo(x + 15, fy - 11); g.lineTo(x + 30, fy);
        g.closePath(); g.fill();
        g.strokeStyle = '#d3a877'; g.lineWidth = 2; g.stroke();
      }
    },

    flower(g, x, y, col) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        D.circle(g, x + Math.cos(a) * 5, y + Math.sin(a) * 5, 3.4, col);
      }
      D.circle(g, x, y, 2.6, '#f6d44d');
      // tiny stem
      g.strokeStyle = '#5aa84e'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y + 4); g.lineTo(x, y + 14); g.stroke();
    },

    drawGoal(g) {
      const x = GOAL.x, y = GOAL.y, w = GOAL.w, h = GOAL.h;

      // net (behind the posts) — wavy mesh, bulges out on a goal
      g.save();
      D.rrPath(g, x, y, w, h, 6);
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fillRect(x, y, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 1.4;
      const bulge = this.netBulge;
      // vertical strands
      for (let gx = x + 14; gx < x + w; gx += 18) {
        const push = bulge > 0 ? Math.max(0, 1 - Math.abs(gx - this.bulgeX) / 70) * bulge * 22 : 0;
        g.beginPath();
        g.moveTo(gx, y);
        g.quadraticCurveTo(gx + push, y + h / 2, gx, y + h);
        g.stroke();
      }
      // horizontal strands
      for (let gy = y + 12; gy < y + h; gy += 16) {
        const push = bulge > 0 ? Math.max(0, 1 - Math.abs(gy - (y + h * 0.55)) / 60) * bulge * 14 : 0;
        g.beginPath();
        g.moveTo(x, gy);
        g.quadraticCurveTo(x + w / 2, gy + push, x + w, gy);
        g.stroke();
      }
      g.restore();

      // faint third dividers (subtle aim guides)
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 2;
      g.setLineDash([6, 8]);
      for (const f of [0.34, 0.66]) {
        g.beginPath();
        g.moveTo(x + w * f, y + 6); g.lineTo(x + w * f, y + h - 6);
        g.stroke();
      }
      g.setLineDash([]);

      // posts + crossbar
      g.fillStyle = '#ffffff';
      g.strokeStyle = '#e6e0e8';
      g.lineWidth = 2;
      D.rr(g, x - POST, y - POST, POST, h + POST, 4, '#ffffff', '#e6e0e8', 2);     // left post
      D.rr(g, x + w, y - POST, POST, h + POST, 4, '#ffffff', '#e6e0e8', 2);        // right post
      D.rr(g, x - POST, y - POST, w + POST * 2, POST, 4, '#ffffff', '#e6e0e8', 2); // crossbar
    },

    drawAim(g) {
      const x = this.state === 'aim' ? this.aimX : thirdCenterX(this.aimThird);
      const dim = this.state === 'power';
      // guide line from spot up into the goal
      g.save();
      g.strokeStyle = dim ? 'rgba(240,98,146,0.25)' : 'rgba(240,98,146,0.5)';
      g.lineWidth = 3;
      g.setLineDash([10, 12]);
      g.beginPath();
      g.moveTo(SPOT.x, SPOT.y - 10);
      g.lineTo(x, GOAL.y + GOAL.h - 16);
      g.stroke();
      g.restore();

      // highlight the targeted third
      const third = this.state === 'aim' ? thirdOf(this.aimX) : this.aimThird;
      g.fillStyle = dim ? 'rgba(255,233,168,0.18)' : 'rgba(255,233,168,0.3)';
      const tw = GOAL.w * 0.32;
      const tx = GOAL.x + GOAL.w * (third === 0 ? 0.02 : third === 1 ? 0.34 : 0.66);
      D.rr(g, tx, GOAL.y + 4, tw, GOAL.h - 8, 6, dim ? 'rgba(255,233,168,0.16)' : 'rgba(255,233,168,0.28)');

      // sweeping marker arrow on the aim line below the goal
      g.fillStyle = P.pinkDeep;
      g.beginPath();
      g.moveTo(x, AIM_Y - 16);
      g.lineTo(x - 13, AIM_Y);
      g.lineTo(x + 13, AIM_Y);
      g.closePath();
      g.fill();
      D.circle(g, x, AIM_Y + 4, 4, '#fff', P.pinkDeep, 2);
    },

    drawKeeper(g) {
      const k = this.keeper;
      const diving = (this.state === 'kicking' || this.state === 'result') && k.anim > 0.02;
      g.save();
      D.shadow(g, k.x, KEEPER_Y, 26);
      if (diving) {
        // lean toward dive direction (pivot about the feet on the goal line)
        const dir = k.dive === 0 ? -1 : k.dive === 2 ? 1 : 0;
        g.translate(k.x, KEEPER_Y);
        g.rotate(dir * 0.35 * k.anim);
        // center dive = little jump straight up
        if (dir === 0) g.translate(0, -10 * k.anim);
        g.translate(-k.x, -KEEPER_Y);
        CM.drawFriend(g, 'keroppi', k.x, KEEPER_Y, 1.12, { shadow: false });
        if (dir !== 0) {
          // outstretched glove reaching toward the dive
          D.circle(g, k.x + dir * 30, KEEPER_Y - 60, 7, '#fff', '#cfe6ff', 2);
        }
      } else {
        CM.drawFriend(g, 'keroppi', k.x, KEEPER_Y, 1.12, {
          shadow: false, bob: ((CM.time * 1.2) % 1) * 0.4
        });
      }
      g.restore();
      // goalie cap accent + "GK" sign feel: little gloves while idle
      if (!diving) {
        D.circle(g, k.x - 26, KEEPER_Y - 36, 5, '#fff', '#cfe6ff', 1.5);
        D.circle(g, k.x + 26, KEEPER_Y - 36, 5, '#fff', '#cfe6ff', 1.5);
      }
    },

    drawKicker(g) {
      // player run-up: slides up toward the spot during a kick, then plants
      let py = SPOT.y + 34;
      let phase = 0;
      if (this.state === 'kicking') {
        const r = Math.min(1, this.runup);
        py = SPOT.y + 34 - r * 6;
        phase = r < 0.8 ? (this.runup * 3) % 1 || 0.01 : 0;
      }
      CM.drawPlayer(g, SPOT.x + 2, py, 1.05, 'up', phase);
    },

    drawBall(g) {
      const b = this.ball;
      const cx = b.x;
      const cy = b.y - b.z;          // arc lift
      const r = 13 * b.scale;
      // ground shadow tracks the ground point, shrinking with height
      D.shadow(g, b.x, b.y, r * (1 - b.z / 260));
      // ball body
      D.circle(g, cx, cy, r, '#ffffff', '#d8d2dc', 2);
      // soccer pentagons (spin)
      g.save();
      g.translate(cx, cy);
      g.rotate(b.spin);
      g.fillStyle = '#4a3b46';
      const pr = r * 0.34;
      D.circle(g, 0, 0, pr, '#4a3b46');
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        const px = Math.cos(a) * r * 0.62;
        const py2 = Math.sin(a) * r * 0.62;
        D.circle(g, px, py2, pr * 0.62, '#4a3b46');
      }
      g.restore();
      D.circle(g, cx - r * 0.34, cy - r * 0.36, r * 0.24, 'rgba(255,255,255,0.7)');
    },

    drawHud(g) {
      // score + kick + goals panel (top-left, away from engine chrome)
      D.rr(g, 14, 12, 210, 66, 14, 'rgba(255,255,255,0.92)', '#f0b9d2', 2);
      D.text(g, 'Kick ' + Math.min(this.kick + (this.state === 'done' ? 0 : 1), TOTAL_KICKS) +
        '/' + TOTAL_KICKS, 24, 32, { size: 18, color: P.ink, weight: 800, align: 'left' });
      D.coin(g, 30, 58, 11);
      D.text(g, String(this.score), 48, 58, { size: 18, color: '#c98a1f', weight: 800, align: 'left' });
      // goals tally
      D.circle(g, 150, 32, 12, P.mint, P.mintDeep, 2);
      D.text(g, '⚽', 150, 33, { size: 14 });
      D.text(g, 'Goals ' + this.goals, 168, 58, { size: 16, color: P.mintDeep, weight: 800, align: 'left' });

      // kick pips along the top
      for (let i = 0; i < TOTAL_KICKS; i++) {
        const px = 300 + i * 34;
        const done = i < this.kick;
        const cur = i === this.kick && this.state !== 'done' && this.state !== 'howto';
        D.circle(g, px, 30, 11, done ? P.yellow : 'rgba(255,255,255,0.65)',
          cur ? P.pinkDeep : '#f0b9d2', cur ? 3 : 2);
        if (done) D.star(g, px, 30, 6, P.yellowDeep);
      }
    },

    drawMeter(g) {
      const M = METER;
      D.rr(g, M.x - 8, M.y - 36, M.w + 16, M.h + 56, 14, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      D.text(g, 'POWER', M.x + M.w / 2, M.y - 18, { size: 14, color: P.pinkDeep, weight: 800 });
      D.rr(g, M.x, M.y, M.w, M.h, 10, '#ffe9f3', '#f0b9d2', 2);
      // strong zone near the top
      D.rr(g, M.x + 2, M.y + 2, M.w - 4, M.h * 0.34, 8, 'rgba(246,207,90,0.55)');
      D.star(g, M.x + M.w / 2, M.y + M.h * 0.17, 8, P.yellowDeep);
      const fh = Math.max(5, M.h * this.power);
      D.rr(g, M.x + 3, M.y + M.h - fh, M.w - 6, fh, 8, this.power >= 0.66 ? P.yellowDeep : P.pinkDeep);
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(70,40,70,0.3)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 200, 96, 560, 392, { title: '⚽ Penalty Kicks with Pochacco' });
      CM.drawFriend(g, 'pochacco', 300, 430, 1.25, { bob: ((CM.time * 1.2) % 1) * 0.5 });
      D.text(g, 'Pochacco', 300, 454, { size: 14, color: P.pinkDeep, weight: 800 });
      D.text(g, '1. Tap to aim across the goal —', 545, 176, { size: 17, color: P.ink, weight: 700 });
      D.text(g, 'pick a spot away from the keeper!', 545, 200, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '2. Tap again to set your power —', 545, 244, { size: 17, color: P.ink, weight: 700 });
      D.text(g, 'gold zone = unstoppable!', 545, 268, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '3. Beat Keroppi for a GOAL! ⚽', 545, 312, { size: 17, color: P.pinkDeep, weight: 800 });
      D.text(g, '8 kicks · 50 points each · Have fun!', 480, 376, { size: 14, color: '#9a8a94' });
      if (CM.ui.button(g, 380, 404, 200, 56, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.beginKick();
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
