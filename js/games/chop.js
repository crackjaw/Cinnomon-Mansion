/* Cinnamoroll Mansion — Chop Chop! (hosted by Keroppi) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ============================================================
     COOKING TASK: chop ingredients on a wooden board.
     A cute ingredient lies on the board with several dotted CUT
     guides across it. A knife hovers above. The next un-cut guide
     GLOWS/pulses. TAP anywhere (or on the guide) to bring the
     knife DOWN with a 'chop' sound + sparkle, slicing at that
     guide (the piece slides apart). Chop ALL guides, then the
     slices fan out, "Yum!", score up, and the next ingredient
     slides in. Finish the set (or a gentle timer) -> finishGame.
     ============================================================ */

  // The board geometry (where ingredients lie + knife travels)
  const BOARD_X = 250;     // left edge of the usable board top
  const BOARD_Y = 360;     // y of the cutting surface (where food rests)
  const BOARD_W = 520;     // usable width across the board
  const KNIFE_REST_Y = 150; // resting knife blade-bottom height

  const SESSION_TIME = 50;  // gentle countdown (s)
  const MAX_PARTS = 90;
  const KERO = { x: 110, y: 470 };

  // Ingredient catalog. Each: name, color theme, guide count range, helpers
  // for drawing. `len` is the body length on the board; it is centered.
  const INGREDIENTS = [
    { type: 'carrot',     name: 'Carrot',     guides: 5, len: 300, rad: 30, body: '#ff9a4d', bodyDk: '#e07a2c', tip: 'point' },
    { type: 'cucumber',   name: 'Cucumber',   guides: 6, len: 320, rad: 28, body: '#8fd66b', bodyDk: '#5fae3f', tip: 'round' },
    { type: 'banana',     name: 'Banana',     guides: 4, len: 300, rad: 26, body: '#ffe066', bodyDk: '#e6c233', tip: 'round', curve: 0.5 },
    { type: 'strawberry', name: 'Strawberry', guides: 3, len: 200, rad: 56, body: '#ff6f7d', bodyDk: '#e0455a', tip: 'berry' },
    { type: 'carrot',     name: 'Carrot',     guides: 6, len: 320, rad: 30, body: '#ff9a4d', bodyDk: '#e07a2c', tip: 'point' },
    { type: 'cucumber',   name: 'Cucumber',   guides: 5, len: 300, rad: 28, body: '#8fd66b', bodyDk: '#5fae3f', tip: 'round' },
    { type: 'banana',     name: 'Banana',     guides: 5, len: 320, rad: 26, body: '#ffe066', bodyDk: '#e6c233', tip: 'round', curve: 0.5 }
  ];

  const PTS_PER_CHOP = 12;     // a clean chop
  const PTS_PER_FINISH = 40;   // bonus for finishing an ingredient

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'chop',
    name: 'Chop Chop!',

    /* ---------------- lifecycle ---------------- */
    enter() {
      // howto -> play -> allchopped -> done (-> finish once)
      this.state = 'howto';
      this.score = 0;
      this.finished = false;

      this.idx = 0;            // which ingredient
      this.timeLeft = SESSION_TIME;
      this.ingredientsDone = 0;

      // knife state (animated drop)
      this.knifeY = KNIFE_REST_Y; // current blade-bottom y
      this.knifeVy = 0;
      this.chopping = false;   // mid-drop animation
      this.targetGuide = -1;   // guide index the current chop is aimed at

      // juice
      this.parts = [];
      this.shk = 0;
      this.bubble = '';
      this.bubbleT = 0;
      this.popT = 0;           // "Yum!" pop timer
      this.popText = '';
      this.boardBob = 0;       // board wobble on a chop
      this.steam = [];

      this.doneT = 0;
      this.allT = 0;

      this.buildIngredient();
    },

    exit() {},

    /* ---------------- build current ingredient ---------------- */
    buildIngredient() {
      const def = INGREDIENTS[this.idx % INGREDIENTS.length];
      const n = def.guides;
      const cx = BOARD_X + BOARD_W / 2;
      const left = cx - def.len / 2;

      // guide x positions evenly across the body (skip the very ends)
      const guides = [];
      for (let i = 0; i < n; i++) {
        const t = (i + 1) / (n + 1);
        guides.push({
          x: left + def.len * t,
          cut: false,
          slide: 0,        // how far the left slice has slid apart (visual)
          ph: CM.rand(0, 6.28)
        });
      }

      this.cur = {
        def: def,
        cx: cx,
        left: left,
        guides: guides,
        nextGuide: 0,    // index of the next un-cut guide
        slideIn: 1,      // 1 -> just arriving (slides in from right), eases to 0
        slideOut: 0,     // >0 -> leaving (slides off left) when finished
        wob: 0,          // little jiggle on a chop
        bornBob: CM.rand(0, 6.28)
      };
      // knife hovers above the next guide
      this.chopping = false;
      this.knifeY = KNIFE_REST_Y;
      this.knifeVy = 0;
    },

    /* ---------------- particles / juice ---------------- */
    addPart(p) { if (this.parts.length < MAX_PARTS) { p.maxLife = p.life; this.parts.push(p); } },

    sparkle(x, y, color, n) {
      n = n || 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + CM.rand(-0.2, 0.2);
        this.addPart({
          kind: Math.random() < 0.6 ? 'spark' : 'bit',
          x: x, y: y,
          vx: Math.cos(a) * CM.rand(60, 170),
          vy: Math.sin(a) * CM.rand(60, 170) - 50,
          life: CM.rand(0.45, 0.85), size: CM.rand(4, 9),
          color: color, rot: CM.rand(0, 6), vr: CM.rand(-6, 6)
        });
      }
    },

    hearts(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.addPart({
          kind: 'heart', x: x + CM.rand(-18, 18), y: y - 6,
          vx: CM.rand(-30, 30), vy: CM.rand(-130, -70),
          life: 1.1, size: CM.rand(8, 12)
        });
      }
    },

    floatText(x, y, str, color) {
      this.addPart({ kind: 'txt', x: x, y: y, str: str, color: color, vx: 0, vy: -42, life: 1.1 });
    },

    confetti() {
      if (this.parts.length > MAX_PARTS - 6) return;
      this.addPart({
        kind: Math.random() < 0.5 ? 'spark' : 'heart',
        x: CM.rand(120, 840), y: CM.rand(120, 300),
        vx: CM.rand(-40, 40), vy: CM.rand(-70, -20),
        life: CM.rand(0.7, 1.2), size: CM.rand(6, 12),
        color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
        rot: CM.rand(0, 6), vr: CM.rand(-5, 5)
      });
    },

    tickParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= dt;
        if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'spark' || p.kind === 'bit') { p.vy += 280 * dt; p.vx *= 1 - dt * 0.8; p.rot += (p.vr || 0) * dt; }
        else if (p.kind === 'heart') p.vy += 36 * dt;
        else if (p.kind === 'txt') p.vy *= 1 - dt * 0.4;
      }
    },

    say(text, t) { this.bubble = text; this.bubbleT = t; },

    pop(text) { this.popText = text; this.popT = 0.9; },

    /* ---------------- the chop ---------------- */
    tryChop() {
      if (this.state !== 'play') return;
      if (this.chopping) return;               // already dropping
      const c = this.cur;
      if (!c || c.slideOut > 0 || c.slideIn > 0.25) return; // not settled yet
      if (c.nextGuide >= c.guides.length) return; // already all cut

      // begin the knife drop, aimed at the next un-cut guide
      this.targetGuide = c.nextGuide;
      this.chopping = true;
      this.knifeVy = 900;       // fast satisfying drop
      CM.audio.play('whoosh');
    },

    landChop() {
      // called when the knife reaches the board on a real chop
      const c = this.cur;
      const gi = this.targetGuide;
      const g = c.guides[gi];
      if (!g || g.cut) { this.chopping = false; return; }

      g.cut = true;
      g.slide = 0.01;          // start the slices easing apart
      c.nextGuide++;
      c.wob = 1;
      this.boardBob = 1;
      this.shk = 5;

      const def = c.def;
      const chopX = g.x;
      this.score += PTS_PER_CHOP;

      CM.audio.play('pop');
      CM.audio.tone(520, 0.05, 'square', 0.08, 0, 360); // little "tk" thunk
      this.sparkle(chopX, BOARD_Y - 6, def.body, 9);
      this.sparkle(chopX, BOARD_Y - 6, '#ffffff', 3);
      this.floatText(chopX, BOARD_Y - 40, '+' + PTS_PER_CHOP, P.mintDeep);

      // finished the whole ingredient?
      if (c.nextGuide >= c.guides.length) {
        this.finishIngredient();
      } else if (Math.random() < 0.35) {
        this.say(CM.pick(['Chop chop!', 'Nice slice!', 'Keep going!']), 1.0);
      }

      this.chopping = false;
      this.knifeVy = 0;
    },

    finishIngredient() {
      const c = this.cur;
      this.score += PTS_PER_FINISH;
      this.ingredientsDone++;
      this.shk = 8;
      CM.audio.play('ding');
      CM.audio.play('cheer');
      this.pop(CM.pick(['Yum!', 'Yay!', 'Tasty!', 'Sliced!']));
      this.say(CM.pick(['All chopped!', 'Delicious!', 'Perfect!', 'Yummy!']), 1.6);
      this.hearts(c.cx, BOARD_Y - 30, 3);
      this.sparkle(c.cx, BOARD_Y - 20, P.yellowDeep, 12);
      this.floatText(c.cx, BOARD_Y - 70, '+' + PTS_PER_FINISH + ' bonus!', P.pinkDeep);
      // mark it to slide off, then bring in the next
      c.slideOut = 0.0001;
    },

    advanceIngredient() {
      this.idx++;
      if (this.idx >= INGREDIENTS.length) {
        // finished the whole set!
        this.state = 'allchopped';
        this.allT = 0;
        this.shk = 9;
        CM.audio.play('tada');
        for (let i = 0; i < 12; i++) this.confetti();
        this.say('Everything is chopped! 🎉', 2.4);
        return;
      }
      this.buildIngredient();
    },

    /* ---------------- update ---------------- */
    update(dt) {
      if (this.shk > 0) this.shk = Math.max(0, this.shk - dt * 14);
      if (this.bubbleT > 0) this.bubbleT -= dt;
      if (this.popT > 0) this.popT -= dt;
      if (this.boardBob > 0) this.boardBob = Math.max(0, this.boardBob - dt * 4);
      this.tickParts(dt);

      switch (this.state) {
        case 'howto':
          if (anyPress()) this.startPlay();
          break;

        case 'play':
          this.updatePlay(dt);
          break;

        case 'allchopped':
          this.allT += dt;
          if (Math.random() < 0.5) this.confetti();
          if (this.allT >= 2.2) { this.state = 'done'; this.doneT = 1.8; }
          break;

        case 'done':
          if (Math.random() < 0.4) this.confetti();
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('chop', this.score, CM.clamp(Math.ceil(this.score / 18), 5, 30));
          }
          break;
      }
    },

    startPlay() {
      this.state = 'play';
      this.say('Let\'s chop! Tap to slice!', 1.8);
    },

    updatePlay(dt) {
      const c = this.cur;

      // gentle countdown
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        // friendly time-up: go to the "all chopped" celebration beat
        this.state = 'allchopped';
        this.allT = 0;
        this.shk = 8;
        CM.audio.play('tada');
        for (let i = 0; i < 10; i++) this.confetti();
        this.say('Time\'s up — great chopping! 🎉', 2.4);
        return;
      }

      // ingredient arrival ease-in
      if (c.slideIn > 0) {
        c.slideIn = Math.max(0, c.slideIn - dt * 2.2);
      }
      if (c.wob > 0) c.wob = Math.max(0, c.wob - dt * 3);

      // advance the slide-apart animation of cut guides
      for (const g of c.guides) {
        if (g.cut && g.slide < 1) g.slide = Math.min(1, g.slide + dt * 4);
      }

      // ingredient leaving (after a finish): slide off left, then next
      if (c.slideOut > 0) {
        c.slideOut += dt;
        if (c.slideOut > 0.75) {
          this.advanceIngredient();
          return;
        }
      }

      // knife animation
      if (this.chopping) {
        this.knifeVy += 2600 * dt;          // accelerate down
        this.knifeY += this.knifeVy * dt;
        if (this.knifeY >= BOARD_Y - 8) {   // reached the board
          this.knifeY = BOARD_Y - 8;
          this.landChop();
        }
      } else {
        // ease the knife back up to rest, hovering above the next guide
        if (this.knifeY > KNIFE_REST_Y) {
          this.knifeY = Math.max(KNIFE_REST_Y, this.knifeY - 1200 * dt);
        } else {
          this.knifeY = KNIFE_REST_Y;
        }
        // accept a tap to chop (anywhere on screen, or on the guide)
        if (anyPress()) this.tryChop();
      }
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
      this.drawBoard(g);

      if (this.state === 'play' || this.state === 'allchopped') {
        if (this.cur) this.drawIngredient(g);
        this.drawKnife(g);
      }

      // Keroppi the chef, lower-left
      this.drawHost(g);

      this.drawParts(g);

      g.restore(); // end shake

      // speech bubble (not shaken)
      if (this.bubbleT > 0 && this.state !== 'howto') {
        const txt = this.bubble;
        const cw = Math.max(140, txt.length * 10 + 28);
        const bx = CM.clamp(KERO.x - 10, 8, CM.W - cw - 8);
        D.bubble(g, bx, KERO.y - 158, cw, 46, KERO.x + 24);
        D.text(g, txt, bx + cw / 2, KERO.y - 135, { size: 17, weight: 800, color: P.pinkDeep });
      }

      // HUD
      if (this.state === 'play' || this.state === 'allchopped') this.drawHud(g);

      // "Yum!" pop overlay
      if (this.popT > 0) this.drawPop(g);

      if (this.state === 'allchopped' || this.state === 'done') this.drawAllBanner(g);
      if (this.state === 'howto') this.drawHowto(g);
    },

    /* ----- cozy pastel kitchen ----- */
    drawKitchen(g) {
      const wg = g.createLinearGradient(0, 0, 0, CM.H);
      wg.addColorStop(0, '#fff0f5');
      wg.addColorStop(1, '#ffe6ef');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, CM.H);

      // wall tiles up top
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = 2;
      for (let x = 0; x <= CM.W; x += 60) {
        g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 150); g.stroke();
      }
      for (let y = 0; y <= 150; y += 50) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(CM.W, y); g.stroke();
      }

      // a shelf with little jars
      D.rr(g, 560, 70, 340, 16, 6, '#e8c8a8', '#c9a47e', 2);
      const jarCol = [P.pink, P.mint, P.lavender, P.yellow];
      for (let i = 0; i < 4; i++) {
        const jx = 600 + i * 74;
        D.rr(g, jx - 18, 28, 36, 42, 8, jarCol[i], '#fff', 2);
        D.rr(g, jx - 14, 22, 28, 10, 4, '#fff', '#e0d0d8', 2);
        D.circle(g, jx - 6, 44, 4, 'rgba(255,255,255,0.7)');
      }

      // bunting along the very top
      const cols = [P.pink, P.blue, P.yellow, P.mint, P.lavender];
      for (let i = 0; i * 64 < CM.W; i++) {
        g.fillStyle = cols[i % cols.length];
        g.beginPath();
        g.moveTo(i * 64, 0);
        g.lineTo(i * 64 + 64, 0);
        g.lineTo(i * 64 + 32, 22);
        g.closePath();
        g.fill();
      }

      // counter top (where the board sits)
      D.rr(g, 0, 470, CM.W, CM.H - 470, 0, '#f3d9bf');
      g.fillStyle = '#e8c8a8';
      g.fillRect(0, 470, CM.W, 8);
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillRect(0, 466, CM.W, 4);
    },

    /* ----- the wooden cutting board ----- */
    drawBoard(g) {
      const bob = this.boardBob > 0 ? Math.sin(this.boardBob * Math.PI) * 4 : 0;
      g.save();
      g.translate(0, bob);

      // ground shadow
      D.ellipse(g, BOARD_X + BOARD_W / 2 + 6, BOARD_Y + 96, BOARD_W / 2 + 30, 34, 'rgba(120,80,50,0.18)');

      const bx = BOARD_X - 40, by = BOARD_Y - 70, bw = BOARD_W + 80, bh = 150;
      // board body
      D.rr(g, bx, by, bw, bh, 26, '#d8a774', '#b9854f', 4);
      // lighter top surface
      D.rr(g, bx + 8, by + 8, bw - 16, bh - 16, 20, '#e8c191', '#cda06b', 2);
      // wood grain lines
      g.strokeStyle = 'rgba(170,120,70,0.35)';
      g.lineWidth = 2;
      for (let i = 0; i < 4; i++) {
        const gy = by + 28 + i * 30;
        g.beginPath();
        g.moveTo(bx + 18, gy);
        g.bezierCurveTo(bx + bw * 0.33, gy - 5, bx + bw * 0.66, gy + 5, bx + bw - 18, gy);
        g.stroke();
      }
      // little handle hole on the right
      D.circle(g, bx + bw - 26, by + bh / 2, 9, '#c79a66', '#b9854f', 2);

      g.restore();
    },

    /* ----- the ingredient + its cut guides + sliding slices ----- */
    drawIngredient(g) {
      const c = this.cur;
      const def = c.def;
      const t = CM.time;

      // arrival / departure horizontal offset
      let xOff = 0;
      if (c.slideIn > 0) xOff = c.slideIn * 520;          // comes in from the right
      if (c.slideOut > 0) xOff = -CM.clamp(c.slideOut / 0.75, 0, 1) * 560; // exits left
      const fade = c.slideOut > 0 ? 1 - CM.clamp((c.slideOut - 0.4) / 0.35, 0, 1) : 1;

      const wob = c.wob > 0 ? Math.sin(c.wob * 30) * 3 * c.wob : 0;
      const bob = Math.sin(t * 2 + c.bornBob) * 1.5;

      g.save();
      g.globalAlpha = fade;
      g.translate(xOff, wob + bob);

      const bodyTop = BOARD_Y - def.rad;
      const bodyBot = BOARD_Y + def.rad;
      const left = c.left;
      const right = c.left + def.len;

      // For most ingredients we draw the body as a rounded capsule, then
      // overlay each cut as a dark gap and slide the left chunk apart.
      if (def.tip === 'berry') {
        this.drawStrawberry(g, c, def, fade);
      } else {
        this.drawLongVeg(g, c, def, t);
      }

      g.restore();

      // draw the glowing "next" guide marker ABOVE everything (not faded by exit)
      if (c.slideOut === 0 && c.slideIn < 0.4 && c.nextGuide < c.guides.length) {
        const ng = c.guides[c.nextGuide];
        this.drawGuideGlow(g, ng.x + xOff, def, t);
      }
    },

    // long veg/fruit (carrot, cucumber, banana): a capsule sliced into chunks
    drawLongVeg(g, c, def, t) {
      const left = c.left, len = def.len, rad = def.rad;
      const curve = def.curve || 0; // banana bend
      const cyBase = BOARD_Y;

      // Build the list of slice segments based on cut guides.
      // Each segment spans [x0, x1]; cut segments slide left a bit.
      const xs = [left];
      for (const gd of c.guides) xs.push(gd.x);
      xs.push(left + len);

      // accumulate slide: each cut adds spread to segments left of it.
      // Simpler readable approach: each cut segment shifts left by an amount
      // proportional to how many cuts are to its right * its slide progress.
      const segCount = xs.length - 1;

      for (let s = 0; s < segCount; s++) {
        let x0 = xs[s], x1 = xs[s + 1];
        // shift this segment apart: cuts open a gap. Sum of completed slides
        // for guides to the LEFT of this segment pushes it right slightly,
        // for guides to the RIGHT pushes it left — gives a fan-apart feel.
        let shift = 0;
        for (let gi = 0; gi < c.guides.length; gi++) {
          const gd = c.guides[gi];
          if (gd.cut) {
            if (gd.x <= x0 + 0.5) shift += gd.slide * 7;   // guide left of seg
            else if (gd.x >= x1 - 0.5) shift -= gd.slide * 7; // guide right of seg
          }
        }
        const ox0 = x0 + shift, ox1 = x1 + shift;
        const segCx = (ox0 + ox1) / 2;
        const segW = ox1 - ox0;

        // vertical bend for banana: midpoint rises
        const tt = (segCx - left) / len;
        const bend = curve ? -Math.sin(tt * Math.PI) * rad * curve : 0;
        const cy = cyBase + bend;

        // is this an end cap?
        const isLeftEnd = s === 0;
        const isRightEnd = s === segCount - 1;

        g.save();
        // shadow under each chunk
        D.ellipse(g, segCx, cyBase + rad + 6, segW / 2, 7, 'rgba(120,80,50,0.16)');

        // chunk body
        const r = Math.min(rad, segW / 2);
        // draw rounded-rect chunk; pointed tip for carrot's right end
        if (def.tip === 'point' && isRightEnd) {
          // tapered tip
          g.beginPath();
          g.moveTo(ox0, cy - rad);
          g.lineTo(ox1 - 4, cy - rad * 0.35);
          g.quadraticCurveTo(ox1 + 10, cy, ox1 - 4, cy + rad * 0.35);
          g.lineTo(ox0, cy + rad);
          g.closePath();
          g.fillStyle = def.body; g.fill();
          g.strokeStyle = def.bodyDk; g.lineWidth = 3; g.stroke();
        } else {
          D.rr(g, ox0, cy - rad, segW, rad * 2, r, def.body, def.bodyDk, 3);
        }

        // cut-face highlight on freshly exposed ends (inner rings/sheen)
        if (!isLeftEnd) {
          // left face of this chunk = a cut face
          this.drawCutFace(g, ox0, cy, rad, def, true);
        }
        if (!isRightEnd) {
          this.drawCutFace(g, ox1, cy, rad, def, false);
        }

        // a soft top sheen
        D.ellipse(g, segCx, cy - rad * 0.5, Math.max(4, segW / 2 - 5), rad * 0.28, 'rgba(255,255,255,0.28)');

        g.restore();
      }

      // leafy crown on the carrot's left end
      if (def.tip === 'point') {
        const lx = left - 4 + (c.guides[0] && c.guides[0].cut ? 0 : 0);
        g.save();
        g.fillStyle = '#7fcf95';
        for (let i = -1; i <= 1; i++) {
          g.beginPath();
          g.ellipse(lx - 6, cyBase - rad - 8 + i * 2, 5, 16, -0.5 + i * 0.4, 0, Math.PI * 2);
          g.fill();
        }
        g.strokeStyle = '#5fb377'; g.lineWidth = 1.5;
        g.beginPath(); g.moveTo(lx, cyBase); g.lineTo(lx - 8, cyBase - rad - 10); g.stroke();
        g.restore();
      }
      // a cute face on the un-cut body (only before any chopping, fades as cut)
      if (c.nextGuide === 0) {
        const fx = left + len * 0.5;
        this.drawVegFace(g, fx, cyBase, def);
      }
    },

    drawCutFace(g, x, cy, rad, def, leftFace) {
      // an oval cut face slightly inset, lighter than the body
      g.save();
      const w = 5;
      D.ellipse(g, x, cy, w, rad - 2, def.bodyDk);
      D.ellipse(g, x, cy, w * 0.7, rad - 4,
        def.type === 'cucumber' ? '#d9f0c0' :
        def.type === 'carrot' ? '#ffc488' :
        '#fff0a8'); // banana
      // inner ring detail
      if (def.type === 'cucumber') D.ellipse(g, x, cy, w * 0.4, rad - 9, '#eaffd6');
      else if (def.type === 'banana') {
        D.circle(g, x, cy - rad * 0.35, 1.6, '#a88a2a');
        D.circle(g, x, cy + rad * 0.35, 1.6, '#a88a2a');
      } else {
        D.ellipse(g, x, cy, w * 0.4, rad - 9, '#ffd9a8');
      }
      g.restore();
    },

    drawVegFace(g, x, cy, def) {
      const eo = 12;
      D.circle(g, x - eo, cy - 4, 3.2, '#5a4a3a');
      D.circle(g, x + eo, cy - 4, 3.2, '#5a4a3a');
      D.circle(g, x - eo + 1, cy - 5, 1, '#fff');
      D.circle(g, x + eo + 1, cy - 5, 1, '#fff');
      // smile
      g.strokeStyle = '#5a4a3a'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.arc(x, cy + 2, 7, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      // rosy cheeks
      D.circle(g, x - eo - 4, cy + 4, 3, 'rgba(255,120,140,0.4)');
      D.circle(g, x + eo + 4, cy + 4, 3, 'rgba(255,120,140,0.4)');
    },

    drawStrawberry(g, c, def, fade) {
      const left = c.left, len = def.len, rad = def.rad;
      const cyBase = BOARD_Y;
      // a strawberry is wider than tall; cut into vertical wedges
      const xs = [left];
      for (const gd of c.guides) xs.push(gd.x);
      xs.push(left + len);
      const segCount = xs.length - 1;

      for (let s = 0; s < segCount; s++) {
        let x0 = xs[s], x1 = xs[s + 1];
        let shift = 0;
        for (let gi = 0; gi < c.guides.length; gi++) {
          const gd = c.guides[gi];
          if (gd.cut) {
            if (gd.x <= x0 + 0.5) shift += gd.slide * 9;
            else if (gd.x >= x1 - 0.5) shift -= gd.slide * 9;
          }
        }
        const ox0 = x0 + shift, ox1 = x1 + shift;
        const segCx = (ox0 + ox1) / 2;
        const segW = ox1 - ox0;
        const cx = (left + len / 2);

        g.save();
        // clip a heart-ish berry body and fill this vertical slab
        g.beginPath();
        g.rect(ox0, cyBase - rad - 30, segW, rad * 2 + 60);
        g.clip();
        // berry body (rounded triangle / heart)
        g.beginPath();
        g.moveTo(cx + shift, cyBase - rad);
        g.bezierCurveTo(cx - rad * 1.5 + shift, cyBase - rad, cx - rad + shift, cyBase + rad, cx + shift, cyBase + rad * 1.05);
        g.bezierCurveTo(cx + rad + shift, cyBase + rad, cx + rad * 1.5 + shift, cyBase - rad, cx + shift, cyBase - rad);
        g.closePath();
        g.fillStyle = def.body; g.fill();
        g.strokeStyle = def.bodyDk; g.lineWidth = 3; g.stroke();
        // seeds
        g.fillStyle = '#fff3c0';
        for (let sy = 0; sy < 5; sy++) {
          for (let sx = -2; sx <= 2; sx++) {
            const px = cx + shift + sx * (rad * 0.42) + (sy % 2) * 10;
            const py = cyBase - rad * 0.6 + sy * (rad * 0.42);
            g.save();
            g.translate(px, py); g.rotate(0.3);
            g.beginPath(); g.ellipse(0, 0, 2.2, 3.4, 0, 0, Math.PI * 2); g.fill();
            g.restore();
          }
        }
        g.restore();
      }

      // green leafy top + cut faces
      const topX = left + len / 2;
      g.save();
      g.fillStyle = '#7fcf95';
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(topX, cyBase - rad - 2);
        g.lineTo(topX + i * 11, cyBase - rad - 22);
        g.lineTo(topX + i * 11 + 7, cyBase - rad - 4);
        g.closePath();
        g.fill();
      }
      g.strokeStyle = '#5fb377'; g.lineWidth = 1.5; g.stroke();
      g.restore();

      // little face if untouched
      if (c.nextGuide === 0) this.drawVegFace(g, topX, cyBase + 4, def);
    },

    // pulsing glow + dotted line over the next guide to cut
    drawGuideGlow(g, x, def, t) {
      const pulse = 0.55 + 0.45 * Math.sin(t * 6);
      const top = BOARD_Y - def.rad - 26;
      const bot = BOARD_Y + def.rad + 14;

      // glow halo
      g.save();
      g.globalAlpha = 0.25 + pulse * 0.3;
      const grd = g.createLinearGradient(x - 14, 0, x + 14, 0);
      grd.addColorStop(0, 'rgba(255,255,255,0)');
      grd.addColorStop(0.5, 'rgba(255,240,140,0.9)');
      grd.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grd;
      g.fillRect(x - 14, top, 28, bot - top);
      g.restore();

      // dotted cut line
      g.save();
      g.strokeStyle = '#fff';
      g.lineWidth = 3;
      g.setLineDash([7, 7]);
      g.lineDashOffset = -t * 26;
      g.beginPath();
      g.moveTo(x, top + 4);
      g.lineTo(x, bot);
      g.stroke();
      g.strokeStyle = '#e6a82c';
      g.lineWidth = 1.5;
      g.stroke();
      g.setLineDash([]);
      g.restore();

      // a bobbing "chop here" arrow + sparkle
      const ay = top - 8 - Math.sin(t * 6) * 4;
      g.fillStyle = '#ff7da0';
      g.beginPath();
      g.moveTo(x, ay + 12);
      g.lineTo(x - 9, ay);
      g.lineTo(x + 9, ay);
      g.closePath();
      g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.stroke();
      if (pulse > 0.8) D.star(g, x + 14, top + 6, 4, '#fff3a0');
    },

    /* ----- the hovering knife ----- */
    drawKnife(g) {
      const c = this.cur;
      if (!c) return;
      // knife hovers above the NEXT guide, drops onto it when chopping
      let kx;
      if (c.nextGuide < c.guides.length) {
        kx = c.guides[c.nextGuide].x;
      } else {
        kx = c.cx; // all done
      }
      // shift with arrival/exit
      if (c.slideIn > 0) kx += c.slideIn * 520;
      if (c.slideOut > 0) kx -= CM.clamp(c.slideOut / 0.75, 0, 1) * 560;

      const by = this.knifeY;       // blade-bottom y
      const t = CM.time;
      const hover = this.chopping ? 0 : Math.sin(t * 3) * 3;

      g.save();
      g.translate(kx, by + hover);

      // motion blur streak while chopping
      if (this.chopping && this.knifeVy > 200) {
        g.globalAlpha = 0.25;
        g.fillStyle = '#cfd6df';
        g.fillRect(-2, -90, 4, 80);
        g.globalAlpha = 1;
      }

      // blade (pointing down, edge at y=0)
      g.beginPath();
      g.moveTo(-13, -78);
      g.lineTo(13, -78);
      g.lineTo(13, -16);
      g.lineTo(0, 0);          // pointed cutting edge
      g.lineTo(-13, -16);
      g.closePath();
      const bg = g.createLinearGradient(-13, 0, 13, 0);
      bg.addColorStop(0, '#eef2f7');
      bg.addColorStop(0.5, '#ffffff');
      bg.addColorStop(1, '#b9c2cd');
      g.fillStyle = bg;
      g.fill();
      g.strokeStyle = '#8b95a3'; g.lineWidth = 2; g.stroke();
      // edge highlight
      g.strokeStyle = 'rgba(255,255,255,0.9)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-10, -72); g.lineTo(-3, -10); g.stroke();
      // bolster
      D.rr(g, -15, -90, 30, 14, 4, '#cfd6df', '#9aa3b0', 2);
      // handle
      D.rr(g, -12, -128, 24, 42, 10, P.pinkDeep, '#c33b5e', 2);
      D.circle(g, 0, -120, 3, '#fff');
      D.circle(g, 0, -100, 3, '#fff');
      // a cute heart on the handle
      D.heart(g, 0, -110, 8, '#ffd0dd');

      g.restore();
    },

    /* ----- host: Keroppi the chef ----- */
    drawHost(g) {
      const t = CM.time;
      const happy = (this.state === 'play' && this.popT > 0) ||
        this.state === 'allchopped' || this.state === 'done';
      const bob = happy ? (t * 2.6) % 1 : ((t * 1.0) % 1) * 0.4;

      // apron behind/under the friend
      g.save();
      // simple apron bib drawn at his belly
      D.rr(g, KERO.x - 26, KERO.y - 58, 52, 50, 12, '#fff', '#f0b9d2', 2);
      D.rr(g, KERO.x - 26, KERO.y - 28, 52, 24, 8, P.pinkSoft || P.pink, '#f0b9d2', 2);
      // apron pocket + heart
      D.heart(g, KERO.x, KERO.y - 38, 14, P.pinkDeep);
      g.restore();

      CM.drawFriend(g, 'keroppi', KERO.x, KERO.y, 1.25, { bob: bob });

      // chef hat
      g.save();
      const hx = KERO.x, hy = KERO.y - 96 - (happy ? Math.sin(t * 6) * 1.5 : 0);
      D.rr(g, hx - 20, hy + 6, 40, 14, 5, '#fff', '#e6dde4', 2);
      D.circle(g, hx - 12, hy, 12, '#fff', '#e6dde4', 2);
      D.circle(g, hx + 12, hy, 12, '#fff', '#e6dde4', 2);
      D.circle(g, hx, hy - 6, 14, '#fff', '#e6dde4', 2);
      g.restore();

      // name tag
      D.rr(g, KERO.x - 44, KERO.y + 8, 88, 22, 11, 'rgba(255,255,255,0.9)');
      D.text(g, 'Chef Keroppi', KERO.x, KERO.y + 19, { size: 14, color: P.ink, weight: 800 });
    },

    drawParts(g) {
      for (const p of this.parts) {
        g.globalAlpha = CM.clamp(p.life / p.maxLife, 0, 1);
        if (p.kind === 'spark') D.star(g, p.x, p.y, p.size, p.color || P.yellowDeep, p.rot);
        else if (p.kind === 'bit') {
          g.save(); g.translate(p.x, p.y); g.rotate(p.rot || 0);
          D.rr(g, -p.size / 2, -p.size / 2, p.size, p.size, 3, p.color || P.pink);
          g.restore();
        } else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, P.pink);
        else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, { size: 22, color: p.color || '#c98a1f', weight: 800, stroke: '#ffffff', strokeWidth: 5 });
        }
      }
      g.globalAlpha = 1;
    },

    /* ----- HUD ----- */
    drawHud(g) {
      // score, top-left
      D.rr(g, 14, 12, 168, 44, 20, 'rgba(255,255,255,0.92)', '#f0b9d2', 2);
      D.coin(g, 36, 34, 12);
      D.text(g, String(this.score), 110, 34, { size: 22, color: '#c98a1f', weight: 800 });

      // ingredient progress, top-center
      const n = INGREDIENTS.length;
      const pw = 22, pgap = 8, tw = n * pw + (n - 1) * pgap;
      const sx = (CM.W - tw) / 2;
      for (let i = 0; i < n; i++) {
        const cxp = sx + i * (pw + pgap) + pw / 2;
        const done = i < this.idx;
        const cur = i === this.idx && this.state === 'play';
        D.rr(g, cxp - pw / 2, 18, pw, pw, 6,
          done ? P.mintDeep : (cur ? P.yellow : 'rgba(255,255,255,0.85)'),
          '#f0b9d2', 2);
        if (done) {
          g.strokeStyle = '#fff'; g.lineWidth = 3; g.lineCap = 'round';
          g.beginPath();
          g.moveTo(cxp - 5, 29); g.lineTo(cxp - 1, 33); g.lineTo(cxp + 6, 24);
          g.stroke();
        }
      }
      D.text(g, 'Ingredients', CM.W / 2, 52, { size: 14, color: '#9a7b6a', weight: 700 });

      // timer bar, top-right area (kept clear of reserved corner x>860,y<60)
      const tfrac = CM.clamp(this.timeLeft / SESSION_TIME, 0, 1);
      const bx = 660, by = 70, bw = 240, bh = 18;
      D.rr(g, bx, by, bw, bh, 9, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      const tcol = this.timeLeft > 12 ? P.mintDeep : P.yellowDeep;
      D.rr(g, bx + 3, by + 3, (bw - 6) * tfrac, bh - 6, 6, tcol);
      D.text(g, 'Time: ' + Math.ceil(this.timeLeft) + 's', bx + bw / 2, by + bh + 12, { size: 14, color: '#7a6b75', weight: 700 });

      // tap hint early on
      if (this.state === 'play' && this.score < PTS_PER_CHOP * 2) {
        const pulse = 1 + Math.sin(CM.time * 5) * 0.05;
        D.rr(g, 300, 556, 360, 32, 16, 'rgba(255,255,255,0.82)');
        D.text(g, 'TAP anywhere to CHOP the glowing line!', 480, 572,
          { size: Math.round(15 * pulse), color: P.pinkDeep, weight: 800 });
      }
    },

    drawPop(g) {
      const k = 1 - this.popT / 0.9; // 0..1
      const scale = 0.6 + Math.sin(Math.min(1, k * 1.4) * Math.PI) * 0.9;
      g.save();
      g.globalAlpha = CM.clamp(this.popT / 0.4, 0, 1);
      g.translate(this.cur ? this.cur.cx : CM.W / 2, BOARD_Y - 120);
      g.scale(scale, scale);
      D.text(g, this.popText, 0, 0, {
        size: 48, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 9
      });
      g.restore();
    },

    /* ----- overlays ----- */
    drawAllBanner(g) {
      const t = CM.time;
      g.fillStyle = 'rgba(255,255,255,0.32)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.text(g, 'All chopped! 🍴', 480, 190, {
        size: 50, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
      });
      D.text(g, this.ingredientsDone + ' ingredient' + (this.ingredientsDone === 1 ? '' : 's') + ' sliced!',
        480, 250, { size: 26, color: P.ink, weight: 800, stroke: '#fff', strokeWidth: 6 });
      D.text(g, 'Score: ' + this.score, 480, 298, {
        size: 30, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6
      });
      D.star(g, 290, 190 + Math.sin(t * 5) * 6, 18, P.yellowDeep, t * 2);
      D.star(g, 670, 190 + Math.cos(t * 5) * 6, 18, P.yellowDeep, -t * 2);
    },

    drawHowto(g) {
      const t = CM.time;
      g.fillStyle = 'rgba(70,40,70,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 175, 92, 610, 404, { title: '🔪 Chop Chop! 🥕' });

      CM.drawFriend(g, 'keroppi', 282, 398, 1.35, { bob: ((t * 1.1) % 1) * 0.5 });
      D.text(g, 'Chef Keroppi', 282, 422, { size: 14, color: P.pinkDeep, weight: 800 });

      D.text(g, 'Help chop the veggies & fruit!', 575, 158, { size: 22, color: P.ink, weight: 800 });
      D.text(g, 'TAP, click or SPACE to bring the', 575, 206, { size: 17, color: P.ink });
      D.text(g, 'knife down on the GLOWING line.', 575, 230, { size: 17, color: P.ink });
      D.text(g, 'Chop every line to finish each one', 575, 270, { size: 17, color: P.ink });
      D.text(g, 'for a Yum! bonus. 🍓', 575, 294, { size: 17, color: P.pinkDeep, weight: 800 });
      D.text(g, 'No rush — just keep chopping!', 575, 334, { size: 14, color: '#9a8a94' });

      // a teaser row of ingredients
      D.circle(g, 470, 366, 14, '#ff9a4d', '#e07a2c', 2);
      D.circle(g, 510, 366, 14, '#8fd66b', '#5fae3f', 2);
      D.circle(g, 550, 366, 14, '#ffe066', '#e6c233', 2);
      D.circle(g, 590, 366, 14, '#ff6f7d', '#e0455a', 2);

      if (CM.ui.button(g, 470, 408, 210, 60, '▶ Start!', { color: P.mintDeep, size: 24 })) {
        this.startPlay();
      }
    }
  });
})();
