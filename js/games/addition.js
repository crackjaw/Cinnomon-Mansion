/* Cinnamoroll Mansion — Add It Up (hosted by Pompompurin) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ============================================================
     HAND-VERIFIED ANSWER KEY (do not compute at runtime).
     Each item: a + b, the correct sum, and 3 clearly-wrong nearby
     distractors. Every option is a distinct positive integer.
     Re-checked one by one:
       1+1=2   2+1=3   2+2=4   3+2=5   4+2=6
       3+4=7   5+3=8   4+5=9   6+4=10  5+6=11
     Addends are 1-6; most sums <= 10, the last reaches 11.
     ============================================================ */
  const QUESTIONS = [
    { a: 1, b: 1, sum: 2,  wrong: [1, 3, 4],   fruit: 'apple'      },
    { a: 2, b: 1, sum: 3,  wrong: [2, 4, 5],   fruit: 'strawberry' },
    { a: 2, b: 2, sum: 4,  wrong: [3, 5, 6],   fruit: 'orange'     },
    { a: 3, b: 2, sum: 5,  wrong: [4, 6, 3],   fruit: 'cherry'     },
    { a: 4, b: 2, sum: 6,  wrong: [5, 7, 8],   fruit: 'apple'      },
    { a: 3, b: 4, sum: 7,  wrong: [6, 8, 5],   fruit: 'lemon'      },
    { a: 5, b: 3, sum: 8,  wrong: [7, 9, 6],   fruit: 'strawberry' },
    { a: 4, b: 5, sum: 9,  wrong: [8, 10, 7],  fruit: 'orange'     },
    { a: 6, b: 4, sum: 10, wrong: [9, 11, 8],  fruit: 'cherry'     },
    { a: 5, b: 6, sum: 11, wrong: [10, 12, 9], fruit: 'apple'      }
  ];

  const FRUIT_COLORS = {
    apple:      { body: '#ff8a9a', dark: '#e35c6e', leaf: '#7fc88a' },
    strawberry: { body: '#ff6f7e', dark: '#d8485a', leaf: '#7fc88a' },
    orange:     { body: '#ffb36b', dark: '#ef9038', leaf: '#7fc88a' },
    cherry:     { body: '#ef5b78', dark: '#c93b59', leaf: '#7fc88a' },
    lemon:      { body: '#ffe06a', dark: '#e8c23a', leaf: '#7fc88a' }
  };

  const MAX_PARTS = 90;
  const PURIN = { x: 838, y: 470 };
  const CORRECT_PTS = 40;
  const STREAK_BONUS = 10;

  function shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = CM.randInt(0, i);
      const t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'addition',
    name: 'Add It Up',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';      // howto -> quiz -> done -> finish once
      this.score = 0;
      this.streak = 0;
      this.qIdx = 0;
      this.finished = false;

      // a fresh shuffled copy of the verified questions each session
      this.questions = QUESTIONS.map((q) => ({
        a: q.a, b: q.b, sum: q.sum, wrong: q.wrong.slice(), fruit: q.fruit
      }));

      this.parts = [];
      this.shk = { t: 0, dur: 1, mag: 0 };
      this.feedbackT = 0;
      this.picked = -1;        // index of the answer the kid tapped
      this.wasRight = false;
      this.purinMsg = '';
      this.purinHappy = 0;
      this.doneT = 0;

      this.loadQuestion(0);
    },

    exit() {},

    /* ================= question setup ================= */
    loadQuestion(idx) {
      const q = this.questions[idx];
      // build 4 distinct options (correct + 3 wrong), then shuffle their order
      const opts = [{ n: q.sum, correct: true }];
      for (const w of q.wrong) opts.push({ n: w, correct: false });
      shuffle(opts);
      // remember each option's screen rect (filled during draw, used for hit-tests)
      for (const o of opts) { o.shake = 0; o.glow = 0; }
      this.options = opts;
      this.correctOpt = opts.findIndex((o) => o.correct);
      this.picked = -1;
      this.wasRight = false;
      this.feedbackT = 0;
    },

    /* ================= juice ================= */
    doShake(t, mag) { this.shk = { t: t, dur: t, mag: mag }; },

    spawnPart(pt) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      pt.maxLife = pt.life;
      this.parts.push(pt);
    },

    celebrate(cx, cy, n) {
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: cx + CM.rand(-60, 60), y: cy + CM.rand(-30, 30),
          vx: CM.rand(-150, 150), vy: CM.rand(-230, -60),
          life: CM.rand(0.6, 1.2),
          type: Math.random() < 0.5 ? 'star' : 'heart',
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
          size: CM.rand(8, 14), rot: CM.rand(0, 6), vr: CM.rand(-5, 5)
        });
      }
    },

    burst(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: x, y: y,
          vx: CM.rand(-120, 120), vy: CM.rand(-180, -30),
          life: CM.rand(0.35, 0.7), type: 'spark',
          color: Math.random() < 0.5 ? '#fff' : P.yellow,
          size: CM.rand(2.5, 4.5), rot: 0, vr: 0
        });
      }
    },

    updateParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const pt = this.parts[i];
        pt.life -= dt;
        if (pt.life <= 0) { this.parts.splice(i, 1); continue; }
        pt.vy += 240 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.rot += pt.vr * dt;
      }
    },

    say(text, t) {
      this.purinMsg = text;
      this.purinHappy = Math.max(this.purinHappy, t);
    },

    /* ================= answering ================= */
    answer(i) {
      if (this.picked !== -1) return;
      this.picked = i;
      const opt = this.options[i];
      const correctRect = this.options[this.correctOpt];
      if (opt.correct) {
        this.wasRight = true;
        this.streak++;
        const bonus = (this.streak - 1) * STREAK_BONUS;
        this.score += CORRECT_PTS + bonus;
        opt.glow = 1;
        CM.audio.play('ding');
        CM.audio.play('cheer');
        this.doShake(0.35, 6);
        this.celebrate(480, 250, 22);
        this.say(CM.pick(['Great job!', 'Yay! Correct!', 'You did it!', 'Wonderful!']), 1.8);
      } else {
        this.wasRight = false;
        this.streak = 0;
        opt.shake = 1;
        correctRect.glow = 1;   // gently show the right answer so they still learn
        CM.audio.play('miss');
        this.say("Almost! It's this one", 1.8);
      }
      this.feedbackT = this.wasRight ? 1.4 : 2.0;
    },

    nextQuestion() {
      if (this.qIdx >= this.questions.length - 1) {
        this.state = 'done';
        this.doneT = 2.0;
        this.shk = { t: 0, dur: 1, mag: 0 };
        CM.audio.play('tada');
        this.celebrate(480, 250, 30);
        return;
      }
      this.qIdx++;
      this.loadQuestion(this.qIdx);
    },

    /* ================= update ================= */
    update(dt) {
      if (this.shk.t > 0) this.shk.t -= dt;
      if (this.purinHappy > 0) this.purinHappy -= dt;
      this.updateParts(dt);

      // ease option shake/glow back down
      if (this.options) {
        for (const o of this.options) {
          if (o.shake > 0) o.shake = Math.max(0, o.shake - dt * 2.2);
          if (o.glow > 0) o.glow = Math.max(0, o.glow - dt * 0.6);
        }
      }

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.state = 'quiz';
          break;

        case 'quiz':
          if (this.picked === -1) {
            // keyboard 1-4 selects an option
            for (let k = 1; k <= this.options.length; k++) {
              if (CM.input.pressed(String(k))) { this.answer(k - 1); break; }
            }
          } else {
            this.feedbackT -= dt;
            // tap to skip ahead once they've had a moment to see the result
            if (this.feedbackT < (this.wasRight ? 0.8 : 1.2) && anyPress()) this.feedbackT = 0;
            if (this.feedbackT <= 0) this.nextQuestion();
          }
          break;

        case 'done':
          // gentle confetti while celebrating
          if (this.parts.length < 50 && Math.random() < 0.25) {
            this.spawnPart({
              x: CM.rand(140, 820), y: CM.rand(120, 200),
              vx: CM.rand(-40, 40), vy: CM.rand(-40, 20),
              life: CM.rand(0.8, 1.4), type: Math.random() < 0.5 ? 'star' : 'heart',
              color: CM.pick([P.pink, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
              size: CM.rand(8, 13), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
            });
          }
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('addition', this.score, CM.clamp(Math.ceil(this.score / 20), 5, 30));
          }
          break;
      }
    },

    /* ================= fruit art ================= */
    drawFruit(g, fruit, x, y, r) {
      const c = FRUIT_COLORS[fruit] || FRUIT_COLORS.apple;
      D.shadow(g, x, y + r * 0.9, r * 0.85);
      if (fruit === 'cherry') {
        // a pair of cherries on a stem
        D.circle(g, x - r * 0.5, y + r * 0.35, r * 0.62, c.body, c.dark, 2);
        D.circle(g, x + r * 0.5, y + r * 0.45, r * 0.62, c.body, c.dark, 2);
        g.strokeStyle = '#7fa86a'; g.lineWidth = 2.5; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(x - r * 0.5, y - r * 0.15);
        g.quadraticCurveTo(x, y - r * 1.1, x, y - r * 1.2);
        g.moveTo(x + r * 0.5, y - r * 0.05);
        g.quadraticCurveTo(x + r * 0.1, y - r * 1.05, x, y - r * 1.2);
        g.stroke();
        D.circle(g, x - r * 0.7, y + r * 0.15, r * 0.18, 'rgba(255,255,255,0.7)');
        D.circle(g, x + r * 0.3, y + r * 0.25, r * 0.16, 'rgba(255,255,255,0.7)');
        return;
      }
      if (fruit === 'strawberry') {
        g.fillStyle = c.body; g.strokeStyle = c.dark; g.lineWidth = 2;
        g.beginPath();
        g.moveTo(x, y - r);
        g.bezierCurveTo(x + r, y - r, x + r, y + r * 0.4, x, y + r);
        g.bezierCurveTo(x - r, y + r * 0.4, x - r, y - r, x, y - r);
        g.closePath(); g.fill(); g.stroke();
        // green cap
        g.fillStyle = c.leaf;
        for (let i = -1; i <= 1; i++) {
          g.beginPath();
          g.moveTo(x, y - r * 0.55);
          g.lineTo(x + i * r * 0.55, y - r * 1.15);
          g.lineTo(x + i * r * 0.2, y - r * 0.7);
          g.closePath(); g.fill();
        }
        // seeds
        g.fillStyle = '#fff4c8';
        for (let i = 0; i < 6; i++) {
          const sx = x + CM.rand(-r * 0.55, r * 0.55);
          const sy = y + CM.rand(-r * 0.2, r * 0.6);
          g.beginPath(); g.ellipse(sx, sy, 1.6, 2.4, 0.4, 0, Math.PI * 2); g.fill();
        }
        return;
      }
      // round fruits: apple / orange / lemon
      const rx = fruit === 'lemon' ? r * 1.05 : r;
      const ry = fruit === 'lemon' ? r * 0.82 : r;
      D.ellipse(g, x, y, rx, ry, c.body, c.dark, 2);
      // little dimple top (apple)
      if (fruit === 'apple') {
        g.strokeStyle = '#7fa86a'; g.lineWidth = 2.5; g.lineCap = 'round';
        g.beginPath(); g.moveTo(x, y - r * 0.75); g.lineTo(x + 1, y - r * 1.15); g.stroke();
        g.fillStyle = c.leaf;
        g.beginPath();
        g.ellipse(x + r * 0.4, y - r * 0.95, r * 0.32, r * 0.16, -0.6, 0, Math.PI * 2);
        g.fill();
      }
      // shine
      D.circle(g, x - r * 0.32, y - r * 0.34, r * 0.22, 'rgba(255,255,255,0.75)');
    },

    // draw a little group of `n` fruits in a tidy grid inside a soft tray
    drawGroup(g, n, cx, cy, fruit) {
      const r = 16;
      // arrange in up to 2 rows of 3
      const cols = Math.min(3, n);
      const rows = Math.ceil(n / 3);
      const gapX = 42, gapY = 40;
      const totalW = (cols - 1) * gapX;
      let drawn = 0;
      for (let row = 0; row < rows; row++) {
        const inRow = Math.min(3, n - row * 3);
        const rowW = (inRow - 1) * gapX;
        for (let col = 0; col < inRow; col++) {
          const fx = cx - rowW / 2 + col * gapX;
          const fy = cy - ((rows - 1) * gapY) / 2 + row * gapY;
          this.drawFruit(g, fruit, fx, fy, r);
          drawn++;
        }
      }
    },

    /* ================= draw ================= */
    draw(g) {
      g.save();
      if (this.shk.t > 0) {
        const m = this.shk.mag * (this.shk.t / this.shk.dur);
        g.translate(CM.rand(-m, m), CM.rand(-m, m));
      }

      this.drawBackdrop(g);

      // Pompompurin the teacher, cheering on the right
      const happy = this.purinHappy > 0 || this.state === 'done';
      CM.drawFriend(g, 'pompompurin', PURIN.x, PURIN.y, 1.15, {
        bob: happy ? (CM.time * 2.4) % 1 : ((CM.time * 0.9) % 1) * 0.4,
        flip: true
      });

      if (this.state === 'quiz' || this.state === 'done') this.drawQuestion(g);

      this.drawParts(g);
      g.restore(); // end shake

      /* ---- HUD (not shaken) ---- */
      D.rr(g, 14, 12, 188, 44, 16, 'rgba(255,255,255,0.92)', '#f0b9d2', 2);
      D.star(g, 36, 34, 11, P.yellowDeep);
      D.text(g, 'Score ' + this.score, 118, 34, { size: 20, color: '#c98a1f', weight: 800 });
      if (this.state === 'quiz' || this.state === 'done') {
        D.rr(g, 384, 12, 192, 36, 16, 'rgba(255,255,255,0.85)', '#f0b9d2', 2);
        D.text(g, 'Question ' + Math.min(this.qIdx + 1, this.questions.length) +
          ' / ' + this.questions.length, 480, 30, { size: 20, color: P.pinkDeep, weight: 800 });
        if (this.streak >= 2 && this.state === 'quiz') {
          D.rr(g, 690, 12, 160, 36, 16, 'rgba(255,255,255,0.85)', P.yellowDeep, 2);
          D.text(g, '🔥 Streak ' + this.streak, 770, 30, { size: 20, color: '#e0801f', weight: 800 });
        }
      }

      // Pompompurin's speech bubble on feedback
      if ((this.purinHappy > 0 && this.purinMsg) && this.state === 'quiz') {
        const txt = this.purinMsg;
        const cw = Math.max(150, txt.length * 11 + 30);
        const bx = CM.clamp(PURIN.x - cw + 30, 8, CM.W - cw - 8);
        D.bubble(g, bx, PURIN.y - 168, cw, 44, PURIN.x - 10);
        D.text(g, txt, bx + cw / 2, PURIN.y - 146, {
          size: 20, weight: 800, color: this.wasRight ? P.pinkDeep : P.blueDeep
        });
      }

      if (this.state === 'howto') this.drawHowto(g);
      if (this.state === 'done') this.drawDone(g);
    },

    drawBackdrop(g) {
      // soft classroom wall
      const wg = g.createLinearGradient(0, 0, 0, 230);
      wg.addColorStop(0, '#fff0d8');
      wg.addColorStop(1, '#fff8ec');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, 230);
      // pastel floor
      const fg = g.createLinearGradient(0, 210, 0, CM.H);
      fg.addColorStop(0, '#ffe6c2');
      fg.addColorStop(1, '#ffeede');
      g.fillStyle = fg;
      g.fillRect(0, 210, CM.W, CM.H - 210);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(0, 208, CM.W, 5);

      // bunting along the top
      const cols = [P.pink, P.mint, P.yellow, P.lavender, P.blue];
      for (let i = 0; i * 60 < CM.W; i++) {
        g.fillStyle = cols[i % cols.length];
        g.beginPath();
        g.moveTo(i * 60, 0);
        g.lineTo(i * 60 + 60, 0);
        g.lineTo(i * 60 + 30, 28);
        g.closePath();
        g.fill();
      }
      // friendly wall stars
      D.star(g, 80, 92, 9, 'rgba(255,255,255,0.85)');
      D.star(g, 170, 60, 6, 'rgba(255,255,255,0.7)');
      D.star(g, 250, 100, 7, 'rgba(255,255,255,0.75)');

      // chalkboard-style sign
      D.rr(g, 330, 64, 300, 40, 14, 'rgba(255,255,255,0.92)', '#f0b9d2', 2.5);
      D.text(g, '➕ Add It Up ➕', 480, 85, { size: 20, color: P.pinkDeep, weight: 800 });
    },

    drawQuestion(g) {
      const q = this.questions[this.qIdx];
      // big white work panel
      CM.ui.panel(g, 70, 120, 700, 250);

      // group A tray
      const ayA = 220;
      D.rr(g, 110, 150, 230, 150, 20, '#fff6ec', '#f3d7b0', 2);
      this.drawGroup(g, q.a, 225, ayA, q.fruit);
      D.text(g, String(q.a), 225, 320, { size: 36, color: P.blueDeep, weight: 800 });

      // big plus
      D.text(g, '+', 420, 235, { size: 64, color: P.pinkDeep, weight: 800 });

      // group B tray
      D.rr(g, 500, 150, 230, 150, 20, '#fff6ec', '#f3d7b0', 2);
      this.drawGroup(g, q.b, 615, ayA, q.fruit);
      D.text(g, String(q.b), 615, 320, { size: 36, color: P.blueDeep, weight: 800 });

      // numeral equation
      D.text(g, q.a + ' + ' + q.b + ' = ?', 420, 150, {
        size: 30, color: P.ink, weight: 800
      });

      // answer buttons (2x2 grid of big tappable targets)
      const BW = 150, BH = 64, GX = 30, GY = 22;
      const startX = 480 - BW - GX / 2;
      const startY = 412;
      for (let i = 0; i < this.options.length; i++) {
        const o = this.options[i];
        const col = i % 2, row = Math.floor(i / 2);
        const bx = startX + col * (BW + GX);
        const by = startY + row * (BH + GY);
        o.rect = { x: bx, y: by, w: BW, h: BH };
        this.drawAnswerButton(g, o, i, bx, by, BW, BH);
      }
    },

    drawAnswerButton(g, o, i, x, y, w, h) {
      const m = CM.input.mouse;
      const interactive = this.state === 'quiz' && this.picked === -1;
      const hover = interactive && m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;

      // shake offset for a wrong pick
      const sx = o.shake > 0 ? Math.sin(o.shake * 40) * 6 * o.shake : 0;

      g.save();
      g.translate(sx, 0);

      // glow halo for the correct answer (after answering)
      if (o.glow > 0) {
        const pulse = 1 + Math.sin(CM.time * 8) * 0.04;
        g.save();
        g.globalAlpha = 0.5 * o.glow;
        D.rr(g, x - 8, y - 8, w + 16, h + 16, 22, P.yellow);
        g.restore();
        // a little bounce
        g.translate(0, -Math.abs(Math.sin(CM.time * 6)) * 4 * o.glow * pulse);
      }

      // colour: greyed if it was the wrong pick; mint if revealed-correct; pink otherwise
      let col = P.pinkDeep;
      const wasPicked = this.picked === i;
      if (this.picked !== -1) {
        if (o.correct) col = P.mintDeep;
        else if (wasPicked) col = '#c4b8bf';   // greyed-out wrong choice
        else col = '#e7a8c5';                   // dim the un-chosen others
      }

      // shadow + body
      D.rr(g, x, y + 4, w, h, 18, 'rgba(90,40,70,0.18)');
      const press = hover && m.down ? 2 : 0;
      D.rr(g, x, y + press, w, h, 18, col);
      if (hover) D.rr(g, x, y + press, w, h, 18, 'rgba(255,255,255,0.18)');
      D.rr(g, x, y + press, w, h, 18, null, 'rgba(255,255,255,0.7)', 2.5);
      D.text(g, String(o.n), x + w / 2, y + h / 2 + press + 1, {
        size: 34, color: '#fff', weight: 800
      });
      g.restore();

      // click handling
      if (hover && m.clicked) {
        m.clicked = false;
        this.answer(i);
      }
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(70,40,70,0.3)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 210, 96, 540, 400, { title: '➕ Add It Up with Pompompurin' });
      CM.drawFriend(g, 'pompompurin', 300, 446, 1.3, { bob: ((CM.time * 1.2) % 1) * 0.5 });
      D.text(g, 'Pompompurin', 300, 470, { size: 14, color: P.pinkDeep, weight: 800 });
      D.text(g, '1. Count both little groups', 560, 180, { size: 20, color: P.ink, weight: 700 });
      D.text(g, 'of yummy fruits!', 560, 206, { size: 20, color: P.ink, weight: 700 });
      D.text(g, '2. Add them all together', 560, 252, { size: 20, color: P.ink, weight: 700 });
      D.text(g, 'to find the total.', 560, 278, { size: 20, color: P.ink, weight: 700 });
      D.text(g, '3. Tap the right number!', 560, 324, { size: 20, color: P.pinkDeep, weight: 800 });
      D.text(g, '10 questions · Take your time · Have fun!', 480, 384, { size: 14, color: '#9a8a94' });
      if (CM.ui.button(g, 380, 410, 200, 56, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.state = 'quiz';
      }
    },

    drawDone(g) {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.text(g, 'Great adding!! 🎉', 480, 250, {
        size: 52, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
      });
      D.text(g, 'You scored ' + this.score + ' points!', 480, 312, {
        size: 28, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6
      });
      D.star(g, 250, 250 + Math.sin(CM.time * 5) * 6, 18, P.yellowDeep);
      D.star(g, 710, 250 + Math.cos(CM.time * 5) * 6, 18, P.yellowDeep);
    },

    drawParts(g) {
      for (const pt of this.parts) {
        g.globalAlpha = CM.clamp(pt.life / pt.maxLife, 0, 1);
        if (pt.type === 'star') D.star(g, pt.x, pt.y, pt.size, pt.color, pt.rot);
        else if (pt.type === 'heart') D.heart(g, pt.x, pt.y, pt.size, pt.color);
        else D.circle(g, pt.x, pt.y, pt.size, pt.color);
      }
      g.globalAlpha = 1;
    }
  });
})();
