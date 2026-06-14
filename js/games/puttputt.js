/* Cinnamoroll Mansion — Putt-Putt (hosted by Pompompurin) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------------- course geometry ----------------
     The green is a rounded rectangle play area. Ball, walls and hole all
     live in screen-space (top-down). Keep everything inside GREEN. */
  const GREEN = { x: 120, y: 150, w: 720, h: 408 };
  const BALL_R = 11;
  const HOLE_R = 19;            // generous so kids actually sink putts
  const SINK_SPEED = 165;       // forgiving: ball can be moving fairly fast and still drop
  const FRICTION = 0.86;        // per-second velocity multiplier (rolling resistance)
  const STOP_SPEED = 9;         // below this the ball is "stopped"
  const MAX_POWER = 560;        // cap on putt speed
  const DRAG_FULL = 150;        // drag distance (px) that gives full power
  const WALL_BOUNCE = 0.72;     // energy kept after a wall bounce
  const MAX_PARTS = 90;

  const PURIN = { x: 70, y: 330 };  // host cheering on the left

  // Three holes. Each: tee (start), hole (target), and a list of bumper walls
  // (rounded rects the ball bounces off). All coords are screen-space.
  const HOLES = [
    {
      par: 2,
      tee: { x: 230, y: 460 },
      cup: { x: 740, y: 230 },
      walls: [
        { x: 360, y: 300, w: 40, h: 170, r: 16, c: '#f0b9d2' },
        { x: 520, y: 150, w: 40, h: 190, r: 16, c: '#b6e2c7' }
      ]
    },
    {
      par: 3,
      tee: { x: 200, y: 250 },
      cup: { x: 760, y: 420 },
      walls: [
        { x: 340, y: 150, w: 44, h: 240, r: 18, c: '#bfe0f5' },
        { x: 540, y: 280, w: 44, h: 278, r: 18, c: '#f4d79a' },
        { x: 620, y: 230, w: 160, h: 40, r: 18, c: '#d8c9f2' }
      ]
    },
    {
      par: 3,
      tee: { x: 480, y: 500 },
      cup: { x: 480, y: 210 },
      walls: [
        { x: 300, y: 300, w: 200, h: 40, r: 18, c: '#f6c4d6' },
        { x: 460, y: 300, w: 200, h: 40, r: 18, c: '#f6c4d6' },
        { x: 200, y: 150, w: 40, h: 200, r: 16, c: '#b6e2c7' },
        { x: 720, y: 150, w: 40, h: 200, r: 16, c: '#b6e2c7' }
      ]
    }
  ];

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'puttputt',
    name: 'Putt-Putt',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';      // howto -> play -> sunk -> (next hole) -> done -> finish
      this.holeIdx = 0;
      this.strokes = 0;
      this.score = 0;
      this.finished = false;

      this.ball = { x: 0, y: 0, vx: 0, vy: 0, moving: false };
      this.sunkAnim = 0;         // 0..1 ball shrinking into the cup
      this.lastHolePts = 0;

      // aim / drag state
      this.dragging = false;
      this.prevDown = false;     // mouse.down on the previous frame (edge detect)
      this.aimAngle = -Math.PI / 4; // keyboard aim direction (where the ball will go)
      this.kbPower = 0.55;       // keyboard power 0..1
      this.dragDir = { x: 1, y: 0 };
      this.dragPower = 0;        // 0..1 current drag power (for the arrow)

      // juice
      this.parts = [];
      this.shk = { t: 0, dur: 1, mag: 0 };
      this.msg = '';
      this.bigMsg = '';
      this.sunkT = 0;
      this.doneT = 0;
      this.hostBubble = { text: '', t: 0 };
      this.hostHappy = 0;
      this.flagPhase = CM.rand(0, 6);

      this.setupHole();
    },

    exit() {},

    /* ================= setup ================= */
    setupHole() {
      const h = HOLES[this.holeIdx];
      this.strokes = 0;
      this.sunkAnim = 0;
      this.ball.x = h.tee.x;
      this.ball.y = h.tee.y;
      this.ball.vx = 0;
      this.ball.vy = 0;
      this.ball.moving = false;
      this.dragging = false;
      this.dragPower = 0;
      // point the keyboard aim roughly toward the cup to start
      this.aimAngle = Math.atan2(h.cup.y - h.tee.y, h.cup.x - h.tee.x);
      this.msg = '';
      this.bigMsg = '';
    },

    /* ================= update ================= */
    update(dt) {
      if (this.shk.t > 0) this.shk.t -= dt;
      if (this.hostBubble.t > 0) this.hostBubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      this.updateParts(dt);
      this.flagPhase += dt;

      // edge detection for press / release (drag-to-shoot)
      const down = CM.input.mouse.down;
      const pressedEdge = down && !this.prevDown;
      const releasedEdge = !down && this.prevDown;

      switch (this.state) {
        case 'howto':
          // Start button is handled in draw(); also start on the action key.
          if (CM.input.pressed('action')) this.beginPlay();
          break;

        case 'play':
          this.updatePlay(dt, down, pressedEdge, releasedEdge);
          break;

        case 'sunk':
          this.sunkT -= dt;
          if (this.sunkAnim < 1) this.sunkAnim = Math.min(1, this.sunkAnim + dt * 3.2);
          if (this.sunkT <= 0) this.advanceHole();
          break;

        case 'done':
          // sprinkle a little ongoing confetti, then finish exactly once
          if (this.parts.length < 55 && Math.random() < 0.3) {
            this.spawnConfetti(CM.rand(160, 800), CM.rand(150, 320));
          }
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            const coins = CM.clamp(Math.ceil(this.score / 14), 5, 30);
            CM.finishGame('puttputt', this.score, coins);
          }
          break;
      }

      this.prevDown = down;
    },

    updatePlay(dt, down, pressedEdge, releasedEdge) {
      const b = this.ball;

      if (b.moving) {
        // roll with friction (frame-rate independent decay)
        const decay = Math.pow(FRICTION, dt);
        b.vx *= decay;
        b.vy *= decay;
        b.x += b.vx * dt;
        b.y += b.vy * dt;

        this.bounceWalls();
        this.bounceBoundary();

        // sink check — generous radius + forgiving speed
        const h = HOLES[this.holeIdx];
        const dHole = CM.dist(b.x, b.y, h.cup.x, h.cup.y);
        const spd = Math.hypot(b.vx, b.vy);
        if (dHole < HOLE_R + 2 && spd < SINK_SPEED) {
          this.sinkBall();
          return;
        }
        // a near-miss that rims the cup gets a gentle pull (helps kids)
        if (dHole > 0.001 && dHole < HOLE_R + 16 && spd < SINK_SPEED * 1.4) {
          const pull = 240 * dt;
          b.vx += ((h.cup.x - b.x) / dHole) * pull;
          b.vy += ((h.cup.y - b.y) / dHole) * pull;
        }

        if (spd < STOP_SPEED) {
          b.vx = 0; b.vy = 0; b.moving = false;
        }
        return;
      }

      // ----- ball is at rest: aim & shoot -----
      const m = CM.input.mouse;

      // DRAG (primary): press anywhere starts the pull-back
      if (pressedEdge && CM.dist(m.x, m.y, b.x, b.y) < 70) {
        this.dragging = true;
        CM.audio.play('click');
      }
      if (this.dragging && down) {
        // pull back from the ball: shot direction points FROM cursor TO ball
        const dx = b.x - m.x;
        const dy = b.y - m.y;
        const len = Math.hypot(dx, dy);
        if (len > 4) {
          this.dragDir = { x: dx / len, y: dy / len };
          this.aimAngle = Math.atan2(dy, dx);
        }
        this.dragPower = CM.clamp(len / DRAG_FULL, 0, 1);
      }
      if (this.dragging && releasedEdge) {
        this.dragging = false;
        if (this.dragPower > 0.06) {
          this.putt(this.dragDir.x, this.dragDir.y, this.dragPower);
        }
        this.dragPower = 0;
      }

      // KEYBOARD fallback: rotate aim, set power, action to putt
      if (!this.dragging) {
        const ax = CM.input.axisX();
        const ay = CM.input.axisY();
        if (CM.input.down('left')) this.aimAngle -= 1.8 * dt;
        if (CM.input.down('right')) this.aimAngle += 1.8 * dt;
        if (CM.input.down('up')) this.kbPower = CM.clamp(this.kbPower + 0.7 * dt, 0.08, 1);
        if (CM.input.down('down')) this.kbPower = CM.clamp(this.kbPower - 0.7 * dt, 0.08, 1);
        // (axisX/axisY also nudge so WASD works on the meter naturally)
        void ax; void ay;
        if (CM.input.pressed('action')) {
          this.putt(Math.cos(this.aimAngle), Math.sin(this.aimAngle), this.kbPower);
        }
      }
    },

    putt(dirx, diry, power) {
      power = CM.clamp(power, 0, 1);
      const speed = MAX_POWER * power;
      this.ball.vx = dirx * speed;
      this.ball.vy = diry * speed;
      this.ball.moving = true;
      this.strokes++;
      CM.audio.play('whoosh');
      CM.audio.tone(360, 0.08, 'sine', 0.08, 0, 560);
    },

    /* ----- collisions ----- */
    bounceBoundary() {
      const b = this.ball;
      const x1 = GREEN.x + BALL_R, x2 = GREEN.x + GREEN.w - BALL_R;
      const y1 = GREEN.y + BALL_R, y2 = GREEN.y + GREEN.h - BALL_R;
      let hit = false;
      if (b.x < x1) { b.x = x1; b.vx = Math.abs(b.vx) * WALL_BOUNCE; hit = true; }
      else if (b.x > x2) { b.x = x2; b.vx = -Math.abs(b.vx) * WALL_BOUNCE; hit = true; }
      if (b.y < y1) { b.y = y1; b.vy = Math.abs(b.vy) * WALL_BOUNCE; hit = true; }
      else if (b.y > y2) { b.y = y2; b.vy = -Math.abs(b.vy) * WALL_BOUNCE; hit = true; }
      if (hit && Math.hypot(b.vx, b.vy) > 40) CM.audio.play('boing');
    },

    bounceWalls() {
      const b = this.ball;
      const walls = HOLES[this.holeIdx].walls;
      for (const w of walls) {
        // closest point on the rect to the ball
        const cx = CM.clamp(b.x, w.x, w.x + w.w);
        const cy = CM.clamp(b.y, w.y, w.y + w.h);
        const dx = b.x - cx;
        const dy = b.y - cy;
        const d2 = dx * dx + dy * dy;
        if (d2 < BALL_R * BALL_R) {
          let nx, ny, dist;
          if (d2 > 0.0001) {
            dist = Math.sqrt(d2);
            nx = dx / dist; ny = dy / dist;
          } else {
            // ball center inside the rect — push out along the nearest edge
            const left = b.x - w.x, right = w.x + w.w - b.x;
            const top = b.y - w.y, bottom = w.y + w.h - b.y;
            const mn = Math.min(left, right, top, bottom);
            if (mn === left) { nx = -1; ny = 0; }
            else if (mn === right) { nx = 1; ny = 0; }
            else if (mn === top) { nx = 0; ny = -1; }
            else { nx = 0; ny = 1; }
            dist = 0;
          }
          // reposition outside the wall
          b.x = cx + nx * BALL_R;
          b.y = cy + ny * BALL_R;
          // reflect velocity about the normal
          const vdot = b.vx * nx + b.vy * ny;
          if (vdot < 0) {
            b.vx = (b.vx - 2 * vdot * nx) * WALL_BOUNCE;
            b.vy = (b.vy - 2 * vdot * ny) * WALL_BOUNCE;
            if (Math.hypot(b.vx, b.vy) > 40) CM.audio.play('boing');
          }
        }
      }
    },

    /* ----- sinking + scoring ----- */
    sinkBall() {
      const b = this.ball;
      b.vx = 0; b.vy = 0; b.moving = false;
      // pts = max(20, 120 - 25*(strokes-1)) — hole-in-one is best
      const pts = Math.max(20, 120 - 25 * (this.strokes - 1));
      this.lastHolePts = pts;
      this.score += pts;

      this.state = 'sunk';
      this.sunkAnim = 0;
      this.doShake(0.4, 7);
      this.celebrate(22);

      if (this.strokes === 1) {
        this.bigMsg = 'HOLE IN ONE!';
        this.msg = 'Hole in one!! Wow!!';
        CM.audio.play('tada');
        this.say('HOLE IN ONE!! ✨', 2.2);
      } else if (this.strokes <= HOLES[this.holeIdx].par) {
        this.bigMsg = 'NICE PUTT!';
        this.msg = 'Great putt!';
        CM.audio.play('cheer');
        this.say('Nice putt!', 1.8);
      } else if (this.strokes <= HOLES[this.holeIdx].par + 2) {
        this.bigMsg = 'SUNK IT!';
        this.msg = 'You sank it!';
        CM.audio.play('ding');
        this.say('You did it!', 1.6);
      } else {
        this.bigMsg = 'PHEW!';
        this.msg = 'Almost gave up — got it!';
        CM.audio.play('ding');
        this.say('Phew! Got there!', 1.6);
      }
      CM.audio.play('coin');
      this.sunkT = (this.strokes === 1) ? 2.2 : 1.8;
    },

    advanceHole() {
      if (this.holeIdx >= HOLES.length - 1) {
        this.state = 'done';
        this.doneT = 1.8;
        this.doShake(0.4, 6);
        CM.audio.play('tada');
        return;
      }
      this.holeIdx++;
      this.setupHole();
      this.state = 'play';
      this.say('Next hole!', 1.4);
    },

    beginPlay() {
      this.state = 'play';
      this.say('Pull back to putt!', 2.4);
    },

    /* ================= juice ================= */
    doShake(t, mag) { this.shk = { t: t, dur: t, mag: mag }; },

    say(text, t) {
      this.hostBubble = { text: text, t: t };
      this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    spawnPart(pt) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      pt.maxLife = pt.life;
      this.parts.push(pt);
    },

    celebrate(n) {
      const cx = HOLES[this.holeIdx].cup.x;
      const cy = HOLES[this.holeIdx].cup.y;
      for (let i = 0; i < n; i++) {
        this.spawnPart({
          x: cx + CM.rand(-30, 30), y: cy + CM.rand(-20, 10),
          vx: CM.rand(-120, 120), vy: CM.rand(-220, -50),
          life: CM.rand(0.6, 1.25),
          type: Math.random() < 0.5 ? 'star' : 'heart',
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep]),
          size: CM.rand(7, 13), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
        });
      }
    },

    spawnConfetti(x, y) {
      this.spawnPart({
        x: x, y: y,
        vx: CM.rand(-40, 40), vy: CM.rand(-60, -10),
        life: CM.rand(0.7, 1.3),
        type: Math.random() < 0.5 ? 'star' : 'spark',
        color: CM.pick([P.pink, P.blue, P.yellow, P.mint, P.lavender]),
        size: CM.rand(5, 11), rot: CM.rand(0, 6), vr: CM.rand(-4, 4)
      });
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

    /* ================= draw ================= */
    draw(g) {
      g.save();
      if (this.shk.t > 0) {
        const m = this.shk.mag * (this.shk.t / this.shk.dur);
        g.translate(CM.rand(-m, m), CM.rand(-m, m));
      }

      this.drawBackdrop(g);
      this.drawCourse(g);

      // host (Pompompurin) cheering on the left, near the tee
      const happy = this.hostHappy > 0 || this.state === 'sunk' || this.state === 'done';
      CM.drawFriend(g, 'pompompurin', PURIN.x, PURIN.y, 1.12, {
        bob: happy ? (CM.time * 2.4) % 1 : ((CM.time * 0.9) % 1) * 0.4
      });
      D.rr(g, PURIN.x - 50, PURIN.y + 6, 100, 19, 9, 'rgba(255,255,255,0.85)');
      D.text(g, 'Pompompurin', PURIN.x, PURIN.y + 16, { size: 14, color: P.ink, weight: 800 });

      // aim helpers + ball + player
      this.drawAim(g);
      this.drawBall(g);
      this.drawPlayer(g);

      this.drawParts(g);
      g.restore(); // end shake

      /* ---- HUD (not shaken) ---- */
      this.drawHUD(g);

      // host speech bubble on good moments
      if (this.hostBubble.t > 0 && this.state !== 'howto') {
        const txt = this.hostBubble.text;
        const cw = Math.max(110, txt.length * 9 + 28);
        const bx = CM.clamp(PURIN.x - 12, 8, CM.W - cw - 8);
        D.bubble(g, bx, PURIN.y - 150, cw, 40, PURIN.x + 16);
        D.text(g, txt, bx + cw / 2, PURIN.y - 130, { size: 15, weight: 800, color: P.pinkDeep });
      }

      // big banner when sunk
      if (this.state === 'sunk' && this.bigMsg) {
        const el = ((this.strokes === 1 ? 2.2 : 1.8) - this.sunkT);
        const sc = Math.min(1, el * 4);
        D.text(g, this.bigMsg, 480, 300, {
          size: 26 + 40 * sc, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
        });
        D.text(g, '+' + this.lastHolePts + ' points', 480, 350, {
          size: 24, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6
        });
        D.star(g, 332, 300, 18, P.yellowDeep, CM.time * 2.5);
        D.star(g, 628, 300, 18, P.yellowDeep, -CM.time * 2.5);
      }

      // hint bar during play
      if (this.state === 'play' && !this.ball.moving && CM.sceneTime < 90) {
        let hint;
        if (this.dragging) hint = 'Pull back and let go to putt!';
        else hint = CM.touchMode ? 'Drag back from the ball, then release to putt!'
          : 'Drag back from the ball (or arrows + SPACE) to putt!';
        D.rr(g, 240, 568, 480, 26, 13, 'rgba(255,255,255,0.78)');
        D.text(g, hint, 480, 581, { size: 14, color: P.pinkDeep, weight: 800 });
      }

      if (this.state === 'howto') this.drawHowto(g);
      if (this.state === 'done') {
        g.fillStyle = 'rgba(255,255,255,0.35)';
        g.fillRect(0, 0, CM.W, CM.H);
        D.text(g, 'Round complete!!', 480, 268, {
          size: 50, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 10
        });
        D.text(g, 'Total score: ' + this.score, 480, 330, {
          size: 30, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6
        });
        D.star(g, 250, 250 + Math.sin(CM.time * 5) * 6, 16, P.yellowDeep);
        D.star(g, 710, 250 + Math.cos(CM.time * 5) * 6, 16, P.yellowDeep);
      }
    },

    /* ---------------- backyard backdrop ---------------- */
    drawBackdrop(g) {
      // sky band across the top
      const sg = g.createLinearGradient(0, 0, 0, 150);
      sg.addColorStop(0, '#d6f0ff');
      sg.addColorStop(1, '#bfe7ff');
      g.fillStyle = sg;
      g.fillRect(0, 0, CM.W, 150);

      // sun
      D.circle(g, 132, 70, 26, '#fff3b0');
      D.circle(g, 132, 70, 20, '#ffe07a');

      // fluffy clouds
      this.drawCloud(g, 360, 56, 1.0);
      this.drawCloud(g, 690, 80, 0.78);

      // grass field below the sky
      const gg = g.createLinearGradient(0, 130, 0, CM.H);
      gg.addColorStop(0, '#b6e3a0');
      gg.addColorStop(1, '#cdeeb6');
      g.fillStyle = gg;
      g.fillRect(0, 130, CM.W, CM.H - 130);

      // wooden fence along the sky/grass line
      const fenceY = 118;
      g.fillStyle = '#e8c39a';
      g.fillRect(0, fenceY, CM.W, 20);
      g.strokeStyle = 'rgba(138,90,59,0.35)';
      g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, fenceY + 6); g.lineTo(CM.W, fenceY + 6); g.stroke();
      for (let x = 8; x < CM.W; x += 46) {
        D.rr(g, x, fenceY - 16, 30, 36, 4, '#eecaa2', '#cda878', 2);
        // pointed picket top
        g.fillStyle = '#eecaa2';
        g.beginPath();
        g.moveTo(x, fenceY - 16); g.lineTo(x + 15, fenceY - 28); g.lineTo(x + 30, fenceY - 16);
        g.closePath(); g.fill();
        g.strokeStyle = '#cda878'; g.lineWidth = 2; g.stroke();
      }

      // a few cheerful flowers tucked along the grass edges
      this.drawFlower(g, 60, 150, '#ff9ec7');
      this.drawFlower(g, 905, 165, '#ffe07a');
      this.drawFlower(g, 902, 540, '#d8c9f2');
      this.drawFlower(g, 56, 540, '#8ecdf6');
    },

    drawCloud(g, x, y, s) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      D.ellipse(g, -26, 6, 24, 18, 'rgba(255,255,255,0.92)');
      D.ellipse(g, 0, -4, 30, 24, 'rgba(255,255,255,0.92)');
      D.ellipse(g, 28, 6, 26, 19, 'rgba(255,255,255,0.92)');
      D.rr(g, -50, 6, 100, 18, 9, 'rgba(255,255,255,0.92)');
      g.restore();
    },

    drawFlower(g, x, y, color) {
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        D.circle(g, x + Math.cos(a) * 6, y + Math.sin(a) * 6, 5, color);
      }
      D.circle(g, x, y, 4, '#fff3b0');
    },

    /* ---------------- the mini-golf course ---------------- */
    drawCourse(g) {
      const h = HOLES[this.holeIdx];

      // soft shadow under the green
      D.rr(g, GREEN.x + 5, GREEN.y + 8, GREEN.w, GREEN.h, 30, 'rgba(60,90,50,0.18)');

      // the green play area
      const grad = g.createLinearGradient(0, GREEN.y, 0, GREEN.y + GREEN.h);
      grad.addColorStop(0, '#86d281');
      grad.addColorStop(1, '#74c870');
      D.rr(g, GREEN.x, GREEN.y, GREEN.w, GREEN.h, 30, grad, '#5fb15c', 5);

      // mowed stripes
      g.save();
      D.rrPath(g, GREEN.x, GREEN.y, GREEN.w, GREEN.h, 30);
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.06)';
      for (let i = 0; i < GREEN.w; i += 96) {
        g.fillRect(GREEN.x + i, GREEN.y, 48, GREEN.h);
      }
      // tee mat
      D.rr(g, h.tee.x - 26, h.tee.y - 18, 52, 36, 8, 'rgba(120,90,60,0.28)');
      D.rr(g, h.tee.x - 22, h.tee.y - 14, 44, 28, 6, '#b6e2a6', 'rgba(90,150,80,0.5)', 2);
      g.restore();

      // bumper walls (rounded rects the ball bounces off)
      for (const w of h.walls) {
        D.rr(g, w.x + 3, w.y + 5, w.w, w.h, w.r, 'rgba(50,80,45,0.18)'); // shadow
        D.rr(g, w.x, w.y, w.w, w.h, w.r, w.c, '#ffffff', 3);
        // glossy highlight
        D.rr(g, w.x + 4, w.y + 4, Math.max(4, w.w - 8), Math.max(4, w.h * 0.35), w.r * 0.6,
          'rgba(255,255,255,0.35)');
      }

      // the hole (dark cup) with a little flag
      this.drawCup(g, h.cup.x, h.cup.y);
    },

    drawCup(g, x, y) {
      // cup rim + dark hole
      D.ellipse(g, x, y, HOLE_R + 3, (HOLE_R + 3) * 0.78, '#3a5a36');
      D.ellipse(g, x, y, HOLE_R, HOLE_R * 0.74, '#22331f');
      D.ellipse(g, x, y - 2, HOLE_R - 4, (HOLE_R - 4) * 0.6, '#16240f');

      // flag pole + wavy flag (skip while the banner covers the cup area? keep it cute)
      const sway = Math.sin(this.flagPhase * 2.2) * 4;
      const poleTopY = y - 64;
      g.strokeStyle = '#8a5a3b';
      g.lineWidth = 4;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(x, y - 4);
      g.lineTo(x, poleTopY);
      g.stroke();
      D.circle(g, x, poleTopY, 3, '#f2b53c');
      // triangular pennant
      g.fillStyle = P.pinkDeep;
      g.beginPath();
      g.moveTo(x + 2, poleTopY + 2);
      g.quadraticCurveTo(x + 24 + sway, poleTopY + 8, x + 30 + sway, poleTopY + 14);
      g.lineTo(x + 2, poleTopY + 22);
      g.closePath();
      g.fill();
      g.strokeStyle = '#fff';
      g.lineWidth = 1.5;
      g.stroke();
    },

    /* ---------------- aim visualization ---------------- */
    drawAim(g) {
      if (this.state !== 'play' || this.ball.moving) return;
      const b = this.ball;
      let dirx, diry, power;
      if (this.dragging) {
        dirx = this.dragDir.x; diry = this.dragDir.y; power = this.dragPower;
      } else {
        dirx = Math.cos(this.aimAngle); diry = Math.sin(this.aimAngle); power = this.kbPower;
      }
      if (power < 0.04) power = 0.04;

      // dotted aim line projecting the shot direction
      const aimLen = 60 + power * 150;
      g.save();
      g.strokeStyle = 'rgba(240,98,146,0.55)';
      g.lineWidth = 3;
      g.setLineDash([8, 9]);
      g.beginPath();
      g.moveTo(b.x, b.y);
      g.lineTo(b.x + dirx * aimLen, b.y + diry * aimLen);
      g.stroke();
      g.restore();

      // when dragging, also show the pull-back line to the cursor
      if (this.dragging) {
        const m = CM.input.mouse;
        g.save();
        g.strokeStyle = 'rgba(255,255,255,0.7)';
        g.lineWidth = 2.5;
        g.setLineDash([4, 6]);
        g.beginPath();
        g.moveTo(b.x, b.y);
        g.lineTo(m.x, m.y);
        g.stroke();
        g.restore();
      }

      // power arrow from the ball (length + color scale with power)
      const arrowLen = 26 + power * 78;
      const ax = b.x + dirx * arrowLen;
      const ay = b.y + diry * arrowLen;
      const col = power > 0.7 ? P.yellowDeep : (power > 0.4 ? P.pinkDeep : P.mintDeep);
      g.save();
      g.strokeStyle = col;
      g.lineWidth = 6;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(b.x, b.y);
      g.lineTo(ax, ay);
      g.stroke();
      // arrowhead
      const ang = Math.atan2(diry, dirx);
      g.fillStyle = col;
      g.beginPath();
      g.moveTo(ax + Math.cos(ang) * 12, ay + Math.sin(ang) * 12);
      g.lineTo(ax + Math.cos(ang + 2.5) * 13, ay + Math.sin(ang + 2.5) * 13);
      g.lineTo(ax + Math.cos(ang - 2.5) * 13, ay + Math.sin(ang - 2.5) * 13);
      g.closePath();
      g.fill();
      g.restore();
    },

    /* ---------------- the ball ---------------- */
    drawBall(g) {
      const b = this.ball;
      if (this.state === 'done') return;
      let r = BALL_R;
      let alpha = 1;
      if (this.state === 'sunk') {
        // shrink + sink into the cup
        const t = this.sunkAnim;
        r = BALL_R * (1 - 0.85 * t);
        alpha = 1 - 0.55 * t;
      }
      const cy = b.y - r * 0.35;
      D.shadow(g, b.x, b.y + 2, r * 0.95);
      g.save();
      g.globalAlpha = alpha;
      D.circle(g, b.x, cy, r, '#fff', '#e3a7c4', 2);
      // a little pink swirl + shine so it reads as cute
      D.circle(g, b.x, cy, r * 0.5, P.pinkSoft);
      D.circle(g, b.x - r * 0.32, cy - r * 0.34, r * 0.26, 'rgba(255,255,255,0.9)');
      g.restore();
    },

    /* ---------------- the player with a putter ---------------- */
    drawPlayer(g) {
      if (this.state === 'done') return;
      const b = this.ball;
      // stand the kid just behind/below the ball, facing it
      const px = CM.clamp(b.x - 4, GREEN.x + 20, GREEN.x + GREEN.w - 20);
      let py = b.y + 64;
      let facing = 'up';
      // keep the player on screen; if the ball is near the bottom, stand to the side
      if (py > 588) { py = b.y; facing = b.x > GREEN.x + GREEN.w / 2 ? 'left' : 'right'; }
      CM.drawPlayer(g, px, py, 0.92, facing, 0);

      // a simple putter held toward the ball (only when aiming, ball at rest)
      if (this.state === 'play' && !this.ball.moving) {
        g.save();
        g.strokeStyle = '#b9b4bd';
        g.lineWidth = 4;
        g.lineCap = 'round';
        const hx = px + 12, hy = py - 40;
        const tx = b.x + (b.x > px ? -6 : 6), ty = b.y + 10;
        g.beginPath();
        g.moveTo(hx, hy);
        g.lineTo(tx, ty);
        g.stroke();
        // putter head
        D.rr(g, tx - 7, ty - 3, 14, 7, 3, '#8d97a3', '#6f7884', 1.5);
        g.restore();
      }
    },

    /* ---------------- HUD ---------------- */
    drawHUD(g) {
      if (this.state === 'howto') return;
      // hole + strokes (top-left)
      D.rr(g, 14, 12, 172, 62, 14, 'rgba(255,255,255,0.92)', '#f0b9d2', 2);
      D.text(g, 'Hole ' + (this.holeIdx + 1) + '/' + HOLES.length, 100, 32,
        { size: 19, color: P.mintDeep, weight: 800 });
      D.text(g, 'Strokes: ' + this.strokes + '   Par ' + HOLES[this.holeIdx].par, 100, 56,
        { size: 14, color: P.ink, weight: 700 });

      // total score (top-center, away from the engine chrome at the right)
      D.rr(g, 392, 12, 176, 44, 22, 'rgba(255,255,255,0.9)', '#f0b9d2', 3);
      D.coin(g, 416, 34, 12);
      D.text(g, 'Score ' + this.score, 500, 34, { size: 21, color: '#c98a1f', weight: 800 });
    },

    /* ---------------- howto overlay ---------------- */
    drawHowto(g) {
      g.fillStyle = 'rgba(70,40,70,0.3)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 200, 96, 560, 396, { title: '⛳ Putt-Putt with Pompompurin' });
      CM.drawFriend(g, 'pompompurin', 300, 446, 1.28, { bob: ((CM.time * 1.2) % 1) * 0.5 });
      D.text(g, '1. Pull BACK from the ball to aim', 555, 176, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '   — drag away from the hole!', 555, 200, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '2. Let go to putt. Farther pull', 555, 244, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '   = more power!', 555, 268, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '3. Sink the ball in the cup ⛳', 555, 312, { size: 17, color: P.pinkDeep, weight: 800 });
      D.text(g, '3 holes · fewer putts = more points!', 480, 360, { size: 14, color: '#9a8a94' });
      if (CM.ui.button(g, 380, 392, 200, 56, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.beginPlay();
      }
    },

    /* ---------------- particles ---------------- */
    drawParts(g) {
      for (const pt of this.parts) {
        g.globalAlpha = CM.clamp(pt.life / pt.maxLife, 0, 1);
        if (pt.type === 'star') D.star(g, pt.x, pt.y, pt.size, pt.color, pt.rot);
        else if (pt.type === 'heart') D.heart(g, pt.x, pt.y, pt.size, pt.color);
        else {
          g.save();
          g.translate(pt.x, pt.y);
          g.rotate(pt.rot);
          g.fillStyle = pt.color;
          g.fillRect(-pt.size / 2, -pt.size / 2, pt.size, pt.size * 0.6);
          g.restore();
        }
      }
      g.globalAlpha = 1;
    }
  });
})();
