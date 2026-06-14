/* Cinnamoroll Mansion — Baseball (hosted by Pompompurin) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---------- field layout (canvas units, 960x600) ---------- */
  const PITCHES = 10;
  const BATX = 148, BATY = 508;          // batter feet (left, home plate)
  const PITX = 736, PITY = 474;          // pitcher feet (right, mound)
  const HITX = 216, PLATEY = 446;        // contact point over the plate
  const THROWX = PITX - 44, THROWY = 406;
  const FENCEY = 306, GROUNDY = 352;
  const SPEEDS = [330, 405, 480];        // gentle / medium / speedy pitches
  const SPARKLE = ['#ffe9a8', '#ff9ec7', '#8ecdf6', '#f6cf5a', '#bdeccd'];
  const TREES = [
    [70, '#a5dfae', 26], [150, '#8fd6a0', 20], [320, '#a5dfae', 24],
    [470, '#8fd6a0', 18], [690, '#a5dfae', 22], [845, '#8fd6a0', 26], [935, '#a5dfae', 18]
  ];

  function easeOut(t) { t = CM.clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function easeInOut(t) {
    t = CM.clamp(t, 0, 1);
    return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
  }

  /* y of the pitched ball along its gentle arc, by x position */
  function pitchY(x) {
    const pr = (THROWX - x) / (THROWX - HITX);
    return THROWY + (PLATEY - THROWY) * pr - Math.sin(CM.clamp(pr, 0, 1) * Math.PI) * 24;
  }

  /* ---------- little art helpers ---------- */
  function drawBall(g, x, y, r, rot) {
    D.circle(g, x, y, r, '#ffffff', '#d8c8d2', 1.5);
    g.save();
    g.translate(x, y);
    g.rotate(rot || 0);
    g.strokeStyle = '#ef5b5b';
    g.lineWidth = 1.4;
    g.lineCap = 'round';
    g.beginPath(); g.arc(-r * 0.45, 0, r * 0.62, -1.05, 1.05); g.stroke();
    g.beginPath(); g.arc(r * 0.45, 0, r * 0.62, Math.PI - 1.05, Math.PI + 1.05); g.stroke();
    g.restore();
  }

  function batAngle(S) {
    const idle = -2.3;          // resting up behind the head
    const a = S.swingAge;
    if (a < 0.15) return CM.lerp(idle, 0.9, easeOut(a / 0.15));        // the swing!
    if (a < 0.6) return CM.lerp(0.9, idle, easeInOut((a - 0.15) / 0.45)); // recover
    return idle;
  }

  function drawBat(g, angle) {
    const px = BATX + 19, py = BATY - 38;
    g.save();
    g.translate(px, py);
    g.rotate(angle);
    g.fillStyle = '#dcb377';
    g.strokeStyle = '#a87b3f';
    g.lineWidth = 2;
    g.beginPath();
    g.moveTo(-2, -3);
    g.lineTo(34, -5.5);
    g.quadraticCurveTo(58, -7, 58, 0);
    g.quadraticCurveTo(58, 7, 34, 5.5);
    g.lineTo(-2, 3);
    g.closePath();
    g.fill();
    g.stroke();
    D.rr(g, -10, -3.4, 11, 6.8, 3, '#8a5a3b');
    g.restore();
  }

  /* ---------- particles (capped) ---------- */
  function burst(S, x, y, n, kind) {
    for (let i = 0; i < n; i++) {
      if (S.parts.length >= 90) S.parts.shift();
      const a = CM.rand(0, Math.PI * 2);
      const sp = CM.rand(70, kind === 'spark' ? 180 : 320);
      S.parts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 90,
        life: CM.rand(0.5, 1.05),
        kind: kind === 'mix' ? (Math.random() < 0.6 ? 'star' : 'heart') : kind,
        size: CM.rand(6, 13),
        color: CM.pick(SPARKLE),
        rot: CM.rand(0, 7)
      });
    }
  }

  /* ---------- game flow ---------- */
  function startPlay(S) {
    S.state = 'windup';
    S.t = 0;
    S.bubble = 'Here comes the pitch!';
    CM.audio.play('pop');
  }

  function throwBall(S) {
    S.ballHeld = false;
    S.raise = 0;
    S.speed = S.pitch <= 2 ? SPEEDS[0] : SPEEDS[CM.randInt(0, 2)];
    S.ball = { x: THROWX, y: THROWY, vx: 0, vy: 0, rot: 0, mode: 'pitch' };
    S.judged = false;
    S.state = 'pitch';
    S.t = 0;
    S.bubble = '';
    CM.audio.play('whoosh');
  }

  function swing(S) {
    if (S.swingAge < 0.35) return; // already mid-swing
    S.swingAge = 0;
    CM.audio.play('whoosh');
  }

  function judgeSwing(S) {
    S.judged = true;
    const tt = (S.ball.x - HITX) / S.speed;  // seconds until the plate
    const a = Math.abs(tt);
    if (a <= 0.05) hit(S, 'perfect');
    else if (a <= 0.12) hit(S, 'good');
    else if (a <= 0.24) hit(S, 'foul');
    else whiff(S, true);
  }

  function hit(S, kind) {
    S.resultKind = kind;
    S.state = 'result';
    S.t = 0;
    S.ball.mode = 'fly';
    S.ball.x = HITX + 8;
    S.ball.y = PLATEY - 6;
    if (kind === 'perfect') {
      S.score += 50;
      S.ball.vx = 560; S.ball.vy = -640;
      S.shake = 0.45;
      S.cheer = 2.2;
      S.resultDur = 2.1;
      S.resultText = 'HOME RUN!!';
      S.flavor = 'It flew ' + CM.randInt(85, 120) + ' meters!!';
      S.bubble = 'WOW!! Incredible!!';
      CM.audio.play('tada');
      burst(S, HITX + 10, PLATEY - 10, 26, 'mix');
    } else if (kind === 'good') {
      S.score += 20;
      S.ball.vx = 340; S.ball.vy = -380;
      S.cheer = 1.2;
      S.resultDur = 1.7;
      S.resultText = 'Great hit!';
      S.flavor = 'It flew ' + CM.randInt(30, 65) + ' meters!';
      S.bubble = 'Nice hit!';
      CM.audio.play('ding');
      burst(S, HITX + 10, PLATEY - 10, 12, 'star');
    } else {
      S.score += 5;
      S.ball.vx = -150; S.ball.vy = -430;
      S.resultDur = 1.4;
      S.resultText = 'Foul tip!';
      S.flavor = 'Worth 5 points!';
      S.bubble = 'So close!';
      CM.audio.play('pop');
      burst(S, HITX + 4, PLATEY - 10, 6, 'spark');
    }
    S.scorePop = 1;
  }

  function whiff(S, swung) {
    S.judged = true;
    S.state = 'result';
    S.t = 0;
    S.resultKind = 'miss';
    S.resultDur = 1.6;
    S.resultText = swung ? 'Swing and a miss!' : 'Strike!';
    S.flavor = 'Good try!';
    S.bubble = 'Almost! Watch the ball!';
    CM.audio.play('miss');
  }

  function nextPitch(S) {
    if (S.pitch >= PITCHES) {
      S.state = 'endwait';
      S.t = 0;
      S.bubble = 'Great game!! Nap time…';
      S.cheer = 2;
      S.resultText = '';
      S.flavor = '';
      burst(S, 480, 250, 18, 'mix');
      CM.audio.play('cheer');
      return;
    }
    S.pitch++;
    S.state = 'windup';
    S.t = 0;
    S.ball = null;
    S.ballHeld = true;
    S.judged = false;
    S.resultKind = '';
    S.resultText = '';
    S.flavor = '';
    S.bubble = '';
  }

  /* ---------- scene drawing ---------- */
  function drawField(g, S) {
    // sky
    const sky = g.createLinearGradient(0, 0, 0, GROUNDY);
    sky.addColorStop(0, P.sky);
    sky.addColorStop(1, '#e9f7ff');
    g.fillStyle = sky;
    g.fillRect(-20, -20, CM.W + 40, GROUNDY + 20);
    // sun
    g.save();
    g.globalAlpha = 0.5;
    D.circle(g, 560, 76, 46, '#fff3c2');
    g.restore();
    D.circle(g, 560, 76, 30, P.yellow, '#f7d978', 3);
    // drifting clouds
    for (const c of S.clouds) {
      g.save();
      g.globalAlpha = 0.92;
      D.ellipse(g, c.x, c.y, 38 * c.s, 16 * c.s, '#fff');
      D.ellipse(g, c.x - 26 * c.s, c.y + 6 * c.s, 24 * c.s, 12 * c.s, '#fff');
      D.ellipse(g, c.x + 26 * c.s, c.y + 7 * c.s, 26 * c.s, 13 * c.s, '#fff');
      g.restore();
    }
    // trees peeking over the fence
    for (const t of TREES) D.circle(g, t[0], FENCEY - t[2] * 0.55, t[2], t[1]);
    // wooden fence
    g.fillStyle = P.wood;
    g.fillRect(-20, FENCEY, CM.W + 40, GROUNDY - FENCEY);
    g.strokeStyle = 'rgba(150,100,60,0.35)';
    g.lineWidth = 2;
    for (let x = 8; x < CM.W + 20; x += 34) {
      g.beginPath(); g.moveTo(x, FENCEY + 2); g.lineTo(x, GROUNDY); g.stroke();
    }
    D.rr(g, -20, FENCEY - 6, CM.W + 40, 10, 4, '#d4a877');
    // pennant flags on the rail
    for (let i = 0; i < 12; i++) {
      const fx = 30 + i * 82;
      g.fillStyle = SPARKLE[i % SPARKLE.length];
      g.beginPath();
      g.moveTo(fx, FENCEY + 8);
      g.lineTo(fx + 16, FENCEY + 8);
      g.lineTo(fx + 8, FENCEY + 24);
      g.closePath();
      g.fill();
    }
    // grass
    const gr = g.createLinearGradient(0, GROUNDY, 0, CM.H);
    gr.addColorStop(0, '#b9ebc3');
    gr.addColorStop(1, '#84d598');
    g.fillStyle = gr;
    g.fillRect(-20, GROUNDY, CM.W + 40, CM.H - GROUNDY + 40);
    // mow stripes
    g.fillStyle = 'rgba(255,255,255,0.07)';
    for (let y = GROUNDY; y < CM.H + 20; y += 56) g.fillRect(-20, y, CM.W + 40, 28);
    // infield dirt + mound
    D.ellipse(g, HITX - 10, 482, 100, 36, '#f0d9a8', 'rgba(160,120,60,0.18)', 2);
    D.ellipse(g, PITX, PITY + 8, 82, 26, '#f0d9a8', 'rgba(160,120,60,0.18)', 2);
    D.rr(g, PITX - 15, PITY - 2, 30, 7, 3, '#fff', '#d8c8d2', 1.5);
    // home plate
    g.fillStyle = '#fff';
    g.strokeStyle = '#d8c8d2';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(HITX - 8, 470);
    g.lineTo(HITX + 14, 470);
    g.lineTo(HITX + 14, 477);
    g.lineTo(HITX + 3, 484);
    g.lineTo(HITX - 8, 477);
    g.closePath();
    g.fill();
    g.stroke();
  }

  function drawFielders(g, S) {
    const cheer = S.cheer > 0;
    CM.drawFriend(g, 'keroppi', 455, 400, 0.66, {
      bob: ((CM.time * (cheer ? 2.6 : 0.7)) % 1) * (cheer ? 1 : 0.4)
    });
    CM.drawFriend(g, 'badtzmaru', 620, 386, 0.6, {
      flip: true,
      bob: ((CM.time * (cheer ? 2.6 : 0.6) + 0.4) % 1) * (cheer ? 1 : 0.35)
    });
    if (cheer) {
      g.save();
      g.globalAlpha = CM.clamp(S.cheer, 0, 1);
      D.star(g, 440, 320 - Math.sin(CM.time * 6) * 6, 9, P.yellowDeep, CM.time * 2);
      D.star(g, 642, 308 + Math.sin(CM.time * 6) * 6, 8, P.pink, -CM.time * 2);
      g.restore();
    }
  }

  function drawRing(g, S) {
    if (S.state !== 'pitch' && S.state !== 'windup') return;
    const pulse = 1 + Math.sin(CM.time * 7) * 0.08;
    const alpha = S.state === 'pitch' ? 0.95 : 0.45;
    g.save();
    g.globalAlpha = alpha * 0.25;
    D.circle(g, HITX, PLATEY, 30 * pulse, P.yellow);
    g.globalAlpha = alpha;
    D.circle(g, HITX, PLATEY, 30 * pulse, null, '#f2b53c', 4);
    g.restore();
  }

  function drawPitcher(g, S) {
    D.shadow(g, PITX, PITY, 28);
    const idle = S.state === 'howto' || S.state === 'endwait' ||
      (S.state === 'windup' && S.t < 0.35);
    g.save();
    g.translate(PITX, PITY);
    g.rotate(S.lean);
    CM.drawFriend(g, 'pompompurin', 0, 0, 1.08, {
      flip: true, shadow: false,
      bob: idle ? ((CM.time * 0.9) % 1) * 0.45 : 0
    });
    if (S.ballHeld) drawBall(g, -30 - S.raise * 8, -42 - S.raise * 26, 8, 0);
    g.restore();
    // wind-up telegraph "!"
    if (S.state === 'windup' && S.t >= 0.35) {
      const k = easeOut((S.t - 0.35) / 0.8);
      D.text(g, '!', PITX - 8, PITY - 152 - k * 14, {
        size: 22 + k * 14, color: P.yellowDeep, weight: 800, stroke: '#fff', strokeWidth: 5
      });
    }
  }

  function drawBatter(g, S) {
    const hop = (S.state === 'result' && (S.resultKind === 'perfect' || S.resultKind === 'good'))
      ? ((CM.time * 2.4) % 1) : 0;
    CM.drawPlayer(g, BATX, BATY, 1.12, 'right', hop);
    const ang = batAngle(S);
    drawBat(g, ang);
    if (S.swingAge < 0.16) { // motion blur arc
      g.save();
      g.globalAlpha = 0.35;
      g.strokeStyle = '#fff';
      g.lineWidth = 7;
      g.lineCap = 'round';
      g.beginPath();
      g.arc(BATX + 19, BATY - 38, 50, ang - 1.1, ang);
      g.stroke();
      g.restore();
    }
  }

  function drawBallNow(g, S) {
    const b = S.ball;
    if (!b || b.mode === 'gone') return;
    if (b.mode === 'pitch') D.shadow(g, b.x, 474, 9);
    drawBall(g, b.x, b.y, 9, b.rot);
  }

  function drawParts(g, S) {
    for (const p of S.parts) {
      g.save();
      g.globalAlpha = CM.clamp(p.life / 0.4, 0, 1);
      if (p.kind === 'star') D.star(g, p.x, p.y, p.size, p.color, p.rot);
      else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, p.color);
      else D.circle(g, p.x, p.y, p.size * 0.4, p.color);
      g.restore();
    }
  }

  function drawBubble(g, S) {
    if (!S.bubble) return;
    const w = Math.max(140, S.bubble.length * 8.6 + 28);
    const bx = CM.clamp(PITX + 30 - w, 8, CM.W - w - 8);
    D.bubble(g, bx, PITY - 200, w, 42, PITX - 14);
    D.text(g, S.bubble, bx + w / 2, PITY - 179, { size: 15, weight: 800, color: P.ink });
  }

  function drawHUD(g, S) {
    D.rr(g, 14, 12, 160, 40, 18, 'rgba(255,255,255,0.88)', '#f0b9d2', 2);
    D.text(g, 'Pitch ' + Math.min(S.pitch, PITCHES) + ' / ' + PITCHES, 94, 33,
      { size: 18, weight: 800, color: P.ink });
    D.rr(g, 186, 12, 150, 40, 18, 'rgba(255,255,255,0.88)', '#bcd9f0', 2);
    D.star(g, 210, 32, 11, P.yellowDeep);
    D.text(g, String(S.score), 272, 33,
      { size: 20 + 8 * S.scorePop, weight: 800, color: P.blueDeep });
  }

  function drawResultText(g, S) {
    if (S.state !== 'result' || !S.resultText) return;
    const k = easeOut(S.t / 0.25);
    const colors = { perfect: P.pinkDeep, good: P.blueDeep, foul: P.yellowDeep, miss: '#9a8a94' };
    const size = (S.resultKind === 'perfect' ? 54 : 42) * (0.7 + 0.3 * k);
    D.text(g, S.resultText, 480, 150, {
      size: size, color: colors[S.resultKind] || P.ink,
      weight: 800, stroke: '#fff', strokeWidth: 8
    });
    if (S.flavor) {
      D.text(g, S.flavor, 480, 198, {
        size: 22, color: P.ink, weight: 700,
        stroke: 'rgba(255,255,255,0.85)', strokeWidth: 5
      });
    }
  }

  function drawHowto(g, S) {
    g.fillStyle = 'rgba(70,40,70,0.3)';
    g.fillRect(0, 0, CM.W, CM.H);
    CM.ui.panel(g, 220, 92, 520, 386, { title: '⚾ Baseball' });
    CM.drawFriend(g, 'pompompurin', 318, 246, 1.05, { bob: ((CM.time * 0.9) % 1) * 0.5 });
    CM.drawPlayer(g, 642, 246, 1.05, 'left', 0);
    D.text(g, 'Pompompurin pitches 10 balls!', 480, 286, { size: 20, color: P.ink, weight: 700 });
    D.text(g, 'Tap, click, or press SPACE to swing.', 480, 318, { size: 20, color: P.ink, weight: 700 });
    D.text(g, 'Swing when the ball is in the golden ring', 480, 350, { size: 20, color: P.ink, weight: 700 });
    D.text(g, 'for a HOME RUN!', 480, 378, { size: 20, color: P.pinkDeep, weight: 800 });
    if (CM.ui.button(g, 380, 404, 200, 56, 'Play ball!', { color: P.mintDeep, size: 24 })) {
      startPlay(S);
    }
  }

  /* ---------- the game ---------- */
  CM.registerGame({
    id: 'baseball',
    name: 'Baseball',

    enter() {
      this.state = 'howto';   // howto → windup → pitch → result → … → endwait
      this.score = 0;
      this.pitch = 1;
      this.t = 0;             // time in current state
      this.lean = 0;          // pitcher body lean (radians)
      this.raise = 0;         // pitcher ball-arm raise 0..1
      this.ballHeld = true;
      this.ball = null;
      this.speed = SPEEDS[0];
      this.swingAge = 99;     // seconds since last swing started
      this.judged = false;
      this.resultKind = '';
      this.resultText = '';
      this.resultDur = 1.5;
      this.flavor = '';
      this.bubble = '';
      this.parts = [];
      this.shake = 0;
      this.cheer = 0;
      this.scorePop = 0;
      this.finished = false;
      this.clouds = [
        { x: 140, y: 64, s: 1.1, spd: 9 },
        { x: 430, y: 118, s: 0.8, spd: 13 },
        { x: 760, y: 92, s: 1.25, spd: 7 }
      ];
    },

    update(dt) {
      const S = this;
      S.t += dt;
      S.swingAge += dt;
      S.shake = Math.max(0, S.shake - dt);
      S.cheer = Math.max(0, S.cheer - dt);
      S.scorePop = Math.max(0, S.scorePop - dt * 3);
      for (const c of S.clouds) {
        c.x += c.spd * dt;
        if (c.x > CM.W + 90) c.x = -90;
      }
      for (let i = S.parts.length - 1; i >= 0; i--) {
        const p = S.parts[i];
        p.life -= dt;
        if (p.life <= 0) { S.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 300 * dt;
        p.rot += dt * 4;
      }

      const inp = CM.input;
      const swingInput = inp.pressed('action') || inp.mouse.clicked;

      if (S.state === 'howto') {
        if (inp.pressed('action')) startPlay(S);
        return;
      }

      if (S.state === 'windup') {
        if (S.t < 0.35) {
          S.lean = 0;
          S.raise = 0;
        } else if (S.t < 1.15) {            // ~0.8s telegraph: lean back, ball up
          const pr = (S.t - 0.35) / 0.8;
          S.lean = 0.46 * easeInOut(pr);
          S.raise = easeInOut(pr);
        } else {
          throwBall(S);
        }
        if (swingInput) swing(S);           // harmless practice swing
        return;
      }

      if (S.state === 'pitch') {
        S.lean = -0.38 * Math.max(0, 1 - S.t / 0.28); // follow-through
        const b = S.ball;
        b.x -= S.speed * dt;
        b.y = pitchY(b.x);
        b.rot -= 13 * dt;
        if (swingInput && !S.judged && S.swingAge >= 0.35) {
          swing(S);
          judgeSwing(S);
        } else if (!S.judged && b.x < HITX - 95) {
          whiff(S, false);                  // no swing — strike
        }
        return;
      }

      if (S.state === 'result') {
        S.lean *= Math.max(0, 1 - dt * 6);
        const b = S.ball;
        if (b && b.mode === 'fly') {
          b.x += b.vx * dt;
          b.vy += 780 * dt;
          b.y += b.vy * dt;
          b.rot += 15 * dt;
          if ((S.resultKind === 'good' || S.resultKind === 'foul') && b.vy > 0 && b.y > 452) { // outfield bounce
            b.y = 452;
            b.vy *= -0.45;
            b.vx *= 0.65;
            if (Math.abs(b.vy) < 70) b.mode = 'rest';
          }
          if (S.resultKind === 'perfect' && S.parts.length < 88 && CM.frame % 2 === 0) {
            S.parts.push({
              x: b.x, y: b.y, vx: CM.rand(-25, 25), vy: CM.rand(-25, 25),
              life: 0.35, kind: 'spark', size: CM.rand(8, 12), color: '#fff1c4', rot: 0
            });
          }
          if (b.x > CM.W + 60 || b.x < -60 || b.y < -80) b.mode = 'gone';
        } else if (b && b.mode === 'pitch') { // missed ball sails on past
          b.x -= S.speed * dt;
          b.y = pitchY(b.x);
          b.rot -= 13 * dt;
          if (b.x < -40) b.mode = 'gone';
        }
        if (S.t >= S.resultDur) nextPitch(S);
        return;
      }

      if (S.state === 'endwait') {
        if (S.t >= 1.1 && !S.finished) {
          S.finished = true;
          CM.finishGame('baseball', S.score, Math.max(5, Math.ceil(S.score / 20)));
        }
      }
    },

    draw(g) {
      const S = this;
      let ox = 0, oy = 0;
      if (S.shake > 0) {
        const m = S.shake * 13;
        ox = CM.rand(-m, m);
        oy = CM.rand(-m, m);
      }
      g.save();
      g.translate(ox, oy);
      drawField(g, S);
      drawFielders(g, S);
      drawRing(g, S);
      drawPitcher(g, S);
      drawBatter(g, S);
      drawBallNow(g, S);
      drawParts(g, S);
      drawBubble(g, S);
      g.restore();

      if (S.state === 'howto') {
        drawHowto(g, S);
        return;
      }

      drawHUD(g, S);
      drawResultText(g, S);

      if (S.state === 'pitch' && S.pitch <= 2) {
        g.save();
        g.globalAlpha = 0.7 + Math.sin(CM.time * 8) * 0.3;
        D.text(g, 'Tap to SWING!', HITX + 30, PLATEY + 70, {
          size: 17, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 4
        });
        g.restore();
      }

      if (S.state === 'endwait') {
        D.text(g, 'Great game!!', 480, 150, {
          size: 50, color: P.pinkDeep, weight: 800, stroke: '#fff', strokeWidth: 9
        });
        D.text(g, 'Final score: ' + S.score, 480, 200, {
          size: 24, color: P.ink, weight: 700, stroke: 'rgba(255,255,255,0.9)', strokeWidth: 5
        });
      }
    },

    exit() {}
  });
})();
