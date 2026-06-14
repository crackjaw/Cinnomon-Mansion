/* Cinnamoroll Mansion — Seesaw Pop (hosted by Pompompurin) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------------- layout ----------------
     The seesaw lives near the bottom-centre. Keroppi sits on the HIGH (right)
     end; the kid jumps onto the LOW (left) end to launch Keroppi straight up.
     Sky space above is filled with balloons & stars at varied heights. */
  const GROUND_Y = 506;            // top of the grass
  const PIVOT = { x: 470, y: 470 }; // fulcrum top
  const BEAM_HALF = 150;            // half-length of the seesaw plank
  const BEAM_TILT = 0.30;          // resting tilt (radians); left end down, right up
  const FLY_X = 624;               // x where Keroppi flies straight up (above the right seat)
  const KERO_REST_Y = 372;         // Keroppi's feet when sitting on the raised right seat
  const PURIN = { x: 116, y: 498 }; // host cheering on the left
  const TOTAL_LAUNCHES = 8;
  const MAX_PARTS = 110;

  // launch heights (feet-y of Keroppi at apex) by locked power 0..1
  const APEX_LOW = 360;            // weakest launch barely lifts off
  const APEX_HIGH = 70;            // gold-zone launch rockets near the top
  const GRAB_R = 58;               // how close Keroppi must pass a target to grab it

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'seesaw',
    name: 'Seesaw Pop',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';      // howto -> aim -> launch -> result -> (repeat) -> done
      this.score = 0;
      this.launch = 0;           // launches completed
      this.finished = false;

      this.power = 0;
      this.powerT = 0;
      this.lockedPower = 0;

      this.targets = [];
      this.buildSky();

      // Keroppi flight
      this.flyY = KERO_REST_Y;
      this.flyVY = 0;
      this.apexY = KERO_REST_Y;
      this.rising = false;
      this.grabbedThis = 0;
      this.gotThis = 0;

      // kid (player) jump onto the low seat
      this.kid = { x: 316, y: GROUND_Y, jumpT: 0, jumping: false };
      this.beamPush = 0;         // 0..1 how far the left end is stomped down

      this.parts = [];
      this.shk = { t: 0, dur: 1, mag: 0 };
      this.msg = '';
      this.bigMsg = '';
      this.resultT = 0;
      this.resultDur = 1;
      this.doneT = 0;
      this.popCd = 0;

      // host
      this.hostBubble = { text: '', t: 0 };
      this.hostHappy = 0;

      // floaty clouds (parallax)
      this.clouds = [
        { x: 180, y: 96, s: 1.0, sp: 7 },
        { x: 560, y: 70, s: 1.3, sp: 5 },
        { x: 800, y: 130, s: 0.85, sp: 9 }
      ];
    },

    exit() {},

    /* ================= sky targets ================= */
    // Place balloons & stars in columns above the flight path, at varied heights.
    // Higher = worth more, so a mightier launch is rewarded. Even a weak launch
    // clips the lowest one or two.
    buildSky() {
      this.targets = [];
      const cols = [
        { x: FLY_X - 46 }, { x: FLY_X - 16 }, { x: FLY_X + 16 }, { x: FLY_X + 46 }
      ];
      // height bands from low (cheap) to high (precious)
      const bands = [
        { y: 332, pts: 150, kind: 'balloon' },
        { y: 272, pts: 200, kind: 'balloon' },
        { y: 212, pts: 250, kind: 'star' },
        { y: 152, pts: 300, kind: 'balloon' },
        { y: 96, pts: 400, kind: 'star' }
      ];
      const balloonCols = ['#ff9ec7', '#8ecdf6', '#bdeccd', '#ffe9a8', '#d8c9f2', '#ff8b9e'];
      let ci = 0;
      for (const b of bands) {
        // scatter 2-3 across the columns so each band has variety
        const used = CM.pick([[0, 2, 3], [0, 1, 3], [1, 2, 3], [0, 1, 2]]);
        for (const cIdx of used) {
          const jitterX = CM.rand(-10, 10);
          const jitterY = CM.rand(-14, 14);
          this.targets.push({
            x: cols[cIdx].x + jitterX,
            y: b.y + jitterY,
            kind: b.kind,
            pts: b.pts,
            color: balloonCols[(ci++) % balloonCols.length],
            r: b.kind === 'star' ? 17 : 16,
            alive: true,
            ph: CM.rand(0, Math.PI * 2),
            pop: 0
          });
        }
      }
    },

    /* ================= state transitions ================= */
    startAim() {
      this.state = 'aim';
      this.power = 0;
      this.powerT = 0;
      this.msg = '';
      this.bigMsg = '';
      this.flyY = KERO_REST_Y;
      this.flyVY = 0;
      this.rising = false;
      this.beamPush = 0;
      this.kid.jumping = false;
      this.kid.jumpT = 0;
    },

    doLaunch() {
      this.lockedPower = this.power;
      this.apexY = CM.lerp(APEX_LOW, APEX_HIGH, this.lockedPower);
      this.grabbedThis = 0;
      this.gotThis = 0;
      this.state = 'launch';
      this.kid.jumping = true;
      this.kid.jumpT = 0;
      this.beamPush = 0;
      // initial upward velocity sized so Keroppi reaches apexY (energy = sqrt of drop)
      const drop = KERO_REST_Y - this.apexY;
      this.flyVY = -Math.sqrt(2 * 1400 * Math.max(2, drop));
      this.flyY = KERO_REST_Y;
      this.rising = true;
      CM.audio.play('boing');
      CM.audio.play('whoosh');
      this.sandPuff(this.kid.x, GROUND_Y, 8);
      this.doShake(0.22, 5);
    },

    endLaunch() {
      this.launch++;
      // tally the round message
      const n = this.gotThis;
      if (n >= 4) {
        this.msg = 'AMAZING!! ' + n + ' popped!';
        this.bigMsg = 'AMAZING!!';
        CM.audio.play('tada');
        this.doShake(0.4, 7);
        this.celebrate(26);
        this.say('Wooow!! ' + n + '!', 1.8);
      } else if (n >= 2) {
        this.msg = 'Great pop! +' + n;
        this.bigMsg = 'NICE!!';
        CM.audio.play('cheer');
        this.doShake(0.28, 4);
        this.celebrate(16);
        this.say('Yummy job!', 1.6);
      } else if (n === 1) {
        this.msg = 'Got one!';
        CM.audio.play('ding');
        this.celebrate(8);
        this.say('Nice one!', 1.4);
      } else {
        this.msg = 'So close — aim higher!';
        CM.audio.play('miss');
        this.say('Try again!', 1.4);
      }
      this.state = 'result';
      this.resultDur = n >= 2 ? 1.9 : 1.4;
      this.resultT = this.resultDur;
    },

    afterResult() {
      if (this.launch >= TOTAL_LAUNCHES) {
        this.state = 'done';
        this.doneT = 1.9;
        this.shk = { t: 0, dur: 1, mag: 0 };
        this.say('What a show!', 3);
        CM.audio.play('cheer');
        return;
      }
      // refresh any popped balloons for the next launch so every round is juicy
      this.buildSky();
      this.startAim();
    },

    say(text, t) {
      this.hostBubble = { text: text, t: t };
      this.hostHappy = Math.max(this.hostHappy, 1.1);
    },

    /* ================= update ================= */
    update(dt) {
      if (this.shk.t > 0) this.shk.t -= dt;
      if (this.popCd > 0) this.popCd -= dt;
      if (this.hostBubble.t > 0) this.hostBubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      this.updateParts(dt);
      for (const c of this.clouds) {
        c.x += c.sp * dt;
        if (c.x > CM.W + 70) c.x = -70;
      }
      for (const t of this.targets) { t.ph += dt; if (t.pop > 0) t.pop = Math.min(1, t.pop + dt / 0.3); }

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.startAim();
          break;

        case 'aim':
          this.powerT += dt;
          // oscillating 0 -> 1 -> 0 power sweep
          this.power = (1 - Math.cos(this.powerT * 3.1)) / 2;
          if (anyPress()) {
            CM.audio.play('click');
            this.doLaunch();
          }
          break;

        case 'launch':
          this.updateFlight(dt);
          break;

        case 'result':
          this.resultT -= dt;
          if (this.resultDur - this.resultT > 0.5 && anyPress()) this.resultT = 0; // tap to skip
          if (this.resultT <= 0) this.afterResult();
          break;

        case 'done':
          // gentle confetti drizzle
          if (this.parts.length < 70 && Math.random() < 0.32) {
            this.spawnPart({
              x: CM.rand(220, 740), y: CM.rand(70, 220),
              vx: CM.rand(-30, 30), vy: CM.rand(-40, 10),
              life: CM.rand(0.8, 1.4), type: Math.random() < 0.5 ? 'star' : 'heart',
              color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
              size: CM.rand(8, 13), rot: CM.rand(0, 6), vr: CM.rand(-3, 3)
            });
          }
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('seesaw', this.score, CM.clamp(Math.ceil(this.score / 16), 5, 30));
          }
          break;
      }
    },

    updateFlight(dt) {
      // kid stomps the low seat, the beam slams, Keroppi rockets up
      if (this.kid.jumping) {
        this.kid.jumpT += dt;
        this.beamPush = CM.clamp(this.kid.jumpT / 0.16, 0, 1);
      }
      const k = this.kid;
      // gravity for Keroppi
      this.flyVY += 1400 * dt;
      this.flyY += this.flyVY * dt;
      if (this.flyVY < 0) this.rising = true;
      else if (this.rising && this.flyVY >= 0) this.rising = false; // passed apex

      // grab any targets the rising/falling frog sweeps near
      for (const t of this.targets) {
        if (!t.alive) continue;
        if (CM.dist(FLY_X, this.flyY - 24, t.x, t.y) < GRAB_R + t.r) {
          this.popTarget(t);
        }
      }

      // landed back on the seat
      if (this.flyVY > 0 && this.flyY >= KERO_REST_Y) {
        this.flyY = KERO_REST_Y;
        this.flyVY = 0;
        this.endLaunch();
      }
    },

    popTarget(t) {
      t.alive = false;
      t.pop = 0.0001;
      this.score += t.pts;
      this.gotThis++;
      this.grabbedThis++;
      if (this.popCd <= 0) {
        CM.audio.play(t.kind === 'star' ? 'ding' : 'pop');
        this.popCd = 0.05;
      } else {
        CM.audio.tone(660 + this.gotThis * 80, 0.08, 'sine', 0.1, 0, 1000);
      }
      this.burst(t.x, t.y, t.color, t.kind === 'star');
      this.floatText(t.x, t.y - 18, '+' + t.pts, t.kind === 'star' ? '#e0a81f' : P.pinkDeep);
    },

    /* ================= juice ================= */
    doShake(t, mag) { this.shk = { t: t, dur: t, mag: mag }; },

    spawnPart(pt) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      pt.maxLife = pt.life;
      this.parts.push(pt);
    },

    burst(x, y, color, big) {
      const n = big ? 12 : 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.spawnPart({
          x: x, y: y,
          vx: Math.cos(a) * CM.rand(70, big ? 180 : 130),
          vy: Math.sin(a) * CM.rand(70, big ? 180 : 130) - 30,
          life: CM.rand(0.35, 0.7), type: 'spark',
          color: Math.random() < 0.5 ? '#fff' : color,
          size: CM.rand(2.5, big ? 5 : 4), rot: 0, vr: 0
        });
      }
      const hearts = big ? 4 : 2;
      for (let i = 0; i < hearts; i++) {
        this.spawnPart({
          x: x + CM.rand(-14, 14), y: y - 8,
          vx: CM.rand(-30, 30), vy: CM.rand(-120, -60),
          life: 1.0, type: 'heart',
          color: CM.pick([P.pink, P.pinkDeep, color]),
          size: CM.rand(7, 11), rot: 0, vr: 0
        });
      }
    },

    sandPuff(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: x + CM.rand(-16, 16), y: y - 2,
          vx: CM.rand(-90, 90), vy: CM.rand(-70, -10),
          life: CM.rand(0.3, 0.55), type: 'puff',
          color: 'rgba(255,255,255,0.85)', size: CM.rand(4, 9), rot: 0, vr: 0
        });
      }
    },

    floatText(x, y, str, color) {
      this.spawnPart({ x: x, y: y, str: str, color: color, vx: 0, vy: -40, life: 1.0, type: 'txt', size: 0, rot: 0, vr: 0 });
    },

    celebrate(n) {
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: CM.rand(280, 680), y: CM.rand(120, 300),
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
        if (pt.type === 'puff') { pt.vy += 30 * dt; pt.vx *= 1 - dt * 2.2; pt.size += dt * 10; }
        else if (pt.type === 'txt') { /* drifts up only */ }
        else pt.vy += 240 * dt;
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
      this.drawTargets(g);
      this.drawSeesaw(g);

      // Keroppi (the flyer)
      const keroFlying = this.state === 'launch';
      const keroY = keroFlying ? this.flyY : KERO_REST_Y;
      const wob = keroFlying ? Math.sin(CM.time * 18) * 0.04 : 0;
      g.save();
      g.translate(FLY_X, keroY);
      g.rotate(wob);
      CM.drawFriend(g, 'keroppi', 0, 0, 1.0, { bob: keroFlying ? 0 : ((CM.time * 1.4) % 1) * 0.4, shadow: false });
      // a little "wheee!" trail when high up
      if (keroFlying && this.flyY < 280) {
        D.star(g, -26, 16, 5, 'rgba(255,255,255,0.8)');
        D.star(g, 24, 26, 4, 'rgba(255,255,255,0.7)');
      }
      g.restore();
      if (!keroFlying) D.shadow(g, FLY_X, KERO_REST_Y, 24);

      // the kid (player's character) on the low seat — jumps to stomp it
      this.drawKid(g);

      // Pompompurin cheering on the left
      const happy = this.hostHappy > 0 || this.state === 'done' || (this.state === 'launch' && this.flyY < 260);
      const pbob = happy ? (CM.time * 2.4) % 1 : ((CM.time * 0.8) % 1) * 0.35;
      CM.drawFriend(g, 'pompompurin', PURIN.x, PURIN.y, 1.12, { bob: pbob });
      if (this.hostHappy > 0) {
        const lift = Math.abs(Math.sin(pbob * Math.PI * 2)) * 6;
        D.star(g, PURIN.x + 24, PURIN.y - 78 - lift, 7, P.yellowDeep, CM.time * 3);
      }
      D.rr(g, PURIN.x - 50, PURIN.y + 6, 100, 19, 9, 'rgba(255,255,255,0.85)');
      D.text(g, 'Pompompurin', PURIN.x, PURIN.y + 16, { size: 14, color: P.ink, weight: 800 });

      this.drawParts(g);
      g.restore(); // end shake

      /* ---------- HUD (not shaken) ---------- */
      // score, top-left
      D.rr(g, 14, 12, 168, 44, 20, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      D.star(g, 36, 34, 12, P.yellowDeep);
      D.text(g, String(this.score), 116, 34, { size: 22, color: '#c98a1f', weight: 800 });
      // launch counter, top-center
      if (this.state !== 'howto') {
        const shown = Math.min(this.launch + 1, TOTAL_LAUNCHES);
        D.rr(g, 388, 12, 184, 40, 20, 'rgba(255,255,255,0.9)', '#f0b9d2', 3);
        D.text(g, 'Launch ' + shown + ' / ' + TOTAL_LAUNCHES, 480, 32, { size: 19, color: P.blueDeep, weight: 800 });
      }

      // power meter while aiming
      if (this.state === 'aim') this.drawMeter(g);

      // host reaction bubble
      if (this.hostBubble.t > 0 && this.state !== 'howto') {
        const txt = this.hostBubble.text;
        const cw = Math.max(96, txt.length * 9 + 26);
        const bx = CM.clamp(PURIN.x - 10, 8, CM.W - cw - 8);
        D.bubble(g, bx, PURIN.y - 168, cw, 40, PURIN.x + 14);
        D.text(g, txt, bx + cw / 2, PURIN.y - 148, { size: 15, weight: 800, color: P.pinkDeep });
      }

      // big banner on great rounds
      if (this.state === 'result' && this.bigMsg) {
        const el = this.resultDur - this.resultT;
        const sc = Math.min(1, el * 4);
        D.text(g, this.bigMsg, 480, 250, {
          size: 24 + 40 * sc, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
        });
        D.star(g, 330, 250, 18, P.yellowDeep, CM.time * 2.5);
        D.star(g, 630, 250, 18, P.yellowDeep, -CM.time * 2.5);
      }

      // hint bar
      let hint = '';
      if (this.state === 'aim') hint = CM.touchMode ? 'Tap to JUMP — gold zone flies highest!' : 'Click or SPACE to JUMP — gold = highest!';
      else if (this.state === 'result') hint = CM.touchMode ? 'Tap to keep going!' : 'Tap / SPACE to keep going!';
      if (hint) {
        D.rr(g, 250, 562, 460, 26, 13, 'rgba(255,255,255,0.78)');
        D.text(g, hint, 480, 575, { size: 15, color: P.pinkDeep, weight: 800 });
      }

      if (this.state === 'howto') this.drawHowto(g);
      if (this.state === 'done') {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(0, 0, CM.W, CM.H);
        D.text(g, 'What a show!! 🎈', 480, 250, { size: 50, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10 });
        D.text(g, 'You scored ' + this.score + ' points!', 480, 308, { size: 26, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6 });
        D.star(g, 250, 250 + Math.sin(CM.time * 5) * 6, 16, P.yellowDeep);
        D.star(g, 710, 250 + Math.cos(CM.time * 5) * 6, 16, P.yellowDeep);
      }
    },

    /* ---------- scene art ---------- */
    drawScene(g) {
      // sky gradient
      const sg = g.createLinearGradient(0, 0, 0, GROUND_Y);
      sg.addColorStop(0, '#bfe7ff');
      sg.addColorStop(1, '#e9f7ff');
      g.fillStyle = sg;
      g.fillRect(0, 0, CM.W, GROUND_Y);

      // sun
      D.circle(g, 858, 84, 34, '#fff3b0');
      D.circle(g, 858, 84, 26, '#ffe07a');

      // clouds
      for (const c of this.clouds) this.drawCloud(g, c.x, c.y, c.s);

      // grass ground
      const gg = g.createLinearGradient(0, GROUND_Y, 0, CM.H);
      gg.addColorStop(0, '#bfe6a4');
      gg.addColorStop(1, '#a6d889');
      g.fillStyle = gg;
      g.fillRect(0, GROUND_Y, CM.W, CM.H - GROUND_Y);
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillRect(0, GROUND_Y - 3, CM.W, 5);
      // wood-chip patch under the play area
      D.ellipse(g, 470, 556, 320, 42, '#e8c39a', '#d9ad7e', 3);
      g.fillStyle = 'rgba(180,130,80,0.35)';
      for (let i = 0; i < 18; i++) {
        const cx = 200 + ((i * 137) % 540);
        const cy = 538 + ((i * 53) % 36);
        g.save(); g.translate(cx, cy); g.rotate((i * 1.3) % Math.PI);
        g.fillRect(-4, -1.5, 8, 3); g.restore();
      }
      // little grass tufts
      g.strokeStyle = '#8fc873'; g.lineWidth = 3; g.lineCap = 'round';
      for (let i = 0; i < 11; i++) {
        const gx = 30 + i * 92;
        const gy = GROUND_Y + 4;
        g.beginPath();
        g.moveTo(gx, gy); g.lineTo(gx - 5, gy - 11);
        g.moveTo(gx, gy); g.lineTo(gx, gy - 14);
        g.moveTo(gx, gy); g.lineTo(gx + 5, gy - 11);
        g.stroke();
      }

      // low picket fence behind the play area
      this.drawFence(g);
    },

    drawCloud(g, x, y, s) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      D.circle(g, -26, 4, 20);
      D.circle(g, 0, -8, 26);
      D.circle(g, 26, 4, 22);
      D.rr(g, -44, 2, 88, 20, 10, 'rgba(255,255,255,0.95)');
      g.restore();
    },

    drawFence(g) {
      const fy = 470;
      g.fillStyle = '#fff';
      g.strokeStyle = '#e6d3c2';
      g.lineWidth = 2;
      // back rail
      D.rr(g, 40, fy + 8, 880, 8, 4, '#ffffff', '#e6d3c2', 2);
      for (let x = 40; x <= 900; x += 56) {
        // skip pickets right behind the seesaw for clarity
        if (x > 360 && x < 600) continue;
        g.beginPath();
        g.moveTo(x, fy + 26);
        g.lineTo(x, fy - 16);
        g.lineTo(x + 9, fy - 24);
        g.lineTo(x + 18, fy - 16);
        g.lineTo(x + 18, fy + 26);
        g.closePath();
        g.fillStyle = '#fff';
        g.fill();
        g.strokeStyle = '#e6d3c2';
        g.stroke();
      }
    },

    /* ---------- seesaw ---------- */
    drawSeesaw(g) {
      // tilt: left end down, right end up. During a launch the left end is
      // stomped fully down then springs; show the stomp via beamPush.
      const tilt = BEAM_TILT + this.beamPush * 0.06;
      const px = PIVOT.x, py = PIVOT.y;

      // fulcrum (cute triangle base)
      g.fillStyle = '#f2b53c';
      g.beginPath();
      g.moveTo(px, py - 6);
      g.lineTo(px - 30, py + 40);
      g.lineTo(px + 30, py + 40);
      g.closePath();
      g.fill();
      g.strokeStyle = '#d8ab35'; g.lineWidth = 3; g.stroke();
      D.circle(g, px, py - 4, 8, '#ffe07a', '#d8ab35', 2.5);

      // beam
      g.save();
      g.translate(px, py - 4);
      g.rotate(tilt);
      // plank
      D.rr(g, -BEAM_HALF, -10, BEAM_HALF * 2, 20, 10, '#ff9ec7', '#e87fb2', 3);
      // stripes
      g.fillStyle = 'rgba(255,255,255,0.55)';
      for (let i = -BEAM_HALF + 16; i < BEAM_HALF; i += 30) g.fillRect(i, -7, 8, 14);
      // seats (handles) at each end
      D.rr(g, -BEAM_HALF - 4, -26, 22, 16, 7, '#8ecdf6', '#6aaede', 2.5); // left (low) seat
      D.rr(g, BEAM_HALF - 18, -26, 22, 16, 7, '#67c587', '#4ea06d', 2.5);  // right (high) seat
      // handle bars
      g.strokeStyle = '#ffe07a'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.arc(-BEAM_HALF + 7, -30, 9, Math.PI, 0); g.stroke();
      g.beginPath(); g.arc(BEAM_HALF - 7, -30, 9, Math.PI, 0); g.stroke();
      g.restore();
    },

    // returns screen position of the LOW (left) seat top, accounting for stomp
    lowSeatPos() {
      const tilt = BEAM_TILT + this.beamPush * 0.06;
      const px = PIVOT.x, py = PIVOT.y - 4;
      const lx = -BEAM_HALF + 7;
      return { x: px + Math.cos(tilt) * lx, y: py + Math.sin(tilt) * lx - 30 };
    },

    drawKid(g) {
      const k = this.kid;
      const seat = this.lowSeatPos();
      let x = k.x, y = GROUND_Y, phase = 0, facing = 'right';
      if (this.state === 'launch' && k.jumping) {
        // a quick hop landing ON the low seat to stomp it down
        const t = CM.clamp(k.jumpT / 0.16, 0, 1);
        x = CM.lerp(k.x, seat.x - 2, t);
        const arc = Math.sin(t * Math.PI) * 40;
        y = CM.lerp(GROUND_Y, seat.y + 2, t) - arc;
        facing = 'right';
      } else if (this.state === 'launch') {
        // riding the stomped seat
        x = seat.x - 2; y = seat.y + 2; facing = 'right';
      } else {
        // idle: standing beside the low end, ready to jump, little bob
        x = k.x; y = GROUND_Y; phase = 0;
      }
      CM.drawPlayer(g, x, y, 1.0, facing, phase);
    },

    /* ---------- targets (balloons & stars) ---------- */
    drawTargets(g) {
      for (const t of this.targets) {
        if (!t.alive) continue;
        const bob = Math.sin(t.ph * 1.5) * 4;
        const sway = Math.sin(t.ph * 0.9 + t.x) * 3;
        const x = t.x + sway, y = t.y + bob;
        if (t.kind === 'balloon') {
          // string
          g.strokeStyle = 'rgba(120,120,140,0.5)'; g.lineWidth = 1.5;
          g.beginPath();
          g.moveTo(x, y + t.r);
          g.quadraticCurveTo(x + 4, y + t.r + 14, x, y + t.r + 26);
          g.stroke();
          // body
          D.ellipse(g, x, y, t.r, t.r * 1.18, t.color, 'rgba(0,0,0,0.08)', 2);
          // knot
          g.fillStyle = t.color;
          g.beginPath(); g.moveTo(x - 3, y + t.r); g.lineTo(x + 3, y + t.r); g.lineTo(x, y + t.r + 5); g.closePath(); g.fill();
          // shine + cute face
          D.ellipse(g, x - t.r * 0.32, y - t.r * 0.4, t.r * 0.22, t.r * 0.3, 'rgba(255,255,255,0.7)');
          g.fillStyle = 'rgba(60,60,72,0.75)';
          D.circle(g, x - 4, y - 1, 1.6, 'rgba(60,60,72,0.75)');
          D.circle(g, x + 4, y - 1, 1.6, 'rgba(60,60,72,0.75)');
          g.strokeStyle = 'rgba(60,60,72,0.6)'; g.lineWidth = 1.4; g.lineCap = 'round';
          g.beginPath(); g.arc(x, y + 3, 3, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
        } else {
          // glowing star
          const tw = 0.5 + 0.5 * Math.sin(t.ph * 4);
          g.globalAlpha = 0.3 + tw * 0.25;
          D.star(g, x, y, t.r * 1.5, '#fff3b0', t.ph * 0.6);
          g.globalAlpha = 1;
          D.star(g, x, y, t.r + 2, '#e8be3a', t.ph * 0.6);
          D.star(g, x, y, t.r, '#ffe07a', t.ph * 0.6);
          D.circle(g, x - t.r * 0.18, y - t.r * 0.18, t.r * 0.16, 'rgba(255,255,255,0.9)');
        }
      }
    },

    /* ---------- power meter ---------- */
    drawMeter(g) {
      const M = { x: 880, y: 150, w: 36, h: 340 };
      D.rr(g, M.x - 10, M.y - 36, M.w + 20, M.h + 58, 14, 'rgba(255,255,255,0.88)', '#f0b9d2', 2);
      D.text(g, 'JUMP!', M.x + M.w / 2, M.y - 18, { size: 14, color: P.pinkDeep, weight: 800 });
      D.rr(g, M.x, M.y, M.w, M.h, 10, '#ffe9f3', '#f0b9d2', 2);
      // gold sweet zone at the top
      D.rr(g, M.x + 2, M.y + 2, M.w - 4, M.h * 0.26, 8, 'rgba(246,207,90,0.6)');
      D.star(g, M.x + M.w / 2, M.y + M.h * 0.13, 9, P.yellowDeep);
      // oscillating fill (grows from the bottom)
      const fh = Math.max(6, M.h * this.power);
      D.rr(g, M.x + 3, M.y + M.h - fh, M.w - 6, fh, 8, this.power >= 0.74 ? P.yellowDeep : P.pinkDeep);
      // marker arrow
      const my = M.y + M.h - fh;
      g.fillStyle = P.pinkDeep;
      g.beginPath();
      g.moveTo(M.x - 6, my); g.lineTo(M.x - 18, my - 7); g.lineTo(M.x - 18, my + 7); g.closePath();
      g.fill();
    },

    /* ---------- particles ---------- */
    drawParts(g) {
      for (const pt of this.parts) {
        g.globalAlpha = CM.clamp(pt.life / pt.maxLife, 0, 1);
        if (pt.type === 'star') D.star(g, pt.x, pt.y, pt.size, pt.color, pt.rot);
        else if (pt.type === 'heart') D.heart(g, pt.x, pt.y, pt.size, pt.color);
        else if (pt.type === 'puff') D.circle(g, pt.x, pt.y, pt.size, pt.color);
        else if (pt.type === 'txt') {
          D.text(g, pt.str, pt.x, pt.y, { size: 22, color: pt.color, weight: 800, stroke: '#fff', strokeWidth: 5 });
        } else D.circle(g, pt.x, pt.y, pt.size, pt.color);
      }
      g.globalAlpha = 1;
    },

    /* ---------- howto ---------- */
    drawHowto(g) {
      g.fillStyle = 'rgba(70,40,70,0.3)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 200, 96, 560, 392, { title: '🎈 Seesaw Pop with Pompompurin' });
      CM.drawFriend(g, 'pompompurin', 296, 438, 1.25, { bob: ((CM.time * 1.2) % 1) * 0.5 });
      D.text(g, 'Keroppi sits on the high end —', 540, 168, { size: 18, color: P.ink, weight: 700 });
      D.text(g, 'launch them up to the sky!', 540, 192, { size: 18, color: P.ink, weight: 700 });
      D.text(g, 'Tap when the meter hits the', 540, 236, { size: 18, color: P.ink, weight: 700 });
      D.text(g, 'GOLD zone to jump highest!', 540, 260, { size: 18, color: P.yellowDeep, weight: 800 });
      D.text(g, 'Pop balloons & grab ★ stars —', 540, 304, { size: 18, color: P.ink, weight: 700 });
      D.text(g, 'higher up is worth more!', 540, 328, { size: 18, color: P.pinkDeep, weight: 800 });
      D.text(g, '8 launches · Have fun!', 480, 372, { size: 14, color: '#9a8a94' });
      if (CM.ui.button(g, 380, 400, 200, 56, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.startAim();
      }
    }
  });
})();
