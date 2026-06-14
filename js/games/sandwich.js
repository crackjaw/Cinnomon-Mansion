/* Cinnamoroll Mansion — Make a Sandwich (hosted by Pochacco) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ============================================================
     INGREDIENTS — each is a labelled layer the kid taps to add.
     `draw(g, x, y, w)` renders the layer centred at (x,y) ~w wide,
     used both in the recipe card, on the plate, and on the buttons.
     `label` is shown >=20px on the buttons & recipe.
     ============================================================ */
  const ING = {
    breadBottom: { label: 'Bread', color: '#f2c879', h: 18, draw: drawBreadBottom },
    breadTop: { label: 'Top Bun', color: '#f0bd63', h: 26, draw: drawBreadTop },
    lettuce: { label: 'Lettuce', color: '#8fd66f', h: 16, draw: drawLettuce },
    cheese: { label: 'Cheese', color: '#ffd84d', h: 14, draw: drawCheese },
    tomato: { label: 'Tomato', color: '#ff7d6e', h: 14, draw: drawTomato },
    ham: { label: 'Ham', color: '#ff9eb0', h: 15, draw: drawHam },
    egg: { label: 'Egg', color: '#fff3c4', h: 16, draw: drawEgg },
    cucumber: { label: 'Cucumber', color: '#bfe89a', h: 13, draw: drawCucumber }
  };

  // The fixed palette of big buttons across the bottom (in a friendly order).
  const BUTTON_ORDER = ['breadBottom', 'lettuce', 'cheese', 'tomato', 'ham', 'egg', 'cucumber', 'breadTop'];

  /* ---- the set of orders, gently ramping in length (bottom -> top) ---- */
  function buildOrders() {
    return [
      ['breadBottom', 'cheese', 'breadTop'],
      ['breadBottom', 'lettuce', 'tomato', 'breadTop'],
      ['breadBottom', 'ham', 'cheese', 'breadTop'],
      ['breadBottom', 'lettuce', 'egg', 'tomato', 'breadTop'],
      ['breadBottom', 'cheese', 'ham', 'cucumber', 'breadTop'],
      ['breadBottom', 'lettuce', 'tomato', 'cheese', 'egg', 'breadTop']
    ];
  }

  const PTS_LAYER = 8;        // points for each correct layer dropped
  const PTS_SANDWICH = 30;    // bonus for finishing a whole sandwich
  const MAX_PARTS = 90;

  const POCHA = { x: 150, y: 250 };   // host at the counter, upper-left
  const PLATE = { x: 480, y: 458 };   // where the sandwich is built

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  /* ============================================================ */
  CM.registerGame({
    id: 'sandwich',
    name: 'Make a Sandwich',

    /* ---------------- lifecycle ---------------- */
    enter() {
      this.state = 'howto';      // howto -> play -> done (-> finish once)
      this.orders = buildOrders();
      this.orderIdx = 0;
      this.score = 0;
      this.finished = false;

      // per-order build state
      this.placed = 0;           // how many layers are correctly stacked
      this.servedCount = 0;      // finished sandwiches

      // feedback / juice
      this.parts = [];
      this.shk = 0;
      this.bubble = '';
      this.bubbleT = 0;
      this.hostHappy = 0;
      this.oops = 0;             // wrong-tap shake timer
      this.hintLayer = -1;       // index of the next-needed layer to nudge
      this.servedAnim = 0;       // served celebration timer (between orders)
      this.serving = false;      // true while the finished sandwich slides away
      this.popLayer = -1;        // which placed layer is doing its drop-bounce
      this.popT = 0;
      this.doneT = 0;

      this.buildButtons();
    },

    exit() {},

    /* ---------------- big ingredient buttons along the bottom ---------------- */
    buildButtons() {
      this.btns = [];
      const n = BUTTON_ORDER.length;
      const bw = 102, bh = 92, gap = 12;
      const totalW = n * bw + (n - 1) * gap;
      const startX = (CM.W - totalW) / 2;
      const y = 498;
      for (let i = 0; i < n; i++) {
        this.btns.push({
          id: BUTTON_ORDER[i],
          x: startX + i * (bw + gap), y: y, w: bw, h: bh,
          wob: 0,      // happy bounce when correctly tapped
          press: 0     // press-down feedback
        });
      }
    },

    order() { return this.orders[this.orderIdx]; },

    /* ---------------- particles / juice ---------------- */
    addPart(p) { if (this.parts.length < MAX_PARTS) { p.maxLife = p.life; this.parts.push(p); } },

    burst(x, y, color, big) {
      const n = big ? 16 : 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + CM.rand(-0.2, 0.2);
        this.addPart({
          kind: Math.random() < 0.5 ? 'star' : 'heart',
          x: x, y: y,
          vx: Math.cos(a) * CM.rand(70, big ? 200 : 130),
          vy: Math.sin(a) * CM.rand(70, big ? 200 : 130) - 50,
          life: CM.rand(0.5, big ? 1.1 : 0.85), size: CM.rand(7, big ? 13 : 10),
          color: color || CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep]),
          rot: CM.rand(0, 6), vr: CM.rand(-5, 5)
        });
      }
    },

    puff(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.addPart({
          kind: 'puff', x: x + CM.rand(-12, 12), y: y + CM.rand(-4, 4),
          vx: CM.rand(-40, 40), vy: CM.rand(-50, -10),
          life: CM.rand(0.3, 0.55), size: CM.rand(5, 9), color: 'rgba(255,255,255,0.9)'
        });
      }
    },

    floatText(x, y, str, color) {
      this.addPart({ kind: 'txt', x: x, y: y, str: str, color: color, vx: 0, vy: -42, life: 1.1 });
    },

    confetti() {
      if (this.parts.length > MAX_PARTS - 6) return;
      this.addPart({
        kind: Math.random() < 0.5 ? 'star' : 'heart',
        x: CM.rand(120, 840), y: CM.rand(110, 320),
        vx: CM.rand(-40, 40), vy: CM.rand(-70, -10),
        life: CM.rand(0.7, 1.2), size: CM.rand(7, 13),
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
        if (p.kind === 'star' || p.kind === 'heart') { p.vy += 230 * dt; p.rot += (p.vr || 0) * dt; }
        else if (p.kind === 'puff') { p.vy -= 8 * dt; p.size += 8 * dt; }
      }
    },

    say(text, t) {
      this.bubble = text;
      this.bubbleT = t;
      this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    /* ---------------- tapping an ingredient ---------------- */
    tap(b) {
      if (this.serving) return;       // mid-serve, ignore taps
      const ord = this.order();
      const needed = ord[this.placed];     // the next layer the recipe wants
      b.press = 1;

      if (b.id === needed) {
        // correct! drop the layer with a satisfying pop
        this.placed++;
        this.score += PTS_LAYER;
        b.wob = 1;
        this.shk = 3;
        this.popLayer = this.placed - 1;
        this.popT = 0;
        CM.audio.play('pop');
        CM.audio.tone(420 + this.placed * 60, 0.1, 'sine', 0.12);
        const ly = this.layerY(this.placed - 1);
        this.puff(PLATE.x, ly + 6, 4);
        this.burst(PLATE.x, ly, ING[needed].color, false);
        this.hintLayer = -1;

        if (this.placed >= ord.length) {
          this.serveSandwich();
        } else if (Math.random() < 0.35) {
          this.say(CM.pick(['Yum!', 'Nice!', 'Mmm!', 'Tasty!']), 0.9);
        }
      } else {
        // GENTLE wrong tap: tiny shake + hint of which layer is next, no big penalty
        this.oops = 1;
        this.hintLayer = this.placed;
        b.wob = -1;                 // a sad little shake (negative = wrong)
        CM.audio.play('boing');
        this.floatText(b.x + b.w / 2, b.y - 6, 'Oops!', P.lavenderDeep);
        this.say('Add ' + ING[needed].label + ' next!', 1.4);
      }
    },

    serveSandwich() {
      // a whole sandwich is done — celebrate and slide it away
      this.score += PTS_SANDWICH;
      this.servedCount++;
      this.serving = true;
      this.servedAnim = 0;
      this.shk = 7;
      CM.audio.play('ding');
      CM.audio.play('cheer');
      this.burst(PLATE.x, this.layerY(this.placed - 1) - 10, P.yellowDeep, true);
      this.floatText(PLATE.x, 360, '+' + PTS_SANDWICH + ' Order up!', '#c98a1f');
      this.say(CM.pick(['Order up! 🥪', 'Perfect sandwich!', 'You did it!', 'Wow, yum!']), 1.8);
    },

    nextOrder() {
      this.orderIdx++;
      this.serving = false;
      this.placed = 0;
      this.popLayer = -1;
      this.hintLayer = -1;
      if (this.orderIdx >= this.orders.length) {
        this.state = 'done';
        this.doneT = 2.2;
        this.shk = 8;
        CM.audio.play('tada');
        for (let i = 0; i < 12; i++) this.confetti();
        return;
      }
      this.say('New order! 📋', 1.3);
    },

    /* ---------------- update ---------------- */
    update(dt) {
      if (this.shk > 0) this.shk = Math.max(0, this.shk - dt * 14);
      if (this.bubbleT > 0) this.bubbleT -= dt;
      if (this.oops > 0) this.oops = Math.max(0, this.oops - dt * 2.4);
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      if (this.popLayer >= 0) {
        this.popT += dt;
        if (this.popT > 0.5) this.popLayer = -1;
      }
      // settle button bounces
      if (this.btns) {
        for (const b of this.btns) {
          if (b.wob > 0) b.wob = Math.max(0, b.wob - dt * 2.2);
          if (b.wob < 0) b.wob = Math.min(0, b.wob + dt * 3);
          if (b.press > 0) b.press = Math.max(0, b.press - dt * 5);
        }
      }
      this.tickParts(dt);

      switch (this.state) {
        case 'howto':
          if (anyPress()) this.startPlay();
          break;

        case 'play':
          if (this.serving) {
            // play out the serve celebration, then bring the next order
            this.servedAnim += dt;
            if (Math.random() < 0.45) this.confetti();
            if (this.servedAnim >= 1.5) this.nextOrder();
          } else {
            // tapping ingredient buttons
            const m = CM.input.mouse;
            if (m.clicked) {
              for (const b of this.btns) {
                if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) {
                  this.tap(b);
                  break;
                }
              }
            }
          }
          break;

        case 'done':
          if (Math.random() < 0.3) this.confetti();
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('sandwich', this.score,
              CM.clamp(Math.ceil(this.score / 14), 5, 30));
          }
          break;
      }
    },

    startPlay() {
      this.state = 'play';
      this.say('First order, let\'s cook! 🍳', 1.6);
    },

    /* ---------------- layer geometry ----------------
       Layers stack upward from the plate. Layer i sits this many px
       above the plate surface (sum of the heights below it). */
    layerY(i) {
      const ord = this.order();
      let y = PLATE.y - 6;
      for (let k = 0; k <= i && k < ord.length; k++) {
        const h = ING[ord[k]].h;
        if (k < i) y -= h;
      }
      // centre of layer i
      return y - ING[ord[i]].h / 2;
    },

    /* ============================================================
       DRAW
       ============================================================ */
    draw(g) {
      g.save();
      if (this.shk > 0.2) {
        g.translate(CM.rand(-this.shk, this.shk) * 0.7, CM.rand(-this.shk, this.shk) * 0.7);
      }

      this.drawKitchen(g);
      this.drawHost(g);
      if (this.state === 'play') {
        this.drawOrderCard(g);
        this.drawPlate(g);
        this.drawButtons(g);
      }
      this.drawParts(g);

      g.restore(); // end shake

      // speech bubble (not shaken), near Pochacco
      if (this.bubbleT > 0 && this.state !== 'howto') {
        const txt = this.bubble;
        const cw = Math.max(130, txt.length * 9 + 30);
        const bx = CM.clamp(POCHA.x - 20, 8, CM.W - cw - 8);
        D.bubble(g, bx, POCHA.y - 188, cw, 44, POCHA.x + 14);
        D.text(g, txt, bx + cw / 2, POCHA.y - 166, { size: 17, weight: 800, color: P.pinkDeep });
      }

      if (this.state === 'play' || this.state === 'done') this.drawHud(g);
      if (this.state === 'done') this.drawDone(g);
      if (this.state === 'howto') this.drawHowto(g);
    },

    /* ---------------- cozy pastel cafe kitchen ---------------- */
    drawKitchen(g) {
      const wg = g.createLinearGradient(0, 0, 0, CM.H);
      wg.addColorStop(0, '#fff1f6');
      wg.addColorStop(1, '#ffe7ef');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, CM.H);

      // wall tiles (soft checker up top)
      g.globalAlpha = 0.35;
      for (let yy = 0; yy < 4; yy++) {
        for (let xx = 0; xx * 80 < CM.W; xx++) {
          if ((xx + yy) % 2 === 0) {
            g.fillStyle = '#ffffff';
            g.fillRect(xx * 80, yy * 40, 80, 40);
          }
        }
      }
      g.globalAlpha = 1;

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

      // a little CAFE sign
      D.rr(g, 700, 70, 180, 50, 16, 'rgba(255,255,255,0.92)', '#f0b9d2', 3);
      D.text(g, '🥪 Sandwich Shop', 790, 96, { size: 19, color: P.pinkDeep, weight: 800 });

      // wooden counter the whole scene sits on
      const cg = g.createLinearGradient(0, 410, 0, 470);
      cg.addColorStop(0, '#e7b87e');
      cg.addColorStop(1, '#d6a567');
      g.fillStyle = cg;
      g.fillRect(0, 410, CM.W, 60);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, 410, CM.W, 5);
      // wood grain lines
      g.strokeStyle = 'rgba(150,100,55,0.25)'; g.lineWidth = 2;
      for (let i = 0; i < 6; i++) {
        g.beginPath();
        g.moveTo(0, 422 + i * 8);
        g.lineTo(CM.W, 424 + i * 8);
        g.stroke();
      }
      // counter front
      g.fillStyle = '#c98f57';
      g.fillRect(0, 470, CM.W, CM.H - 470);
      g.fillStyle = 'rgba(255,255,255,0.12)';
      g.fillRect(0, 470, CM.W, 4);
    },

    /* ---------------- host: Pochacco the chef ---------------- */
    drawHost(g) {
      const t = CM.time;
      const happy = this.hostHappy > 0 || this.state === 'done' || this.serving;
      const bob = happy ? (t * 2.6) % 1 : ((t * 1.1) % 1) * 0.4;

      // a little chef's hat floating above Pochacco
      const hx = POCHA.x, hy = POCHA.y;
      g.save();
      // apron behind him (cute bib)
      D.rr(g, hx - 26, hy - 60, 52, 56, 14, '#ffd9e8', '#f0b9d2', 3);
      D.text(g, '♥', hx, hy - 30, { size: 22, color: P.pinkDeep, weight: 800 });
      g.restore();

      CM.drawFriend(g, 'pochacco', hx, hy, 1.25, { bob: bob });

      // chef hat on top of his head (head centre ~ y-70 at scale 1.25)
      const headTop = hy - 1.25 * 80 - (happy ? Math.abs(Math.sin(bob * Math.PI * 2)) * 5 : 0);
      g.save();
      g.fillStyle = '#ffffff';
      D.rr(g, hx - 22, headTop + 8, 44, 12, 5, '#ffffff', '#e6dde6', 2); // band
      D.circle(g, hx - 14, headTop - 2, 12, '#ffffff', '#e6dde6', 2);
      D.circle(g, hx + 14, headTop - 2, 12, '#ffffff', '#e6dde6', 2);
      D.circle(g, hx, headTop - 8, 14, '#ffffff', '#e6dde6', 2);
      g.restore();

      // name plate
      D.rr(g, hx - 50, hy + 8, 100, 22, 11, 'rgba(255,255,255,0.9)');
      D.text(g, 'Chef Pochacco', hx, hy + 19, { size: 14, color: P.ink, weight: 800 });
    },

    /* ---------------- the order / recipe card (bottom -> top) ---------------- */
    drawOrderCard(g) {
      const ord = this.order();
      const cardX = 632, cardW = 296;
      const rowH = 34;
      const cardH = 78 + ord.length * rowH;
      const cardY = 132;

      // pinned recipe card
      D.rr(g, cardX, cardY + 6, cardW, cardH, 16, 'rgba(120,80,90,0.14)'); // shadow
      D.rr(g, cardX, cardY, cardW, cardH, 16, '#fffdf5', '#f0b9d2', 3);
      // little pin
      D.circle(g, cardX + cardW / 2, cardY + 2, 8, P.red, '#fff', 2);
      D.circle(g, cardX + cardW / 2 - 2, cardY, 2.5, 'rgba(255,255,255,0.7)');

      D.text(g, 'ORDER', cardX + cardW / 2, cardY + 30, { size: 22, color: P.pinkDeep, weight: 800 });
      D.text(g, 'Build bottom → top', cardX + cardW / 2, cardY + 52,
        { size: 14, color: '#9a8a94', weight: 700 });

      // rows: bottom layer at the BOTTOM of the card, top layer at the top
      const baseY = cardY + cardH - 22;
      for (let i = 0; i < ord.length; i++) {
        const id = ord[i];
        const ry = baseY - i * rowH;     // i=0 (bottom bread) lowest
        const done = i < this.placed;
        const isNext = i === this.placed && !this.serving;
        const hinting = isNext && (this.hintLayer === i) && this.oops > 0.05;

        // row background highlights the next-needed layer
        let bg = 'rgba(255,255,255,0)';
        let bd = null;
        if (isNext) {
          const pulse = 0.5 + 0.5 * Math.sin(CM.time * 6);
          bg = hinting ? 'rgba(255,236,150,0.95)' : 'rgba(220,242,255,' + (0.55 + pulse * 0.35) + ')';
          bd = hinting ? P.yellowDeep : P.blue;
        }
        D.rr(g, cardX + 16, ry - rowH / 2 + 2, cardW - 32, rowH - 6, 10, bg, bd, bd ? 3 : 0);

        // mini icon of the layer
        g.save();
        if (done) g.globalAlpha = 0.45;
        ING[id].draw(g, cardX + 44, ry, 48);
        g.restore();

        // label
        const lblCol = done ? '#a9b5a0' : (isNext ? P.blueDeep : P.ink);
        D.text(g, ING[id].label, cardX + 84, ry, {
          size: 20, color: lblCol, weight: 800, align: 'left', baseline: 'middle'
        });

        // a check when done, an arrow for the next one
        if (done) {
          D.circle(g, cardX + cardW - 34, ry, 12, P.mintDeep, '#fff', 2);
          g.strokeStyle = '#fff'; g.lineWidth = 3; g.lineCap = 'round';
          g.beginPath();
          g.moveTo(cardX + cardW - 39, ry);
          g.lineTo(cardX + cardW - 35, ry + 5);
          g.lineTo(cardX + cardW - 28, ry - 5);
          g.stroke();
        } else if (isNext) {
          const px = Math.sin(CM.time * 6) * 3;
          D.text(g, '👉', cardX + cardW - 34 + px, ry, { size: 22, baseline: 'middle' });
        }
      }
    },

    /* ---------------- the plate where the sandwich is built ---------------- */
    drawPlate(g) {
      // slide the finished sandwich off to the right as it's served
      let slide = 0, lift = 0, alpha = 1;
      if (this.serving) {
        const f = CM.clamp(this.servedAnim / 1.5, 0, 1);
        slide = f * f * 240;
        lift = Math.sin(f * Math.PI) * 30;
        alpha = 1 - Math.max(0, f - 0.7) / 0.3;
      }
      const px = PLATE.x + slide;

      // plate
      D.shadow(g, px, PLATE.y + 8, 96);
      D.ellipse(g, px, PLATE.y + 2, 96, 22, '#ffffff', '#e3d9e0', 3);
      D.ellipse(g, px, PLATE.y, 80, 17, '#fef7fb', '#f0e2ea', 2);

      if (this.serving && alpha <= 0) return;
      g.save();
      g.globalAlpha = alpha;
      g.translate(slide, -lift);

      const ord = this.order();
      const n = this.placed;
      for (let i = 0; i < n; i++) {
        const id = ord[i];
        let y = this.layerY(i);
        let scale = 1;
        // the just-dropped layer does a squash-and-settle bounce
        if (i === this.popLayer) {
          const f = CM.clamp(this.popT / 0.5, 0, 1);
          y -= (1 - f) * 26;                          // drops in from above
          scale = 1 + Math.sin(f * Math.PI) * 0.12;   // little squash
        }
        g.save();
        g.translate(PLATE.x, y);
        g.scale(scale, i === this.popLayer ? (2 - scale) : 1);
        ING[id].draw(g, 0, 0, 150);
        g.restore();
      }

      // empty-plate hint
      if (n === 0 && !this.serving) {
        D.text(g, 'Tap to start stacking!', PLATE.x, PLATE.y - 36,
          { size: 16, color: '#b79aa6', weight: 700 });
      }
      g.restore();

      // steam wisps when a fresh sandwich is finished
      if (this.serving) {
        for (let i = 0; i < 3; i++) {
          const sx = px - 24 + i * 24;
          const wob = Math.sin(CM.time * 3 + i) * 8;
          g.globalAlpha = 0.4 * alpha;
          D.circle(g, sx + wob, PLATE.y - 90 - lift, 9, '#ffffff');
          D.circle(g, sx - wob * 0.6, PLATE.y - 62 - lift, 7, '#ffffff');
          g.globalAlpha = 1;
        }
      }
    },

    /* ---------------- big labelled ingredient buttons ---------------- */
    drawButtons(g) {
      const ord = this.order();
      const needed = this.serving ? null : ord[this.placed];
      const m = CM.input.mouse;

      for (const b of this.btns) {
        const ing = ING[b.id];
        const isNext = b.id === needed;
        const hover = !this.serving && m.x >= b.x && m.x <= b.x + b.w &&
          m.y >= b.y && m.y <= b.y + b.h;

        g.save();
        // wobble: positive = happy pop, negative = sad shake
        let dy = -b.press * 3;
        if (b.wob > 0) dy -= Math.sin(b.wob * Math.PI) * 8;
        let dx = 0;
        if (b.wob < 0) dx = Math.sin(b.wob * 30) * 5 * -b.wob;
        g.translate(b.x + dx, b.y + dy);

        // shadow + body
        D.rr(g, 0, 5, b.w, b.h, 16, 'rgba(120,70,90,0.18)');
        let base = '#ffffff';
        let border = '#f0c9d8';
        let bw = 2;
        if (isNext) {
          const pulse = 0.5 + 0.5 * Math.sin(CM.time * 6);
          base = '#eafaf0';
          border = P.mintDeep;
          bw = 3 + pulse * 1.5;
        }
        D.rr(g, 0, 0, b.w, b.h, 16, base, border, bw);
        if (hover) D.rr(g, 0, 0, b.w, b.h, 16, 'rgba(255,255,255,0.3)');

        // ingredient icon
        ing.draw(g, b.w / 2, 38, 76);

        // label >= 20px
        D.text(g, ing.label, b.w / 2, b.h - 16,
          { size: 20, color: P.ink, weight: 800 });

        // a glow ring + "next" tag on the needed ingredient
        if (isNext) {
          g.globalAlpha = 0.6 + 0.4 * Math.sin(CM.time * 7);
          D.star(g, b.w - 14, 14, 11, P.yellowDeep);
          g.globalAlpha = 1;
        }
        g.restore();
      }
    },

    /* ---------------- particles ---------------- */
    drawParts(g) {
      for (const p of this.parts) {
        g.globalAlpha = CM.clamp(p.life / p.maxLife, 0, 1);
        if (p.kind === 'star') D.star(g, p.x, p.y, p.size, p.color, p.rot);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, p.color);
        else if (p.kind === 'puff') D.circle(g, p.x, p.y, p.size, p.color);
        else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, {
            size: 22, color: p.color || '#c98a1f', weight: 800,
            stroke: '#ffffff', strokeWidth: 5
          });
        }
      }
      g.globalAlpha = 1;
    },

    /* ---------------- HUD ---------------- */
    drawHud(g) {
      // score, top-left
      D.rr(g, 14, 12, 160, 44, 18, 'rgba(255,255,255,0.92)', '#f0b9d2', 2);
      D.coin(g, 36, 34, 12);
      D.text(g, String(this.score), 108, 34, { size: 22, color: '#c98a1f', weight: 800 });

      // order progress pips, top-centre
      const n = this.orders.length;
      const pw = 20, pgap = 9, tw = n * pw + (n - 1) * pgap;
      const sx = (CM.W - tw) / 2;
      for (let i = 0; i < n; i++) {
        const cx = sx + i * (pw + pgap) + pw / 2;
        const done = i < this.orderIdx || (i === this.orderIdx && this.serving);
        const cur = i === this.orderIdx && !this.serving && this.state === 'play';
        D.rr(g, cx - pw / 2, 22, pw, 16, 6,
          done ? P.mintDeep : (cur ? P.yellow : 'rgba(255,255,255,0.8)'),
          '#f0b9d2', 2);
      }
      D.text(g, 'Order ' + Math.min(this.orderIdx + 1, n) + ' / ' + n, CM.W / 2, 48,
        { size: 14, color: '#a07f8c', weight: 700 });
    },

    /* ---------------- overlays ---------------- */
    drawDone(g) {
      g.fillStyle = 'rgba(255,245,250,0.4)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.text(g, 'Café closed! 🥪🎉', 480, 196, {
        size: 50, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
      });
      D.text(g, 'You served ' + this.servedCount + ' sandwiches!', 480, 258,
        { size: 26, color: P.ink, weight: 800, stroke: '#fff', strokeWidth: 6 });
      D.text(g, 'Score: ' + this.score, 480, 306,
        { size: 30, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6 });
      D.star(g, 300, 196 + Math.sin(CM.time * 5) * 6, 18, P.yellowDeep, CM.time * 2);
      D.star(g, 660, 196 + Math.cos(CM.time * 5) * 6, 18, P.yellowDeep, -CM.time * 2);
    },

    drawHowto(g) {
      const t = CM.time;
      g.fillStyle = 'rgba(80,45,65,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 165, 86, 630, 410, { title: '🥪 Make a Sandwich 🥪' });

      CM.drawFriend(g, 'pochacco', 282, 392, 1.35, { bob: ((t * 1.1) % 1) * 0.5 });
      // tiny chef hat
      D.circle(g, 270, 300, 11, '#fff', '#e6dde6', 2);
      D.circle(g, 294, 300, 11, '#fff', '#e6dde6', 2);
      D.circle(g, 282, 294, 13, '#fff', '#e6dde6', 2);
      D.rr(g, 262, 308, 40, 11, 5, '#fff', '#e6dde6', 2);
      D.text(g, 'Chef Pochacco', 282, 418, { size: 14, color: P.pinkDeep, weight: 800 });

      D.text(g, 'Build sandwiches to order!', 575, 156, { size: 24, color: P.ink, weight: 800 });
      D.text(g, 'The card shows the layers from', 575, 202, { size: 17, color: P.ink });
      D.text(g, 'BOTTOM to TOP.', 575, 226, { size: 18, color: P.pinkDeep, weight: 800 });
      D.text(g, 'TAP the ingredients in that', 575, 268, { size: 17, color: P.ink });
      D.text(g, 'order to stack them up! 👆', 575, 292, { size: 17, color: P.ink });
      D.text(g, 'Finish it for "Order up!" 🎉', 575, 336, { size: 18, color: P.mintDeep, weight: 800 });
      D.text(g, 'Wrong tap? No worries — try again!', 575, 372, { size: 14, color: '#9a8a94' });

      // a teaser mini-stack
      drawBreadBottom(g, 470, 360, 50);

      if (CM.ui.button(g, 460, 402, 220, 58, '▶ Start!', { color: P.mintDeep, size: 24 })) {
        this.startPlay();
      }
    }
  });

  /* ============================================================
     INGREDIENT ART — each centred at (x,y), ~w wide, sits like a
     real layer (a flat-ish slice). Used everywhere at any size.
     ============================================================ */
  function drawBreadBottom(g, x, y, w) {
    const h = w * 0.24;
    D.rr(g, x - w / 2, y - h / 2, w, h, h * 0.5, '#f2c879', '#d9a857', Math.max(2, w * 0.03));
    // crust highlight
    D.rr(g, x - w / 2 + 3, y - h / 2 + 2, w - 6, h * 0.4, h * 0.3, 'rgba(255,255,255,0.4)');
  }

  function drawBreadTop(g, x, y, w) {
    const h = w * 0.34;
    g.fillStyle = '#f0bd63';
    g.strokeStyle = '#d9a440';
    g.lineWidth = Math.max(2, w * 0.03);
    g.beginPath();
    // domed top bun
    g.moveTo(x - w / 2, y + h / 2);
    g.bezierCurveTo(x - w / 2, y - h * 0.9, x + w / 2, y - h * 0.9, x + w / 2, y + h / 2);
    g.closePath();
    g.fill();
    g.stroke();
    // shine
    D.ellipse(g, x - w * 0.12, y - h * 0.2, w * 0.18, h * 0.22, 'rgba(255,255,255,0.5)');
    // sesame seeds
    g.fillStyle = '#fff4d6';
    for (let i = -1; i <= 1; i++) {
      D.ellipse(g, x + i * w * 0.2, y - h * 0.25 + Math.abs(i) * h * 0.12, w * 0.035, w * 0.06, '#fff4d6');
    }
  }

  function drawLettuce(g, x, y, w) {
    const h = w * 0.2;
    g.fillStyle = '#8fd66f';
    g.strokeStyle = '#6fbb52';
    g.lineWidth = Math.max(1.5, w * 0.02);
    g.beginPath();
    const ruffles = 7;
    g.moveTo(x - w / 2, y);
    for (let i = 0; i <= ruffles; i++) {
      const rx = x - w / 2 + (w / ruffles) * i;
      const ry = y - h / 2 - (i % 2 === 0 ? h * 0.5 : 0);
      g.lineTo(rx, ry);
    }
    g.lineTo(x + w / 2, y + h / 2);
    g.lineTo(x - w / 2, y + h / 2);
    g.closePath();
    g.fill();
    g.stroke();
    // lighter veins
    g.fillStyle = 'rgba(255,255,255,0.25)';
    D.ellipse(g, x - w * 0.15, y, w * 0.1, h * 0.3, 'rgba(255,255,255,0.25)');
  }

  function drawCheese(g, x, y, w) {
    const h = w * 0.16;
    // a slice with droopy corners
    g.fillStyle = '#ffd84d';
    g.strokeStyle = '#e9b92e';
    g.lineWidth = Math.max(1.5, w * 0.02);
    g.beginPath();
    g.moveTo(x - w / 2, y - h / 2);
    g.lineTo(x + w / 2, y - h / 2);
    g.lineTo(x + w / 2, y + h * 0.2);
    g.lineTo(x + w * 0.28, y + h / 2);
    g.lineTo(x - w * 0.2, y + h * 0.2);
    g.lineTo(x - w / 2, y + h / 2);
    g.closePath();
    g.fill();
    g.stroke();
    // holes
    g.fillStyle = 'rgba(233,185,46,0.6)';
    D.circle(g, x - w * 0.2, y, w * 0.04, 'rgba(233,185,46,0.6)');
    D.circle(g, x + w * 0.18, y - h * 0.1, w * 0.035, 'rgba(233,185,46,0.6)');
  }

  function drawTomato(g, x, y, w) {
    const h = w * 0.18;
    D.ellipse(g, x - w * 0.22, y, w * 0.24, h * 0.7, '#ff7d6e', '#e85b4c', Math.max(1.5, w * 0.02));
    D.ellipse(g, x + w * 0.22, y, w * 0.24, h * 0.7, '#ff7d6e', '#e85b4c', Math.max(1.5, w * 0.02));
    // seedy centres
    D.ellipse(g, x - w * 0.22, y, w * 0.13, h * 0.4, '#ffb0a4');
    D.ellipse(g, x + w * 0.22, y, w * 0.13, h * 0.4, '#ffb0a4');
  }

  function drawHam(g, x, y, w) {
    const h = w * 0.2;
    g.fillStyle = '#ff9eb0';
    g.strokeStyle = '#ec7d92';
    g.lineWidth = Math.max(1.5, w * 0.02);
    // wavy folded ham slice
    g.beginPath();
    const waves = 6;
    g.moveTo(x - w / 2, y - h / 2);
    for (let i = 0; i <= waves; i++) {
      const rx = x - w / 2 + (w / waves) * i;
      const ry = y - h / 2 + (i % 2 === 0 ? -h * 0.18 : h * 0.18);
      g.lineTo(rx, ry);
    }
    g.lineTo(x + w / 2, y + h / 2);
    g.lineTo(x - w / 2, y + h / 2);
    g.closePath();
    g.fill();
    g.stroke();
    // marbling
    g.strokeStyle = 'rgba(255,255,255,0.45)';
    g.lineWidth = Math.max(1, w * 0.015);
    g.beginPath();
    g.moveTo(x - w * 0.3, y + h * 0.1);
    g.lineTo(x + w * 0.3, y + h * 0.05);
    g.stroke();
  }

  function drawEgg(g, x, y, w) {
    const h = w * 0.22;
    // white slice
    D.ellipse(g, x, y, w * 0.46, h * 0.7, '#fff8e8', '#ecdfc4', Math.max(1.5, w * 0.02));
    // yolk
    D.circle(g, x, y, w * 0.16, '#ffd24a', '#eab52e', Math.max(1.5, w * 0.018));
    D.circle(g, x - w * 0.05, y - w * 0.05, w * 0.05, 'rgba(255,255,255,0.6)');
  }

  function drawCucumber(g, x, y, w) {
    const h = w * 0.16;
    D.ellipse(g, x - w * 0.24, y, w * 0.2, h * 0.7, '#bfe89a', '#8fc26a', Math.max(1.5, w * 0.02));
    D.ellipse(g, x + w * 0.04, y, w * 0.2, h * 0.7, '#bfe89a', '#8fc26a', Math.max(1.5, w * 0.02));
    D.ellipse(g, x + w * 0.3, y, w * 0.2, h * 0.7, '#bfe89a', '#8fc26a', Math.max(1.5, w * 0.02));
    // pale centres
    D.ellipse(g, x - w * 0.24, y, w * 0.1, h * 0.35, '#e3f5cf');
    D.ellipse(g, x + w * 0.04, y, w * 0.1, h * 0.35, '#e3f5cf');
    D.ellipse(g, x + w * 0.3, y, w * 0.1, h * 0.35, '#e3f5cf');
  }
})();
