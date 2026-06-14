/* Cinnamoroll Mansion — Spell It Out (hosted by Cinnamoroll) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ============================================================
     HAND-VERIFIED ANSWER KEY  (CVC spelling for K -> 1st grade)
     Each item:
       word    = the correct 3-letter word (re-check spelling!)
       blank   = index of the MISSING letter (0=first, 1=middle, 2=last)
       options = the letter buttons (MUST include word[blank]);
                 every OTHER option, when placed in the blank, must NOT
                 spell this picture's word -> the marked answer is unique.
       pic     = which picture to draw (matches the word)
     Verified by hand:
       cat  c_t  -> 'c'  (cat picture)   distractors d,b -> dat/bat: wrong
       dog  do_  -> 'g'  (dog picture)   distractors t,n -> dot/don: wrong
       sun  _un  -> 's'  (sun picture)   distractors r,f -> run/fun: wrong
       hat  h_t  -> 'a'  (hat picture)   distractors o,i -> hot/hit: wrong
       bed  be_  -> 'd'  (bed picture)   distractors g,t -> beg/bet: wrong
       pig  _ig  -> 'p'  (pig picture)   distractors d,w -> dig/wig: wrong
       cup  c_p  -> 'u'  (cup picture)   distractors a,o -> cap/cop: wrong
       bus  _us  -> 'b'  (bus picture)   distractors r,p -> rus/pus: wrong
       fox  _ox  -> 'f'  (fox picture)   distractors b,s -> box/sox: wrong
       net  ne_  -> 't'  (net picture)   distractors d,p -> ned/nep: wrong
     ============================================================ */
  const WORDS = [
    { word: 'cat', blank: 0, options: ['c', 'd', 'b'], pic: 'cat' },
    { word: 'sun', blank: 0, options: ['s', 'r', 'f'], pic: 'sun' },
    { word: 'dog', blank: 2, options: ['g', 't', 'n'], pic: 'dog' },
    { word: 'hat', blank: 1, options: ['a', 'o', 'i'], pic: 'hat' },
    { word: 'pig', blank: 0, options: ['p', 'd', 'w'], pic: 'pig' },
    { word: 'cup', blank: 1, options: ['u', 'a', 'o'], pic: 'cup' },
    { word: 'bus', blank: 0, options: ['b', 'r', 'p'], pic: 'bus' },
    { word: 'fox', blank: 0, options: ['f', 'b', 's'], pic: 'fox' },
    { word: 'bed', blank: 2, options: ['d', 'g', 't'], pic: 'bed' },
    { word: 'net', blank: 2, options: ['t', 'd', 'p'], pic: 'net' }
  ];

  const N_ROUNDS = 9;       // start easy, ramp gently
  const SCORE_PER = 40;     // points for a correct answer
  const STREAK_BONUS = 10;  // extra per consecutive correct (capped)
  const MAX_PARTS = 70;
  const CINNA = { x: 800, y: 520 };

  // answer-button geometry (3 big tap targets, well spaced)
  const BTN = { y: 430, w: 150, h: 96, gap: 36 };

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  CM.registerGame({
    id: 'spelling',
    name: 'Spell It Out',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';     // howto -> quiz -> done -> finish (once)
      this.score = 0;
      this.streak = 0;
      this.correctCount = 0;
      this.rIdx = 0;
      this.finished = false;

      // build this session's questions fresh every enter() (Play Again reuses object)
      this.rounds = shuffle(WORDS).slice(0, N_ROUNDS);
      this.round = null;
      this.buttons = [];
      this.picked = -1;        // index of the button the kid tapped
      this.correctBtn = -1;    // index of the correct button
      this.answered = false;
      this.outcome = '';       // 'right' | 'wrong'
      this.feedT = 0;          // counts up after an answer
      this.msg = '';

      this.parts = [];
      this.shk = { t: 0, dur: 1, mag: 0 };
      this.hostBob = 0;
      this.doneT = 0;

      this.loadRound();
    },

    exit() {},

    /* ================= round setup ================= */
    loadRound() {
      const r = this.rounds[this.rIdx];
      this.round = r;
      this.answered = false;
      this.picked = -1;
      this.outcome = '';
      this.feedT = 0;
      this.msg = '';
      // shuffle button order so the correct slot moves around
      const opts = shuffle(r.options);
      const correctLetter = r.word[r.blank];
      this.buttons = opts.map((ltr) => ({ letter: ltr, correct: ltr === correctLetter }));
      this.correctBtn = this.buttons.findIndex((b) => b.correct);
    },

    btnRect(i) {
      const n = this.buttons.length;
      const total = n * BTN.w + (n - 1) * BTN.gap;
      const x0 = (CM.W - total) / 2;
      return { x: x0 + i * (BTN.w + BTN.gap), y: BTN.y, w: BTN.w, h: BTN.h };
    },

    /* ================= answering ================= */
    choose(i) {
      if (this.answered) return;
      this.answered = true;
      this.picked = i;
      this.feedT = 0;
      const b = this.buttons[i];
      if (b.correct) {
        this.outcome = 'right';
        this.streak++;
        const bonus = Math.min(this.streak - 1, 5) * STREAK_BONUS;
        this.score += SCORE_PER + bonus;
        this.correctCount++;
        this.msg = CM.pick(['Great job!', 'You spelled it!', 'Yay! Perfect!', 'Wonderful!']);
        CM.audio.play('ding');
        CM.audio.play('cheer');
        this.doShake(0.3, 5);
        this.celebrate(this.streak >= 3 ? 22 : 14);
        this.hostBob = 1;
      } else {
        this.outcome = 'wrong';
        this.streak = 0;
        this.msg = "Almost! It's this one";
        CM.audio.play('miss');
        this.doShake(0.18, 3);
      }
    },

    advance() {
      this.rIdx++;
      if (this.rIdx >= this.rounds.length) {
        this.state = 'done';
        this.doneT = 2.0;
        CM.audio.play('tada');
        this.bigCelebrate();
      } else {
        this.loadRound();
      }
    },

    /* ================= update ================= */
    update(dt) {
      if (this.shk.t > 0) this.shk.t -= dt;
      if (this.hostBob > 0) this.hostBob = Math.max(0, this.hostBob - dt * 0.9);
      this.updateParts(dt);

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.state = 'quiz';
          break;

        case 'quiz':
          if (!this.answered) {
            // keyboard 1-4 selects an answer
            for (let i = 0; i < this.buttons.length; i++) {
              if (CM.input.pressed(String(i + 1))) { this.choose(i); break; }
            }
          } else {
            this.feedT += dt;
            const wait = this.outcome === 'right' ? 1.3 : 1.9;
            // tap-to-skip after a short beat so it never feels stuck
            if (this.feedT > 0.6 && (CM.input.mouse.clicked || CM.input.pressed('action'))) {
              CM.input.mouse.clicked = false;
              this.advance();
            } else if (this.feedT >= wait) {
              this.advance();
            }
          }
          break;

        case 'done':
          // gentle confetti drizzle while celebrating
          if (this.parts.length < 50 && Math.random() < 0.3) {
            this.spawnPart({
              x: CM.rand(160, 800), y: CM.rand(120, 220),
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
            CM.finishGame('spelling', this.score, CM.clamp(Math.ceil(this.score / 20), 5, 30));
          }
          break;
      }
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
          x: CM.rand(300, 660), y: CM.rand(150, 300),
          vx: CM.rand(-110, 110), vy: CM.rand(-200, -50),
          life: CM.rand(0.6, 1.2),
          type: Math.random() < 0.5 ? 'star' : 'heart',
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep]),
          size: CM.rand(7, 13), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
        });
      }
    },

    bigCelebrate() {
      for (let i = 0; i < 34; i++) {
        this.spawnPart({
          x: CM.rand(120, 840), y: CM.rand(80, 260),
          vx: CM.rand(-130, 130), vy: CM.rand(-220, -40),
          life: CM.rand(0.7, 1.4),
          type: Math.random() < 0.5 ? 'star' : 'heart',
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
          size: CM.rand(8, 14), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
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

    /* ================= draw ================= */
    draw(g) {
      g.save();
      // screen shake (always balanced by the restore below — every path)
      if (this.shk.t > 0) {
        const m = this.shk.mag * (this.shk.t / this.shk.dur);
        g.translate(CM.rand(-m, m), CM.rand(-m, m));
      }

      this.drawBackdrop(g);

      // host friend cheering in the corner
      const happy = (this.answered && this.outcome === 'right') || this.state === 'done';
      const bob = happy ? (CM.time * 2.4) % 1 : ((CM.time * 0.9) % 1) * 0.4;
      CM.drawFriend(g, 'cinnamoroll', CINNA.x, CINNA.y, 1.15, { bob: bob, flip: true });
      // little teacher pointer / chalk star when happy
      if (this.hostBob > 0) {
        const lift = Math.abs(Math.sin(bob * Math.PI * 2)) * 6;
        D.star(g, CINNA.x - 30, CINNA.y - 96 - lift, 8, P.yellowDeep, CM.time * 3);
      }
      // host name plate
      D.rr(g, CINNA.x - 55, CINNA.y + 8, 110, 20, 10, 'rgba(255,255,255,0.85)');
      D.text(g, 'Cinnamoroll', CINNA.x, CINNA.y + 18, { size: 14, color: P.ink, weight: 800 });

      if (this.state !== 'howto') this.drawQuiz(g);

      this.drawParts(g);
      g.restore(); // end shake — context restored on every path

      /* ---- HUD (not shaken) ---- */
      if (this.state !== 'howto') {
        D.rr(g, 14, 12, 168, 44, 22, 'rgba(255,255,255,0.9)', '#f0b9d2', 2.5);
        D.star(g, 36, 34, 11, P.yellowDeep);
        D.text(g, String(this.score), 86, 34, { size: 22, color: '#c98a1f', weight: 800 });
        // round progress
        D.rr(g, 196, 12, 150, 44, 22, 'rgba(255,255,255,0.9)', '#f0b9d2', 2.5);
        const rNum = Math.min(this.rIdx + 1, this.rounds.length);
        D.text(g, 'Word ' + rNum + '/' + this.rounds.length, 271, 34, { size: 17, color: P.pinkDeep, weight: 800 });
        // streak flame
        if (this.streak >= 2) {
          D.rr(g, 360, 12, 120, 44, 22, 'rgba(255,255,255,0.9)', P.yellowDeep, 2.5);
          D.text(g, '🔥 x' + this.streak, 420, 34, { size: 18, color: '#e0792a', weight: 800 });
        }
      }

      if (this.state === 'howto') this.drawHowto(g);
      if (this.state === 'done') this.drawDone(g);
    },

    /* ---------------- quiz screen ---------------- */
    drawQuiz(g) {
      const r = this.round;

      // big friendly prompt
      D.text(g, 'Finish the word!', CM.W / 2, 78, {
        size: 30, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 7
      });

      // picture card
      const card = { x: CM.W / 2 - 110, y: 108, w: 220, h: 150 };
      D.rr(g, card.x, card.y, card.w, card.h, 22, 'rgba(255,255,255,0.95)', '#f0b9d2', 3);
      g.save();
      g.translate(CM.W / 2, card.y + card.h / 2 + 6);
      this.drawPicture(g, r.pic);
      g.restore();
      // picture caption (read it aloud!)
      D.text(g, this.captionFor(r.pic), CM.W / 2, card.y + card.h - 14, {
        size: 16, color: '#9a8a94', weight: 700
      });

      // word tiles with the blank
      this.drawWordTiles(g, r, 300);

      // answer buttons
      for (let i = 0; i < this.buttons.length; i++) this.drawAnswer(g, i);

      // feedback banner
      if (this.answered) {
        const color = this.outcome === 'right' ? P.mintDeep : P.pinkDeep;
        const el = this.feedT;
        const sc = Math.min(1, el * 5);
        D.text(g, this.msg, CM.W / 2, 372, {
          size: 22 + 8 * sc, color: color, weight: 800, stroke: '#fff', strokeWidth: 7
        });
      } else {
        const hint = CM.touchMode ? 'Tap the missing letter!' : 'Tap a letter — or press 1, 2, 3';
        D.text(g, hint, CM.W / 2, 372, { size: 17, color: '#9a8a94', weight: 700 });
      }
    },

    // draw the word as letter tiles, with the missing slot shown as a blank
    drawWordTiles(g, r, cy) {
      const tw = 64, gap = 16, n = r.word.length;
      const total = n * tw + (n - 1) * gap;
      const x0 = (CM.W - total) / 2;
      for (let i = 0; i < n; i++) {
        const x = x0 + i * (tw + gap);
        const isBlank = i === r.blank;
        const filled = isBlank && this.answered && this.outcome === 'right';
        if (isBlank && !filled) {
          // empty slot — dashed pink, gently pulsing
          const pulse = 0.5 + 0.5 * Math.sin(CM.time * 4);
          g.save();
          g.setLineDash([8, 7]);
          D.rr(g, x, cy - tw / 2, tw, tw, 14, 'rgba(255,221,236,0.7)',
            'rgba(240,98,146,' + (0.5 + pulse * 0.4) + ')', 4);
          g.restore();
          D.text(g, '?', x + tw / 2, cy, { size: 40, color: 'rgba(240,98,146,0.55)', weight: 800 });
        } else {
          // a solid letter tile (given letters, or the now-filled answer)
          const fill = filled ? P.mint : 'rgba(255,255,255,0.95)';
          const stroke = filled ? P.mintDeep : '#f0b9d2';
          D.rr(g, x, cy - tw / 2, tw, tw, 14, fill, stroke, 4);
          const ch = r.word[i].toUpperCase();
          D.text(g, ch, x + tw / 2, cy + 2, {
            size: 42, color: filled ? '#2f8a55' : P.ink, weight: 800
          });
        }
      }
    },

    drawAnswer(g, i) {
      const rc = this.btnRect(i);
      const b = this.buttons[i];
      let color = P.blue;
      let dx = 0, dy = 0, sc = 1;
      let dim = false;

      if (this.answered) {
        if (i === this.picked && this.outcome === 'wrong') {
          // wrong pick: shake + grey out
          color = '#c9b8c2';
          dim = true;
          dx = Math.sin(this.feedT * 40) * 6 * Math.max(0, 1 - this.feedT * 1.6);
        } else if (b.correct) {
          // correct answer always glows + gently bounces (teaches the right letter)
          color = P.mintDeep;
          sc = 1 + Math.sin(this.feedT * 6) * 0.06;
          dy = -Math.abs(Math.sin(this.feedT * 6)) * 5;
        } else {
          // other unpicked wrong options fade back
          color = '#c9b8c2';
          dim = true;
        }
      } else {
        // alternate cheerful colors before answering
        color = i % 2 === 0 ? P.blue : P.lavender;
      }

      g.save();
      g.globalAlpha = dim ? 0.55 : 1;
      const cx = rc.x + rc.w / 2, ccy = rc.y + rc.h / 2;
      g.translate(cx + dx, ccy + dy);
      g.scale(sc, sc);
      g.translate(-rc.w / 2, -rc.h / 2);

      // drop shadow + body
      D.rr(g, 0, 6, rc.w, rc.h, 20, 'rgba(90,40,70,0.18)');
      D.rr(g, 0, 0, rc.w, rc.h, 20, color, 'rgba(255,255,255,0.8)', 3);
      // glossy top highlight
      D.rr(g, 8, 7, rc.w - 16, rc.h * 0.36, 14, 'rgba(255,255,255,0.25)');
      // the letter — big and lowercase so it matches the word tiles
      const dark = this.answered && (b.correct ? false : true);
      D.text(g, b.letter, rc.w / 2, rc.h / 2 + 2, {
        size: 54, color: dim ? '#8a7a84' : '#fff', weight: 800,
        stroke: dark && !dim ? null : 'rgba(0,0,0,0.12)', strokeWidth: 3
      });
      // glowing ring on the correct answer
      if (this.answered && b.correct) {
        const gp = 0.5 + 0.5 * Math.sin(this.feedT * 6);
        D.rr(g, -4, -4, rc.w + 8, rc.h + 8, 22, null,
          'rgba(103,197,135,' + (0.4 + gp * 0.5) + ')', 5);
        D.star(g, rc.w - 6, 4, 12, P.yellowDeep, this.feedT * 4);
      }
      g.restore();

      // clickable (immediate-mode) — only while unanswered
      if (!this.answered) {
        const m = CM.input.mouse;
        if (m.clicked && m.x >= rc.x && m.x <= rc.x + rc.w && m.y >= rc.y && m.y <= rc.y + rc.h) {
          m.clicked = false;
          CM.audio.play('click');
          this.choose(i);
        }
      }
    },

    captionFor(pic) {
      const C = {
        cat: 'cat', dog: 'dog', sun: 'sun', hat: 'hat', bed: 'bed',
        pig: 'pig', cup: 'cup', bus: 'bus', fox: 'fox', net: 'net'
      };
      return C[pic] || '';
    },

    /* ---------------- pictures (drawn centered at 0,0) ---------------- */
    drawPicture(g, pic) {
      switch (pic) {
        case 'cat': this.picCat(g); break;
        case 'dog': this.picDog(g); break;
        case 'sun': this.picSun(g); break;
        case 'hat': this.picHat(g); break;
        case 'bed': this.picBed(g); break;
        case 'pig': this.picPig(g); break;
        case 'cup': this.picCup(g); break;
        case 'bus': this.picBus(g); break;
        case 'fox': this.picFox(g); break;
        case 'net': this.picNet(g); break;
      }
    },

    picCat(g) {
      // grey kitty head
      D.circle(g, 0, 2, 40, '#cdd3da', '#aab2bc', 3);
      g.fillStyle = '#cdd3da'; g.strokeStyle = '#aab2bc'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(-34, -22); g.lineTo(-40, -52); g.lineTo(-14, -34); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(34, -22); g.lineTo(40, -52); g.lineTo(14, -34); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#ffb7d5';
      g.beginPath(); g.moveTo(-31, -28); g.lineTo(-34, -45); g.lineTo(-20, -34); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(31, -28); g.lineTo(34, -45); g.lineTo(20, -34); g.closePath(); g.fill();
      D.circle(g, -14, -2, 4, '#4a3b46'); D.circle(g, 14, -2, 4, '#4a3b46');
      D.ellipse(g, 0, 10, 4, 3, '#ff9ec7');
      g.strokeStyle = '#4a3b46'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.arc(-6, 14, 5, 0, Math.PI); g.stroke();
      g.beginPath(); g.arc(6, 14, 5, 0, Math.PI); g.stroke();
      // whiskers
      for (let s = -1; s <= 1; s += 2) {
        g.beginPath(); g.moveTo(s * 16, 8); g.lineTo(s * 44, 4); g.stroke();
        g.beginPath(); g.moveTo(s * 16, 14); g.lineTo(s * 44, 16); g.stroke();
      }
    },

    picDog(g) {
      D.circle(g, 0, 0, 38, '#e8c39a', '#c89c6b', 3); // head
      D.ellipse(g, -38, -8, 13, 24, '#b5895c', '#9a7044', 2); // floppy ears
      D.ellipse(g, 38, -8, 13, 24, '#b5895c', '#9a7044', 2);
      D.ellipse(g, 0, 14, 20, 16, '#fff7ee', '#e0cdb2', 2); // muzzle
      D.circle(g, -13, -6, 4, '#4a3b46'); D.circle(g, 13, -6, 4, '#4a3b46');
      D.ellipse(g, 0, 8, 6, 4.5, '#4a3b46'); // nose
      g.strokeStyle = '#4a3b46'; g.lineWidth = 2.4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 12); g.lineTo(0, 18); g.stroke();
      g.beginPath(); g.arc(-7, 19, 6, 0, Math.PI); g.stroke();
      g.beginPath(); g.arc(7, 19, 6, 0, Math.PI); g.stroke();
      // little tongue
      D.rr(g, -4, 24, 8, 9, 4, '#ff9ec7');
    },

    picSun(g) {
      g.save();
      g.strokeStyle = '#f2b53c'; g.lineWidth = 6; g.lineCap = 'round';
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + CM.time * 0.4;
        g.beginPath();
        g.moveTo(Math.cos(a) * 38, Math.sin(a) * 38);
        g.lineTo(Math.cos(a) * 52, Math.sin(a) * 52);
        g.stroke();
      }
      g.restore();
      D.circle(g, 0, 0, 36, '#ffe07a', '#f2b53c', 3);
      D.circle(g, -12, -4, 4.5, '#4a3b46'); D.circle(g, 12, -4, 4.5, '#4a3b46');
      g.strokeStyle = '#4a3b46'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.arc(0, 4, 12, 0.15 * Math.PI, 0.85 * Math.PI); g.stroke();
      g.fillStyle = 'rgba(255,150,170,0.55)';
      g.beginPath(); g.ellipse(-20, 6, 6, 4, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(20, 6, 6, 4, 0, 0, Math.PI * 2); g.fill();
    },

    picHat(g) {
      // a cute pink party/top hat
      D.ellipse(g, 0, 30, 52, 12, P.pink, P.pinkDeep, 3); // brim
      D.rr(g, -28, -34, 56, 60, 10, P.pink, P.pinkDeep, 3); // crown
      D.rr(g, -30, 14, 60, 12, 6, '#ffe07a', '#f2b53c', 2); // band
      D.star(g, 0, 20, 6, '#fff');
      // pom-pom
      D.circle(g, 0, -40, 9, '#fff', '#e0cdb2', 2);
    },

    picBed(g) {
      // headboard + mattress + blanket + pillow
      D.rr(g, -52, -22, 14, 50, 6, '#b98a5c', '#9a6f44', 2); // left post
      D.rr(g, 38, -22, 14, 50, 6, '#b98a5c', '#9a6f44', 2); // right post
      D.rr(g, -52, -34, 104, 22, 8, '#d9a86a', '#b5895c', 2); // headboard
      D.rr(g, -56, 4, 112, 26, 8, '#ff9ec7', '#e87fb2', 2); // blanket
      D.rr(g, -56, 0, 112, 10, 5, '#fff', '#e0cdb2', 2); // sheet fold
      D.rr(g, -46, -10, 34, 18, 8, '#fff3f8', '#f0b9d2', 2); // pillow
      // little hearts on the blanket
      D.heart(g, -10, 17, 11, '#fff');
      D.heart(g, 22, 17, 11, '#fff');
    },

    picPig(g) {
      D.circle(g, 0, 2, 38, '#ffb7d5', '#f08fb8', 3); // head
      // ears
      g.fillStyle = '#ffb7d5'; g.strokeStyle = '#f08fb8'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-30, -30); g.lineTo(-40, -50); g.lineTo(-16, -40); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(30, -30); g.lineTo(40, -50); g.lineTo(16, -40); g.closePath(); g.fill(); g.stroke();
      D.circle(g, -14, -6, 4.5, '#4a3b46'); D.circle(g, 14, -6, 4.5, '#4a3b46');
      D.ellipse(g, 0, 12, 16, 12, '#ff9ec7', '#e87fb2', 2); // snout
      D.circle(g, -6, 12, 3, '#c96a92'); D.circle(g, 6, 12, 3, '#c96a92'); // nostrils
      g.fillStyle = 'rgba(255,120,150,0.45)';
      g.beginPath(); g.ellipse(-24, 6, 6, 4, 0, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.ellipse(24, 6, 6, 4, 0, 0, Math.PI * 2); g.fill();
    },

    picCup(g) {
      // a cozy mug with steam
      D.rr(g, -28, -22, 50, 50, 10, '#8ecdf6', '#4a9fdc', 3); // body
      g.strokeStyle = '#4a9fdc'; g.lineWidth = 7;
      g.beginPath(); g.arc(26, 2, 16, -1.1, 1.1); g.stroke(); // handle
      D.rr(g, -32, -26, 58, 10, 5, '#a8d8f8', '#4a9fdc', 2); // rim
      // steam
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 4; g.lineCap = 'round';
      for (let s = -1; s <= 1; s++) {
        g.beginPath();
        const bx = s * 12;
        g.moveTo(bx, -34);
        g.quadraticCurveTo(bx + 7, -44, bx, -52);
        g.quadraticCurveTo(bx - 7, -60, bx, -68);
        g.stroke();
      }
      // little heart on the mug
      D.heart(g, -3, 4, 16, '#fff');
    },

    picBus(g) {
      D.rr(g, -56, -26, 112, 50, 12, '#ffe07a', '#f2b53c', 3); // body
      // windows
      for (let i = 0; i < 3; i++) {
        D.rr(g, -46 + i * 30, -18, 22, 18, 5, '#cdeaff', '#8ecdf6', 2);
      }
      // door
      D.rr(g, 36, -16, 14, 30, 4, '#8ecdf6', '#4a9fdc', 2);
      // stripe
      D.rr(g, -56, 6, 112, 8, 4, '#ef5b5b');
      // wheels
      D.circle(g, -32, 26, 12, '#4a3b46', '#2f2630', 2);
      D.circle(g, 34, 26, 12, '#4a3b46', '#2f2630', 2);
      D.circle(g, -32, 26, 5, '#aab2bc'); D.circle(g, 34, 26, 5, '#aab2bc');
      // headlight
      D.circle(g, 52, 0, 5, '#fff7c8', '#f2b53c', 2);
    },

    picFox(g) {
      D.circle(g, 0, 4, 36, '#f5a05a', '#dd8038', 3); // head
      // pointy ears
      g.fillStyle = '#f5a05a'; g.strokeStyle = '#dd8038'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(-30, -22); g.lineTo(-42, -56); g.lineTo(-10, -34); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(30, -22); g.lineTo(42, -56); g.lineTo(10, -34); g.closePath(); g.fill(); g.stroke();
      g.fillStyle = '#3a3a3a';
      g.beginPath(); g.moveTo(-28, -28); g.lineTo(-36, -48); g.lineTo(-16, -34); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(28, -28); g.lineTo(36, -48); g.lineTo(16, -34); g.closePath(); g.fill();
      // white muzzle
      g.fillStyle = '#fff7ee';
      g.beginPath(); g.moveTo(0, -6); g.lineTo(-22, 30); g.lineTo(22, 30); g.closePath(); g.fill();
      D.circle(g, -15, -2, 4, '#3a3a3a'); D.circle(g, 15, -2, 4, '#3a3a3a');
      D.ellipse(g, 0, 22, 5, 4, '#3a3a3a'); // nose
    },

    picNet(g) {
      // a butterfly net
      g.save();
      g.rotate(-0.35);
      // handle
      D.rr(g, -6, 0, 12, 56, 6, '#d9a86a', '#b5895c', 2);
      // hoop
      D.circle(g, 0, -22, 28, null, '#aab2bc', 5);
      // mesh
      g.strokeStyle = 'rgba(140,150,160,0.6)'; g.lineWidth = 1.5;
      for (let i = -2; i <= 2; i++) {
        g.beginPath(); g.moveTo(i * 10, -46); g.lineTo(i * 6, 2); g.stroke();
      }
      for (let j = 0; j < 4; j++) {
        const yy = -44 + j * 14;
        const half = Math.sqrt(Math.max(0, 28 * 28 - (yy + 22) * (yy + 22)));
        g.beginPath(); g.moveTo(-half, yy); g.lineTo(half, yy); g.stroke();
      }
      g.restore();
      // a little butterfly above to make the picture read clearly
      const fx = 30, fy = -34;
      D.ellipse(g, fx - 6, fy, 7, 9, '#ff9ec7', '#e87fb2', 1.5);
      D.ellipse(g, fx + 6, fy, 7, 9, '#8ecdf6', '#4a9fdc', 1.5);
      D.rr(g, fx - 1.5, fy - 8, 3, 16, 1.5, '#4a3b46');
    },

    /* ---------------- backdrop ---------------- */
    drawBackdrop(g) {
      // classroom wall
      const wg = g.createLinearGradient(0, 0, 0, 360);
      wg.addColorStop(0, '#e7f4ff');
      wg.addColorStop(1, '#f7e9ff');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, 360);
      // floor
      const fg = g.createLinearGradient(0, 340, 0, CM.H);
      fg.addColorStop(0, '#ffe2ef');
      fg.addColorStop(1, '#ffeef6');
      g.fillStyle = fg;
      g.fillRect(0, 340, CM.W, CM.H - 340);
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.fillRect(0, 338, CM.W, 5);

      // bunting along the very top
      const cols = [P.pink, P.mint, P.yellow, P.lavender, P.blue];
      for (let i = 0; i * 56 < CM.W; i++) {
        g.fillStyle = cols[i % cols.length];
        g.beginPath();
        g.moveTo(i * 56, 0);
        g.lineTo(i * 56 + 56, 0);
        g.lineTo(i * 56 + 28, 24);
        g.closePath();
        g.fill();
      }
      // floating ABC blocks + stars on the wall (decoration only)
      D.star(g, 70, 120, 9, 'rgba(255,255,255,0.8)');
      D.star(g, 150, 80, 6, 'rgba(255,255,255,0.7)');
      D.star(g, 900, 110, 9, 'rgba(255,255,255,0.8)');
      this.drawBlock(g, 64, 300, 'A', P.pink);
      this.drawBlock(g, 880, 300, 'C', P.mint);
      this.drawBlock(g, 904, 160, 'B', P.yellow);
    },

    drawBlock(g, x, y, letter, color) {
      const wob = Math.sin(CM.time * 1.4 + x) * 4;
      g.save();
      g.translate(x, y + wob);
      g.rotate(Math.sin(CM.time + x) * 0.08);
      D.rr(g, -22, -22, 44, 44, 8, color, 'rgba(255,255,255,0.8)', 3);
      D.text(g, letter, 0, 2, { size: 28, color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.12)', strokeWidth: 3 });
      g.restore();
    },

    /* ---------------- howto ---------------- */
    drawHowto(g) {
      g.fillStyle = 'rgba(70,40,70,0.3)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 210, 96, 540, 392, { title: '✏️ Spell It Out with Cinnamoroll' });
      CM.drawFriend(g, 'cinnamoroll', 300, 430, 1.3, { bob: ((CM.time * 1.2) % 1) * 0.5 });
      D.text(g, 'Look at the picture!', 560, 178, { size: 20, color: P.ink, weight: 800 });
      D.text(g, 'One letter is missing from', 560, 224, { size: 17, color: P.ink });
      D.text(g, 'the little word.', 560, 248, { size: 17, color: P.ink });
      D.text(g, 'Tap the letter that finishes it', 560, 292, { size: 17, color: P.ink });
      D.text(g, 'to spell the word!', 560, 316, { size: 17, color: P.pinkDeep, weight: 800 });
      D.text(g, this.rounds.length + ' words · You can do it!', 480, 360, { size: 14, color: '#9a8a94' });
      if (CM.ui.button(g, 380, 398, 200, 58, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.state = 'quiz';
      }
    },

    /* ---------------- done ---------------- */
    drawDone(g) {
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.text(g, 'Super speller!! 🌟', CM.W / 2, 240, {
        size: 50, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
      });
      D.text(g, 'You spelled ' + this.correctCount + ' of ' + this.rounds.length + ' words!',
        CM.W / 2, 296, { size: 24, color: P.ink, weight: 800, stroke: '#fff', strokeWidth: 6 });
      D.text(g, 'Score: ' + this.score, CM.W / 2, 340, {
        size: 28, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6
      });
      D.star(g, 300, 240 + Math.sin(CM.time * 5) * 6, 16, P.yellowDeep);
      D.star(g, 660, 240 + Math.cos(CM.time * 5) * 6, 16, P.yellowDeep);
    },

    /* ---------------- particles ---------------- */
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
