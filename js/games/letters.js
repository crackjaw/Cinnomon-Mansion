/* Cinnamoroll Mansion — ABC Match (hosted by Hello Kitty) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ============================================================
     HAND-VERIFIED ANSWER KEY  (re-checked, every item correct)
     ------------------------------------------------------------
     (a) UPPER->lower : the lowercase truly matches the uppercase.
     (b) SOUND        : the common name of the picture obviously
                        starts with the marked letter.
     ============================================================ */

  // Uppercase letters used for the "match the lowercase" rounds.
  const CASE_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'H', 'M', 'P', 'R', 'S', 'T'];

  // Beginning-sound objects. `letter` is the first letter of `name`.
  // Each name UNAMBIGUOUSLY starts with that letter (verified by hand).
  const SOUND_ITEMS = [
    { name: 'Apple', letter: 'A', draw: drawApple },
    { name: 'Ball', letter: 'B', draw: drawBall },
    { name: 'Cat', letter: 'C', draw: drawCat },
    { name: 'Dog', letter: 'D', draw: drawDog },
    { name: 'Egg', letter: 'E', draw: drawEgg },
    { name: 'Fish', letter: 'F', draw: drawFish },
    { name: 'Hat', letter: 'H', draw: drawHat },
    { name: 'Sun', letter: 'S', draw: drawSun }
  ];

  const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const KITTY = { x: 838, y: 470 };
  const MAX_PARTS = 80;
  const N_QUESTIONS = 10;

  function anyPress() {
    return CM.input.pressed('action');
  }

  /* ============================================================
     Question generation
     ============================================================ */
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  // Build a 4-option list: the correct answer + 3 distinct wrong letters,
  // then shuffle. Returns { options:[...], correctIdx }.
  function makeOptions(correct, pool) {
    const wrong = [];
    const bag = shuffle(pool.filter((x) => x !== correct).slice());
    for (const x of bag) {
      if (wrong.length >= 3) break;
      wrong.push(x);
    }
    const opts = shuffle([correct].concat(wrong));
    return { options: opts, correctIdx: opts.indexOf(correct) };
  }

  CM.registerGame({
    id: 'letters',
    name: 'ABC Match',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';      // howto -> quiz -> done (-> finish once)
      this.score = 0;
      this.streak = 0;
      this.correctCount = 0;
      this.qIdx = 0;
      this.finished = false;

      this.questions = this.buildQuestions();

      this.picked = -1;          // index the child tapped
      this.locked = false;       // answered? (waiting before next)
      this.holdT = 0;            // time since answer locked
      this.lastRight = false;
      this.tileScale = [0, 0, 0, 0]; // pop-in animation per tile

      this.parts = [];
      this.shk = 0;
      this.hostMsg = '';
      this.hostMsgT = 0;
      this.hostHappy = 0;
      this.introT = 0;           // little slide-in for each question

      this.beginQuestion();
    },

    exit() {},

    // Mix the two round types, start easy (upper/lower) and gently fold in
    // beginning-sound questions. Every correct answer is verified above.
    buildQuestions() {
      const qs = [];

      // --- pool of UPPER->lower rounds ---
      const caseOrder = shuffle(CASE_LETTERS.slice());
      const caseQs = caseOrder.map((up) => {
        const lowerCorrect = up.toLowerCase();
        const pool = ALPHABET.map((c) => c.toLowerCase());
        const opt = makeOptions(lowerCorrect, pool);
        return {
          type: 'case',
          big: up,                       // the uppercase shown
          answer: lowerCorrect,
          options: opt.options,          // lowercase letters
          correctIdx: opt.correctIdx
        };
      });

      // --- pool of BEGINNING-SOUND rounds ---
      const soundOrder = shuffle(SOUND_ITEMS.slice());
      const soundQs = soundOrder.map((it) => {
        const opt = makeOptions(it.letter, ALPHABET.slice());
        return {
          type: 'sound',
          item: it,                      // the pictured object
          answer: it.letter,
          options: opt.options,          // uppercase letters
          correctIdx: opt.correctIdx
        };
      });

      // Ease in: first two are always upper/lower (simplest), then alternate,
      // filling up to N_QUESTIONS. Re-pick pools if we run short (we won't).
      let ci = 0, si = 0;
      const take = (arr, i) => arr[i % arr.length];
      qs.push(caseQs[ci++]);
      qs.push(caseQs[ci++]);
      while (qs.length < N_QUESTIONS) {
        if (qs.length % 2 === 0) qs.push(take(soundQs, si++));
        else qs.push(take(caseQs, ci++));
      }
      return qs.slice(0, N_QUESTIONS);
    },

    /* ================= question flow ================= */
    beginQuestion() {
      this.picked = -1;
      this.locked = false;
      this.holdT = 0;
      this.lastRight = false;
      this.introT = 0;
      this.tileScale = [0, 0, 0, 0];
    },

    answer(idx) {
      if (this.locked) return;
      const q = this.questions[this.qIdx];
      this.picked = idx;
      this.locked = true;
      this.holdT = 0;
      if (idx === q.correctIdx) {
        this.lastRight = true;
        this.correctCount++;
        this.streak++;
        const bonus = Math.min(this.streak - 1, 3) * 10; // gentle streak bonus
        this.score += 40 + bonus;
        CM.audio.play('ding');
        CM.audio.play('cheer');
        this.shk = 4;
        this.sayHost(CM.pick(['Great job!', 'Yay! Correct!', 'Wonderful!', 'You got it!', 'Super!']));
        this.hostHappy = 1.6;
        this.celebrate();
      } else {
        this.lastRight = false;
        this.streak = 0;
        CM.audio.play('miss');
        this.sayHost("Almost! It's this one");
      }
    },

    nextQuestion() {
      if (this.qIdx >= this.questions.length - 1) {
        this.state = 'done';
        this.doneT = 2.2;
        this.shk = 6;
        CM.audio.play('tada');
        this.sayHost('You did it! 🌟');
        this.hostHappy = 2.4;
        this.bigCelebrate();
        return;
      }
      this.qIdx++;
      this.beginQuestion();
    },

    sayHost(text) {
      this.hostMsg = text;
      this.hostMsgT = 1.8;
    },

    /* ================= juice ================= */
    addPart(pt) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      pt.maxLife = pt.life;
      this.parts.push(pt);
    },

    celebrate() {
      for (let i = 0; i < 16; i++) {
        this.addPart({
          x: CM.rand(330, 630), y: CM.rand(150, 250),
          vx: CM.rand(-120, 120), vy: CM.rand(-200, -50),
          life: CM.rand(0.6, 1.15),
          type: Math.random() < 0.5 ? 'star' : 'heart',
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
          size: CM.rand(8, 14), rot: CM.rand(0, 6), vr: CM.rand(-5, 5)
        });
      }
    },

    bigCelebrate() {
      for (let i = 0; i < 28; i++) {
        this.addPart({
          x: CM.rand(120, 840), y: CM.rand(120, 300),
          vx: CM.rand(-150, 150), vy: CM.rand(-240, -60),
          life: CM.rand(0.7, 1.4),
          type: Math.random() < 0.5 ? 'star' : 'heart',
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
          size: CM.rand(9, 16), rot: CM.rand(0, 6), vr: CM.rand(-5, 5)
        });
      }
    },

    updateParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const pt = this.parts[i];
        pt.life -= dt;
        if (pt.life <= 0) { this.parts.splice(i, 1); continue; }
        pt.vy += 250 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.rot += pt.vr * dt;
      }
    },

    /* ================= layout ================= */
    // four big answer tiles in a 2x2 grid
    tileRect(i) {
      const W = 230, H = 116, gapX = 40, gapY = 28;
      const totalW = W * 2 + gapX;
      const x0 = (CM.W - totalW) / 2;
      const y0 = 322;
      const col = i % 2, row = Math.floor(i / 2);
      return { x: x0 + col * (W + gapX), y: y0 + row * (H + gapY), w: W, h: H };
    },

    /* ================= update ================= */
    update(dt) {
      if (this.shk > 0) this.shk = Math.max(0, this.shk - dt * 16);
      if (this.hostMsgT > 0) this.hostMsgT -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      this.introT += dt;
      this.updateParts(dt);
      // pop-in the tiles one after another
      for (let i = 0; i < 4; i++) {
        const delay = 0.06 * i;
        const target = this.introT > delay ? 1 : 0;
        this.tileScale[i] = CM.lerp(this.tileScale[i], target, Math.min(1, dt * 14));
      }

      switch (this.state) {
        case 'howto':
          if (anyPress()) this.state = 'quiz';
          break;

        case 'quiz':
          if (!this.locked) {
            // mouse / tap on a tile
            const m = CM.input.mouse;
            if (m.clicked) {
              for (let i = 0; i < 4; i++) {
                const r = this.tileRect(i);
                if (m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h) {
                  m.clicked = false;
                  this.answer(i);
                  break;
                }
              }
            }
            // keyboard 1-4
            if (CM.input.pressed('1')) this.answer(0);
            else if (CM.input.pressed('2')) this.answer(1);
            else if (CM.input.pressed('3')) this.answer(2);
            else if (CM.input.pressed('4')) this.answer(3);
          } else {
            // showing feedback, brief happy pause, then move on
            this.holdT += dt;
            const wait = this.lastRight ? 1.25 : 1.9; // linger on wrong so they learn it
            const canSkip = this.holdT > 0.55;
            if (this.holdT >= wait || (canSkip && (anyPress() || CM.input.mouse.clicked))) {
              CM.input.mouse.clicked = false;
              this.nextQuestion();
            }
          }
          break;

        case 'done':
          // gentle confetti drizzle
          if (this.parts.length < 50 && Math.random() < 0.25) {
            this.addPart({
              x: CM.rand(140, 820), y: CM.rand(120, 240),
              vx: CM.rand(-40, 40), vy: CM.rand(-60, -10),
              life: CM.rand(0.8, 1.3),
              type: Math.random() < 0.5 ? 'star' : 'heart',
              color: CM.pick([P.pink, P.yellowDeep, P.mintDeep, P.blueDeep, P.lavenderDeep]),
              size: CM.rand(8, 14), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
            });
          }
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('letters', this.score, CM.clamp(Math.ceil(this.score / 20), 5, 30));
          }
          break;
      }
    },

    /* ================= draw ================= */
    draw(g) {
      g.save();
      if (this.shk > 0.2) {
        g.translate(CM.rand(-this.shk, this.shk) * 0.7, CM.rand(-this.shk, this.shk) * 0.7);
      }

      this.drawBackdrop(g);

      // Hello Kitty the teacher, cheering at the side
      const happy = this.hostHappy > 0 || this.state === 'done';
      const bob = happy ? (CM.time * 2.4) % 1 : ((CM.time * 0.9) % 1) * 0.4;
      CM.drawFriend(g, 'hellokitty', KITTY.x, KITTY.y, 1.12, { bob: bob, flip: true });
      D.rr(g, KITTY.x - 52, KITTY.y + 8, 104, 20, 10, 'rgba(255,255,255,0.85)');
      D.text(g, 'Hello Kitty', KITTY.x, KITTY.y + 18, { size: 14, color: P.pinkDeep, weight: 800 });

      if (this.state === 'quiz') this.drawQuiz(g);

      // host speech bubble
      if (this.hostMsgT > 0 && this.state !== 'howto') {
        const txt = this.hostMsg;
        const cw = Math.max(120, txt.length * 11 + 28);
        const bx = CM.clamp(KITTY.x - cw + 30, 8, CM.W - cw - 8);
        D.bubble(g, bx, KITTY.y - 150, cw, 44, KITTY.x - 6);
        D.text(g, txt, bx + cw / 2, KITTY.y - 128, { size: 17, weight: 800, color: P.pinkDeep });
      }

      // particles
      for (const pt of this.parts) {
        g.globalAlpha = CM.clamp(pt.life / pt.maxLife, 0, 1);
        if (pt.type === 'star') D.star(g, pt.x, pt.y, pt.size, pt.color, pt.rot);
        else D.heart(g, pt.x, pt.y, pt.size, pt.color);
      }
      g.globalAlpha = 1;

      g.restore(); // end shake

      // HUD (not shaken)
      if (this.state === 'quiz') {
        D.rr(g, 14, 12, 168, 44, 22, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
        D.coin(g, 36, 34, 12);
        D.text(g, String(this.score), 78, 34, { size: 22, color: '#c98a1f', weight: 800 });
        D.rr(g, 196, 12, 150, 44, 22, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
        D.text(g, 'Q ' + (this.qIdx + 1) + ' / ' + this.questions.length, 271, 34,
          { size: 18, color: P.blueDeep, weight: 800 });
        if (this.streak >= 2) {
          D.rr(g, 360, 12, 138, 44, 22, 'rgba(255,255,255,0.9)', P.yellowDeep, 2);
          D.star(g, 384, 34, 11, P.yellowDeep);
          D.text(g, 'Streak ' + this.streak, 432, 34, { size: 16, color: '#c98a1f', weight: 800 });
        }
      }

      if (this.state === 'howto') this.drawHowto(g);
      if (this.state === 'done') this.drawDone(g);
    },

    drawBackdrop(g) {
      // soft pastel classroom
      const wg = g.createLinearGradient(0, 0, 0, CM.H);
      wg.addColorStop(0, '#fff0f8');
      wg.addColorStop(1, '#e4f1ff');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, CM.H);
      // floor strip
      g.fillStyle = '#ffe6f0';
      g.fillRect(0, 528, CM.W, CM.H - 528);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(0, 526, CM.W, 4);
      // bunting across the top
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
      // floating alphabet letters as gentle decor
      g.save();
      const decoLetters = ['A', 'b', 'C', 'd', 'E', 'f'];
      for (let i = 0; i < decoLetters.length; i++) {
        const x = 70 + i * 165;
        const y = 96 + Math.sin(CM.time * 1.1 + i) * 8;
        g.globalAlpha = 0.5;
        D.text(g, decoLetters[i], x, y, {
          size: 30, weight: 800,
          color: cols[i % cols.length]
        });
      }
      g.restore();
      // wall stars
      D.star(g, 60, 150, 8, 'rgba(255,255,255,0.85)');
      D.star(g, 905, 130, 7, 'rgba(255,255,255,0.8)');
    },

    drawQuiz(g) {
      const q = this.questions[this.qIdx];
      // ---- question card ----
      const slide = CM.clamp(this.introT * 6, 0, 1);
      const qy = CM.lerp(-20, 0, slide);
      g.save();
      g.globalAlpha = slide;
      g.translate(0, qy);

      // prompt text
      const prompt = q.type === 'case'
        ? 'Find the little letter that matches!'
        : 'What letter does it start with?';
      D.rr(g, 230, 70, 500, 40, 20, 'rgba(255,255,255,0.92)', '#f0b9d2', 2);
      D.text(g, prompt, 480, 90, { size: 26, color: P.pinkDeep, weight: 800 });

      if (q.type === 'case') {
        // big uppercase tile in the centre
        const cx = 480, cy = 210;
        const pulse = 1 + Math.sin(CM.time * 3) * 0.03;
        D.rr(g, cx - 70, cy - 70, 140, 140, 26, '#fff', P.pink, 5);
        D.text(g, q.big, cx, cy + 6, {
          size: Math.round(110 * pulse), color: P.pinkDeep, weight: 800
        });
        // little hint label
        D.text(g, 'BIG letter', cx, cy + 86, { size: 16, color: '#9a8a94', weight: 800 });
      } else {
        // pictured object on a card + its name
        const cx = 480, cy = 206;
        D.rr(g, cx - 84, cy - 78, 168, 156, 24, '#fffdf6', P.blue, 5);
        g.save();
        g.translate(cx, cy + 6);
        const wob = 1 + Math.sin(CM.time * 2.4) * 0.03;
        g.scale(wob, wob);
        q.item.draw(g);
        g.restore();
        D.rr(g, cx - 70, cy + 60, 140, 34, 16, P.yellow, P.yellowDeep, 2);
        D.text(g, q.item.name + '?', cx, cy + 77, { size: 24, color: P.brown, weight: 800 });
      }
      g.restore();

      // ---- answer tiles ----
      for (let i = 0; i < 4; i++) {
        this.drawTile(g, q, i);
      }

      // hint bar
      if (!this.locked) {
        const hint = CM.touchMode ? 'Tap the right answer!' : 'Tap an answer (or press 1-4)';
        D.rr(g, 330, 572, 300, 24, 12, 'rgba(255,255,255,0.72)');
        D.text(g, hint, 480, 584, { size: 14, color: P.pinkDeep, weight: 800 });
      }
    },

    drawTile(g, q, i) {
      const r = this.tileRect(i);
      const sc = this.tileScale[i];
      const cx = r.x + r.w / 2, cy = r.y + r.h / 2;
      const isCorrect = i === q.correctIdx;
      const isPicked = i === this.picked;

      g.save();
      g.translate(cx, cy);

      let scale = 0.4 + 0.6 * sc;
      let dx = 0, dy = 0;
      let face = P.white;
      let border = '#f0b9d2';
      let bw = 4;
      let textColor = P.ink;

      if (this.locked) {
        if (isCorrect) {
          // correct answer glows / gently bounces (so they learn it even on a miss)
          const b = Math.abs(Math.sin(CM.time * 6)) * 6;
          dy = -b;
          scale *= 1.06;
          face = '#eafff0';
          border = P.mintDeep;
          bw = 6;
          textColor = P.mintDeep;
        } else if (isPicked) {
          // their wrong pick shakes and greys out
          if (this.holdT < 0.4) dx = Math.sin(this.holdT * 50) * 6;
          face = '#ededed';
          border = '#c9c0c6';
          textColor = '#a99fa6';
        } else {
          // other wrong tiles just fade back
          g.globalAlpha = 0.55;
        }
      } else {
        // interactive hover lift
        const m = CM.input.mouse;
        const hover = m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h;
        if (hover) {
          scale *= 1.04;
          face = '#fff6fb';
          border = P.pink;
        }
      }

      g.translate(dx, dy);
      g.scale(scale, scale);

      // tile body (drop shadow + face)
      D.rr(g, -r.w / 2, -r.h / 2 + 5, r.w, r.h, 22, 'rgba(90,40,70,0.16)');
      D.rr(g, -r.w / 2, -r.h / 2, r.w, r.h, 22, face, border, bw);

      // the letter (lowercase for case rounds, uppercase for sound rounds)
      D.text(g, q.options[i], 0, 4, {
        size: 64, color: textColor, weight: 800
      });

      // little number tag (1-4) for keyboard players
      D.circle(g, -r.w / 2 + 22, -r.h / 2 + 22, 14, 'rgba(255,255,255,0.9)', border, 2);
      D.text(g, String(i + 1), -r.w / 2 + 22, -r.h / 2 + 23, { size: 16, color: border, weight: 800 });

      // green check on the correct tile after answering
      if (this.locked && isCorrect) {
        g.strokeStyle = P.mintDeep;
        g.lineWidth = 6;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        g.beginPath();
        g.moveTo(r.w / 2 - 40, -6);
        g.lineTo(r.w / 2 - 28, 8);
        g.lineTo(r.w / 2 - 10, -18);
        g.stroke();
      }

      g.restore();
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(70,40,70,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 200, 96, 560, 392, { title: '🔤 ABC Match with Hello Kitty' });
      CM.drawFriend(g, 'hellokitty', 300, 430, 1.3, { bob: ((CM.time * 1.2) % 1) * 0.5 });
      D.text(g, 'Hello Kitty', 300, 454, { size: 14, color: P.pinkDeep, weight: 800 });
      D.text(g, "Let's learn our letters!", 555, 168, { size: 22, color: P.ink, weight: 800 });
      D.text(g, '1. Match a BIG letter to its', 555, 214, { size: 18, color: P.ink, weight: 700 });
      D.text(g, 'little letter (B → b).', 575, 240, { size: 18, color: P.pinkDeep, weight: 800 });
      D.text(g, '2. Or pick the letter a picture', 555, 286, { size: 18, color: P.ink, weight: 700 });
      D.text(g, 'starts with (🍎 Apple → A).', 575, 312, { size: 18, color: P.blueDeep, weight: 800 });
      D.text(g, 'Tap your answer. Every try is great!', 555, 356, { size: 15, color: '#9a8a94' });
      if (CM.ui.button(g, 460, 396, 200, 58, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.state = 'quiz';
      }
    },

    drawDone(g) {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.text(g, 'You did it! 🎉', 480, 220, {
        size: 52, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
      });
      D.text(g, 'You got ' + this.correctCount + ' of ' + this.questions.length + ' right!',
        480, 280, { size: 26, color: P.ink, weight: 800, stroke: '#fff', strokeWidth: 6 });
      D.text(g, 'Score: ' + this.score, 480, 326, { size: 30, color: P.blueDeep, weight: 800 });
      D.star(g, 250, 220 + Math.sin(CM.time * 5) * 6, 18, P.yellowDeep);
      D.star(g, 710, 220 + Math.cos(CM.time * 5) * 6, 18, P.yellowDeep);
    }
  });

  /* ============================================================
     Cute object art for the beginning-sound rounds.
     Each is drawn centred at (0,0), roughly 120px tall.
     ============================================================ */
  function drawApple(g) {
    D.circle(g, -14, 6, 30, '#ff6b7d', '#e0455a', 3);
    D.circle(g, 16, 6, 30, '#ff6b7d', '#e0455a', 3);
    // dip at the top
    g.fillStyle = '#ff6b7d';
    g.beginPath(); g.ellipse(0, -16, 26, 16, 0, 0, Math.PI * 2); g.fill();
    // stem + leaf
    g.strokeStyle = '#8a5a3b'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, -24); g.lineTo(2, -42); g.stroke();
    D.ellipse(g, 16, -40, 12, 7, '#67c587', '#4e9e69', 2);
    // shine
    D.ellipse(g, -16, -6, 7, 11, 'rgba(255,255,255,0.6)');
  }

  function drawBall(g) {
    D.circle(g, 0, 4, 40, '#ffffff', '#d8c8d2', 3);
    // pastel beach-ball panels
    const cols = [P.pink, P.blue, P.yellow, P.mint];
    for (let i = 0; i < 4; i++) {
      const a0 = (i / 4) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / 4) * Math.PI * 2 - Math.PI / 2;
      g.fillStyle = cols[i];
      g.beginPath();
      g.moveTo(0, 4);
      g.arc(0, 4, 40, a0, a1);
      g.closePath();
      g.fill();
    }
    D.circle(g, 0, 4, 8, '#ffffff', '#d8c8d2', 2);
    D.circle(g, 0, 4, 40, null, '#d8c8d2', 3);
    D.ellipse(g, -14, -12, 7, 10, 'rgba(255,255,255,0.5)');
  }

  function drawCat(g) {
    // grey kitten face
    const c = '#cfd6df', ol = '#a9b2bd';
    // ears
    g.fillStyle = c; g.strokeStyle = ol; g.lineWidth = 2;
    g.beginPath(); g.moveTo(-30, -22); g.lineTo(-40, -50); g.lineTo(-12, -34); g.closePath(); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(30, -22); g.lineTo(40, -50); g.lineTo(12, -34); g.closePath(); g.fill(); g.stroke();
    g.fillStyle = '#ffc7dd';
    g.beginPath(); g.moveTo(-28, -26); g.lineTo(-34, -44); g.lineTo(-17, -33); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(28, -26); g.lineTo(34, -44); g.lineTo(17, -33); g.closePath(); g.fill();
    D.circle(g, 0, 2, 38, c, ol, 3); // head
    // eyes
    D.ellipse(g, -14, -2, 4.5, 6, '#4a3b46');
    D.ellipse(g, 14, -2, 4.5, 6, '#4a3b46');
    D.circle(g, -12, -4, 1.6, '#fff'); D.circle(g, 16, -4, 1.6, '#fff');
    // nose + mouth
    D.ellipse(g, 0, 12, 4, 3, '#ff9ec7');
    g.strokeStyle = '#6e5862'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(0, 14); g.lineTo(0, 18);
    g.moveTo(0, 18); g.arc(-5, 18, 5, 0, Math.PI * 0.5);
    g.moveTo(0, 18); g.arc(5, 18, 5, Math.PI * 0.5, Math.PI); g.stroke();
    // whiskers
    g.lineWidth = 1.8;
    for (let s = -1; s <= 1; s += 2) {
      g.beginPath(); g.moveTo(s * 16, 8); g.lineTo(s * 44, 4); g.stroke();
      g.beginPath(); g.moveTo(s * 16, 14); g.lineTo(s * 44, 16); g.stroke();
    }
    D.ellipse(g, -22, 12, 6, 4, 'rgba(255,140,160,0.5)');
    D.ellipse(g, 22, 12, 6, 4, 'rgba(255,140,160,0.5)');
  }

  function drawDog(g) {
    const c = '#e8c39a', ol = '#caa472';
    // floppy ears
    D.ellipse(g, -34, 4, 13, 26, '#b98a55', '#9a6f3e', 2);
    D.ellipse(g, 34, 4, 13, 26, '#b98a55', '#9a6f3e', 2);
    D.circle(g, 0, 0, 38, c, ol, 3); // head
    D.ellipse(g, 0, 18, 22, 16, '#fff7ea', ol, 2); // muzzle
    // eyes
    D.circle(g, -14, -6, 4, '#4a3b46');
    D.circle(g, 14, -6, 4, '#4a3b46');
    D.circle(g, -12, -8, 1.4, '#fff'); D.circle(g, 16, -8, 1.4, '#fff');
    // nose + smile
    D.ellipse(g, 0, 10, 6, 4.5, '#4a3b46');
    g.strokeStyle = '#6e5862'; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 16, 8, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    D.ellipse(g, -22, 6, 6, 4, 'rgba(255,140,160,0.5)');
    D.ellipse(g, 22, 6, 6, 4, 'rgba(255,140,160,0.5)');
  }

  function drawEgg(g) {
    // egg in a cup-free sunny-side look (clearly an egg)
    g.fillStyle = '#ffffff';
    g.strokeStyle = '#e6dccf';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, -46);
    g.bezierCurveTo(30, -46, 34, -2, 30, 14);
    g.bezierCurveTo(24, 38, -24, 38, -30, 14);
    g.bezierCurveTo(-34, -2, -30, -46, 0, -46);
    g.closePath();
    g.fill();
    g.stroke();
    // yolk
    D.circle(g, 2, -2, 16, '#ffd24a', '#eaa92f', 3);
    D.circle(g, -4, -8, 5, 'rgba(255,255,255,0.7)');
    // cute face on the yolk
    D.circle(g, -4, -2, 1.8, '#4a3b46');
    D.circle(g, 8, -2, 1.8, '#4a3b46');
    g.strokeStyle = '#4a3b46'; g.lineWidth = 1.8; g.lineCap = 'round';
    g.beginPath(); g.arc(2, 2, 4, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
  }

  function drawFish(g) {
    // body
    D.ellipse(g, 2, 4, 38, 28, P.blue, P.blueDeep, 3);
    // tail
    g.fillStyle = P.blue; g.strokeStyle = P.blueDeep; g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-30, 4);
    g.lineTo(-54, -16);
    g.lineTo(-50, 4);
    g.lineTo(-54, 24);
    g.closePath();
    g.fill(); g.stroke();
    // top fin
    g.beginPath(); g.moveTo(2, -22); g.lineTo(16, -38); g.lineTo(22, -18); g.closePath();
    g.fillStyle = '#6fb8e0'; g.fill();
    // eye
    D.circle(g, 22, -4, 7, '#fff', '#cdd9e2', 2);
    D.circle(g, 24, -4, 3.4, '#4a3b46');
    // smile
    g.strokeStyle = '#3a6a8a'; g.lineWidth = 2.2; g.lineCap = 'round';
    g.beginPath(); g.arc(20, 10, 8, 1.05 * Math.PI, 1.85 * Math.PI); g.stroke();
    // scales shimmer
    D.ellipse(g, -6, 0, 5, 7, 'rgba(255,255,255,0.4)');
    // bubbles
    D.circle(g, 40, -22, 4, 'rgba(255,255,255,0.7)', P.blueDeep, 1.5);
    D.circle(g, 48, -32, 3, 'rgba(255,255,255,0.7)', P.blueDeep, 1.5);
  }

  function drawHat(g) {
    // a cute party/sun hat — clearly a hat
    // brim
    D.ellipse(g, 0, 28, 50, 14, '#ff9ec7', '#e87fb2', 3);
    // crown
    g.fillStyle = '#ff9ec7';
    g.strokeStyle = '#e87fb2';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(-30, 28);
    g.bezierCurveTo(-26, -40, 26, -40, 30, 28);
    g.closePath();
    g.fill();
    g.stroke();
    // ribbon band
    D.rr(g, -30, 14, 60, 14, 6, P.yellow, P.yellowDeep, 2);
    // little flower on the band
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      D.circle(g, 16 + Math.cos(a) * 6, 21 + Math.sin(a) * 6, 4, '#fff');
    }
    D.circle(g, 16, 21, 3, '#f6d44d');
    // top shine
    D.ellipse(g, -10, -16, 6, 14, 'rgba(255,255,255,0.45)');
  }

  function drawSun(g) {
    // rays
    g.strokeStyle = '#f2b53c';
    g.lineWidth = 5;
    g.lineCap = 'round';
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      g.beginPath();
      g.moveTo(Math.cos(a) * 38, Math.sin(a) * 38);
      g.lineTo(Math.cos(a) * 52, Math.sin(a) * 52);
      g.stroke();
    }
    // body
    D.circle(g, 0, 0, 34, '#ffd24a', '#eaa92f', 3);
    // face
    D.circle(g, -12, -4, 3.4, '#7a5a1f');
    D.circle(g, 12, -4, 3.4, '#7a5a1f');
    g.strokeStyle = '#7a5a1f'; g.lineWidth = 2.6; g.lineCap = 'round';
    g.beginPath(); g.arc(0, 4, 12, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    D.ellipse(g, -18, 6, 6, 4, 'rgba(255,140,160,0.5)');
    D.ellipse(g, 18, 6, 6, 4, 'rgba(255,140,160,0.5)');
  }
})();
