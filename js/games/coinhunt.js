/* Cinnamoroll Mansion — Coin Hunt (the playroom) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  /* ---------------- playroom layout ---------------- */
  // Keep the whole sprite on screen; reserve the top-right corner for engine chrome.
  const BOUNDS = { x1: 56, y1: 168, x2: 904, y2: 556 };
  const POCHA = { x: 70, y: 330 };      // host cheering on the left wall
  const SPAWN = { x: 480, y: 380 };
  const GAME_TIME = 60;
  const TARGET_ITEMS = 10;
  const PICKUP_DIST = 34;
  const PLACE_TRIES = 24;

  // Collectible types: weighted for spawning. Star is special-cased (rare, max 1).
  const TYPES = {
    coin: { value: 5, color: '#f6cf5a', r: 13 },
    donut: { value: 10, color: '#ffb7d5', r: 14 },
    gem: { value: 15, color: '#9ed8f8', r: 13 },
    star: { value: 30, color: '#ffe07a', r: 16 }
  };
  // common -> rarer (no star here; star handled separately)
  const SPAWN_BAG = ['coin', 'coin', 'coin', 'coin', 'coin', 'donut', 'donut', 'donut', 'gem', 'gem'];

  // simple non-interactive decorations (drawn, also act as soft no-spawn zones)
  const DECOS = [
    { kind: 'plant', x: 110, y: 210 },
    { kind: 'toybox', x: 820, y: 250 },
    { kind: 'plant', x: 860, y: 500 }
  ];
  const RUG = { x: 480, y: 380, rx: 215, ry: 112 };

  /* ---------------- the game ---------------- */
  CM.registerGame({
    id: 'coinhunt',
    name: 'Coin Hunt',
    joystick: true,

    enter() {
      this.state = 'howto';        // howto -> count -> play -> done (-> finish once)
      this.timeLeft = GAME_TIME;
      this.score = 0;
      this.grabbed = 0;
      this.finished = false;

      this.p = { x: SPAWN.x, y: SPAWN.y, facing: 'down', phase: 0 };
      this.target = null;
      this.moving = false;

      this.items = [];
      this.parts = [];
      this.shake = 0;
      this.countT = 0;
      this.lastSeg = -1;
      this.lastTick = -1;
      this.doneT = 0;
      this.starCd = CM.rand(4, 8);   // wait a bit before the first golden star
      this.hostBubble = { text: '', t: 0 };
      this.hostHappy = 0;            // >0 = Pochacco does a thumbs-up bob

      // pet trail (optional cuteness)
      this.petTrail = [];
      this.petObj = CM.save.pet ? { x: this.p.x - 26, y: this.p.y + 6, flip: false, moving: false } : null;

      // fill the floor
      for (let i = 0; i < TARGET_ITEMS; i++) this.spawnItem(this.rollType());
    },

    exit() {},

    /* ----- spawning ----- */
    rollType() {
      // occasionally a golden star, at most one present at a time
      const hasStar = this.items && this.items.some((o) => o.type === 'star');
      if (!hasStar && this.starCd <= 0 && Math.random() < 0.55) {
        this.starCd = CM.rand(7, 13);
        return 'star';
      }
      return CM.pick(SPAWN_BAG);
    },

    // far enough from the player, from other items, and from decorations
    spotOk(x, y) {
      if (x < BOUNDS.x1 + 6 || x > BOUNDS.x2 - 6 || y < BOUNDS.y1 + 6 || y > BOUNDS.y2 - 6) return false;
      if (CM.dist(x, y, this.p.x, this.p.y) < 70) return false;
      for (const it of this.items) {
        if (CM.dist(x, y, it.x, it.y) < 56) return false;
      }
      for (const d of DECOS) {
        if (CM.dist(x, y, d.x, d.y - 18) < 56) return false;
      }
      return true;
    },

    spawnItem(type) {
      let x = 0, y = 0, ok = false;
      for (let i = 0; i < PLACE_TRIES; i++) {
        x = CM.rand(BOUNDS.x1 + 20, BOUNDS.x2 - 20);
        y = CM.rand(BOUNDS.y1 + 20, BOUNDS.y2 - 20);
        if (this.spotOk(x, y)) { ok = true; break; }
      }
      // capped retries: if we never found a clear spot, just use the last pick
      this.items.push({
        type: type, x: x, y: y,
        value: TYPES[type].value,
        ph: CM.rand(0, Math.PI * 2),   // bob/sparkle phase offset
        born: 0
      });
      return ok;
    },

    /* ----- particles ----- */
    addPart(p) { if (this.parts.length < 90) this.parts.push(p); },

    burst(x, y, color, big) {
      const n = big ? 12 : 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.addPart({
          kind: 'spark', x: x, y: y,
          vx: Math.cos(a) * CM.rand(70, big ? 170 : 120),
          vy: Math.sin(a) * CM.rand(70, big ? 170 : 120) - 40,
          t: 0, life: CM.rand(0.5, 0.85), size: CM.rand(5, big ? 11 : 8), color: color
        });
      }
      const hearts = big ? 4 : 2;
      for (let i = 0; i < hearts; i++) {
        this.addPart({
          kind: 'heart', x: x + CM.rand(-18, 18), y: y - 10,
          vx: CM.rand(-30, 30), vy: CM.rand(-120, -60),
          t: 0, life: 1.0, size: CM.rand(7, 11)
        });
      }
    },

    floatText(x, y, str, color) {
      this.addPart({ kind: 'txt', x: x, y: y, str: str, color: color, vx: 0, vy: -38, t: 0, life: 1.1 });
    },

    tickParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.t += dt;
        if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'spark') { p.vy += 120 * dt; p.vx *= 1 - dt * 1.2; }
        else if (p.kind === 'heart') p.vy += 30 * dt;
      }
    },

    /* ----- collect ----- */
    collect(it, idx) {
      this.score += it.value;
      this.grabbed++;
      const big = it.type === 'gem' || it.type === 'star';
      this.shake = it.type === 'star' ? 7 : (big ? 4 : 2);
      CM.audio.play(it.type === 'coin' ? 'coin' : 'ding');
      this.burst(it.x, it.y, TYPES[it.type].color, big);
      this.floatText(it.x, it.y - 18, '+' + it.value,
        it.type === 'star' ? '#e0a81f' : (big ? CM.palette.blueDeep : '#c98a1f'));
      // Pochacco reacts on the bigger grabs
      if (it.type === 'star') {
        this.say('WOW!! ✨', 2.0);
        CM.audio.play('cheer');
      } else if (it.type === 'gem') {
        this.say('Wow!', 1.4);
      } else if (it.type === 'donut') {
        this.say('Nice!', 1.2);
      }
      // remove and immediately replace so the floor stays full
      this.items.splice(idx, 1);
      this.spawnItem(this.rollType());
    },

    say(text, t) {
      this.hostBubble = { text: text, t: t };
      this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    beginCount() {
      this.state = 'count';
      this.countT = 0;
      this.lastSeg = -1;
      this.say('Grab them all!', 2.6);
    },

    update(dt) {
      const inp = CM.input;
      // only claim touches for the joystick while actually playing
      this.joystick = this.state === 'play';
      this.shake = Math.max(0, this.shake - dt * 16);
      if (this.hostBubble.t > 0) this.hostBubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      this.tickParts(dt);

      // gentle bob phase for items
      for (const it of this.items) it.born += dt;

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
        if (this.parts.length < 60 && Math.random() < 0.3) {
          this.addPart({
            kind: 'spark', x: CM.rand(140, 820), y: CM.rand(150, 360),
            vx: CM.rand(-30, 30), vy: CM.rand(-70, -20),
            t: 0, life: 0.9, size: CM.rand(6, 12), color: CM.pick(['#f6cf5a', '#ffb7d5', '#9ed8f8', '#ffe07a'])
          });
        }
        this.doneT -= dt;
        if (this.doneT <= 0 && !this.finished) {
          this.finished = true;
          CM.finishGame('coinhunt', this.score, CM.clamp(Math.ceil(this.score / 15), 5, 30));
        }
        return;
      }

      /* ----- play ----- */
      this.starCd -= dt;
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
        this.say('Great hunting!', 3);
        CM.audio.play('tada');
        this.burst(this.p.x, this.p.y - 40, '#ffe07a', true);
        return;
      }

      // mouse: click to walk (walking onto an item collects it)
      if (inp.mouse.clicked) {
        this.target = {
          x: CM.clamp(inp.mouse.x, BOUNDS.x1, BOUNDS.x2),
          y: CM.clamp(inp.mouse.y, BOUNDS.y1, BOUNDS.y2),
          t: 0, stuck: 0
        };
      }

      // movement (mansion-style; keyboard / joystick takes over from a click target)
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
      } else {
        this.p.phase = 0;
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

      // collect overlapping items (body overlap)
      for (let i = this.items.length - 1; i >= 0; i--) {
        const it = this.items[i];
        if (CM.dist(this.p.x, this.p.y - 30, it.x, it.y) < PICKUP_DIST + TYPES[it.type].r) {
          this.collect(it, i);
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

    /* ---------------- item art ---------------- */
    drawItem(g, it, t) {
      const def = TYPES[it.type];
      const bob = Math.sin(t * 3 + it.ph) * 3;
      const x = it.x, y = it.y + bob;
      // pop-in scale for a freshly spawned goodie
      const s = it.born < 0.25 ? CM.clamp(it.born / 0.25, 0.2, 1) : 1;
      D.shadow(g, it.x, it.y + 10, 13 * s);
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      // gentle twinkle
      const tw = 0.5 + 0.5 * Math.sin(t * 4 + it.ph);
      if (it.type === 'coin') {
        D.coin(g, 0, 0, def.r);
      } else if (it.type === 'donut') {
        D.circle(g, 0, 0, def.r, '#f6c79a', '#dca36c', 2.5);
        D.circle(g, 0, 0, def.r * 0.4, null, '#dca36c', 2.5);
        // pink frosting blob
        g.fillStyle = def.color;
        g.beginPath();
        g.ellipse(0, -1, def.r * 0.92, def.r * 0.78, 0, 0, Math.PI * 2);
        g.fill();
        D.circle(g, 0, 0, def.r * 0.38, '#f6c79a');
        // sprinkles
        const sc = ['#ffe07a', '#8ecdf6', '#67c587', '#ffffff'];
        for (let i = 0; i < 5; i++) {
          const a = it.ph + (i / 5) * Math.PI * 2;
          g.save();
          g.translate(Math.cos(a) * def.r * 0.66, Math.sin(a) * def.r * 0.66 - 1);
          g.rotate(a);
          g.fillStyle = sc[i % sc.length];
          g.fillRect(-2.5, -1, 5, 2);
          g.restore();
        }
      } else if (it.type === 'gem') {
        const r = def.r;
        g.fillStyle = def.color;
        g.strokeStyle = '#6fb8e0';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(0, -r);
        g.lineTo(r * 0.85, -r * 0.2);
        g.lineTo(r * 0.5, r);
        g.lineTo(-r * 0.5, r);
        g.lineTo(-r * 0.85, -r * 0.2);
        g.closePath();
        g.fill();
        g.stroke();
        // facets + shine
        g.strokeStyle = 'rgba(255,255,255,0.7)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(0, -r); g.lineTo(0, r);
        g.moveTo(-r * 0.85, -r * 0.2); g.lineTo(r * 0.85, -r * 0.2);
        g.stroke();
        g.fillStyle = 'rgba(255,255,255,0.85)';
        g.beginPath();
        g.moveTo(-r * 0.3, -r * 0.6); g.lineTo(0, -r * 0.2); g.lineTo(-r * 0.2, 0); g.closePath();
        g.fill();
      } else if (it.type === 'star') {
        // golden star with a glowing halo
        g.globalAlpha = 0.35 + tw * 0.25;
        D.star(g, 0, 0, def.r * 1.5, '#fff3b0');
        g.globalAlpha = 1;
        D.star(g, 0, 0, def.r + 2, '#e8be3a');
        D.star(g, 0, 0, def.r, def.color);
        D.circle(g, -def.r * 0.2, -def.r * 0.2, def.r * 0.18, 'rgba(255,255,255,0.9)');
      }
      // little sparkle that twinkles on every item
      if (tw > 0.7) {
        g.globalAlpha = (tw - 0.7) / 0.3;
        D.star(g, def.r * 0.7, -def.r * 0.7, 3.5, '#ffffff');
        g.globalAlpha = 1;
      }
      g.restore();
    },

    /* ---------------- room art ---------------- */
    drawRoom(g, t) {
      const P = CM.palette;
      // warm wood floor
      g.fillStyle = P.wood;
      g.fillRect(0, 110, CM.W, CM.H - 110);
      g.strokeStyle = 'rgba(140,90,50,0.16)';
      g.lineWidth = 2;
      for (let y = 150; y < CM.H; y += 40) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(CM.W, y); g.stroke();
      }
      // faint vertical board seams
      g.strokeStyle = 'rgba(140,90,50,0.07)';
      g.lineWidth = 1.5;
      for (let x = 80; x < CM.W; x += 120) {
        g.beginPath(); g.moveTo(x, 110); g.lineTo(x, CM.H); g.stroke();
      }
      // soft pastel wall strip across the top (~110px)
      g.fillStyle = '#dff0ff';
      g.fillRect(0, 0, CM.W, 110);
      g.fillStyle = 'rgba(255,255,255,0.45)';
      for (let x = 18; x < CM.W; x += 60) g.fillRect(x, 0, 24, 96);
      g.fillStyle = '#ffffff';
      g.fillRect(0, 96, CM.W, 14);
      g.fillStyle = 'rgba(0,0,0,0.05)';
      g.fillRect(0, 108, CM.W, 4);
      // a cheery window on the wall
      const wx = 480;
      D.rr(g, wx - 36, 16, 72, 78, 9, '#cdeaff', '#fff', 5);
      g.strokeStyle = '#fff'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(wx, 20); g.lineTo(wx, 90); g.stroke();
      g.beginPath(); g.moveTo(wx - 32, 55); g.lineTo(wx + 32, 55); g.stroke();
      D.circle(g, wx - 18, 38, 9, '#fff3b0'); // little sun
      g.fillStyle = '#ffb7d5';
      g.beginPath(); g.moveTo(wx - 36, 14); g.lineTo(wx - 18, 60); g.lineTo(wx - 36, 60); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(wx + 36, 14); g.lineTo(wx + 18, 60); g.lineTo(wx + 36, 60); g.closePath(); g.fill();
      // bunting across the wall
      const cols = ['#ff9ec7', '#8ecdf6', '#ffe9a8', '#bdeccd', '#d8c9f2'];
      g.strokeStyle = 'rgba(150,110,130,0.4)';
      g.lineWidth = 2;
      g.beginPath();
      for (let x = 40; x <= 260; x += 6) g.lineTo(x, 12 + Math.sin(x * 0.05) * 4);
      g.stroke();
      for (let i = 0; i < 8; i++) {
        const x = 52 + i * 26;
        const dip = 12 + Math.sin(x * 0.05) * 4;
        g.fillStyle = cols[i % cols.length];
        g.beginPath();
        g.moveTo(x - 7, dip); g.lineTo(x + 7, dip); g.lineTo(x, dip + 14); g.closePath();
        g.fill();
      }
      // soft round rug
      D.ellipse(g, RUG.x, RUG.y, RUG.rx, RUG.ry, '#ffe2ef', '#f0b9d2', 4);
      D.ellipse(g, RUG.x, RUG.y, RUG.rx - 34, RUG.ry - 22, null, '#ffffff', 3);
      D.heart(g, RUG.x, RUG.y - 4, 24, '#ff9ec7');
    },

    drawDeco(g, d, t) {
      if (d.kind === 'plant') {
        D.shadow(g, d.x, d.y, 24);
        D.rr(g, d.x - 16, d.y - 24, 32, 24, 6, '#d98a5a', '#b56f42', 2);
        const sw = Math.sin(t * 0.9 + d.x) * 1.5;
        D.ellipse(g, d.x + sw, d.y - 38, 22, 18, '#8fd6a0', '#6fbc82', 2);
        D.ellipse(g, d.x - 12 + sw, d.y - 50, 12, 10, '#a5dfae');
        D.ellipse(g, d.x + 12 + sw, d.y - 50, 12, 10, '#a5dfae');
        D.circle(g, d.x - 6 + sw, d.y - 44, 3.5, '#ffd9e8');
        D.circle(g, d.x + 8 + sw, d.y - 46, 3.5, '#ffe9a8');
      } else if (d.kind === 'toybox') {
        D.shadow(g, d.x, d.y + 6, 44);
        D.rr(g, d.x - 44, d.y - 36, 88, 44, 8, '#8ecdf6', '#6aaede', 3);
        D.rr(g, d.x - 44, d.y - 50, 88, 18, 8, '#a8d8f8', '#6aaede', 3);
        // toys peeking out
        D.circle(g, d.x - 22, d.y - 54, 11, '#ff9ec7', '#e87fb2', 2);
        D.star(g, d.x + 6, d.y - 56, 11, '#ffe07a');
        D.circle(g, d.x + 28, d.y - 52, 9, '#bdeccd', '#67c587', 2);
        D.text(g, 'TOYS', d.x, d.y - 14, { size: 14, color: '#ffffff', weight: 800 });
      }
    },

    draw(g) {
      const t = CM.time;
      g.save();
      if (this.shake > 0.2) {
        g.translate(CM.rand(-this.shake, this.shake) * 0.7, CM.rand(-this.shake, this.shake) * 0.7);
      }
      this.drawRoom(g, t);

      /* ----- depth-sorted sprites ----- */
      const sprites = [];
      for (const d of DECOS) sprites.push({ y: d.y, fn: () => this.drawDeco(g, d, t) });
      for (const it of this.items) sprites.push({ y: it.y, fn: () => this.drawItem(g, it, t) });

      // Pochacco the host, cheering on the left
      const happy = this.hostHappy > 0 || this.state === 'done';
      sprites.push({ y: POCHA.y, fn: () => {
        const bob = happy ? (t * 2.4) % 1 : ((t * 0.8) % 1) * 0.35;
        CM.drawFriend(g, 'pochacco', POCHA.x, POCHA.y, 1.1, { bob: bob });
        // thumbs-up: a little raised paw with a ★ when happy
        if (this.hostHappy > 0) {
          const lift = Math.abs(Math.sin(bob * Math.PI * 2)) * 5;
          D.circle(g, POCHA.x + 22, POCHA.y - 58 - lift, 5, '#ffffff', '#dfe5ea', 1.5);
          D.star(g, POCHA.x + 22, POCHA.y - 72 - lift, 6, CM.palette.yellowDeep);
        }
        D.rr(g, POCHA.x - 42, POCHA.y + 6, 84, 19, 9, 'rgba(255,255,255,0.85)');
        D.text(g, 'Pochacco', POCHA.x, POCHA.y + 16, { size: 14, color: CM.palette.ink, weight: 800 });
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

      // player
      sprites.push({ y: this.p.y, fn: () => {
        CM.drawPlayer(g, this.p.x, this.p.y, 1.05, this.p.facing, this.p.phase);
      } });

      sprites.sort((a, b) => a.y - b.y);
      for (const s of sprites) s.fn();

      // click-to-walk target marker
      if (this.target && this.state === 'play') {
        const tg = this.target;
        const pulse = 1 - (tg.t % 0.7) / 0.7;
        g.globalAlpha = 0.3 + pulse * 0.45;
        D.circle(g, tg.x, tg.y, 7 + pulse * 10, null, CM.palette.pinkDeep, 2.5);
        D.star(g, tg.x, tg.y, 5, CM.palette.pinkDeep);
        g.globalAlpha = 1;
      }

      // Pochacco speech bubble on good moments
      if (this.hostBubble.t > 0 && this.state !== 'howto') {
        const txt = this.hostBubble.text;
        const cw = Math.max(96, txt.length * 9 + 26);
        const bx = CM.clamp(POCHA.x - 10, 8, CM.W - cw - 8);
        D.bubble(g, bx, POCHA.y - 150, cw, 40, POCHA.x + 14);
        D.text(g, txt, bx + cw / 2, POCHA.y - 130, { size: 15, weight: 800, color: CM.palette.pinkDeep });
      }

      /* ----- particles ----- */
      for (const p of this.parts) {
        g.globalAlpha = Math.max(0, 1 - p.t / p.life);
        if (p.kind === 'spark') D.star(g, p.x, p.y, p.size, p.color || CM.palette.yellowDeep);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, CM.palette.pink);
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
        D.text(g, SEGS[seg], 480, 260, {
          size: Math.round(size), color: CM.palette.pinkDeep, weight: 800,
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
        D.rr(g, 416, 10, 128, 44, 22, 'rgba(255,255,255,0.9)', urgent ? CM.palette.red : '#f0b9d2', 3);
        D.text(g, '⏱ ' + tl, 480, 33, {
          size: Math.round(27 * pulse),
          color: urgent ? CM.palette.red : CM.palette.blueDeep, weight: 800
        });
        // score, top-left
        D.rr(g, 14, 12, 150, 40, 20, 'rgba(255,255,255,0.88)', '#f0b9d2', 2);
        D.coin(g, 36, 32, 12);
        D.text(g, String(this.score), 110, 32, { size: 22, color: '#c98a1f', weight: 800 });
        // small control hint early on
        if (this.state === 'play' && CM.sceneTime < 12) {
          const hint = CM.touchMode ? 'Drag left side to walk · or tap where to go' : 'Walk: click or WASD / Arrows to grab goodies!';
          D.rr(g, 300, 58, 360, 26, 13, 'rgba(255,255,255,0.55)');
          D.text(g, hint, 480, 71, { size: 14, color: '#7a6b75' });
        }
      }

      /* ----- done banner ----- */
      if (this.state === 'done') {
        D.text(g, 'Time\'s up! 🎉', 480, 220, {
          size: 46, color: CM.palette.pinkDeep, weight: 800, stroke: '#ffffff', strokeWidth: 10
        });
        D.text(g, 'You grabbed ' + this.grabbed + ' goodies for ' + this.score + ' points!',
          480, 268, { size: 22, color: CM.palette.ink, weight: 800, stroke: '#ffffff', strokeWidth: 6 });
        D.star(g, 250, 200 + Math.sin(t * 5) * 6, 16, CM.palette.yellowDeep);
        D.star(g, 710, 200 + Math.cos(t * 5) * 6, 16, CM.palette.yellowDeep);
      }

      /* ----- howto overlay ----- */
      if (this.state === 'howto') {
        g.fillStyle = 'rgba(70,40,70,0.25)';
        g.fillRect(0, 0, CM.W, CM.H);
        CM.ui.panel(g, 165, 88, 630, 400, { title: '🪙 Coin Hunt 🪙' });
        CM.drawFriend(g, 'pochacco', 270, 388, 1.25, { bob: ((t * 1.1) % 1) * 0.5 });
        D.text(g, 'Pochacco', 270, 412, { size: 14, color: CM.palette.pinkDeep, weight: 800 });
        D.text(g, 'The playroom is full of goodies!', 560, 158, { size: 20, color: CM.palette.ink, weight: 800 });
        D.text(g, 'Walk over coins, donuts & gems', 560, 202, { size: 17, color: CM.palette.ink });
        D.text(g, 'to scoop them up for points!', 560, 228, { size: 17, color: CM.palette.ink });
        D.text(g, 'Catch the golden ★ for a BIG bonus!', 560, 272, { size: 17, color: CM.palette.yellowDeep, weight: 800 });
        D.text(g, 'Grab as many as you can in 60s!', 560, 316, { size: 18, color: CM.palette.pinkDeep, weight: 800 });
        const hint = CM.touchMode ? 'Drag left side to walk · or tap where to go' : 'Walk: click or WASD / Arrows';
        D.text(g, hint, 560, 354, { size: 14, color: '#9a8a94' });
        if (CM.ui.button(g, 460, 396, 200, 58, '▶ Start!', { color: CM.palette.mintDeep, size: 22 })) {
          this.beginCount();
        }
      }
    }
  });
})();
