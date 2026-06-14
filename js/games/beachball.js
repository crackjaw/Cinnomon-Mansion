/* Cinnamoroll Mansion — Beach Ball Bounce (poolside, hosted by Pompompurin) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------------- poolside layout ---------------- */
  // The kid runs along the deck near the bottom; the pool water fills the lower band.
  const GAME_TIME = 60;
  const DECK_Y = 470;          // the deck surface the player walks along (feet line)
  const WATER_Y = 412;         // top of the pool water band
  const MOVE_MIN = 90;         // player x clamp
  const MOVE_MAX = 870;
  const PLAYER_SPEED = 360;    // px/s when moving full tilt
  const BUMP_Y = 430;          // height at which the ball auto-bounces off the player
  const BUMP_REACH = 92;       // how wide the player's bump zone is (forgiving)
  const GRAVITY = 520;         // gentle gravity on the ball
  const BOUNCE_VY = -440;      // upward speed after a bump
  const MAX_PARTS = 90;
  const PURIN = { x: 78, y: 470 }; // host cheering from the left of the deck

  // colours for the striped beach ball wedges
  const BALL_COLORS = ['#ff9ec7', '#8ecdf6', '#ffe9a8', '#bdeccd', '#d8c9f2', '#ffffff'];

  CM.registerGame({
    id: 'beachball',
    name: 'Beach Ball Bounce',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';        // howto -> count -> play -> done (-> finish once)
      this.timeLeft = GAME_TIME;
      this.score = 0;
      this.bounces = 0;
      this.combo = 0;
      this.bestCombo = 0;
      this.finished = false;

      // player on the deck
      this.px = 480;
      this.facing = 'down';
      this.phase = 0;

      // beach ball
      this.ball = { x: 480, y: 120, vx: 30, vy: 0, r: 30, spin: 0, squash: 0 };
      this.bumpAnim = 0;          // little crouch/jump for the player after a bump

      this.parts = [];
      this.shake = 0;
      this.countT = 0;
      this.lastSeg = -1;
      this.lastTick = -1;
      this.doneT = 0;

      this.bigMsg = '';
      this.bigMsgT = 0;
      this.host = { text: '', t: 0, happy: 0 };

      // gentle decorative ripples on the water (precomputed phases)
      this.ripples = [];
      for (let i = 0; i < 7; i++) {
        this.ripples.push({ x: CM.rand(40, 920), y: CM.rand(WATER_Y + 20, 575), ph: CM.rand(0, 6.28), sp: CM.rand(0.6, 1.3) });
      }
    },

    exit() {},

    /* ================= particles ================= */
    addPart(p) { if (this.parts.length < MAX_PARTS) this.parts.push(p); },

    // upward sparkle burst on a good bounce
    bumpBurst(x, y) {
      for (let i = 0; i < 8; i++) {
        const a = -Math.PI / 2 + CM.rand(-0.9, 0.9);
        this.addPart({
          kind: 'spark', x: x, y: y,
          vx: Math.cos(a) * CM.rand(40, 150), vy: Math.sin(a) * CM.rand(80, 210),
          t: 0, life: CM.rand(0.4, 0.7), size: CM.rand(4, 8),
          color: CM.pick([P.yellow, '#fff', P.pink, P.mint])
        });
      }
    },

    // big celebration shower (combo milestones)
    celebrate(n) {
      for (let i = 0; i < n; i++) {
        this.addPart({
          kind: Math.random() < 0.5 ? 'star' : 'heart',
          x: CM.rand(260, 700), y: CM.rand(120, 260),
          vx: CM.rand(-90, 90), vy: CM.rand(-180, -40),
          t: 0, life: CM.rand(0.7, 1.3), size: CM.rand(8, 14),
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep]),
          rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
        });
      }
    },

    // water droplets when the ball splashes into the pool
    splash(x, y) {
      for (let i = 0; i < 12; i++) {
        const a = -Math.PI / 2 + CM.rand(-1.0, 1.0);
        this.addPart({
          kind: 'drop', x: x, y: y,
          vx: Math.cos(a) * CM.rand(50, 200), vy: Math.sin(a) * CM.rand(120, 300),
          t: 0, life: CM.rand(0.5, 0.85), size: CM.rand(3, 7),
          color: CM.pick(['#bfe7ff', '#8ecdf6', '#4a9fdc', '#ffffff'])
        });
      }
    },

    floatText(x, y, str, color) {
      this.addPart({ kind: 'txt', x: x, y: y, str: str, color: color, vx: 0, vy: -42, t: 0, life: 1.0 });
    },

    tickParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.t += dt;
        if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'spark') { p.vy += 360 * dt; p.vx *= 1 - dt * 1.1; }
        else if (p.kind === 'drop') { p.vy += 520 * dt; }
        else if (p.kind === 'star' || p.kind === 'heart') { p.vy += 240 * dt; p.rot += p.vr * dt; }
      }
    },

    say(text, t) {
      this.host = { text: text, t: t, happy: Math.max(this.host.happy, 1.2) };
    },

    /* ================= bounce / miss ================= */
    doBounce() {
      const b = this.ball;
      this.bounces++;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);

      // base points grow a touch with combo so a long rally feels great
      const pts = 5 + Math.min(10, this.combo);
      this.score += pts;

      // bounce up with a small sideways nudge so it drifts
      b.vy = BOUNCE_VY;
      b.vx += CM.rand(-90, 90);
      b.vx = CM.clamp(b.vx, -180, 180);
      b.squash = 1;             // squash-and-stretch kick
      this.bumpAnim = 1;        // player hop
      this.shake = Math.max(this.shake, 2.5);

      CM.audio.play('pop');
      this.bumpBurst(b.x, b.y + b.r);
      this.floatText(b.x, b.y - b.r - 6, '+' + pts, '#c98a1f');

      // combo milestone every 5
      if (this.combo % 5 === 0) {
        this.bigMsg = 'Combo x' + this.combo + '!';
        this.bigMsgT = 1.3;
        this.shake = 7;
        this.celebrate(20);
        CM.audio.play(this.combo % 10 === 0 ? 'tada' : 'cheer');
        this.say(this.combo >= 15 ? 'Yummy!! Wow!!' : 'Combo!! Yay!', 1.8);
      } else if (this.combo === 1) {
        this.say('Keep it up!', 1.4);
      }
    },

    doMiss() {
      const b = this.ball;
      // gentle splash, combo resets, ball pops back up to keep playing
      this.combo = 0;
      this.shake = Math.max(this.shake, 4);
      const sx = CM.clamp(b.x, 40, 920);
      this.splash(sx, WATER_Y + 8);
      CM.audio.play('splash');
      this.floatText(sx, WATER_Y - 18, 'Splash!', P.blueDeep);
      this.say('Oops! Try again!', 1.4);

      // pop it back up from where it fell — friendly, never a game over
      b.x = sx;
      b.y = WATER_Y - 6;
      b.vy = -380;
      b.vx = CM.rand(-60, 60);
      b.squash = 0.8;
    },

    beginCount() {
      this.state = 'count';
      this.countT = 0;
      this.lastSeg = -1;
      this.say('Bump it high!', 2.6);
    },

    /* ================= update ================= */
    update(dt) {
      this.shake = Math.max(0, this.shake - dt * 16);
      if (this.host.t > 0) this.host.t -= dt;
      this.host.happy = Math.max(0, this.host.happy - dt);
      if (this.bigMsgT > 0) this.bigMsgT -= dt;
      if (this.bumpAnim > 0) this.bumpAnim = Math.max(0, this.bumpAnim - dt * 3.2);
      this.tickParts(dt);

      // animate water ripples (purely decorative)
      for (const r of this.ripples) r.ph += dt * r.sp;

      // ball spin/squash settle every frame so they read nicely
      const b = this.ball;
      if (b.squash > 0) b.squash = Math.max(0, b.squash - dt * 4);

      /* ----- howto ----- */
      if (this.state === 'howto') {
        if (CM.input.pressed('action')) this.beginCount();
        return;
      }

      /* ----- count-in: 3..2..1..Go ----- */
      if (this.state === 'count') {
        this.countT += dt;
        // keep the ball gently hovering during the count-in
        b.y = 150 + Math.sin(this.countT * 2) * 18;
        b.spin += dt * 0.6;
        const seg = Math.floor(this.countT / 0.8);
        if (seg !== this.lastSeg && seg <= 3) {
          this.lastSeg = seg;
          if (seg < 3) CM.audio.tone(620 + seg * 90, 0.14, 'triangle', 0.12);
          else CM.audio.play('ding');
        }
        if (this.countT >= 3.4) {
          this.state = 'play';
          this.lastTick = -1;
          b.vy = 40;            // drop it gently into play
          b.vx = CM.rand(-40, 40);
        }
        // still let the player slide into position during the count-in
        this.movePlayer(dt);
        return;
      }

      /* ----- done: brief celebrate, then finish exactly once ----- */
      if (this.state === 'done') {
        // ball drifts up out of the way, sparkles rain
        b.y += b.vy * dt;
        b.vy += GRAVITY * 0.3 * dt;
        b.spin += dt * 2;
        if (this.parts.length < 60 && Math.random() < 0.35) {
          this.addPart({
            kind: 'star', x: CM.rand(200, 760), y: CM.rand(110, 260),
            vx: CM.rand(-30, 30), vy: CM.rand(-60, -10),
            t: 0, life: 1.0, size: CM.rand(7, 13),
            color: CM.pick([P.yellow, P.pink, P.mint, P.lavender]), rot: CM.rand(0, 6), vr: CM.rand(-3, 3)
          });
        }
        this.doneT -= dt;
        if (this.doneT <= 0 && !this.finished) {
          this.finished = true;
          CM.finishGame('beachball', this.score, CM.clamp(Math.ceil(this.score / 15), 5, 30));
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
        this.state = 'done';
        this.doneT = 1.9;
        this.shake = 7;
        this.bigMsg = '';
        this.say('Great bouncing!', 3);
        CM.audio.play('tada');
        this.celebrate(24);
        b.vy = -160;            // float the ball away
        return;
      }

      this.movePlayer(dt);

      // ball physics
      b.vy += GRAVITY * dt;
      b.y += b.vy * dt;
      b.x += b.vx * dt;
      b.spin += b.vx * dt * 0.01 + dt * 0.4;

      // soft walls so it never escapes (gentle bounce inward)
      if (b.x < b.r + 12) { b.x = b.r + 12; b.vx = Math.abs(b.vx) * 0.8 + 20; }
      else if (b.x > CM.W - b.r - 12) { b.x = CM.W - b.r - 12; b.vx = -Math.abs(b.vx) * 0.8 - 20; }

      // auto-bounce when the ball reaches the bump zone over the player
      if (b.vy > 0 && b.y + b.r >= BUMP_Y) {
        const reach = BUMP_REACH + b.r;
        if (Math.abs(b.x - this.px) <= reach) {
          // nudge horizontal velocity toward where it hit relative to player centre
          b.vx += CM.clamp((b.x - this.px) * 1.6, -70, 70);
          this.doBounce();
        } else if (b.y - b.r > WATER_Y) {
          // missed the player and dropped into the water
          this.doMiss();
        }
      }
    },

    // left/right movement: arrows/A-D, OR tapping/holding the left vs right screen half
    movePlayer(dt) {
      const inp = CM.input;
      let ax = inp.axisX();   // keyboard + touch joystick (we don't use joystick flag, so this is keys)
      // pointer steering: hold left/right half of the screen relative to the player
      if (inp.mouse.down) {
        const target = inp.mouse.x;
        const d = target - this.px;
        if (Math.abs(d) > 6) ax = CM.clamp(d / 60, -1, 1);
        else ax = 0;
      }
      if (Math.abs(ax) > 0.05) {
        this.px = CM.clamp(this.px + ax * PLAYER_SPEED * dt, MOVE_MIN, MOVE_MAX);
        this.facing = ax > 0 ? 'right' : 'left';
        this.phase = (this.phase + dt * 2.8) % 1 || 0.01;
      } else {
        this.phase = 0;
        this.facing = 'down';
      }
    },

    /* ================= draw ================= */
    draw(g) {
      const t = CM.time;
      g.save();
      if (this.shake > 0.2) {
        g.translate(CM.rand(-this.shake, this.shake) * 0.7, CM.rand(-this.shake, this.shake) * 0.7);
      }

      this.drawScene(g, t);

      // the beach ball (drawn above the deck props, below HUD)
      const showBall = this.state !== 'howto';
      if (showBall) this.drawBall(g);

      // the player on the deck (their customized character)
      const hop = Math.sin(this.bumpAnim * Math.PI) * 10;
      CM.drawPlayer(g, this.px, DECK_Y - hop, 1.05, this.facing, this.phase);

      // Pompompurin cheering from the left of the deck
      const happy = this.host.happy > 0 || this.state === 'done';
      const bob = happy ? (t * 2.6) % 1 : ((t * 0.8) % 1) * 0.35;
      CM.drawFriend(g, 'pompompurin', PURIN.x, PURIN.y, 1.12, { bob: bob });
      if (this.host.happy > 0) {
        // a little raised-paw thumbs up with a star
        const lift = Math.abs(Math.sin(bob * Math.PI * 2)) * 5;
        D.star(g, PURIN.x + 26, PURIN.y - 70 - lift, 7, P.yellowDeep);
      }

      // particles
      this.drawParts(g);

      // count-in overlay
      if (this.state === 'count') {
        const SEGS = ['3', '2', '1', 'Go!'];
        const seg = Math.min(3, Math.floor(this.countT / 0.8));
        const frac = (this.countT - seg * 0.8) / 0.8;
        const size = (seg === 3 ? 70 : 92) * (1 + 0.3 * Math.max(0, 1 - frac * 3));
        D.text(g, SEGS[seg], 480, 250, {
          size: Math.round(size), color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
        });
      }

      g.restore(); // end shake — context back to normal

      /* ----- HUD (not shaken) ----- */
      if (this.state !== 'howto') this.drawHud(g, t);

      // host speech bubble on good moments
      if (this.host.t > 0 && this.state !== 'howto') {
        const txt = this.host.text;
        const cw = Math.max(96, txt.length * 9 + 26);
        const bx = CM.clamp(PURIN.x - 10, 8, CM.W - cw - 8);
        D.bubble(g, bx, PURIN.y - 156, cw, 40, PURIN.x + 14);
        D.text(g, txt, bx + cw / 2, PURIN.y - 136, { size: 15, weight: 800, color: P.pinkDeep });
      }

      // big combo banner
      if (this.bigMsgT > 0 && this.bigMsg && this.state === 'play') {
        const el = 1.3 - this.bigMsgT;
        const sc = Math.min(1, el * 5);
        D.text(g, this.bigMsg, 480, 200, {
          size: 30 + 34 * sc, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 9
        });
        D.star(g, 320, 200, 18, P.yellowDeep, t * 2.5);
        D.star(g, 640, 200, 18, P.yellowDeep, -t * 2.5);
      }

      /* ----- done banner ----- */
      if (this.state === 'done') {
        D.text(g, 'Time\'s up! 🎉', 480, 210, {
          size: 46, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
        });
        D.text(g, this.bounces + ' bounces · best combo x' + this.bestCombo + '!',
          480, 258, { size: 22, color: P.ink, weight: 800, stroke: '#fff', strokeWidth: 6 });
        D.star(g, 250, 200 + Math.sin(t * 5) * 6, 16, P.yellowDeep);
        D.star(g, 710, 200 + Math.cos(t * 5) * 6, 16, P.yellowDeep);
      }

      /* ----- howto overlay ----- */
      if (this.state === 'howto') this.drawHowto(g, t);
    },

    drawHud(g, t) {
      // big friendly countdown, top-center
      const tl = Math.max(0, Math.ceil(this.timeLeft));
      const urgent = tl <= 8 && this.state === 'play';
      const pulse = urgent ? 1 + Math.sin(t * 7) * 0.07 : 1;
      D.rr(g, 416, 10, 128, 44, 22, 'rgba(255,255,255,0.9)', urgent ? P.red : '#f0b9d2', 3);
      D.text(g, '⏱ ' + tl, 480, 33, {
        size: Math.round(27 * pulse), color: urgent ? P.red : P.blueDeep, weight: 800
      });
      // score, top-left
      D.rr(g, 14, 12, 160, 40, 20, 'rgba(255,255,255,0.88)', '#f0b9d2', 2);
      D.coin(g, 36, 32, 12);
      D.text(g, String(this.score), 100, 32, { size: 22, color: '#c98a1f', weight: 800 });
      // combo badge, top-left under the score (only while it's going)
      if (this.combo >= 2 && this.state === 'play') {
        D.rr(g, 14, 58, 160, 32, 16, 'rgba(255,255,255,0.85)', P.mintDeep, 2);
        D.text(g, 'Combo x' + this.combo, 94, 74, { size: 17, color: P.mintDeep, weight: 800 });
      }
      // control hint early on
      if (this.state === 'play' && CM.sceneTime < 12) {
        const hint = CM.touchMode ? 'Touch left or right to slide under the ball!' : 'Slide with ← → or A / D — stay under the ball!';
        D.rr(g, 250, 560, 460, 28, 14, 'rgba(255,255,255,0.6)');
        D.text(g, hint, 480, 574, { size: 14, color: P.blueDeep, weight: 800 });
      }
    },

    /* ---------------- poolside scene art ---------------- */
    drawScene(g, t) {
      // soft blue sky
      const sg = g.createLinearGradient(0, 0, 0, WATER_Y);
      sg.addColorStop(0, '#d8f1ff');
      sg.addColorStop(1, '#bfe7ff');
      g.fillStyle = sg;
      g.fillRect(0, 0, CM.W, WATER_Y);

      // a friendly sun with rays, top-left-ish
      const sunX = 110, sunY = 80;
      g.save();
      g.globalAlpha = 0.5;
      g.strokeStyle = '#ffe9a8';
      g.lineWidth = 5;
      g.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + t * 0.15;
        g.beginPath();
        g.moveTo(sunX + Math.cos(a) * 40, sunY + Math.sin(a) * 40);
        g.lineTo(sunX + Math.cos(a) * 54, sunY + Math.sin(a) * 54);
        g.stroke();
      }
      g.restore();
      D.circle(g, sunX, sunY, 34, '#ffe9a8');
      D.circle(g, sunX, sunY, 26, '#fff3c4');

      // puffy clouds drifting slowly
      this.drawCloud(g, ((t * 14) % 1200) - 200, 70, 1.0);
      this.drawCloud(g, ((t * 9 + 500) % 1200) - 200, 130, 0.75);
      this.drawCloud(g, ((t * 11 + 900) % 1200) - 200, 50, 0.6);

      // pool water band (blue -> deeper) with sparkling ripples
      const wg = g.createLinearGradient(0, WATER_Y, 0, CM.H);
      wg.addColorStop(0, P.blue);
      wg.addColorStop(0.55, '#6cb8ec');
      wg.addColorStop(1, P.blueDeep);
      g.fillStyle = wg;
      g.fillRect(0, WATER_Y, CM.W, CM.H - WATER_Y);
      // bright lip where the deck meets the water
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fillRect(0, WATER_Y, CM.W, 4);

      // gentle wavy ripple highlights
      g.strokeStyle = 'rgba(255,255,255,0.4)';
      g.lineWidth = 3;
      g.lineCap = 'round';
      for (let row = 0; row < 4; row++) {
        const yBase = WATER_Y + 24 + row * 36;
        g.beginPath();
        for (let x = -20; x <= CM.W + 20; x += 14) {
          const yy = yBase + Math.sin(x * 0.05 + t * 1.3 + row) * 5;
          if (x === -20) g.moveTo(x, yy); else g.lineTo(x, yy);
        }
        g.stroke();
      }
      // twinkling sparkles on the water
      for (const r of this.ripples) {
        const tw = 0.5 + 0.5 * Math.sin(r.ph);
        if (tw > 0.55) {
          g.globalAlpha = (tw - 0.55) / 0.45;
          D.star(g, r.x, r.y, 4 + tw * 2, 'rgba(255,255,255,0.9)');
        }
      }
      g.globalAlpha = 1;

      // the pale-tile pool deck (a band the player walks on, in front of the water)
      const DECK_TOP = DECK_Y - 6;
      g.fillStyle = '#fbe7d2';
      g.fillRect(0, DECK_TOP, CM.W, CM.H - DECK_TOP);
      // tile seams
      g.strokeStyle = 'rgba(190,150,110,0.25)';
      g.lineWidth = 2;
      for (let x = 0; x <= CM.W; x += 60) {
        g.beginPath(); g.moveTo(x, DECK_TOP); g.lineTo(x, CM.H); g.stroke();
      }
      for (let y = DECK_TOP + 30; y < CM.H; y += 38) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(CM.W, y); g.stroke();
      }
      // soft edge highlight along the deck top
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(0, DECK_TOP, CM.W, 3);

      // poolside props (behind the player, near the back of the deck)
      this.drawUmbrella(g, 800, WATER_Y - 4, t);     // sits at the pool edge
      this.drawDeckChair(g, 690, WATER_Y - 2);
      this.drawFloat(g, 250, WATER_Y + 70, t);        // a float bobbing in the water
      this.drawLadder(g, 905, WATER_Y);
      this.drawBeachBallProp(g, 175, WATER_Y - 2);    // a little resting ball deco
    },

    drawCloud(g, x, y, s) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.fillStyle = 'rgba(255,255,255,0.9)';
      D.ellipse(g, 0, 0, 34, 22, 'rgba(255,255,255,0.92)');
      D.ellipse(g, -30, 6, 24, 17, 'rgba(255,255,255,0.92)');
      D.ellipse(g, 30, 6, 26, 18, 'rgba(255,255,255,0.92)');
      D.ellipse(g, 0, 10, 40, 16, 'rgba(255,255,255,0.92)');
      g.restore();
    },

    drawUmbrella(g, x, baseY, t) {
      // pole
      D.rr(g, x - 3, baseY - 150, 6, 150, 3, '#d8a36a', '#b9824c', 1.5);
      // striped canopy
      const cy = baseY - 150;
      const colsU = ['#ff9ec7', '#fff', '#8ecdf6', '#fff', '#ffe9a8', '#fff', '#bdeccd', '#fff'];
      const rad = 78;
      const wob = Math.sin(t * 1.1) * 0.03;
      for (let i = 0; i < 8; i++) {
        const a0 = Math.PI + (i / 8) * Math.PI + wob;
        const a1 = Math.PI + ((i + 1) / 8) * Math.PI + wob;
        g.fillStyle = colsU[i % colsU.length];
        g.beginPath();
        g.moveTo(x, cy);
        g.lineTo(x + Math.cos(a0) * rad, cy + Math.sin(a0) * rad * 0.55);
        g.lineTo(x + Math.cos(a1) * rad, cy + Math.sin(a1) * rad * 0.55);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = 'rgba(180,130,150,0.4)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.ellipse(x, cy, rad, rad * 0.55, 0, Math.PI, Math.PI * 2);
      g.stroke();
      D.circle(g, x, cy - 4, 4, '#ff9ec7');
    },

    drawDeckChair(g, x, y) {
      D.shadow(g, x, y + 4, 40);
      // seat back (reclined) + seat
      g.save();
      D.rr(g, x - 34, y - 46, 50, 14, 6, '#8ecdf6', '#6aaede', 2.5);
      D.rr(g, x - 18, y - 14, 64, 14, 6, '#a8d8f8', '#6aaede', 2.5);
      // legs
      g.strokeStyle = '#e8c39a'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 30, y - 32); g.lineTo(x - 36, y + 2); g.stroke();
      g.beginPath(); g.moveTo(x + 40, y); g.lineTo(x + 46, y + 8); g.stroke();
      g.restore();
    },

    drawFloat(g, x, y, t) {
      // a pink ring float bobbing in the water
      const bob = Math.sin(t * 1.6 + x) * 4;
      const yy = y + bob;
      D.ellipse(g, x, yy + 6, 44, 14, 'rgba(40,90,140,0.18)'); // water shadow
      D.circle(g, x, yy, 34, P.pink, '#e87fb2', 4);
      D.circle(g, x, yy, 15, '#bfe7ff');                       // hole shows water
      // highlight
      D.ellipse(g, x - 12, yy - 14, 8, 4, 'rgba(255,255,255,0.7)');
    },

    drawLadder(g, x, topY) {
      g.strokeStyle = '#cfd8de'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 14, topY - 30); g.lineTo(x - 14, topY + 90); g.stroke();
      g.beginPath(); g.moveTo(x + 2, topY - 30); g.lineTo(x + 2, topY + 90); g.stroke();
      // curved top handles
      g.beginPath(); g.arc(x - 6, topY - 30, 8, Math.PI, Math.PI * 2); g.stroke();
      g.lineWidth = 4;
      for (let i = 0; i < 4; i++) {
        const ry = topY + i * 26;
        g.beginPath(); g.moveTo(x - 14, ry); g.lineTo(x + 2, ry); g.stroke();
      }
    },

    drawBeachBallProp(g, x, y) {
      // a tiny resting striped ball as deck decoration
      D.shadow(g, x, y + 2, 16);
      this.drawStripedBall(g, x, y - 14, 15, 0.6);
    },

    /* ---------------- the beach ball ---------------- */
    drawBall(g) {
      const b = this.ball;
      // ground/water shadow follows the ball's x, scaled by height
      const shY = b.y < BUMP_Y ? WATER_Y + 6 : DECK_Y - 2;
      const high = CM.clamp(1 - (shY - b.y) / 400, 0.3, 1);
      D.shadow(g, b.x, shY, b.r * high * 1.1, b.r * high * 0.4);

      g.save();
      g.translate(b.x, b.y);
      // squash-and-stretch
      const sq = b.squash;
      g.scale(1 + sq * 0.18, 1 - sq * 0.18);
      this.drawStripedBall(g, 0, 0, b.r, b.spin);
      g.restore();
    },

    // draws a colourful striped beach ball centered at (cx,cy)
    drawStripedBall(g, cx, cy, r, spin) {
      g.save();
      g.translate(cx, cy);
      g.rotate(spin);
      // wedge stripes
      const n = BALL_COLORS.length;
      for (let i = 0; i < n; i++) {
        const a0 = (i / n) * Math.PI * 2;
        const a1 = ((i + 1) / n) * Math.PI * 2;
        g.fillStyle = BALL_COLORS[i];
        g.beginPath();
        g.moveTo(0, 0);
        g.arc(0, 0, r, a0, a1);
        g.closePath();
        g.fill();
      }
      // outline + little hub
      D.circle(g, 0, 0, r, null, 'rgba(120,90,110,0.25)', 2.5);
      D.circle(g, 0, 0, r * 0.18, '#fff', 'rgba(120,90,110,0.25)', 1.5);
      g.restore();
      // glossy highlight (not rotated, so it reads as a fixed light source)
      D.circle(g, cx - r * 0.32, cy - r * 0.34, r * 0.26, 'rgba(255,255,255,0.55)');
    },

    /* ---------------- particles ---------------- */
    drawParts(g) {
      for (const p of this.parts) {
        g.globalAlpha = Math.max(0, 1 - p.t / p.life);
        if (p.kind === 'star') D.star(g, p.x, p.y, p.size, p.color || P.yellowDeep, p.rot || 0);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, p.color || P.pink);
        else if (p.kind === 'drop') D.circle(g, p.x, p.y, p.size, p.color || P.blue);
        else if (p.kind === 'spark') D.star(g, p.x, p.y, p.size, p.color || P.yellow);
        else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, { size: 20, color: p.color || '#c98a1f', weight: 800, stroke: '#fff', strokeWidth: 5 });
        }
      }
      g.globalAlpha = 1;
    },

    /* ---------------- howto overlay ---------------- */
    drawHowto(g, t) {
      g.fillStyle = 'rgba(70,40,70,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 165, 92, 630, 396, { title: '🏖️ Beach Ball Bounce 🏖️' });
      CM.drawFriend(g, 'pompompurin', 270, 392, 1.25, { bob: ((t * 1.1) % 1) * 0.5 });
      D.text(g, 'Pompompurin', 270, 416, { size: 14, color: P.pinkDeep, weight: 800 });
      // a spinning demo ball
      this.drawStripedBall(g, 270, 250, 26, t * 1.2);
      D.text(g, 'Keep the beach ball up!', 575, 166, { size: 22, color: P.ink, weight: 800 });
      D.text(g, 'Slide left & right to stay', 575, 210, { size: 17, color: P.ink });
      D.text(g, 'under the falling ball.', 575, 234, { size: 17, color: P.ink });
      D.text(g, 'It bounces back up by itself!', 575, 274, { size: 17, color: P.blueDeep, weight: 800 });
      D.text(g, 'Chain bounces for a big COMBO! ✨', 575, 314, { size: 17, color: P.pinkDeep, weight: 800 });
      const hint = CM.touchMode ? 'Touch the left or right side to move' : 'Move with ← →  or  A / D';
      D.text(g, hint, 575, 352, { size: 14, color: '#9a8a94' });
      if (CM.ui.button(g, 475, 396, 200, 58, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.beginCount();
      }
    }
  });
})();
