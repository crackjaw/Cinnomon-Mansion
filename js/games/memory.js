/* Cinnamoroll Mansion — Memory Match (My Melody's card room) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  const FLIP_T = 0.25;     // seconds for a full card flip
  const MISS_WAIT = 0.8;   // seconds two wrong cards stay up
  const MAX_PARTS = 90;    // particle cap

  const TABLE = { x: 285, y: 78, w: 650, h: 508 };
  const MELODY = { x: 142, y: 330 };
  const PLAYER = { x: 142, y: 545 };

  const MATCH_LINES = ['Yay! You found {f}!', 'Two {f}s! Hooray!', '{f}! Great memory!', 'Wow, {f}! Amazing!'];
  const MISS_LINES = ['So close!', 'Hmm… where was it?', "You'll find it!", 'Keep looking!'];

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  /* ---------- card art (drawn centered at origin) ---------- */
  function drawCardBack(g, w, h) {
    D.rr(g, -w / 2, -h / 2, w, h, 12, '#d8c9f2', '#b59ce0', 3);
    D.rr(g, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 9, null, 'rgba(255,255,255,0.55)', 2);
    D.star(g, 0, 0, Math.min(w, h) * 0.22, '#ffffff');
    const dx = w / 2 - 14, dy = h / 2 - 14;
    D.circle(g, -dx, -dy, 3, 'rgba(255,255,255,0.8)');
    D.circle(g, dx, -dy, 3, 'rgba(255,255,255,0.8)');
    D.circle(g, -dx, dy, 3, 'rgba(255,255,255,0.8)');
    D.circle(g, dx, dy, 3, 'rgba(255,255,255,0.8)');
  }

  function drawCardFace(g, c) {
    const w = c.w, h = c.h;
    const col = CM.FRIENDS[c.friend].color;
    D.rr(g, -w / 2, -h / 2, w, h, 12, '#fffdf6', '#f0b9d2', 3);
    D.rr(g, -w / 2 + 5, -h / 2 + 5, w - 10, h - 10, 9, null, col, 3);
    g.save();
    D.rrPath(g, -w / 2 + 7, -h / 2 + 7, w - 14, h - 14, 8);
    g.clip();
    CM.drawFriend(g, c.friend, 0, h / 2 - 14, c.fs, { shadow: false });
    g.restore();
  }

  function drawCard(g, c, hover, ap) {
    const cx = c.x + c.w / 2;
    const cy = c.y + c.h / 2 - (hover ? 3 : 0);
    let sx = 1;
    let face = c.mode !== 'down';
    if (c.anim) {
      const t = Math.min(1, c.anim.t);
      sx = Math.abs(1 - 2 * t);
      face = t < 0.5 ? c.mode !== 'down' : c.anim.toFace;
    }
    sx = Math.max(0.045, sx);
    // drop shadow
    if (ap >= 1) {
      g.fillStyle = 'rgba(180,90,130,0.16)';
      D.rrPath(g, cx - (c.w / 2) * sx, c.y + 6, c.w * sx, c.h, 12);
      g.fill();
    }
    const k = 0.55 + 0.45 * ap; // pop-in scale while dealing
    g.save();
    if (ap < 1) g.globalAlpha = ap;
    g.translate(cx, cy);
    g.scale(sx * k, (1 + (1 - sx) * 0.07) * k);
    if (face) drawCardFace(g, c);
    else drawCardBack(g, c.w, c.h);
    g.restore();
    if (c.mode === 'matched' && !c.anim) {
      D.rr(g, c.x, c.y, c.w, c.h, 12, 'rgba(160,120,150,0.20)'); // gentle dim
      D.heart(g, c.x + c.w - 14, c.y + 15, 8, P.pinkDeep);
      if (c.glowT > 0) {
        g.save();
        g.globalAlpha = CM.clamp(c.glowT * 1.4, 0, 1);
        D.rr(g, c.x - 4, c.y - 4, c.w + 8, c.h + 8, 16, null, '#ffd76a', 6);
        D.star(g, c.x + 14, c.y + 16, 7 + c.glowT * 4, '#fff1c4');
        g.restore();
      }
    }
    if (hover) D.rr(g, c.x, c.y - 3, c.w, c.h, 12, 'rgba(255,255,255,0.25)');
  }

  /* ---------- room ---------- */
  function drawRoom(g) {
    const grad = g.createLinearGradient(0, 0, 0, CM.H);
    grad.addColorStop(0, '#ffe9f3');
    grad.addColorStop(1, '#ffd2e5');
    g.fillStyle = grad;
    g.fillRect(0, 0, CM.W, CM.H);
    // soft wallpaper hearts
    g.save();
    g.globalAlpha = 0.12;
    for (let i = 0; i < 16; i++) {
      const hx = (i * 223 + 47) % CM.W;
      const hy = 30 + ((i * 131 + 80) % 540);
      D.heart(g, hx, hy, 10 + (i % 3) * 4, '#ff7eb3');
    }
    g.restore();
    // soft pink table
    D.rr(g, TABLE.x + 6, TABLE.y + 10, TABLE.w, TABLE.h, 26, 'rgba(170,90,130,0.18)');
    D.rr(g, TABLE.x, TABLE.y, TABLE.w, TABLE.h, 26, '#ffd9e8', '#f0a8c8', 4);
    D.rr(g, TABLE.x + 9, TABLE.y + 9, TABLE.w - 18, TABLE.h - 18, 18, null, 'rgba(255,255,255,0.6)', 2.5);
  }

  function drawHostSide(game, g) {
    const t = CM.time;
    D.ellipse(g, 142, 535, 105, 40, '#ffe4f0', '#f4bdd6', 3); // little rug
    const mHop = game.melodyHop > 0 ? Math.sin((1 - game.melodyHop / 0.45) * Math.PI) * 12 : 0;
    CM.drawFriend(g, 'mymelody', MELODY.x, MELODY.y - mHop, 1.18, { bob: ((t * 0.7) % 1) * 0.35 });
    D.rr(g, MELODY.x - 48, MELODY.y + 8, 96, 22, 10, 'rgba(255,255,255,0.85)');
    D.text(g, 'My Melody', MELODY.x, MELODY.y + 19, { size: 15, color: P.pinkDeep, weight: 800 });
    const pHop = game.playerHop > 0 ? Math.sin((1 - game.playerHop / 0.45) * Math.PI) * 12 : 0;
    CM.drawPlayer(g, PLAYER.x, PLAYER.y - pHop, 1, 'right', 0);
    if (game.msgT > 0 && game.msg) {
      const w = Math.max(150, Math.min(260, game.msg.length * 8.5 + 28));
      const bx = CM.clamp(MELODY.x - w / 2, 8, CM.W - w - 8);
      D.bubble(g, bx, 138, w, 46, MELODY.x);
      D.text(g, game.msg, bx + w / 2, 161, { size: 15, color: P.ink, weight: 800 });
    }
  }

  function chip(g, x, w, label, color) {
    D.rr(g, x, 12, w, 34, 17, 'rgba(255,255,255,0.88)', '#f0b9d2', 2);
    D.text(g, label, x + w / 2, 30, { size: 17, color: color || P.ink, weight: 800 });
  }

  /* ---------- particles ---------- */
  function spawn(game, type, x, y, n, color) {
    for (let i = 0; i < n; i++) {
      if (game.parts.length >= MAX_PARTS) return;
      if (type === 'heart') {
        game.parts.push({
          type: 'heart', x: x + CM.rand(-22, 22), y: y + CM.rand(-14, 6),
          vx: CM.rand(-20, 20), vy: CM.rand(-95, -55),
          life: CM.rand(0.7, 1.1), max: 1.1, s: CM.rand(6, 11),
          color: color || (Math.random() < 0.5 ? '#ff9ec7' : '#f06292'), rot: 0
        });
      } else {
        const a = Math.random() * Math.PI * 2;
        const sp = CM.rand(70, 200);
        game.parts.push({
          type: 'star', x: x, y: y,
          vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 50,
          life: CM.rand(0.5, 0.9), max: 0.9, s: CM.rand(5, 10),
          color: color || CM.pick(['#ffd76a', '#fff1c4', '#ff9ec7', '#bfe7ff']), rot: CM.rand(0, 6)
        });
      }
    }
  }

  function updateParts(game, dt) {
    let n = 0;
    for (let i = 0; i < game.parts.length; i++) {
      const p = game.parts[i];
      p.life -= dt;
      if (p.life <= 0) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.type === 'heart') p.x += Math.sin((p.max - p.life) * 7) * 20 * dt;
      else { p.vy += 240 * dt; p.rot += dt * 5; }
      game.parts[n++] = p;
    }
    game.parts.length = n;
  }

  function drawParts(game, g) {
    g.save();
    for (const p of game.parts) {
      g.globalAlpha = CM.clamp(p.life / (p.max * 0.6), 0, 1);
      if (p.type === 'heart') D.heart(g, p.x, p.y, p.s, p.color);
      else D.star(g, p.x, p.y, p.s, p.color, p.rot);
    }
    g.restore();
  }

  /* ---------- the game ---------- */
  CM.registerGame({
    id: 'memory',
    name: 'Memory Match',

    enter() {
      this.state = 'howto';       // howto → play → celebrate → interlude → play → done
      this.round = 1;
      this.score = 0;
      this.lastRoundScore = 0;
      this.finished = false;
      this.cards = [];
      this.parts = [];
      this.picked = [];
      this.phase = 'idle';        // idle | wait | miss
      this.phaseT = 0;
      this.pairs = 0;
      this.pairsTotal = 6;
      this.moves = 0;
      this.roundT = 0;
      this.shake = 0;
      this.msg = '';
      this.msgT = 0;
      this.melodyHop = 0;
      this.playerHop = 0;
      this.celebrateT = 0;
      this.interludeT = 0;
      this.doneT = 0;
    },

    exit() {},

    say(text, dur) {
      this.msg = text;
      this.msgT = dur || 2.2;
    },

    setupRound(r) {
      this.round = r;
      const pn = r === 1 ? 6 : 8;
      const rows = r === 1 ? 3 : 4;
      const cw = r === 1 ? 120 : 104;
      const ch = r === 1 ? 138 : 104;
      const gap = r === 1 ? 18 : 13;
      const fs = r === 1 ? 0.8 : 0.62;
      const ids = shuffle(Object.keys(CM.FRIENDS).slice()).slice(0, pn);
      const deck = shuffle(ids.concat(ids));
      const gw = 4 * cw + 3 * gap;
      const gh = rows * ch + (rows - 1) * gap;
      const x0 = TABLE.x + TABLE.w / 2 - gw / 2;
      const y0 = TABLE.y + TABLE.h / 2 - gh / 2;
      this.cards = deck.map((id, i) => ({
        friend: id,
        x: x0 + (i % 4) * (cw + gap),
        y: y0 + Math.floor(i / 4) * (ch + gap),
        w: cw, h: ch, fs: fs,
        mode: 'down', anim: null, glowT: 0,
        born: i * 0.045
      }));
      this.pairs = 0;
      this.pairsTotal = pn;
      this.moves = 0;
      this.roundT = 0;
      this.picked = [];
      this.phase = 'idle';
      this.phaseT = 0;
    },

    beginPlay() {
      this.setupRound(1);
      this.state = 'play';
      CM.audio.play('whoosh');
      this.say('Find the matching pairs!', 2.4);
    },

    flipCard(c, toFace) {
      c.anim = { t: 0, toFace: toFace };
    },

    cardAt(x, y) {
      for (const c of this.cards) {
        if (x >= c.x && x <= c.x + c.w && y >= c.y && y <= c.y + c.h) return c;
      }
      return null;
    },

    roundComplete() {
      const pen = 8 * Math.max(0, this.moves - this.pairsTotal);
      const rs = Math.max(30, 60 + 30 * this.pairsTotal - pen) + 30; // +30 all-pairs bonus
      this.lastRoundScore = rs;
      this.score += rs;
      this.shake = 0.5;
      this.melodyHop = 0.45;
      this.playerHop = 0.45;
      spawn(this, 'star', TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2, 16);
      spawn(this, 'heart', TABLE.x + TABLE.w / 2, TABLE.y + TABLE.h / 2 - 40, 8);
      if (this.round === 1) {
        CM.audio.play('cheer');
        this.state = 'celebrate';
        this.celebrateT = 1.0;
        this.say('You found them ALL!', 2.4);
      } else {
        CM.audio.play('tada');
        this.state = 'done';
        this.doneT = 1.6;
        this.say('You matched everyone!!', 2.4);
      }
    },

    update(dt) {
      // shared timers
      this.msgT = Math.max(0, this.msgT - dt);
      this.shake = Math.max(0, this.shake - dt * 1.6);
      this.melodyHop = Math.max(0, this.melodyHop - dt);
      this.playerHop = Math.max(0, this.playerHop - dt);
      for (const c of this.cards) {
        if (c.anim) {
          c.anim.t += dt / FLIP_T;
          if (c.anim.t >= 1) {
            c.mode = c.anim.toFace ? 'up' : 'down';
            c.anim = null;
          }
        }
        if (c.glowT > 0) c.glowT -= dt;
      }
      updateParts(this, dt);
      const m = CM.input.mouse;

      if (this.state === 'howto') {
        if (CM.input.pressed('action')) this.beginPlay();
        return;
      }

      if (this.state === 'play') {
        this.roundT += dt;
        if (this.phase === 'wait') {
          const a = this.picked[0], b = this.picked[1];
          if (a && b && !a.anim && !b.anim) {
            if (a.friend === b.friend) {
              a.mode = 'matched'; b.mode = 'matched';
              a.glowT = 0.8; b.glowT = 0.8;
              this.pairs++;
              CM.audio.play('ding');
              spawn(this, 'heart', a.x + a.w / 2, a.y + a.h / 2, 5);
              spawn(this, 'heart', b.x + b.w / 2, b.y + b.h / 2, 5);
              this.say(CM.pick(MATCH_LINES).replace(/\{f\}/g, CM.FRIENDS[a.friend].name), 2.4);
              this.melodyHop = 0.45;
              this.playerHop = 0.45;
              this.picked.length = 0;
              this.phase = 'idle';
              if (this.pairs === this.pairsTotal) this.roundComplete();
            } else {
              this.phase = 'miss';
              this.phaseT = MISS_WAIT;
              CM.audio.tone(320, 0.18, 'sine', 0.04, 0, 230); // very soft "aww"
              if (Math.random() < 0.6) this.say(CM.pick(MISS_LINES), 1.4);
            }
          }
        } else if (this.phase === 'miss') {
          this.phaseT -= dt;
          if (this.phaseT <= 0) {
            for (const c of this.picked) this.flipCard(c, false);
            this.picked.length = 0;
            this.phase = 'idle';
          }
        }
        // clicks (blocked while two cards are resolving)
        if (m.clicked && this.phase === 'idle' && this.picked.length < 2) {
          const c = this.cardAt(m.x, m.y);
          if (c && c.mode === 'down' && !c.anim && this.roundT > c.born + 0.2) {
            this.flipCard(c, true);
            CM.audio.play('pop');
            this.picked.push(c);
            if (this.picked.length === 2) {
              this.moves++;
              this.phase = 'wait';
            }
          }
        }
        return;
      }

      if (this.state === 'celebrate') {
        this.celebrateT -= dt;
        if (this.celebrateT <= 0) {
          this.state = 'interlude';
          this.interludeT = 1.5;
        }
        return;
      }

      if (this.state === 'interlude') {
        this.interludeT -= dt;
        const tapped = m.clicked || CM.input.pressed('action');
        if (tapped) m.clicked = false;
        if (this.interludeT <= 0 || tapped) {
          this.setupRound(2);
          this.state = 'play';
          CM.audio.play('whoosh');
          this.say('Even more friends now!', 2.2);
        }
        return;
      }

      if (this.state === 'done') {
        this.doneT -= dt;
        if (Math.random() < dt * 6) {
          spawn(this, 'star', CM.rand(TABLE.x + 60, TABLE.x + TABLE.w - 60), CM.rand(140, 480), 2);
        }
        if (this.doneT <= 0 && !this.finished) {
          this.finished = true;
          CM.finishGame('memory', this.score, Math.ceil(this.score / 25));
        }
        return;
      }
    },

    draw(g) {
      g.save();
      if (this.shake > 0) {
        const amp = this.shake * 9;
        g.translate(CM.rand(-amp, amp), CM.rand(-amp, amp));
      }
      drawRoom(g);

      if (this.state === 'howto') {
        // decorative face-down cards on the table
        for (let i = 0; i < 3; i++) {
          g.save();
          g.translate(450 + i * 115, 330);
          g.rotate((i - 1) * 0.18);
          drawCardBack(g, 110, 128);
          g.restore();
        }
      } else {
        const m = CM.input.mouse;
        const canHover = this.state === 'play' && this.phase === 'idle' && this.picked.length < 2;
        let hovered = canHover ? this.cardAt(m.x, m.y) : null;
        if (hovered && (hovered.mode !== 'down' || hovered.anim)) hovered = null;
        for (const c of this.cards) {
          const ap = CM.clamp((this.roundT - c.born) / 0.22, 0, 1);
          if (ap <= 0) continue;
          drawCard(g, c, c === hovered, ap);
        }
        drawParts(this, g);
        drawHostSide(this, g);
      }
      g.restore(); // end screen-shake — context is back to identity

      if (this.state !== 'howto') {
        chip(g, 14, 118, 'Round ' + this.round + '/2', P.pinkDeep);
        chip(g, 142, 128, 'Pairs ' + this.pairs + '/' + this.pairsTotal, P.blueDeep);
        chip(g, 280, 118, 'Moves ' + this.moves, '#8a6f7f');
        chip(g, 408, 128, 'Score ' + this.score, '#c98a1f');
      }

      if (this.state === 'howto') this.drawHowto(g);
      else if (this.state === 'interlude') this.drawInterlude(g);
      else if (this.state === 'done') {
        D.rr(g, 230, 244, 500, 104, 24, 'rgba(255,255,255,0.93)', '#f0b9d2', 4);
        D.text(g, '🌟 You matched them ALL! 🌟', 480, 282, { size: 27, color: P.pinkDeep, weight: 800 });
        D.text(g, 'Score: ' + this.score, 480, 320, { size: 22, color: P.blueDeep, weight: 800 });
      }
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(90,50,80,0.30)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 230, 92, 500, 416, { title: '🎴 Memory Match 🎴' });
      // sample pair: a card back and a card face
      g.save();
      g.translate(415, 205);
      g.rotate(-0.08);
      drawCardBack(g, 80, 96);
      g.restore();
      g.save();
      g.translate(545, 205);
      g.rotate(0.08);
      drawCardFace(g, { w: 80, h: 96, friend: 'keroppi', fs: 0.56 });
      g.restore();
      D.heart(g, 480, 205, 12 + Math.sin(CM.time * 4) * 2, P.pinkDeep);
      const lines = [
        'Tap a card to flip it over!',
        'Find two cards with the same friend.',
        'Fewer moves = more points. Two rounds!'
      ];
      for (let i = 0; i < lines.length; i++) {
        D.text(g, lines[i], 480, 292 + i * 31, { size: 18, color: P.ink });
      }
      if (CM.ui.button(g, 380, 398, 200, 56, '▶ Start!', { color: P.mintDeep, size: 22, sfx: 'pop' })) {
        this.beginPlay();
        return;
      }
      D.text(g, CM.touchMode ? 'tap Start to play!' : 'or press SPACE', 480, 482, { size: 14, color: '#a08a98' });
      CM.drawFriend(g, 'mymelody', 150, 480, 1.25, { bob: ((CM.time * 0.8) % 1) * 0.4 });
      D.bubble(g, 40, 300, 190, 44, 150);
      D.text(g, "Let's match cards!", 135, 322, { size: 15, weight: 800 });
    },

    drawInterlude(g) {
      g.fillStyle = 'rgba(90,50,80,0.32)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 270, 190, 420, 204);
      D.text(g, 'Round 2', 480, 240, { size: 36, color: P.pinkDeep, weight: 800 });
      D.text(g, 'Even MORE friends!', 480, 282, { size: 22, color: P.ink });
      D.text(g, 'Round 1 score: ' + this.lastRoundScore, 480, 318, { size: 19, color: P.blueDeep, weight: 800 });
      if (Math.sin(CM.time * 5) > -0.3) {
        D.text(g, 'tap to continue', 480, 356, { size: 14, color: '#a08a98' });
      }
    }
  });
})();
