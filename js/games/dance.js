/* Cinnamoroll Mansion — Dance Party (hosted by Kuromi) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------------- rhythm constants ---------------- */
  const BPM = 104;
  const BEAT = 60 / BPM;
  const LEAD = 3;            // seconds of lead-in before beat 0 ("3, 2, 1, Dance!")
  const SPEED = 260;         // note fall speed, px/s
  const LANE_LEFT = 290;     // left edge of lane 0
  const LANE_W = 95;         // >= 90px wide tap zones
  const REC_Y = 470;         // receptor row
  const WIN_PERFECT = 0.10;
  const WIN_GOOD = 0.22;

  const ANG = [Math.PI, Math.PI / 2, -Math.PI / 2, 0]; // ← ↓ ↑ →
  const LANE_FILL = ['#ff9ec7', '#8ecdf6', '#ffe9a8', '#bdeccd'];
  const LANE_DEEP = ['#f06292', '#4a9fdc', '#f2b53c', '#67c587'];
  const LANE_RGBA = ['rgba(255,158,199,', 'rgba(142,205,246,', 'rgba(255,233,168,', 'rgba(189,236,205,'];
  const MELODY = [523.25, 587.33, 659.25, 783.99, 880, 783.99, 659.25, 587.33];

  const KX = 160, KY = 538;   // Kuromi feet
  const PX = 790, PY = 538;   // player feet
  const MX = 902, MY = 552;   // My Melody feet

  /* ---------------- handwritten chart: [beat, lane] ----------------
     ~124 beats at 104 BPM ≈ 72s of song + 3s lead-in.
     Starts 1 note / 2 beats, slowly gets denser; chords only near the end. */
  const RAW = [
    // intro — one note every 2 beats, single notes
    [0, 0], [2, 1], [4, 2], [6, 3], [8, 0], [10, 2], [12, 1], [14, 3],
    [16, 0], [18, 3], [20, 1], [22, 2], [24, 0], [26, 1], [28, 3], [30, 2],
    // warming up — mostly 2-beat gaps, a few 1-beat gaps
    [33, 0], [35, 3], [37, 1], [39, 2], [41, 0], [43, 3], [44, 1], [46, 2],
    [48, 0], [50, 3], [51, 2], [53, 1], [55, 0], [57, 3], [59, 2], [61, 1],
    // groove — denser, still single notes
    [64, 0], [65, 3], [67, 1], [68, 2], [70, 0], [72, 3], [73, 1], [75, 2],
    [76, 0], [78, 3], [79, 2], [81, 1], [83, 0], [84, 3], [86, 2], [88, 1],
    [90, 0], [92, 3], [94, 2],
    // finale — a few 2-note chords sprinkled in
    [96, 1], [97, 2], [99, 0], [100, 3], [102, 1],
    [104, 0], [105, 3],                       // chord (staggered for single-pointer touch)
    [106, 2], [108, 1],
    [110, 0], [111, 3],                       // chord (staggered for single-pointer touch)
    [112, 2], [114, 1], [116, 0], [117, 3], [119, 2], [121, 1],
    [122, 0], [123, 3]                        // final chord (staggered for single-pointer touch)
  ];

  // twinkly back-wall sparkles (fixed positions)
  const WALL_SPARK = [];
  for (let i = 0; i < 22; i++) {
    WALL_SPARK.push({ x: 25 + ((i * 247) % 910), y: 18 + ((i * 167) % 400), s: 1.5 + (i % 3), ph: i * 0.83 });
  }

  function beatTime(b) { return LEAD + b * BEAT; }
  function laneX(i) { return LANE_LEFT + i * LANE_W + LANE_W / 2; }

  function arrowGlyph(g, x, y, dir, size, color, lw) {
    g.save();
    g.translate(x, y);
    g.rotate(ANG[dir]);
    g.strokeStyle = color;
    g.lineWidth = lw;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(-size * 0.42, 0);
    g.lineTo(size * 0.36, 0);
    g.moveTo(size * 0.02, -size * 0.36);
    g.lineTo(size * 0.42, 0);
    g.lineTo(size * 0.02, size * 0.36);
    g.stroke();
    g.restore();
  }

  function drawBeams(g, t, pulse) {
    for (let i = 0; i < 4; i++) {
      const ang = Math.PI / 2 + Math.sin(t * (0.45 + i * 0.13) + i * 1.7) * 0.72;
      const ox = 480, oy = 78, len = 640, w = 72;
      const ex = ox + Math.cos(ang) * len;
      const ey = oy + Math.sin(ang) * len;
      const px = Math.cos(ang + Math.PI / 2);
      const py = Math.sin(ang + Math.PI / 2);
      g.fillStyle = LANE_RGBA[i] + (0.09 + pulse * 0.07) + ')';
      g.beginPath();
      g.moveTo(ox, oy);
      g.lineTo(ex + px * w, ey + py * w);
      g.lineTo(ex - px * w, ey - py * w);
      g.closePath();
      g.fill();
    }
  }

  function drawGlitterBall(g, t, pulse) {
    const cx = 480, cy = 66, r = 34;
    g.strokeStyle = '#8f7fb8';
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(cx, 0); g.lineTo(cx, cy - r); g.stroke();
    const grad = g.createRadialGradient(cx - 10, cy - 12, 4, cx, cy, r + 6);
    grad.addColorStop(0, '#ffffff');
    grad.addColorStop(0.5, '#d4c9ec');
    grad.addColorStop(1, '#8f7fb8');
    D.circle(g, cx, cy, r + pulse * 1.5, grad);
    g.save();
    g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
    const off = (t * 26) % 16;
    for (let row = -2; row <= 2; row++) {
      for (let k = -3; k <= 3; k++) {
        const ci = (((k + row + Math.floor(t * 2)) % 4) + 4) % 4;
        const tw = 0.22 + 0.3 * Math.abs(Math.sin(t * 3 + k * 1.3 + row * 0.9));
        g.fillStyle = LANE_RGBA[ci] + tw + ')';
        g.fillRect(cx + k * 16 - off, cy + row * 14 - 6, 13, 12);
      }
    }
    g.strokeStyle = 'rgba(255,255,255,0.35)';
    g.lineWidth = 1;
    for (let row = -2; row <= 2; row++) {
      g.beginPath(); g.moveTo(cx - r, cy + row * 14 - 7); g.lineTo(cx + r, cy + row * 14 - 7); g.stroke();
    }
    for (let k = -3; k <= 3; k++) {
      g.beginPath(); g.moveTo(cx + k * 16 - off, cy - r); g.lineTo(cx + k * 16 - off, cy + r); g.stroke();
    }
    g.restore();
    D.circle(g, cx, cy, r, null, 'rgba(255,255,255,0.5)', 2);
    for (let i = 0; i < 5; i++) {
      const a = t * 0.8 + i * 1.26;
      const tw = (Math.sin(t * 4 + i * 2.1) + 1) / 2;
      D.star(g, cx + Math.cos(a) * (r + 16), cy + Math.sin(a) * (r + 11),
        2.5 + tw * 4, 'rgba(255,255,255,' + (0.25 + tw * 0.6).toFixed(2) + ')');
    }
  }

  function drawFloor(g, beatNum, pulse) {
    g.fillStyle = '#1c1430';
    g.fillRect(0, 500, CM.W, 100);
    const bn = Math.max(0, beatNum);
    for (let r = 0; r < 2; r++) {
      for (let c = 0; c < 8; c++) {
        const ci = (c + r * 3 + bn) % 4;
        const lit = (c + r + bn) % 2 === 0;
        const a = lit ? 0.28 + 0.38 * pulse : 0.13;
        D.rr(g, c * 120 + 3, 503 + r * 49, 114, 44, 8, LANE_RGBA[ci] + a.toFixed(3) + ')');
      }
    }
  }

  CM.registerGame({
    id: 'dance',
    name: 'Dance Party',

    /* ---------------- lifecycle ---------------- */
    enter() {
      this.state = 'howto';        // howto → countin → play → done
      this.songTime = 0;
      this.score = 0;
      this.combo = 0;
      this.bestCombo = 0;
      this.counts = { perfect: 0, good: 0, miss: 0 };
      this.notes = RAW.map((n, i) => ({
        beat: n[0], lane: n[1], time: beatTime(n[0]),
        hit: false, missed: false, mel: MELODY[i % MELODY.length]
      }));
      this.lastBeat = RAW[RAW.length - 1][0];
      this.endTime = beatTime(this.lastBeat);
      this.noteFrom = 0;           // first possibly-unresolved note (chart is time-sorted)
      this.schedBeat = -4;         // audio lookahead cursor (negative beats = count-in ticks)
      this.parts = [];             // particles (capped)
      this.floats = [];            // floating judgement texts (capped)
      this.pressFx = [0, 0, 0, 0];
      this.ringFx = [0, 0, 0, 0];
      this.spinT = 0;              // Kuromi spin timer
      this.comboFlashT = 0;
      this.comboFlashVal = 0;
      this.shakeT = 0;
      this.giggleT = 0;            // Kuromi "hee hee" on miss
      this.cheerT = 0;             // My Melody cheer bubble
      this.prevBeat = -99;
      this.poseT = 0;
      this.rainAcc = 0;
      this.ended = false;
      CM.audio.music('off');       // we schedule our own beat below
    },

    begin() {
      this.state = 'countin';
      this.songTime = 0;
      this.schedBeat = -4;
      CM.audio.play('whoosh');
    },

    /* ---------------- update ---------------- */
    update(dt) {
      for (let i = 0; i < 4; i++) {
        this.pressFx[i] = Math.max(0, this.pressFx[i] - dt);
        this.ringFx[i] = Math.max(0, this.ringFx[i] - dt);
      }
      this.spinT = Math.max(0, this.spinT - dt);
      this.comboFlashT = Math.max(0, this.comboFlashT - dt);
      this.shakeT = Math.max(0, this.shakeT - dt);
      this.giggleT = Math.max(0, this.giggleT - dt);
      this.cheerT = Math.max(0, this.cheerT - dt);
      this.updateFx(dt);

      if (this.state === 'howto') {
        if (CM.input.pressed('action')) this.begin();
        return;
      }

      this.songTime += dt;
      this.schedule();

      if (this.state === 'countin' && this.songTime >= LEAD) this.state = 'play';

      if (this.state === 'countin' || this.state === 'play') {
        this.handleInput();
        this.checkMisses();
        // occasional floating music notes off the dancers
        const bn = Math.floor((this.songTime - LEAD) / BEAT);
        if (bn !== this.prevBeat && bn >= 0 && bn % 4 === 0) {
          this.addFloat(KX + 30, KY - 110, '♪', '#d8c9f2', 22);
          this.addFloat(PX - 30, PY - 105, '♪', '#ffd9e8', 22);
        }
        this.prevBeat = bn;
        if (this.songTime > this.endTime + 1.0) {
          this.state = 'done';
          this.poseT = 0;
          this.shakeT = 0.35;
          CM.audio.play('tada');
          this.burst(KX, KY - 60, 0, 12, true);
          this.burst(PX, PY - 60, 2, 12, true);
        }
      } else if (this.state === 'done') {
        this.poseT += dt;
        this.rainAcc += dt;
        while (this.rainAcc > 0.1) {
          this.rainAcc -= 0.1;
          if (this.parts.length < 150) {
            this.parts.push({
              x: CM.rand(40, 920), y: -16, vx: CM.rand(-25, 25), vy: CM.rand(60, 130),
              t: 0, life: 1.4, kind: 'heart',
              color: CM.pick(LANE_FILL), size: CM.rand(7, 13), rot: CM.rand(0, 7)
            });
          }
        }
        if (this.poseT > 2.7 && !this.ended) {
          this.ended = true;
          CM.finishGame('dance', this.score, Math.ceil(this.score / 25));
        }
      }
    },

    /* lookahead scheduler — soft kick every beat, count-in ticks before beat 0 */
    schedule() {
      const horizon = this.songTime + 0.15;
      while (this.schedBeat <= this.lastBeat && beatTime(this.schedBeat) < horizon) {
        const when = Math.max(0, beatTime(this.schedBeat) - this.songTime);
        if (this.schedBeat < 0) {
          // 4-count: "3, 2, 1, Dance!"
          if (this.schedBeat === -1) {
            CM.audio.tone(880, 0.16, 'triangle', 0.12, when);
            CM.audio.tone(1108.7, 0.2, 'triangle', 0.1, when + 0.05);
          } else {
            CM.audio.tone(660, 0.09, 'square', 0.07, when);
          }
        } else {
          CM.audio.tone(100, 0.1, 'sine', 0.17, when, 48);     // soft kick
          if (this.schedBeat % 2 === 1) CM.audio.noise(0.035, 0.02, when); // tiny hat
        }
        this.schedBeat++;
      }
    },

    handleInput() {
      const inp = CM.input;
      if (inp.pressed('left')) this.tryHit(0);
      if (inp.pressed('down')) this.tryHit(1);
      if (inp.pressed('up')) this.tryHit(2);
      if (inp.pressed('right')) this.tryHit(3);
      const m = inp.mouse;
      if (m.clicked && m.y > 395 && m.y < 580 && m.x > LANE_LEFT && m.x < LANE_LEFT + 4 * LANE_W) {
        m.clicked = false;
        this.tryHit(CM.clamp(Math.floor((m.x - LANE_LEFT) / LANE_W), 0, 3));
      }
    },

    tryHit(lane) {
      this.pressFx[lane] = 0.18;
      let best = null;
      let bestAbs = WIN_GOOD + 1e-9;
      for (let i = this.noteFrom; i < this.notes.length; i++) {
        const n = this.notes[i];
        if (n.time - this.songTime > WIN_GOOD) break;
        if (n.hit || n.missed || n.lane !== lane) continue;
        const d = Math.abs(n.time - this.songTime);
        if (d < bestAbs) { bestAbs = d; best = n; }
      }
      if (!best) return;             // no penalty for stray presses
      best.hit = true;
      const perfect = bestAbs <= WIN_PERFECT;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const mult = 1 + Math.min(5, Math.floor(this.combo / 10)) * 0.1; // +10%/10 combo, cap +50%
      this.score += Math.round((perfect ? 8 : 4) * mult);
      this.counts[perfect ? 'perfect' : 'good']++;
      CM.audio.tone(best.mel, 0.16, 'triangle', 0.12);   // melody note on hit
      CM.audio.play(perfect ? 'ding' : 'pop');
      this.ringFx[lane] = perfect ? 0.3 : 0.2;
      this.burst(laneX(lane), REC_Y, lane, perfect ? 12 : 7, perfect);
      this.addFloat(laneX(lane), REC_Y - 54, perfect ? 'PERFECT!!' : 'GOOD!',
        perfect ? '#ffe9a8' : '#bdeccd', perfect ? 22 : 19);
      if (this.combo % 10 === 0) {
        this.comboFlashT = 1.1;
        this.comboFlashVal = this.combo;
        this.spinT = 0.6;            // Kuromi spins!
        this.shakeT = 0.22;
        this.cheerT = 1.5;
        CM.audio.play('cheer');
      }
    },

    checkMisses() {
      for (let i = this.noteFrom; i < this.notes.length; i++) {
        const n = this.notes[i];
        if (n.time - this.songTime > WIN_GOOD) break;
        if (!n.hit && !n.missed && this.songTime - n.time > WIN_GOOD) {
          n.missed = true;
          this.combo = 0;
          this.counts.miss++;
          this.giggleT = 1.3;
          this.addFloat(laneX(n.lane), REC_Y - 54, '✕', 'rgba(216,201,242,0.95)', 18);
          CM.audio.tone(150, 0.16, 'sine', 0.06, 0, 80);   // soft thud
          CM.audio.noise(0.05, 0.025);
          CM.audio.tone(740, 0.06, 'triangle', 0.04, 0.05); // tiny giggle
          CM.audio.tone(880, 0.06, 'triangle', 0.04, 0.13);
        }
      }
      // advance past fully-resolved leading notes
      while (this.noteFrom < this.notes.length) {
        const n = this.notes[this.noteFrom];
        if ((n.hit || n.missed) && this.songTime - n.time > 0.6) this.noteFrom++;
        else break;
      }
    },

    /* ---------------- effects ---------------- */
    burst(x, y, lane, count, perfect) {
      for (let k = 0; k < count; k++) {
        if (this.parts.length >= 150) return;
        const a = Math.random() * Math.PI * 2;
        const sp = CM.rand(60, perfect ? 240 : 170);
        this.parts.push({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          t: 0, life: CM.rand(0.4, 0.8),
          kind: k % 3 === 0 ? 'heart' : (k % 3 === 1 ? 'star' : 'spark'),
          color: k % 2 ? LANE_FILL[lane] : (perfect ? '#ffffff' : LANE_DEEP[lane]),
          size: CM.rand(5, perfect ? 12 : 9), rot: CM.rand(0, 7)
        });
      }
    },

    addFloat(x, y, text, color, size) {
      if (this.floats.length >= 24) this.floats.shift();
      this.floats.push({ x: x, y: y, text: text, color: color, size: size, t: 0, life: 0.7 });
    },

    updateFx(dt) {
      const ps = this.parts;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.t += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 230 * dt;
        p.rot += dt * 4;
        if (p.t >= p.life) { ps[i] = ps[ps.length - 1]; ps.pop(); }
      }
      const fs = this.floats;
      for (let i = fs.length - 1; i >= 0; i--) {
        const f = fs[i];
        f.t += dt;
        f.y -= 45 * dt;
        if (f.t >= f.life) { fs[i] = fs[fs.length - 1]; fs.pop(); }
      }
    },

    /* ---------------- draw ---------------- */
    draw(g) {
      const t = CM.time;
      const st = this.songTime;
      const playing = this.state !== 'howto';
      const songBeat = (st - LEAD) / BEAT;
      const beatNum = playing ? Math.floor(songBeat) : Math.floor(t / BEAT);
      const beatFrac = playing ? ((songBeat % 1) + 1) % 1 : (t / BEAT) % 1;
      const pulse = 1 - beatFrac;

      // ===== world (with screen-shake) =====
      g.save();
      if (this.shakeT > 0) {
        const a = this.shakeT * 7;
        g.translate(Math.sin(t * 73) * a, Math.cos(t * 67) * a);
      }

      // dark lavender hall
      const grad = g.createLinearGradient(0, 0, 0, CM.H);
      grad.addColorStop(0, '#4a3868');
      grad.addColorStop(0.7, '#332650');
      grad.addColorStop(1, '#241a38');
      g.fillStyle = grad;
      g.fillRect(-12, -12, CM.W + 24, CM.H + 24);

      // wall sparkles
      for (const s of WALL_SPARK) {
        const tw = (Math.sin(t * 2.2 + s.ph) + 1) / 2;
        g.fillStyle = 'rgba(255,255,255,' + (0.06 + tw * 0.16).toFixed(2) + ')';
        g.beginPath();
        g.arc(s.x, s.y, s.s * (0.7 + tw * 0.5), 0, Math.PI * 2);
        g.fill();
      }

      drawBeams(g, t, pulse);
      drawGlitterBall(g, t, pulse);
      drawFloor(g, beatNum, pulse);

      // lane highway
      D.rr(g, LANE_LEFT - 12, -20, LANE_W * 4 + 24, 545, 18, 'rgba(20,12,36,0.55)', 'rgba(255,255,255,0.10)', 2);
      for (let i = 1; i < 4; i++) {
        g.strokeStyle = 'rgba(255,255,255,0.07)';
        g.lineWidth = 2;
        g.beginPath();
        g.moveTo(LANE_LEFT + i * LANE_W, 0);
        g.lineTo(LANE_LEFT + i * LANE_W, 520);
        g.stroke();
      }
      // receptor guide line
      g.strokeStyle = 'rgba(255,255,255,0.10)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(LANE_LEFT - 4, REC_Y);
      g.lineTo(LANE_LEFT + 4 * LANE_W + 4, REC_Y);
      g.stroke();

      // receptors
      for (let i = 0; i < 4; i++) {
        const x = laneX(i);
        const press = this.pressFx[i] / 0.18;
        if (press > 0) {
          g.fillStyle = LANE_RGBA[i] + (0.10 * press).toFixed(3) + ')';
          g.fillRect(LANE_LEFT + i * LANE_W + 2, 0, LANE_W - 4, REC_Y);
        }
        D.circle(g, x, REC_Y, 32 + press * 4,
          'rgba(255,255,255,' + (0.05 + press * 0.2).toFixed(2) + ')', LANE_FILL[i], 4);
        arrowGlyph(g, x, REC_Y, i, 27, LANE_FILL[i], 6);
        if (this.ringFx[i] > 0) {
          const k = 1 - this.ringFx[i] / 0.3;
          D.circle(g, x, REC_Y, 32 + k * 32, null, 'rgba(255,255,255,' + (0.7 * (1 - k)).toFixed(2) + ')', 5);
        }
        if (CM.touchMode && playing) {
          D.rr(g, LANE_LEFT + i * LANE_W + 4, 412, LANE_W - 8, 142, 14, null, 'rgba(255,255,255,0.08)', 2);
        }
      }

      // falling heart notes
      if (playing) {
        for (let i = this.noteFrom; i < this.notes.length; i++) {
          const n = this.notes[i];
          const dtN = n.time - st;
          if (dtN > 2.2) break;
          if (n.hit) continue;
          const x = laneX(n.lane);
          const y = REC_Y - dtN * SPEED;
          if (y < -40 || y > REC_Y + 90) continue;
          let alpha = 1;
          if (n.missed) alpha = Math.max(0, 0.5 - (st - n.time - WIN_GOOD) * 1.4);
          if (alpha <= 0) continue;
          g.globalAlpha = alpha;
          const near = Math.abs(dtN) < WIN_PERFECT ? (1 - Math.abs(dtN) / WIN_PERFECT) : 0;
          D.heart(g, x, y - 2, 27 + near * 4, LANE_DEEP[n.lane]);
          D.heart(g, x, y - 3, 22 + near * 4, LANE_FILL[n.lane]);
          arrowGlyph(g, x, y + 1, n.lane, 12, 'rgba(255,255,255,0.95)', 3.5);
          g.globalAlpha = 1;
        }
      }

      // ===== dancers =====
      const bobPh = beatFrac * 0.5;            // one bounce per beat
      const doneJump = this.state === 'done' ? -Math.abs(Math.sin(this.poseT * 5)) * 14 : 0;
      const flip8 = ((Math.floor((playing ? songBeat : t / BEAT) / 8) % 2) + 2) % 2 === 1;

      // Kuromi (host) — spins on combo milestones
      const kScale = 1.18 + pulse * 0.07;
      if (this.spinT > 0) {
        const a = (1 - this.spinT / 0.6) * Math.PI * 2;
        D.shadow(g, KX, KY, 30);
        g.save();
        g.translate(KX, KY - 50 + doneJump);
        g.rotate(a);
        CM.drawFriend(g, 'kuromi', 0, 50, kScale, { bob: bobPh, shadow: false });
        g.restore();
      } else {
        CM.drawFriend(g, 'kuromi', KX, KY + doneJump, kScale, { bob: bobPh, flip: flip8 });
      }
      if (this.giggleT > 0) {
        D.bubble(g, 96, 396, 132, 36, KX);
        D.text(g, 'hee hee~', 162, 414, { size: 15, color: P.lavenderDeep, weight: 800 });
      }

      // player's own character
      const face4 = ((Math.floor((playing ? songBeat : t / BEAT) / 4) % 2) + 2) % 2 === 0 ? 'left' : 'right';
      CM.drawPlayer(g, PX, PY + doneJump, 1.15 + pulse * 0.06, face4, Math.max(0.02, beatFrac));

      // My Melody watching from the side
      CM.drawFriend(g, 'mymelody', MX, MY, 0.85, { bob: ((t * 0.9) % 1) * 0.4, flip: true });
      if (this.cheerT > 0) {
        D.bubble(g, 808, 412, 116, 36, MX - 10);
        D.text(g, 'Go go!!', 866, 430, { size: 15, color: P.pinkDeep, weight: 800 });
      }

      // particles
      for (const p of this.parts) {
        const a = 1 - p.t / p.life;
        g.globalAlpha = Math.max(0, a);
        if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, p.color);
        else if (p.kind === 'star') D.star(g, p.x, p.y, p.size * 0.7, p.color, p.rot);
        else D.circle(g, p.x, p.y, p.size * 0.35, p.color);
      }
      g.globalAlpha = 1;

      // floating judgement texts
      for (const f of this.floats) {
        g.globalAlpha = Math.max(0, 1 - f.t / f.life);
        D.text(g, f.text, f.x, f.y, {
          size: f.size, color: f.color, weight: 800,
          stroke: 'rgba(40,20,60,0.7)', strokeWidth: 5
        });
      }
      g.globalAlpha = 1;

      g.restore(); // ===== end shaken world =====

      // ===== HUD =====
      if (playing) {
        D.rr(g, 14, 12, 152, 40, 20, 'rgba(255,255,255,0.9)', '#cdb9e8', 2);
        D.star(g, 36, 32, 11, P.yellowDeep);
        D.text(g, String(this.score), 100, 33, { size: 21, color: P.lavenderDeep, weight: 800 });
        if (this.combo >= 2) {
          const hot = this.combo >= 10;
          D.rr(g, 14, 58, 152, 32, 16, hot ? 'rgba(255,233,168,0.92)' : 'rgba(255,255,255,0.75)', '#cdb9e8', 2);
          D.text(g, 'Combo x' + this.combo, 90, 75, { size: 17, color: hot ? '#c98a1f' : P.ink, weight: 800 });
        }
        // song progress
        const prog = CM.clamp(st / (this.endTime + 1), 0, 1);
        D.rr(g, 250, 14, 460, 10, 5, 'rgba(255,255,255,0.18)');
        if (prog > 0.01) D.rr(g, 250, 14, 460 * prog, 10, 5, P.pink);
        // early hint
        if (st < 8) {
          g.globalAlpha = CM.clamp(8 - st, 0, 1);
          D.text(g, CM.touchMode ? 'Tap the arrows when a heart lands on them!' : 'Press ← ↓ ↑ → when a heart lands on its arrow!',
            480, 588, { size: 15, color: '#f3e9ff', weight: 700, stroke: 'rgba(30,18,48,0.8)', strokeWidth: 4 });
          g.globalAlpha = 1;
        }
      }

      // combo milestone flash
      if (this.comboFlashT > 0) {
        const k = 1 - this.comboFlashT / 1.1;
        g.globalAlpha = this.comboFlashT > 0.85 ? 1 : this.comboFlashT / 0.85;
        D.text(g, 'COMBO x' + this.comboFlashVal + '!!', 480, 240, {
          size: 44 + k * 10, color: P.yellow, weight: 800,
          stroke: P.lavenderDeep, strokeWidth: 8
        });
        g.globalAlpha = 1;
      }

      // count-in overlay
      if (playing && st < LEAD + 0.45) {
        const firstTick = LEAD - 4 * BEAT;
        if (st < firstTick) {
          D.text(g, 'Ready…', 480, 280, { size: 40, color: '#fff', weight: 800, stroke: P.lavenderDeep, strokeWidth: 7 });
        } else {
          const k = Math.min(3, Math.floor((st - firstTick) / BEAT));
          const frac = ((st - firstTick) / BEAT) % 1;
          const labels = ['3', '2', '1', 'Dance!'];
          D.text(g, labels[k], 480, 280, {
            size: (k === 3 ? 64 : 86) * (1.2 - frac * 0.2),
            color: k === 3 ? P.pink : '#fff',
            weight: 800, stroke: P.lavenderDeep, strokeWidth: 9
          });
        }
      }

      // done — pose moment
      if (this.state === 'done') {
        D.text(g, 'What a party!!', 480, 210, { size: 50, color: '#fff', weight: 800, stroke: P.lavenderDeep, strokeWidth: 9 });
        D.text(g, 'Perfect ' + this.counts.perfect + '  ·  Good ' + this.counts.good + '  ·  Best combo x' + this.bestCombo,
          480, 262, { size: 20, color: '#f3e9ff', weight: 700, stroke: 'rgba(30,18,48,0.7)', strokeWidth: 4 });
      }

      // how-to overlay
      if (this.state === 'howto') this.drawHowto(g, t);
    },

    drawHowto(g, t) {
      g.fillStyle = 'rgba(30,18,48,0.45)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 215, 92, 530, 404, { title: 'How to Play' });
      CM.drawFriend(g, 'kuromi', 300, 330, 1.2, { bob: ((t * 1.2) % 1) * 0.5 });
      D.bubble(g, 232, 158, 140, 38, 300);
      D.text(g, 'Keep up with me!', 302, 177, { size: 14, color: P.lavenderDeep, weight: 800 });
      D.text(g, 'Hearts fall down the 4 lanes!', 545, 230, { size: 19, color: P.ink, weight: 800 });
      D.text(g, CM.touchMode ? 'Tap an arrow when a heart' : 'Press ← ↓ ↑ → (or tap the arrows)', 545, 264, { size: 17, color: P.ink });
      D.text(g, CM.touchMode ? 'lands right on top of it!' : 'when a heart lands on its arrow!', 545, 292, { size: 17, color: P.ink });
      D.text(g, 'Perfect timing = big points + combos!', 545, 326, { size: 16, color: P.pinkDeep, weight: 800 });
      for (let i = 0; i < 4; i++) {
        const x = 461 + i * 56;
        D.circle(g, x, 372, 21, '#fff', LANE_FILL[i], 4);
        arrowGlyph(g, x, 372, i, 17, LANE_DEEP[i], 4.5);
      }
      if (CM.ui.button(g, 375, 414, 210, 56, "♪ Let's Dance!", { color: P.pinkDeep, size: 21 })) {
        this.begin();
        return;
      }
      if (!CM.touchMode) {
        D.text(g, 'or press SPACE', 480, 516, { size: 14, color: '#d8c9f2' });
      }
    },

    exit() { /* nothing to clean up — all timing is driven by update(dt) */ }
  });
})();
