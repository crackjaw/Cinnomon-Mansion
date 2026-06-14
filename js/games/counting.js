/* Cinnamoroll Mansion — Counting Fun (hosted by My Melody) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  const HOST = 'mymelody';
  const MELODY = { x: 132, y: 430 };   // host teacher, lower-left, cheering
  const MAX_PARTS = 80;

  /* ---------------------------------------------------------------
     QUESTION PLAN — hand-built difficulty ramp (10 rounds).
     Each round = a target count `n`. We draw EXACTLY n cute objects
     and the correct button is EXACTLY n. Distractors are nearby
     numbers, all clearly different from n. (Verified by hand below.)
       round  n   kind
         1    3   apple    (easy 1-5)
         2    2   star     (easy 1-5)
         3    5   balloon  (easy 1-5)
         4    4   flower   (easy 1-5)
         5    7   heart    (grow toward 10)
         6    6   apple    (grow toward 10)
         7    9   star     (grow toward 10)
         8   10   balloon  (toward 10)
         9   13   flower   (up to ~20)
        10   16   heart    (up to ~20)
     Every n is in 1..20; every drawn group has length n; every
     correct answer equals n. Re-checked each item by eye.
  --------------------------------------------------------------- */
  const KINDS = ['apple', 'star', 'balloon', 'flower', 'heart'];
  const PLAN = [
    { n: 3,  kind: 'apple' },
    { n: 2,  kind: 'star' },
    { n: 5,  kind: 'balloon' },
    { n: 4,  kind: 'flower' },
    { n: 7,  kind: 'heart' },
    { n: 6,  kind: 'apple' },
    { n: 9,  kind: 'star' },
    { n: 10, kind: 'balloon' },
    { n: 13, kind: 'flower' },
    { n: 16, kind: 'heart' }
  ];

  const KIND_LABEL = {
    apple: 'apples', star: 'stars', balloon: 'balloons',
    flower: 'flowers', heart: 'hearts'
  };
  const KIND_LABEL_1 = {
    apple: 'apple', star: 'star', balloon: 'balloon',
    flower: 'flower', heart: 'heart'
  };

  // Answer-grid geometry: four big number buttons in a row near the bottom.
  const BTN = { w: 150, h: 92, gap: 30, y: 462 };
  const BTN_TOTAL = BTN.w * 4 + BTN.gap * 3;       // 690
  const BTN_X0 = (CM.W - BTN_TOTAL) / 2;           // 135

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  /* Build the 4 answer choices for a target n: the correct value plus
     three distinct, clearly-wrong nearby numbers (all >= 1, <= 20).
     Returns { values:[...4], correctIdx }. */
  function buildChoices(n) {
    const set = { };
    set[n] = true;
    const vals = [n];
    // candidate offsets, nearest first so wrong answers feel "close"
    const offs = n <= 5
      ? [1, -1, 2, -2, 3, -3, 4]
      : [1, -1, 2, -2, 3, -3, 4, -4, 5, -5];
    // gather a pool of valid neighbours
    const pool = [];
    for (const d of offs) {
      const v = n + d;
      if (v >= 1 && v <= 20 && !set[v]) { set[v] = true; pool.push(v); }
    }
    // ensure we always have at least 3 (pad upward/downward if needed)
    let probe = 1;
    while (pool.length < 3 && probe <= 20) {
      if (probe !== n && !set[probe]) { set[probe] = true; pool.push(probe); }
      probe++;
    }
    // pick the three closest, then shuffle the four together
    pool.sort((a, b) => Math.abs(a - n) - Math.abs(b - n));
    vals.push(pool[0], pool[1], pool[2]);
    // Fisher–Yates shuffle
    for (let i = vals.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = vals[i]; vals[i] = vals[j]; vals[j] = t;
    }
    return { values: vals, correctIdx: vals.indexOf(n) };
  }

  /* Lay out n object positions inside a friendly framed area so the
     group is clearly spread out and easy to count. Returns [{x,y}]. */
  const STAGE = { x: 250, y: 96, w: 600, h: 270 };  // counting frame
  function layout(n) {
    // choose a near-square grid; for small n use a single tidy row/two rows
    let cols;
    if (n <= 3) cols = n;
    else if (n <= 6) cols = 3;
    else if (n <= 12) cols = Math.ceil(n / 2);
    else cols = Math.ceil(n / 3);
    cols = Math.max(1, cols);
    const rows = Math.ceil(n / cols);
    const padX = 64, padY = 58;
    const innerW = STAGE.w - padX * 2;
    const innerH = STAGE.h - padY * 2;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const r = Math.floor(i / cols);
      const c = i % cols;
      // items remaining on this (possibly short) last row, to center it
      const itemsThisRow = Math.min(cols, n - r * cols);
      const rowW = itemsThisRow > 1 ? innerW : 0;
      const stepX = itemsThisRow > 1 ? rowW / (itemsThisRow - 1) : 0;
      const startX = STAGE.x + padX + (innerW - rowW) / 2;
      const stepY = rows > 1 ? innerH / (rows - 1) : 0;
      const x = itemsThisRow > 1 ? startX + c * stepX : STAGE.x + STAGE.w / 2;
      const y = rows > 1 ? STAGE.y + padY + r * stepY : STAGE.y + STAGE.h / 2;
      pts.push({ x: x, y: y, ph: Math.random() * Math.PI * 2 });
    }
    return pts;
  }

  CM.registerGame({
    id: 'counting',
    name: 'Counting Fun',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';        // howto -> quiz -> done (-> finish once)
      this.score = 0;
      this.qIdx = 0;
      this.streak = 0;
      this.correctCount = 0;
      this.finished = false;

      this.parts = [];
      this.shk = { t: 0, dur: 1, mag: 0 };

      this.picked = -1;            // which button the child tapped (feedback phase)
      this.reveal = false;         // showing the answer (locked)
      this.fbT = 0;                // feedback countdown
      this.fbGood = false;
      this.bubble = '';
      this.bubbleT = 0;
      this.glowT = 0;              // pulses the correct button after a miss
      this.doneT = 0;

      // build all rounds fresh (regenerate choices/layout every enter())
      this.rounds = PLAN.map((p) => {
        const ch = buildChoices(p.n);
        return {
          n: p.n,
          kind: p.kind,
          color: kindColor(p.kind),
          values: ch.values,
          correctIdx: ch.correctIdx,
          pts: layout(p.n)
        };
      });
    },

    exit() {},

    /* ================= flow ================= */
    startQuiz() {
      this.state = 'quiz';
      this.qIdx = 0;
      this.beginRound();
    },

    beginRound() {
      this.picked = -1;
      this.reveal = false;
      this.fbT = 0;
      this.fbGood = false;
      this.glowT = 0;
      this.bubble = CM.pick(['How many?', "Let's count!", 'Count with me!', 'How many do you see?']);
      this.bubbleT = 2.4;
      this.enterT = 0;             // little pop-in for the objects
      CM.audio.play('pop');
    },

    choose(idx) {
      if (this.reveal) return;
      const r = this.rounds[this.qIdx];
      this.picked = idx;
      this.reveal = true;
      this.fbGood = idx === r.correctIdx;
      if (this.fbGood) {
        const gain = 40 + Math.min(this.streak, 5) * 6;  // small streak bonus
        this.score += gain;
        this.streak++;
        this.correctCount++;
        this.fbT = 1.5;
        this.bubble = CM.pick(['Great job!', 'Yay! Correct!', 'You got it!', 'Wonderful!', 'Perfect!']);
        this.bubbleT = 1.5;
        CM.audio.play('ding');
        CM.audio.play('cheer');
        this.doShake(0.3, 5);
        this.celebrate(20);
      } else {
        this.streak = 0;
        this.fbT = 2.1;            // a touch longer so they can learn the right one
        this.glowT = 0;
        this.bubble = "Almost! It's this one";
        this.bubbleT = 2.1;
        CM.audio.play('miss');
        this.doShake(0.18, 3);
      }
    },

    nextRound() {
      if (this.qIdx >= this.rounds.length - 1) {
        this.state = 'done';
        this.doneT = 2.0;
        CM.audio.play('tada');
        this.doShake(0.4, 6);
        this.celebrate(30);
        return;
      }
      this.qIdx++;
      this.beginRound();
    },

    /* ================= update ================= */
    update(dt) {
      if (this.shk.t > 0) this.shk.t -= dt;
      if (this.bubbleT > 0) this.bubbleT -= dt;
      this.glowT += dt;
      this.updateParts(dt);

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.startQuiz();
          break;

        case 'quiz':
          if (this.enterT < 1) this.enterT = Math.min(1, this.enterT + dt / 0.35);
          if (!this.reveal) {
            // keyboard 1-4 selects a button
            for (let k = 1; k <= 4; k++) {
              if (CM.input.pressed(String(k))) { this.choose(k - 1); break; }
            }
            // mouse / tap on a button
            if (CM.input.mouse.clicked) {
              const hit = this.buttonAt(CM.input.mouse.x, CM.input.mouse.y);
              if (hit >= 0) {
                CM.input.mouse.clicked = false;
                this.choose(hit);
              }
            }
          } else {
            this.fbT -= dt;
            // let an eager kid tap through after a short beat
            if (this.fbT < (this.fbGood ? 0.9 : 1.3) && anyPress()) this.fbT = 0;
            if (this.fbT <= 0) this.nextRound();
          }
          break;

        case 'done':
          // gentle confetti drizzle
          if (this.parts.length < 50 && Math.random() < 0.3) {
            this.spawnPart({
              x: CM.rand(180, 780), y: CM.rand(90, 200),
              vx: CM.rand(-40, 40), vy: CM.rand(-40, 30),
              life: CM.rand(0.7, 1.2),
              type: Math.random() < 0.5 ? 'star' : 'heart',
              color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
              size: CM.rand(7, 12), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
            });
          }
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('counting', this.score, CM.clamp(Math.ceil(this.score / 20), 5, 30));
          }
          break;
      }
    },

    // returns the index 0..3 of the button under (mx,my), or -1
    buttonAt(mx, my) {
      for (let i = 0; i < 4; i++) {
        const x = BTN_X0 + i * (BTN.w + BTN.gap);
        if (mx >= x && mx <= x + BTN.w && my >= BTN.y && my <= BTN.y + BTN.h) return i;
      }
      return -1;
    },

    /* ================= juice ================= */
    doShake(t, mag) { this.shk = { t: t, dur: t, mag: mag }; },

    spawnPart(pt) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      pt.maxLife = pt.life;
      this.parts.push(pt);
    },

    celebrate(n) {
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: CM.rand(260, 700), y: CM.rand(120, 300),
          vx: CM.rand(-110, 110), vy: CM.rand(-210, -40),
          life: CM.rand(0.6, 1.2),
          type: Math.random() < 0.5 ? 'star' : 'heart',
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
          size: CM.rand(7, 13), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
        });
      }
    },

    updateParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const pt = this.parts[i];
        pt.life -= dt;
        if (pt.life <= 0) { this.parts.splice(i, 1); continue; }
        pt.vy += 220 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.rot += pt.vr * dt;
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

      if (this.state === 'quiz' || this.state === 'done') {
        this.drawStage(g);
        this.drawObjects(g);
        this.drawButtons(g);
      }

      // My Melody, the counting teacher, cheering on the lower-left
      const happy = (this.state === 'quiz' && this.reveal && this.fbGood) || this.state === 'done';
      CM.drawFriend(g, HOST, MELODY.x, MELODY.y, 1.18, {
        bob: happy ? (CM.time * 2.4) % 1 : ((CM.time * 0.9) % 1) * 0.4
      });

      this.drawParts(g);
      g.restore(); // end shake

      /* ---- HUD (not shaken) ---- */
      if (this.state === 'quiz' || this.state === 'done') {
        D.rr(g, 14, 12, 168, 44, 20, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
        D.star(g, 36, 34, 11, P.yellowDeep);
        D.text(g, String(this.score), 110, 34, { size: 22, color: '#c98a1f', weight: 800 });

        D.rr(g, CM.W - 268, 64, 168, 38, 18, 'rgba(255,255,255,0.85)', '#f0b9d2', 2);
        D.text(g, 'Question ' + Math.min(this.qIdx + 1, this.rounds.length) + '/' + this.rounds.length,
          CM.W - 184, 83, { size: 16, color: P.pinkDeep, weight: 800 });
      }

      // teacher speech bubble
      if (this.bubbleT > 0 && this.bubble && this.state === 'quiz') {
        const cw = Math.max(150, this.bubble.length * 10 + 30);
        const bx = CM.clamp(MELODY.x - 20, 8, CM.W - cw - 8);
        D.bubble(g, bx, MELODY.y - 156, cw, 46, MELODY.x + 18);
        D.text(g, this.bubble, bx + cw / 2, MELODY.y - 133, {
          size: 18, weight: 800, color: this.fbGood ? P.mintDeep : P.pinkDeep
        });
      }

      // big banner on a correct answer
      if (this.state === 'quiz' && this.reveal && this.fbGood) {
        const el = 1.5 - this.fbT;
        const sc = Math.min(1, el * 5);
        D.text(g, 'YAY!', 550, 408, {
          size: 20 + 34 * sc, color: P.mintDeep, weight: 800, stroke: '#fff', strokeWidth: 9
        });
      }

      if (this.state === 'howto') this.drawHowto(g);
      if (this.state === 'done') {
        g.fillStyle = 'rgba(255,255,255,0.4)';
        g.fillRect(0, 0, CM.W, CM.H);
        D.text(g, 'Great counting! 🎉', 480, 230, {
          size: 52, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
        });
        D.text(g, 'You got ' + this.correctCount + ' of ' + this.rounds.length + ' right!',
          480, 296, { size: 28, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6 });
        D.text(g, 'Score: ' + this.score, 480, 344, { size: 26, color: '#c98a1f', weight: 800 });
        D.star(g, 300, 232 + Math.sin(CM.time * 5) * 6, 18, P.yellowDeep);
        D.star(g, 660, 232 + Math.cos(CM.time * 5) * 6, 18, P.yellowDeep);
      }
    },

    drawBackdrop(g) {
      // sunny classroom: pastel wall + floor
      const wg = g.createLinearGradient(0, 0, 0, 380);
      wg.addColorStop(0, '#fff0f6');
      wg.addColorStop(1, '#ffe2ef');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, 380);
      const fg = g.createLinearGradient(0, 360, 0, CM.H);
      fg.addColorStop(0, '#dff0ff');
      fg.addColorStop(1, '#cfe8ff');
      g.fillStyle = fg;
      g.fillRect(0, 380, CM.W, CM.H - 380);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(0, 378, CM.W, 5);

      // bunting along the top
      const cols = [P.pink, P.mint, P.yellow, P.lavender, P.blue];
      for (let i = 0; i * 60 < CM.W; i++) {
        g.fillStyle = cols[i % cols.length];
        g.beginPath();
        g.moveTo(i * 60, 0);
        g.lineTo(i * 60 + 60, 0);
        g.lineTo(i * 60 + 30, 26);
        g.closePath();
        g.fill();
      }
      // wall sparkles
      D.star(g, 64, 96, 8, 'rgba(255,255,255,0.85)');
      D.star(g, 900, 70, 7, 'rgba(255,255,255,0.8)');
      D.star(g, 858, 150, 5, 'rgba(255,255,255,0.7)');

      // a friendly 1-2-3 number banner on the wall
      D.rr(g, CM.W / 2 - 120, 36, 240, 34, 14, 'rgba(255,255,255,0.92)', '#f0b9d2', 2.5);
      D.text(g, '★ Counting Fun ★', CM.W / 2, 53, { size: 18, color: P.pinkDeep, weight: 800 });
    },

    drawStage(g) {
      // soft framed counting board where the objects sit
      D.rr(g, STAGE.x, STAGE.y, STAGE.w, STAGE.h, 26, 'rgba(255,255,255,0.92)', '#ffd0e3', 4);
      D.rr(g, STAGE.x + 10, STAGE.y + 10, STAGE.w - 20, STAGE.h - 20, 20, null, 'rgba(240,185,210,0.5)', 2);
      // little dot corners
      const cc = '#ffd0e3';
      D.circle(g, STAGE.x + 22, STAGE.y + 22, 4, cc);
      D.circle(g, STAGE.x + STAGE.w - 22, STAGE.y + 22, 4, cc);
      D.circle(g, STAGE.x + 22, STAGE.y + STAGE.h - 22, 4, cc);
      D.circle(g, STAGE.x + STAGE.w - 22, STAGE.y + STAGE.h - 22, 4, cc);

      // question prompt above the stage
      const r = this.rounds[this.qIdx];
      if (this.state === 'quiz') {
        const noun = KIND_LABEL[r.kind];
        D.text(g, 'How many ' + noun + '?', CM.W / 2, STAGE.y - 18, {
          size: 30, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 6
        });
      }
    },

    drawObjects(g) {
      const r = this.rounds[this.qIdx];
      if (!r) return;
      const grow = this.state === 'done' ? 1 : (this.enterT || 1);
      for (let i = 0; i < r.pts.length; i++) {
        const pt = r.pts[i];
        // staggered pop-in so objects appear one-by-one (helps the eye count)
        const local = CM.clamp(grow * r.pts.length - i, 0, 1);
        if (local <= 0) continue;
        const s = easeOutBack(local);
        const bob = Math.sin(CM.time * 2.4 + pt.ph) * 3;
        drawCutie(g, r.kind, pt.x, pt.y + bob, s, r.color);
      }
    },

    drawButtons(g) {
      const r = this.rounds[this.qIdx];
      if (!r) return;
      const m = CM.input.mouse;
      for (let i = 0; i < 4; i++) {
        const x = BTN_X0 + i * (BTN.w + BTN.gap);
        const y = BTN.y;
        const isCorrect = i === r.correctIdx;
        const isPicked = i === this.picked;
        const hover = !this.reveal && m.x >= x && m.x <= x + BTN.w && m.y >= y && m.y <= y + BTN.h;

        let fill = P.blue;
        const palette = [P.pink, P.blue, P.mintDeep, P.lavenderDeep];
        fill = palette[i % palette.length];

        let dx = 0, dy = 0, scale = 1, alpha = 1;
        let outline = 'rgba(255,255,255,0.8)';
        let lw = 3;

        if (this.reveal) {
          if (isCorrect) {
            // correct answer gently bounces + glows so the child learns it
            const pulse = Math.abs(Math.sin(this.glowT * 5));
            dy = -pulse * 8;
            scale = 1 + pulse * 0.06;
            fill = P.mintDeep;
            outline = '#fff';
            lw = 5;
          } else if (isPicked && !this.fbGood) {
            // the wrong choice the child tapped: grey + a little shake
            fill = '#c9bcc4';
            alpha = 0.7;
            dx = Math.sin(this.glowT * 40) * 3 * CM.clamp(this.fbT - 1.4, 0, 1);
          } else {
            // other buttons fade back
            alpha = 0.55;
          }
        }

        g.save();
        g.globalAlpha = alpha;
        const cx = x + BTN.w / 2, cy = y + BTN.h / 2;
        g.translate(cx + dx, cy + dy);
        g.scale(scale, scale);
        g.translate(-BTN.w / 2, -BTN.h / 2);

        // glow ring behind the correct answer
        if (this.reveal && isCorrect) {
          g.save();
          g.globalAlpha = alpha * (0.4 + Math.abs(Math.sin(this.glowT * 5)) * 0.4);
          D.rr(g, -10, -10, BTN.w + 20, BTN.h + 20, 26, 'rgba(255,240,170,0.9)');
          g.restore();
        }

        // shadow + body
        D.rr(g, 0, 6, BTN.w, BTN.h, 22, 'rgba(90,40,70,0.18)');
        const press = hover && m.down ? 3 : 0;
        D.rr(g, 0, press, BTN.w, BTN.h, 22, fill);
        if (hover) {
          D.rr(g, 0, press, BTN.w, BTN.h, 22, 'rgba(255,255,255,0.2)');
        }
        D.rr(g, 0, press, BTN.w, BTN.h, 22, null, outline, lw);
        D.text(g, String(r.values[i]), BTN.w / 2, BTN.h / 2 + press, {
          size: 52, color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.12)', strokeWidth: 5
        });
        // tiny number-key hint
        if (!this.reveal) {
          D.text(g, String(i + 1), 16, 16, { size: 14, color: 'rgba(255,255,255,0.85)', weight: 800 });
        }
        // check / star on the correct answer once revealed
        if (this.reveal && isCorrect) {
          D.star(g, BTN.w - 18, 16, 11, '#fff');
        }
        g.restore();
      }
      g.globalAlpha = 1;
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(70,40,70,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 180, 96, 600, 392, { title: '🍎 Counting Fun with My Melody 🍎' });
      CM.drawFriend(g, HOST, 286, 392, 1.3, { bob: ((CM.time * 1.1) % 1) * 0.5 });
      D.text(g, 'My Melody', 286, 416, { size: 14, color: P.pinkDeep, weight: 800 });
      D.text(g, 'Count the cute things!', 568, 168, { size: 22, color: P.ink, weight: 800 });
      D.text(g, 'Look at the group and count', 568, 214, { size: 18, color: P.ink });
      D.text(g, 'how many you see.', 568, 240, { size: 18, color: P.ink });
      D.text(g, 'Then tap the number that', 568, 286, { size: 18, color: P.ink });
      D.text(g, 'matches the count!', 568, 312, { size: 18, color: P.pinkDeep, weight: 800 });
      D.text(g, '10 questions · You can do it!', 480, 360, { size: 15, color: '#9a8a94' });
      // a tiny example: three apples
      for (let i = 0; i < 3; i++) drawCutie(g, 'apple', 520 + i * 40, 392, 0.85, kindColor('apple'));
      if (CM.ui.button(g, 380, 398, 200, 58, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.startQuiz();
      }
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

  /* ---------------- cute object art ---------------- */
  function kindColor(kind) {
    switch (kind) {
      case 'apple': return '#ef5b5b';
      case 'star': return P.yellowDeep;
      case 'balloon': return P.pink;
      case 'flower': return P.lavenderDeep;
      case 'heart': return P.pinkDeep;
      default: return P.pink;
    }
  }

  // ease for a springy pop-in (overshoot then settle)
  function easeOutBack(t) {
    const c1 = 1.70158, c3 = c1 + 1;
    const p = t - 1;
    return 1 + c3 * p * p * p + c1 * p * p;
  }

  // draw one cute countable object centered at (x,y), `s` = scale 0..~1.06
  function drawCutie(g, kind, x, y, s, color) {
    if (s <= 0) return;
    g.save();
    g.translate(x, y);
    g.scale(s, s);
    if (kind === 'apple') {
      D.shadow(g, 0, 22, 16);
      D.ellipse(g, 0, 2, 18, 17, color, '#c93b3b', 2.5);
      D.ellipse(g, -7, -3, 5, 6, 'rgba(255,255,255,0.55)'); // shine
      // stalk + leaf
      g.strokeStyle = '#8a5a3b'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, -14); g.lineTo(2, -22); g.stroke();
      D.ellipse(g, 9, -20, 7, 4, '#67c587', '#4f9e69', 1.5);
      // tiny happy face
      cuteFace(g, 0, 4, 4);
    } else if (kind === 'star') {
      D.shadow(g, 0, 18, 14);
      D.star(g, 0, 0, 20, color, Math.PI * -0.5);
      D.star(g, 0, 0, 9, '#fff7cf', Math.PI * -0.5);
      cuteFace(g, 0, 2, 3);
    } else if (kind === 'balloon') {
      // string
      g.strokeStyle = 'rgba(120,90,110,0.6)'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(0, 16);
      g.quadraticCurveTo(5, 26, 0, 36);
      g.stroke();
      D.shadow(g, 0, 40, 12);
      D.ellipse(g, 0, 0, 17, 21, color, '#e87fb2', 2.5);
      // knot
      g.fillStyle = color;
      g.beginPath(); g.moveTo(-4, 19); g.lineTo(4, 19); g.lineTo(0, 25); g.closePath(); g.fill();
      D.ellipse(g, -6, -7, 5, 7, 'rgba(255,255,255,0.5)'); // shine
      cuteFace(g, 0, 2, 4);
    } else if (kind === 'flower') {
      D.shadow(g, 0, 20, 15);
      // stem
      g.strokeStyle = '#67c587'; g.lineWidth = 3.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 8); g.lineTo(0, 24); g.stroke();
      D.ellipse(g, 7, 16, 6, 3.5, '#67c587');
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2;
        D.ellipse(g, Math.cos(a) * 13, Math.sin(a) * 13, 8, 8, color, '#7c5fb0', 1.5);
      }
      D.circle(g, 0, 0, 9, '#ffe9a8', '#f2b53c', 2);
      cuteFace(g, 0, 1, 2.6);
    } else if (kind === 'heart') {
      D.shadow(g, 0, 18, 14);
      D.heart(g, 0, -2, 34, color);
      // shine
      D.ellipse(g, -6, -6, 4, 5, 'rgba(255,255,255,0.5)');
      cuteFace(g, 0, 0, 3);
    }
    g.restore();
  }

  // a tiny kawaii face (two eyes + smile) centered at (cx,cy)
  function cuteFace(g, cx, cy, r) {
    g.fillStyle = '#4a3b46';
    g.beginPath(); g.arc(cx - r, cy, r * 0.42, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(cx + r, cy, r * 0.42, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#4a3b46'; g.lineWidth = 1.3; g.lineCap = 'round';
    g.beginPath(); g.arc(cx, cy + r * 0.3, r * 0.7, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
    g.fillStyle = 'rgba(255,140,160,0.5)';
    g.beginPath(); g.ellipse(cx - r * 1.5, cy + r * 0.5, r * 0.45, r * 0.32, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(cx + r * 1.5, cy + r * 0.5, r * 0.45, r * 0.32, 0, 0, Math.PI * 2); g.fill();
  }
})();
