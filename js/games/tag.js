/* Cinnamoroll Mansion — Tag, You're It! (the playground, hosted by Pochacco) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------------- playground layout ---------------- */
  // Keep the whole sprite on screen; reserve the top-right corner for engine chrome.
  const BOUNDS = { x1: 60, y1: 215, x2: 902, y2: 556 };
  const POCHA = { x: 86, y: 250 };   // host cheering from the side
  const SPAWN = { x: 480, y: 420 };
  const GAME_TIME = 60;
  const TAG_DIST = 40;               // how close to TOUCH-tag a friend
  const FLEE_DIST = 150;             // friends notice you within this range
  const PLAYER_SPEED = 230;
  const FLEE_SPEED = 150;            // soft flee — slower than you, a 6yo can catch up
  const WANDER_SPEED = 78;           // lazy roaming speed
  const MAX_PARTS = 90;

  // The five friends that scamper around (host 'pochacco' excluded).
  const RUNNERS = ['cinnamoroll', 'mymelody', 'kuromi', 'pompompurin', 'keroppi'];

  // cheery one-liners a freshly tagged friend giggles
  const GIGGLES = ['Tee-hee!', 'You got me!', 'Hee hee!', 'Caught me!', 'So fast!', 'Wheee!'];
  // Pochacco encouragements on a tag
  const HOST_CHEERS = ['Nice tag!', 'Got one!', 'Woohoo!', 'Go go go!', 'Amazing!', 'So quick!'];

  CM.registerGame({
    id: 'tag',
    name: "Tag - You're It!",
    joystick: true,

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';          // howto -> count -> play -> done (-> finish once)
      this.timeLeft = GAME_TIME;
      this.score = 0;
      this.tagged = 0;
      this.finished = false;

      this.p = { x: SPAWN.x, y: SPAWN.y, facing: 'down', phase: 0 };
      this.target = null;
      this.moving = false;

      this.parts = [];
      this.shake = 0;
      this.countT = 0;
      this.lastSeg = -1;
      this.lastTick = -1;
      this.doneT = 0;
      this.hostBubble = { text: '', t: 0 };
      this.hostHappy = 0;

      // five friends scattered around, each wandering on a bouncy path
      this.friends = [];
      for (let i = 0; i < RUNNERS.length; i++) {
        const ang = (i / RUNNERS.length) * Math.PI * 2;
        const fx = CM.clamp(480 + Math.cos(ang) * 300, BOUNDS.x1 + 30, BOUNDS.x2 - 30);
        const fy = CM.clamp(385 + Math.sin(ang) * 130, BOUNDS.y1 + 20, BOUNDS.y2 - 20);
        this.friends.push({
          id: RUNNERS[i], x: fx, y: fy, flip: false,
          phase: CM.rand(0, 1), bobT: CM.rand(0, Math.PI * 2),
          wx: fx, wy: fy,                 // current wander destination
          wanderCd: CM.rand(0.6, 1.8),    // time until next wander target
          tagged: false, giggle: '', giggleT: 0, pop: 0,
          sitX: 0, sitY: 0
        });
      }

      // pet trail (optional cuteness — runs along behind the player)
      this.petTrail = [];
      this.petObj = CM.save.pet ? { x: this.p.x - 26, y: this.p.y + 6, flip: false, moving: false } : null;
    },

    exit() {},

    /* ================= helpers ================= */
    say(text, t) {
      this.hostBubble = { text: text, t: t };
      this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    beginCount() {
      this.state = 'count';
      this.countT = 0;
      this.lastSeg = -1;
      this.say('Go catch them!', 2.6);
    },

    /* ----- particles ----- */
    addPart(p) { if (this.parts.length < MAX_PARTS) this.parts.push(p); },

    burst(x, y, color) {
      const n = 12;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.addPart({
          kind: 'star', x: x, y: y,
          vx: Math.cos(a) * CM.rand(80, 180),
          vy: Math.sin(a) * CM.rand(80, 180) - 40,
          t: 0, life: CM.rand(0.5, 0.9), size: CM.rand(5, 11),
          color: color, rot: CM.rand(0, 6), vr: CM.rand(-6, 6)
        });
      }
      for (let i = 0; i < 4; i++) {
        this.addPart({
          kind: 'heart', x: x + CM.rand(-18, 18), y: y - 10,
          vx: CM.rand(-30, 30), vy: CM.rand(-130, -60),
          t: 0, life: 1.0, size: CM.rand(7, 12), color: CM.pick([P.pink, P.pinkDeep])
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
        if (p.kind === 'star') { p.vy += 130 * dt; p.vx *= 1 - dt * 1.2; p.rot += (p.vr || 0) * dt; }
        else if (p.kind === 'heart') p.vy += 30 * dt;
      }
    },

    /* ----- tagging ----- */
    tagFriend(f) {
      f.tagged = true;
      f.pop = 1;
      f.giggle = CM.pick(GIGGLES);
      f.giggleT = 1.6;
      // where they sit out happily, just clear of the player
      f.sitX = f.x;
      f.sitY = f.y;
      this.tagged++;
      this.score += 60;
      this.shake = 6;
      CM.audio.play('cheer');
      this.burst(f.x, f.y - 40, CM.FRIENDS[f.id].color);
      this.floatText(f.x, f.y - 56, 'Tagged!', P.pinkDeep);
      this.say(CM.pick(HOST_CHEERS), 1.6);

      if (this.tagged >= this.friends.length) {
        // all tagged early → bank the leftover seconds and celebrate
        this.score += Math.max(0, Math.ceil(this.timeLeft));
        this.toDone('You got everyone! 🎉', true);
      }
    },

    toDone(msg, allTagged) {
      this.state = 'done';
      this.doneT = 1.9;
      this.doneMsg = msg;
      this.shake = 8;
      this.say(allTagged ? 'You caught us all!' : 'Great game!', 3);
      CM.audio.play('tada');
      this.burst(this.p.x, this.p.y - 40, P.yellowDeep);
    },

    /* ================= update ================= */
    update(dt) {
      const inp = CM.input;
      // only claim left-side touches for the joystick while actually playing
      this.joystick = this.state === 'play';
      this.shake = Math.max(0, this.shake - dt * 16);
      if (this.hostBubble.t > 0) this.hostBubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      this.tickParts(dt);

      // tagged friends keep bobbing/giggling no matter the state
      for (const f of this.friends) {
        f.bobT += dt;
        if (f.pop > 0) f.pop = Math.max(0, f.pop - dt * 2.5);
        if (f.giggleT > 0) f.giggleT -= dt;
      }

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
            kind: 'star', x: CM.rand(140, 820), y: CM.rand(150, 360),
            vx: CM.rand(-30, 30), vy: CM.rand(-70, -20),
            t: 0, life: 0.9, size: CM.rand(6, 12), rot: CM.rand(0, 6), vr: CM.rand(-4, 4),
            color: CM.pick(['#f6cf5a', '#ffb7d5', '#9ed8f8', '#ffe07a', '#c9a8f0'])
          });
        }
        this.doneT -= dt;
        if (this.doneT <= 0 && !this.finished) {
          this.finished = true;
          CM.finishGame('tag', this.score, CM.clamp(Math.ceil(this.score / 15), 5, 30));
        }
        return;
      }

      /* ----- play ----- */
      this.timeLeft -= dt;
      const tl = Math.ceil(this.timeLeft);
      if (tl <= 8 && tl >= 1 && tl !== this.lastTick) {
        this.lastTick = tl;
        CM.audio.tone(780, 0.06, 'sine', 0.06);
      }
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.toDone("Time's up! 🎉", false);
        return;
      }

      this.updatePlayer(dt);
      this.updateFriends(dt);

      // TOUCH to tag: any untagged friend within range
      for (const f of this.friends) {
        if (f.tagged) continue;
        if (CM.dist(this.p.x, this.p.y - 26, f.x, f.y - 40) < TAG_DIST) {
          this.tagFriend(f);
          if (this.state !== 'play') return; // tagging the last one ended the round
        }
      }

      this.updatePet(dt);
    },

    updatePlayer(dt) {
      const inp = CM.input;
      // mouse / tap: click to walk
      if (inp.mouse.clicked) {
        this.target = {
          x: CM.clamp(inp.mouse.x, BOUNDS.x1, BOUNDS.x2),
          y: CM.clamp(inp.mouse.y, BOUNDS.y1, BOUNDS.y2),
          t: 0, stuck: 0
        };
      }
      // The engine draws a virtual action button in the bottom-right corner while
      // joystick is on, and claims taps there. Tag has no action; turn such a tap
      // into a walk toward that corner so the spot isn't a dead zone.
      if (inp.pressed('action')) {
        this.target = {
          x: CM.clamp(CM.W - 86, BOUNDS.x1, BOUNDS.x2),
          y: CM.clamp(CM.H - 86, BOUNDS.y1, BOUNDS.y2),
          t: 0, stuck: 0
        };
      }

      // axis (keyboard / joystick) takes over from a click target
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
        const speed = PLAYER_SPEED * Math.min(1, len);
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

      // click-target arrival + give up if blocked ~0.5s
      if (this.target) {
        const tgt = this.target;
        tgt.t += dt;
        if (len > 0.15 && !this.moving) tgt.stuck += dt;
        else tgt.stuck = 0;
        if (CM.dist(this.p.x, this.p.y, tgt.x, tgt.y) < 6 || tgt.stuck > 0.5) this.target = null;
      }
    },

    updateFriends(dt) {
      for (const f of this.friends) {
        if (f.tagged) {
          // sit out happily where they were caught (a tiny settle bounce, no roaming)
          f.x += (f.sitX - f.x) * Math.min(1, dt * 6);
          f.y += (f.sitY - f.y) * Math.min(1, dt * 6);
          f.phase = 0;
          continue;
        }

        const dx = f.x - this.p.x;
        const dy = f.y - this.p.y;
        const dPlayer = Math.hypot(dx, dy);

        let vx = 0, vy = 0, speed;
        if (dPlayer < FLEE_DIST) {
          // soft flee: scamper away from the player (slower than the player)
          const d = dPlayer || 1;
          vx = dx / d;
          vy = dy / d;
          // ease the flee speed up as you get closer, so it never feels hopeless
          const t = 1 - dPlayer / FLEE_DIST;
          speed = CM.lerp(WANDER_SPEED, FLEE_SPEED, t);
        } else {
          // lazy wander toward the current roam target
          f.wanderCd -= dt;
          if (f.wanderCd <= 0 || CM.dist(f.x, f.y, f.wx, f.wy) < 16) {
            f.wanderCd = CM.rand(1.0, 2.4);
            f.wx = CM.rand(BOUNDS.x1 + 24, BOUNDS.x2 - 24);
            f.wy = CM.rand(BOUNDS.y1 + 16, BOUNDS.y2 - 16);
          }
          const wdx = f.wx - f.x, wdy = f.wy - f.y;
          const wd = Math.hypot(wdx, wdy) || 1;
          vx = wdx / wd;
          vy = wdy / wd;
          speed = WANDER_SPEED;
        }

        const nx = f.x + vx * speed * dt;
        const ny = f.y + vy * speed * dt;
        const cx = CM.clamp(nx, BOUNDS.x1, BOUNDS.x2);
        const cy = CM.clamp(ny, BOUNDS.y1, BOUNDS.y2);
        // bounce the wander target off the walls so they don't hug an edge
        if (cx !== nx) f.wx = CM.rand(BOUNDS.x1 + 24, BOUNDS.x2 - 24);
        if (cy !== ny) f.wy = CM.rand(BOUNDS.y1 + 16, BOUNDS.y2 - 16);
        f.x = cx;
        f.y = cy;

        const moving = Math.abs(vx) + Math.abs(vy) > 0.01;
        f.phase = moving ? (f.phase + dt * (speed / 55)) % 1 || 0.01 : 0;
        if (Math.abs(vx) > 0.05) f.flip = vx < 0;
      }
    },

    updatePet(dt) {
      if (!this.petObj) return;
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
    },

    /* ================= draw ================= */
    draw(g) {
      const t = CM.time;
      g.save();
      if (this.shake > 0.2) {
        g.translate(CM.rand(-this.shake, this.shake) * 0.7, CM.rand(-this.shake, this.shake) * 0.7);
      }

      this.drawPlayground(g, t);

      /* ----- depth-sorted sprites ----- */
      const sprites = [];

      // host Pochacco cheering from the side
      const happy = this.hostHappy > 0 || this.state === 'done';
      sprites.push({ y: POCHA.y, fn: () => {
        const bob = happy ? (t * 2.4) % 1 : ((t * 0.8) % 1) * 0.35;
        CM.drawFriend(g, 'pochacco', POCHA.x, POCHA.y, 1.1, { bob: bob });
        if (this.hostHappy > 0) {
          const lift = Math.abs(Math.sin(bob * Math.PI * 2)) * 5;
          D.circle(g, POCHA.x + 22, POCHA.y - 58 - lift, 5, '#ffffff', '#dfe5ea', 1.5);
          D.star(g, POCHA.x + 22, POCHA.y - 72 - lift, 6, P.yellowDeep);
        }
        D.rr(g, POCHA.x - 42, POCHA.y + 6, 84, 19, 9, 'rgba(255,255,255,0.85)');
        D.text(g, 'Pochacco', POCHA.x, POCHA.y + 16, { size: 14, color: P.ink, weight: 800 });
      } });

      // the runners
      for (const f of this.friends) {
        sprites.push({ y: f.y, fn: () => this.drawRunner(g, f, t) });
      }

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

      // player (the "IT" kid)
      sprites.push({ y: this.p.y, fn: () => {
        CM.drawPlayer(g, this.p.x, this.p.y, 1.05, this.p.facing, this.p.phase);
        // little "IT" tag floating above so it's clear you're the chaser
        const ty = this.p.y - 104 + Math.sin(t * 3) * 2;
        D.rr(g, this.p.x - 19, ty - 13, 38, 24, 9, P.pinkDeep, '#ffffff', 2.5);
        D.text(g, 'IT!', this.p.x, ty, { size: 15, color: '#ffffff', weight: 800 });
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

      // Pochacco speech bubble on good moments
      if (this.hostBubble.t > 0 && this.state !== 'howto') {
        const txt = this.hostBubble.text;
        const cw = Math.max(96, txt.length * 9 + 26);
        const bx = CM.clamp(POCHA.x - 10, 8, CM.W - cw - 8);
        D.bubble(g, bx, POCHA.y - 150, cw, 40, POCHA.x + 14);
        D.text(g, txt, bx + cw / 2, POCHA.y - 130, { size: 15, weight: 800, color: P.pinkDeep });
      }

      /* ----- particles ----- */
      for (const p of this.parts) {
        g.globalAlpha = Math.max(0, 1 - p.t / p.life);
        if (p.kind === 'star') D.star(g, p.x, p.y, p.size, p.color || P.yellowDeep, p.rot);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, p.color || P.pink);
        else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, { size: 22, color: p.color || P.pinkDeep, weight: 800, stroke: '#ffffff', strokeWidth: 6 });
        }
      }
      g.globalAlpha = 1;

      // count-in overlay
      if (this.state === 'count') {
        const SEGS = ['3', '2', '1', 'Go!'];
        const seg = Math.min(3, Math.floor(this.countT / 0.8));
        const frac = (this.countT - seg * 0.8) / 0.8;
        const size = (seg === 3 ? 70 : 92) * (1 + 0.3 * Math.max(0, 1 - frac * 3));
        D.text(g, SEGS[seg], 480, 300, {
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
        // tagged count, top-left
        D.rr(g, 14, 12, 168, 40, 20, 'rgba(255,255,255,0.88)', '#f0b9d2', 2);
        D.star(g, 36, 32, 12, P.yellowDeep);
        D.text(g, 'Tagged ' + this.tagged + '/' + this.friends.length, 116, 32, { size: 19, color: P.pinkDeep, weight: 800 });
        // small control hint early on
        if (this.state === 'play' && CM.sceneTime < 12) {
          const hint = CM.touchMode ? 'Drag left side to run · or tap where to go' : 'Run: click or WASD / Arrows — touch a friend to tag!';
          D.rr(g, 270, 58, 420, 26, 13, 'rgba(255,255,255,0.55)');
          D.text(g, hint, 480, 71, { size: 14, color: '#7a6b75' });
        }
      }

      /* ----- done banner ----- */
      if (this.state === 'done') {
        D.text(g, this.doneMsg || "Time's up! 🎉", 480, 230, {
          size: 46, color: P.pinkDeep, weight: 800, stroke: '#ffffff', strokeWidth: 10
        });
        D.text(g, 'You tagged ' + this.tagged + (this.tagged === 1 ? ' friend' : ' friends') + ' for ' + this.score + ' points!',
          480, 280, { size: 22, color: P.ink, weight: 800, stroke: '#ffffff', strokeWidth: 6 });
        D.star(g, 250, 210 + Math.sin(t * 5) * 6, 16, P.yellowDeep);
        D.star(g, 710, 210 + Math.cos(t * 5) * 6, 16, P.yellowDeep);
      }

      /* ----- howto overlay ----- */
      if (this.state === 'howto') {
        g.fillStyle = 'rgba(70,40,70,0.25)';
        g.fillRect(0, 0, CM.W, CM.H);
        CM.ui.panel(g, 165, 88, 630, 410, { title: "🏃 Tag — You're It! 🏃" });
        CM.drawFriend(g, 'pochacco', 270, 398, 1.25, { bob: ((t * 1.1) % 1) * 0.5 });
        D.text(g, 'Pochacco', 270, 422, { size: 14, color: P.pinkDeep, weight: 800 });
        D.text(g, "You're IT! The friends are running", 560, 158, { size: 20, color: P.ink, weight: 800 });
        D.text(g, 'around the playground!', 560, 184, { size: 20, color: P.ink, weight: 800 });
        D.text(g, 'Chase them down and run right', 560, 228, { size: 17, color: P.ink });
        D.text(g, 'into a friend to TAG them!', 560, 254, { size: 17, color: P.ink });
        D.text(g, 'Tag all 5 before time runs out!', 560, 298, { size: 18, color: P.pinkDeep, weight: 800 });
        const hint = CM.touchMode ? 'Drag left side to run · or tap where to go' : 'Run: click or WASD / Arrows';
        D.text(g, hint, 560, 338, { size: 14, color: '#9a8a94' });
        if (CM.ui.button(g, 460, 408, 200, 58, '▶ Start!', { color: P.mintDeep, size: 22 })) {
          this.beginCount();
        }
      }
    },

    /* ---------------- runner art ---------------- */
    drawRunner(g, f, t) {
      const bob = f.tagged ? (t * 2.2 + f.bobT) % 1 : (f.phase || ((f.bobT * 0.4) % 1));
      // pop scale on the moment of tagging
      const s = 1 + f.pop * 0.18;
      g.save();
      g.translate(f.x, f.y);
      g.scale(s, s);
      g.translate(-f.x, -f.y);
      CM.drawFriend(g, f.id, f.x, f.y, 1.0, { bob: bob, flip: f.flip });
      g.restore();

      if (f.tagged) {
        // a little happy star floating over a caught friend
        const sy = f.y - 110 + Math.sin(t * 4 + f.bobT) * 3;
        D.star(g, f.x + 18, sy, 8, P.yellowDeep);
        D.star(g, f.x - 16, sy + 6, 5, '#ffe07a');
      }

      // giggle bubble right after being tagged
      if (f.giggleT > 0 && f.giggle) {
        const cw = Math.max(78, f.giggle.length * 8 + 22);
        const bx = CM.clamp(f.x - cw / 2, 8, CM.W - cw - 8);
        const by = f.y - 138;
        g.globalAlpha = CM.clamp(f.giggleT / 0.5, 0, 1);
        D.bubble(g, bx, by, cw, 34, f.x);
        D.text(g, f.giggle, bx + cw / 2, by + 17, { size: 14, weight: 800, color: P.pinkDeep });
        g.globalAlpha = 1;
      }
    },

    /* ---------------- playground scene ---------------- */
    drawPlayground(g, t) {
      // soft blue sky
      const sky = g.createLinearGradient(0, 0, 0, 360);
      sky.addColorStop(0, '#cdeeff');
      sky.addColorStop(1, '#eaf7ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, CM.W, 360);

      // gentle sun, top-left-ish (clear of the reserved top-right chrome)
      D.circle(g, 150, 70, 34, '#fff3b0');
      g.globalAlpha = 0.5;
      D.circle(g, 150, 70, 44, '#fff7cf');
      g.globalAlpha = 1;

      // drifting clouds
      this.drawCloud(g, ((t * 14) % (CM.W + 220)) - 110, 80, 1.0);
      this.drawCloud(g, ((t * 9 + 500) % (CM.W + 260)) - 130, 140, 0.78);
      this.drawCloud(g, ((t * 11 + 260) % (CM.W + 240)) - 120, 50, 0.62);

      // grass ground
      const grass = g.createLinearGradient(0, 300, 0, CM.H);
      grass.addColorStop(0, '#bfe7a8');
      grass.addColorStop(1, '#a7dd8e');
      g.fillStyle = grass;
      g.fillRect(0, 300, CM.W, CM.H - 300);
      // rounded grass horizon
      g.fillStyle = '#bfe7a8';
      g.beginPath();
      g.moveTo(0, 312);
      g.quadraticCurveTo(CM.W / 2, 290, CM.W, 312);
      g.lineTo(CM.W, 340);
      g.lineTo(0, 340);
      g.closePath();
      g.fill();

      // sandy/wood-chip play area where the action happens
      D.ellipse(g, 480, 408, 430, 168, '#f3deb0', '#e3c98a', 4);
      D.ellipse(g, 480, 408, 430, 168, null, 'rgba(255,255,255,0.4)', 2);
      // a few wood-chip speckles
      g.fillStyle = 'rgba(180,140,90,0.25)';
      for (let i = 0; i < 26; i++) {
        const a = (i * 2.39996);                  // golden-angle scatter (stable per index)
        const rr = 30 + (i * 53) % 380;
        const sx = 480 + Math.cos(a) * rr;
        const sy = 408 + Math.sin(a) * rr * 0.39;
        g.save();
        g.translate(sx, sy);
        g.rotate(a);
        g.fillRect(-3, -1, 6, 2);
        g.restore();
      }

      // grass tufts along the front
      g.strokeStyle = '#8fce72';
      g.lineWidth = 3;
      g.lineCap = 'round';
      for (let i = 0; i < 18; i++) {
        const gx = 30 + i * 53;
        const gy = 560 + Math.sin(i * 1.7) * 6;
        g.beginPath();
        g.moveTo(gx, gy); g.lineTo(gx - 4, gy - 10);
        g.moveTo(gx, gy); g.lineTo(gx, gy - 13);
        g.moveTo(gx, gy); g.lineTo(gx + 4, gy - 10);
        g.stroke();
      }

      // a couple of flowers dotted on the grass
      this.drawFlower(g, 60, 330, '#ff9ec7');
      this.drawFlower(g, 905, 322, '#ffe07a');
      this.drawFlower(g, 905, 540, '#c9a8f0');

      // low picket fence across the back
      this.drawFence(g, 318);

      // a slide on the right and swings on the left — cheerful play equipment
      this.drawSlide(g, 800, 318);
      this.drawSwings(g, 240, 300);
    },

    drawCloud(g, x, y, s) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      D.circle(g, 0, 0, 22);
      D.circle(g, 26, 4, 28);
      D.circle(g, 56, 0, 20);
      D.rr(g, -4, 2, 64, 22, 11, 'rgba(255,255,255,0.92)');
      g.restore();
    },

    drawFlower(g, x, y, col) {
      g.strokeStyle = '#6fbc82';
      g.lineWidth = 2.5;
      g.beginPath(); g.moveTo(x, y + 12); g.lineTo(x, y); g.stroke();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        D.circle(g, x + Math.cos(a) * 5.5, y + Math.sin(a) * 5.5, 4.2, col);
      }
      D.circle(g, x, y, 3, '#ffe9a8');
    },

    drawFence(g, y) {
      const top = y - 28;
      // rail
      D.rr(g, 0, top + 10, CM.W, 7, 3, '#fff', '#e7d8c2', 1.5);
      D.rr(g, 0, top + 24, CM.W, 7, 3, '#fff', '#e7d8c2', 1.5);
      // pickets
      for (let x = 6; x < CM.W; x += 46) {
        g.fillStyle = '#ffffff';
        g.strokeStyle = '#e7d8c2';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(x, top + 34);
        g.lineTo(x, top + 2);
        g.lineTo(x + 11, top - 8);
        g.lineTo(x + 22, top + 2);
        g.lineTo(x + 22, top + 34);
        g.closePath();
        g.fill();
        g.stroke();
      }
    },

    drawSlide(g, x, y) {
      D.shadow(g, x, y + 6, 60);
      // ladder/platform posts
      D.rr(g, x + 26, y - 92, 7, 96, 3, '#ffb7d5', '#e87fb2', 2);
      D.rr(g, x + 44, y - 92, 7, 96, 3, '#ffb7d5', '#e87fb2', 2);
      // top platform
      D.rr(g, x + 18, y - 100, 44, 12, 5, '#8ecdf6', '#6aaede', 2);
      // canopy
      g.fillStyle = '#ff9ec7';
      g.beginPath();
      g.moveTo(x + 14, y - 100);
      g.lineTo(x + 40, y - 124);
      g.lineTo(x + 66, y - 100);
      g.closePath();
      g.fill();
      D.circle(g, x + 40, y - 126, 4, '#ffe07a');
      // the slide chute
      g.strokeStyle = '#ffd24a';
      g.lineWidth = 12;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x + 20, y - 86);
      g.quadraticCurveTo(x - 36, y - 30, x - 44, y + 4);
      g.stroke();
      g.strokeStyle = '#ffe39a';
      g.lineWidth = 4;
      g.beginPath();
      g.moveTo(x + 20, y - 86);
      g.quadraticCurveTo(x - 36, y - 30, x - 44, y + 4);
      g.stroke();
    },

    drawSwings(g, x, y) {
      D.shadow(g, x, y + 8, 70);
      // A-frame
      g.strokeStyle = '#b58a5e';
      g.lineWidth = 7;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x - 64, y + 6); g.lineTo(x - 30, y - 86);
      g.moveTo(x + 64, y + 6); g.lineTo(x + 30, y - 86);
      g.stroke();
      // top bar
      D.rr(g, x - 40, y - 92, 80, 9, 4, '#caa074', '#a87f52', 2);
      // two swings, gently swaying
      const sw = Math.sin(CM.time * 1.4) * 6;
      for (let i = 0; i < 2; i++) {
        const sx = x - 18 + i * 36 + (i === 0 ? sw : -sw);
        g.strokeStyle = 'rgba(90,70,50,0.55)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x - 18 + i * 36 - 6, y - 84); g.lineTo(sx - 6, y - 30);
        g.moveTo(x - 18 + i * 36 + 6, y - 84); g.lineTo(sx + 6, y - 30);
        g.stroke();
        D.rr(g, sx - 10, y - 30, 20, 6, 3, i === 0 ? '#8ecdf6' : '#ff9ec7', '#ffffff', 1.5);
      }
    }
  });
})();
