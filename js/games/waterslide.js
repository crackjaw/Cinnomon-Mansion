/* Cinnamoroll Mansion — Water Slide (hosted by Cinnamoroll) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------------- layout & tuning ----------------
     The view auto-scrolls so the player slides DOWNward; the slide art
     scrolls UPward past a player parked near the bottom of the screen.
     "dist" is how far down the slide we've travelled this run (px). The
     lane is a curvy ribbon whose centre wobbles with dist; the player
     steers left/right (lane-relative) to grab rings/stars & dodge bumps. */
  const PLAYER_Y = 430;          // player's fixed screen-y while riding
  const LANE_HALF = 150;         // half-width of the playable lane (px)
  const PLAYER_HALF = 96;        // how far the player may stray from lane centre
  const RUN_LEN = 2200;          // slide length per run (px of travel; ~7s of sliding)
  const LOOKAHEAD = 540;         // how far down-slide a new row is placed (just above screen top)
  const SCROLL_SPEED = 330;      // px/sec the slide scrolls past
  const STEER_SPEED = 360;       // px/sec the player can move sideways
  const TOTAL_RUNS = 5;
  const MAX_PARTS = 110;
  const SPAWN_GAP = 175;         // vertical spacing between collectible rows (px)
  const CINNA = { x: 120, y: 540 };  // host cheering at the splash pool

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  // smooth curvy lane centre as a function of distance down the slide
  function laneCenterAt(dist) {
    return CM.W / 2
      + Math.sin(dist * 0.0042) * 120
      + Math.sin(dist * 0.0011 + 1.3) * 70;
  }

  CM.registerGame({
    id: 'waterslide',
    name: 'Water Slide',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';   // howto -> count -> slide -> splash -> (next run) -> done -> finish once
      this.score = 0;
      this.finished = false;

      this.run = 1;
      this.dist = 0;          // distance travelled this run
      this.offset = 0;        // player's sideways offset from lane centre (-PLAYER_HALF..+PLAYER_HALF)
      this.slow = 0;          // >0 = briefly slowed by a splash-bump
      this.collected = 0;
      this.landingBonus = 0;

      this.items = [];        // rings / stars on the slide
      this.bumps = [];        // gentle splash-bumps
      this.parts = [];
      this.ripples = [];      // background water ripples (poolside)

      this.shake = 0;
      this.countT = 0;
      this.lastSeg = -1;
      this.splashT = 0;
      this.doneT = 0;
      this.bubble = { text: '', t: 0 };
      this.hostHappy = 0;
      this.nextSpawn = 220;   // first row a bit down the slide

      // seed a few drifting pool ripples for the deck water
      for (let i = 0; i < 7; i++) {
        this.ripples.push({ x: CM.rand(0, CM.W), y: CM.rand(70, 150), ph: CM.rand(0, 6.28), sp: CM.rand(0.4, 1.0) });
      }
    },

    exit() {},

    /* ================= run setup ================= */
    startRun() {
      this.dist = 0;
      this.offset = 0;
      this.slow = 0;
      this.items = [];
      this.bumps = [];
      this.nextSpawn = 220;
      this.state = 'count';
      this.countT = 0;
      this.lastSeg = -1;
      this.say('Wheee! Here we go!', 2.0);
    },

    say(text, t) {
      this.bubble = { text: text, t: t };
      this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    // spawn a row of collectibles / a bump ahead, in lane-relative slot positions
    spawnRow() {
      const slot = CM.rand(-0.62, 0.62);   // lane-relative; kept within easy reach of the player
      const r = Math.random();
      const at = this.dist + LOOKAHEAD;
      if (r < 0.20) {
        // a gentle splash-bump to weave around (never a crash)
        this.bumps.push({ dist: at, slot: slot, hit: false, wob: CM.rand(0, 6.28) });
      } else {
        const star = Math.random() < 0.28;
        this.items.push({
          dist: at,
          slot: slot,
          type: star ? 'star' : 'ring',
          value: star ? 25 : 10,
          got: false,
          ph: CM.rand(0, 6.28)
        });
      }
      // sometimes a little cluster of two for juicy grab streaks
      if (Math.random() < 0.4) {
        const slot2 = CM.clamp(slot + CM.rand(-0.45, 0.45), -0.62, 0.62);
        this.items.push({
          dist: at + CM.rand(40, 80),
          slot: slot2, type: 'ring', value: 10, got: false, ph: CM.rand(0, 6.28)
        });
      }
    },

    /* ================= particles ================= */
    addPart(p) { if (this.parts.length < MAX_PARTS) this.parts.push(p); },

    splash(x, y, n, color, up) {
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.addPart({
          kind: 'drop', x: x, y: y,
          vx: Math.cos(a) * CM.rand(50, 170),
          vy: (up ? -1 : 1) * Math.abs(Math.sin(a)) * CM.rand(60, 200) - (up ? 60 : 0),
          t: 0, life: CM.rand(0.4, 0.85), size: CM.rand(3, 6),
          color: color || '#cdeeff'
        });
      }
    },

    sparkle(x, y, n, color) {
      for (let i = 0; i < n; i++) {
        this.addPart({
          kind: 'spark', x: x + CM.rand(-12, 12), y: y + CM.rand(-12, 12),
          vx: CM.rand(-40, 40), vy: CM.rand(-110, -30),
          t: 0, life: CM.rand(0.5, 0.95), size: CM.rand(5, 10),
          color: color || P.yellow
        });
      }
    },

    floatText(x, y, str, color) {
      this.addPart({ kind: 'txt', x: x, y: y, str: str, color: color || '#1f7fc0', vx: 0, vy: -46, t: 0, life: 1.0 });
    },

    tickParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.t += dt;
        if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'drop') { p.vy += 420 * dt; }
        else if (p.kind === 'spark') { p.vy += 150 * dt; p.vx *= 1 - dt * 1.1; }
      }
    },

    /* ================= update ================= */
    update(dt) {
      const inp = CM.input;
      this.shake = Math.max(0, this.shake - dt * 16);
      if (this.bubble.t > 0) this.bubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      this.tickParts(dt);
      for (const rp of this.ripples) rp.ph += dt * rp.sp;

      switch (this.state) {
        case 'howto':
          if (anyPress()) this.startRun();
          break;

        case 'count': {
          this.countT += dt;
          const seg = Math.floor(this.countT / 0.7);
          if (seg !== this.lastSeg && seg <= 3) {
            this.lastSeg = seg;
            if (seg < 3) CM.audio.tone(620 + seg * 90, 0.14, 'triangle', 0.12);
            else CM.audio.play('ding');
          }
          if (this.countT >= 3.1) this.state = 'slide';
          break;
        }

        case 'slide':
          this.updateSlide(dt);
          break;

        case 'splash':
          this.splashT -= dt;
          // keep the splash fountain bubbling
          if (this.splashT > 0 && this.parts.length < MAX_PARTS && Math.random() < 0.5) {
            this.splash(CM.W / 2, PLAYER_Y + 30, 5, '#bfe7ff', true);
          }
          if (this.splashT <= 0) {
            if (this.run >= TOTAL_RUNS) {
              this.state = 'done';
              this.doneT = 2.0;
              this.shake = 7;
              this.say('What a splash!! 💦', 3);
              CM.audio.play('tada');
            } else {
              this.run++;
              this.startRun();
            }
          }
          break;

        case 'done':
          if (this.parts.length < 70 && Math.random() < 0.3) {
            this.addPart({
              kind: 'spark', x: CM.rand(120, 840), y: CM.rand(150, 360),
              vx: CM.rand(-30, 30), vy: CM.rand(-80, -20),
              t: 0, life: 0.95, size: CM.rand(6, 12),
              color: CM.pick([P.pink, P.blue, P.yellow, P.mint, P.lavender])
            });
          }
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('waterslide', this.score, CM.clamp(Math.ceil(this.score / 15), 5, 30));
          }
          break;
      }
    },

    updateSlide(dt) {
      const inp = CM.input;

      // ----- scroll the slide; ramp speed up smoothly at the start of a run -----
      const ramp = CM.clamp(this.dist / 240, 0.35, 1);
      const speed = SCROLL_SPEED * ramp * (this.slow > 0 ? 0.45 : 1);
      if (this.slow > 0) this.slow -= dt;
      this.dist += speed * dt;

      // ----- spawn collectible rows ahead (placed LOOKAHEAD px down-slide) -----
      // stop early enough that the last row still reaches the player before the splash
      while (this.dist >= this.nextSpawn && this.nextSpawn <= RUN_LEN - LOOKAHEAD - 40) {
        this.spawnRow();
        this.nextSpawn += SPAWN_GAP;
      }

      // ----- steering: keyboard axis OR pointer half-of-screen -----
      let steer = 0;
      const ax = inp.axisX();
      if (Math.abs(ax) > 0.05) {
        steer = ax;
      } else if (inp.mouse.down && inp.mouse.x > -500) {
        // hold/tap left or right of the player to glide that way
        const playerScreenX = laneCenterAt(this.dist) + this.offset;
        const d = inp.mouse.x - playerScreenX;
        if (Math.abs(d) > 12) steer = CM.clamp(d / 90, -1, 1);
      }
      this.offset = CM.clamp(this.offset + steer * STEER_SPEED * dt, -PLAYER_HALF, PLAYER_HALF);

      const playerScreenX = laneCenterAt(this.dist) + this.offset;

      // wake/spray trail behind the float
      if (Math.random() < 0.5 && this.parts.length < MAX_PARTS) {
        this.splash(playerScreenX + CM.rand(-14, 14), PLAYER_Y + 22, 1, 'rgba(255,255,255,0.85)', true);
      }

      // ----- collect rings/stars near the player's slide position -----
      for (const it of this.items) {
        if (it.got) continue;
        const sy = PLAYER_Y - (it.dist - this.dist);
        if (sy < -40 || sy > CM.H + 40) continue;
        const ix = laneCenterAt(it.dist) + it.slot * LANE_HALF;
        if (Math.abs(sy - PLAYER_Y) < 34 && Math.abs(ix - playerScreenX) < 38) {
          it.got = true;
          this.collected++;
          this.score += it.value;
          const big = it.type === 'star';
          this.shake = Math.max(this.shake, big ? 5 : 2);
          CM.audio.play(big ? 'ding' : 'coin');
          this.sparkle(ix, sy, big ? 12 : 6, big ? P.yellowDeep : '#bfe7ff');
          this.splash(ix, sy, big ? 8 : 4, '#cdeeff', true);
          this.floatText(ix, sy - 16, '+' + it.value, big ? '#e0a81f' : '#1f7fc0');
          if (big) this.say('Sparkly! ✨', 1.4);
          else if (this.collected % 5 === 0) this.say('Nice grabbing!', 1.2);
        }
      }

      // ----- gentle splash-bumps: just slow you for a moment (NO crash, NO fail) -----
      for (const b of this.bumps) {
        if (b.hit) continue;
        const sy = PLAYER_Y - (b.dist - this.dist);
        if (sy < -40 || sy > CM.H + 40) continue;
        const bx = laneCenterAt(b.dist) + b.slot * LANE_HALF;
        if (Math.abs(sy - PLAYER_Y) < 30 && Math.abs(bx - playerScreenX) < 40) {
          b.hit = true;
          this.slow = 0.45;
          this.shake = Math.max(this.shake, 3);
          CM.audio.play('splash');
          this.splash(bx, sy, 9, '#bfe7ff', true);
          this.floatText(bx, sy - 10, 'splash!', '#7fb8e0');
        }
      }

      // prune off-screen items so arrays stay small
      this.items = this.items.filter((o) => o.dist - this.dist > -120);
      this.bumps = this.bumps.filter((b) => b.dist - this.dist > -120);

      // ----- reached the bottom? big splash landing + bonus -----
      if (this.dist >= RUN_LEN) {
        const bonus = 150 + this.collected * 12;     // landing bonus per run (≈150-400)
        this.landingBonus = bonus;
        this.score += bonus;
        this.state = 'splash';
        this.splashT = 1.7;
        this.shake = 8;
        CM.audio.play('splash');
        CM.audio.play('cheer');
        this.splash(CM.W / 2, PLAYER_Y + 30, 26, '#bfe7ff', true);
        this.sparkle(CM.W / 2, PLAYER_Y, 14, P.yellow);
        this.floatText(CM.W / 2, PLAYER_Y - 60, 'SPLASH! +' + bonus, '#1f7fc0');
        this.say('Big splash landing!', 2.4);
      }
    },

    /* ================= draw ================= */
    draw(g) {
      g.save();
      if (this.shake > 0.2) {
        g.translate(CM.rand(-this.shake, this.shake) * 0.7, CM.rand(-this.shake, this.shake) * 0.7);
      }

      this.drawScene(g);
      this.drawSlide(g);
      this.drawItemsAndPlayer(g);
      this.drawHost(g);
      this.drawParts(g);

      // count-in overlay
      if (this.state === 'count') {
        const SEGS = ['3', '2', '1', 'Go!'];
        const seg = Math.min(3, Math.floor(this.countT / 0.7));
        const frac = (this.countT - seg * 0.7) / 0.7;
        const size = (seg === 3 ? 72 : 92) * (1 + 0.28 * Math.max(0, 1 - frac * 3));
        D.text(g, SEGS[seg], CM.W / 2, 250, {
          size: Math.round(size), color: P.blueDeep, weight: 800,
          stroke: '#ffffff', strokeWidth: 10
        });
      }

      g.restore(); // end shake — context restored

      this.drawHUD(g);

      if (this.state === 'howto') this.drawHowto(g);
      if (this.state === 'done') this.drawDone(g);
    },

    /* ----- background poolside scene ----- */
    drawScene(g) {
      // soft blue sky
      const sky = g.createLinearGradient(0, 0, 0, 160);
      sky.addColorStop(0, '#d6f0ff');
      sky.addColorStop(1, '#bfe7ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, CM.W, 160);
      // a friendly sun
      D.circle(g, 860, 50, 30, '#fff3b0');
      g.globalAlpha = 0.5;
      D.circle(g, 860, 50, 40, '#fff7d0');
      g.globalAlpha = 1;
      // puffy clouds
      this.cloud(g, 150, 48, 1.0);
      this.cloud(g, 470, 36, 0.8);
      this.cloud(g, 700, 60, 1.1);

      // pale tile pool-deck behind everything
      const deck = g.createLinearGradient(0, 130, 0, CM.H);
      deck.addColorStop(0, '#fbe9d6');
      deck.addColorStop(1, '#ffe0c2');
      g.fillStyle = deck;
      g.fillRect(0, 130, CM.W, CM.H - 130);
      // tile seams
      g.strokeStyle = 'rgba(200,150,110,0.18)';
      g.lineWidth = 2;
      for (let y = 170; y < CM.H; y += 56) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(CM.W, y); g.stroke();
      }
      for (let x = 56; x < CM.W; x += 56) {
        g.beginPath(); g.moveTo(x, 130); g.lineTo(x, CM.H); g.stroke();
      }

      // sparkling pool water strip near the top deck (left & right of the slide)
      this.drawDeckWater(g, 0, 130, 250, 70);
      this.drawDeckWater(g, CM.W - 250, 130, 250, 70);

      // poolside props (deck chairs, umbrella, ladder, floats) on the deck
      this.drawUmbrella(g, 808, 250);
      this.drawDeckChair(g, 760, 320);
      this.drawLadder(g, 905, 200);
      this.drawRingFloat(g, 60, 290, '#ff9ec7');
      this.drawRingFloat(g, 110, 470, '#ffe07a');
    },

    cloud(g, x, y, s) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      D.circle(g, -22, 4, 16);
      D.circle(g, 0, -6, 20);
      D.circle(g, 22, 4, 16);
      D.rr(g, -34, 2, 68, 16, 8, 'rgba(255,255,255,0.92)');
      g.restore();
    },

    drawDeckWater(g, x, y, w, h) {
      const wg = g.createLinearGradient(0, y, 0, y + h);
      wg.addColorStop(0, P.blue);
      wg.addColorStop(1, P.blueDeep);
      D.rr(g, x, y, w, h, 14, wg, 'rgba(255,255,255,0.6)', 3);
      // gentle ripple highlights
      g.save();
      D.rrPath(g, x, y, w, h, 14);
      g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 2.5;
      for (const rp of this.ripples) {
        const cy = y + ((rp.y - 70) / 80) * h;
        const xx = x + ((rp.x + Math.sin(rp.ph) * 18) % w + w) % w;
        g.beginPath();
        g.arc(xx, cy, 7 + Math.sin(rp.ph) * 2, 0.15 * Math.PI, 0.85 * Math.PI);
        g.stroke();
      }
      g.restore();
    },

    drawUmbrella(g, x, y) {
      D.shadow(g, x, y + 4, 30);
      g.strokeStyle = '#caa37a'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 76); g.stroke();
      const cols = [P.pink, '#fff', P.blue, '#fff', P.yellow, '#fff'];
      for (let i = 0; i < 6; i++) {
        const a0 = Math.PI + (i / 6) * Math.PI;
        const a1 = Math.PI + ((i + 1) / 6) * Math.PI;
        g.fillStyle = cols[i % cols.length];
        g.beginPath();
        g.moveTo(x, y - 76);
        g.arc(x, y - 76, 50, a0, a1);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = 'rgba(0,0,0,0.08)'; g.lineWidth = 1.5;
      g.beginPath(); g.arc(x, y - 76, 50, Math.PI, Math.PI * 2); g.stroke();
    },

    drawDeckChair(g, x, y) {
      D.shadow(g, x, y + 8, 34);
      g.save();
      g.translate(x, y);
      // recline backrest
      D.rr(g, -34, -38, 40, 14, 6, P.mintDeep);
      g.save(); g.translate(-30, -30); g.rotate(-0.5);
      D.rr(g, 0, -2, 40, 13, 6, P.mint, '#4fae6c', 2);
      g.restore();
      // seat
      D.rr(g, -34, -22, 60, 14, 6, P.mint, '#4fae6c', 2);
      // legs
      g.strokeStyle = '#bfe1c8'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-26, -10); g.lineTo(-32, 6); g.stroke();
      g.beginPath(); g.moveTo(18, -10); g.lineTo(24, 6); g.stroke();
      g.restore();
    },

    drawLadder(g, x, y) {
      g.strokeStyle = '#cfd6dd'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x - 10, y); g.lineTo(x - 10, y + 120);
      g.moveTo(x + 10, y); g.lineTo(x + 10, y + 120);
      g.stroke();
      g.lineWidth = 4;
      for (let i = 0; i < 4; i++) {
        const yy = y + 20 + i * 28;
        g.beginPath(); g.moveTo(x - 10, yy); g.lineTo(x + 10, yy); g.stroke();
      }
    },

    drawRingFloat(g, x, y, color) {
      D.shadow(g, x, y + 6, 26);
      D.circle(g, x, y, 26, color, '#fff', 4);
      D.circle(g, x, y, 12, '#fbe9d6');
      D.circle(g, x - 8, y - 8, 5, 'rgba(255,255,255,0.7)');
    },

    /* ----- the twisty water slide ----- */
    drawSlide(g) {
      // build the lane as a thick ribbon down the screen, sampling laneCenterAt
      const top = 130, bot = CM.H + 20;
      const steps = 22;
      const leftPts = [], rightPts = [];
      for (let i = 0; i <= steps; i++) {
        const sy = top + (bot - top) * (i / steps);
        const d = this.dist + (PLAYER_Y - sy);   // slide distance at this screen-y
        const cx = laneCenterAt(d);
        leftPts.push({ x: cx - LANE_HALF, y: sy });
        rightPts.push({ x: cx + LANE_HALF, y: sy });
      }

      // slide tube outer (rim)
      g.beginPath();
      g.moveTo(leftPts[0].x - 16, leftPts[0].y);
      for (let i = 0; i <= steps; i++) g.lineTo(leftPts[i].x - 16, leftPts[i].y);
      for (let i = steps; i >= 0; i--) g.lineTo(rightPts[i].x + 16, rightPts[i].y);
      g.closePath();
      g.fillStyle = '#9fd6f5';
      g.fill();

      // slide water channel (gradient blue, the smooth water you glide on)
      const grad = g.createLinearGradient(0, top, 0, bot);
      grad.addColorStop(0, P.sky);
      grad.addColorStop(0.5, P.blue);
      grad.addColorStop(1, P.skyDeep);
      g.beginPath();
      g.moveTo(leftPts[0].x, leftPts[0].y);
      for (let i = 0; i <= steps; i++) g.lineTo(leftPts[i].x, leftPts[i].y);
      for (let i = steps; i >= 0; i--) g.lineTo(rightPts[i].x, rightPts[i].y);
      g.closePath();
      g.fillStyle = grad;
      g.fill();

      // flowing water streaks scrolling up the channel
      g.save();
      g.beginPath();
      g.moveTo(leftPts[0].x, leftPts[0].y);
      for (let i = 0; i <= steps; i++) g.lineTo(leftPts[i].x, leftPts[i].y);
      for (let i = steps; i >= 0; i--) g.lineTo(rightPts[i].x, rightPts[i].y);
      g.closePath();
      g.clip();
      g.strokeStyle = 'rgba(255,255,255,0.45)';
      g.lineWidth = 4;
      const scroll = (this.dist % 60);
      for (let lane = -1; lane <= 1; lane++) {
        for (let k = -1; k < steps + 1; k++) {
          const yy = top + k * 60 + (60 - scroll) - 30;
          const d = this.dist + (PLAYER_Y - yy);
          const cx = laneCenterAt(d) + lane * 70;
          g.beginPath();
          g.moveTo(cx - 10, yy);
          g.lineTo(cx + 6, yy + 26);
          g.stroke();
        }
      }
      // sparkle glints on the slide water
      g.fillStyle = 'rgba(255,255,255,0.8)';
      for (let i = 0; i < 6; i++) {
        const yy = top + ((i * 97 + this.dist * 0.6) % (bot - top));
        const d = this.dist + (PLAYER_Y - yy);
        const cx = laneCenterAt(d) + Math.sin(i * 2.1) * 90;
        const tw = 0.5 + 0.5 * Math.sin(CM.time * 4 + i);
        if (tw > 0.6) D.star(g, cx, yy, 3 + tw * 2, 'rgba(255,255,255,0.85)');
      }
      g.restore();

      // bright rim highlights along both edges
      g.lineWidth = 5; g.lineCap = 'round';
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.beginPath();
      for (let i = 0; i <= steps; i++) (i === 0 ? g.moveTo(leftPts[i].x, leftPts[i].y) : g.lineTo(leftPts[i].x, leftPts[i].y));
      g.stroke();
      g.beginPath();
      for (let i = 0; i <= steps; i++) (i === 0 ? g.moveTo(rightPts[i].x, rightPts[i].y) : g.lineTo(rightPts[i].x, rightPts[i].y));
      g.stroke();

      // splash pool at the very bottom (host's landing zone) while sliding
      const poolY = CM.H - 6;
      D.ellipse(g, CM.W / 2, poolY, 180, 30, 'rgba(143,205,246,0.55)');
    },

    /* ----- collectibles, bumps, and the rider ----- */
    drawItemsAndPlayer(g) {
      const sliding = this.state === 'slide' || this.state === 'count';

      if (sliding) {
        // bumps first (under the rings)
        for (const b of this.bumps) {
          if (b.hit) continue;
          const sy = PLAYER_Y - (b.dist - this.dist);
          if (sy < -40 || sy > CM.H + 40) continue;
          const bx = laneCenterAt(b.dist) + b.slot * LANE_HALF;
          this.drawBump(g, bx, sy, b.wob);
        }
        // rings & stars
        for (const it of this.items) {
          if (it.got) continue;
          const sy = PLAYER_Y - (it.dist - this.dist);
          if (sy < -40 || sy > CM.H + 40) continue;
          const ix = laneCenterAt(it.dist) + it.slot * LANE_HALF;
          this.drawCollectible(g, it, ix, sy);
        }
      }

      // the rider on a float — visible while sliding / counting / splashing
      if (sliding || this.state === 'splash') {
        let px = CM.W / 2;
        let py = PLAYER_Y;
        if (sliding) px = laneCenterAt(this.dist) + this.offset;
        if (this.state === 'splash') py = PLAYER_Y + Math.min(28, (1.7 - this.splashT) * 40);
        this.drawRider(g, px, py);
      }
    },

    drawCollectible(g, it, x, y) {
      const bob = Math.sin(CM.time * 3 + it.ph) * 3;
      const yy = y + bob;
      const tw = 0.5 + 0.5 * Math.sin(CM.time * 4 + it.ph);
      if (it.type === 'star') {
        g.globalAlpha = 0.3 + tw * 0.25;
        D.star(g, x, yy, 26, '#fff3b0');
        g.globalAlpha = 1;
        D.star(g, x, yy, 17, '#e8be3a');
        D.star(g, x, yy, 14, P.yellow);
        D.circle(g, x - 3, yy - 3, 3, 'rgba(255,255,255,0.9)');
      } else {
        // a swimming ring
        D.circle(g, x, yy, 16, P.pink, '#fff', 4);
        D.circle(g, x, yy, 7, 'rgba(255,255,255,0.85)');
        // little white segments
        g.strokeStyle = 'rgba(255,255,255,0.8)'; g.lineWidth = 3;
        for (let i = 0; i < 4; i++) {
          const a = (i / 4) * Math.PI * 2 + CM.time;
          g.beginPath();
          g.moveTo(x + Math.cos(a) * 11, yy + Math.sin(a) * 11);
          g.lineTo(x + Math.cos(a) * 16, yy + Math.sin(a) * 16);
          g.stroke();
        }
      }
      if (tw > 0.75) {
        g.globalAlpha = (tw - 0.75) / 0.25;
        D.star(g, x + 14, yy - 14, 3.5, '#ffffff');
        g.globalAlpha = 1;
      }
    },

    drawBump(g, x, y, wob) {
      // a frothy splash-bump: white foam mound (gentle, friendly)
      const puff = Math.sin(CM.time * 4 + wob) * 2;
      g.fillStyle = 'rgba(255,255,255,0.92)';
      D.circle(g, x - 14, y + 4, 11 + puff);
      D.circle(g, x + 14, y + 4, 11 - puff);
      D.circle(g, x, y - 4, 14);
      D.circle(g, x - 7, y + 2, 9);
      D.circle(g, x + 7, y + 2, 9);
      // light blue inner froth
      g.fillStyle = 'rgba(190,231,255,0.9)';
      D.circle(g, x, y, 7);
      // tiny sparkle
      D.star(g, x + 8, y - 10, 3, 'rgba(255,255,255,0.9)');
    },

    drawRider(g, x, y) {
      // inner-tube float under the kid
      D.shadow(g, x, y + 18, 40);
      // tube
      D.ellipse(g, x, y + 14, 44, 24, '#7fd0ee', '#fff', 4);
      D.ellipse(g, x, y + 14, 22, 11, 'rgba(190,231,255,0.9)');
      // highlight
      D.ellipse(g, x - 18, y + 6, 10, 5, 'rgba(255,255,255,0.7)');

      // the player's customized character, riding facing the viewer (down)
      CM.drawPlayer(g, x, y + 10, 0.86, 'down', 0);

      // a little spray under the front of the tube
      g.fillStyle = 'rgba(255,255,255,0.5)';
      D.ellipse(g, x, y + 30, 30, 8);
    },

    /* ----- host: Cinnamoroll cheering at the splash pool ----- */
    drawHost(g) {
      const happy = this.hostHappy > 0 || this.state === 'splash' || this.state === 'done';
      const bob = happy ? (CM.time * 2.4) % 1 : ((CM.time * 0.9) % 1) * 0.4;
      CM.drawFriend(g, 'cinnamoroll', CINNA.x, CINNA.y, 1.1, { bob: bob });
      // name tag
      D.rr(g, CINNA.x - 50, CINNA.y + 6, 100, 19, 9, 'rgba(255,255,255,0.85)');
      D.text(g, 'Cinnamoroll', CINNA.x, CINNA.y + 16, { size: 14, color: P.ink, weight: 800 });
      // cheer paw with a star when happy
      if (this.hostHappy > 0 || this.state === 'splash') {
        const lift = Math.abs(Math.sin(bob * Math.PI * 2)) * 6;
        D.star(g, CINNA.x + 30, CINNA.y - 78 - lift, 7, P.yellowDeep);
      }
      // speech bubble on good moments
      if (this.bubble.t > 0 && this.state !== 'howto') {
        const txt = this.bubble.text;
        const cw = Math.max(110, txt.length * 9 + 26);
        const bx = CM.clamp(CINNA.x - 10, 8, CM.W - cw - 8);
        D.bubble(g, bx, CINNA.y - 170, cw, 42, CINNA.x + 14);
        D.text(g, txt, bx + cw / 2, CINNA.y - 149, { size: 15, weight: 800, color: P.blueDeep });
      }
    },

    /* ----- particles ----- */
    drawParts(g) {
      for (const p of this.parts) {
        g.globalAlpha = Math.max(0, 1 - p.t / p.life);
        if (p.kind === 'drop') {
          D.circle(g, p.x, p.y, p.size, p.color);
          D.circle(g, p.x - p.size * 0.3, p.y - p.size * 0.3, p.size * 0.35, 'rgba(255,255,255,0.7)');
        } else if (p.kind === 'spark') {
          D.star(g, p.x, p.y, p.size, p.color || P.yellow);
        } else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, { size: 22, color: p.color, weight: 800, stroke: '#ffffff', strokeWidth: 5 });
        }
      }
      g.globalAlpha = 1;
    },

    /* ----- HUD ----- */
    drawHUD(g) {
      if (this.state === 'howto') return;
      // score top-left
      D.rr(g, 14, 12, 168, 44, 20, 'rgba(255,255,255,0.9)', '#9fd6f5', 2);
      D.star(g, 36, 34, 12, P.yellowDeep);
      D.text(g, String(this.score), 120, 34, { size: 22, color: '#1f7fc0', weight: 800 });

      // run + progress, top-center
      if (this.state === 'slide' || this.state === 'count' || this.state === 'splash') {
        D.rr(g, 360, 10, 240, 40, 18, 'rgba(255,255,255,0.9)', '#9fd6f5', 2);
        D.text(g, 'Run ' + this.run + ' / ' + TOTAL_RUNS, 420, 30, { size: 17, color: P.blueDeep, weight: 800 });
        // progress bar of this run
        const prog = CM.clamp(this.dist / RUN_LEN, 0, 1);
        D.rr(g, 470, 22, 116, 14, 7, '#e4f3ff', '#9fd6f5', 2);
        D.rr(g, 472, 24, Math.max(4, 112 * prog), 10, 5, P.blueDeep);
      }

      // gentle control hint at the start of the first run
      if (this.state === 'slide' && this.run === 1 && this.dist < 360) {
        const hint = CM.touchMode ? 'Tap / hold LEFT or RIGHT to steer!' : 'Steer ← → (or A / D) to grab rings!';
        D.rr(g, 290, 560, 380, 28, 14, 'rgba(255,255,255,0.7)');
        D.text(g, hint, 480, 575, { size: 15, color: P.blueDeep, weight: 800 });
      }
    },

    /* ----- howto overlay ----- */
    drawHowto(g) {
      const t = CM.time;
      g.fillStyle = 'rgba(40,70,90,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 170, 92, 620, 396, { title: '🌊 Water Slide with Cinnamoroll 🌊', border: '#9fd6f5' });
      CM.drawFriend(g, 'cinnamoroll', 278, 392, 1.25, { bob: ((t * 1.1) % 1) * 0.5 });
      D.text(g, 'Cinnamoroll', 278, 416, { size: 14, color: P.blueDeep, weight: 800 });
      D.text(g, 'Ride the twisty slide down', 570, 156, { size: 20, color: P.ink, weight: 800 });
      D.text(g, 'to the splash pool!', 570, 182, { size: 20, color: P.ink, weight: 800 });
      D.text(g, 'Steer left & right to grab', 570, 224, { size: 17, color: P.ink });
      D.text(g, 'rings ◯ and sparkly stars ★', 570, 250, { size: 17, color: P.ink });
      D.text(g, 'Foamy bumps just slow you —', 570, 292, { size: 16, color: '#7fb8e0', weight: 700 });
      D.text(g, 'no crashes, ever!', 570, 314, { size: 16, color: '#7fb8e0', weight: 700 });
      D.text(g, '5 splashy runs · have fun!', 570, 352, { size: 15, color: '#7a8a94' });
      const hint = CM.touchMode ? 'Tap / hold left or right to steer' : 'Steer: ← → / A D · keyboard or tap';
      D.text(g, hint, 480, 392, { size: 14, color: '#9aaab4' });
      if (CM.ui.button(g, 380, 408, 200, 58, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.startRun();
      }
    },

    /* ----- done banner ----- */
    drawDone(g) {
      const t = CM.time;
      D.text(g, "Wonderful sliding! 🎉", CM.W / 2, 220, {
        size: 44, color: P.blueDeep, weight: 800, stroke: '#ffffff', strokeWidth: 10
      });
      D.text(g, 'You grabbed ' + this.collected + ' goodies!', CM.W / 2, 268, {
        size: 22, color: P.ink, weight: 800, stroke: '#ffffff', strokeWidth: 6
      });
      D.text(g, 'Score: ' + this.score, CM.W / 2, 312, {
        size: 28, color: '#1f7fc0', weight: 800, stroke: '#ffffff', strokeWidth: 6
      });
      D.star(g, 300, 210 + Math.sin(t * 5) * 6, 16, P.yellowDeep);
      D.star(g, 660, 210 + Math.cos(t * 5) * 6, 16, P.yellowDeep);
    }
  });
})();
