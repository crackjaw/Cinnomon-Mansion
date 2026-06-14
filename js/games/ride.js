/* Cinnamoroll Mansion — Ride to School (hosted by Badtz-Maru) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---- world geometry ----
     A side-scroller. The road surface sits at ROAD_Y; the bike rides along it.
     The "world" scrolls right-to-left at SPEED px/s. We track distance travelled
     and place obstacles / collectibles at fixed world positions so they appear
     evenly spaced and readable. */
  const ROAD_Y = 470;       // top of the road band (where wheels touch)
  const BIKE_X = 250;       // bike's fixed screen x
  const SPEED = 210;        // world scroll speed (px/s) — gentle for a 6-year-old
  const RIDE_DIST = 11000;  // total world distance to the schoolhouse (~52s)
  const JUMP_V = 560;       // jump launch velocity
  const GRAVITY = 1300;     // gravity for the jump arc
  const MAX_PARTS = 80;
  const BADTZ = { x: 760, y: 452 }; // host zooming alongside on the right

  // Obstacle kinds (player jumps over these). Penalty is gentle.
  const OBSTACLES = {
    puddle: { w: 64, h: 16, pts: 4, sfx: 'splash' },
    cone:   { w: 34, h: 44, pts: 5, sfx: 'boing' },
    log:    { w: 78, h: 30, pts: 5, sfx: 'boing' },
    turtle: { w: 50, h: 30, pts: 4, sfx: 'pop' }
  };
  // Collectibles (player jumps/grabs these).
  const COLLECT = {
    star:  { value: 15, r: 16 },
    apple: { value: 10, r: 15 }
  };

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'ride',
    name: 'Ride to School',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';   // howto -> count -> ride -> arrive -> done (-> finish once)
      this.score = 0;
      this.finished = false;

      this.dist = 0;          // world distance travelled
      this.scroll = 0;        // pixels scrolled (for parallax)
      this.speedMul = 1;      // dips to <1 when wobbling after a bump

      // bike physics (vertical only; x is fixed)
      this.bikeY = 0;         // height above the road (0 = on ground)
      this.bikeVy = 0;
      this.onGround = true;
      this.wobble = 0;        // wobble timer after hitting an obstacle
      this.bounce = 0;        // squash-and-stretch on landing

      this.parts = [];
      this.shake = 0;
      this.countT = 0;
      this.lastSeg = -1;
      this.arriveT = 0;
      this.doneT = 0;

      this.collected = 0;     // stars + apples grabbed
      this.bumps = 0;

      this.hostBubble = { text: '', t: 0 };
      this.hostHappy = 0;

      // decorative parallax props (clouds, hills, trees) — regenerated each enter
      this.clouds = [];
      for (let i = 0; i < 5; i++) {
        this.clouds.push({ x: CM.rand(0, 960), y: CM.rand(40, 150), s: CM.rand(0.7, 1.3) });
      }
      this.hills = [];
      for (let i = 0; i < 4; i++) {
        this.hills.push({ x: i * 320 + CM.rand(-40, 40), r: CM.rand(120, 200) });
      }

      // build the level: obstacles & collectibles laid out along the world
      this.buildLevel();
    },

    exit() {},

    /* ================= level build ================= */
    buildLevel() {
      this.things = [];   // each: { kind, group, x (world), grabbed/hit }
      // Start with a calm runway so the kid settles in.
      let x = 1400;
      const obKinds = ['puddle', 'cone', 'log', 'turtle'];
      let oi = 0;
      while (x < RIDE_DIST - 900) {
        // alternate: a collectible cluster, then an obstacle, generously spaced
        // a little arc of collectibles (often arced so jumping grabs them)
        const n = CM.randInt(2, 3);
        const arc = Math.random() < 0.6;
        for (let i = 0; i < n; i++) {
          const cx = x + i * 70;
          const type = Math.random() < 0.45 ? 'star' : 'apple';
          // arced collectibles float up at the middle so a jump scoops them
          let h = 70;
          if (arc) h = 70 + Math.sin((i + 0.5) / n * Math.PI) * 120;
          else h = CM.rand(60, 110);
          this.things.push({ kind: 'collect', type: type, x: cx, h: h, grabbed: false, ph: CM.rand(0, 6.28) });
        }
        x += n * 70 + CM.rand(120, 200);

        // an obstacle to jump
        const ok = obKinds[oi % obKinds.length];
        oi++;
        this.things.push({ kind: 'obstacle', type: ok, x: x, hit: false });
        x += CM.rand(460, 620); // generous gap → easy jump timing
      }
      this.things.sort((a, b) => a.x - b.x);
    },

    /* ================= input / jump ================= */
    tryJump() {
      if (this.onGround && this.state === 'ride') {
        this.bikeVy = JUMP_V;
        this.onGround = false;
        CM.audio.play('whoosh');
        CM.audio.tone(420, 0.12, 'sine', 0.1, 0, 720);
        this.puff(BIKE_X, ROAD_Y, 4);
      }
    },

    beginCount() {
      this.state = 'count';
      this.countT = 0;
      this.lastSeg = -1;
      this.say('Hop on! Off we go!', 2.4);
    },

    /* ================= particles / juice ================= */
    addPart(p) { if (this.parts.length < MAX_PARTS) { p.maxLife = p.life; this.parts.push(p); } },

    puff(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.addPart({
          kind: 'puff', x: x + CM.rand(-10, 10), y: y + CM.rand(-4, 4),
          vx: CM.rand(-50, -10), vy: CM.rand(-30, 10),
          life: CM.rand(0.3, 0.6), size: CM.rand(5, 9), color: 'rgba(255,255,255,0.85)'
        });
      }
    },

    burst(x, y, color, big) {
      const n = big ? 12 : 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.addPart({
          kind: 'spark', x: x, y: y,
          vx: Math.cos(a) * CM.rand(70, big ? 180 : 120),
          vy: Math.sin(a) * CM.rand(70, big ? 180 : 120) - 40,
          life: CM.rand(0.45, 0.85), size: CM.rand(4, big ? 10 : 7),
          color: color
        });
      }
      const hearts = big ? 3 : 1;
      for (let i = 0; i < hearts; i++) {
        this.addPart({
          kind: 'heart', x: x + CM.rand(-16, 16), y: y - 8,
          vx: CM.rand(-30, 30), vy: CM.rand(-120, -60),
          life: 1.0, size: CM.rand(7, 11)
        });
      }
    },

    splashParts(x, y) {
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI * (0.2 + Math.random() * 0.6);
        this.addPart({
          kind: 'drop', x: x + CM.rand(-20, 20), y: y,
          vx: Math.cos(a) * CM.rand(40, 140), vy: Math.sin(a) * CM.rand(80, 200),
          life: CM.rand(0.4, 0.7), size: CM.rand(3, 6), color: '#9ed8f8'
        });
      }
    },

    floatText(x, y, str, color) {
      this.addPart({ kind: 'txt', x: x, y: y, str: str, color: color, vx: 0, vy: -40, life: 1.1 });
    },

    confetti() {
      if (this.parts.length > MAX_PARTS - 6) return;
      this.addPart({
        kind: 'spark', x: CM.rand(120, 840), y: CM.rand(120, 320),
        vx: CM.rand(-40, 40), vy: CM.rand(-70, -20),
        life: CM.rand(0.7, 1.2), size: CM.rand(6, 12),
        color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep])
      });
    },

    tickParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= dt;
        if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'spark') { p.vy += 230 * dt; p.vx *= 1 - dt * 1.1; }
        else if (p.kind === 'heart') p.vy += 30 * dt;
        else if (p.kind === 'drop') p.vy += 380 * dt;
        else if (p.kind === 'puff') { p.vy -= 12 * dt; p.size += 8 * dt; }
      }
    },

    say(text, t) {
      this.hostBubble = { text: text, t: t };
      this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    /* ================= update ================= */
    update(dt) {
      this.shake = Math.max(0, this.shake - dt * 16);
      if (this.hostBubble.t > 0) this.hostBubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      if (this.bounce > 0) this.bounce = Math.max(0, this.bounce - dt * 5);
      this.tickParts(dt);

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.beginCount();
          break;

        case 'count':
          this.countT += dt;
          // still scroll the scenery a touch so it feels alive
          this.scroll += SPEED * 0.25 * dt;
          this.updateClouds(dt, 0.25);
          {
            const seg = Math.floor(this.countT / 0.8);
            if (seg !== this.lastSeg && seg <= 3) {
              this.lastSeg = seg;
              if (seg < 3) CM.audio.tone(620 + seg * 90, 0.14, 'triangle', 0.12);
              else { CM.audio.play('ding'); CM.audio.tone(523, 0.18, 'square', 0.1); }
            }
            if (this.countT >= 3.4) this.state = 'ride';
          }
          break;

        case 'ride':
          this.updateRide(dt);
          break;

        case 'arrive':
          this.arriveT += dt;
          // keep the bike rolling to a gentle stop in front of the school
          this.speedMul = Math.max(0, this.speedMul - dt * 0.7);
          this.scroll += SPEED * this.speedMul * dt;
          this.updateClouds(dt, this.speedMul);
          // settle the bike onto the road
          if (!this.onGround) {
            this.bikeVy -= GRAVITY * dt;
            this.bikeY += this.bikeVy * dt;
            if (this.bikeY <= 0) { this.bikeY = 0; this.bikeVy = 0; this.onGround = true; }
          }
          if (Math.random() < 0.55) this.confetti();
          if (this.arriveT >= 2.4) {
            this.state = 'done';
            this.doneT = 1.8;
          }
          break;

        case 'done':
          if (Math.random() < 0.4) this.confetti();
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('ride', this.score, CM.clamp(Math.ceil(this.score / 15), 5, 30));
          }
          break;
      }
    },

    updateClouds(dt, mul) {
      for (const c of this.clouds) {
        c.x -= SPEED * 0.12 * mul * dt;
        if (c.x < -90) { c.x = 1040; c.y = CM.rand(40, 150); c.s = CM.rand(0.7, 1.3); }
      }
    },

    updateRide(dt) {
      // jump input
      if (anyPress()) this.tryJump();

      // recover from a wobble (bike slows briefly, then speeds back up)
      if (this.wobble > 0) {
        this.wobble = Math.max(0, this.wobble - dt);
        this.speedMul = CM.lerp(0.45, 1, 1 - this.wobble / 0.9);
      } else {
        this.speedMul = Math.min(1, this.speedMul + dt * 2);
      }

      const move = SPEED * this.speedMul * dt;
      this.dist += move;
      this.scroll += move;
      this.updateClouds(dt, this.speedMul);

      // jump physics
      if (!this.onGround) {
        this.bikeVy -= GRAVITY * dt;
        this.bikeY += this.bikeVy * dt;
        if (this.bikeY <= 0) {
          this.bikeY = 0;
          this.bikeVy = 0;
          this.onGround = true;
          this.bounce = 1;       // little squash on landing
          CM.audio.play('step');
          this.puff(BIKE_X, ROAD_Y, 3);
        }
      }

      // collisions: each thing's screen x = BIKE_X + (thing.x - dist)
      const bikeBottom = ROAD_Y - this.bikeY;      // wheels height
      for (const th of this.things) {
        const sx = BIKE_X + (th.x - this.dist);
        if (sx < -120) continue;        // already passed
        if (sx > 1080) break;           // sorted by x — nothing more is near

        if (th.kind === 'collect' && !th.grabbed) {
          // collectible sits at height th.h above the road
          const cy = ROAD_Y - th.h;
          // bike "grab box" centered on the rider's body (a bit above the wheels)
          const bx = BIKE_X, by = bikeBottom - 36;
          if (CM.dist(sx, cy, bx, by) < 46) {
            th.grabbed = true;
            this.grab(th, sx, cy);
          }
        } else if (th.kind === 'obstacle' && !th.hit) {
          const ob = OBSTACLES[th.type];
          // horizontal overlap with the bike, and bike is low enough to hit it
          const half = ob.w / 2 + 22;
          const lowEnough = this.bikeY < ob.h - 2; // jumped high enough = safe
          if (Math.abs(sx - BIKE_X) < half && lowEnough) {
            th.hit = true;
            this.hitObstacle(th, sx);
          } else if (sx < BIKE_X - half && !th.hit) {
            // cleared it! tiny reward for a clean jump over
            th.hit = true; // mark consumed so we don't recheck
            if (this.bikeY > 4) {
              this.score += 2;
              CM.audio.tone(880, 0.06, 'square', 0.05);
            }
          }
        }
      }

      // reached the school?
      if (this.dist >= RIDE_DIST) {
        this.arrive();
      }
    },

    grab(th, sx, cy) {
      const def = COLLECT[th.type];
      this.score += def.value;
      this.collected++;
      const big = th.type === 'star';
      this.shake = big ? 5 : 2;
      CM.audio.play(big ? 'ding' : 'coin');
      this.burst(sx, cy, big ? P.yellowDeep : P.red, big);
      this.floatText(sx, cy - 16, '+' + def.value, big ? '#e0a81f' : P.pinkDeep);
      if (big) this.say('Star get! Wow!', 1.4);
      else if (Math.random() < 0.4) this.say('Yum! Apple!', 1.1);
    },

    hitObstacle(th, sx) {
      const ob = OBSTACLES[th.type];
      // GENTLE: lose a few points, wobble & slow — never a crash/game-over
      this.score = Math.max(0, this.score - ob.pts);
      this.bumps++;
      this.wobble = 0.9;
      this.speedMul = 0.45;
      this.shake = 6;
      CM.audio.play(ob.sfx);
      if (th.type === 'puddle') this.splashParts(sx, ROAD_Y - 4);
      else this.puff(sx, ROAD_Y - 10, 5);
      this.floatText(BIKE_X, ROAD_Y - 90, 'Whoops!', P.lavenderDeep);
      this.say(CM.pick(['Careful!', 'Whoops!', 'Hang on!']), 1.2);
    },

    arrive() {
      if (this.state !== 'ride') return;
      this.state = 'arrive';
      this.arriveT = 0;
      // arrival bonus, plus a tidy bonus for grabbing lots
      this.arriveBonus = 80 + this.collected * 4;
      this.score += this.arriveBonus;
      this.shake = 8;
      CM.audio.play('tada');
      this.say('You made it!! 🎉', 3);
      for (let i = 0; i < 14; i++) this.confetti();
      this.burst(BIKE_X, ROAD_Y - 50, P.yellowDeep, true);
    },

    /* ================= draw ================= */
    draw(g) {
      g.save();
      if (this.shake > 0.2) {
        const m = this.shake;
        g.translate(CM.rand(-m, m) * 0.7, CM.rand(-m, m) * 0.7);
      }

      this.drawSky(g);
      this.drawHills(g);
      this.drawSchoolApproach(g);
      this.drawRoad(g);
      this.drawThings(g);
      this.drawBike(g);
      this.drawHost(g);
      this.drawParts(g);

      g.restore(); // end shake

      /* ---- HUD ---- */
      this.drawHud(g);

      /* ---- overlays ---- */
      if (this.state === 'count') this.drawCount(g);
      if (this.state === 'arrive' || this.state === 'done') this.drawArriveBanner(g);
      if (this.state === 'howto') this.drawHowto(g);
    },

    /* ----- sky + parallax ----- */
    drawSky(g) {
      const sg = g.createLinearGradient(0, 0, 0, ROAD_Y);
      sg.addColorStop(0, '#bfe7ff');
      sg.addColorStop(1, '#e8f6ff');
      g.fillStyle = sg;
      g.fillRect(0, 0, CM.W, ROAD_Y);
      // sun
      D.circle(g, 110, 90, 38, '#fff3b0');
      D.circle(g, 110, 90, 30, '#ffe07a');
      // clouds
      for (const c of this.clouds) {
        this.drawCloud(g, c.x, c.y, c.s);
      }
    },

    drawCloud(g, x, y, s) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      D.circle(g, -22, 4, 18, 'rgba(255,255,255,0.92)');
      D.circle(g, 0, -6, 24, 'rgba(255,255,255,0.92)');
      D.circle(g, 22, 4, 18, 'rgba(255,255,255,0.92)');
      D.rr(g, -34, 2, 68, 16, 8, 'rgba(255,255,255,0.92)');
      g.restore();
    },

    drawHills(g) {
      // soft rolling hills with parallax (slower than the road)
      const off = (this.scroll * 0.25) % 320;
      for (let i = -1; i < 5; i++) {
        const hill = this.hills[(i + 4) % 4];
        const hx = i * 320 - off + hill.x % 320;
        g.fillStyle = i % 2 ? '#bdeccd' : '#a8e3bb';
        g.beginPath();
        g.ellipse(hx, ROAD_Y + 10, hill.r, hill.r * 0.6, 0, Math.PI, Math.PI * 2);
        g.fill();
      }
      // a band of grass meeting the road
      g.fillStyle = '#9adcae';
      g.fillRect(0, ROAD_Y - 18, CM.W, 22);
      // little trees scrolling by (parallax mid)
      const toff = (this.scroll * 0.6) % 260;
      for (let i = -1; i < 5; i++) {
        const tx = i * 260 - toff + 60;
        this.drawTree(g, tx, ROAD_Y - 14);
      }
    },

    drawTree(g, x, baseY) {
      D.rr(g, x - 5, baseY - 36, 10, 40, 4, '#8a5a3b');
      D.circle(g, x, baseY - 50, 24, '#7fcf95', '#5fb377', 2);
      D.circle(g, x - 16, baseY - 40, 16, '#8fd6a0', '#5fb377', 2);
      D.circle(g, x + 16, baseY - 40, 16, '#8fd6a0', '#5fb377', 2);
      // a couple of apple dots
      D.circle(g, x - 6, baseY - 52, 3, P.red);
      D.circle(g, x + 8, baseY - 46, 3, P.red);
    },

    /* ----- the schoolhouse looming near the end ----- */
    drawSchoolApproach(g) {
      // distance until school enters view; it slides in over the last stretch
      const remaining = RIDE_DIST - this.dist;
      // start drawing it when within ~1700 world units
      let sx;
      if (this.state === 'arrive' || this.state === 'done') {
        // parked: ease toward a settled position centered-right
        const settle = CM.clamp(this.arriveT / 1.6, 0, 1);
        sx = CM.lerp(BIKE_X + 1700, 640, settle);
      } else if (remaining < 1700) {
        sx = BIKE_X + remaining;
      } else {
        return; // not visible yet
      }
      this.drawSchool(g, sx, ROAD_Y - 16);
    },

    drawSchool(g, x, baseY) {
      g.save();
      // body
      D.rr(g, x - 90, baseY - 130, 180, 130, 12, '#ffd9e8', '#f0b9d2', 3);
      // roof
      g.fillStyle = P.pinkDeep;
      g.beginPath();
      g.moveTo(x - 104, baseY - 130);
      g.lineTo(x, baseY - 196);
      g.lineTo(x + 104, baseY - 130);
      g.closePath();
      g.fill();
      // bell tower
      D.rr(g, x - 22, baseY - 224, 44, 40, 6, '#ffe9a8', '#f2b53c', 2.5);
      g.fillStyle = P.red;
      g.beginPath();
      g.moveTo(x - 28, baseY - 224);
      g.lineTo(x, baseY - 252);
      g.lineTo(x + 28, baseY - 224);
      g.closePath();
      g.fill();
      D.circle(g, x, baseY - 236, 6, '#f2b53c', '#b9831f', 2); // bell
      // door
      D.rr(g, x - 24, baseY - 64, 48, 64, 8, P.blueDeep, '#3a7fb0', 2);
      D.circle(g, x + 12, baseY - 32, 3, '#ffe07a');
      // windows
      D.rr(g, x - 70, baseY - 110, 34, 34, 6, '#cdeaff', '#fff', 3);
      D.rr(g, x + 36, baseY - 110, 34, 34, 6, '#cdeaff', '#fff', 3);
      // banner
      D.rr(g, x - 70, baseY - 150, 140, 26, 8, '#fff', '#f0b9d2', 2);
      D.text(g, '★ SCHOOL ★', x, baseY - 137, { size: 16, color: P.pinkDeep, weight: 800 });
      // little flag
      g.strokeStyle = '#8a5a3b'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(x, baseY - 252); g.lineTo(x, baseY - 276); g.stroke();
      g.fillStyle = P.mintDeep;
      g.beginPath();
      g.moveTo(x, baseY - 276); g.lineTo(x + 22, baseY - 270); g.lineTo(x, baseY - 264);
      g.closePath(); g.fill();
      g.restore();
    },

    /* ----- the road ----- */
    drawRoad(g) {
      const rg = g.createLinearGradient(0, ROAD_Y, 0, CM.H);
      rg.addColorStop(0, '#9aa0ab');
      rg.addColorStop(1, '#7e8591');
      g.fillStyle = rg;
      g.fillRect(0, ROAD_Y, CM.W, CM.H - ROAD_Y);
      // top edge highlight
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect(0, ROAD_Y, CM.W, 4);
      // dashed center line scrolling
      g.fillStyle = '#ffe9a8';
      const lineY = ROAD_Y + 64;
      const dash = 70, gap = 50, period = dash + gap;
      const off = this.scroll % period;
      for (let x = -off; x < CM.W + period; x += period) {
        D.rr(g, x, lineY, dash, 9, 4, '#ffe9a8');
      }
      // little pebbles scrolling for texture
      g.fillStyle = 'rgba(255,255,255,0.18)';
      const poff = (this.scroll * 1) % 90;
      for (let i = 0; i < 14; i++) {
        const px = (i * 90 - poff + 900) % (CM.W + 90) - 30;
        const py = ROAD_Y + 24 + ((i * 53) % 90);
        g.beginPath();
        g.ellipse(px, py, 6, 3, 0, 0, Math.PI * 2);
        g.fill();
      }
    },

    /* ----- obstacles & collectibles ----- */
    drawThings(g) {
      const t = CM.time;
      for (const th of this.things) {
        const sx = BIKE_X + (th.x - this.dist);
        if (sx < -120 || sx > CM.W + 120) continue;

        if (th.kind === 'collect') {
          if (th.grabbed) continue;
          const cy = ROAD_Y - th.h + Math.sin(t * 3 + th.ph) * 4;
          this.drawCollectible(g, th.type, sx, cy, t, th.ph);
        } else {
          if (th.hit && th.type !== 'puddle' && th.type !== 'turtle') {
            // jumped-over obstacles still draw normally; "hit" only affects scoring
          }
          this.drawObstacle(g, th, sx, t);
        }
      }
    },

    drawCollectible(g, type, x, y, t, ph) {
      const tw = 0.5 + 0.5 * Math.sin(t * 4 + ph);
      D.shadow(g, x, ROAD_Y - 4, 12);
      if (type === 'star') {
        g.save();
        g.globalAlpha = 0.3 + tw * 0.25;
        D.star(g, x, y, 24, '#fff3b0');
        g.globalAlpha = 1;
        D.star(g, x, y, 17, '#e8be3a', t * 2);
        D.star(g, x, y, 15, '#ffe07a', t * 2);
        D.circle(g, x - 3, y - 3, 3, 'rgba(255,255,255,0.9)');
        g.restore();
      } else { // apple
        D.circle(g, x, y, 14, P.red, '#c33b3b', 2);
        D.circle(g, x - 4, y - 4, 4, 'rgba(255,255,255,0.6)');
        // leaf + stem
        g.strokeStyle = '#7a4a2a'; g.lineWidth = 2.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y - 12); g.lineTo(x + 2, y - 19); g.stroke();
        g.fillStyle = '#7fcf95';
        g.beginPath();
        g.ellipse(x + 8, y - 18, 6, 3.5, -0.6, 0, Math.PI * 2);
        g.fill();
      }
      if (tw > 0.75) {
        g.globalAlpha = (tw - 0.75) / 0.25;
        D.star(g, x + 14, y - 14, 3.5, '#ffffff');
        g.globalAlpha = 1;
      }
    },

    drawObstacle(g, th, x, t) {
      const ob = OBSTACLES[th.type];
      if (th.type === 'puddle') {
        D.ellipse(g, x, ROAD_Y + 8, ob.w / 2, 11, '#9ed8f8', '#6fb8e0', 2);
        D.ellipse(g, x - 8, ROAD_Y + 5, 10, 4, 'rgba(255,255,255,0.6)');
      } else if (th.type === 'cone') {
        D.shadow(g, x, ROAD_Y + 4, 20);
        g.fillStyle = '#ff8b4a';
        g.beginPath();
        g.moveTo(x, ROAD_Y - 44);
        g.lineTo(x - 18, ROAD_Y + 2);
        g.lineTo(x + 18, ROAD_Y + 2);
        g.closePath();
        g.fill();
        g.strokeStyle = '#e0702f'; g.lineWidth = 2; g.stroke();
        D.rr(g, x - 14, ROAD_Y - 22, 28, 7, 3, '#fff');
        D.rr(g, x - 22, ROAD_Y - 2, 44, 7, 3, '#ff8b4a', '#e0702f', 1.5);
      } else if (th.type === 'log') {
        D.shadow(g, x, ROAD_Y + 6, 40);
        D.rr(g, x - 39, ROAD_Y - 28, 78, 30, 14, '#a87044', '#7a4a2a', 3);
        D.ellipse(g, x - 39, ROAD_Y - 13, 9, 15, '#c98a55', '#7a4a2a', 2.5);
        // rings
        D.circle(g, x - 39, ROAD_Y - 13, 5, null, '#7a4a2a', 1.5);
        D.circle(g, x - 39, ROAD_Y - 13, 2, null, '#7a4a2a', 1.5);
        // a little leaf on top
        g.fillStyle = '#7fcf95';
        g.beginPath();
        g.ellipse(x + 6, ROAD_Y - 30, 8, 4, -0.5, 0, Math.PI * 2);
        g.fill();
      } else if (th.type === 'turtle') {
        const walk = Math.sin(t * 4 + x * 0.05) * 1.5;
        D.shadow(g, x, ROAD_Y + 4, 26);
        // shell
        D.ellipse(g, x, ROAD_Y - 14, 24, 16, '#8fd6a0', '#5fb377', 2.5);
        // shell pattern
        D.circle(g, x, ROAD_Y - 16, 6, '#6fbc82');
        D.circle(g, x - 11, ROAD_Y - 12, 4, '#6fbc82');
        D.circle(g, x + 11, ROAD_Y - 12, 4, '#6fbc82');
        // head + legs
        D.circle(g, x - 24, ROAD_Y - 12 + walk, 7, '#9adcae', '#5fb377', 2);
        D.circle(g, x - 27, ROAD_Y - 14 + walk, 1.4, '#3c3c3c');
        D.ellipse(g, x - 14, ROAD_Y - 2, 4, 5, '#9adcae');
        D.ellipse(g, x + 12, ROAD_Y - 2, 4, 5, '#9adcae');
      }
    },

    /* ----- the bike + rider ----- */
    drawBike(g) {
      const y = ROAD_Y - this.bikeY;
      // tilt slightly up when rising, down when falling
      let tilt = CM.clamp(-this.bikeVy / 2600, -0.16, 0.22);
      if (this.onGround) tilt = 0;
      // wobble shimmy after a bump
      const wob = this.wobble > 0 ? Math.sin(CM.time * 40) * this.wobble * 4 : 0;
      // landing squash
      const sq = this.bounce > 0 ? Math.sin(this.bounce * Math.PI) : 0;

      // motion shadow on the road (grows when airborne)
      D.shadow(g, BIKE_X + 4, ROAD_Y + 2, 34 + this.bikeY * 0.04);

      g.save();
      g.translate(BIKE_X + wob, y);
      g.rotate(tilt);
      g.scale(1 + sq * 0.06, 1 - sq * 0.1);

      const wheelR = 20;
      const wheelSpin = -this.scroll * 0.06;
      // wheels (back at -34, front at +34)
      this.drawWheel(g, -34, -wheelR, wheelR, wheelSpin);
      this.drawWheel(g, 34, -wheelR, wheelR, wheelSpin);

      // bike body — cute rounded scooter
      g.fillStyle = P.pink;
      // floorboard / frame
      D.rr(g, -40, -wheelR - 6, 80, 14, 7, P.pink, P.pinkDeep, 2);
      // body shell over back wheel
      D.rr(g, -46, -wheelR - 18, 36, 22, 10, P.pinkDeep, '#d44f80', 2);
      // front leg shield rising to handlebars
      g.fillStyle = P.pink;
      g.beginPath();
      g.moveTo(26, -wheelR - 6);
      g.lineTo(40, -wheelR - 6);
      g.lineTo(46, -wheelR - 52);
      g.lineTo(34, -wheelR - 52);
      g.closePath();
      g.fill();
      g.strokeStyle = P.pinkDeep; g.lineWidth = 2; g.stroke();
      // headlight
      D.circle(g, 44, -wheelR - 44, 5, '#fff3b0', '#f2b53c', 2);
      // handlebar
      g.strokeStyle = '#5a5560'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(40, -wheelR - 52); g.lineTo(52, -wheelR - 56); g.stroke();
      // seat
      D.rr(g, -30, -wheelR - 30, 30, 12, 6, '#5a5560');
      // a cute heart sticker on the shell
      D.heart(g, -28, -wheelR - 8, 12, '#fff');

      // the rider (player's character) sitting on the seat
      // feet anchored where they'd rest on the floorboard
      CM.drawPlayer(g, -6, -wheelR - 4, 0.82, 'right', 0);

      g.restore();
    },

    drawWheel(g, cx, cy, r, spin) {
      D.circle(g, cx, cy, r, '#3a3a42', '#1f1f25', 3);
      D.circle(g, cx, cy, r * 0.5, '#cfd3da', '#9aa0ab', 2);
      D.circle(g, cx, cy, r * 0.16, '#7e8591');
      // spokes
      g.save();
      g.translate(cx, cy);
      g.rotate(spin);
      g.strokeStyle = '#9aa0ab'; g.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2;
        g.beginPath();
        g.moveTo(0, 0);
        g.lineTo(Math.cos(a) * r * 0.5, Math.sin(a) * r * 0.5);
        g.stroke();
      }
      g.restore();
    },

    /* ----- host: Badtz-Maru zooming alongside ----- */
    drawHost(g) {
      const t = CM.time;
      // Badtz-Maru rides a little skateboard/scooter alongside on the right
      const happy = this.hostHappy > 0 || this.state === 'arrive' || this.state === 'done';
      const bob = happy ? (t * 2.6) % 1 : ((t * 1.4) % 1) * 0.5;
      const hx = BADTZ.x;
      const hy = BADTZ.y;
      // tiny board with spinning wheels
      const spin = -this.scroll * 0.05;
      D.shadow(g, hx, ROAD_Y + 2, 30);
      D.rr(g, hx - 26, hy - 4, 52, 8, 4, '#5a5560', '#3a3a42', 2);
      this.drawWheel(g, hx - 16, hy + 6, 9, spin);
      this.drawWheel(g, hx + 16, hy + 6, 9, spin);
      CM.drawFriend(g, 'badtzmaru', hx, hy - 6, 0.92, { bob: bob });
    },

    drawParts(g) {
      for (const p of this.parts) {
        g.globalAlpha = CM.clamp(p.life / p.maxLife, 0, 1);
        if (p.kind === 'spark') D.star(g, p.x, p.y, p.size, p.color || P.yellowDeep);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, P.pink);
        else if (p.kind === 'puff') D.circle(g, p.x, p.y, p.size, p.color);
        else if (p.kind === 'drop') D.circle(g, p.x, p.y, p.size, p.color);
        else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, { size: 22, color: p.color || '#c98a1f', weight: 800, stroke: '#ffffff', strokeWidth: 5 });
        }
      }
      g.globalAlpha = 1;
    },

    /* ----- HUD ----- */
    drawHud(g) {
      if (this.state === 'howto') return;
      const t = CM.time;
      // score, top-left
      D.rr(g, 14, 12, 168, 44, 20, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      D.star(g, 36, 34, 12, P.yellowDeep);
      D.text(g, String(this.score), 110, 34, { size: 22, color: '#c98a1f', weight: 800 });

      // progress-to-school bar, top-center
      const prog = CM.clamp(this.dist / RIDE_DIST, 0, 1);
      const bx = 270, bw = 420, by = 18, bh = 22;
      D.rr(g, bx, by, bw, bh, 11, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      D.rr(g, bx + 3, by + 3, (bw - 6) * prog, bh - 6, 8, P.mintDeep);
      // bike marker on the bar
      const mx = bx + 3 + (bw - 6) * prog;
      D.circle(g, mx, by + bh / 2, 8, P.pinkDeep, '#fff', 2);
      // school icon at the end
      g.fillStyle = P.pinkDeep;
      g.beginPath();
      g.moveTo(bx + bw + 6, by + 4);
      g.lineTo(bx + bw + 14, by - 4);
      g.lineTo(bx + bw + 22, by + 4);
      g.closePath();
      g.fill();
      D.rr(g, bx + bw + 7, by + 4, 14, 14, 2, '#ffd9e8', '#f0b9d2', 1.5);
      D.text(g, 'To School', bx + bw / 2, by + bh + 12, { size: 14, color: '#7a6b75', weight: 700 });

      // jump hint while riding (early on)
      if (this.state === 'ride' && this.dist < 1300) {
        const hint = CM.touchMode ? 'TAP to jump over things!' : 'TAP / SPACE to JUMP!';
        const pulse = 1 + Math.sin(t * 5) * 0.04;
        D.rr(g, 320, 560, 320, 30, 15, 'rgba(255,255,255,0.78)');
        D.text(g, hint, 480, 575, { size: Math.round(16 * pulse), color: P.pinkDeep, weight: 800 });
      }
    },

    drawCount(g) {
      const SEGS = ['3', '2', '1', 'Go!'];
      const seg = Math.min(3, Math.floor(this.countT / 0.8));
      const frac = (this.countT - seg * 0.8) / 0.8;
      const size = (seg === 3 ? 76 : 96) * (1 + 0.3 * Math.max(0, 1 - frac * 3));
      D.text(g, SEGS[seg], 480, 250, {
        size: Math.round(size), color: P.pinkDeep, weight: 800,
        stroke: '#ffffff', strokeWidth: 10
      });
      D.text(g, 'Get ready to ride!', 480, 320, { size: 22, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 5 });
    },

    drawArriveBanner(g) {
      const t = CM.time;
      g.fillStyle = 'rgba(255,255,255,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.text(g, 'You made it to school!! 🎒', 480, 180, {
        size: 44, color: P.pinkDeep, weight: 800, stroke: '#ffffff', strokeWidth: 10
      });
      const bonus = this.arriveBonus || 0;
      D.text(g, 'Arrival bonus +' + bonus + '!', 480, 232, {
        size: 24, color: P.mintDeep, weight: 800, stroke: '#fff', strokeWidth: 6
      });
      D.text(g, 'Score: ' + this.score, 480, 276, {
        size: 30, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6
      });
      D.star(g, 250, 170 + Math.sin(t * 5) * 6, 18, P.yellowDeep, t * 2);
      D.star(g, 710, 170 + Math.cos(t * 5) * 6, 18, P.yellowDeep, -t * 2);
    },

    drawHowto(g) {
      const t = CM.time;
      // a friendly riding scene is already drawn behind; dim it a touch
      g.fillStyle = 'rgba(70,40,70,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 175, 92, 610, 396, { title: '🛵 Ride to School 🏫' });
      CM.drawFriend(g, 'badtzmaru', 278, 392, 1.25, { bob: ((t * 1.1) % 1) * 0.5 });
      D.text(g, 'Badtz-Maru', 278, 416, { size: 14, color: P.pinkDeep, weight: 800 });
      D.text(g, 'Hop on your scooter and ride!', 565, 162, { size: 20, color: P.ink, weight: 800 });
      D.text(g, 'TAP, click or SPACE to JUMP over', 565, 206, { size: 17, color: P.ink });
      D.text(g, 'puddles, cones, logs & turtles.', 565, 230, { size: 17, color: P.ink });
      D.text(g, 'Grab ★ stars and 🍎 apples for points!', 565, 274, { size: 17, color: P.yellowDeep, weight: 800 });
      D.text(g, 'Reach the school for a big bonus! 🎉', 565, 316, { size: 18, color: P.pinkDeep, weight: 800 });
      D.text(g, 'Bumps just slow you down — keep going!', 565, 352, { size: 14, color: '#9a8a94' });
      if (CM.ui.button(g, 465, 396, 200, 58, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.beginCount();
      }
    }
  });
})();
