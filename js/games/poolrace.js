/* Cinnamoroll Mansion — Pool Race (hosted by Pochacco) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---- pool geometry ----
     Two swim lanes laid out across the canvas. Swimmers travel left → right.
     race progress is a 0..1 value per swimmer; mapped to screen x. */
  const START_X = 150;     // x of the start wall (left)
  const FINISH_X = 838;    // x of the far wall (right)
  const LANE_TOP = 250;    // y of the top of the first lane
  const LANE_H = 96;       // height of each lane
  const LANE_GAP = 18;     // gap between lanes
  const PLAYER_LANE_Y = LANE_TOP + LANE_H * 0.5;                 // player's lane center
  const RIVAL_LANE_Y = LANE_TOP + LANE_H + LANE_GAP + LANE_H * 0.5; // rival's lane center

  const TOTAL_RACES = 6;
  const STROKE_PUSH = 0.052;     // progress gained per tap (very generous mashing)
  const STROKE_COOLDOWN = 0.07;  // min seconds between counted strokes
  const DRAG = 0.55;             // how quickly player coasting speed bleeds off
  const RIVAL_BASE = 0.205;      // rival progress / second in race 1
  const RIVAL_STEP = 0.014;      // rival speeds up a touch each race (gentler so all 6 races stay beatable)
  const MAX_PARTS = 80;

  const POCHA = { x: 78, y: 196 };  // host cheering on the deck

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'poolrace',
    name: 'Pool Race',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';   // howto -> count -> race -> result -> (count/done) -> finish once
      this.score = 0;
      this.race = 0;          // 0..2
      this.finished = false;

      this.resetRace();

      this.parts = [];
      this.shake = 0;
      this.countT = 0;
      this.lastSeg = -1;
      this.resultT = 0;
      this.doneT = 0;

      this.msg = '';
      this.bigMsg = '';
      this.lastResult = '';   // 'win' | 'close' | 'try'
      this.hostBubble = { text: '', t: 0 };
      this.hostHappy = 0;

      // a few decorative floats bobbing in the unused water at the back
      this.floats = [
        { x: 300, y: 168, r: 26, hue: P.pink, ph: 0.0 },
        { x: 560, y: 150, r: 22, hue: P.yellow, ph: 1.7 },
        { x: 760, y: 172, r: 28, hue: P.mint, ph: 3.1 }
      ];
    },

    exit() {},

    resetRace() {
      this.player = { prog: 0, speed: 0, armPhase: 0, splashCd: 0 };
      this.rival = { prog: 0, kickPhase: 0 };
      this.strokeCd = 0;
      this.racing = false;     // becomes true once 'Go!' lands
      this.winner = null;      // 'player' | 'rival'
    },

    /* ================= state transitions ================= */
    beginCount() {
      this.state = 'count';
      this.countT = 0;
      this.lastSeg = -1;
      this.resetRace();
      this.say('Ready set...', 1.4);
    },

    startRacing() {
      this.state = 'race';
      this.racing = true;
      CM.audio.play('whoosh');
    },

    finishRace(winner) {
      this.racing = false;
      this.winner = winner;
      // speed bonus: the further ahead the player was when the race ended, the more.
      const lead = CM.clamp(this.player.prog - this.rival.prog, 0, 1);
      const speedBonus = Math.round(lead * 50);

      let pts = 0;
      if (winner === 'player') {
        pts = 100 + speedBonus;
        this.lastResult = 'win';
        this.bigMsg = 'YOU WIN!';
        this.msg = CM.pick(['Woohoo!! 🏆', 'Amazing swim!', 'So fast!!']);
        CM.audio.play('tada');
        this.doShake(8);
        this.celebrate(30);
        this.say('You did it!! 🎉', 2.4);
      } else {
        // a close finish (rival barely ahead) still scores well — never punishing
        const gap = this.rival.prog - this.player.prog;
        if (gap <= 0.16) {
          pts = 50 + Math.round(speedBonus * 0.5);
          this.lastResult = 'close';
          this.bigMsg = 'So close!';
          this.msg = CM.pick(['Almost!! 💕', 'Photo finish!', 'Nearly had it!']);
          CM.audio.play('ding');
          this.celebrate(16);
          this.say('So close!! 💪', 2.2);
        } else {
          pts = 30;
          this.lastResult = 'try';
          this.bigMsg = 'Good try!';
          this.msg = CM.pick(['Good try!! 🐾', 'Nice swim!', 'Next one!']);
          CM.audio.play('pop');
          this.celebrate(8);
          this.say('Good try!', 2.0);
        }
      }
      this.score += pts;
      this.lastPts = pts;
      this.state = 'result';
      this.resultT = 2.4;
    },

    nextRaceOrDone() {
      if (this.race >= TOTAL_RACES - 1) {
        this.state = 'done';
        this.doneT = 1.8;
        this.shake = 7;
        this.say('Great racing!', 3);
        CM.audio.play('cheer');
      } else {
        this.race++;
        this.beginCount();
      }
    },

    /* ================= update ================= */
    update(dt) {
      this.shake = Math.max(0, this.shake - dt * 16);
      if (this.hostBubble.t > 0) this.hostBubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      if (this.strokeCd > 0) this.strokeCd -= dt;
      if (this.player.splashCd > 0) this.player.splashCd -= dt;
      this.tickParts(dt);

      // gentle float bob
      for (const f of this.floats) f.ph += dt;

      switch (this.state) {
        case 'howto':
          if (anyPress()) this.beginCount();
          break;

        case 'count':
          this.countT += dt;
          {
            const seg = Math.floor(this.countT / 0.7);
            if (seg !== this.lastSeg && seg <= 3) {
              this.lastSeg = seg;
              if (seg < 3) CM.audio.tone(560 + seg * 90, 0.14, 'triangle', 0.12);
              else CM.audio.play('ding');
            }
          }
          if (this.countT >= 3.0) this.startRacing();
          break;

        case 'race':
          this.updateRace(dt);
          break;

        case 'result':
          // gentle confetti drizzle while we celebrate
          if (this.lastResult === 'win' && this.parts.length < 50 && Math.random() < 0.25) {
            this.addPart({
              kind: 'spark', x: CM.rand(200, 760), y: CM.rand(120, 240),
              vx: CM.rand(-30, 30), vy: CM.rand(-60, -10),
              t: 0, life: 0.9, size: CM.rand(6, 11),
              color: CM.pick([P.pink, P.yellow, P.mint, P.lavender, P.blue])
            });
          }
          this.resultT -= dt;
          // tap to skip ahead after a beat
          if (this.resultT < 1.7 && anyPress()) this.resultT = 0;
          if (this.resultT <= 0) this.nextRaceOrDone();
          break;

        case 'done':
          if (this.parts.length < 50 && Math.random() < 0.3) {
            this.addPart({
              kind: 'spark', x: CM.rand(180, 780), y: CM.rand(120, 300),
              vx: CM.rand(-30, 30), vy: CM.rand(-70, -20),
              t: 0, life: 0.9, size: CM.rand(6, 12),
              color: CM.pick([P.pink, P.yellow, P.mint, P.lavender, P.blue])
            });
          }
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('poolrace', this.score, CM.clamp(Math.ceil(this.score / 16), 5, 30));
          }
          break;
      }
    },

    updateRace(dt) {
      const pl = this.player;
      const rv = this.rival;

      // ----- player: tap/click/SPACE = a stroke push -----
      pl.armPhase += dt * (2 + pl.speed * 6);
      if (anyPress() && this.strokeCd <= 0) {
        this.strokeCd = STROKE_COOLDOWN;
        pl.speed += STROKE_PUSH;
        pl.armPhase = 0; // reset so the arm swings on each stroke
        CM.audio.play('pop');
        if (pl.splashCd <= 0) {
          this.splashAt(this.swimX(pl.prog) - 14, PLAYER_LANE_Y + 6, 4);
          pl.splashCd = 0.05;
        }
      }
      // coast forward, with drag bleeding the speed back down
      pl.prog += pl.speed * dt;
      pl.speed = Math.max(0, pl.speed - DRAG * pl.speed * dt - 0.02 * dt);

      // ----- rival: steady pace, a touch faster each race -----
      const rivalSpeed = RIVAL_BASE + this.race * RIVAL_STEP;
      rv.prog += rivalSpeed * dt;
      rv.kickPhase += dt * 5;
      if (Math.random() < dt * 6) {
        this.splashAt(this.swimX(rv.prog) - 12, RIVAL_LANE_Y + 6, 2);
      }

      // gentle cheer when the player pulls ahead late in the race
      if (pl.prog > 0.6 && pl.prog > rv.prog + 0.08 && this.hostBubble.t <= 0 && this.hostHappy <= 0) {
        this.say('Go go go!! 🐾', 1.2);
      }

      pl.prog = CM.clamp(pl.prog, 0, 1);
      rv.prog = CM.clamp(rv.prog, 0, 1);

      if (pl.prog >= 1) { this.finishRace('player'); return; }
      if (rv.prog >= 1) { this.finishRace('rival'); return; }
    },

    /* ================= helpers ================= */
    swimX(prog) {
      return CM.lerp(START_X, FINISH_X, prog);
    },

    say(text, t) {
      this.hostBubble = { text: text, t: t };
      this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    doShake(mag) { this.shake = mag; },

    /* ----- particles ----- */
    addPart(p) { if (this.parts.length < MAX_PARTS) this.parts.push(p); },

    splashAt(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.addPart({
          kind: 'drop', x: x, y: y,
          vx: CM.rand(-70, 30), vy: CM.rand(-150, -40),
          t: 0, life: CM.rand(0.35, 0.6), size: CM.rand(2.5, 5),
          color: Math.random() < 0.5 ? '#ffffff' : '#cdeeff'
        });
      }
      if (this.player.splashCd <= 0) CM.audio.play('splash');
    },

    celebrate(n) {
      for (let i = 0; i < n; i++) {
        this.addPart({
          kind: Math.random() < 0.5 ? 'star' : 'heart',
          x: CM.rand(300, 660), y: CM.rand(140, 300),
          vx: CM.rand(-90, 90), vy: CM.rand(-190, -40),
          t: 0, life: CM.rand(0.7, 1.3), size: CM.rand(8, 14),
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep]),
          rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
        });
      }
    },

    tickParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.t += dt;
        if (p.t >= p.life) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += (p.kind === 'drop' ? 380 : 240) * dt;
        if (p.rot !== undefined) p.rot += (p.vr || 0) * dt;
      }
    },

    /* ================= draw ================= */
    draw(g) {
      const t = CM.time;

      g.save();
      if (this.shake > 0.2) {
        g.translate(CM.rand(-this.shake, this.shake) * 0.7, CM.rand(-this.shake, this.shake) * 0.7);
      }

      this.drawScene(g, t);

      // swimmers
      this.drawRival(g, t);
      this.drawSwimmer(g, t);

      // host Pochacco cheering on the deck
      const happy = this.hostHappy > 0 || this.state === 'done' || this.lastResult === 'win';
      const bob = happy ? (t * 2.6) % 1 : ((t * 0.9) % 1) * 0.4;
      CM.drawFriend(g, 'pochacco', POCHA.x, POCHA.y, 1.12, { bob: bob });
      // a little raised paw + flag when excited
      if (happy) {
        const lift = Math.abs(Math.sin(bob * Math.PI * 2)) * 5;
        D.circle(g, POCHA.x + 24, POCHA.y - 60 - lift, 5, '#ffffff', '#dfe5ea', 1.5);
        D.star(g, POCHA.x + 24, POCHA.y - 74 - lift, 6, P.yellowDeep);
      }

      // particles
      this.drawParts(g);

      // count-in overlay
      if (this.state === 'count') {
        const SEGS = ['3', '2', '1', 'Go!'];
        const seg = Math.min(3, Math.floor(this.countT / 0.7));
        const frac = (this.countT - seg * 0.7) / 0.7;
        const size = (seg === 3 ? 78 : 96) * (1 + 0.3 * Math.max(0, 1 - frac * 3));
        D.text(g, SEGS[seg], 494, 300, {
          size: Math.round(size), color: seg === 3 ? P.mintDeep : P.pinkDeep, weight: 800,
          stroke: '#ffffff', strokeWidth: 10
        });
      }

      g.restore(); // end shake — context back to normal

      /* ---- HUD (not shaken) ---- */
      this.drawHud(g, t);

      // host speech bubble
      if (this.hostBubble.t > 0 && this.state !== 'howto') {
        const txt = this.hostBubble.text;
        const cw = Math.max(110, txt.length * 9 + 28);
        const bx = CM.clamp(POCHA.x - 12, 8, CM.W - cw - 8);
        D.bubble(g, bx, POCHA.y - 158, cw, 42, POCHA.x + 16);
        D.text(g, txt, bx + cw / 2, POCHA.y - 137, { size: 15, weight: 800, color: P.pinkDeep });
      }

      // result banner
      if (this.state === 'result' && this.bigMsg) {
        const el = 2.4 - this.resultT;
        const sc = Math.min(1, el * 4);
        const col = this.lastResult === 'win' ? P.pinkDeep : (this.lastResult === 'close' ? P.blueDeep : P.lavenderDeep);
        D.text(g, this.bigMsg, 480, 150, {
          size: 28 + 40 * sc, color: col, weight: 800, stroke: '#fff', strokeWidth: 10
        });
        D.text(g, this.msg, 480, 200, { size: 22, color: P.ink, weight: 800, stroke: '#fff', strokeWidth: 5 });
        D.text(g, '+' + this.lastPts + ' points!', 480, 232, { size: 20, color: '#c98a1f', weight: 800, stroke: '#fff', strokeWidth: 4 });
        if (this.lastResult === 'win') {
          D.star(g, 322, 150, 20, P.yellowDeep, t * 2.5);
          D.star(g, 638, 150, 20, P.yellowDeep, -t * 2.5);
        }
        if (this.resultT < 1.7) {
          D.text(g, CM.touchMode ? 'Tap to continue' : 'Tap or SPACE to continue', 480, 564, { size: 14, color: '#7a6b75', weight: 700 });
        }
      }

      // race hint while swimming
      if (this.state === 'race') {
        const hint = CM.touchMode ? 'Tap fast to swim!' : 'Tap / click / SPACE fast to swim!';
        D.rr(g, 300, 568, 360, 26, 13, 'rgba(255,255,255,0.75)');
        D.text(g, hint, 480, 581, { size: 15, color: P.pinkDeep, weight: 800 });
      }

      if (this.state === 'howto') this.drawHowto(g, t);

      if (this.state === 'done') {
        g.fillStyle = 'rgba(255,255,255,0.32)';
        g.fillRect(0, 0, CM.W, CM.H);
        D.text(g, 'Great racing!! 🏊', 480, 262, { size: 50, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10 });
        D.text(g, 'Final score: ' + this.score, 480, 322, { size: 28, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 5 });
      }
    },

    /* ---- the poolside scene ---- */
    drawScene(g, t) {
      // soft blue sky
      const sky = g.createLinearGradient(0, 0, 0, 140);
      sky.addColorStop(0, '#cfeeff');
      sky.addColorStop(1, '#e9f7ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, CM.W, 140);
      // a friendly sun + fluffy clouds
      D.circle(g, 836, 56, 30, '#fff3b0');
      D.circle(g, 836, 56, 22, '#ffe07a');
      this.drawCloud(g, 150, 50, 1.0);
      this.drawCloud(g, 470, 38, 0.8);

      // pool deck (pale tile) — top strip and the front apron
      g.fillStyle = '#f3e6d2';
      g.fillRect(0, 110, CM.W, 28);
      g.fillStyle = '#efe0c8';
      g.fillRect(0, CM.H - 84, CM.W, 84);
      // tile seams on the front apron
      g.strokeStyle = 'rgba(170,140,100,0.18)';
      g.lineWidth = 2;
      for (let x = 0; x <= CM.W; x += 48) {
        g.beginPath(); g.moveTo(x, CM.H - 84); g.lineTo(x, CM.H); g.stroke();
      }
      g.beginPath(); g.moveTo(0, CM.H - 42); g.lineTo(CM.W, CM.H - 42); g.stroke();

      // the pool water
      const top = 138;
      const bot = CM.H - 84;
      const water = g.createLinearGradient(0, top, 0, bot);
      water.addColorStop(0, '#8ecdf6');
      water.addColorStop(0.55, '#5fb4ec');
      water.addColorStop(1, '#4a9fdc');
      g.fillStyle = water;
      g.fillRect(0, top, CM.W, bot - top);

      // gentle ripple highlights drifting across the water
      g.strokeStyle = 'rgba(255,255,255,0.28)';
      g.lineWidth = 2;
      for (let r = 0; r < 7; r++) {
        const yy = top + 20 + r * ((bot - top - 30) / 7);
        g.beginPath();
        for (let x = 0; x <= CM.W; x += 12) {
          const yo = Math.sin(x * 0.04 + t * 1.4 + r) * 3;
          if (x === 0) g.moveTo(x, yy + yo); else g.lineTo(x, yy + yo);
        }
        g.stroke();
      }
      // sparkles dancing on the surface
      for (let i = 0; i < 12; i++) {
        const sx = (i * 173 + 40) % CM.W;
        const sy = top + 16 + ((i * 97) % (bot - top - 30));
        const tw = 0.5 + 0.5 * Math.sin(t * 3 + i * 1.3);
        if (tw > 0.78) {
          g.globalAlpha = (tw - 0.78) / 0.22;
          D.star(g, sx, sy, 3.5, '#ffffff');
          g.globalAlpha = 1;
        }
      }

      // decorative back floats (rubber rings) bobbing in the upper water
      for (const f of this.floats) {
        const fy = f.y + Math.sin(f.ph * 1.6) * 4;
        D.circle(g, f.x, fy, f.r, f.hue, 'rgba(255,255,255,0.6)', 4);
        D.circle(g, f.x, fy, f.r * 0.5, '#5fb4ec');
        D.circle(g, f.x - f.r * 0.35, fy - f.r * 0.35, f.r * 0.18, 'rgba(255,255,255,0.8)');
      }

      // lane rope dividers (floating buoys) — between & around the two race lanes
      this.drawLaneRope(g, LANE_TOP, t);
      this.drawLaneRope(g, LANE_TOP + LANE_H + LANE_GAP, t);
      this.drawLaneRope(g, LANE_TOP + (LANE_H + LANE_GAP) * 2, t);

      // start & finish walls
      // start wall (left)
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.fillRect(START_X - 22, LANE_TOP - 6, 10, (LANE_H + LANE_GAP) * 2 + LANE_H + 12);
      // finish wall (right) with checker flag stripe
      const fwTop = LANE_TOP - 6;
      const fwH = (LANE_H + LANE_GAP) * 2 + LANE_H + 12;
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.fillRect(FINISH_X + 8, fwTop, 12, fwH);
      for (let i = 0; i * 12 < fwH; i++) {
        g.fillStyle = i % 2 ? '#4a3b46' : '#ffffff';
        g.fillRect(FINISH_X, fwTop + i * 12, 8, 12);
      }
      D.text(g, 'FINISH', FINISH_X + 14, fwTop - 14, { size: 14, color: P.pinkDeep, weight: 800 });

      // poolside props on the deck (drawn on the back deck strip)
      this.drawUmbrella(g, 690, 110);
      this.drawDeckChair(g, 360, 122, t);
      this.drawLadder(g, FINISH_X - 6, LANE_TOP - 6);
    },

    drawCloud(g, x, y, s) {
      g.fillStyle = 'rgba(255,255,255,0.9)';
      g.beginPath();
      g.ellipse(x, y, 30 * s, 18 * s, 0, 0, Math.PI * 2);
      g.ellipse(x - 24 * s, y + 5 * s, 20 * s, 13 * s, 0, 0, Math.PI * 2);
      g.ellipse(x + 24 * s, y + 5 * s, 22 * s, 14 * s, 0, 0, Math.PI * 2);
      g.fill();
    },

    drawLaneRope(g, y, t) {
      const cols = [P.pink, P.yellow];
      for (let x = START_X - 10; x <= FINISH_X + 8; x += 22) {
        const yo = Math.sin(x * 0.05 + t * 1.6) * 2;
        const c = cols[Math.floor(x / 22) % 2];
        D.circle(g, x, y + yo, 6, c, 'rgba(255,255,255,0.6)', 1.5);
      }
    },

    drawUmbrella(g, x, y) {
      // pole
      g.strokeStyle = '#b58a5a'; g.lineWidth = 5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y - 4); g.lineTo(x, y - 84); g.stroke();
      // canopy
      const cols = [P.pink, '#ffffff', P.pink, '#ffffff', P.pink, '#ffffff'];
      const r = 56;
      for (let i = 0; i < 6; i++) {
        g.fillStyle = cols[i];
        g.beginPath();
        g.moveTo(x, y - 84);
        const a0 = Math.PI + (i / 6) * Math.PI;
        const a1 = Math.PI + ((i + 1) / 6) * Math.PI;
        g.lineTo(x + Math.cos(a0) * r, y - 84 - Math.sin(a0) * r * 0.55 + 0);
        g.lineTo(x + Math.cos(a1) * r, y - 84 - Math.sin(a1) * r * 0.55 + 0);
        g.closePath();
        g.fill();
      }
      D.circle(g, x, y - 84, 5, P.pinkDeep);
    },

    drawDeckChair(g, x, y, t) {
      D.shadow(g, x, y + 6, 36);
      // frame back (reclined)
      D.rr(g, x - 36, y - 44, 50, 12, 6, '#ffffff', '#dfe5ea', 2);
      g.save();
      g.translate(x - 12, y - 38);
      g.rotate(-0.5);
      D.rr(g, -2, -28, 50, 12, 6, P.mintDeep, '#4ea36b', 2);
      g.restore();
      // seat
      D.rr(g, x - 38, y - 16, 56, 12, 6, P.mintDeep, '#4ea36b', 2);
      // legs
      g.strokeStyle = '#cfd6dc'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 30, y - 6); g.lineTo(x - 36, y + 8); g.stroke();
      g.beginPath(); g.moveTo(x + 12, y - 6); g.lineTo(x + 18, y + 8); g.stroke();
    },

    drawLadder(g, x, yTop) {
      g.strokeStyle = '#dfe9f2'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 10, yTop - 18); g.lineTo(x - 10, yTop + 30); g.stroke();
      g.beginPath(); g.moveTo(x + 4, yTop - 18); g.lineTo(x + 4, yTop + 30); g.stroke();
      for (let i = 0; i < 3; i++) {
        g.beginPath(); g.moveTo(x - 10, yTop - 10 + i * 14); g.lineTo(x + 4, yTop - 10 + i * 14); g.stroke();
      }
    },

    /* ---- the player swimming (their customized character, floating in the lane) ---- */
    drawSwimmer(g, t) {
      const pl = this.player;
      const x = this.swimX(pl.prog);
      const y = PLAYER_LANE_Y;
      const bobY = Math.sin(t * 6 + pl.armPhase) * 2;

      // water wake behind the swimmer
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x - 18, y + 14 + bobY);
      g.quadraticCurveTo(x - 44, y + 18 + bobY, x - 66, y + 12 + bobY);
      g.stroke();

      // the kid's head + shoulders bobbing above the surface, drawn small
      g.save();
      g.translate(x, y + bobY);
      // body in water (oval just under the surface)
      D.ellipse(g, 0, 12, 26, 10, 'rgba(255,255,255,0.25)');
      // arm stroke: swings forward right after each tap (armPhase resets to 0 on stroke)
      const swing = Math.max(0, 1 - pl.armPhase * 2.2); // 1 → 0 over ~0.45s
      const armA = -0.6 - swing * 1.6;
      g.save();
      g.translate(10, -2);
      g.rotate(armA);
      D.rr(g, 0, -4, 22, 8, 4, CM.SKINS[(CM.save.character && CM.save.character.skin) || 0] || '#ffe3cf');
      g.restore();
      // use the real player character for the head/torso (feet anchored — we lift it so torso shows)
      CM.drawPlayer(g, 0, 30, 0.62, 'right', 0);
      g.restore();
    },

    /* ---- the rival friend swimming ---- */
    drawRival(g, t) {
      const rv = this.rival;
      const x = this.swimX(rv.prog);
      const y = RIVAL_LANE_Y;
      const bobY = Math.sin(t * 5 + rv.kickPhase) * 2;

      // wake
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x - 16, y + 14 + bobY);
      g.quadraticCurveTo(x - 40, y + 18 + bobY, x - 60, y + 12 + bobY);
      g.stroke();

      g.save();
      g.translate(x, y + bobY);
      D.ellipse(g, 0, 12, 24, 10, 'rgba(255,255,255,0.22)');
      // Badtz-Maru splashing along (feet anchored; lift so torso shows above water)
      CM.drawFriend(g, 'badtzmaru', 0, 30, 0.6, { shadow: false });
      g.restore();
    },

    /* ---- HUD: race counter, progress bars, score ---- */
    drawHud(g, t) {
      // race counter, top-center
      if (this.state !== 'howto') {
        D.rr(g, 386, 10, 188, 44, 22, 'rgba(255,255,255,0.92)', '#f0b9d2', 3);
        D.text(g, '🏊 Race ' + (this.race + 1) + ' / ' + TOTAL_RACES, 480, 33, {
          size: 22, color: P.blueDeep, weight: 800
        });
        // score, top-left
        D.rr(g, 14, 12, 150, 40, 20, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
        D.coin(g, 36, 32, 12);
        D.text(g, String(this.score), 110, 32, { size: 22, color: '#c98a1f', weight: 800 });
      }

      // lane progress bars (only meaningful during/after a race)
      if (this.state === 'race' || this.state === 'result') {
        this.drawProgressBar(g, 200, 70, this.player.prog, P.pinkDeep, 'You');
        this.drawProgressBar(g, 200, 96, this.rival.prog, '#4a3b46', 'Badtz');
      }
    },

    drawProgressBar(g, x, y, prog, color, label) {
      const w = 560, h = 16;
      D.text(g, label, x - 14, y + h / 2, { size: 14, color: color === '#4a3b46' ? P.ink : color, weight: 800, align: 'right' });
      D.rr(g, x, y, w, h, 8, 'rgba(255,255,255,0.7)', '#f0b9d2', 1.5);
      const fw = Math.max(6, w * CM.clamp(prog, 0, 1));
      D.rr(g, x, y, fw, h, 8, color);
      // little swimmer dot at the head of the bar
      D.circle(g, x + fw, y + h / 2, h * 0.6, color, '#ffffff', 1.5);
      // finish flag
      D.text(g, '🏁', x + w + 14, y + h / 2, { size: 14 });
    },

    drawParts(g) {
      for (const p of this.parts) {
        g.globalAlpha = Math.max(0, 1 - p.t / p.life);
        if (p.kind === 'star') D.star(g, p.x, p.y, p.size, p.color, p.rot);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, p.color);
        else D.circle(g, p.x, p.y, p.size, p.color); // water drop
      }
      g.globalAlpha = 1;
    },

    /* ---- how-to overlay ---- */
    drawHowto(g, t) {
      g.fillStyle = 'rgba(70,40,70,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 180, 96, 600, 392, { title: '🏊 Pool Race with Pochacco' });
      CM.drawFriend(g, 'pochacco', 286, 392, 1.25, { bob: ((t * 1.1) % 1) * 0.5 });
      D.text(g, 'Pochacco', 286, 416, { size: 14, color: P.pinkDeep, weight: 800 });

      D.text(g, 'Race Badtz-Maru across the pool!', 568, 168, { size: 19, color: P.ink, weight: 800 });
      D.text(g, 'Tap, click or press SPACE fast', 568, 214, { size: 17, color: P.ink, weight: 700 });
      D.text(g, 'to SWIM — each tap is a stroke!', 568, 240, { size: 17, color: P.ink, weight: 700 });
      D.text(g, 'First to the far wall wins! 🏁', 568, 284, { size: 17, color: P.pinkDeep, weight: 800 });
      D.text(g, '6 races · win for big points!', 568, 328, { size: 16, color: P.blueDeep, weight: 800 });
      D.text(g, 'Mash happily — Badtz-Maru is beatable!', 480, 366, { size: 14, color: '#9a8a94' });

      if (CM.ui.button(g, 380, 400, 200, 58, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.beginCount();
      }
    }
  });
})();
