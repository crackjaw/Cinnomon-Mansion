/* Cinnamoroll Mansion — Shapes & Patterns (hosted by Keroppi) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ============================================================
     A tiny, hand-checked shape library.
     Each shape draws centred at (0,0) filling roughly a `r` radius,
     so the same code renders a pattern token, an answer-button icon,
     and a "find the ___" choice. Colours are pastel + distinct.
     ============================================================ */
  const SHAPE_COLOR = {
    circle: P.pink,
    square: P.blue,
    triangle: P.mintDeep,
    star: P.yellowDeep,
    heart: P.pinkDeep,
    rectangle: P.lavenderDeep
  };
  const SHAPE_LABEL = {
    circle: 'circle', square: 'square', triangle: 'triangle',
    star: 'star', heart: 'heart', rectangle: 'rectangle'
  };

  function shapeStroke(hex) {
    // a slightly deeper outline colour per shape (just darken the fill a touch)
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * 0.78);
    const gg = Math.round(((n >> 8) & 255) * 0.78);
    const b = Math.round((n & 255) * 0.78);
    return 'rgb(' + r + ',' + gg + ',' + b + ')';
  }

  // Draw a named shape centred at (x,y), sized to ~r. `col` overrides colour.
  function drawShape(g, name, x, y, r, col) {
    const fill = col || SHAPE_COLOR[name] || P.pink;
    const stroke = shapeStroke(fill);
    g.save();
    g.lineJoin = 'round';
    if (name === 'circle') {
      D.circle(g, x, y, r, fill, stroke, 4);
      D.circle(g, x - r * 0.32, y - r * 0.32, r * 0.22, 'rgba(255,255,255,0.55)');
    } else if (name === 'square') {
      const s = r * 1.7;
      D.rr(g, x - s / 2, y - s / 2, s, s, 8, fill, stroke, 4);
      D.rr(g, x - s * 0.32, y - s * 0.34, s * 0.22, s * 0.22, 4, 'rgba(255,255,255,0.5)');
    } else if (name === 'rectangle') {
      const w = r * 2.3, h = r * 1.25;
      D.rr(g, x - w / 2, y - h / 2, w, h, 8, fill, stroke, 4);
      D.rr(g, x - w * 0.4, y - h * 0.28, w * 0.18, h * 0.3, 4, 'rgba(255,255,255,0.5)');
    } else if (name === 'triangle') {
      g.beginPath();
      g.moveTo(x, y - r);
      g.lineTo(x + r, y + r * 0.82);
      g.lineTo(x - r, y + r * 0.82);
      g.closePath();
      g.fillStyle = fill; g.fill();
      g.strokeStyle = stroke; g.lineWidth = 4; g.stroke();
    } else if (name === 'star') {
      D.star(g, x, y, r * 1.12, stroke);
      D.star(g, x, y, r * 0.98, fill);
      D.circle(g, x - r * 0.22, y - r * 0.18, r * 0.16, 'rgba(255,255,255,0.75)');
    } else if (name === 'heart') {
      // outline then fill (D.heart uses size where ~size is full height)
      D.heart(g, x, y - r * 0.18, r * 2.05, stroke);
      D.heart(g, x, y - r * 0.18, r * 1.85, fill);
      D.circle(g, x - r * 0.3, y - r * 0.3, r * 0.14, 'rgba(255,255,255,0.6)');
    }
    g.restore();
  }

  /* ============================================================
     QUESTION BANK — every item hand-verified for K → 1st grade.
     type 'pattern': `seq` is the shown row, last cell is the missing one
       (drawn as a "?"); `answer` is what truly comes next.
     type 'find': show the four `choices`; tap the one named by `answer`.
     Each token: { shape, color? }  (color only for colour-pattern rounds)
     ============================================================ */
  function buildQuestions() {
    // --- PATTERN rounds (verified continuations) ---
    // 1) shape ABAB: circle, square, circle, square, ? -> circle
    const q1 = {
      type: 'pattern', kind: 'shape',
      prompt: 'What comes next?',
      seq: ['circle', 'square', 'circle', 'square'],
      options: ['circle', 'square', 'triangle'],
      answer: 'circle'
    };
    // 2) colour ABAB: red, blue, red, blue, ? -> red
    const q2 = {
      type: 'pattern', kind: 'color',
      prompt: 'What colour comes next?',
      seq: [
        { shape: 'circle', color: P.red }, { shape: 'circle', color: P.blueDeep },
        { shape: 'circle', color: P.red }, { shape: 'circle', color: P.blueDeep }
      ],
      options: [
        { color: P.red, label: 'red' },
        { color: P.blueDeep, label: 'blue' },
        { color: P.yellowDeep, label: 'yellow' }
      ],
      answer: 'red'
    };
    // 3) size ABAB: big, small, big, small, ? -> big
    const q3 = {
      type: 'pattern', kind: 'size',
      prompt: 'What size comes next?',
      seq: [
        { shape: 'star', big: true }, { shape: 'star', big: false },
        { shape: 'star', big: true }, { shape: 'star', big: false }
      ],
      options: [
        { big: true, label: 'big' },
        { big: false, label: 'small' }
      ],
      answer: 'big'
    };
    // 4) shape ABC ABC: circle, square, triangle, circle, square, ? -> triangle
    const q4 = {
      type: 'pattern', kind: 'shape',
      prompt: 'What comes next?',
      seq: ['circle', 'square', 'triangle', 'circle', 'square'],
      options: ['triangle', 'circle', 'square'],
      answer: 'triangle'
    };
    // 5) shape AAB AAB: heart, heart, star, heart, heart, ? -> star
    const q5 = {
      type: 'pattern', kind: 'shape',
      prompt: 'What comes next?',
      seq: ['heart', 'heart', 'star', 'heart', 'heart'],
      options: ['star', 'heart', 'circle'],
      answer: 'star'
    };
    // 6) shape AABB: square, square, circle, circle, square, square, ? -> circle
    const q6 = {
      type: 'pattern', kind: 'shape',
      prompt: 'What comes next?',
      seq: ['square', 'square', 'circle', 'circle', 'square', 'square'],
      options: ['circle', 'square', 'triangle'],
      answer: 'circle'
    };

    // --- SHAPE FIND rounds (tap the named shape) ---
    const q7 = {
      type: 'find',
      prompt: 'Find the triangle!',
      choices: ['circle', 'triangle', 'square', 'star'],
      answer: 'triangle'
    };
    const q8 = {
      type: 'find',
      prompt: 'Find the star!',
      choices: ['triangle', 'heart', 'star', 'circle'],
      answer: 'star'
    };
    const q9 = {
      type: 'find',
      prompt: 'Find the circle!',
      choices: ['square', 'triangle', 'circle', 'heart'],
      answer: 'circle'
    };
    const q10 = {
      type: 'find',
      prompt: 'Find the heart!',
      choices: ['star', 'heart', 'square', 'circle'],
      answer: 'heart'
    };

    // Order: start with the easiest 2-token patterns & finds, ramp gently.
    return [q1, q7, q2, q9, q3, q8, q4, q10, q5, q6];
  }

  /* shuffle a small array in place (Fisher–Yates) */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  const SCORE_BASE = 40;     // points per correct answer
  const STREAK_BONUS = 8;    // extra per consecutive correct (capped)
  const MAX_PARTS = 90;

  const KERO = { x: 132, y: 470 }; // host, lower-left

  /* ============================================================ */
  CM.registerGame({
    id: 'shapes',
    name: 'Shapes & Patterns',

    /* ---------------- lifecycle ---------------- */
    enter() {
      this.state = 'howto';        // howto -> quiz -> done (-> finish once)
      this.questions = buildQuestions();
      this.qIdx = 0;
      this.score = 0;
      this.streak = 0;
      this.bestStreak = 0;
      this.correctCount = 0;
      this.finished = false;

      // per-question interaction state
      this.picked = -1;            // index of the button the child tapped
      this.locked = false;         // true once answered (showing result)
      this.resultGood = false;
      this.feedT = 0;              // time spent showing feedback
      this.bubble = '';            // Keroppi's speech
      this.bubbleT = 0;
      this.shk = 0;                // screen-shake magnitude

      this.parts = [];
      this.doneT = 0;

      this.buildButtons();
    },

    exit() {},

    /* ---------------- layout the answer buttons for the current Q ---------------- */
    buildButtons() {
      const q = this.questions[this.qIdx];
      this.btns = [];
      if (!q) return;

      if (q.type === 'find') {
        // four big shape tiles in a row
        const n = q.choices.length;
        const bw = 180, bh = 180, gap = 24;
        const totalW = n * bw + (n - 1) * gap;
        const startX = (CM.W - totalW) / 2;
        const y = 300;
        // randomise which slot the correct shape sits in each play
        const order = shuffle(q.choices.slice());
        for (let i = 0; i < order.length; i++) {
          this.btns.push({
            x: startX + i * (bw + gap), y: y, w: bw, h: bh,
            shape: order[i],
            value: order[i],
            correct: order[i] === q.answer,
            wob: 0
          });
        }
      } else {
        // pattern: 2-3 answer buttons across the bottom
        const opts = shuffle(q.options.slice());
        const n = opts.length;
        const bw = n >= 3 ? 200 : 230, bh = 150, gap = 30;
        const totalW = n * bw + (n - 1) * gap;
        const startX = (CM.W - totalW) / 2;
        const y = 388;
        for (let i = 0; i < opts.length; i++) {
          const o = opts[i];
          let value, correct, label;
          if (q.kind === 'shape') {
            value = o; label = SHAPE_LABEL[o]; correct = o === q.answer;
          } else if (q.kind === 'color') {
            value = o.label; label = o.label; correct = o.label === q.answer;
          } else { // size
            value = o.label; label = o.label; correct = o.label === q.answer;
          }
          this.btns.push({
            x: startX + i * (bw + gap), y: y, w: bw, h: bh,
            opt: o, value: value, label: label, correct: correct, wob: 0
          });
        }
      }
    },

    /* ---------------- particles ---------------- */
    addPart(p) { if (this.parts.length < MAX_PARTS) this.parts.push(p); },

    celebrate(cx, cy) {
      const cols = [P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep];
      for (let i = 0; i < 22; i++) {
        const a = (i / 22) * Math.PI * 2 + CM.rand(-0.2, 0.2);
        this.addPart({
          kind: Math.random() < 0.5 ? 'star' : 'heart',
          x: cx, y: cy,
          vx: Math.cos(a) * CM.rand(70, 210),
          vy: Math.sin(a) * CM.rand(70, 210) - 60,
          t: 0, life: CM.rand(0.6, 1.15),
          size: CM.rand(8, 14), color: CM.pick(cols),
          rot: CM.rand(0, 6), vr: CM.rand(-5, 5)
        });
      }
    },

    tickParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.t += dt;
        if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
        p.vy += 240 * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.rot += (p.vr || 0) * dt;
      }
    },

    say(text, t) { this.bubble = text; this.bubbleT = t; },

    /* ---------------- answering ---------------- */
    choose(idx) {
      if (this.locked) return;
      const b = this.btns[idx];
      this.picked = idx;
      this.locked = true;
      this.feedT = 0;
      if (b.correct) {
        this.resultGood = true;
        this.correctCount++;
        this.streak++;
        if (this.streak > this.bestStreak) this.bestStreak = this.streak;
        const bonus = Math.min(this.streak - 1, 4) * STREAK_BONUS;
        this.score += SCORE_BASE + bonus;
        this.shk = 5;
        CM.audio.play('ding');
        CM.audio.play('cheer');
        this.celebrate(b.x + b.w / 2, b.y + b.h / 2);
        this.say(CM.pick(['Great job!', 'Yes! Woohoo!', 'Perfect!', 'You did it!']),
          1.6);
      } else {
        this.resultGood = false;
        this.streak = 0;
        b.wob = 1;                 // the wrong tile shakes/greys
        CM.audio.play('miss');
        this.say('Almost! It\'s this one ✨', 1.8);
      }
    },

    nextQuestion() {
      this.qIdx++;
      if (this.qIdx >= this.questions.length) {
        this.state = 'done';
        this.doneT = 2.0;
        this.shk = 7;
        CM.audio.play('tada');
        this.celebrate(CM.W / 2, 250);
        return;
      }
      this.picked = -1;
      this.locked = false;
      this.resultGood = false;
      this.feedT = 0;
      this.buildButtons();
    },

    /* ---------------- update ---------------- */
    update(dt) {
      if (this.shk > 0) this.shk = Math.max(0, this.shk - dt * 14);
      if (this.bubbleT > 0) this.bubbleT -= dt;
      this.tickParts(dt);
      // gently settle the wobble on wrong tiles
      if (this.btns) {
        for (const b of this.btns) if (b.wob > 0) b.wob = Math.max(0, b.wob - dt * 2);
      }

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.startQuiz();
          break;

        case 'quiz':
          if (!this.locked) {
            // keyboard 1-4 selects
            for (let k = 1; k <= this.btns.length; k++) {
              if (CM.input.pressed(String(k))) { this.choose(k - 1); break; }
            }
            // mouse / tap
            const m = CM.input.mouse;
            if (m.clicked) {
              for (let i = 0; i < this.btns.length; i++) {
                const b = this.btns[i];
                if (m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h) {
                  this.choose(i);
                  break;
                }
              }
            }
          } else {
            // showing feedback, then advance (tap to skip after a beat)
            this.feedT += dt;
            const dur = this.resultGood ? 1.5 : 2.1;
            const canSkip = this.feedT > 0.6 &&
              (CM.input.mouse.clicked || CM.input.pressed('action'));
            if (this.feedT >= dur || canSkip) this.nextQuestion();
          }
          break;

        case 'done':
          if (this.parts.length < 50 && Math.random() < 0.25) {
            this.addPart({
              kind: Math.random() < 0.5 ? 'star' : 'heart',
              x: CM.rand(120, 840), y: CM.rand(120, 300),
              vx: CM.rand(-30, 30), vy: CM.rand(-60, -10),
              t: 0, life: 1.0, size: CM.rand(8, 13),
              color: CM.pick([P.pink, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
              rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
            });
          }
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('shapes', this.score, CM.clamp(Math.ceil(this.score / 20), 5, 30));
          }
          break;
      }
    },

    startQuiz() {
      this.state = 'quiz';
      this.say('Let\'s go!', 1.4);
    },

    /* ============================================================
       DRAW
       ============================================================ */
    draw(g) {
      g.save();
      if (this.shk > 0.2) {
        g.translate(CM.rand(-this.shk, this.shk) * 0.7, CM.rand(-this.shk, this.shk) * 0.7);
      }

      this.drawBackdrop(g);

      // Keroppi the teacher, lower-left, cheering on good answers
      const happy = (this.state === 'quiz' && this.locked && this.resultGood) ||
        this.state === 'done';
      CM.drawFriend(g, 'keroppi', KERO.x, KERO.y, 1.25, {
        bob: happy ? (CM.time * 2.4) % 1 : ((CM.time * 0.9) % 1) * 0.4
      });
      D.rr(g, KERO.x - 52, KERO.y + 8, 104, 22, 11, 'rgba(255,255,255,0.85)');
      D.text(g, 'Keroppi', KERO.x, KERO.y + 19, { size: 15, color: P.ink, weight: 800 });

      if (this.state === 'quiz' || this.state === 'done') this.drawQuiz(g);

      // particles (above the board)
      this.drawParts(g);

      g.restore(); // end shake

      // speech bubble (not shaken)
      if (this.bubbleT > 0 && this.state !== 'howto') {
        const txt = this.bubble;
        const cw = Math.max(120, txt.length * 10 + 28);
        const bx = CM.clamp(KERO.x - 18, 8, CM.W - cw - 8);
        D.bubble(g, bx, KERO.y - 150, cw, 44, KERO.x + 16);
        D.text(g, txt, bx + cw / 2, KERO.y - 128, { size: 17, weight: 800, color: P.pinkDeep });
      }

      // HUD
      if (this.state === 'quiz' || this.state === 'done') {
        D.rr(g, 14, 12, 150, 44, 14, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
        D.coin(g, 36, 34, 12);
        D.text(g, String(this.score), 108, 34, { size: 22, color: '#c98a1f', weight: 800 });
        // progress pips, top-centre
        const n = this.questions.length;
        const pw = 18, pgap = 8, tw = n * pw + (n - 1) * pgap;
        const sx = (CM.W - tw) / 2;
        for (let i = 0; i < n; i++) {
          const done = i < this.qIdx || (i === this.qIdx && this.locked && this.state === 'quiz');
          const cur = i === this.qIdx && this.state === 'quiz';
          D.circle(g, sx + i * (pw + pgap) + pw / 2, 30, 7,
            done ? P.mintDeep : (cur ? P.yellow : 'rgba(255,255,255,0.8)'),
            '#f0b9d2', 2);
        }
      }

      if (this.state === 'done') this.drawDone(g);
      if (this.state === 'howto') this.drawHowto(g);
    },

    drawBackdrop(g) {
      // cheery classroom: soft wall + green chalkboard band feel
      const wg = g.createLinearGradient(0, 0, 0, CM.H);
      wg.addColorStop(0, '#e8f7ff');
      wg.addColorStop(1, '#d7f0e2');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, CM.H);

      // floor strip
      g.fillStyle = '#cdeccd';
      g.fillRect(0, 520, CM.W, CM.H - 520);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(0, 518, CM.W, 4);

      // bunting along the top
      const cols = [P.pink, P.blue, P.yellow, P.mint, P.lavender];
      for (let i = 0; i * 60 < CM.W; i++) {
        g.fillStyle = cols[i % cols.length];
        g.beginPath();
        g.moveTo(i * 60, 0);
        g.lineTo(i * 60 + 60, 0);
        g.lineTo(i * 60 + 30, 26);
        g.closePath();
        g.fill();
      }

      // a few floaty wall shapes for atmosphere
      g.globalAlpha = 0.5;
      drawShape(g, 'star', 70, 110, 16, 'rgba(255,255,255,0.9)');
      drawShape(g, 'circle', 890, 130, 16, 'rgba(255,255,255,0.85)');
      drawShape(g, 'heart', 845, 470, 16, 'rgba(255,255,255,0.85)');
      g.globalAlpha = 1;
    },

    /* ---------------- the quiz board ---------------- */
    drawQuiz(g) {
      const q = this.questions[this.qIdx];
      if (!q) return;

      // question text on a friendly banner
      D.rr(g, 230, 64, 500, 56, 20, 'rgba(255,255,255,0.95)', '#f0b9d2', 3);
      D.text(g, q.prompt, 480, 92, { size: 30, color: P.pinkDeep, weight: 800 });

      if (q.type === 'pattern') this.drawPatternRow(g, q);

      // answer buttons
      for (let i = 0; i < this.btns.length; i++) this.drawAnswerButton(g, q, this.btns[i], i);
    },

    drawPatternRow(g, q) {
      const n = q.seq.length + 1; // +1 for the "?" cell
      const cell = 96, gap = 14;
      const totalW = n * cell + (n - 1) * gap;
      const startX = (CM.W - totalW) / 2;
      const cy = 210;
      for (let i = 0; i < n; i++) {
        const cx = startX + i * (cell + gap) + cell / 2;
        const isMissing = i === q.seq.length;
        // tile
        D.rr(g, cx - cell / 2, cy - cell / 2, cell, cell, 16,
          isMissing ? 'rgba(255,247,200,0.95)' : 'rgba(255,255,255,0.92)',
          isMissing ? P.yellowDeep : '#f0b9d2', isMissing ? 4 : 2);
        if (isMissing) {
          D.text(g, '?', cx, cy + 2, { size: 56, color: P.pinkDeep, weight: 800 });
        } else {
          this.drawSeqToken(g, q, q.seq[i], cx, cy);
        }
      }
    },

    // render one token of a pattern sequence inside a cell
    drawSeqToken(g, q, tok, cx, cy) {
      if (q.kind === 'shape') {
        drawShape(g, tok, cx, cy, 30);
      } else if (q.kind === 'color') {
        drawShape(g, tok.shape, cx, cy, 30, tok.color);
      } else if (q.kind === 'size') {
        const r = tok.big ? 34 : 17;
        drawShape(g, tok.shape, cx, cy, r);
      }
    },

    drawAnswerButton(g, q, b, idx) {
      const m = CM.input.mouse;
      const hover = !this.locked && m.x >= b.x && m.x <= b.x + b.w && m.y >= b.y && m.y <= b.y + b.h;

      // result styling
      let base = 'rgba(255,255,255,0.95)';
      let border = '#f0b9d2';
      let bw2 = 3;
      let grey = false;
      if (this.locked) {
        if (b.correct) {
          // correct answer always glows green (so a wrong tapper still learns it)
          base = '#e6f8ec'; border = P.mintDeep; bw2 = 5;
        } else if (idx === this.picked) {
          base = '#efe7ec'; border = '#c9b8c3'; grey = true; // their wrong pick greys
        } else {
          grey = true;
        }
      }

      g.save();
      // wrong-pick shake
      if (b.wob > 0) g.translate(Math.sin(b.wob * 40) * 5 * b.wob, 0);
      // correct answer gentle bounce after answering
      let bounce = 0;
      if (this.locked && b.correct) {
        bounce = -Math.abs(Math.sin((this.feedT) * 6)) * 8;
      }
      g.translate(0, bounce);

      // drop shadow + body
      D.rr(g, b.x, b.y + 5, b.w, b.h, 18, 'rgba(90,40,70,0.16)');
      D.rr(g, b.x, b.y, b.w, b.h, 18, base, border, bw2);
      if (hover) {
        D.rr(g, b.x, b.y, b.w, b.h, 18, 'rgba(255,255,255,0.25)');
      }

      if (grey) g.globalAlpha = 0.55;

      // number badge (matches keyboard 1-4)
      D.circle(g, b.x + 22, b.y + 22, 14, P.lavender, '#fff', 2);
      D.text(g, String(idx + 1), b.x + 22, b.y + 23, { size: 17, color: '#fff', weight: 800 });

      // content
      const cx = b.x + b.w / 2;
      if (q.type === 'find') {
        drawShape(g, b.shape, cx, b.y + b.h / 2 - 12, 52);
        D.text(g, SHAPE_LABEL[b.shape], cx, b.y + b.h - 24,
          { size: 24, color: P.ink, weight: 800 });
      } else if (q.kind === 'shape') {
        drawShape(g, b.value, cx, b.y + b.h / 2 - 12, 40);
        D.text(g, b.label, cx, b.y + b.h - 26, { size: 24, color: P.ink, weight: 800 });
      } else if (q.kind === 'color') {
        drawShape(g, 'circle', cx, b.y + b.h / 2 - 12, 40, b.opt.color);
        D.text(g, b.label, cx, b.y + b.h - 26, { size: 26, color: P.ink, weight: 800 });
      } else { // size
        const r = b.opt.big ? 48 : 22;
        drawShape(g, 'star', cx, b.y + b.h / 2 - 12, r);
        D.text(g, b.label, cx, b.y + b.h - 26, { size: 26, color: P.ink, weight: 800 });
      }

      // sparkle ring on the correct answer
      if (this.locked && b.correct) {
        g.globalAlpha = 0.6 + 0.4 * Math.sin(this.feedT * 8);
        D.star(g, b.x + b.w - 22, b.y + 22, 12, P.yellowDeep);
        g.globalAlpha = 1;
      }
      g.restore();
    },

    /* ---------------- particles ---------------- */
    drawParts(g) {
      for (const p of this.parts) {
        g.globalAlpha = CM.clamp(1 - p.t / p.life, 0, 1);
        if (p.kind === 'star') D.star(g, p.x, p.y, p.size, p.color, p.rot);
        else D.heart(g, p.x, p.y, p.size, p.color);
      }
      g.globalAlpha = 1;
    },

    /* ---------------- overlays ---------------- */
    drawDone(g) {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.text(g, 'You did it! 🎉', 480, 200, {
        size: 52, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
      });
      D.text(g, 'You got ' + this.correctCount + ' of ' + this.questions.length + ' right!',
        480, 262, { size: 26, color: P.ink, weight: 800, stroke: '#fff', strokeWidth: 6 });
      D.text(g, 'Score: ' + this.score, 480, 310,
        { size: 30, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6 });
      D.star(g, 300, 200 + Math.sin(CM.time * 5) * 6, 18, P.yellowDeep);
      D.star(g, 660, 200 + Math.cos(CM.time * 5) * 6, 18, P.yellowDeep);
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(70,40,70,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 175, 92, 610, 400, { title: '🔷 Shapes & Patterns 🔶' });
      CM.drawFriend(g, 'keroppi', 282, 392, 1.35, { bob: ((CM.time * 1.1) % 1) * 0.5 });
      D.text(g, 'Keroppi', 282, 416, { size: 15, color: P.pinkDeep, weight: 800 });

      D.text(g, 'Let\'s play with shapes!', 565, 162, { size: 26, color: P.ink, weight: 800 });
      D.text(g, 'See what comes NEXT in a', 565, 214, { size: 18, color: P.ink });
      D.text(g, 'pattern, or FIND the shape!', 565, 240, { size: 18, color: P.ink });
      D.text(g, 'Tap the big answer button.', 565, 286, { size: 18, color: P.pinkDeep, weight: 800 });
      D.text(g, '(or press 1, 2, 3, 4)', 565, 318, { size: 16, color: '#9a8a94' });

      // a tiny shape teaser row
      drawShape(g, 'circle', 470, 358, 16);
      drawShape(g, 'triangle', 520, 358, 16);
      drawShape(g, 'star', 570, 358, 16);
      drawShape(g, 'heart', 620, 358, 16);

      if (CM.ui.button(g, 465, 402, 210, 58, '▶ Start!', { color: P.mintDeep, size: 24 })) {
        this.startQuiz();
      }
    }
  });
})();
