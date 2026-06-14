/* Cinnamoroll Mansion — Butterfly Catch (the meadow, hosted by My Melody) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------------- meadow layout ---------------- */
  // Keep the whole sprite on screen; reserve the top-right corner for engine chrome.
  const BOUNDS = { x1: 56, y1: 188, x2: 904, y2: 556 };
  const MELODY = { x: 80, y: 372 };     // host cheering on the left
  const SPAWN = { x: 480, y: 400 };
  const GAME_TIME = 60;
  const TARGET_FLIES = 8;
  const CATCH_DIST = 36;                  // net-vs-butterfly overlap
  const PLACE_TRIES = 22;
  const SKY_Y = 150;                      // grass starts here

  // Butterfly types. Golden is special-cased (rare, max 1 at a time).
  const TYPES = {
    common:  { value: 10, wing: '#ffd9e8', wing2: '#ffb7d5', body: '#9b7bd4' },
    pretty:  { value: 20, wing: '#bfe7ff', wing2: '#d8c9f2', body: '#4a9fdc', rainbow: true },
    golden:  { value: 40, wing: '#ffe9a8', wing2: '#ffd86a', body: '#d99a1f', shimmer: true }
  };
  // common -> rarer (no golden here; golden handled separately)
  const SPAWN_BAG = ['common', 'common', 'common', 'common', 'common', 'pretty', 'pretty'];

  // little flower decorations dotted on the grass (also soft no-spawn zones)
  const FLOWERS = [
    { x: 150, y: 300, c: '#ff9ec7' },
    { x: 300, y: 250, c: '#ffe9a8' },
    { x: 470, y: 230, c: '#d8c9f2' },
    { x: 640, y: 260, c: '#bfe7ff' },
    { x: 800, y: 300, c: '#ff9ec7' },
    { x: 230, y: 470, c: '#ffe9a8' },
    { x: 560, y: 500, c: '#ff9ec7' },
    { x: 760, y: 480, c: '#d8c9f2' }
  ];

  CM.registerGame({
    id: 'butterfly',
    name: 'Butterfly Catch',
    joystick: true,

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';          // howto -> count -> play -> done (-> finish once)
      this.timeLeft = GAME_TIME;
      this.score = 0;
      this.caught = 0;
      this.finished = false;

      this.p = { x: SPAWN.x, y: SPAWN.y, facing: 'down', phase: 0 };
      this.target = null;
      this.moving = false;
      this.netSwing = 0;             // net tilt animation (grows while moving)
      this.netFlash = 0;            // brief glow when a catch happens

      this.flies = [];
      this.parts = [];
      this.shake = 0;
      this.countT = 0;
      this.lastSeg = -1;
      this.lastTick = -1;
      this.doneT = 0;
      this.goldCd = CM.rand(5, 9);   // wait a bit before the first golden one
      this.hostBubble = { text: '', t: 0 };
      this.hostHappy = 0;            // >0 = My Melody does a happy bob

      // pet trail (optional cuteness)
      this.petTrail = [];
      this.petObj = CM.save.pet ? { x: this.p.x - 26, y: this.p.y + 6, flip: false, moving: false } : null;

      // fill the meadow
      for (let i = 0; i < TARGET_FLIES; i++) this.spawnFly(this.rollType());
    },

    exit() {},

    /* ----- spawning ----- */
    rollType() {
      const hasGold = this.flies && this.flies.some((o) => o.type === 'golden');
      if (!hasGold && this.goldCd <= 0 && Math.random() < 0.5) {
        this.goldCd = CM.rand(8, 14);
        return 'golden';
      }
      return CM.pick(SPAWN_BAG);
    },

    spotOk(x, y) {
      if (x < BOUNDS.x1 + 14 || x > BOUNDS.x2 - 14 || y < BOUNDS.y1 + 14 || y > BOUNDS.y2 - 14) return false;
      // keep clear of the engine corner (x>860, y<60) — that band is above BOUNDS anyway,
      // but stay well away from the host on the left
      if (CM.dist(x, y, MELODY.x, MELODY.y - 40) < 80) return false;
      if (CM.dist(x, y, this.p.x, this.p.y - 30) < 90) return false;
      return true;
    },

    spawnFly(type) {
      let x = SPAWN.x, y = BOUNDS.y1 + 40, ok = false;
      for (let i = 0; i < PLACE_TRIES; i++) {
        x = CM.rand(BOUNDS.x1 + 24, BOUNDS.x2 - 24);
        y = CM.rand(BOUNDS.y1 + 24, BOUNDS.y2 - 24);
        if (this.spotOk(x, y)) { ok = true; break; }
      }
      const t = TYPES[type];
      this.flies.push({
        type: type, x: x, y: y,
        value: t.value,
        // gentle wandering: a slowly-turning heading plus a bobbing phase
        ang: CM.rand(0, Math.PI * 2),
        turn: CM.rand(-1, 1),          // base turn rate (rad/s-ish)
        turnT: CM.rand(0, 3),
        speed: CM.rand(34, 58),
        flap: CM.rand(0, Math.PI * 2),  // wing-flap phase
        flapRate: CM.rand(8, 12),
        bobPh: CM.rand(0, Math.PI * 2),
        born: 0,
        flee: 0                         // 0..1 fright timer for gentle chase
      });
      return ok;
    },

    /* ----- particles ----- */
    addPart(p) { if (this.parts.length < 80) this.parts.push(p); },

    burst(x, y, color, big) {
      const n = big ? 12 : 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.addPart({
          kind: 'spark', x: x, y: y,
          vx: Math.cos(a) * CM.rand(60, big ? 165 : 115),
          vy: Math.sin(a) * CM.rand(60, big ? 165 : 115) - 30,
          t: 0, life: CM.rand(0.45, 0.8), size: CM.rand(4, big ? 10 : 7), color: color
        });
      }
      const hearts = big ? 4 : 2;
      for (let i = 0; i < hearts; i++) {
        this.addPart({
          kind: 'heart', x: x + CM.rand(-16, 16), y: y - 8,
          vx: CM.rand(-26, 26), vy: CM.rand(-120, -60),
          t: 0, life: 1.0, size: CM.rand(7, 11)
        });
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
        if (p.kind === 'spark') { p.vy += 140 * dt; p.vx *= 1 - dt * 1.1; }
        else if (p.kind === 'heart') p.vy += 26 * dt;
      }
    },

    /* ----- catch ----- */
    catchFly(fly, idx) {
      this.score += fly.value;
      this.caught++;
      const big = fly.type === 'golden';
      const mid = fly.type === 'pretty';
      this.shake = big ? 7 : (mid ? 4 : 2);
      this.netFlash = 0.35;
      CM.audio.play(big ? 'ding' : 'pop');
      if (big || mid) CM.audio.play('ding');
      this.burst(fly.x, fly.y, TYPES[fly.type].wing2, big || mid);
      this.floatText(fly.x, fly.y - 16, '+' + fly.value,
        big ? '#e0a81f' : (mid ? P.blueDeep : '#c98a1f'));
      if (big) {
        this.say('WOW!! Golden! ✨', 2.0);
        CM.audio.play('cheer');
      } else if (mid) {
        this.say('So pretty!', 1.4);
      } else {
        this.say('Got one!', 1.1);
      }
      // remove and immediately replace so the meadow stays lively
      this.flies.splice(idx, 1);
      this.spawnFly(this.rollType());
    },

    say(text, t) {
      this.hostBubble = { text: text, t: t };
      this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    beginCount() {
      this.state = 'count';
      this.countT = 0;
      this.lastSeg = -1;
      this.say('Catch them all!', 2.6);
    },

    /* ----- net tip position (where the hoop is) ----- */
    netPos() {
      // The net reaches out in the direction the player faces, a bit ahead of them.
      const f = this.p.facing;
      let dx = 0, dy = -34;
      if (f === 'left') dx = -30;
      else if (f === 'right') dx = 30;
      else if (f === 'up') { dx = 0; dy = -52; }
      else { dx = 0; dy = -14; } // down
      return { x: this.p.x + dx, y: this.p.y + dy };
    },

    update(dt) {
      const inp = CM.input;
      // only claim touches for the joystick while actually playing
      this.joystick = this.state === 'play';
      this.shake = Math.max(0, this.shake - dt * 16);
      this.netFlash = Math.max(0, this.netFlash - dt);
      if (this.hostBubble.t > 0) this.hostBubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      this.tickParts(dt);

      // butterflies always flutter (looks alive even during howto/count)
      this.updateFlies(dt);

      /* ----- howto ----- */
      if (this.state === 'howto') {
        if (inp.pressed('action')) this.beginCount();
        return;
      }

      /* ----- count-in: 3..2..1..Go ----- */
      if (this.state === 'count') {
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
        if (this.parts.length < 55 && Math.random() < 0.3) {
          this.addPart({
            kind: 'spark', x: CM.rand(140, 820), y: CM.rand(170, 380),
            vx: CM.rand(-30, 30), vy: CM.rand(-70, -20),
            t: 0, life: 0.9, size: CM.rand(6, 12),
            color: CM.pick(['#ffd9e8', '#bfe7ff', '#ffe9a8', '#d8c9f2', '#ff9ec7'])
          });
        }
        this.doneT -= dt;
        if (this.doneT <= 0 && !this.finished) {
          this.finished = true;
          CM.finishGame('butterfly', this.score, CM.clamp(Math.ceil(this.score / 15), 5, 30));
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
        this.doneT = 1.8;
        this.shake = 7;
        this.say('Lovely catching!', 3);
        CM.audio.play('tada');
        this.burst(this.p.x, this.p.y - 40, '#ffe9a8', true);
        return;
      }

      // mouse: click to walk
      if (inp.mouse.clicked) {
        this.target = {
          x: CM.clamp(inp.mouse.x, BOUNDS.x1, BOUNDS.x2),
          y: CM.clamp(inp.mouse.y, BOUNDS.y1, BOUNDS.y2),
          t: 0, stuck: 0
        };
      }

      // movement (axis takes over from a click target)
      let ax = inp.axisX();
      let ay = inp.axisY();
      if (Math.hypot(ax, ay) > 0.15) {
        this.target = null;
      } else if (this.target) {
        const dx = this.target.x - this.p.x;
        const dy = this.target.y - this.p.y;
        const d = Math.hypot(dx, dy);
        if (d > 6) { ax = dx / d; ay = dy / d; }
      }
      const len = Math.hypot(ax, ay);
      const ox = this.p.x, oy = this.p.y;
      if (len > 0.15) {
        const speed = 230 * Math.min(1, len);
        const nx = this.p.x + (ax / (len || 1)) * speed * dt;
        const ny = this.p.y + (ay / (len || 1)) * speed * dt;
        this.p.x = CM.clamp(nx, BOUNDS.x1, BOUNDS.x2);
        this.p.y = CM.clamp(ny, BOUNDS.y1, BOUNDS.y2);
        this.p.facing = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : (ay > 0 ? 'down' : 'up');
        this.p.phase = (this.p.phase + dt * 2.6) % 1 || 0.01;
        this.netSwing = Math.min(1, this.netSwing + dt * 4);
      } else {
        this.p.phase = 0;
        this.netSwing = Math.max(0, this.netSwing - dt * 4);
      }
      this.moving = Math.hypot(this.p.x - ox, this.p.y - oy) > 0.4;

      // click-target arrival + give-up-when-blocked
      if (this.target) {
        const tgt = this.target;
        tgt.t += dt;
        if (len > 0.15 && !this.moving) tgt.stuck += dt;
        else tgt.stuck = 0;
        if (CM.dist(this.p.x, this.p.y, tgt.x, tgt.y) < 6 || tgt.stuck > 0.5) this.target = null;
      }

      // catch butterflies overlapping the NET hoop
      const net = this.netPos();
      for (let i = this.flies.length - 1; i >= 0; i--) {
        const fl = this.flies[i];
        if (CM.dist(net.x, net.y, fl.x, fl.y) < CATCH_DIST) {
          this.catchFly(fl, i);
        }
      }

      // pet follows the player a few steps behind
      if (this.petObj) {
        this.petTrail.push({ x: this.p.x, y: this.p.y });
        if (this.petTrail.length > 40) this.petTrail.shift();
        const pet = this.petObj;
        const back = this.petTrail[Math.max(0, this.petTrail.length - 17)];
        const tx = back ? back.x - 4 : this.p.x - 26;
        const ty = back ? back.y + 8 : this.p.y + 6;
        const dx = tx - pet.x, dy = ty - pet.y;
        const d = Math.hypot(dx, dy);
        pet.moving = d > 8;
        if (pet.moving) {
          const sp = Math.min(d, 250 * dt);
          pet.x += (dx / d) * sp;
          pet.y += (dy / d) * sp;
          pet.flip = dx < -0.5;
        }
      }
    },

    updateFlies(dt) {
      const net = this.state === 'play' ? this.netPos() : null;
      for (const fl of this.flies) {
        fl.born += dt;
        fl.flap += dt * fl.flapRate;
        // wander: slowly drift the heading; re-pick a turn rate every few seconds
        fl.turnT -= dt;
        if (fl.turnT <= 0) {
          fl.turnT = CM.rand(1.2, 3.0);
          fl.turn = CM.rand(-1.4, 1.4);
        }
        fl.ang += fl.turn * dt;

        // gentle flee: if the net is close, the butterfly veers away a touch
        let sp = fl.speed;
        if (net) {
          const dx = fl.x - net.x, dy = fl.y - net.y;
          const dd = Math.hypot(dx, dy);
          if (dd < 110 && dd > 0.1) {
            fl.flee = Math.min(1, fl.flee + dt * 2.2);
            // steer the heading away from the net (kept gentle so kids still catch up)
            const away = Math.atan2(dy, dx);
            let diff = away - fl.ang;
            while (diff > Math.PI) diff -= Math.PI * 2;
            while (diff < -Math.PI) diff += Math.PI * 2;
            fl.ang += CM.clamp(diff, -2.5 * dt, 2.5 * dt);
            sp += fl.flee * 40;
          } else {
            fl.flee = Math.max(0, fl.flee - dt);
          }
        } else {
          fl.flee = Math.max(0, fl.flee - dt);
        }

        // bobbing path
        fl.bobPh += dt * 3;
        const bob = Math.sin(fl.bobPh) * 14 * dt;
        fl.x += Math.cos(fl.ang) * sp * dt;
        fl.y += Math.sin(fl.ang) * sp * dt + bob;

        // soft bounce off the play bounds so they stay in the meadow
        if (fl.x < BOUNDS.x1 + 12) { fl.x = BOUNDS.x1 + 12; fl.ang = Math.PI - fl.ang; }
        if (fl.x > BOUNDS.x2 - 12) { fl.x = BOUNDS.x2 - 12; fl.ang = Math.PI - fl.ang; }
        if (fl.y < BOUNDS.y1 + 12) { fl.y = BOUNDS.y1 + 12; fl.ang = -fl.ang; }
        if (fl.y > BOUNDS.y2 - 12) { fl.y = BOUNDS.y2 - 12; fl.ang = -fl.ang; }
      }
    },

    /* ---------------- butterfly art ---------------- */
    drawFly(g, fl, t) {
      const def = TYPES[fl.type];
      const s = fl.born < 0.25 ? CM.clamp(fl.born / 0.25, 0.25, 1) : 1;
      // flap: wings open/close as a horizontal squash
      const open = 0.45 + 0.55 * (0.5 + 0.5 * Math.sin(fl.flap));
      const heading = Math.cos(fl.ang) < 0 ? -1 : 1; // face travel direction (left/right)
      const wob = Math.sin(t * 2 + fl.bobPh) * 0.12;

      D.shadow(g, fl.x, fl.y + 22 * s, 12 * s);
      g.save();
      g.translate(fl.x, fl.y);
      g.scale(s * heading, s);
      g.rotate(wob);

      // rainbow / golden shimmer tints
      let wA = def.wing, wB = def.wing2;
      if (def.rainbow) {
        const hue = (t * 60 + fl.bobPh * 40) % 360;
        wA = 'hsl(' + hue + ',80%,85%)';
        wB = 'hsl(' + ((hue + 40) % 360) + ',75%,72%)';
      }

      // wings (drawn squashed horizontally to fake the flap)
      const ww = open; // wing horizontal scale
      for (const side of [-1, 1]) {
        g.save();
        g.scale(side, 1);
        // upper wing
        g.fillStyle = wA;
        g.strokeStyle = wB;
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(11 * ww, -7, 11 * ww, 10, -0.4, 0, Math.PI * 2);
        g.fill(); g.stroke();
        // lower wing
        g.fillStyle = wB;
        g.beginPath();
        g.ellipse(9 * ww, 7, 8 * ww, 8, 0.4, 0, Math.PI * 2);
        g.fill();
        // little wing dots
        g.fillStyle = 'rgba(255,255,255,0.7)';
        g.beginPath();
        g.ellipse(12 * ww, -7, 3 * ww, 3, 0, 0, Math.PI * 2);
        g.fill();
        g.restore();
      }

      // golden shimmer sparkle
      if (def.shimmer) {
        const tw = 0.5 + 0.5 * Math.sin(t * 7 + fl.bobPh);
        g.globalAlpha = 0.4 + tw * 0.4;
        D.star(g, 14 * ww, -10, 4, '#fff6c8');
        g.globalAlpha = 1;
      }

      // body
      D.ellipse(g, 0, 0, 3, 11, def.body, null, 0);
      D.circle(g, 0, -12, 4, def.body);
      // antennae
      g.strokeStyle = def.body; g.lineWidth = 1.4; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-1.5, -14); g.quadraticCurveTo(-5, -20, -7, -22);
      g.moveTo(1.5, -14); g.quadraticCurveTo(5, -20, 7, -22);
      g.stroke();
      D.circle(g, -7, -22, 1.5, def.body);
      D.circle(g, 7, -22, 1.5, def.body);
      // tiny smiley face on the head (cute!)
      D.circle(g, -1.6, -12.5, 0.9, '#3c3c3c');
      D.circle(g, 1.6, -12.5, 0.9, '#3c3c3c');

      g.restore();
    },

    /* ---------------- meadow art ---------------- */
    drawMeadow(g, t) {
      // sky band
      const sg = g.createLinearGradient(0, 0, 0, SKY_Y + 30);
      sg.addColorStop(0, '#bfe7ff');
      sg.addColorStop(1, '#e6f6ff');
      g.fillStyle = sg;
      g.fillRect(0, 0, CM.W, SKY_Y + 30);

      // sun
      D.circle(g, 96, 70, 30, '#fff3b0');
      g.globalAlpha = 0.5;
      D.circle(g, 96, 70, 40, '#fff7d0');
      g.globalAlpha = 1;

      // fluffy clouds
      this.cloud(g, 300, 56, 1);
      this.cloud(g, 640, 80, 0.8);

      // grass field
      const gg = g.createLinearGradient(0, SKY_Y, 0, CM.H);
      gg.addColorStop(0, '#bdeccd');
      gg.addColorStop(1, '#9fdcb0');
      g.fillStyle = gg;
      g.fillRect(0, SKY_Y, CM.W, CM.H - SKY_Y);
      // grass horizon line
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect(0, SKY_Y - 2, CM.W, 4);
      // rolling hill behind the fence
      g.fillStyle = '#aee3bd';
      g.beginPath();
      g.moveTo(0, SKY_Y + 18);
      g.quadraticCurveTo(240, SKY_Y - 14, 480, SKY_Y + 16);
      g.quadraticCurveTo(720, SKY_Y + 38, 960, SKY_Y + 10);
      g.lineTo(960, SKY_Y + 70);
      g.lineTo(0, SKY_Y + 70);
      g.closePath();
      g.fill();

      // wooden fence along the top of the grass
      this.fence(g, SKY_Y + 8);

      // tufts of grass blades scattered around
      g.strokeStyle = 'rgba(95,180,120,0.55)';
      g.lineWidth = 2; g.lineCap = 'round';
      for (let i = 0; i < 26; i++) {
        const bx = (i * 137 + 30) % 950;
        const by = SKY_Y + 70 + ((i * 89) % 380);
        const sw = Math.sin(t * 1.2 + i) * 2;
        g.beginPath();
        g.moveTo(bx, by); g.quadraticCurveTo(bx + sw, by - 9, bx + sw + 2, by - 14);
        g.moveTo(bx + 4, by); g.quadraticCurveTo(bx + 4 + sw, by - 8, bx + 6 + sw, by - 13);
        g.stroke();
      }
    },

    cloud(g, x, y, s) {
      g.fillStyle = 'rgba(255,255,255,0.92)';
      D.ellipse(g, x, y, 30 * s, 18 * s, 'rgba(255,255,255,0.92)');
      D.ellipse(g, x - 26 * s, y + 4 * s, 20 * s, 14 * s, 'rgba(255,255,255,0.92)');
      D.ellipse(g, x + 26 * s, y + 4 * s, 22 * s, 15 * s, 'rgba(255,255,255,0.92)');
      D.ellipse(g, x, y + 8 * s, 34 * s, 14 * s, 'rgba(255,255,255,0.92)');
    },

    fence(g, y) {
      const railA = '#e8c39a', railB = '#cf9f6f';
      // two horizontal rails
      D.rr(g, 0, y + 18, CM.W, 9, 3, railA);
      D.rr(g, 0, y + 36, CM.W, 9, 3, railA);
      // posts
      for (let x = 24; x < CM.W; x += 96) {
        D.rr(g, x, y, 14, 54, 4, railA, railB, 2);
        // pointed top
        g.fillStyle = railA;
        g.beginPath();
        g.moveTo(x, y); g.lineTo(x + 7, y - 9); g.lineTo(x + 14, y); g.closePath();
        g.fill();
      }
    },

    drawFlower(g, fw, t) {
      const sway = Math.sin(t * 1.1 + fw.x) * 2;
      // stem
      g.strokeStyle = '#7cc48c'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(fw.x, fw.y); g.quadraticCurveTo(fw.x + sway, fw.y - 12, fw.x + sway, fw.y - 22);
      g.stroke();
      const cx = fw.x + sway, cy = fw.y - 24;
      // petals
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
        D.circle(g, cx + Math.cos(a) * 6, cy + Math.sin(a) * 6, 4.5, fw.c);
      }
      D.circle(g, cx, cy, 3.5, '#ffe9a8');
    },

    draw(g) {
      const t = CM.time;
      g.save();
      if (this.shake > 0.2) {
        g.translate(CM.rand(-this.shake, this.shake) * 0.7, CM.rand(-this.shake, this.shake) * 0.7);
      }
      this.drawMeadow(g, t);

      /* ----- depth-sorted sprites ----- */
      const sprites = [];
      for (const fw of FLOWERS) sprites.push({ y: fw.y, fn: () => this.drawFlower(g, fw, t) });
      for (const fl of this.flies) sprites.push({ y: fl.y, fn: () => this.drawFly(g, fl, t) });

      // My Melody the host, cheering on the left
      sprites.push({ y: MELODY.y, fn: () => {
        const happy = this.hostHappy > 0 || this.state === 'done';
        const bob = happy ? (t * 2.4) % 1 : ((t * 0.8) % 1) * 0.35;
        CM.drawFriend(g, 'mymelody', MELODY.x, MELODY.y, 1.1, { bob: bob });
        if (this.hostHappy > 0) {
          const lift = Math.abs(Math.sin(bob * Math.PI * 2)) * 5;
          D.heart(g, MELODY.x + 24, MELODY.y - 70 - lift, 11, P.pink);
        }
        D.rr(g, MELODY.x - 44, MELODY.y + 6, 88, 19, 9, 'rgba(255,255,255,0.85)');
        D.text(g, 'My Melody', MELODY.x, MELODY.y + 16, { size: 14, color: P.ink, weight: 800 });
      } });

      // pet companion
      if (this.petObj) {
        const pet = this.petObj;
        sprites.push({ y: pet.y, fn: () => {
          CM.drawPet(g, CM.save.pet, pet.x, pet.y, 0.92, {
            bob: pet.moving ? (t * 1.8) % 1 : (CM.save.pet === 'star' ? (t * 0.8) % 1 : 0),
            flip: pet.flip
          });
        } });
      }

      // player + net
      sprites.push({ y: this.p.y, fn: () => {
        CM.drawPlayer(g, this.p.x, this.p.y, 1.05, this.p.facing, this.p.phase);
        this.drawNet(g, t);
      } });

      sprites.sort((a, b) => a.y - b.y);
      for (const s of sprites) s.fn();

      // click-to-walk target marker
      if (this.target && this.state === 'play') {
        const tg = this.target;
        const pulse = 1 - (tg.t % 0.7) / 0.7;
        g.globalAlpha = 0.3 + pulse * 0.45;
        D.circle(g, tg.x, tg.y, 7 + pulse * 10, null, P.pinkDeep, 2.5);
        D.star(g, tg.x, tg.y, 5, P.pinkDeep);
        g.globalAlpha = 1;
      }

      // My Melody speech bubble on good moments
      if (this.hostBubble.t > 0 && this.state !== 'howto') {
        const txt = this.hostBubble.text;
        const cw = Math.max(96, txt.length * 9 + 26);
        const bx = CM.clamp(MELODY.x - 10, 8, CM.W - cw - 8);
        D.bubble(g, bx, MELODY.y - 158, cw, 40, MELODY.x + 14);
        D.text(g, txt, bx + cw / 2, MELODY.y - 138, { size: 15, weight: 800, color: P.pinkDeep });
      }

      /* ----- particles ----- */
      for (const p of this.parts) {
        g.globalAlpha = Math.max(0, 1 - p.t / p.life);
        if (p.kind === 'spark') D.star(g, p.x, p.y, p.size, p.color || P.yellowDeep);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, P.pink);
        else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, { size: 20, color: p.color || '#c98a1f', weight: 800, stroke: '#ffffff', strokeWidth: 5 });
        }
      }
      g.globalAlpha = 1;

      // count-in overlay
      if (this.state === 'count') {
        const SEGS = ['3', '2', '1', 'Go!'];
        const seg = Math.min(3, Math.floor(this.countT / 0.8));
        const frac = (this.countT - seg * 0.8) / 0.8;
        const size = (seg === 3 ? 70 : 92) * (1 + 0.3 * Math.max(0, 1 - frac * 3));
        D.text(g, SEGS[seg], 480, 280, {
          size: Math.round(size), color: P.pinkDeep, weight: 800,
          stroke: '#ffffff', strokeWidth: 10
        });
      }

      g.restore();   // end screen-shake — context is back to normal

      /* ----- HUD ----- */
      if (this.state !== 'howto') {
        // big friendly countdown, top-center
        const tl = Math.max(0, Math.ceil(this.timeLeft));
        const urgent = tl <= 8 && this.state === 'play';
        const pulse = urgent ? 1 + Math.sin(t * 7) * 0.07 : 1;
        D.rr(g, 416, 10, 128, 44, 22, 'rgba(255,255,255,0.9)', urgent ? P.red : '#f0b9d2', 3);
        D.text(g, '⏱ ' + tl, 480, 33, {
          size: Math.round(27 * pulse),
          color: urgent ? P.red : P.blueDeep, weight: 800
        });
        // score, top-left
        D.rr(g, 14, 12, 158, 40, 20, 'rgba(255,255,255,0.88)', '#f0b9d2', 2);
        this.drawNetIcon(g, 32, 32);
        D.text(g, String(this.score), 116, 32, { size: 22, color: '#c98a1f', weight: 800 });
        // small control hint early on
        if (this.state === 'play' && CM.sceneTime < 12) {
          const hint = CM.touchMode ? 'Drag left side to move · or tap where to go' : 'Move: click or WASD / Arrows — swing your net!';
          D.rr(g, 286, 58, 388, 26, 13, 'rgba(255,255,255,0.55)');
          D.text(g, hint, 480, 71, { size: 14, color: '#5a8a6a' });
        }
      }

      /* ----- done banner ----- */
      if (this.state === 'done') {
        D.text(g, 'Time\'s up! 🦋', 480, 234, {
          size: 46, color: P.pinkDeep, weight: 800, stroke: '#ffffff', strokeWidth: 10
        });
        D.text(g, 'You caught ' + this.caught + ' butterflies for ' + this.score + ' points!',
          480, 282, { size: 22, color: P.ink, weight: 800, stroke: '#ffffff', strokeWidth: 6 });
        D.star(g, 250, 214 + Math.sin(t * 5) * 6, 16, P.yellowDeep);
        D.star(g, 710, 214 + Math.cos(t * 5) * 6, 16, P.yellowDeep);
      }

      /* ----- howto overlay ----- */
      if (this.state === 'howto') {
        g.fillStyle = 'rgba(70,40,70,0.25)';
        g.fillRect(0, 0, CM.W, CM.H);
        CM.ui.panel(g, 165, 92, 630, 396, { title: '🦋 Butterfly Catch 🦋' });
        CM.drawFriend(g, 'mymelody', 270, 392, 1.25, { bob: ((t * 1.1) % 1) * 0.5 });
        D.text(g, 'My Melody', 270, 416, { size: 14, color: P.pinkDeep, weight: 800 });
        D.text(g, 'The meadow is full of butterflies!', 560, 162, { size: 20, color: P.ink, weight: 800 });
        D.text(g, 'Run around and swing your net', 560, 206, { size: 17, color: P.ink });
        D.text(g, 'over them to catch them!', 560, 232, { size: 17, color: P.ink });
        D.text(g, 'Rainbow & golden ones are worth more! ✨', 560, 276, { size: 16, color: P.yellowDeep, weight: 800 });
        D.text(g, 'Catch as many as you can in 60s!', 560, 318, { size: 18, color: P.pinkDeep, weight: 800 });
        const hint = CM.touchMode ? 'Drag left side to move · or tap where to go' : 'Move: click or WASD / Arrows';
        D.text(g, hint, 560, 356, { size: 14, color: '#9a8a94' });
        if (CM.ui.button(g, 460, 398, 200, 58, '▶ Start!', { color: P.mintDeep, size: 22 })) {
          this.beginCount();
        }
      }
    },

    // little net icon for the score chip
    drawNetIcon(g, x, y) {
      g.save();
      g.translate(x, y);
      g.rotate(-0.4);
      g.strokeStyle = '#b98a5a'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 11); g.lineTo(-2, -2); g.stroke();
      D.circle(g, -3, -8, 8, 'rgba(189,236,205,0.6)', '#67c587', 2.5);
      g.restore();
    },

    // the catching net in the player's hand — a hoop on a handle that tilts while moving
    drawNet(g, t) {
      const f = this.p.facing;
      const flip = f === 'left' ? -1 : 1;
      // anchor near the player's hand
      let hx = this.p.x + flip * 16;
      let hy = this.p.y - 30;
      if (f === 'up') { hx = this.p.x + 12; hy = this.p.y - 40; }
      if (f === 'down') { hx = this.p.x + flip * 16; hy = this.p.y - 26; }

      const net = this.netPos();
      // swing/tilt wobble while moving
      const wob = Math.sin(t * 9) * 0.25 * this.netSwing;

      g.save();
      // handle from hand to hoop
      g.strokeStyle = '#b98a5a'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(hx, hy);
      g.lineTo(net.x, net.y);
      g.stroke();
      g.strokeStyle = '#9a6f44'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(hx, hy); g.lineTo(net.x, net.y); g.stroke();

      // hoop (a little ellipse, tilted by wobble) with a soft mesh fill
      g.save();
      g.translate(net.x, net.y);
      g.rotate(wob);
      const flash = this.netFlash > 0;
      D.ellipse(g, 0, 0, 17, 14, flash ? 'rgba(255,236,160,0.55)' : 'rgba(189,236,205,0.45)',
        flash ? P.yellowDeep : '#67c587', 3);
      // mesh hint
      g.strokeStyle = 'rgba(103,197,135,0.5)'; g.lineWidth = 1;
      g.beginPath();
      g.moveTo(-12, 0); g.lineTo(12, 0);
      g.moveTo(0, -11); g.lineTo(0, 11);
      g.stroke();
      // sparkle on a fresh catch
      if (flash) {
        g.globalAlpha = this.netFlash / 0.35;
        D.star(g, 8, -8, 5, '#fff6c8');
        g.globalAlpha = 1;
      }
      g.restore();
      g.restore();
    }
  });
})();
