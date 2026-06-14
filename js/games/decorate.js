/* Cinnamoroll Mansion — Frost the Cupcakes (hosted by Cinnamoroll) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ============================================================
     A cute "Cooking Mama"-style cupcake decorating game.
     An ORDER CARD shows a target frosting COLOR + a TOPPING.
     The child taps the matching frosting button (a swirl pipes on),
     then the matching topping button (it lands with sparkles).
     Match both -> the cupcake is served ("Yum!"), a new order appears.
     Wrong taps are gentle: a tiny shake + "oops", no real penalty.
     ============================================================ */

  // ---- frosting flavours (button color + the piped swirl color) ----
  const FROSTINGS = {
    pink:      { label: 'Pink',  color: '#ff9ec7', deep: '#e87fb2' },
    blue:      { label: 'Blue',  color: '#8ecdf6', deep: '#5aa6d8' },
    mint:      { label: 'Mint',  color: '#9adcae', deep: '#5fb377' },
    chocolate: { label: 'Choco', color: '#b07a4e', deep: '#7a4a2a' }
  };
  const FROST_IDS = ['pink', 'blue', 'mint', 'chocolate'];

  // ---- toppings (icon drawn on the button + on the cupcake) ----
  const TOPPINGS = {
    cherry:    { label: 'Cherry' },
    star:      { label: 'Star' },
    sprinkles: { label: 'Sprinkles' },
    heart:     { label: 'Heart' }
  };
  const TOP_IDS = ['cherry', 'star', 'sprinkles', 'heart'];

  const TOTAL_CUPCAKES = 6;     // session length
  const PTS_FROST = 20;         // points for frosting correctly
  const PTS_TOP = 20;           // points for topping correctly
  const PTS_PERFECT = 25;       // bonus for a clean (no-wrong-tap) cupcake
  const MAX_PARTS = 90;

  const CINNA = { x: 132, y: 470 }; // host friend, lower-left in an apron

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  /* shuffle a small array in place (Fisher–Yates) */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  CM.registerGame({
    id: 'decorate',
    name: 'Frost the Cupcakes',

    /* ---------------- lifecycle ---------------- */
    enter() {
      this.state = 'howto';     // howto -> play -> done (-> finish once)
      this.score = 0;
      this.finished = false;

      this.idx = 0;             // which cupcake (0..TOTAL_CUPCAKES-1)
      this.order = null;        // current target { frost, top }
      this.hasFrost = false;    // frosting piped on yet?
      this.hasTop = false;      // topping placed yet?
      this.cupClean = true;     // no wrong taps on this cupcake?

      this.frostGrow = 0;       // 0..1 swirl pipe-on animation
      this.topPop = 0;          // 0..1 topping bounce-in animation
      this.servedT = 0;         // >0 while the finished cupcake slides away
      this.cupBounce = 0;       // squash on the plate
      this.platePop = 0;        // new-plate entrance

      this.shake = 0;
      this.bubble = '';
      this.bubbleT = 0;
      this.hostHappy = 0;

      this.parts = [];
      this.doneT = 0;

      // build big tappable buttons across the bottom
      this.buildButtons();
      // first order is created when play starts (so howto shows a plain cupcake)
    },

    exit() {},

    /* ---------------- button layout (4 frosting + 4 topping) ---------------- */
    buildButtons() {
      this.frostBtns = [];
      this.topBtns = [];

      // two rows of four big buttons along the bottom
      const bw = 132, bh = 70, gap = 18;
      const totalW = 4 * bw + 3 * gap;
      const startX = (CM.W - totalW) / 2;

      const rowFrostY = 446;
      const rowTopY = 524;

      for (let i = 0; i < FROST_IDS.length; i++) {
        this.frostBtns.push({
          id: FROST_IDS[i],
          x: startX + i * (bw + gap), y: rowFrostY, w: bw, h: bh, wob: 0
        });
      }
      for (let i = 0; i < TOP_IDS.length; i++) {
        this.topBtns.push({
          id: TOP_IDS[i],
          x: startX + i * (bw + gap), y: rowTopY, w: bw, h: bh, wob: 0
        });
      }
    },

    /* ---------------- make a fresh order + plain cupcake ---------------- */
    newOrder() {
      this.order = {
        frost: CM.pick(FROST_IDS),
        top: CM.pick(TOP_IDS)
      };
      this.hasFrost = false;
      this.hasTop = false;
      this.cupClean = true;
      this.frostGrow = 0;
      this.topPop = 0;
      this.servedT = 0;
      this.platePop = 1;        // little entrance bounce for the new plate
    },

    /* ---------------- particles / juice ---------------- */
    addPart(p) { if (this.parts.length < MAX_PARTS) { p.maxLife = p.life; this.parts.push(p); } },

    sparkle(x, y, color, n) {
      n = n || 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + CM.rand(-0.2, 0.2);
        this.addPart({
          kind: Math.random() < 0.55 ? 'star' : 'heart',
          x: x, y: y,
          vx: Math.cos(a) * CM.rand(60, 170),
          vy: Math.sin(a) * CM.rand(60, 170) - 50,
          life: CM.rand(0.5, 1.0), size: CM.rand(7, 13),
          color: color, rot: CM.rand(0, 6), vr: CM.rand(-5, 5)
        });
      }
    },

    floatText(x, y, str, color) {
      this.addPart({ kind: 'txt', x: x, y: y, str: str, color: color, vx: 0, vy: -42, life: 1.2 });
    },

    confetti() {
      if (this.parts.length > MAX_PARTS - 6) return;
      this.addPart({
        kind: Math.random() < 0.5 ? 'star' : 'heart',
        x: CM.rand(120, 840), y: CM.rand(110, 300),
        vx: CM.rand(-30, 30), vy: CM.rand(-60, -10),
        life: CM.rand(0.7, 1.2), size: CM.rand(8, 13),
        color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
        rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
      });
    },

    tickParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= dt;
        if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'txt') { /* just floats up */ }
        else { p.vy += 240 * dt; p.rot += (p.vr || 0) * dt; }
      }
    },

    say(text, t) {
      this.bubble = text;
      this.bubbleT = t;
      this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    /* ---------------- handling a frosting / topping tap ---------------- */
    tapFrost(b) {
      if (this.hasFrost) return;            // already frosted
      if (b.id === this.order.frost) {
        this.hasFrost = true;
        this.frostGrow = 0.001;             // start the pipe-on animation
        this.score += PTS_FROST;
        this.cupBounce = 1;
        this.shake = 3;
        CM.audio.play('pop');
        CM.audio.tone(520, 0.12, 'sine', 0.1, 0, 720);
        this.sparkle(480, 250, FROSTINGS[b.id].deep, 6);
        this.floatText(480, 190, '+' + PTS_FROST, FROSTINGS[b.id].deep);
        this.say(CM.pick(['Yummy frosting!', 'Swirl it on!', 'So pretty!']), 1.3);
      } else {
        this.wrongTap(b);
      }
    },

    tapTop(b) {
      if (!this.hasFrost) {                 // frosting comes first — gentle nudge
        b.wob = 1;
        CM.audio.play('click');
        this.say('Frosting first! 🧁', 1.3);
        return;
      }
      if (this.hasTop) return;              // already topped
      if (b.id === this.order.top) {
        this.hasTop = true;
        this.topPop = 0.001;                // bounce-in animation
        this.score += PTS_TOP;
        this.cupBounce = 1;
        this.shake = 4;
        CM.audio.play('ding');
        this.sparkle(480, 196, P.yellowDeep, 10);
        this.floatText(480, 170, '+' + PTS_TOP, P.pinkDeep);
        this.serve();                       // both done -> serve it!
      } else {
        this.wrongTap(b);
      }
    },

    wrongTap(b) {
      // GENTLE: tiny shake + "oops", no points lost, order stays so they retry.
      b.wob = 1;
      this.cupClean = false;
      this.shake = 3;
      CM.audio.play('click');
      CM.audio.tone(220, 0.1, 'sine', 0.08);
      this.say(CM.pick(['Oops, try again!', 'Check the order! 📋', 'Not that one!']), 1.3);
    },

    /* ---------------- a completed cupcake is served ---------------- */
    serve() {
      let gained = 'Yum!';
      if (this.cupClean) {
        this.score += PTS_PERFECT;
        gained = 'Perfect! 🌟';
        this.floatText(480, 132, '+' + PTS_PERFECT + ' perfect!', P.mintDeep);
      }
      this.servedT = 0.001;                 // start the slide-away
      this.cupBounce = 1;
      this.shake = 6;
      CM.audio.play('cheer');
      this.sparkle(480, 240, P.pink, 12);
      this.floatText(480, 210, 'Yum!', P.pinkDeep);
      this.say(gained, 1.6);
    },

    /* ---------------- update ---------------- */
    update(dt) {
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 14);
      if (this.bubbleT > 0) this.bubbleT -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      if (this.cupBounce > 0) this.cupBounce = Math.max(0, this.cupBounce - dt * 4);
      if (this.platePop > 0) this.platePop = Math.max(0, this.platePop - dt * 3);
      if (this.frostGrow > 0 && this.frostGrow < 1) this.frostGrow = Math.min(1, this.frostGrow + dt * 4);
      if (this.topPop > 0 && this.topPop < 1) this.topPop = Math.min(1, this.topPop + dt * 5);
      this.tickParts(dt);

      // settle button wobbles
      const allBtns = (this.frostBtns || []).concat(this.topBtns || []);
      for (const b of allBtns) if (b.wob > 0) b.wob = Math.max(0, b.wob - dt * 2.2);

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.startPlay();
          break;

        case 'play':
          // while a served cupcake slides away, hold input briefly
          if (this.servedT > 0) {
            this.servedT += dt;
            if (this.servedT >= 0.7) {
              this.idx++;
              if (this.idx >= TOTAL_CUPCAKES) {
                this.state = 'done';
                this.doneT = 2.0;
                this.shake = 8;
                CM.audio.play('tada');
                for (let i = 0; i < 14; i++) this.confetti();
                this.sparkle(480, 240, P.pink, 14);
              } else {
                this.newOrder();
              }
            }
            break;
          }
          // accept taps on the buttons
          this.handleTaps();
          break;

        case 'done':
          if (Math.random() < 0.35) this.confetti();
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('decorate', this.score, CM.clamp(Math.ceil(this.score / 18), 5, 30));
          }
          break;
      }
    },

    handleTaps() {
      const m = CM.input.mouse;
      if (!m.clicked) return;
      // frosting row
      for (const b of this.frostBtns) {
        if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) {
          this.tapFrost(b);
          return;
        }
      }
      // topping row
      for (const b of this.topBtns) {
        if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) {
          this.tapTop(b);
          return;
        }
      }
    },

    startPlay() {
      this.state = 'play';
      this.idx = 0;
      this.newOrder();
      this.say('Let\'s decorate! 🧁', 1.5);
    },

    /* ============================================================
       DRAW
       ============================================================ */
    draw(g) {
      g.save();
      if (this.shake > 0.2) {
        g.translate(CM.rand(-this.shake, this.shake) * 0.7, CM.rand(-this.shake, this.shake) * 0.7);
      }

      this.drawCafe(g);

      // Cinnamoroll the chef, lower-left, cheering on good work
      const happy = this.hostHappy > 0 || this.state === 'done';
      CM.drawFriend(g, 'cinnamoroll', CINNA.x, CINNA.y, 1.25, {
        bob: happy ? (CM.time * 2.4) % 1 : ((CM.time * 0.9) % 1) * 0.4
      });
      this.drawApron(g, CINNA.x, CINNA.y);
      D.rr(g, CINNA.x - 56, CINNA.y + 8, 112, 22, 11, 'rgba(255,255,255,0.85)');
      D.text(g, 'Cinnamoroll', CINNA.x, CINNA.y + 19, { size: 15, color: P.ink, weight: 800 });

      if (this.state === 'play' || this.state === 'done') {
        this.drawOrderCard(g);
        this.drawCupcakeScene(g);
        this.drawButtons(g);
      }

      // particles above everything
      this.drawParts(g);

      g.restore(); // end shake

      // speech bubble (not shaken)
      if (this.bubbleT > 0 && this.state !== 'howto') {
        const txt = this.bubble;
        const cw = Math.max(130, txt.length * 10 + 30);
        const bx = CM.clamp(CINNA.x - 18, 8, CM.W - cw - 8);
        D.bubble(g, bx, CINNA.y - 150, cw, 44, CINNA.x + 16);
        D.text(g, txt, bx + cw / 2, CINNA.y - 128, { size: 17, weight: 800, color: P.pinkDeep });
      }

      // HUD
      if (this.state === 'play' || this.state === 'done') this.drawHud(g);

      // overlays
      if (this.state === 'done') this.drawDone(g);
      if (this.state === 'howto') this.drawHowto(g);
    },

    /* ---------------- cozy pastel cafe backdrop ---------------- */
    drawCafe(g) {
      const wg = g.createLinearGradient(0, 0, 0, CM.H);
      wg.addColorStop(0, '#fff0f6');
      wg.addColorStop(1, '#ffe6f0');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, CM.H);

      // polka-dot wall
      g.fillStyle = 'rgba(255,255,255,0.45)';
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 11; c++) {
          const dx = c * 92 + (r % 2 ? 46 : 0) + 24;
          const dy = r * 78 + 40;
          if (dy < 360) D.circle(g, dx, dy, 7, 'rgba(255,255,255,0.5)');
        }
      }

      // counter / table band where the plate sits
      g.fillStyle = '#f6c9a0';
      g.fillRect(0, 360, CM.W, 40);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.fillRect(0, 360, CM.W, 5);
      g.fillStyle = '#e8b487';
      g.fillRect(0, 400, CM.W, CM.H - 400);

      // bunting along the top
      const cols = [P.pink, P.blue, P.yellow, P.mint, P.lavender];
      for (let i = 0; i * 60 < CM.W; i++) {
        g.fillStyle = cols[i % cols.length];
        g.beginPath();
        g.moveTo(i * 60, 0);
        g.lineTo(i * 60 + 60, 0);
        g.lineTo(i * 60 + 30, 24);
        g.closePath();
        g.fill();
      }
    },

    // a little apron over the host so they read as a chef
    drawApron(g, x, y) {
      g.save();
      g.fillStyle = '#fff';
      // bib + skirt
      D.rr(g, x - 13, y - 44, 26, 18, 5, '#fff', '#e8e0da', 1.5);
      D.rr(g, x - 17, y - 28, 34, 24, 6, '#fff', '#e8e0da', 1.5);
      // a heart pocket
      D.heart(g, x, y - 14, 9, P.pink);
      g.restore();
    },

    /* ---------------- ORDER CARD (top center) ---------------- */
    drawOrderCard(g) {
      if (!this.order) return;
      const cx = 480, cardY = 64, cw = 360, ch = 92;
      const x = cx - cw / 2;

      // card body (a little recipe card)
      D.rr(g, x, cardY + 5, cw, ch, 16, 'rgba(120,80,60,0.18)');
      D.rr(g, x, cardY, cw, ch, 16, 'rgba(255,255,255,0.97)', '#f0b9d2', 3);
      // header tab
      D.rr(g, x + 18, cardY - 10, cw - 36, 26, 12, P.pinkDeep);
      D.text(g, '★ Order ★', cx, cardY + 3, { size: 18, color: '#fff', weight: 800 });

      // target frosting swatch + label
      const fId = this.order.frost, f = FROSTINGS[fId];
      const fx = x + 92, fy = cardY + 56;
      D.circle(g, fx, fy, 22, f.color, f.deep, 3);
      D.circle(g, fx - 6, fy - 6, 6, 'rgba(255,255,255,0.6)');
      D.text(g, f.label, fx, fy + 36, { size: 16, color: P.ink, weight: 800 });

      // "+" between
      D.text(g, '+', cx, cardY + 54, { size: 30, color: P.pinkDeep, weight: 800 });

      // target topping icon + label
      const tId = this.order.top;
      const tx = x + cw - 92, ty = cardY + 52;
      D.circle(g, tx, ty, 24, '#fff7e8', '#f0b9d2', 2);
      this.drawTopping(g, tId, tx, ty, 1);
      D.text(g, TOPPINGS[tId].label, tx, ty + 40, { size: 16, color: P.ink, weight: 800 });

      // checkmarks showing progress
      if (this.hasFrost) D.text(g, '✓', fx + 26, fy - 20, { size: 22, color: P.mintDeep, weight: 800 });
      if (this.hasTop) D.text(g, '✓', tx + 26, ty - 20, { size: 22, color: P.mintDeep, weight: 800 });
    },

    /* ---------------- the cupcake on its plate ---------------- */
    drawCupcakeScene(g) {
      // plate sits on the counter
      const px = 480, py = 348;

      // served cupcake slides up & away
      let slideY = 0, alpha = 1;
      if (this.servedT > 0) {
        const t = CM.clamp(this.servedT / 0.7, 0, 1);
        slideY = -t * 120;
        alpha = 1 - t * 0.9;
      }
      // new-plate entrance pop
      const popS = this.platePop > 0 ? 1 + Math.sin(this.platePop * Math.PI) * 0.12 : 1;
      // squash on adding things
      const sq = this.cupBounce > 0 ? Math.sin(this.cupBounce * Math.PI) : 0;

      // plate (stays put)
      D.shadow(g, px, py + 6, 76);
      D.ellipse(g, px, py, 96, 20, '#ffffff', '#e3d9d2', 3);
      D.ellipse(g, px, py - 3, 70, 13, '#fdf3f7', '#f0d6e2', 2);

      g.save();
      g.globalAlpha = alpha;
      g.translate(px, py - 8 + slideY);
      g.scale(popS * (1 + sq * 0.05), popS * (1 - sq * 0.07));
      this.drawCupcake(g, 0, 0);
      g.restore();
      g.globalAlpha = 1;
    },

    // a cupcake centred so its base sits at (x,y)
    drawCupcake(g, x, y) {
      // ---- wrapper (the paper liner) ----
      g.save();
      g.beginPath();
      g.moveTo(x - 42, y - 56);
      g.lineTo(x + 42, y - 56);
      g.lineTo(x + 34, y);
      g.lineTo(x - 34, y);
      g.closePath();
      g.fillStyle = '#ffd2e0';
      g.fill();
      g.strokeStyle = '#f0a8c4'; g.lineWidth = 2; g.stroke();
      // vertical pleats
      g.strokeStyle = 'rgba(240,168,196,0.7)'; g.lineWidth = 2;
      for (let i = -2; i <= 2; i++) {
        const tx = x + i * 16;
        g.beginPath();
        g.moveTo(tx, y - 54);
        g.lineTo(tx + i * 1.5, y - 2);
        g.stroke();
      }
      g.restore();

      // ---- cake peeking above the wrapper ----
      D.rr(g, x - 40, y - 70, 80, 22, 8, '#e6b07a', '#c98a55', 2);

      // ---- frosting swirl (only if added) ----
      if (this.hasFrost) {
        const f = FROSTINGS[this.order.frost];
        // grow animation: the swirl pipes up from the cake
        const grow = this.frostGrow > 0 ? this.frostGrow : 1;
        g.save();
        // clip-free stacked blobs forming a soft swirl
        const baseY = y - 64;
        const layers = [
          { dy: 0,   rx: 44, ry: 20 },
          { dy: -22, rx: 36, ry: 18 },
          { dy: -42, rx: 27, ry: 15 },
          { dy: -58, rx: 17, ry: 11 }
        ];
        for (let i = 0; i < layers.length; i++) {
          const L = layers[i];
          // each layer appears in sequence as `grow` climbs
          const seg = i / layers.length;
          const local = CM.clamp((grow - seg) / (1 / layers.length), 0, 1);
          if (local <= 0) continue;
          const ry = L.ry * local;
          D.ellipse(g, x, baseY + L.dy, L.rx, ry, f.color, f.deep, 2.5);
          // a soft highlight on the left
          D.ellipse(g, x - L.rx * 0.35, baseY + L.dy - ry * 0.3, L.rx * 0.22, ry * 0.35, 'rgba(255,255,255,0.45)');
        }
        // little peak on top when nearly grown
        if (grow > 0.85) {
          D.circle(g, x, baseY - 64, 6 * grow, f.color, f.deep, 2);
        }
        g.restore();

        // ---- topping (only if added) sits on the swirl peak ----
        if (this.hasTop) {
          const tp = this.topPop > 0 ? this.topPop : 1;
          const scl = tp < 1 ? 0.4 + 0.6 * tp + Math.sin(tp * Math.PI) * 0.25 : 1;
          this.drawTopping(g, this.order.top, x, baseY - 70, scl);
        }
      }
    },

    /* ---------------- a topping icon (shared: order card + button + cake) ---------------- */
    // drawn centred at (x,y), base size ~ for scale 1
    drawTopping(g, id, x, y, scale) {
      scale = scale || 1;
      g.save();
      g.translate(x, y);
      g.scale(scale, scale);
      if (id === 'cherry') {
        // stem
        g.strokeStyle = '#6e4527'; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(0, -2); g.quadraticCurveTo(8, -16, 4, -20); g.stroke();
        D.circle(g, 0, 2, 11, P.red, '#c33b3b', 2);
        D.circle(g, -4, -2, 3.5, 'rgba(255,255,255,0.7)');
        // tiny leaf
        g.fillStyle = '#7fcf95';
        g.beginPath(); g.ellipse(8, -17, 6, 3.5, -0.6, 0, Math.PI * 2); g.fill();
      } else if (id === 'star') {
        D.star(g, 0, 0, 15, '#e8be3a');
        D.star(g, 0, 0, 12.5, '#ffe07a');
        D.circle(g, -3, -3, 3, 'rgba(255,255,255,0.8)');
      } else if (id === 'sprinkles') {
        // a little cluster of colourful sprinkles
        const cols = [P.pink, P.blue, P.mint, P.yellowDeep, P.lavenderDeep, P.red];
        const sp = [
          [-10, -4, -0.6], [-2, -9, 0.5], [6, -5, -0.3],
          [10, 2, 0.7], [1, 4, -0.5], [-7, 5, 0.4], [-1, -2, 0.2]
        ];
        for (let i = 0; i < sp.length; i++) {
          g.save();
          g.translate(sp[i][0], sp[i][1]);
          g.rotate(sp[i][2]);
          D.rr(g, -5, -2, 10, 4, 2, cols[i % cols.length]);
          g.restore();
        }
      } else if (id === 'heart') {
        D.heart(g, 0, 0, 26, '#e0407a');
        D.heart(g, 0, 0, 22, '#ff7eb6');
        D.circle(g, -5, -4, 3, 'rgba(255,255,255,0.7)');
      }
      g.restore();
    },

    /* ---------------- the big tappable buttons ---------------- */
    drawButtons(g) {
      // a soft label strip above each row
      D.text(g, 'Tap the frosting →', 70, this.frostBtns[0].y + 34,
        { size: 15, color: '#a06a86', weight: 800, align: 'left' });
      D.text(g, 'Tap the topping →', 70, this.topBtns[0].y + 34,
        { size: 15, color: '#a06a86', weight: 800, align: 'left' });

      const interactive = this.state === 'play' && this.servedT <= 0;
      for (const b of this.frostBtns) this.drawFrostBtn(g, b, interactive);
      for (const b of this.topBtns) this.drawTopBtn(g, b, interactive);
    },

    btnBody(g, b, baseColor, border, used) {
      const m = CM.input.mouse;
      const hover = b.x <= m.x && m.x <= b.x + b.w && b.y <= m.y && m.y <= b.y + b.h;
      g.save();
      if (b.wob > 0) g.translate(Math.sin(b.wob * 40) * 5 * b.wob, 0);
      // shadow + body
      D.rr(g, b.x, b.y + 4, b.w, b.h, 16, 'rgba(120,60,90,0.16)');
      D.rr(g, b.x, b.y, b.w, b.h, 16, baseColor, border, 3);
      if (used) g.globalAlpha = 0.45;
      else if (hover) D.rr(g, b.x, b.y, b.w, b.h, 16, 'rgba(255,255,255,0.25)');
      return hover;
    },

    drawFrostBtn(g, b, interactive) {
      const f = FROSTINGS[b.id];
      const used = this.hasFrost; // once frosted, all frosting buttons rest
      this.btnBody(g, b, '#ffffff', f.deep, used && interactive);
      const cx = b.x + 36, cy = b.y + b.h / 2;
      // a frosting swatch swirl
      D.circle(g, cx, cy, 20, f.color, f.deep, 3);
      D.circle(g, cx - 5, cy - 5, 5, 'rgba(255,255,255,0.6)');
      D.text(g, f.label, b.x + 64, cy, { size: 20, color: P.ink, weight: 800, align: 'left' });
      g.restore();
    },

    drawTopBtn(g, b, interactive) {
      const ready = this.hasFrost && !this.hasTop;
      const used = this.hasTop;
      // dim the whole topping row until frosting is on (gentle gating)
      const greyed = !this.hasFrost;
      this.btnBody(g, b, ready ? '#fffdf6' : '#ffffff', '#f0b9d2', (used && interactive));
      if (greyed) g.globalAlpha = Math.min(g.globalAlpha, 0.5);
      const cx = b.x + 34, cy = b.y + b.h / 2;
      this.drawTopping(g, b.id, cx, cy, 0.95);
      D.text(g, TOPPINGS[b.id].label, b.x + 60, cy,
        { size: 18, color: P.ink, weight: 800, align: 'left' });
      g.restore();
    },

    /* ---------------- particles ---------------- */
    drawParts(g) {
      for (const p of this.parts) {
        g.globalAlpha = CM.clamp(p.life / p.maxLife, 0, 1);
        if (p.kind === 'star') D.star(g, p.x, p.y, p.size, p.color || P.yellowDeep, p.rot);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, p.color || P.pink);
        else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, {
            size: 22, color: p.color || '#c98a1f', weight: 800, stroke: '#ffffff', strokeWidth: 5
          });
        }
      }
      g.globalAlpha = 1;
    },

    /* ---------------- HUD ---------------- */
    drawHud(g) {
      // score, top-left
      D.rr(g, 14, 12, 156, 44, 16, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      D.star(g, 36, 34, 12, P.yellowDeep);
      D.text(g, String(this.score), 110, 34, { size: 22, color: '#c98a1f', weight: 800 });

      // cupcake progress pips, top-right area (kept clear of reserved corner)
      const n = TOTAL_CUPCAKES;
      const pw = 16, pgap = 8, tw = n * pw + (n - 1) * pgap;
      const sx = 720 - tw;
      for (let i = 0; i < n; i++) {
        const done = i < this.idx || (i === this.idx && this.state === 'done');
        const cur = i === this.idx && this.state === 'play';
        D.circle(g, sx + i * (pw + pgap) + pw / 2, 32, 7,
          done ? P.mintDeep : (cur ? P.yellow : 'rgba(255,255,255,0.85)'),
          '#f0b9d2', 2);
      }
      D.text(g, 'Cupcakes', sx + tw / 2, 50, { size: 13, color: '#a06a86', weight: 700 });
    },

    /* ---------------- overlays ---------------- */
    drawDone(g) {
      g.fillStyle = 'rgba(255,240,246,0.5)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.text(g, 'Order complete! 🧁', 480, 196, {
        size: 50, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
      });
      D.text(g, 'You frosted ' + TOTAL_CUPCAKES + ' yummy cupcakes!', 480, 256, {
        size: 24, color: P.ink, weight: 800, stroke: '#fff', strokeWidth: 6
      });
      D.text(g, 'Score: ' + this.score, 480, 304, {
        size: 30, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6
      });
      D.star(g, 300, 196 + Math.sin(CM.time * 5) * 6, 18, P.yellowDeep, CM.time * 2);
      D.star(g, 660, 196 + Math.cos(CM.time * 5) * 6, 18, P.yellowDeep, -CM.time * 2);
    },

    drawHowto(g) {
      const t = CM.time;
      g.fillStyle = 'rgba(80,40,60,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 175, 88, 610, 410, { title: '🧁 Frost the Cupcakes 🧁' });

      CM.drawFriend(g, 'cinnamoroll', 282, 392, 1.35, { bob: ((t * 1.1) % 1) * 0.5 });
      this.drawApron(g, 282, 392);
      D.text(g, 'Cinnamoroll', 282, 416, { size: 15, color: P.pinkDeep, weight: 800 });

      D.text(g, 'Help bake yummy cupcakes!', 565, 156, { size: 24, color: P.ink, weight: 800 });
      D.text(g, 'Read the ★ Order card at the top.', 565, 206, { size: 17, color: P.ink });
      D.text(g, 'Tap the matching FROSTING color,', 565, 234, { size: 17, color: P.ink });
      D.text(g, 'then tap the matching TOPPING.', 565, 262, { size: 17, color: P.ink });
      D.text(g, 'Match both to serve it — Yum! 🌟', 565, 300, { size: 18, color: P.pinkDeep, weight: 800 });
      D.text(g, 'Wrong tap? No worries, just try again!', 565, 338, { size: 14, color: '#9a8a94' });

      // a tiny teaser cupcake
      g.save();
      g.translate(485, 392);
      g.scale(0.7, 0.7);
      // mini frosting + cherry
      D.rr(g, -40, -70, 80, 22, 8, '#e6b07a', '#c98a55', 2);
      g.beginPath();
      g.moveTo(-42, -56); g.lineTo(42, -56); g.lineTo(34, 0); g.lineTo(-34, 0); g.closePath();
      g.fillStyle = '#ffd2e0'; g.fill();
      g.strokeStyle = '#f0a8c4'; g.lineWidth = 2; g.stroke();
      D.ellipse(g, 0, -64, 44, 20, '#ff9ec7', '#e87fb2', 2.5);
      D.ellipse(g, 0, -86, 30, 16, '#ff9ec7', '#e87fb2', 2.5);
      D.ellipse(g, 0, -104, 18, 12, '#ff9ec7', '#e87fb2', 2.5);
      this.drawTopping(g, 'cherry', 0, -116, 1);
      g.restore();

      if (CM.ui.button(g, 465, 410, 210, 58, '▶ Start!', { color: P.mintDeep, size: 24 })) {
        this.startPlay();
      }
    }
  });
})();
