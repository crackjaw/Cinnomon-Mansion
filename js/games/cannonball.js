/* Cinnamoroll Mansion — Cannonball Splash (hosted by Keroppi) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---- pool / scene geometry ----
     Water surface lives at WATER_Y; the diving board juts out from the left.
     The player stands at BOARD_TIP, leaps in an arc and splashes down at SPLASH_X. */
  const WATER_Y = 372;            // top of the pool water
  const BOARD_Y = 250;            // top surface of the diving board
  const BOARD_TIP = { x: 286, y: BOARD_Y };
  const SPLASH_X = 560;           // where the cannonball lands in the water
  const SPLASH_Y = WATER_Y + 6;
  const METER = { x: 792, y: 150, w: 40, h: 300 };
  const PERFECT_LO = 0.80;        // gold "perfect form" band (top of the meter)
  const PERFECT_HI = 0.93;
  const TOTAL_DIVES = 8;
  const MAX_PARTS = 110;
  const KERO = { x: 96, y: 430 };           // host frog cheering on the deck

  // judge friends on the deck (right side) holding score cards
  const JUDGES = [
    { id: 'mymelody', x: 700, y: 470 },
    { id: 'pompompurin', x: 800, y: 482 },
    { id: 'pochacco', x: 888, y: 470 }
  ];

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'cannonball',
    name: 'Cannonball Splash',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';     // howto -> count -> power -> diving -> score -> (repeat) -> done -> finish once
      this.score = 0;
      this.diveIdx = 0;         // 0..5
      this.finished = false;

      this.power = 0;
      this.powerT = 0;
      this.lockedPower = 0;
      this.perfect = false;

      // diver physics (screen-space arc)
      this.diver = { x: BOARD_TIP.x, y: BOARD_TIP.y, vx: 0, vy: 0, spin: 0, active: false, tuck: 0 };

      // the springy board
      this.boardFlex = 0;       // 0..1 downward flex amount
      this.standBounce = 0;     // idle little bounce while waiting

      this.parts = [];
      this.ripples = [];        // expanding rings on the water
      this.shk = { t: 0, dur: 1, mag: 0 };

      this.countT = 0;
      this.lastSeg = -1;
      this.diveT = 0;           // timer within the diving phase
      this.scoreT = 0;          // timer within the score-card phase
      this.doneT = 0;

      this.lastScore = 0;       // points from the most recent dive
      this.lastCard = 0;        // the judges' card number (e.g. 8.5)
      this.bigMsg = '';
      this.msg = '';
      this.hostBubble = { text: '', t: 0 };
      this.splashCx = SPLASH_X; // where the splash plume erupts
      this.crownSplash = false;
    },

    exit() {},

    /* ================= phase transitions ================= */
    beginCount() {
      this.state = 'count';
      this.countT = 0;
      this.lastSeg = -1;
      this.say('Show me a splash!', 2.4);
    },

    startPower() {
      this.state = 'power';
      this.power = 0;
      this.powerT = 0;
      this.boardFlex = 0;
      this.diver.x = BOARD_TIP.x;
      this.diver.y = BOARD_TIP.y;
      this.diver.active = false;
      this.bigMsg = '';
      this.msg = '';
    },

    lockPower() {
      this.lockedPower = this.power;
      this.perfect = this.power >= PERFECT_LO && this.power <= PERFECT_HI;
      CM.audio.play('boing');
      this.boardFlex = 1;       // board springs down then launches the diver
      this.state = 'diving';
      this.diveT = 0;

      // launch arc: stronger power = higher, fuller arc, landing near SPLASH_X
      const pw = this.lockedPower;
      this.diver.x = BOARD_TIP.x;
      this.diver.y = BOARD_TIP.y - 6;
      this.diver.vx = CM.lerp(150, 205, pw);
      this.diver.vy = -CM.lerp(280, 560, pw);   // upward launch
      this.diver.spin = 0;
      this.diver.tuck = 0;
      this.diver.active = true;
    },

    /* ================= update ================= */
    update(dt) {
      if (this.shk.t > 0) this.shk.t -= dt;
      if (this.hostBubble.t > 0) this.hostBubble.t -= dt;
      this.standBounce = (this.standBounce + dt) % 1;
      // board easing back to flat
      this.boardFlex = Math.max(0, this.boardFlex - dt * 2.4);
      this.updateParts(dt);
      this.updateRipples(dt);

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.beginCount();
          break;

        case 'count': {
          this.countT += dt;
          const seg = Math.floor(this.countT / 0.7);
          if (seg !== this.lastSeg && seg <= 3) {
            this.lastSeg = seg;
            if (seg < 3) CM.audio.tone(620 + seg * 90, 0.14, 'triangle', 0.12);
            else CM.audio.play('ding');
          }
          if (this.countT >= 3.0) this.startPower();
          break;
        }

        case 'power':
          this.powerT += dt;
          // smooth 0 -> 1 -> 0 oscillation (like the bowling power meter)
          this.power = (1 - Math.cos(this.powerT * 3.2)) / 2;
          if (anyPress()) this.lockPower();
          break;

        case 'diving':
          this.updateDiving(dt);
          break;

        case 'score':
          this.scoreT -= dt;
          // let the kid tap to skip ahead once the cards are up
          if (this.scoreT < 1.1 && anyPress()) this.scoreT = 0;
          if (this.scoreT <= 0) this.afterDive();
          break;

        case 'done':
          this.doneT -= dt;
          if (this.parts.length < 70 && Math.random() < 0.35) this.confettiSparkle();
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('cannonball', this.score, CM.clamp(Math.ceil(this.score / 16), 5, 30));
          }
          break;
      }
    },

    updateDiving(dt) {
      this.diveT += dt;
      const d = this.diver;
      if (d.active) {
        d.vy += 900 * dt;            // gravity
        d.x += d.vx * dt;
        d.y += d.vy * dt;
        d.spin += dt * 7.5;          // tumbling cannonball roll
        // tuck into a ball shortly after launch (cute curl-up)
        d.tuck = CM.clamp(d.tuck + dt * 3.2, 0, 1);
        if (d.y >= SPLASH_Y && d.vy > 0) {
          d.active = false;
          this.splashCx = CM.clamp(d.x, SPLASH_X - 30, SPLASH_X + 60);
          this.doSplash();
        }
      }
    },

    doSplash() {
      const pw = this.lockedPower;
      // ---- scoring: splash size (gentle floor) + perfect-form bonus ----
      // base 25..55 from power so even a weak dive scores something nice
      const base = Math.round(CM.lerp(25, 56, pw));
      const bonus = this.perfect ? 22 : 0;
      this.lastScore = base + bonus;
      this.score += this.lastScore;
      // judges' card: 4.0 .. 9.0, perfect dives flash a 10!
      this.lastCard = this.perfect ? 10 : Math.round(CM.lerp(40, 92, pw)) / 10;
      this.crownSplash = this.perfect;

      // ---- juice ----
      const cx = this.splashCx;
      const big = pw > 0.66 || this.perfect;
      this.spawnSplash(cx, SPLASH_Y, pw, this.perfect);
      this.addRipple(cx, SPLASH_Y, pw);
      this.doShake(this.perfect ? 0.45 : (big ? 0.32 : 0.16), this.perfect ? 9 : (big ? 6 : 3));

      if (this.perfect) {
        CM.audio.play('splash');
        CM.audio.play('tada');
        this.bigMsg = 'PERFECT FORM!!';
        this.msg = 'A crown splash!! 👑';
        this.say('WOW!! Ten out of ten!', 2.4);
      } else if (pw > 0.66) {
        CM.audio.play('splash');
        CM.audio.play('cheer');
        this.bigMsg = 'HUGE SPLASH!!';
        this.msg = 'Kerplunk! So big!';
        this.say('What a splash!', 2.0);
      } else if (pw > 0.34) {
        CM.audio.play('splash');
        CM.audio.play('ding');
        this.bigMsg = 'Nice splash!';
        this.msg = 'Splish splash!';
        this.say('Nice dive!', 1.8);
      } else {
        CM.audio.play('splash');
        CM.audio.play('pop');
        this.bigMsg = 'Cute little splash!';
        this.msg = 'Splish!';
        this.say('Good try!', 1.8);
      }

      this.state = 'score';
      this.scoreT = this.perfect ? 3.0 : 2.6;
    },

    afterDive() {
      this.diveIdx++;
      if (this.diveIdx >= TOTAL_DIVES) {
        this.state = 'done';
        this.doneT = 2.0;
        this.doShake(0.4, 6);
        CM.audio.play('tada');
        this.say('Splash champion!', 3);
      } else {
        this.startPower();
      }
    },

    say(text, t) {
      this.hostBubble = { text: text, t: t };
    },

    /* ================= juice: particles & ripples ================= */
    doShake(t, mag) { this.shk = { t: t, dur: t, mag: mag }; },

    spawnPart(pt) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      pt.maxLife = pt.life;
      this.parts.push(pt);
    },

    spawnSplash(x, y, pw, perfect) {
      // central plume: water droplets shooting up, height scales with power
      const n = Math.round(CM.lerp(10, 26, pw)) + (perfect ? 8 : 0);
      const up = CM.lerp(160, 460, pw) + (perfect ? 80 : 0);
      for (let i = 0; i < n; i++) {
        const spread = (i / n - 0.5) * 2;     // -1..1 across the plume
        this.spawnPart({
          type: 'drop',
          x: x + spread * CM.rand(4, 20),
          y: y - 6,
          vx: spread * CM.rand(40, 150),
          vy: -CM.rand(up * 0.55, up),
          life: CM.rand(0.55, 1.05),
          size: CM.rand(3, 6.5),
          color: Math.random() < 0.35 ? '#ffffff' : (Math.random() < 0.5 ? P.blue : '#cdeeff')
        });
      }
      // a couple of fat foam blobs near the surface
      const blobs = perfect ? 6 : (pw > 0.5 ? 4 : 2);
      for (let i = 0; i < blobs; i++) {
        this.spawnPart({
          type: 'foam',
          x: x + CM.rand(-26, 26),
          y: y - CM.rand(0, 10),
          vx: CM.rand(-70, 70),
          vy: -CM.rand(40, 130),
          life: CM.rand(0.5, 0.85),
          size: CM.rand(7, 13),
          color: 'rgba(255,255,255,0.9)'
        });
      }
      if (perfect) {
        // a sparkly crown of stars erupting upward
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i / 9 - 0.5) * 1.7;
          this.spawnPart({
            type: 'star',
            x: x, y: y - 10,
            vx: Math.cos(a) * CM.rand(90, 200),
            vy: Math.sin(a) * CM.rand(160, 340),
            life: CM.rand(0.7, 1.2),
            size: CM.rand(8, 14),
            color: CM.pick([P.yellow, P.yellowDeep, '#fff3b0']),
            rot: CM.rand(0, 6), vr: CM.rand(-5, 5)
          });
        }
      }
    },

    confettiSparkle() {
      this.spawnPart({
        type: Math.random() < 0.5 ? 'star' : 'heart',
        x: CM.rand(220, 740), y: CM.rand(120, 300),
        vx: CM.rand(-50, 50), vy: CM.rand(-30, 60),
        life: CM.rand(0.7, 1.3),
        size: CM.rand(8, 14),
        color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep]),
        rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
      });
    },

    updateParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const pt = this.parts[i];
        pt.life -= dt;
        if (pt.life <= 0) { this.parts.splice(i, 1); continue; }
        pt.vy += (pt.type === 'foam' ? 320 : 540) * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        if (pt.rot !== undefined) pt.rot += (pt.vr || 0) * dt;
      }
    },

    addRipple(x, y, pw) {
      if (this.ripples.length > 8) this.ripples.shift();
      this.ripples.push({ x: x, y: y, r: 8, max: CM.lerp(46, 120, pw), life: 1, t: 0 });
    },

    updateRipples(dt) {
      for (let i = this.ripples.length - 1; i >= 0; i--) {
        const r = this.ripples[i];
        r.t += dt;
        r.r = 8 + r.max * Math.min(1, r.t / 0.9);
        r.life = Math.max(0, 1 - r.t / 1.1);
        if (r.life <= 0) this.ripples.splice(i, 1);
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

      // host frog cheering on the deck (bobs faster on a good splash)
      const excited = (this.state === 'score' && this.lastScore >= 60) || this.state === 'done';
      CM.drawFriend(g, 'keroppi', KERO.x, KERO.y, 1.12, {
        bob: excited ? (CM.time * 2.6) % 1 : ((CM.time * 0.9) % 1) * 0.4
      });

      // judges on the deck, holding up score cards after a dive
      this.drawJudges(g);

      // the diver (player's customized character)
      this.drawDiver(g);

      // water particles & ripples (drawn over the water)
      this.drawRipples(g);
      this.drawParts(g);

      g.restore(); // end shake — context restored on every path

      /* ---------- HUD (not shaken) ---------- */
      // score, top-left
      D.rr(g, 14, 12, 168, 62, 14, 'rgba(255,255,255,0.9)', '#bfe3ff', 2);
      D.text(g, 'Score ' + this.score, 98, 32, { size: 20, color: P.blueDeep, weight: 800 });
      const dn = Math.min(this.diveIdx + (this.state === 'done' ? 0 : 1), TOTAL_DIVES);
      D.text(g, 'Dive ' + Math.max(1, dn) + ' / ' + TOTAL_DIVES, 98, 56, { size: 15, color: P.ink, weight: 700 });

      if (this.state === 'power') this.drawMeter(g);

      // host speech bubble on good moments
      if (this.hostBubble.t > 0 && this.state !== 'howto') {
        const txt = this.hostBubble.text;
        const cw = Math.max(110, txt.length * 9 + 26);
        const bx = CM.clamp(KERO.x - 12, 8, CM.W - cw - 8);
        D.bubble(g, bx, KERO.y - 168, cw, 40, KERO.x + 14);
        D.text(g, txt, bx + cw / 2, KERO.y - 148, { size: 15, weight: 800, color: P.mintDeep });
      }

      // score cards + big banner during the score phase
      if (this.state === 'score') this.drawScorePhase(g);

      // count-in overlay
      if (this.state === 'count') {
        const SEGS = ['3', '2', '1', 'Go!'];
        const seg = Math.min(3, Math.floor(this.countT / 0.7));
        const frac = (this.countT - seg * 0.7) / 0.7;
        const size = (seg === 3 ? 70 : 92) * (1 + 0.3 * Math.max(0, 1 - frac * 3));
        D.text(g, SEGS[seg], 480, 250, {
          size: Math.round(size), color: P.blueDeep, weight: 800, stroke: '#ffffff', strokeWidth: 10
        });
      }

      // hint bar
      let hint = '';
      if (this.state === 'power') hint = CM.touchMode ? 'Tap to LOCK your bounce — gold = perfect form!' : 'Click or SPACE to lock — gold zone = perfect form!';
      else if (this.state === 'diving') hint = 'Cannonbaaall! 🌊';
      if (hint) {
        D.rr(g, 250, 574, 460, 24, 12, 'rgba(255,255,255,0.78)');
        D.text(g, hint, 480, 586, { size: 14, color: P.blueDeep, weight: 800 });
      }

      if (this.state === 'howto') this.drawHowto(g);

      if (this.state === 'done') {
        g.fillStyle = 'rgba(255,255,255,0.32)';
        g.fillRect(0, 0, CM.W, CM.H);
        D.text(g, 'Splash-tastic!! 🌊', 480, 250, { size: 48, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 10 });
        D.text(g, 'Total score: ' + this.score, 480, 308, { size: 28, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 6 });
      }
    },

    /* ---------- scene art (sky, deck, sparkly pool) ---------- */
    drawScene(g) {
      // soft blue sky
      const sky = g.createLinearGradient(0, 0, 0, WATER_Y);
      sky.addColorStop(0, '#cdeffd');
      sky.addColorStop(1, '#eaf8ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, CM.W, WATER_Y);

      // fluffy clouds
      this.cloud(g, 150, 70, 1.0);
      this.cloud(g, 470, 50, 0.8);
      this.cloud(g, 780, 92, 1.1);

      // warm sun, top-left-ish (out of the engine chrome corner)
      D.circle(g, 120, 70, 30, '#fff3b0');
      g.globalAlpha = 0.5;
      D.circle(g, 120, 70, 40, '#fff7cf');
      g.globalAlpha = 1;

      // pale tile deck (behind & around the pool)
      const deck = g.createLinearGradient(0, WATER_Y - 30, 0, CM.H);
      deck.addColorStop(0, '#ffe9d2');
      deck.addColorStop(1, '#ffdcc0');
      g.fillStyle = deck;
      g.fillRect(0, WATER_Y - 30, CM.W, CM.H - (WATER_Y - 30));
      // tile seams
      g.strokeStyle = 'rgba(220,160,120,0.25)';
      g.lineWidth = 2;
      for (let x = 0; x <= CM.W; x += 64) {
        g.beginPath(); g.moveTo(x, WATER_Y - 30); g.lineTo(x, CM.H); g.stroke();
      }
      for (let y = WATER_Y + 70; y < CM.H; y += 48) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(CM.W, y); g.stroke();
      }

      // ---- the pool ---- a big rounded rect of sparkling water
      const px = 150, py = WATER_Y, pw = CM.W - 300, ph = 170;
      // pool coping (white lip)
      D.rr(g, px - 14, py - 14, pw + 28, ph + 28, 28, '#ffffff', '#e7d7c9', 3);
      // water gradient
      D.rrPath(g, px, py, pw, ph, 22);
      g.save();
      g.clip();
      const wg = g.createLinearGradient(0, py, 0, py + ph);
      wg.addColorStop(0, P.blue);
      wg.addColorStop(0.5, P.skyDeep);
      wg.addColorStop(1, P.blueDeep);
      g.fillStyle = wg;
      g.fillRect(px, py, pw, ph);
      // gentle wavy ripple highlight bands
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.lineWidth = 3;
      g.lineCap = 'round';
      for (let b = 0; b < 4; b++) {
        const yy = py + 26 + b * 38;
        g.beginPath();
        for (let x = px; x <= px + pw; x += 14) {
          const wy = yy + Math.sin(x * 0.05 + CM.time * 1.6 + b) * 4;
          if (x === px) g.moveTo(x, wy); else g.lineTo(x, wy);
        }
        g.stroke();
      }
      // twinkling sparkles on the water
      for (let i = 0; i < 14; i++) {
        const sx = px + ((i * 137 + 40) % pw);
        const sy = py + 18 + ((i * 73) % (ph - 30));
        const tw = 0.5 + 0.5 * Math.sin(CM.time * 3 + i * 1.3);
        if (tw > 0.6) {
          g.globalAlpha = (tw - 0.6) / 0.4;
          D.star(g, sx, sy, 3.2 + tw * 1.6, '#ffffff');
        }
      }
      g.globalAlpha = 1;
      g.restore();

      // ---- the diving board (left) ----
      // support post
      D.rr(g, 198, BOARD_Y + 4, 26, 120, 6, '#cbb6e8', '#a98fd6', 2);
      // springy board flexes down a touch when launching
      const flex = this.boardFlex * 14;
      g.save();
      // shadow on the deck under the tip
      D.shadow(g, BOARD_TIP.x - 4, WATER_Y - 24, 40);
      D.rr(g, 150, BOARD_Y, 150, 18, 9, '#fff4dc', '#e6cfa6', 2);
      D.rr(g, 152, BOARD_Y + flex, 142, 14, 7, '#ffe6b8', '#e6cfa6', 2);
      // grippy stripes near the tip
      g.strokeStyle = 'rgba(200,150,80,0.4)';
      g.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const lx = 250 + i * 11;
        g.beginPath(); g.moveTo(lx, BOARD_Y + 3 + flex); g.lineTo(lx, BOARD_Y + 13 + flex); g.stroke();
      }
      g.restore();

      // ---- pool ladder (right side of the pool) ----
      const lx = px + pw - 28;
      g.strokeStyle = '#dfe7ee';
      g.lineWidth = 6;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(lx, py - 24); g.lineTo(lx, py + 70); g.stroke();
      g.beginPath(); g.moveTo(lx + 22, py - 24); g.lineTo(lx + 22, py + 70); g.stroke();
      g.lineWidth = 4;
      for (let i = 0; i < 3; i++) {
        const ry = py - 14 + i * 22;
        g.beginPath(); g.moveTo(lx, ry); g.lineTo(lx + 22, ry); g.stroke();
      }

      // ---- poolside props on the deck ----
      this.umbrella(g, 120, CM.H - 40);
      this.deckChair(g, 230, CM.H - 26);
      // a cheerful float ring bobbing in the water
      this.floatRing(g, px + 64, py + 96, P.pink);
      this.floatRing(g, px + pw - 120, py + 110, P.mint);
    },

    cloud(g, x, y, s) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      D.circle(g, -26, 4, 18);
      D.circle(g, 0, -6, 24);
      D.circle(g, 26, 4, 18);
      D.rr(g, -40, 2, 80, 18, 9, 'rgba(255,255,255,0.92)');
      g.restore();
    },

    umbrella(g, x, y) {
      D.shadow(g, x, y + 6, 46);
      // pole
      D.rr(g, x - 3, y - 96, 6, 96, 3, '#b08a5a');
      // canopy
      const cols = [P.pink, '#ffffff'];
      g.save();
      g.translate(x, y - 96);
      for (let i = 0; i < 6; i++) {
        const a0 = Math.PI + (i / 6) * Math.PI;
        const a1 = Math.PI + ((i + 1) / 6) * Math.PI;
        g.fillStyle = cols[i % 2];
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, 56, a0, a1);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = 'rgba(180,120,140,0.3)';
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(0, 0, 56, Math.PI, Math.PI * 2); g.stroke();
      g.restore();
      D.circle(g, x, y - 96, 4, P.pinkDeep);
    },

    deckChair(g, x, y) {
      D.shadow(g, x, y + 4, 40);
      // seat + reclined back
      g.save();
      g.fillStyle = P.mintDeep;
      D.rr(g, x - 34, y - 10, 68, 12, 6, P.mintDeep);     // seat
      g.translate(x - 30, y - 8);
      g.rotate(-0.5);
      D.rr(g, 0, -36, 14, 40, 6, '#7fd0a0');               // back
      g.restore();
      // legs
      g.strokeStyle = '#9bc4ff';
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 28, y + 2); g.lineTo(x - 34, y + 18); g.stroke();
      g.beginPath(); g.moveTo(x + 28, y + 2); g.lineTo(x + 34, y + 18); g.stroke();
    },

    floatRing(g, x, y, color) {
      const bob = Math.sin(CM.time * 1.4 + x) * 3;
      g.save();
      g.translate(x, y + bob);
      D.ellipse(g, 0, 0, 26, 14, color, '#ffffff', 4);
      D.ellipse(g, 0, 0, 12, 6, P.skyDeep);   // water in the hole
      // white highlight band
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 3;
      g.beginPath(); g.ellipse(-6, -3, 12, 6, 0, Math.PI * 0.9, Math.PI * 1.7); g.stroke();
      g.restore();
    },

    /* ---------- the diver ---------- */
    drawDiver(g) {
      const d = this.diver;
      // During 'score'/'done' the diver is underwater — nothing to draw.

      if (this.state === 'diving' && d.active) {
        // tumbling cannonball: curl up and spin in the air
        g.save();
        g.translate(d.x, d.y - 30);
        g.rotate(d.spin);
        const tuck = d.tuck;
        // scale down slightly as they tuck into a ball
        const s = CM.lerp(1.0, 0.92, tuck);
        g.scale(s, s);
        // draw the player upright but curled (knees up via translate)
        CM.drawPlayer(g, 0, 30 + tuck * 8, 1.0, 'down', 0);
        g.restore();
        return;
      }

      // standing / bouncing on the board tip (power & count phases)
      if (this.state === 'power' || this.state === 'count') {
        const flex = this.boardFlex * 14;
        // a little anticipatory bounce that grows with current power
        const bounce = this.state === 'power'
          ? -Math.abs(Math.sin(this.powerT * 3.2)) * (6 + this.power * 16)
          : -Math.abs(Math.sin(this.standBounce * Math.PI * 2)) * 4;
        CM.drawPlayer(g, BOARD_TIP.x, BOARD_TIP.y + 2 + flex + bounce, 1.05, 'right', 0);
      }
    },

    /* ---------- judges with score cards ---------- */
    drawJudges(g) {
      const showCards = this.state === 'score';
      for (let i = 0; i < JUDGES.length; i++) {
        const j = JUDGES[i];
        const happy = showCards && this.lastScore >= 50;
        CM.drawFriend(g, j.id, j.x, j.y, 0.92, {
          bob: happy ? (CM.time * 2.2 + i * 0.3) % 1 : ((CM.time * 0.8 + i * 0.4) % 1) * 0.3,
          flip: true
        });
        if (showCards) {
          // held-up score card, pops up after the splash
          const pop = CM.clamp((this.scoreTotalDur() - this.scoreT) * 4, 0, 1);
          const cy = j.y - 96 - pop * 16;
          g.save();
          g.globalAlpha = pop;
          D.rr(g, j.x - 18, cy, 36, 44, 8, '#ffffff', '#bfe3ff', 3);
          D.text(g, this.lastCard.toFixed(1), j.x, cy + 22, {
            size: 17, color: this.perfect ? P.pinkDeep : P.blueDeep, weight: 800
          });
          g.globalAlpha = 1;
          g.restore();
        }
      }
    },

    scoreTotalDur() { return this.perfect ? 3.0 : 2.6; },

    /* ---------- power meter ---------- */
    drawMeter(g) {
      const M = METER;
      D.rr(g, M.x - 10, M.y - 38, M.w + 20, M.h + 62, 14, 'rgba(255,255,255,0.9)', '#bfe3ff', 2);
      D.text(g, 'BOUNCE', M.x + M.w / 2, M.y - 20, { size: 14, color: P.blueDeep, weight: 800 });
      D.rr(g, M.x, M.y, M.w, M.h, 10, '#eaf7ff', '#bfe3ff', 2);
      // gold "perfect form" band near the top
      const zoneY = M.y + M.h * (1 - PERFECT_HI);
      const zoneH = M.h * (PERFECT_HI - PERFECT_LO);
      D.rr(g, M.x + 2, zoneY, M.w - 4, zoneH, 6, 'rgba(246,207,90,0.7)');
      D.star(g, M.x + M.w / 2, zoneY + zoneH / 2, 9, P.yellowDeep);
      // oscillating fill (rises from the bottom)
      const fh = Math.max(6, M.h * this.power);
      const inZone = this.power >= PERFECT_LO && this.power <= PERFECT_HI;
      D.rr(g, M.x + 3, M.y + M.h - fh, M.w - 6, fh, 8, inZone ? P.yellowDeep : P.blueDeep);
      // little water droplet marker at the top of the fill
      D.circle(g, M.x + M.w / 2, M.y + M.h - fh, 4, '#ffffff');
    },

    /* ---------- score phase banner + points ---------- */
    drawScorePhase(g) {
      const el = this.scoreTotalDur() - this.scoreT;
      const sc = Math.min(1, el * 4);
      if (this.bigMsg) {
        D.text(g, this.bigMsg, 480, 150, {
          size: 22 + 26 * sc, color: this.perfect ? P.pinkDeep : P.blueDeep,
          weight: 800, stroke: '#fff', strokeWidth: 9
        });
      }
      // floating "+points" near the splash
      g.save();
      g.globalAlpha = CM.clamp(this.scoreT / 0.8, 0, 1);
      D.text(g, '+' + this.lastScore, this.splashCx, 250 - el * 26, {
        size: 32, color: '#c98a1f', weight: 800, stroke: '#fff', strokeWidth: 6
      });
      g.globalAlpha = 1;
      g.restore();
      if (this.perfect) {
        D.star(g, 360, 150, 16, P.yellowDeep, CM.time * 2.5);
        D.star(g, 600, 150, 16, P.yellowDeep, -CM.time * 2.5);
      }
    },

    /* ---------- particles & ripples ---------- */
    drawRipples(g) {
      for (const r of this.ripples) {
        g.save();
        g.globalAlpha = r.life * 0.6;
        g.strokeStyle = '#ffffff';
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(r.x, r.y, r.r, r.r * 0.34, 0, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
    },

    drawParts(g) {
      for (const pt of this.parts) {
        g.globalAlpha = CM.clamp(pt.life / pt.maxLife, 0, 1);
        if (pt.type === 'star') {
          D.star(g, pt.x, pt.y, pt.size, pt.color, pt.rot);
        } else if (pt.type === 'heart') {
          D.heart(g, pt.x, pt.y, pt.size, pt.color);
        } else if (pt.type === 'foam') {
          D.circle(g, pt.x, pt.y, pt.size, pt.color);
        } else {
          // water droplet: rounded teardrop-ish circle with a shine
          D.circle(g, pt.x, pt.y, pt.size, pt.color);
          g.globalAlpha *= 0.7;
          D.circle(g, pt.x - pt.size * 0.3, pt.y - pt.size * 0.3, pt.size * 0.35, 'rgba(255,255,255,0.9)');
        }
      }
      g.globalAlpha = 1;
    },

    /* ---------- howto overlay ---------- */
    drawHowto(g) {
      g.fillStyle = 'rgba(40,70,90,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 200, 96, 560, 392, { title: '🌊 Cannonball Splash 🌊' });
      CM.drawFriend(g, 'keroppi', 296, 432, 1.3, { bob: ((CM.time * 1.2) % 1) * 0.5 });
      D.text(g, 'Keroppi', 296, 456, { size: 14, color: P.mintDeep, weight: 800 });
      D.text(g, '1. Watch the BOUNCE meter slide.', 560, 168, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '2. Tap to lock it and leap off', 560, 214, { size: 17, color: P.ink, weight: 700 });
      D.text(g, 'the board — CANNONBALL!', 560, 238, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '3. Bigger bounce = bigger splash!', 560, 284, { size: 17, color: P.ink, weight: 700 });
      D.text(g, 'Hit the gold zone for a', 560, 326, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '👑 PERFECT crown splash!', 560, 350, { size: 17, color: P.pinkDeep, weight: 800 });
      D.text(g, '6 dives · The judges love a big splash!', 480, 392, { size: 14, color: '#8aa0b0' });
      if (CM.ui.button(g, 390, 416, 200, 56, '▶ Dive in!', { color: P.mintDeep, size: 22 })) {
        this.beginCount();
      }
    }
  });
})();
