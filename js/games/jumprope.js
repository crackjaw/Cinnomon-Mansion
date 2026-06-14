/* Cinnamoroll Mansion — Jump Rope (hosted by Kuromi) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------------- layout ----------------
     Kuromi turns one end of the rope from a post on the LEFT; the other end is
     pinned to a fence post on the RIGHT. The player stands in the MIDDLE and
     jumps. The rope sweeps an arc that dips to the ground at the player's feet. */
  const GROUND_Y = 470;             // where feet / rope-low touches
  const PIVOT_L = { x: 250, y: 300 };  // Kuromi's hand (turning pivot, left)
  const PIVOT_R = { x: 710, y: 300 };  // fence-post anchor (right)
  const PLAYER_X = 480;
  const PLAYER_FEET = GROUND_Y;
  const KUROMI = { x: 150, y: GROUND_Y };
  const PURIN = { x: 838, y: GROUND_Y };  // Pompompurin cheers from the far side

  const SESSION = 60;               // seconds of play
  const LEAD = 3.2;                 // count-in length (3..2..1..Go!)
  const POINTS_PER = 12;

  // Timing: the rope phase 0..1 is one full turn. phase ~0.5 = rope at the
  // ground in front of the player (jump moment). Window is GENEROUS and shrinks
  // only a tiny bit as the count climbs.
  const HIT_PHASE = 0.5;            // phase where rope touches the ground
  const MAX_PARTS = 70;

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'jumprope',
    name: 'Jump Rope',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';        // howto → countin → play → done
      this.t = 0;                  // play timer (counts up to SESSION)
      this.countT = 0;             // count-in timer
      this.count = 0;              // successful jumps
      this.bestStreak = 0;
      this.streak = 0;

      // rope turning
      this.ropePhase = 0;          // 0..1 looping
      this.ropePeriod = 2.05;      // seconds per turn (slow at first)
      this.prevPhase = 0;
      this.lowFired = false;       // whether we've resolved this pass at the ground

      // player hop
      this.jumpT = 0;              // >0 = mid-hop; counts down
      this.jumpDur = 0.46;
      this.tripT = 0;              // >0 = stumbling
      this.squashT = 0;            // landing squash
      this.armPhase = 0;

      // juice
      this.parts = [];
      this.floats = [];
      this.shakeT = 0;
      this.giggleT = 0;            // Kuromi "hee hee!" on a trip
      this.cheerT = 0;             // Pompompurin cheer bubble
      this.cheerMsg = '';
      this.popT = 0;               // count-number pop scale
      this.bigMsg = '';
      this.bigMsgT = 0;

      this.finished = false;
    },

    exit() {},

    begin() {
      this.state = 'countin';
      this.countT = 0;
      CM.audio.play('whoosh');
    },

    /* ================= update ================= */
    update(dt) {
      // decay timers (safe in every state)
      this.shakeT = Math.max(0, this.shakeT - dt);
      this.giggleT = Math.max(0, this.giggleT - dt);
      this.cheerT = Math.max(0, this.cheerT - dt);
      this.popT = Math.max(0, this.popT - dt);
      this.squashT = Math.max(0, this.squashT - dt);
      this.bigMsgT = Math.max(0, this.bigMsgT - dt);
      if (this.jumpT > 0) this.jumpT = Math.max(0, this.jumpT - dt);
      if (this.tripT > 0) this.tripT = Math.max(0, this.tripT - dt);
      this.armPhase = (this.armPhase + dt * 2) % 1;
      this.updateParts(dt);

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.begin();
          break;

        case 'countin':
          this.countT += dt;
          // keep the rope gently turning during the count-in so kids see the rhythm
          this.advanceRope(dt);
          if (this.countT >= LEAD) {
            this.state = 'play';
            this.t = 0;
          }
          break;

        case 'play':
          this.t += dt;
          // a jump can be requested any time; it starts a hop
          if (anyPress() && this.jumpT <= 0 && this.tripT <= 0) this.startJump();
          this.advanceRope(dt);
          // gentle, gradual speed-up as the count climbs (never harsh)
          this.ropePeriod = CM.clamp(2.05 - this.count * 0.014, 1.15, 2.05);
          if (this.t >= SESSION) {
            this.state = 'done';
            this.doneT = 0;
            this.bigMsg = '';
            CM.audio.play('tada');
            this.celebrate(30);
            this.shakeT = 0.35;
          }
          break;

        case 'done':
          this.doneT = (this.doneT || 0) + dt;
          // soft confetti rain
          if (this.parts.length < MAX_PARTS && Math.random() < 0.55) {
            this.parts.push({
              x: CM.rand(40, 920), y: -14, vx: CM.rand(-25, 25), vy: CM.rand(55, 120),
              life: 1.6, maxLife: 1.6, type: Math.random() < 0.5 ? 'heart' : 'star',
              color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
              size: CM.rand(7, 13), rot: CM.rand(0, 7), vr: CM.rand(-4, 4)
            });
          }
          if (this.doneT > 2.4 && !this.finished) {
            this.finished = true;
            CM.finishGame('jumprope', this.count * POINTS_PER,
              CM.clamp(Math.ceil(this.count * POINTS_PER / 15), 5, 30));
          }
          break;
      }
    },

    startJump() {
      this.jumpT = this.jumpDur;
      CM.audio.play('boing');
    },

    // Advance the rope phase and resolve the "rope at the ground" moment.
    advanceRope(dt) {
      this.prevPhase = this.ropePhase;
      this.ropePhase = (this.ropePhase + dt / this.ropePeriod) % 1;
      // resolve the pass exactly once as the rope sweeps DOWN past the feet
      if (this.prevPhase < HIT_PHASE && this.ropePhase >= HIT_PHASE && !this.lowFired) {
        this.lowFired = true;
        if (this.state === 'play') this.resolvePass();
      }
      // re-arm once the rope is safely away from the hit phase (handles wrap)
      if (this.ropePhase > HIT_PHASE + 0.12 || this.ropePhase < HIT_PHASE - 0.12) {
        this.lowFired = false;
      }
    },

    // Called exactly once per rope pass at the ground.
    resolvePass() {
      // Player is "clear" if they're airborne enough — i.e. in the lofted part of
      // their hop. Generous: any active hop that isn't just starting/landing counts.
      const airborne = this.jumpT > 0;
      const h = airborne ? this.hopHeight() : 0;
      const clear = h > 0.28; // needs to be reasonably up — but the window is wide

      if (clear) {
        this.count++;
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        this.popT = 0.32;
        this.squashT = 0; // they're still airborne; squash happens on land naturally
        this.burst(PLAYER_X, GROUND_Y - 6, 7);
        if (this.streak > 0 && this.streak % 10 === 0) {
          CM.audio.play('cheer');
          this.celebrate(16);
          this.shakeT = 0.2;
          this.cheerT = 1.5;
          this.cheerMsg = CM.pick(['Wow!!', 'Amazing!!', 'So good!!']);
          this.bigMsg = this.streak + ' in a row!';
          this.bigMsgT = 1.2;
          this.addFloat(PLAYER_X, GROUND_Y - 150, 'x' + this.streak + '!', P.yellowDeep, 30);
        } else {
          CM.audio.play(this.streak % 2 ? 'ding' : 'pop');
          if (this.streak % 5 === 0) {
            this.cheerT = 1.2;
            this.cheerMsg = CM.pick(['Nice!', 'Keep going!', 'Yay!']);
          }
        }
      } else {
        // gentle trip — NOT game over, the rope keeps turning
        this.streak = 0;
        this.tripT = 0.5;
        this.jumpT = 0;
        CM.audio.play('miss');
        this.giggleT = 1.1;
        this.shakeT = 0.12;
        this.addFloat(PLAYER_X, GROUND_Y - 120, CM.pick(['Oops!', 'So close!', 'Try again!']),
          P.lavenderDeep, 20);
      }
    },

    // 0..1 hop height (0 on the ground, 1 at the peak) — parabolic arc.
    hopHeight() {
      if (this.jumpT <= 0) return 0;
      const k = 1 - this.jumpT / this.jumpDur; // 0..1 through the hop
      return Math.sin(k * Math.PI);            // up then down
    },

    /* ================= juice ================= */
    spawnPart(pt) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      pt.maxLife = pt.life;
      this.parts.push(pt);
    },

    burst(x, y, n) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = CM.rand(60, 200);
        this.spawnPart({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70,
          life: CM.rand(0.4, 0.8),
          type: i % 3 === 0 ? 'heart' : (i % 3 === 1 ? 'star' : 'spark'),
          color: CM.pick([P.pink, P.pinkDeep, P.yellow, P.mintDeep, '#fff']),
          size: CM.rand(5, 11), rot: CM.rand(0, 7), vr: CM.rand(-5, 5)
        });
      }
    },

    celebrate(n) {
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: CM.rand(280, 680), y: CM.rand(120, 280),
          vx: CM.rand(-90, 90), vy: CM.rand(-190, -40),
          life: CM.rand(0.6, 1.25),
          type: Math.random() < 0.5 ? 'star' : 'heart',
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep]),
          size: CM.rand(7, 13), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
        });
      }
    },

    addFloat(x, y, text, color, size) {
      if (this.floats.length >= 16) this.floats.shift();
      this.floats.push({ x: x, y: y, text: text, color: color, size: size, t: 0, life: 0.9 });
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
      for (let i = this.floats.length - 1; i >= 0; i--) {
        const f = this.floats[i];
        f.t += dt;
        f.y -= 42 * dt;
        if (f.t >= f.life) this.floats.splice(i, 1);
      }
    },

    /* ================= rope geometry ================= */
    // The rope is an arc between the two pivots. 'phase' 0..1:
    //   phase 0.0  → rope is UP and over (high arc above the player)
    //   phase 0.5  → rope is DOWN at the ground in front of the feet
    // We draw a quadratic curve whose control point swings from high to low.
    ropeControlY(phase) {
      // swing factor: -1 (high overhead) .. +1 (low at ground)
      const swing = -Math.cos(phase * Math.PI * 2); // phase0 → -1 (up), phase.5 → +1 (down)
      const topY = 90;            // highest the rope rises
      const lowY = GROUND_Y + 30; // dips just below the feet line at the ground
      return CM.lerp(topY, lowY, (swing + 1) / 2);
    },

    /* ================= draw ================= */
    draw(g) {
      g.save();
      if (this.shakeT > 0) {
        const m = 7 * (this.shakeT / 0.35);
        g.translate(CM.rand(-m, m), CM.rand(-m, m));
      }

      this.drawScene(g);

      const playing = this.state === 'play' || this.state === 'countin' || this.state === 'done';

      // rope BEHIND when it's overhead, in FRONT when at the ground.
      const phase = this.ropePhase;
      const ropeInFront = Math.cos(phase * Math.PI * 2) < 0; // true near phase 0.5 (low/front)

      if (playing && !ropeInFront) this.drawRope(g);
      this.drawCharacters(g);
      if (playing && ropeInFront) this.drawRope(g);

      this.drawParts(g);
      this.drawFloats(g);

      g.restore(); // end shake

      /* ---- HUD (not shaken) ---- */
      if (this.state === 'play' || this.state === 'done') this.drawHUD(g);

      // Kuromi giggle on a trip
      if (this.giggleT > 0) {
        D.bubble(g, 96, GROUND_Y - 150, 140, 38, KUROMI.x);
        D.text(g, 'hee hee!', 166, GROUND_Y - 131, { size: 16, color: P.lavenderDeep, weight: 800 });
      }
      // Pompompurin cheer on good moments
      if (this.cheerT > 0 && this.cheerMsg) {
        D.bubble(g, 748, GROUND_Y - 156, 150, 40, PURIN.x);
        D.text(g, this.cheerMsg, 823, GROUND_Y - 135, { size: 16, color: '#c98a1f', weight: 800 });
      }

      // big streak banner
      if (this.bigMsgT > 0 && this.bigMsg) {
        const k = 1 - this.bigMsgT / 1.2;
        const sc = Math.min(1, (1.2 - this.bigMsgT) * 5);
        g.globalAlpha = CM.clamp(this.bigMsgT * 2, 0, 1);
        D.text(g, this.bigMsg, 480, 200 - k * 20, {
          size: 30 + 22 * sc, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 9
        });
        g.globalAlpha = 1;
      }

      // count-in overlay
      if (this.state === 'countin') this.drawCountin(g);

      // done banner
      if (this.state === 'done') {
        D.text(g, 'Great jumping!!', 480, 200, {
          size: 48, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
        });
        D.text(g, this.count + ' jumps  ·  best streak x' + this.bestStreak, 480, 250, {
          size: 22, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 5
        });
      }

      // hint bar during play
      if (this.state === 'play' && this.t < 6) {
        g.globalAlpha = CM.clamp(6 - this.t, 0, 1);
        D.rr(g, 250, 556, 460, 28, 14, 'rgba(255,255,255,0.82)');
        D.text(g, CM.touchMode ? 'Tap when the rope reaches your feet!' : 'Tap / SPACE when the rope reaches your feet!',
          480, 570, { size: 15, color: P.pinkDeep, weight: 800 });
        g.globalAlpha = 1;
      }

      if (this.state === 'howto') this.drawHowto(g);
    },

    /* ---- backyard scene ---- */
    drawScene(g) {
      // sky band
      const sky = g.createLinearGradient(0, 0, 0, 250);
      sky.addColorStop(0, '#cdeeff');
      sky.addColorStop(1, '#e9f7ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, CM.W, 250);

      // sun
      D.circle(g, 858, 70, 36, 'rgba(255,233,168,0.85)');
      D.circle(g, 858, 70, 26, '#fff3c4');

      // fluffy clouds
      this.cloud(g, 180, 70, 1.1);
      this.cloud(g, 520, 50, 0.85);
      this.cloud(g, 700, 110, 0.7);

      // distant rolling hills
      g.fillStyle = '#bfe6c4';
      g.beginPath();
      g.moveTo(0, 250);
      g.quadraticCurveTo(220, 188, 460, 240);
      g.quadraticCurveTo(700, 290, 960, 226);
      g.lineTo(960, 280);
      g.lineTo(0, 280);
      g.closePath();
      g.fill();

      // grass field
      const grass = g.createLinearGradient(0, 250, 0, CM.H);
      grass.addColorStop(0, '#9fdca0');
      grass.addColorStop(1, '#7fcd86');
      g.fillStyle = grass;
      g.fillRect(0, 250, CM.W, CM.H - 250);

      // wooden fence across the mid-back
      this.drawFence(g, 312);

      // flower dots + grass tufts scattered (fixed-ish pattern, cheap)
      for (let i = 0; i < 16; i++) {
        const fx = (i * 137 + 40) % 940;
        const fy = 360 + ((i * 89) % 200);
        if (fy > 300) this.flower(g, fx, fy, i);
      }
      // a few grass blades along the bottom
      g.strokeStyle = '#6cbf74';
      g.lineWidth = 3;
      g.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const bx = (i * 47 + 12) % 956;
        const by = 540 + (i % 3) * 14;
        g.beginPath();
        g.moveTo(bx, by);
        g.quadraticCurveTo(bx + 4, by - 14, bx + 2, by - 22);
        g.stroke();
      }

      // soft ground shadow strip where they jump
      D.shadow(g, PLAYER_X, GROUND_Y + 8, 70, 16);
    },

    cloud(g, x, y, s) {
      g.fillStyle = 'rgba(255,255,255,0.95)';
      D.ellipse(g, x, y, 34 * s, 22 * s, 'rgba(255,255,255,0.95)');
      D.ellipse(g, x - 28 * s, y + 6 * s, 24 * s, 17 * s, 'rgba(255,255,255,0.95)');
      D.ellipse(g, x + 28 * s, y + 6 * s, 26 * s, 18 * s, 'rgba(255,255,255,0.95)');
      D.ellipse(g, x, y + 12 * s, 40 * s, 16 * s, 'rgba(255,255,255,0.95)');
    },

    drawFence(g, y) {
      const railTop = y + 20, railBot = y + 40;
      // back rails
      g.fillStyle = '#e8c39a';
      g.fillRect(0, railTop, CM.W, 9);
      g.fillRect(0, railBot, CM.W, 9);
      g.strokeStyle = 'rgba(138,90,59,0.25)';
      g.lineWidth = 1.5;
      g.strokeRect(0, railTop, CM.W, 9);
      g.strokeRect(0, railBot, CM.W, 9);
      // pickets
      for (let x = 8; x < CM.W; x += 56) {
        D.rr(g, x, y, 28, 70, 5, '#f0d0a6', 'rgba(138,90,59,0.3)', 2);
        // pointed top
        g.fillStyle = '#f0d0a6';
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x + 14, y - 12);
        g.lineTo(x + 28, y);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(138,90,59,0.3)';
        g.lineWidth = 1.5;
        g.stroke();
      }
    },

    flower(g, x, y, i) {
      const cols = [P.pink, P.yellow, P.lavender, P.white];
      const c = cols[i % cols.length];
      // tiny stem
      g.strokeStyle = '#6cbf74';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y - 8);
      g.stroke();
      for (let p = 0; p < 5; p++) {
        const a = (p / 5) * Math.PI * 2;
        D.circle(g, x + Math.cos(a) * 4, (y - 12) + Math.sin(a) * 4, 3, c);
      }
      D.circle(g, x, y - 12, 2.2, P.yellowDeep);
    },

    /* ---- the swinging rope + posts ---- */
    drawRope(g) {
      const phase = this.ropePhase;
      const cy = this.ropeControlY(phase);
      // control point swings horizontally a touch too, so it feels like a real turn
      const cx = (PIVOT_L.x + PIVOT_R.x) / 2 + Math.sin(phase * Math.PI * 2) * 14;

      // rope shadow on the ground when it's low/front
      if (Math.cos(phase * Math.PI * 2) < 0) {
        const lowAmt = (-Math.cos(phase * Math.PI * 2)); // 0..1
        g.strokeStyle = 'rgba(60,40,60,0.10)';
        g.lineWidth = 8;
        g.beginPath();
        g.moveTo(PIVOT_L.x, GROUND_Y + 16);
        g.quadraticCurveTo(cx, GROUND_Y + 16 + lowAmt * 6, PIVOT_R.x, GROUND_Y + 16);
        g.stroke();
      }

      // the rope itself — chunky candy-striped cord
      g.lineCap = 'round';
      g.lineJoin = 'round';
      // outer
      g.strokeStyle = '#f06292';
      g.lineWidth = 8;
      g.beginPath();
      g.moveTo(PIVOT_L.x, PIVOT_L.y);
      g.quadraticCurveTo(cx, cy, PIVOT_R.x, PIVOT_R.y);
      g.stroke();
      // candy stripes (dashed overlay)
      g.save();
      g.setLineDash([10, 12]);
      g.strokeStyle = '#fff';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(PIVOT_L.x, PIVOT_L.y);
      g.quadraticCurveTo(cx, cy, PIVOT_R.x, PIVOT_R.y);
      g.stroke();
      g.restore();

      // rope handles (little knobs at each pivot)
      D.circle(g, PIVOT_R.x, PIVOT_R.y, 8, P.lavenderDeep, '#fff', 2);
    },

    drawCharacters(g) {
      // RIGHT fence post the rope ties to (drawn behind the knob)
      D.rr(g, PIVOT_R.x - 7, PIVOT_R.y, 14, GROUND_Y - PIVOT_R.y + 6, 5, '#e8c39a', 'rgba(138,90,59,0.3)', 2);
      D.ellipse(g, PIVOT_R.x, GROUND_Y + 6, 16, 6, 'rgba(60,40,60,0.12)');
      // little tied bow on the post
      D.circle(g, PIVOT_R.x, PIVOT_R.y, 5, P.pink);

      // Kuromi turning the rope (left). Her arm cranks around with the phase.
      const bob = ((CM.time * 1.4) % 1) * 0.4;
      CM.drawFriend(g, 'kuromi', KUROMI.x, KUROMI.y, 1.15, { bob: bob });
      // turning arm + hand at the left pivot
      const crankA = this.ropePhase * Math.PI * 2;
      const handX = PIVOT_L.x + Math.cos(crankA) * 8;
      const handY = PIVOT_L.y + Math.sin(crankA) * 8;
      g.strokeStyle = '#4d4458';
      g.lineWidth = 7;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(KUROMI.x + 18, GROUND_Y - 56);
      g.lineTo(handX, handY);
      g.stroke();
      D.circle(g, handX, handY, 7, '#fff', '#cfc7da', 2); // her paw / handle

      // The player in the middle, hopping.
      const h = this.hopHeight();
      let py = PLAYER_FEET - h * 64;   // peak hop height in px
      // gentle stumble wobble on a trip — never falls over fully
      let tilt = 0;
      if (this.tripT > 0) {
        tilt = Math.sin((0.5 - this.tripT) * 22) * 0.12 * (this.tripT / 0.5);
      }

      g.save();
      if (tilt !== 0) {
        g.translate(PLAYER_X, PLAYER_FEET);
        g.rotate(tilt);
        g.translate(-PLAYER_X, -PLAYER_FEET);
      }
      // tiny idle bob when on the ground and not tripping
      if (this.jumpT <= 0 && this.tripT <= 0) {
        py -= Math.abs(Math.sin(CM.time * 3)) * 2;
      }
      CM.drawPlayer(g, PLAYER_X, py, 1.12, 'down', 0);
      g.restore();

      // little motion lines under feet when airborne
      if (h > 0.2) {
        g.strokeStyle = 'rgba(255,255,255,0.7)';
        g.lineWidth = 3;
        g.lineCap = 'round';
        for (let i = -1; i <= 1; i++) {
          g.beginPath();
          g.moveTo(PLAYER_X + i * 14, PLAYER_FEET + 4);
          g.lineTo(PLAYER_X + i * 14, PLAYER_FEET + 4 + 8 * h);
          g.stroke();
        }
      }

      // Pompompurin cheering from the far right
      CM.drawFriend(g, 'pompompurin', PURIN.x, PURIN.y, 1.0, {
        bob: this.cheerT > 0 ? (CM.time * 2.4) % 1 : ((CM.time * 0.9) % 1) * 0.4,
        flip: true
      });
    },

    /* ---- HUD ---- */
    drawHUD(g) {
      // big jump count, centered top
      const sc = 1 + (this.popT > 0 ? (this.popT / 0.32) * 0.4 : 0);
      D.rr(g, 380, 14, 200, 70, 18, 'rgba(255,255,255,0.92)', '#f0b9d2', 3);
      D.text(g, 'JUMPS', 480, 34, { size: 15, color: '#b9a8b3', weight: 800 });
      D.text(g, String(this.count), 480, 60, {
        size: 34 * sc, color: P.pinkDeep, weight: 800
      });

      // timer (friendly countdown) on the left
      const left = Math.max(0, Math.ceil(SESSION - this.t));
      const low = left <= 10;
      D.rr(g, 14, 14, 132, 56, 16, 'rgba(255,255,255,0.9)', low ? P.yellowDeep : '#f0b9d2', low ? 3 : 2);
      D.text(g, 'Time', 80, 32, { size: 14, color: '#b9a8b3', weight: 800 });
      D.text(g, left + 's', 80, 54, { size: 24, color: low ? '#e08a1f' : P.blueDeep, weight: 800 });

      // streak chip
      if (this.streak >= 3) {
        D.rr(g, 600, 24, 140, 44, 16, 'rgba(255,233,168,0.92)', '#f0b9d2', 2);
        D.star(g, 622, 46, 11, P.yellowDeep);
        D.text(g, 'Streak ' + this.streak, 660, 47, { size: 17, color: '#c98a1f', weight: 800 });
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
    },

    drawFloats(g) {
      for (const f of this.floats) {
        g.globalAlpha = CM.clamp(1 - f.t / f.life, 0, 1);
        D.text(g, f.text, f.x, f.y, {
          size: f.size, color: f.color, weight: 800, stroke: '#fff', strokeWidth: 5
        });
      }
      g.globalAlpha = 1;
    },

    /* ---- count-in overlay (3..2..1..Go!) ---- */
    drawCountin(g) {
      const ct = this.countT;
      // 3 beats then "Go!"
      const labels = ['3', '2', '1', 'Go!'];
      const beat = LEAD / 4; // each label shows for a quarter of LEAD
      const k = CM.clamp(Math.floor(ct / beat), 0, 3);
      const frac = (ct / beat) % 1;
      g.fillStyle = 'rgba(60,80,110,0.22)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.text(g, labels[k], 480, 280, {
        size: (k === 3 ? 80 : 100) * (1.25 - frac * 0.25),
        color: k === 3 ? P.pink : '#fff',
        weight: 800, stroke: P.lavenderDeep, strokeWidth: 10
      });
      D.text(g, k === 3 ? 'Jump when the rope reaches your feet!' : 'Get ready to jump!',
        480, 360, { size: 18, color: '#fff', weight: 800, stroke: P.lavenderDeep, strokeWidth: 5 });
    },

    /* ---- how to play ---- */
    drawHowto(g) {
      g.fillStyle = 'rgba(60,80,110,0.32)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 215, 96, 530, 400, { title: '🪢 Jump Rope with Kuromi' });
      CM.drawFriend(g, 'kuromi', 300, 340, 1.25, { bob: ((CM.time * 1.2) % 1) * 0.5 });
      D.bubble(g, 232, 162, 150, 38, 300);
      D.text(g, 'Jump with me!', 307, 181, { size: 15, color: P.lavenderDeep, weight: 800 });

      D.text(g, 'Watch the big skipping rope swing.', 545, 226, { size: 18, color: P.ink, weight: 800 });
      D.text(g, CM.touchMode ? 'Tap anywhere when it reaches' : 'Tap or press SPACE when it reaches',
        545, 262, { size: 17, color: P.ink });
      D.text(g, 'your feet — and HOP over it!', 545, 288, { size: 17, color: P.ink });
      D.text(g, 'Time it right to keep a big streak!', 545, 326, { size: 16, color: P.pinkDeep, weight: 800 });
      D.text(g, '60 seconds · just have fun jumping!', 480, 372, { size: 14, color: '#9a8a94' });

      if (CM.ui.button(g, 375, 414, 210, 56, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.begin();
        return;
      }
      if (!CM.touchMode) {
        D.text(g, 'or press SPACE', 480, 484, { size: 14, color: '#e7def5' });
      }
    }
  });
})();
