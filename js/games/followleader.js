/* Cinnamoroll Mansion — Follow the Leader (hosted by Cinnamoroll) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------------- the four moves ---------------- */
  // each move: label, icon, button colours, and its own little note
  const MOVES = [
    { key: 'JUMP',   icon: '⬆', fill: '#8ecdf6', deep: '#4a9fdc', freq: 392.00 }, // G4
    { key: 'SPIN',   icon: '🌀', fill: '#d8c9f2', deep: '#9b7bd4', freq: 523.25 }, // C5
    { key: 'CLAP',   icon: '👏', fill: '#ffe9a8', deep: '#f2b53c', freq: 659.25 }, // E5
    { key: 'WIGGLE', icon: '〰', fill: '#bdeccd', deep: '#67c587', freq: 783.99 }  // G5
  ];

  // bottom button layout: 4 buttons, each >= 130 wide, >= 56 tall
  const BTN = { y: 512, w: 214, h: 74, gap: 14, x0: 28 };
  function btnRect(i) {
    return { x: BTN.x0 + i * (BTN.w + BTN.gap), y: BTN.y, w: BTN.w, h: BTN.h };
  }

  // pacing (seconds) — slow + unmissable for a 6-year-old
  const DEMO_FLASH = 0.62;   // how long each demo move flashes/acts
  const DEMO_GAP = 0.40;     // quiet pause between demo moves
  const DEMO_LEAD = 0.85;    // beat before the demo begins
  const INPUT_FLASH = 0.42;  // player's own move flash duration
  const MAX_PARTS = 80;

  const WIN_ROUND = 8;       // clearing this round = happy finish
  const MAX_MISS = 3;        // missing the SAME round this many times = happy finish
  const PTS_PER_ROUND = 40;

  const LEADER = { x: 320, y: 388 };  // Cinnamoroll's feet
  const PLAYER = { x: 600, y: 392 };  // player's feet

  function anyMoveKey() {
    // arrows + number keys 1..4 map to the four moves
    if (CM.input.pressed('up') || CM.input.pressed('1')) return 0;
    if (CM.input.pressed('left') || CM.input.pressed('2')) return 1;
    if (CM.input.pressed('down') || CM.input.pressed('3')) return 2;
    if (CM.input.pressed('right') || CM.input.pressed('4')) return 3;
    return -1;
  }

  CM.registerGame({
    id: 'followleader',
    name: 'Follow the Leader',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';      // howto → demo → input → roundResult → done
      this.score = 0;
      this.round = 1;            // sequence length this round
      this.seq = [];             // the move indices to copy
      this.buildSequence();

      this.demoIdx = 0;          // which move of the demo we're on
      this.demoT = 0;            // timer within current demo step
      this.demoPhase = 'lead';   // 'lead' | 'flash' | 'gap'

      this.inputIdx = 0;         // how many moves the player has matched
      this.flashMove = -1;       // which button is currently lit
      this.flashT = 0;           // remaining lit time
      this.actor = 'none';       // who is animating: 'leader' | 'player' | 'none'
      this.actMove = -1;         // move being animated
      this.actT = 0;             // 0..1 animation progress (counts up)

      this.missCount = 0;        // misses on the CURRENT round
      this.totalMiss = 0;
      this.bestRound = 0;        // longest sequence cleared

      this.msg = '';             // Cinnamoroll's speech bubble
      this.msgT = 0;
      this.bigMsg = '';
      this.bigT = 0;
      this.replay = false;       // are we re-showing after a miss?

      this.parts = [];
      this.shk = { t: 0, dur: 1, mag: 0 };
      this.resultT = 0;
      this.doneT = 0;
      this.finished = false;

      this.say("Let's play!", 1.4);
    },

    exit() {},

    /* ================= setup ================= */
    buildSequence() {
      // extend the existing sequence so it grows nicely each round
      while (this.seq.length < this.round) {
        // avoid 3 identical moves in a row (just for variety)
        let m;
        let guard = 0;
        do {
          m = CM.randInt(0, 3);
          guard++;
        } while (guard < 8 && this.seq.length >= 2 &&
                 this.seq[this.seq.length - 1] === m && this.seq[this.seq.length - 2] === m);
        this.seq.push(m);
      }
      this.seq.length = this.round; // trim if needed
    },

    startDemo(isReplay) {
      this.state = 'demo';
      this.demoIdx = 0;
      this.demoT = 0;
      this.demoPhase = 'lead';
      this.flashMove = -1;
      this.flashT = 0;
      this.actor = 'none';
      this.actMove = -1;
      this.actT = 0;
      this.inputIdx = 0;
      this.replay = !!isReplay;
      this.bigMsg = '';
      this.bigT = 0;
      this.say(isReplay ? 'Watch again 💛' : 'Watch me!', 1.6);
    },

    startInput() {
      this.state = 'input';
      this.inputIdx = 0;
      this.flashMove = -1;
      this.flashT = 0;
      this.actor = 'none';
      this.actMove = -1;
      this.actT = 0;
      this.bigMsg = 'Your turn!';
      this.bigT = 1.3;
      this.say('Your turn!', 1.6);
      CM.audio.play('whoosh');
    },

    /* ================= say / juice ================= */
    say(text, dur) {
      this.msg = text;
      this.msgT = dur || 1.5;
    },

    doShake(t, mag) { this.shk = { t: t, dur: t, mag: mag }; },

    playMoveSound(m) {
      const mv = MOVES[m];
      // a cheerful two-note blip, distinct pitch per move
      CM.audio.tone(mv.freq, 0.16, 'triangle', 0.13);
      CM.audio.tone(mv.freq * 1.5, 0.12, 'triangle', 0.08, 0.07);
    },

    // light up a button + play its sound + animate a character
    fireMove(m, who) {
      this.flashMove = m;
      this.flashT = who === 'leader' ? DEMO_FLASH : INPUT_FLASH;
      this.actor = who;
      this.actMove = m;
      this.actT = 0;
      this.playMoveSound(m);
      // a few sparkles in the move's colour pop off the actor
      const ax = who === 'leader' ? LEADER.x : PLAYER.x;
      const ay = (who === 'leader' ? LEADER.y : PLAYER.y) - 70;
      this.burst(ax, ay, 5, MOVES[m].fill, MOVES[m].deep);
    },

    spawnPart(pt) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      pt.maxLife = pt.life;
      this.parts.push(pt);
    },

    burst(x, y, n, c1, c2) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * Math.PI * 2;
        const sp = CM.rand(60, 180);
        this.spawnPart({
          x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 70,
          life: CM.rand(0.4, 0.85),
          type: i % 3 === 0 ? 'star' : (i % 3 === 1 ? 'heart' : 'spark'),
          color: i % 2 ? (c1 || P.pink) : (c2 || P.pinkDeep),
          size: CM.rand(5, 11), rot: CM.rand(0, 6), vr: CM.rand(-5, 5)
        });
      }
    },

    celebrate(n) {
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: CM.rand(220, 740), y: CM.rand(120, 300),
          vx: CM.rand(-110, 110), vy: CM.rand(-200, -40),
          life: CM.rand(0.7, 1.35),
          type: Math.random() < 0.5 ? 'star' : 'heart',
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
          size: CM.rand(7, 14), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
        });
      }
    },

    updateParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const pt = this.parts[i];
        pt.life -= dt;
        if (pt.life <= 0) { this.parts.splice(i, 1); continue; }
        pt.vy += 230 * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.rot += pt.vr * dt;
      }
    },

    /* ================= update ================= */
    update(dt) {
      if (this.shk.t > 0) this.shk.t -= dt;
      if (this.msgT > 0) this.msgT -= dt;
      if (this.bigT > 0) this.bigT -= dt;
      if (this.flashT > 0) this.flashT = Math.max(0, this.flashT - dt);
      else this.flashMove = -1;
      if (this.actor !== 'none') {
        this.actT += dt / 0.5;          // ~0.5s per move animation
        if (this.actT >= 1) { this.actT = 1; this.actor = 'none'; this.actMove = -1; }
      }
      this.updateParts(dt);

      switch (this.state) {
        case 'howto':
          // Start button handles taps; keyboard action also starts.
          if (CM.input.pressed('action')) this.startDemo(false);
          break;

        case 'demo':
          this.updateDemo(dt);
          break;

        case 'input':
          this.updateInput();
          break;

        case 'roundResult':
          this.resultT -= dt;
          if (this.resultT <= 0) this.afterResult();
          break;

        case 'done':
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('followleader', this.score, CM.clamp(Math.ceil(this.score / 15), 5, 30));
          }
          break;
      }
    },

    updateDemo(dt) {
      this.demoT += dt;
      if (this.demoPhase === 'lead') {
        if (this.demoT >= DEMO_LEAD) { this.demoT = 0; this.demoPhase = 'flash'; this.beginDemoStep(); }
      } else if (this.demoPhase === 'flash') {
        if (this.demoT >= DEMO_FLASH) { this.demoT = 0; this.demoPhase = 'gap'; }
      } else { // gap
        if (this.demoT >= DEMO_GAP) {
          this.demoT = 0;
          this.demoIdx++;
          if (this.demoIdx >= this.seq.length) {
            this.startInput();
          } else {
            this.demoPhase = 'flash';
            this.beginDemoStep();
          }
        }
      }
    },

    beginDemoStep() {
      this.fireMove(this.seq[this.demoIdx], 'leader');
    },

    updateInput() {
      // collect a move from mouse OR keyboard
      let m = -1;
      const mo = CM.input.mouse;
      if (mo.clicked) {
        for (let i = 0; i < 4; i++) {
          const r = btnRect(i);
          if (mo.x >= r.x && mo.x <= r.x + r.w && mo.y >= r.y && mo.y <= r.y + r.h) {
            m = i;
            mo.clicked = false;
            break;
          }
        }
      }
      if (m < 0) m = anyMoveKey();
      if (m < 0) return;

      const want = this.seq[this.inputIdx];
      if (m === want) {
        // correct! player performs the move
        this.fireMove(m, 'player');
        this.inputIdx++;
        if (this.inputIdx >= this.seq.length) {
          this.winRound();
        }
      } else {
        // gentle miss — light the wrong button briefly, then replay the SAME sequence
        this.flashMove = m;
        this.flashT = 0.3;
        CM.audio.play('miss');
        this.missCount++;
        this.totalMiss++;
        this.doShake(0.22, 4);
        this.burst(PLAYER.x, PLAYER.y - 70, 4, P.lavender, P.lavenderDeep);
        if (this.missCount >= MAX_MISS) {
          // they've tried this one a few times — let them finish happy
          this.bestRound = Math.max(this.bestRound, this.round - 1);
          this.say('You did great! 💛', 1.6);
          this.finishHappy();
        } else {
          this.say('Oops! Watch again 💛', 1.8);
          this.bigMsg = 'Oops!';
          this.bigT = 1.0;
          this.state = 'roundResult';
          this.resultT = 1.2;
          this.replayPending = true;  // afterResult will re-show the demo
        }
      }
    },

    winRound() {
      this.bestRound = Math.max(this.bestRound, this.round);
      this.score = this.bestRound * PTS_PER_ROUND;
      this.missCount = 0;
      CM.audio.play('ding');
      CM.audio.play('cheer');
      this.doShake(0.3, 5);
      this.celebrate(26);
      this.bigMsg = 'Yay!! 🎉';
      this.bigT = 1.4;
      this.say(CM.pick(['Woohoo!', 'Perfect!', 'Amazing!', 'You got it!']), 1.6);
      this.state = 'roundResult';
      this.resultT = 1.4;
      this.replayPending = false;
    },

    afterResult() {
      if (this.replayPending) {
        // re-show the exact same sequence (do NOT advance, do NOT punish)
        this.replayPending = false;
        this.startDemo(true);
        return;
      }
      // round cleared — is the game over?
      if (this.round >= WIN_ROUND) {
        this.finishHappy();
        return;
      }
      this.round++;
      this.buildSequence();
      this.startDemo(false);
    },

    finishHappy() {
      this.state = 'done';
      this.doneT = 1.6;
      this.bigMsg = 'Great job!!';
      this.bigT = 1.6;
      this.celebrate(30);
      this.doShake(0.4, 6);
      CM.audio.play('tada');
    },

    /* ================= draw ================= */
    draw(g) {
      g.save();
      if (this.shk.t > 0) {
        const m = this.shk.mag * (this.shk.t / this.shk.dur);
        g.translate(CM.rand(-m, m), CM.rand(-m, m));
      }

      this.drawBackyard(g);
      this.drawStage(g);

      // characters: leader (Cinnamoroll) + player
      this.drawLeader(g);
      this.drawThePlayer(g);

      this.drawParts(g);
      g.restore(); // end shake

      /* ---- buttons (not shaken) ---- */
      this.drawButtons(g);

      /* ---- HUD ---- */
      D.rr(g, 14, 12, 196, 44, 16, 'rgba(255,255,255,0.92)', '#bfe1f5', 2);
      D.star(g, 36, 34, 11, P.yellowDeep);
      D.text(g, 'Score ' + this.score, 120, 35, { size: 19, color: P.blueDeep, weight: 800 });

      // round dots (top center): shows sequence length + your progress
      this.drawRoundTracker(g);

      // Cinnamoroll's speech bubble
      if (this.msgT > 0 && this.msg && this.state !== 'howto') {
        g.globalAlpha = CM.clamp(this.msgT * 2, 0, 1);
        D.bubble(g, LEADER.x - 86, LEADER.y - 188, 172, 44, LEADER.x);
        D.text(g, this.msg, LEADER.x, LEADER.y - 166, { size: 16, color: P.blueDeep, weight: 800 });
        g.globalAlpha = 1;
      }

      // big banner (Your turn! / Yay!! / Oops! / Great job!)
      if (this.bigT > 0 && this.bigMsg) {
        const grow = Math.min(1, (1.6 - this.bigT) * 5);
        const col = this.bigMsg.indexOf('Oops') >= 0 ? P.lavenderDeep : P.pinkDeep;
        D.text(g, this.bigMsg, 480, 250, {
          size: 30 + 30 * Math.min(1, grow), color: col, weight: 800,
          stroke: '#fff', strokeWidth: 9
        });
      }

      // hint bar
      let hint = '';
      if (this.state === 'demo') hint = this.replay ? 'Watch the moves once more…' : 'Watch Cinnamoroll do the moves!';
      else if (this.state === 'input') {
        hint = CM.touchMode ? 'Tap the moves in the same order!' : 'Tap the moves (or 1 2 3 4 / arrow keys)!';
      }
      if (hint) {
        D.rr(g, 230, 478, 500, 26, 13, 'rgba(255,255,255,0.82)');
        D.text(g, hint, 480, 491, { size: 14, color: P.blueDeep, weight: 800 });
      }

      if (this.state === 'howto') this.drawHowto(g);
      if (this.state === 'done') {
        g.fillStyle = 'rgba(255,255,255,0.32)';
        g.fillRect(0, 0, CM.W, CM.H);
        D.text(g, 'Great job!!', 480, 250, { size: 56, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 11 });
        D.text(g, 'Longest dance: ' + this.bestRound + ' moves!', 480, 312, { size: 24, color: P.blueDeep, weight: 800 });
        D.text(g, 'Score: ' + this.score, 480, 350, { size: 22, color: '#c98a1f', weight: 800 });
      }
    },

    /* ----- scene art (self-contained backyard) ----- */
    drawBackyard(g) {
      // sky band
      const sky = g.createLinearGradient(0, 0, 0, 250);
      sky.addColorStop(0, '#cdecff');
      sky.addColorStop(1, '#eaf7ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, CM.W, 250);

      // sun
      D.circle(g, 858, 70, 40, 'rgba(255,233,168,0.85)');
      D.circle(g, 858, 70, 28, '#ffe9a8');

      // fluffy clouds (gentle drift)
      this.cloud(g, 130 + Math.sin(CM.time * 0.18) * 16, 70, 1.1);
      this.cloud(g, 540 + Math.cos(CM.time * 0.14) * 14, 50, 0.85);
      this.cloud(g, 700 + Math.sin(CM.time * 0.16 + 2) * 12, 110, 0.7);

      // grass field
      const grass = g.createLinearGradient(0, 230, 0, CM.H);
      grass.addColorStop(0, '#bdeccd');
      grass.addColorStop(1, '#9fdfb3');
      g.fillStyle = grass;
      g.fillRect(0, 230, CM.W, CM.H - 230);
      // hill rise
      g.fillStyle = '#c7f0d6';
      g.beginPath();
      g.moveTo(0, 250);
      g.quadraticCurveTo(480, 214, 960, 252);
      g.lineTo(960, 280);
      g.lineTo(0, 280);
      g.closePath();
      g.fill();

      // wooden fence across the grass line
      this.drawFence(g, 236);

      // flowers dotted on the grass
      const fl = [[70, 470], [150, 540], [820, 470], [900, 552], [30, 360], [930, 360]];
      const cols = [P.pink, P.yellow, P.lavender, P.pinkDeep];
      for (let i = 0; i < fl.length; i++) this.flower(g, fl[i][0], fl[i][1], cols[i % cols.length]);
    },

    cloud(g, x, y, s) {
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.beginPath();
      g.ellipse(x, y, 34 * s, 22 * s, 0, 0, Math.PI * 2);
      g.ellipse(x + 30 * s, y + 4 * s, 26 * s, 18 * s, 0, 0, Math.PI * 2);
      g.ellipse(x - 30 * s, y + 5 * s, 24 * s, 16 * s, 0, 0, Math.PI * 2);
      g.fill();
    },

    drawFence(g, y) {
      const railY = y - 26;
      // rails
      g.fillStyle = '#e8c39a';
      g.fillRect(0, railY, CM.W, 9);
      g.fillRect(0, railY + 20, CM.W, 9);
      // posts
      for (let x = 16; x < CM.W; x += 78) {
        D.rr(g, x, y - 44, 22, 56, 5, '#e8c39a', '#cda071', 2);
        // pointy cap
        g.fillStyle = '#e8c39a';
        g.beginPath();
        g.moveTo(x - 1, y - 44);
        g.lineTo(x + 11, y - 54);
        g.lineTo(x + 23, y - 44);
        g.closePath();
        g.fill();
        g.strokeStyle = '#cda071'; g.lineWidth = 2; g.stroke();
      }
    },

    flower(g, x, y, c) {
      g.strokeStyle = '#6cc185'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 16); g.stroke();
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        D.circle(g, x + Math.cos(a) * 6, (y - 18) + Math.sin(a) * 6, 4, c);
      }
      D.circle(g, x, y - 18, 3.2, '#fff7d0');
    },

    drawStage(g) {
      // a little colourful stage rug the two stand on
      D.ellipse(g, 460, 408, 320, 56, 'rgba(255,255,255,0.5)');
      // bunting banner between two posts up top
      const cols = [P.pink, P.blue, P.yellow, P.mint, P.lavender];
      const bx = 220, bw = 520;
      g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(bx, 32); g.quadraticCurveTo(480, 50, bx + bw, 32); g.stroke();
      for (let i = 0; i * 48 < bw; i++) {
        const fx = bx + i * 48;
        const dip = Math.sin((fx - bx) / bw * Math.PI) * 10;
        g.fillStyle = cols[i % cols.length];
        g.beginPath();
        g.moveTo(fx, 34 + dip);
        g.lineTo(fx + 48, 34 + dip);
        g.lineTo(fx + 24, 60 + dip);
        g.closePath();
        g.fill();
      }
      // a wooden sign
      D.rr(g, 372, 150, 216, 38, 12, 'rgba(255,255,255,0.92)', '#bfe1f5', 2.5);
      D.text(g, '☁ FOLLOW THE LEADER ☁', 480, 169, { size: 15, color: P.blueDeep, weight: 800 });
    },

    // pose offsets for a move animation; t = 0..1
    moveAnim(m, t) {
      // returns { dy, rot, scaleX, armUp }
      const e = Math.sin(t * Math.PI); // 0..1..0 ease
      if (m === 0) return { dy: -38 * e, rot: 0, sx: 1, hop: e };           // JUMP
      if (m === 1) return { dy: -6 * e, rot: t * Math.PI * 2, sx: 1, hop: 0 }; // SPIN
      if (m === 2) return { dy: -4 * e, rot: 0, sx: 1, hop: 0, clap: e };   // CLAP
      return { dy: -2 * e, rot: Math.sin(t * Math.PI * 4) * 0.22, sx: 1, hop: 0 }; // WIGGLE
    },

    drawLeader(g) {
      const acting = this.actor === 'leader' && this.actMove >= 0;
      const a = acting ? this.moveAnim(this.actMove, this.actT) : { dy: 0, rot: 0, sx: 1, hop: 0 };
      // idle gentle bob otherwise
      const idleBob = acting ? 0 : ((CM.time * 1.1) % 1) * 0.4;
      g.save();
      g.translate(LEADER.x, LEADER.y + a.dy);
      if (a.rot) {
        D.shadow(g, 0, -a.dy, 26);
        g.rotate(a.rot);
        CM.drawFriend(g, 'cinnamoroll', 0, 0, 1.25, { shadow: false });
      } else {
        CM.drawFriend(g, 'cinnamoroll', 0, 0, 1.25, { bob: idleBob });
      }
      g.restore();
      // clap sparkle hands hint
      if (acting && this.actMove === 2 && a.clap > 0.4) {
        D.star(g, LEADER.x - 30, LEADER.y - 80, 6, '#fff');
        D.star(g, LEADER.x + 30, LEADER.y - 80, 6, '#fff');
      }
      // "LEADER" tag
      D.rr(g, LEADER.x - 40, LEADER.y + 6, 80, 22, 11, 'rgba(255,255,255,0.85)', '#bfe1f5', 2);
      D.text(g, 'Leader', LEADER.x, LEADER.y + 17, { size: 14, color: P.blueDeep, weight: 800 });
    },

    drawThePlayer(g) {
      const acting = this.actor === 'player' && this.actMove >= 0;
      const a = acting ? this.moveAnim(this.actMove, this.actT) : { dy: 0, rot: 0, sx: 1, hop: 0 };
      g.save();
      g.translate(PLAYER.x, PLAYER.y + a.dy);
      if (a.rot) {
        D.shadow(g, 0, -a.dy, 19);
        g.rotate(a.rot);
      }
      CM.drawPlayer(g, 0, 0, 1.12, 'down', 0); // standing; the move plays via translate/rotate
      g.restore();
      if (acting && this.actMove === 2 && a.clap > 0.4) {
        D.star(g, PLAYER.x - 26, PLAYER.y - 74, 5, '#fff');
        D.star(g, PLAYER.x + 26, PLAYER.y - 74, 5, '#fff');
      }
      // "YOU" tag
      D.rr(g, PLAYER.x - 34, PLAYER.y + 6, 68, 22, 11, 'rgba(255,255,255,0.85)', '#ffd9e8', 2);
      D.text(g, 'You', PLAYER.x, PLAYER.y + 17, { size: 14, color: P.pinkDeep, weight: 800 });
    },

    drawRoundTracker(g) {
      const n = this.seq.length;
      const dotR = 9, gap = 26;
      const totalW = (n - 1) * gap;
      const cx = 480;
      const startX = cx - totalW / 2;
      D.rr(g, cx - Math.max(70, totalW / 2 + 24), 86, Math.max(140, totalW + 48), 34, 16,
        'rgba(255,255,255,0.85)', '#bfe1f5', 2);
      D.text(g, 'Round ' + this.round, cx, 73, { size: 14, color: P.blueDeep, weight: 800 });
      for (let i = 0; i < n; i++) {
        const x = startX + i * gap;
        let fill = 'rgba(255,255,255,0.6)';
        let stroke = MOVES[this.seq[i]].deep;
        if (this.state === 'demo' && this.demoPhase === 'flash' && i === this.demoIdx) {
          fill = MOVES[this.seq[i]].fill;
        } else if (this.state === 'demo' && i < this.demoIdx) {
          fill = MOVES[this.seq[i]].fill;
        } else if (this.state === 'input' && i < this.inputIdx) {
          fill = MOVES[this.seq[i]].fill;
        }
        D.circle(g, x, 103, dotR, fill, stroke, 2.5);
      }
    },

    drawButtons(g) {
      const interactive = this.state === 'input';
      for (let i = 0; i < 4; i++) {
        const r = btnRect(i);
        const mv = MOVES[i];
        const lit = this.flashMove === i && this.flashT > 0;
        const m = CM.input.mouse;
        const hover = interactive && m.x >= r.x && m.x <= r.x + r.w && m.y >= r.y && m.y <= r.y + r.h;
        const press = (hover && m.down) ? 2 : 0;
        const pop = lit ? 4 : 0;

        // drop shadow
        D.rr(g, r.x, r.y + 5, r.w, r.h, 18, 'rgba(60,80,110,0.18)');
        // body (brighten when lit)
        D.rr(g, r.x, r.y + press - pop, r.w, r.h, 18, lit ? mv.fill : mv.fill);
        if (lit) {
          D.rr(g, r.x, r.y + press - pop, r.w, r.h, 18, 'rgba(255,255,255,0.45)');
        } else if (hover) {
          D.rr(g, r.x, r.y + press, r.w, r.h, 18, 'rgba(255,255,255,0.16)');
        }
        // outline
        D.rr(g, r.x, r.y + press - pop, r.w, r.h, 18, null, lit ? '#fff' : mv.deep, lit ? 4 : 3);

        const cy = r.y + r.h / 2 + press - pop;
        // icon + label
        D.text(g, mv.icon, r.x + 40, cy, { size: 34, color: mv.deep });
        D.text(g, mv.key, r.x + r.w / 2 + 16, cy, { size: 24, color: '#fff', weight: 800, stroke: mv.deep, strokeWidth: 5 });
        // little keyboard hint number
        if (!CM.touchMode) {
          D.circle(g, r.x + r.w - 18, r.y + 16, 11, 'rgba(255,255,255,0.85)');
          D.text(g, String(i + 1), r.x + r.w - 18, r.y + 16, { size: 14, color: mv.deep, weight: 800 });
        }
        // dim non-interactive buttons slightly so it's clear it's "watch" time
        if (!interactive && !lit) {
          D.rr(g, r.x, r.y + press, r.w, r.h, 18, 'rgba(120,140,160,0.16)');
        }
      }
    },

    drawParts(g) {
      for (const pt of this.parts) {
        g.globalAlpha = CM.clamp(pt.life / pt.maxLife, 0, 1);
        if (pt.type === 'star') D.star(g, pt.x, pt.y, pt.size, pt.color, pt.rot);
        else if (pt.type === 'heart') D.heart(g, pt.x, pt.y, pt.size, pt.color);
        else D.circle(g, pt.x, pt.y, pt.size * 0.5, pt.color);
      }
      g.globalAlpha = 1;
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(60,100,140,0.32)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 210, 96, 540, 392, { title: '☁ Follow the Leader ☁' });
      CM.drawFriend(g, 'cinnamoroll', 300, 388, 1.3, { bob: ((CM.time * 1.2) % 1) * 0.5 });
      D.bubble(g, 232, 150, 150, 38, 300);
      D.text(g, 'Copy my moves!', 307, 169, { size: 14, color: P.blueDeep, weight: 800 });

      D.text(g, '1. Watch Cinnamoroll dance', 560, 178, { size: 18, color: P.ink, weight: 700 });
      D.text(g, '2. Then do the same moves', 560, 216, { size: 18, color: P.ink, weight: 700 });
      D.text(g, '   in the same order!', 560, 240, { size: 18, color: P.ink, weight: 700 });
      D.text(g, '3. Each round adds one more!', 560, 278, { size: 18, color: P.ink, weight: 700 });

      // mini move legend
      for (let i = 0; i < 4; i++) {
        const x = 320 + i * 100;
        D.rr(g, x - 46, 312, 92, 40, 12, MOVES[i].fill, MOVES[i].deep, 2.5);
        D.text(g, MOVES[i].icon, x - 24, 332, { size: 20, color: MOVES[i].deep });
        D.text(g, MOVES[i].key, x + 12, 332, { size: 14, color: '#fff', weight: 800, stroke: MOVES[i].deep, strokeWidth: 3 });
      }
      D.text(g, "Don't worry — you can always watch again!", 480, 372, { size: 14, color: '#7fa8c0', weight: 700 });

      if (CM.ui.button(g, 380, 396, 200, 56, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.startDemo(false);
        return;
      }
      if (!CM.touchMode) {
        D.text(g, 'or press SPACE', 480, 470, { size: 14, color: '#7fa8c0' });
      }
    }
  });
})();
