/* Cinnamoroll Mansion — Kite Flying (hosted by Cinnamoroll) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------------- layout ----------------
     The kite flies in a vertical "play column". The sky scrolls DOWNWARD while
     the kite climbs, so altitude = how far we've scrolled. The player only
     steers the kite LEFT/RIGHT; vertical climb is automatic and constant. */
  const PLAY = { x1: 70, x2: 890 };        // kite horizontal bounds
  const KITE_Y = 250;                       // kite's fixed screen height
  const GROUND_Y = 470;                     // grass line (only seen at the start)
  const GAME_TIME = 60;
  const CLIMB = 150;                         // base scroll speed (world units / s)
  const STEER = 360;                         // horizontal steer speed (units / s)
  const MAX_PARTS = 110;
  const CINNA = { x: 832, y: 250 };          // Cinnamoroll floats by on the right

  // Collectible / hazard kinds. value 0 = no points (cloud is a soft slow).
  const KINDS = {
    ring: { value: 10, r: 34 },
    star: { value: 25, r: 20 },
    gust: { value: 18, r: 26 },
    cloud: { value: 0, r: 40 }
  };

  CM.registerGame({
    id: 'kite',
    name: 'Kite Flying',
    // NOTE: no joystick flag — we steer with mouse halves + arrows, not the
    // walk-around touch joystick.

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';     // howto -> count -> fly -> done (-> finish once)
      this.timeLeft = GAME_TIME;
      this.score = 0;
      this.altitude = 0;        // total world units climbed
      this.collected = 0;       // rings/stars/gusts grabbed (for the end banner)
      this.altBonus = 0;        // set when the timer ends; reset here for Play Again safety
      this.finished = false;

      // kite physics
      this.kx = (PLAY.x1 + PLAY.x2) / 2;
      this.kvx = 0;             // smoothed horizontal velocity (for kite tilt)
      this.boost = 0;           // wind-gust speed boost, decays over time
      this.slow = 0;            // cloud slow-down, decays over time
      this.tailWave = 0;        // ribbon-tail animation phase

      // scrolling field of world objects (y is in WORLD coords; screen y derived)
      this.objs = [];
      this.spawnY = -200;       // next world-y to populate downward (upward in sky)
      this.parts = [];
      this.shake = 0;
      this.countT = 0;
      this.lastSeg = -1;
      this.lastTick = -1;
      this.doneT = 0;
      this.flash = 0;           // brief white "grab" flash alpha

      this.hostBubble = { text: '', t: 0 };
      this.hostHappy = 0;
      this.cheerCd = 0;

      // pre-seed a few easy rings just above the kite so the first seconds feel good
      for (let i = 0; i < 7; i++) this.spawnRow();
    },

    exit() {},

    /* ----- spawning -----
       Objects are spawned at decreasing world-y (higher in the sky). As the kite
       climbs (altitude grows), they scroll down past it. We keep a comfortable
       buffer of upcoming rows above the visible top. */
    spawnRow() {
      // worldY grows more negative as we climb; place the next row above the last
      const gap = CM.rand(120, 175);
      this.spawnY -= gap;
      const y = this.spawnY;

      // choose what to drop in this row (mostly rings, a sprinkle of treats)
      const roll = Math.random();
      let kind;
      if (roll < 0.50) kind = 'ring';
      else if (roll < 0.68) kind = 'star';
      else if (roll < 0.82) kind = 'gust';
      else kind = 'cloud';

      const def = KINDS[kind];
      const x = CM.rand(PLAY.x1 + def.r + 10, PLAY.x2 - def.r - 10);
      this.objs.push({
        kind: kind, x: x, worldY: y, r: def.r,
        ph: CM.rand(0, Math.PI * 2),
        sway: CM.rand(18, 46),        // gentle horizontal drift amplitude
        swaySpd: CM.rand(0.5, 1.1),
        hit: false, pop: 0
      });

      // clouds sometimes come in friendly little pairs
      if (kind === 'cloud' && Math.random() < 0.4) {
        const x2 = CM.clamp(x + CM.rand(-180, 180), PLAY.x1 + 50, PLAY.x2 - 50);
        this.objs.push({
          kind: 'cloud', x: x2, worldY: y - CM.rand(20, 50), r: CM.rand(30, 46),
          ph: CM.rand(0, Math.PI * 2), sway: CM.rand(10, 30), swaySpd: CM.rand(0.4, 0.9),
          hit: false, pop: 0
        });
      }
    },

    // current on-screen x of an object (with its gentle sway)
    objScreenX(o, t) {
      return o.x + Math.sin(t * o.swaySpd + o.ph) * o.sway;
    },
    // on-screen y: KITE_Y when worldY == -altitude (i.e. level with the kite)
    objScreenY(o) {
      return KITE_Y + (o.worldY + this.altitude);
    },

    /* ----- particles ----- */
    addPart(p) { if (this.parts.length < MAX_PARTS) this.parts.push(p); },

    burst(x, y, color, big) {
      const n = big ? 13 : 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.addPart({
          kind: 'spark', x: x, y: y,
          vx: Math.cos(a) * CM.rand(60, big ? 180 : 130),
          vy: Math.sin(a) * CM.rand(60, big ? 180 : 130) - 30,
          t: 0, life: CM.rand(0.45, 0.85), size: CM.rand(4, big ? 10 : 7), color: color
        });
      }
      const hearts = big ? 4 : 2;
      for (let i = 0; i < hearts; i++) {
        this.addPart({
          kind: 'heart', x: x + CM.rand(-16, 16), y: y - 8,
          vx: CM.rand(-28, 28), vy: CM.rand(-130, -60),
          t: 0, life: 1.0, size: CM.rand(7, 11)
        });
      }
    },

    floatText(x, y, str, color) {
      this.addPart({ kind: 'txt', x: x, y: y, str: str, color: color, vx: 0, vy: -40, t: 0, life: 1.0 });
    },

    tickParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.t += dt;
        if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'spark') { p.vy += 150 * dt; p.vx *= 1 - dt * 1.1; }
        else if (p.kind === 'heart') p.vy += 26 * dt;
        else if (p.kind === 'txt') p.vy *= 1 - dt * 0.6;
      }
    },

    /* ----- collecting ----- */
    grab(o) {
      const def = KINDS[o.kind];
      o.hit = true;
      o.pop = 0.001;
      const x = this.lastObjX || o.x, y = this.objScreenY(o);

      if (o.kind === 'cloud') {
        // NOT a fail — just a soft momentary slow + a puff. Never a crash.
        this.slow = Math.min(0.55, this.slow + 0.35);
        CM.audio.play('whoosh');
        this.puff(x, y);
        return;
      }

      this.score += def.value;
      this.collected++;
      this.flash = Math.min(0.5, this.flash + 0.3);

      if (o.kind === 'gust') {
        this.boost = Math.min(1, this.boost + 0.8);  // ride the wind upward!
        this.shake = Math.max(this.shake, 3);
        CM.audio.play('whoosh');
        CM.audio.tone(660, 0.12, 'sine', 0.1, 0, 1180);
        this.burst(x, y, P.mint, false);
        this.floatText(x, y - 14, '+' + def.value, P.mintDeep);
        this.maybeSay('Whee!', 1.0);
      } else if (o.kind === 'star') {
        this.shake = Math.max(this.shake, 5);
        CM.audio.play('ding');
        this.burst(x, y, P.yellow, true);
        this.floatText(x, y - 14, '+' + def.value, '#e0a81f');
        this.maybeSay('Wow!! ✨', 1.4);
      } else { // ring
        CM.audio.play('coin');
        this.burst(x, y, P.pink, false);
        this.floatText(x, y - 14, '+' + def.value, P.pinkDeep);
        this.maybeSay('Nice!', 0.9);
      }
    },

    puff(x, y) {
      for (let i = 0; i < 7; i++) {
        const a = CM.rand(0, Math.PI * 2);
        this.addPart({
          kind: 'puff', x: x, y: y,
          vx: Math.cos(a) * CM.rand(30, 80), vy: Math.sin(a) * CM.rand(20, 60) - 20,
          t: 0, life: CM.rand(0.5, 0.9), size: CM.rand(8, 16)
        });
      }
    },

    maybeSay(text, t) {
      this.hostHappy = Math.max(this.hostHappy, 1.0);
      if (this.cheerCd > 0) return;
      this.cheerCd = 1.1;            // don't spam bubbles on dense pickups
      this.hostBubble = { text: text, t: t };
    },

    beginCount() {
      this.state = 'count';
      this.countT = 0;
      this.lastSeg = -1;
    },

    /* ================= update ================= */
    update(dt) {
      const inp = CM.input;
      this.shake = Math.max(0, this.shake - dt * 16);
      this.flash = Math.max(0, this.flash - dt * 2);
      this.boost = Math.max(0, this.boost - dt * 0.9);
      this.slow = Math.max(0, this.slow - dt * 0.7);
      this.cheerCd = Math.max(0, this.cheerCd - dt);
      this.tailWave += dt * 6;
      if (this.hostBubble.t > 0) this.hostBubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      this.tickParts(dt);

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
          this.state = 'fly';
          this.lastTick = -1;
          this.maybeSay('Catch the rings!', 2.2);
        }
        return;
      }

      /* ----- done: brief celebrate, then finish exactly once ----- */
      if (this.state === 'done') {
        if (this.parts.length < 70 && Math.random() < 0.3) {
          this.addPart({
            kind: 'spark', x: CM.rand(120, 840), y: CM.rand(120, 340),
            vx: CM.rand(-30, 30), vy: CM.rand(-70, -20),
            t: 0, life: 0.9, size: CM.rand(6, 12),
            color: CM.pick([P.pink, P.yellow, P.mint, P.lavender, P.white])
          });
        }
        this.doneT -= dt;
        if (this.doneT <= 0 && !this.finished) {
          this.finished = true;
          CM.finishGame('kite', this.score, CM.clamp(Math.ceil(this.score / 15), 5, 30));
        }
        return;
      }

      /* ===================== fly ===================== */
      this.timeLeft -= dt;
      const tl = Math.ceil(this.timeLeft);
      if (tl <= 8 && tl >= 1 && tl !== this.lastTick) {
        this.lastTick = tl;
        CM.audio.tone(820, 0.06, 'sine', 0.06);
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        // altitude bonus: a gentle reward for climbing high
        this.altBonus = Math.round(this.altitude / 40);
        this.score += this.altBonus;
        this.state = 'done';
        this.doneT = 2.0;
        this.shake = 7;
        this.maybeSay('Wonderful flying!', 3);
        CM.audio.play('tada');
        this.burst(this.kx, KITE_Y, P.yellow, true);
        return;
      }

      // --- steering ---
      // keyboard arrows / A-D
      let dir = inp.axisX();
      // OR mouse/touch: hold either half of the screen to glide that way
      if (Math.abs(dir) < 0.05 && inp.mouse.down && inp.mouse.x > -500) {
        const cx = (PLAY.x1 + PLAY.x2) / 2;
        dir = inp.mouse.x < cx ? -1 : 1;
        // ease near the centre so a tap dead-on doesn't twitch
        const off = Math.abs(inp.mouse.x - cx);
        if (off < 24) dir = 0;
      }
      const speed = STEER * (1 - this.slow * 0.6);
      this.kx += dir * speed * dt;
      this.kvx = CM.lerp(this.kvx, dir * speed, Math.min(1, dt * 8));
      // soft walls — bonk gently, never go off screen
      if (this.kx < PLAY.x1) { this.kx = PLAY.x1; this.kvx = 0; }
      if (this.kx > PLAY.x2) { this.kx = PLAY.x2; this.kvx = 0; }

      // --- climbing (scroll the world down) ---
      const climbSpd = CLIMB * (1 + this.boost * 1.1) * (1 - this.slow * 0.5);
      this.altitude += climbSpd * dt;

      // keep the upcoming sky populated (rows live above the visible top)
      // spawnY is the highest (most negative) populated world-y; ensure it stays
      // comfortably above the kite as we climb.
      while (this.spawnY > -this.altitude - 800) this.spawnRow();

      // --- collisions + cull ---
      const grabR = 30;          // kite catch radius (generous & forgiving)
      const t = CM.time;
      for (let i = this.objs.length - 1; i >= 0; i--) {
        const o = this.objs[i];
        const sy = this.objScreenY(o);
        // remove objects that scrolled well below the screen
        if (sy > CM.H + 120) { this.objs.splice(i, 1); continue; }
        if (o.hit) {
          o.pop += dt;
          if (o.pop > 0.35) this.objs.splice(i, 1);
          continue;
        }
        const sx = this.objScreenX(o, t);
        // only catchable when roughly level with the kite
        if (Math.abs(sy - KITE_Y) < o.r + 18 && CM.dist(sx, sy, this.kx, KITE_Y) < o.r + grabR) {
          this.lastObjX = sx;
          this.grab(o);
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

      this.drawSky(g, t);
      this.drawGroundIfLow(g, t);

      /* ----- scrolling objects (depth doesn't matter much; draw clouds last) ----- */
      const ahead = [];
      for (const o of this.objs) {
        const sy = this.objScreenY(o);
        if (sy < -90 || sy > CM.H + 90) continue;
        ahead.push(o);
      }
      // non-clouds first, clouds drawn over so the kite tucks behind a puff
      for (const o of ahead) if (o.kind !== 'cloud') this.drawObj(g, o, t);

      // the kite (+ string down to the player) under the clouds
      this.drawString(g);
      this.drawKite(g, t);

      for (const o of ahead) if (o.kind === 'cloud') this.drawObj(g, o, t);

      // Cinnamoroll floating by on a little cloud, cheering
      this.drawHost(g, t);

      // player holds the string at the bottom (only visible while low)
      this.drawPlayer(g, t);

      /* ----- particles ----- */
      for (const p of this.parts) {
        g.globalAlpha = Math.max(0, 1 - p.t / p.life);
        if (p.kind === 'spark') D.star(g, p.x, p.y, p.size, p.color || P.yellowDeep);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, P.pink);
        else if (p.kind === 'puff') D.circle(g, p.x, p.y, p.size, 'rgba(255,255,255,0.85)');
        else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, { size: 22, color: p.color || '#c98a1f', weight: 800, stroke: '#fff', strokeWidth: 5 });
        }
      }
      g.globalAlpha = 1;

      // grab flash
      if (this.flash > 0.01) {
        g.fillStyle = 'rgba(255,255,255,' + (this.flash * 0.5) + ')';
        g.fillRect(0, 0, CM.W, CM.H);
      }

      // count-in overlay
      if (this.state === 'count') {
        const SEGS = ['3', '2', '1', 'Go!'];
        const seg = Math.min(3, Math.floor(this.countT / 0.8));
        const frac = (this.countT - seg * 0.8) / 0.8;
        const size = (seg === 3 ? 70 : 92) * (1 + 0.3 * Math.max(0, 1 - frac * 3));
        D.text(g, SEGS[seg], 480, 260, {
          size: Math.round(size), color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
        });
      }

      g.restore();   // end screen-shake — context is back to normal

      /* ----- HUD ----- */
      this.drawHud(g, t);

      /* ----- done banner ----- */
      if (this.state === 'done') {
        D.text(g, 'Time\'s up! 🎉', 480, 200, {
          size: 46, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
        });
        D.text(g, 'You caught ' + this.collected + ' goodies!', 480, 250, {
          size: 24, color: P.ink, weight: 800, stroke: '#fff', strokeWidth: 6
        });
        if (this.altBonus > 0) {
          D.text(g, '+ ' + this.altBonus + ' altitude bonus!', 480, 286, {
            size: 20, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6
          });
        }
        D.star(g, 250, 200 + Math.sin(t * 5) * 6, 16, P.yellowDeep);
        D.star(g, 710, 200 + Math.cos(t * 5) * 6, 16, P.yellowDeep);
      }

      /* ----- howto overlay ----- */
      if (this.state === 'howto') this.drawHowto(g, t);
    },

    /* ---------------- sky + scenery ---------------- */
    drawSky(g, t) {
      const grad = g.createLinearGradient(0, 0, 0, CM.H);
      grad.addColorStop(0, '#bfe7ff');
      grad.addColorStop(0.6, '#d8f2ff');
      grad.addColorStop(1, '#eafaff');
      g.fillStyle = grad;
      g.fillRect(0, 0, CM.W, CM.H);

      // a warm sun in the corner (kept clear of the engine chrome at top-right)
      D.circle(g, 96, 92, 40, 'rgba(255,243,176,0.9)');
      D.circle(g, 96, 92, 28, '#fff3b0');
      g.strokeStyle = 'rgba(255,243,176,0.6)';
      g.lineWidth = 4; g.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = t * 0.3 + (i / 8) * Math.PI * 2;
        g.beginPath();
        g.moveTo(96 + Math.cos(a) * 48, 92 + Math.sin(a) * 48);
        g.lineTo(96 + Math.cos(a) * 60, 92 + Math.sin(a) * 60);
        g.stroke();
      }

      // a couple of slow far-away decorative clouds (parallax, non-interactive)
      const drift = (this.altitude * 0.12) % (CM.W + 260);
      this.bgCloud(g, ((220 - drift) + CM.W + 260) % (CM.W + 260) - 130, 130, 1.0);
      this.bgCloud(g, ((640 - drift) + CM.W + 260) % (CM.W + 260) - 130, 200, 0.8);
      this.bgCloud(g, ((900 - drift) + CM.W + 260) % (CM.W + 260) - 130, 90, 0.7);

      // faint twinkles to give the climb a sense of motion
      g.fillStyle = 'rgba(255,255,255,0.5)';
      for (let i = 0; i < 10; i++) {
        const sx = (i * 173 + 40) % CM.W;
        const sy = ((i * 211 + this.altitude * 0.5) % (CM.H + 80)) - 40;
        const tw = 0.5 + 0.5 * Math.sin(t * 3 + i);
        if (tw > 0.6) {
          g.globalAlpha = (tw - 0.6) / 0.4;
          D.star(g, sx, sy, 4, '#ffffff');
        }
      }
      g.globalAlpha = 1;
    },

    bgCloud(g, x, y, s) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.fillStyle = 'rgba(255,255,255,0.55)';
      D.ellipse(g, 0, 0, 46, 26, 'rgba(255,255,255,0.55)');
      D.ellipse(g, -34, 6, 28, 18, 'rgba(255,255,255,0.55)');
      D.ellipse(g, 34, 6, 30, 18, 'rgba(255,255,255,0.55)');
      g.restore();
    },

    // The grass/playground only shows for the first few seconds of climbing.
    drawGroundIfLow(g, t) {
      const gy = GROUND_Y + this.altitude; // scrolls down out of view as we climb
      if (gy > CM.H + 160) return;
      g.save();
      // green grass + woodchip strip
      g.fillStyle = '#a8e0a0';
      g.fillRect(0, gy, CM.W, CM.H - gy + 160);
      g.fillStyle = '#8fd389';
      for (let x = 0; x < CM.W; x += 26) {
        g.beginPath();
        g.moveTo(x, gy);
        g.lineTo(x + 8, gy - 12 - (x % 3) * 2);
        g.lineTo(x + 16, gy);
        g.closePath();
        g.fill();
      }
      // woodchip playground patch
      D.ellipse(g, 480, gy + 70, 260, 50, '#e8c39a', '#cf9f6e', 3);
      // a low pastel fence behind the grass line
      const fy = gy - 6;
      g.strokeStyle = '#f2d6b0';
      for (let x = 30; x < CM.W; x += 60) {
        D.rr(g, x, fy - 40, 16, 44, 4, '#ffe7c8', '#e6c098', 2);
      }
      D.rr(g, 0, fy - 18, CM.W, 10, 4, '#ffe7c8', '#e6c098', 2);
      // a little slide as play equipment
      D.rr(g, 150, gy + 8, 16, 70, 6, '#9ec9ee');
      g.strokeStyle = '#7fb0dd'; g.lineWidth = 10; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(158, gy + 14);
      g.quadraticCurveTo(190, gy + 80, 250, gy + 92);
      g.stroke();
      g.restore();
    },

    /* ---------------- objects ---------------- */
    drawObj(g, o, t) {
      const x = this.objScreenX(o, t);
      const y = this.objScreenY(o);
      const pop = o.hit ? (1 - o.pop / 0.35) : 1;
      if (pop <= 0) return;
      g.save();
      g.translate(x, y);
      const bob = Math.sin(t * 2.4 + o.ph) * 3;
      g.translate(0, bob);
      g.globalAlpha = o.hit ? Math.max(0, pop) : 1;
      const grow = o.hit ? CM.lerp(1, 1.5, 1 - pop) : 1;
      g.scale(grow, grow);

      if (o.kind === 'ring') {
        // glowing pastel ring to fly through
        const tw = 0.5 + 0.5 * Math.sin(t * 3 + o.ph);
        g.globalAlpha *= 0.4 + tw * 0.3;
        D.circle(g, 0, 0, o.r + 5, null, '#fff', 6);
        g.globalAlpha = o.hit ? Math.max(0, pop) : 1;
        D.circle(g, 0, 0, o.r, null, P.pink, 9);
        D.circle(g, 0, 0, o.r, null, P.pinkDeep, 3);
        // sparkle accents around the ring
        for (let i = 0; i < 3; i++) {
          const a = t * 1.5 + (i / 3) * Math.PI * 2;
          D.star(g, Math.cos(a) * o.r, Math.sin(a) * o.r, 4, '#fff');
        }
      } else if (o.kind === 'star') {
        const tw = 0.5 + 0.5 * Math.sin(t * 4 + o.ph);
        g.globalAlpha *= 0.35 + tw * 0.25;
        D.star(g, 0, 0, o.r * 1.6, '#fff3b0');
        g.globalAlpha = o.hit ? Math.max(0, pop) : 1;
        D.star(g, 0, 0, o.r + 2, '#e8be3a', t * 1.2);
        D.star(g, 0, 0, o.r, P.yellow, t * 1.2);
        D.circle(g, -o.r * 0.25, -o.r * 0.25, o.r * 0.18, 'rgba(255,255,255,0.9)');
      } else if (o.kind === 'gust') {
        // a cute swirl of wind (mint) — a speed boost
        g.strokeStyle = P.mintDeep;
        g.lineWidth = 5; g.lineCap = 'round';
        g.beginPath();
        for (let a = 0; a < Math.PI * 3.2; a += 0.25) {
          const rr = o.r * (a / (Math.PI * 3.2));
          const px = Math.cos(a + t * 3) * rr;
          const py = Math.sin(a + t * 3) * rr;
          if (a === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.stroke();
        D.circle(g, 0, 0, 5, P.mint, P.mintDeep, 2);
        // little leaves zipping around it
        for (let i = 0; i < 3; i++) {
          const a = t * 4 + (i / 3) * Math.PI * 2;
          D.ellipse(g, Math.cos(a) * (o.r + 6), Math.sin(a) * (o.r + 6), 4, 2.5, '#bdeccd');
        }
      } else if (o.kind === 'cloud') {
        // soft fluffy cloud (no points — just slows you a moment)
        g.fillStyle = '#ffffff';
        D.ellipse(g, 0, 2, o.r, o.r * 0.62, '#ffffff', 'rgba(180,210,235,0.6)', 2);
        D.ellipse(g, -o.r * 0.6, o.r * 0.18, o.r * 0.55, o.r * 0.4, '#ffffff');
        D.ellipse(g, o.r * 0.6, o.r * 0.18, o.r * 0.6, o.r * 0.42, '#ffffff');
        D.ellipse(g, -o.r * 0.2, -o.r * 0.3, o.r * 0.5, o.r * 0.4, '#ffffff');
        // sleepy face so it reads as friendly, not an enemy
        g.strokeStyle = 'rgba(120,150,175,0.8)'; g.lineWidth = 2.4; g.lineCap = 'round';
        g.beginPath(); g.arc(-7, 0, 3.4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
        g.beginPath(); g.arc(7, 0, 3.4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
        g.fillStyle = 'rgba(255,160,180,0.45)';
        D.circle(g, -12, 8, 4, 'rgba(255,160,180,0.45)');
        D.circle(g, 12, 8, 4, 'rgba(255,160,180,0.45)');
      }
      g.restore();
    },

    /* ---------------- the kite ---------------- */
    drawString(g) {
      // string from the kite down to the player's hands at the bottom
      if (this.state === 'howto') return;
      const px = CM.clamp(this.kx, PLAY.x1 + 40, PLAY.x2 - 40);
      g.strokeStyle = 'rgba(120,100,120,0.55)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(this.kx, KITE_Y + 16);
      // gentle catenary sag toward the player's hand
      const handY = CM.H - 78;
      const midX = (this.kx + (px * 0.4 + 480 * 0.6)) / 2;
      g.quadraticCurveTo(midX, (KITE_Y + handY) / 2 + 28, 470, handY);
      g.stroke();
    },

    drawKite(g, t) {
      if (this.state === 'howto') return;
      const tilt = CM.clamp(this.kvx / STEER, -1, 1) * 0.4;
      const bobY = Math.sin(t * 2.5) * 4;
      g.save();
      g.translate(this.kx, KITE_Y + bobY);
      g.rotate(tilt);

      // ribbon tail trailing down-behind, waving
      g.strokeStyle = P.pinkDeep;
      g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath();
      let tx = 0, ty = 26;
      g.moveTo(tx, ty);
      for (let i = 1; i <= 6; i++) {
        const seg = i / 6;
        const nx = Math.sin(this.tailWave - i * 0.7) * 10 * seg - tilt * 30 * seg;
        const ny = 26 + i * 16;
        g.lineTo(nx, ny);
        tx = nx; ty = ny;
      }
      g.stroke();
      // little bows on the tail
      const bowCols = [P.yellow, P.mint, P.lavender];
      for (let i = 1; i <= 3; i++) {
        const seg = (i * 2) / 6;
        const nx = Math.sin(this.tailWave - i * 1.4) * 10 * seg - tilt * 30 * seg;
        const ny = 26 + i * 32;
        this.drawBow(g, nx, ny, bowCols[(i - 1) % 3]);
      }

      // diamond kite body
      const w = 30, h = 42;
      g.beginPath();
      g.moveTo(0, -h);
      g.lineTo(w, 0);
      g.lineTo(0, h * 0.6);
      g.lineTo(-w, 0);
      g.closePath();
      // four pastel panels
      const grad = g.createLinearGradient(-w, -h, w, h);
      grad.addColorStop(0, P.sky);
      grad.addColorStop(1, P.blue);
      g.fillStyle = grad;
      g.fill();
      // panel split lines
      g.strokeStyle = 'rgba(255,255,255,0.85)';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, -h); g.lineTo(0, h * 0.6);
      g.moveTo(-w, 0); g.lineTo(w, 0);
      g.stroke();
      // top + bottom accent panels in pink
      g.fillStyle = 'rgba(255,158,199,0.85)';
      g.beginPath();
      g.moveTo(0, -h); g.lineTo(w, 0); g.lineTo(0, 0); g.closePath(); g.fill();
      g.beginPath();
      g.moveTo(0, h * 0.6); g.lineTo(-w, 0); g.lineTo(0, 0); g.closePath(); g.fill();
      // outline
      g.strokeStyle = '#fff';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(0, -h); g.lineTo(w, 0); g.lineTo(0, h * 0.6); g.lineTo(-w, 0); g.closePath();
      g.stroke();
      // a cute little face in the centre
      D.circle(g, -6, -4, 2.2, P.ink);
      D.circle(g, 6, -4, 2.2, P.ink);
      g.strokeStyle = P.ink; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.arc(0, -1, 4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      g.fillStyle = 'rgba(255,140,160,0.5)';
      D.circle(g, -11, 1, 3, 'rgba(255,140,160,0.5)');
      D.circle(g, 11, 1, 3, 'rgba(255,140,160,0.5)');

      // boost glow when riding a gust
      if (this.boost > 0.05) {
        g.globalAlpha = this.boost * 0.6;
        for (let i = 0; i < 3; i++) {
          D.star(g, CM.rand(-w, w), h + 10 + i * 10, CM.rand(4, 8), P.mint);
        }
        g.globalAlpha = 1;
      }
      g.restore();
    },

    drawBow(g, x, y, color) {
      g.save();
      g.translate(x, y);
      g.fillStyle = color;
      g.beginPath();
      g.moveTo(0, 0); g.lineTo(-7, -4); g.lineTo(-7, 4); g.closePath(); g.fill();
      g.beginPath();
      g.moveTo(0, 0); g.lineTo(7, -4); g.lineTo(7, 4); g.closePath(); g.fill();
      D.circle(g, 0, 0, 2, color);
      g.restore();
    },

    /* ---------------- host + player ---------------- */
    drawHost(g, t) {
      // Cinnamoroll floats by on his own little cloud, gently bobbing
      const happy = this.hostHappy > 0 || this.state === 'done';
      const fy = CINNA.y + Math.sin(t * 1.4) * 14;
      // his cloud
      g.save();
      D.ellipse(g, CINNA.x, fy + 50, 54, 22, '#ffffff', 'rgba(180,210,235,0.5)', 2);
      D.ellipse(g, CINNA.x - 34, fy + 56, 26, 14, '#ffffff');
      D.ellipse(g, CINNA.x + 34, fy + 56, 28, 14, '#ffffff');
      g.restore();
      CM.drawFriend(g, 'cinnamoroll', CINNA.x, fy + 44, 1.05, {
        bob: happy ? (t * 2.4) % 1 : ((t * 0.9) % 1) * 0.4,
        flip: true, shadow: false
      });

      // speech bubble on good moments
      if (this.hostBubble.t > 0 && this.state !== 'howto') {
        const txt = this.hostBubble.text;
        const cw = Math.max(96, txt.length * 9 + 26);
        const bx = CM.clamp(CINNA.x - cw + 30, 8, CM.W - cw - 8);
        D.bubble(g, bx, fy - 78, cw, 40, CINNA.x - 6);
        D.text(g, txt, bx + cw / 2, fy - 58, { size: 15, weight: 800, color: P.pinkDeep });
      }
    },

    drawPlayer(g, t) {
      // the kid stands at the bottom holding the string — only while near the ground
      const gy = GROUND_Y + this.altitude;
      const standY = Math.min(CM.H - 8, gy + 92);
      if (standY > CM.H + 80) return;       // climbed too high; player off-screen
      // hands reach up toward the string
      CM.drawPlayer(g, 470, standY, 1.0, 'up', 0);
      // little raised-arm string holder dot
      g.fillStyle = 'rgba(120,100,120,0.55)';
      D.circle(g, 470, standY - 78, 2.5, 'rgba(120,100,120,0.7)');
    },

    /* ---------------- HUD ---------------- */
    drawHud(g, t) {
      if (this.state === 'howto') return;
      // big friendly countdown, top-center
      const tl = Math.max(0, Math.ceil(this.timeLeft));
      const urgent = tl <= 8 && this.state === 'fly';
      const pulse = urgent ? 1 + Math.sin(t * 7) * 0.07 : 1;
      D.rr(g, 416, 10, 128, 44, 22, 'rgba(255,255,255,0.9)', urgent ? P.red : '#f0b9d2', 3);
      D.text(g, '⏱ ' + tl, 480, 33, {
        size: Math.round(27 * pulse), color: urgent ? P.red : P.blueDeep, weight: 800
      });

      // score, top-left
      D.rr(g, 14, 12, 160, 44, 20, 'rgba(255,255,255,0.88)', '#f0b9d2', 2);
      D.star(g, 36, 34, 11, P.yellowDeep);
      D.text(g, String(this.score), 112, 34, { size: 22, color: '#c98a1f', weight: 800 });

      // altitude meter, bottom-left
      D.rr(g, 14, CM.H - 56, 178, 40, 16, 'rgba(255,255,255,0.82)', '#bcdcff', 2);
      D.text(g, '🪁 ' + Math.round(this.altitude / 10) + ' m', 104, CM.H - 36, {
        size: 18, color: P.blueDeep, weight: 800
      });

      // gust boost indicator
      if (this.boost > 0.05) {
        D.text(g, 'BOOST!', 104, CM.H - 74, { size: 18, color: P.mintDeep, weight: 800, stroke: '#fff', strokeWidth: 5 });
      }

      // brief control hint
      if (this.state === 'fly' && CM.sceneTime < 12) {
        const hint = CM.touchMode ? 'Hold the LEFT or RIGHT side to steer!' : 'Steer: ← →  or  A / D  (or hold a side)';
        D.rr(g, 290, 60, 380, 26, 13, 'rgba(255,255,255,0.6)');
        D.text(g, hint, 480, 73, { size: 14, color: '#5a86b0', weight: 700 });
      }
    },

    /* ---------------- howto ---------------- */
    drawHowto(g, t) {
      // a friendly preview kite drifting on the panel
      g.fillStyle = 'rgba(70,60,90,0.22)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 165, 88, 630, 410, { title: '🪁 Kite Flying 🪁' });
      CM.drawFriend(g, 'cinnamoroll', 270, 392, 1.25, { bob: ((t * 1.1) % 1) * 0.5 });
      D.text(g, 'Cinnamoroll', 270, 416, { size: 14, color: P.pinkDeep, weight: 800 });

      D.text(g, 'Fly your kite up into the breezy sky!', 565, 158, { size: 20, color: P.ink, weight: 800 });
      D.text(g, 'Steer LEFT & RIGHT to fly through', 565, 200, { size: 17, color: P.ink });
      D.text(g, 'rings ◯ and grab stars ★!', 565, 226, { size: 17, color: P.pinkDeep, weight: 800 });
      D.text(g, 'Ride wind swirls for a speedy BOOST!', 565, 268, { size: 17, color: P.mintDeep, weight: 800 });
      D.text(g, 'Soft clouds just slow you a sec —', 565, 310, { size: 16, color: P.ink });
      D.text(g, 'no crashes, just keep flying!', 565, 332, { size: 16, color: P.ink });
      const hint = CM.touchMode ? 'Hold the LEFT or RIGHT half of the screen' : 'Steer with ← → or A / D keys';
      D.text(g, hint, 565, 366, { size: 14, color: '#9a8a94' });

      if (CM.ui.button(g, 465, 400, 200, 58, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.beginCount();
      }
    }
  });
})();
