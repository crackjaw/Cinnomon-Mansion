/* Cinnamoroll Mansion — Hopscotch (hosted by Hello Kitty) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------------- court geometry ----------------
     Classic 1..8 hopscotch layout running UP the screen:
       8       (single, top)
      6 7      (side-by-side pair)
       5       (single)
      3 4      (pair)
       2       (single)
       1       (single, bottom — start)
     Each square is a chalk box; squares store their CENTER (cx, cy).
     The player hops 1→8, turns, then hops 8→1 for one full COURSE. */
  const SQ = 78;          // square size (px) — nice big tap targets
  const GAP = 6;          // gap between paired squares
  const CX = 470;         // court center x
  const BOT = 528;        // y of bottom row (square 1)
  const ROW_H = 70;       // vertical spacing between rows

  // layout rows from bottom (square 1) to top (square 8)
  // each entry: { nums:[...], row } where nums has 1 (single) or 2 (pair) squares
  const ROWS = [
    { nums: [1] },        // row 0 (bottom)
    { nums: [2] },
    { nums: [3, 4] },
    { nums: [5] },
    { nums: [6, 7] },
    { nums: [8] }         // row 5 (top)
  ];

  const SQUARE_COLORS = ['#ffd9e8', '#bdeccd', '#cfe6ff', '#ffe9a8', '#e3d4f7', '#ffd9e8', '#bdeccd', '#cfe6ff'];

  const GAME_TIME = 60;
  const TICK_FROM = 8;      // soft tick in the last N seconds
  const PT_SQUARE = 10;     // points per square hopped
  const COURSE_BONUS = 100; // base bonus per completed course (grows a little)
  const MAX_PARTS = 110;

  const KITTY = { x: 118, y: 470 };  // Hello Kitty cheering on the left

  // fluffy clouds (fixed drift positions)
  const CLOUDS = [
    { x: 200, y: 70, s: 1.1, sp: 7 },
    { x: 620, y: 50, s: 0.85, sp: 11 },
    { x: 840, y: 96, s: 1.0, sp: 5 }
  ];

  function anyPress() {
    return CM.input.pressed('action') || CM.input.pressed('up');
  }

  CM.registerGame({
    id: 'hopscotch',
    name: 'Hopscotch',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';        // howto → countin → play → done
      this.score = 0;
      this.squaresHopped = 0;
      this.courses = 0;
      this.timeLeft = GAME_TIME;
      this.tickAcc = 0;

      this.buildSquares();
      // progress: idx into the 1..8..1 path. path positions 0..14 (15 stops)
      // 0..7 = squares 1..8 going up; 8..14 = squares 7..1 coming back down
      this.buildPath();
      this.pos = 0;                // current path index
      this.dir = 1;               // 1 = going up, -1 = coming back

      // player physics — sits ON the current square; hops to next on tap
      const start = this.squareAt(this.path[0]);
      this.px = start.cx;
      this.py = start.cy;
      this.hop = null;            // active hop animation or null
      this.facing = 'up';
      this.idleT = 0;

      this.parts = [];
      this.floats = [];
      this.shk = { t: 0, dur: 1, mag: 0 };
      this.wobbleT = 0;           // gentle wobble on wrong tap
      this.glowPulse = 0;

      this.kittyCheerT = 0;
      this.kittyMsg = '';
      this.kittyHopT = 0;
      this.bigMsg = '';
      this.bigT = 0;

      this.goT = 0;
      this.countT = 0;
      this.finished = false;
    },

    exit() { /* nothing to clean up — all timing is driven by update(dt) */ },

    /* ================= setup ================= */
    buildSquares() {
      // squares keyed by number 1..8 with center coords
      this.squares = {};
      for (let r = 0; r < ROWS.length; r++) {
        const row = ROWS[r];
        const cy = BOT - r * ROW_H;
        if (row.nums.length === 1) {
          this.squares[row.nums[0]] = { n: row.nums[0], cx: CX, cy: cy };
        } else {
          const offset = (SQ + GAP) / 2;
          this.squares[row.nums[0]] = { n: row.nums[0], cx: CX - offset, cy: cy };
          this.squares[row.nums[1]] = { n: row.nums[1], cx: CX + offset, cy: cy };
        }
      }
    },

    buildPath() {
      // up: 1,2,3,4,5,6,7,8 ; back: 7,6,5,4,3,2,1
      this.path = [1, 2, 3, 4, 5, 6, 7, 8, 7, 6, 5, 4, 3, 2, 1];
    },

    squareAt(n) { return this.squares[n]; },

    nextIndex() {
      return this.pos + 1 < this.path.length ? this.pos + 1 : -1;
    },

    /* ================= state transitions ================= */
    begin() {
      this.state = 'countin';
      this.countT = 0;
      CM.audio.play('whoosh');
    },

    startPlay() {
      this.state = 'play';
      this.timeLeft = GAME_TIME;
    },

    /* ================= update ================= */
    update(dt) {
      if (this.shk.t > 0) this.shk.t -= dt;
      this.wobbleT = Math.max(0, this.wobbleT - dt);
      this.kittyCheerT = Math.max(0, this.kittyCheerT - dt);
      this.kittyHopT = Math.max(0, this.kittyHopT - dt);
      this.bigT = Math.max(0, this.bigT - dt);
      this.glowPulse = (this.glowPulse + dt * 3.4) % (Math.PI * 2);
      this.idleT += dt;
      this.updateParts(dt);
      this.updateHop(dt);

      switch (this.state) {
        case 'howto':
          if (anyPress()) this.begin();
          break;

        case 'countin':
          this.countT += dt;
          if (this.countT >= 3.0) this.startPlay();
          break;

        case 'play':
          this.timeLeft -= dt;
          // soft ticking in the final seconds
          if (this.timeLeft <= TICK_FROM && this.timeLeft > 0) {
            this.tickAcc += dt;
            if (this.tickAcc >= 1) {
              this.tickAcc -= 1;
              CM.audio.tone(660, 0.06, 'sine', 0.07);
            }
          }
          this.handleInput();
          if (this.timeLeft <= 0) {
            this.timeLeft = 0;
            this.state = 'done';
            this.goT = 0;
            CM.audio.play('tada');
            this.celebrate(26);
            this.doShake(0.3, 5);
          }
          break;

        case 'done':
          this.goT += dt;
          if (this.goT > 1.8 && !this.finished) {
            this.finished = true;
            CM.finishGame('hopscotch', this.score, CM.clamp(Math.ceil(this.score / 15), 5, 30));
          }
          break;
      }
    },

    handleInput() {
      // a hop in progress ignores new input (but it's quick, so it stays snappy)
      if (this.hop) return;
      const ni = this.nextIndex();
      if (ni < 0) return; // shouldn't happen — a course always wraps

      const m = CM.input.mouse;
      let advance = false;
      let tappedWrong = false;

      // keyboard: action / up always advances
      if (anyPress()) advance = true;

      // tap / click: must hit a square
      if (m.clicked) {
        const hit = this.squareUnder(m.x, m.y);
        if (hit === this.path[ni]) {
          m.clicked = false;
          advance = true;
        } else if (hit !== null) {
          m.clicked = false;
          tappedWrong = true;
        }
      }

      if (advance) this.startHop(ni);
      else if (tappedWrong) this.gentleWobble();
    },

    squareUnder(mx, my) {
      for (const k in this.squares) {
        const s = this.squares[k];
        if (mx >= s.cx - SQ / 2 && mx <= s.cx + SQ / 2 &&
            my >= s.cy - SQ / 2 && my <= s.cy + SQ / 2) {
          return s.n;
        }
      }
      return null;
    },

    /* ================= hopping ================= */
    startHop(toIndex) {
      const from = this.squareAt(this.path[this.pos]);
      const to = this.squareAt(this.path[toIndex]);
      this.hop = {
        t: 0, dur: 0.32,
        x0: from.cx, y0: from.cy,
        x1: to.cx, y1: to.cy,
        target: toIndex
      };
      this.facing = 'up';
      CM.audio.play('pop');
      CM.audio.tone(520, 0.08, 'triangle', 0.08, 0, 720);
    },

    updateHop(dt) {
      if (!this.hop) return;
      const h = this.hop;
      h.t += dt;
      const k = CM.clamp(h.t / h.dur, 0, 1);
      // ease in-out horizontal, parabolic arc vertical
      const ease = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
      this.px = CM.lerp(h.x0, h.x1, ease);
      const arc = Math.sin(k * Math.PI) * 46;
      this.py = CM.lerp(h.y0, h.y1, ease) - arc;
      if (k >= 1) {
        this.px = h.x1;
        this.py = h.y1;
        this.pos = h.target;
        this.hop = null;
        this.landHop();
      }
    },

    landHop() {
      // if the timer expired mid-hop, the landing finishes visually but doesn't score
      if (this.state !== 'play') return;
      this.squaresHopped++;
      this.score += PT_SQUARE;
      // a couple of dust puffs + a sparkle where we land
      const s = this.squareAt(this.path[this.pos]);
      this.dust(s.cx, s.cy + 18, 4);
      this.spawnPart({
        x: s.cx, y: s.cy - 6, vx: CM.rand(-30, 30), vy: CM.rand(-120, -60),
        life: CM.rand(0.4, 0.7), type: 'star',
        color: CM.pick([P.yellow, P.pink, P.mint, '#fff']),
        size: CM.rand(6, 10), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
      });
      CM.audio.tone(720, 0.07, 'sine', 0.07);

      // turn-around moment at the top (square 8)
      if (this.path[this.pos] === 8 && this.pos === 7) {
        this.kittyCheer('Keep going!');
        this.addFloat(s.cx, s.cy - 40, 'Turn!', P.lavenderDeep, 22);
      }

      // course complete? (back to the very first stop, having gone all the way)
      if (this.pos === this.path.length - 1) {
        this.completeCourse();
      }
    },

    completeCourse() {
      this.courses++;
      const bonus = COURSE_BONUS + (this.courses - 1) * 30; // 100, 130, 160...
      const award = Math.min(bonus, 400);                   // cap so it stays in spec range
      this.score += award;
      this.bigMsg = 'COURSE ' + this.courses + '!';
      this.bigT = 1.6;
      this.kittyCheer(CM.pick(['Great hopping!', 'Wow, all 8!', 'You did it!', 'Amazing!']));
      CM.audio.play('cheer');
      this.doShake(0.32, 6);
      this.celebrate(30);
      this.addFloat(CX, BOT - ROW_H * 2.5, '+' + award, P.pinkDeep, 28);

      // reset to the start of a fresh course
      this.pos = 0;
      const start = this.squareAt(this.path[0]);
      this.px = start.cx;
      this.py = start.cy;
      this.hop = null;
    },

    gentleWobble() {
      // forgiving: no progress lost, just a tiny wobble + soft sound
      this.wobbleT = 0.4;
      CM.audio.play('boing');
      this.addFloat(this.px, this.py - 50, 'Oops!', P.blueDeep, 18);
    },

    /* ================= host reactions ================= */
    kittyCheer(msg) {
      this.kittyMsg = msg;
      this.kittyCheerT = 1.6;
      this.kittyHopT = 0.6;
    },

    /* ================= juice ================= */
    doShake(t, mag) { this.shk = { t: t, dur: t, mag: mag }; },

    spawnPart(pt) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      pt.maxLife = pt.life;
      this.parts.push(pt);
    },

    dust(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: x + CM.rand(-10, 10), y: y,
          vx: CM.rand(-70, 70), vy: CM.rand(-50, -10),
          life: CM.rand(0.3, 0.55), type: 'spark',
          color: 'rgba(255,255,255,0.85)',
          size: CM.rand(2.5, 4.5), rot: 0, vr: 0
        });
      }
    },

    celebrate(n) {
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: CM.rand(260, 700), y: CM.rand(120, 280),
          vx: CM.rand(-100, 100), vy: CM.rand(-200, -50),
          life: CM.rand(0.7, 1.3),
          type: CM.pick(['star', 'heart', 'confetti']),
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
          size: CM.rand(7, 13), rot: CM.rand(0, 6), vr: CM.rand(-5, 5)
        });
      }
    },

    addFloat(x, y, text, color, size) {
      if (this.floats.length >= 16) this.floats.shift();
      this.floats.push({ x: x, y: y, text: text, color: color, size: size, t: 0, life: 0.9 });
    },

    updateParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const pt = this.parts[i];
        pt.life -= dt;
        if (pt.life <= 0) { this.parts.splice(i, 1); continue; }
        pt.vy += 260 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.rot += pt.vr * dt;
      }
      for (let i = this.floats.length - 1; i >= 0; i--) {
        const f = this.floats[i];
        f.t += dt;
        f.y -= 42 * dt;
        if (f.t >= f.life) this.floats.splice(i, 1);
      }
    },

    /* ================= draw ================= */
    draw(g) {
      g.save();
      if (this.shk.t > 0) {
        const m = this.shk.mag * (this.shk.t / this.shk.dur);
        g.translate(CM.rand(-m, m), CM.rand(-m, m));
      }

      this.drawBackyard(g);
      this.drawCourt(g);
      this.drawCharacters(g);
      this.drawParts(g);

      g.restore(); // end shake

      /* ---- HUD (not shaken) ---- */
      this.drawHud(g);

      // floating texts (above HUD-ish but world-anchored — fine unshaken)
      for (const f of this.floats) {
        g.globalAlpha = Math.max(0, 1 - f.t / f.life);
        D.text(g, f.text, f.x, f.y, {
          size: f.size, color: f.color, weight: 800,
          stroke: '#fff', strokeWidth: 5
        });
      }
      g.globalAlpha = 1;

      // big course banner
      if (this.bigT > 0 && this.bigMsg) {
        const k = 1 - this.bigT / 1.6;
        const sc = Math.min(1, (1.6 - this.bigT) * 4);
        g.globalAlpha = this.bigT > 0.3 ? 1 : this.bigT / 0.3;
        D.text(g, this.bigMsg, CM.W / 2, 232, {
          size: 30 + 30 * sc, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 9
        });
        D.star(g, CM.W / 2 - 150, 232, 18, P.yellowDeep, CM.time * 2.5);
        D.star(g, CM.W / 2 + 150, 232, 18, P.yellowDeep, -CM.time * 2.5);
        g.globalAlpha = 1;
      }

      if (this.state === 'countin') this.drawCountin(g);
      if (this.state === 'howto') this.drawHowto(g);
      if (this.state === 'done') {
        g.fillStyle = 'rgba(255,255,255,0.32)';
        g.fillRect(0, 0, CM.W, CM.H);
        D.text(g, 'Great hopping!!', CM.W / 2, 250, { size: 50, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10 });
        D.text(g, this.courses + (this.courses === 1 ? ' course' : ' courses') + ' · ' + this.squaresHopped + ' hops',
          CM.W / 2, 308, { size: 24, color: P.blueDeep, weight: 800 });
        D.text(g, 'Score: ' + this.score, CM.W / 2, 348, { size: 26, color: '#c98a1f', weight: 800 });
      }
    },

    /* ----- backyard scene ----- */
    drawBackyard(g) {
      // sky band
      const sky = g.createLinearGradient(0, 0, 0, 230);
      sky.addColorStop(0, '#cdecff');
      sky.addColorStop(1, '#e9f7ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, CM.W, 230);

      // sun with soft glow
      const sx = 858, sy = 78;
      g.fillStyle = 'rgba(255,236,170,0.45)';
      g.beginPath(); g.arc(sx, sy, 56, 0, Math.PI * 2); g.fill();
      D.circle(g, sx, sy, 34, '#ffe9a8', '#ffd86b', 3);

      // clouds (gentle drift)
      for (const c of CLOUDS) {
        const cx = (c.x + CM.time * c.sp) % (CM.W + 160) - 80;
        this.drawCloud(g, cx, c.y, c.s);
      }

      // grass
      const grass = g.createLinearGradient(0, 210, 0, CM.H);
      grass.addColorStop(0, '#bfe9a6');
      grass.addColorStop(1, '#a6dd8c');
      g.fillStyle = grass;
      g.fillRect(0, 210, CM.W, CM.H - 210);
      // rolling hill line highlight
      g.fillStyle = 'rgba(255,255,255,0.18)';
      g.beginPath();
      g.moveTo(0, 214);
      g.quadraticCurveTo(CM.W / 2, 200, CM.W, 214);
      g.lineTo(CM.W, 230);
      g.lineTo(0, 230);
      g.closePath();
      g.fill();

      // wooden fence across the grass-sky boundary
      this.drawFence(g, 196);

      // little flower tufts scattered on the grass
      const spots = [[70, 320], [40, 470], [150, 560], [820, 300], [900, 430], [780, 545], [600, 560]];
      for (let i = 0; i < spots.length; i++) {
        this.drawFlower(g, spots[i][0], spots[i][1], i);
      }

      // a couple of grass blade tufts
      g.strokeStyle = '#7fc468';
      g.lineWidth = 3;
      g.lineCap = 'round';
      for (let i = 0; i < 9; i++) {
        const gx = 30 + (i * 211) % 920;
        const gy = 250 + (i * 97) % 320;
        g.beginPath();
        g.moveTo(gx, gy);
        g.quadraticCurveTo(gx - 4, gy - 12, gx - 8, gy - 16);
        g.moveTo(gx, gy);
        g.quadraticCurveTo(gx + 4, gy - 12, gx + 8, gy - 16);
        g.moveTo(gx, gy);
        g.lineTo(gx, gy - 18);
        g.stroke();
      }
    },

    drawCloud(g, x, y, s) {
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath();
      g.ellipse(x, y, 34 * s, 22 * s, 0, 0, Math.PI * 2);
      g.ellipse(x + 28 * s, y + 4 * s, 26 * s, 18 * s, 0, 0, Math.PI * 2);
      g.ellipse(x - 28 * s, y + 5 * s, 24 * s, 16 * s, 0, 0, Math.PI * 2);
      g.ellipse(x + 4 * s, y - 12 * s, 22 * s, 17 * s, 0, 0, Math.PI * 2);
      g.fill();
    },

    drawFence(g, y) {
      const railH = 9;
      // back rail
      g.fillStyle = '#e8c39a';
      g.fillRect(0, y, CM.W, railH);
      g.fillRect(0, y + 26, CM.W, railH);
      g.fillStyle = 'rgba(138,90,59,0.25)';
      g.fillRect(0, y + railH - 2, CM.W, 2);
      g.fillRect(0, y + 26 + railH - 2, CM.W, 2);
      // pickets
      for (let i = 0; i * 64 < CM.W + 64; i++) {
        const px = i * 64 + 8;
        g.fillStyle = '#f0d0a8';
        g.beginPath();
        g.moveTo(px, y - 18);
        g.lineTo(px + 26, y - 18);
        g.lineTo(px + 26, y + 40);
        g.lineTo(px, y + 40);
        g.closePath();
        g.fill();
        // pointed top
        g.beginPath();
        g.moveTo(px, y - 18);
        g.lineTo(px + 13, y - 30);
        g.lineTo(px + 26, y - 18);
        g.closePath();
        g.fill();
        g.strokeStyle = 'rgba(138,90,59,0.22)';
        g.lineWidth = 1.5;
        g.beginPath();
        g.moveTo(px + 13, y - 28);
        g.lineTo(px + 13, y + 38);
        g.stroke();
      }
    },

    drawFlower(g, x, y, seed) {
      const cols = [P.pink, P.yellow, P.lavender, P.white, P.pinkSoft];
      const col = cols[seed % cols.length];
      // stem
      g.strokeStyle = '#7fc468';
      g.lineWidth = 3;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x, y - 16);
      g.stroke();
      // petals
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        D.circle(g, x + Math.cos(a) * 6, y - 18 + Math.sin(a) * 6, 4.5, col);
      }
      D.circle(g, x, y - 18, 3.5, P.yellowDeep);
    },

    /* ----- the chalk hopscotch court ----- */
    drawCourt(g) {
      const ni = this.nextIndex();
      const nextNum = ni >= 0 ? this.path[ni] : -1;
      const glow = (Math.sin(this.glowPulse) + 1) / 2; // 0..1

      // soft chalk-court ground patch under the squares
      D.rr(g, CX - 110, BOT - ROW_H * 5 - 60, 220, ROW_H * 5 + 120, 28, 'rgba(255,255,255,0.16)');

      for (let n = 1; n <= 8; n++) {
        const s = this.squares[n];
        const isNext = n === nextNum;
        const isCurrent = !this.hop && this.path[this.pos] === n;
        const wob = (isCurrent && this.wobbleT > 0)
          ? Math.sin(this.wobbleT * 40) * 4 * (this.wobbleT / 0.4) : 0;

        g.save();
        g.translate(s.cx + wob, s.cy);

        // square body
        const baseCol = SQUARE_COLORS[n - 1];
        let fill = baseCol;
        if (isNext) {
          // glowing pulse for the next square
          const lift = 2 + glow * 4;
          g.save();
          g.shadowColor = 'rgba(242,181,60,0.9)';
          g.shadowBlur = 18 + glow * 16;
          D.rr(g, -SQ / 2, -SQ / 2 - lift * 0, SQ, SQ, 12, '#fff7df');
          g.restore();
        }
        D.rr(g, -SQ / 2, -SQ / 2, SQ, SQ, 12,
          isNext ? '#fff3cf' : fill,
          isNext ? P.yellowDeep : 'rgba(255,255,255,0.9)',
          isNext ? 4 : 4);
        // inner chalk outline
        D.rr(g, -SQ / 2 + 5, -SQ / 2 + 5, SQ - 10, SQ - 10, 9, null, 'rgba(255,255,255,0.7)', 2);

        // the number
        D.text(g, String(n), 0, 2, {
          size: 34, weight: 800,
          color: isNext ? P.pinkDeep : 'rgba(74,59,70,0.55)',
          stroke: '#fff', strokeWidth: 4
        });

        // a pulsing ring + arrow hint on the next square
        if (isNext) {
          const r = SQ / 2 + 4 + glow * 5;
          D.rr(g, -r, -r, r * 2, r * 2, 16, null,
            'rgba(242,181,60,' + (0.4 + glow * 0.5).toFixed(2) + ')', 3);
          // bouncing down-arrow pointing at it
          const ay = -SQ / 2 - 22 - glow * 6;
          g.fillStyle = P.pinkDeep;
          g.beginPath();
          g.moveTo(0, ay + 14);
          g.lineTo(-11, ay);
          g.lineTo(11, ay);
          g.closePath();
          g.fill();
          D.rr(g, -4, ay - 12, 8, 14, 3, P.pinkDeep);
        }

        g.restore();
      }
    },

    /* ----- player + Hello Kitty ----- */
    drawCharacters(g) {
      // Hello Kitty cheering on the left of the court
      const excited = this.kittyHopT > 0;
      CM.drawFriend(g, 'hellokitty', KITTY.x, KITTY.y, 1.15, {
        bob: excited ? (CM.time * 3.0) % 1 : ((CM.time * 1.0) % 1) * 0.4
      });
      if (this.kittyCheerT > 0 && this.kittyMsg) {
        const w = Math.max(130, this.kittyMsg.length * 11 + 30);
        D.bubble(g, KITTY.x - 18, KITTY.y - 168, w, 40, KITTY.x + 8);
        D.text(g, this.kittyMsg, KITTY.x - 18 + w / 2, KITTY.y - 148, { size: 16, color: P.pinkDeep, weight: 800 });
      }

      // the player hopping the court (only during/after play)
      if (this.state === 'play' || this.state === 'done' || this.state === 'countin') {
        // feet anchor: square center is the standing spot; offset feet slightly below center
        const feetY = this.py + 26;
        CM.drawPlayer(g, this.px, feetY, 0.92, 'up', 0);
        // little motion sparkle trail while hopping
        if (this.hop && Math.random() < 0.6) {
          this.spawnPart({
            x: this.px + CM.rand(-8, 8), y: this.py + 20,
            vx: CM.rand(-20, 20), vy: CM.rand(-10, 20),
            life: 0.3, type: 'spark', color: 'rgba(255,255,255,0.7)',
            size: CM.rand(2, 3.5), rot: 0, vr: 0
          });
        }
      }
    },

    drawParts(g) {
      for (const pt of this.parts) {
        g.globalAlpha = CM.clamp(pt.life / pt.maxLife, 0, 1);
        if (pt.type === 'star') D.star(g, pt.x, pt.y, pt.size, pt.color, pt.rot);
        else if (pt.type === 'heart') D.heart(g, pt.x, pt.y, pt.size, pt.color);
        else if (pt.type === 'confetti') {
          g.save();
          g.translate(pt.x, pt.y);
          g.rotate(pt.rot);
          g.fillStyle = pt.color;
          g.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size * 0.6);
          g.restore();
        } else D.circle(g, pt.x, pt.y, pt.size, pt.color);
      }
      g.globalAlpha = 1;
    },

    /* ----- HUD ----- */
    drawHud(g) {
      // big friendly countdown top-center
      const tl = Math.ceil(this.timeLeft);
      const low = this.timeLeft <= TICK_FROM;
      const beat = low ? 1 + Math.abs(Math.sin(CM.time * 6)) * 0.12 : 1;
      D.rr(g, CM.W / 2 - 78, 12, 156, 52, 26, 'rgba(255,255,255,0.92)', low ? P.pinkDeep : '#f0b9d2', 3);
      g.save();
      g.translate(CM.W / 2, 38);
      g.scale(beat, beat);
      D.text(g, '⏱ ' + tl, 0, 0, { size: 26, color: low ? P.pinkDeep : P.blueDeep, weight: 800 });
      g.restore();

      // score (top-left)
      D.rr(g, 14, 12, 168, 64, 16, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      D.coin(g, 36, 34, 12);
      D.text(g, String(this.score), 110, 34, { size: 22, color: '#c98a1f', weight: 800 });
      D.text(g, 'Hops ' + this.squaresHopped + ' · Courses ' + this.courses, 98, 60,
        { size: 14, color: P.ink, weight: 700 });

      // hint bar during play
      if (this.state === 'play') {
        const ni = this.nextIndex();
        const nextNum = ni >= 0 ? this.path[ni] : -1;
        const hint = CM.touchMode
          ? 'Tap the glowing square ' + nextNum + '!'
          : 'Tap square ' + nextNum + ' (or press SPACE / ↑)';
        D.rr(g, CM.W / 2 - 200, CM.H - 34, 400, 26, 13, 'rgba(255,255,255,0.8)');
        D.text(g, hint, CM.W / 2, CM.H - 21, { size: 15, color: P.pinkDeep, weight: 800 });
      }
    },

    drawCountin(g) {
      g.fillStyle = 'rgba(80,60,90,0.22)';
      g.fillRect(0, 0, CM.W, CM.H);
      const k = Math.min(3, Math.floor(this.countT));
      const frac = this.countT % 1;
      const labels = ['3', '2', '1'];
      if (this.countT < 3) {
        D.text(g, labels[k], CM.W / 2, 280, {
          size: 96 * (1.25 - frac * 0.25), color: '#fff', weight: 800,
          stroke: P.pinkDeep, strokeWidth: 10
        });
      } else {
        D.text(g, 'Hop!', CM.W / 2, 280, { size: 80, color: P.pink, weight: 800, stroke: '#fff', strokeWidth: 10 });
      }
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(70,55,80,0.34)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 218, 96, 524, 392, { title: '🐾 Hopscotch with Hello Kitty' });
      CM.drawFriend(g, 'hellokitty', 308, 432, 1.3, { bob: ((CM.time * 1.2) % 1) * 0.5 });
      D.bubble(g, 236, 150, 150, 38, 308);
      D.text(g, "Let's hop together!", 311, 169, { size: 14, color: P.pinkDeep, weight: 800 });

      D.text(g, '1. Tap the GLOWING square', 562, 196, { size: 18, color: P.ink, weight: 800 });
      D.text(g, '(or press SPACE / ↑) to hop!', 562, 222, { size: 16, color: P.ink, weight: 700 });
      D.text(g, '2. Hop all the way up to 8…', 562, 264, { size: 18, color: P.ink, weight: 800 });
      D.text(g, 'then back down for a COURSE!', 562, 290, { size: 16, color: P.pinkDeep, weight: 800 });
      D.text(g, '3. Hop lots before time runs out!', 562, 332, { size: 16, color: P.ink, weight: 700 });
      D.text(g, '60 seconds · wrong taps are okay!', CM.W / 2, 374, { size: 14, color: '#9a8a94' });

      if (CM.ui.button(g, 380, 404, 200, 56, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.begin();
        return;
      }
      if (!CM.touchMode) {
        D.text(g, 'or press SPACE', CM.W / 2, 478, { size: 14, color: '#b9a8b3' });
      }
    }
  });
})();
