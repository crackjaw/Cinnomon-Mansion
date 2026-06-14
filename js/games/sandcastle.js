/* Cinnamoroll Mansion — Sand Castle (hosted by Hello Kitty) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ---- layout ----
     The castle is a stack of bucket-shaped sand layers. Each layer has a
     center x and a half-width (hw). Layers are LAYER_H tall and drawn from a
     baseline near the bottom of the sandbox; as the tower grows we scroll the
     whole stack down with `scroll` so the top stays in view. */
  const SANDBOX = { x: 150, y: 470, w: 660, h: 96 };  // the sandbox tray on the grass
  const BASE_Y = 500;          // screen y of the bottom of layer 0 (before scroll)
  const LAYER_H = 34;          // each layer's height
  const START_HW = 96;         // half-width of the very first (base) layer
  const MIN_HW = 26;           // tower can't get narrower than this -> happy finish
  const MAX_LAYERS = 12;       // finish after this many stacked layers
  const SLIDE_X = 480;         // horizontal center the slider oscillates around
  const SLIDE_RANGE = 300;     // +/- travel of the sliding block
  const PERFECT_TOL = 12;      // |offset| under this = Perfect!
  const GOOD_TOL = 30;         // |offset| under this = Great!
  const TOP_Y = 150;           // we keep the active top layer around this screen y
  const KITTY = { x: 858, y: 470 };
  const MAX_PARTS = 110;

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'sandcastle',
    name: 'Sand Castle',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';      // howto -> stack -> done (-> finish once)
      this.score = 0;
      this.finished = false;

      // the placed tower: layer 0 is the base, already set
      this.layers = [{ cx: SLIDE_X, hw: START_HW }];
      this.placed = 0;           // number of layers the PLAYER stacked (base not counted)

      // the sliding block that the player drops
      this.slide = { hw: START_HW, t: CM.rand(0, Math.PI * 2), dir: 1, dropping: false };
      this.dropY = 0;            // animated fall offset of the dropping block
      this.dropTargetY = 0;      // resting y for the dropping block
      this.dropCx = 0;           // captured center when dropped
      this.dropFromHw = 0;       // half-width before this drop (for trim animation)

      this.scroll = 0;           // how far the tower has scrolled down-screen
      this.scrollGoal = 0;

      this.parts = [];
      this.shk = { t: 0, dur: 1, mag: 0 };
      this.msg = '';
      this.msgT = 0;
      this.bigMsg = '';
      this.bigT = 0;
      this.perfectStreak = 0;

      this.resultT = 0;          // brief pause after a drop before the next slide
      this.doneT = 0;            // celebrate timer in the 'done' state
      this.decorT = 0;           // grows during 'done' to reveal flag/shells/star
      this.hostBubble = '';
      this.hostBubbleT = 0;
      this.hostHappy = 0;
    },

    exit() {},

    /* ================= helpers ================= */
    topLayer() { return this.layers[this.layers.length - 1]; },

    // screen y of the BOTTOM of layer index i (with scroll applied)
    layerBottomY(i) {
      return BASE_Y + this.scroll - i * LAYER_H;
    },

    say(text, t) {
      this.hostBubble = text;
      this.hostBubbleT = t;
      this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    doShake(t, mag) { this.shk = { t: t, dur: t, mag: mag }; },

    startStacking() {
      this.state = 'stack';
      this.beginSlide();
    },

    beginSlide() {
      const top = this.topLayer();
      this.slide.hw = top.hw;            // new block matches the layer below
      this.slide.t = CM.rand(0, Math.PI * 2);
      this.slide.dir = Math.random() < 0.5 ? 1 : -1;
      this.slide.dropping = false;
      this.dropY = 0;
    },

    // x center of the sliding block this frame
    slideX() {
      return SLIDE_X + Math.sin(this.slide.t) * SLIDE_RANGE;
    },

    // current slide speed ramps up VERY gently with height (always kid-friendly)
    slideSpeed() {
      return 1.15 + this.placed * 0.05;   // radians/sec on the sine phase
    },

    dropBlock() {
      this.dropCx = this.slideX();
      this.dropFromHw = this.slide.hw;
      this.slide.dropping = true;
      // resting bottom y of the new layer = top surface of the current top layer
      this.dropTargetY = this.layerBottomY(this.layers.length - 1) - LAYER_H;
      // animate dropY from a negative offset (block held high) up to 0 (landed)
      this.dropY = -180;
      CM.audio.play('whoosh');
    },

    landBlock() {
      const below = this.topLayer();
      const absOff = Math.abs(this.dropCx - below.cx);   // misalignment magnitude
      // the supported width is the part of the new block that overlaps the one
      // below; the overhang is gently trimmed away (no game over, just slimmer)
      const overlap = (below.hw + this.dropFromHw - absOff) / 2; // half of overlapped span
      let newHw = Math.min(this.dropFromHw, Math.max(0, overlap));
      // center the new layer on the overlapped region for a stable look
      let newCx;
      if (newHw <= 0) {
        // total miss (shouldn't really happen given slow slide) — keep a sliver
        newHw = Math.max(MIN_HW * 0.8, this.dropFromHw * 0.4);
        newCx = below.cx;
      } else {
        // overlapped region spans [max(left), min(right)]
        const left = Math.max(this.dropCx - this.dropFromHw, below.cx - below.hw);
        const right = Math.min(this.dropCx + this.dropFromHw, below.cx + below.hw);
        newCx = (left + right) / 2;
      }

      const perfect = absOff <= PERFECT_TOL;
      const good = !perfect && absOff <= GOOD_TOL;

      // Perfect stacks DON'T shrink — snap to the layer below for a satisfying tower
      if (perfect) {
        newHw = below.hw;
        newCx = below.cx;
      }

      this.layers.push({ cx: newCx, hw: newHw });
      this.placed++;

      // ----- scoring -----
      let gained = 20;
      if (perfect) {
        this.perfectStreak++;
        gained = 40 + Math.min(this.perfectStreak - 1, 4) * 10; // 40,50,60,70,80
        this.bigMsg = this.perfectStreak >= 2 ? 'Perfect x' + this.perfectStreak + '!' : 'Perfect!';
        this.bigT = 1.1;
        this.msg = 'Bullseye!';
        CM.audio.play('tada');
        this.doShake(0.4, 7);
        this.sparkleLayer(newCx, this.dropTargetY - LAYER_H / 2, 22, true);
        this.say(CM.pick(['Perfect!! ✨', 'Wow!!', 'So good!']), 1.6);
      } else if (good) {
        this.perfectStreak = 0;
        gained = 30;
        this.msg = 'Great stack!';
        CM.audio.play('ding');
        this.doShake(0.22, 4);
        this.sparkleLayer(newCx, this.dropTargetY - LAYER_H / 2, 12, false);
        this.say('Nice one!', 1.3);
      } else {
        this.perfectStreak = 0;
        gained = 15;
        this.msg = 'Good try!';
        CM.audio.play('pop');
        this.sandPuff(newCx, this.dropTargetY, 10);
        this.say('Keep going!', 1.1);
      }
      this.score += gained;
      this.floatText(newCx, this.dropTargetY - 22, '+' + gained,
        perfect ? '#e0a81f' : (good ? P.blueDeep : '#c98a1f'));
      this.msgT = 1.2;

      // ----- scroll the view so the new top stays comfortably visible -----
      const newTopBottom = this.layerBottomY(this.layers.length - 1) - LAYER_H;
      if (newTopBottom < TOP_Y + LAYER_H) {
        this.scrollGoal += (TOP_Y + LAYER_H) - newTopBottom;
      }

      // ----- end conditions -----
      if (this.placed >= MAX_LAYERS || newHw < MIN_HW) {
        this.finishCastle();
      } else {
        this.resultT = perfect ? 0.7 : 0.5;   // brief pause, then next block slides
      }
    },

    finishCastle() {
      this.state = 'done';
      this.doneT = 3.2;
      this.decorT = 0;
      this.bigMsg = 'What a castle!';
      this.bigT = 2.4;
      this.say('Hooray!! 🏖️', 3);
      this.hostHappy = 2;
      CM.audio.play('cheer');
      this.doShake(0.5, 8);
      // confetti burst over the top of the tower
      const ty = this.layerBottomY(this.layers.length - 1) - LAYER_H;
      this.celebrate(ty);
    },

    /* ================= particles ================= */
    addPart(pt) {
      if (this.parts.length >= MAX_PARTS) this.parts.shift();
      pt.maxLife = pt.life;
      this.parts.push(pt);
    },

    sparkleLayer(x, y, n, big) {
      for (let i = 0; i < n; i++) {
        this.addPart({
          type: Math.random() < 0.55 ? 'star' : 'heart',
          x: x + CM.rand(-40, 40), y: y + CM.rand(-10, 10),
          vx: CM.rand(-90, 90), vy: CM.rand(-150, -40),
          life: CM.rand(0.5, 1.0),
          color: big ? CM.pick([P.pink, P.yellowDeep, P.mintDeep, P.lavenderDeep])
            : CM.pick([P.yellow, P.pink, P.mint]),
          size: CM.rand(7, big ? 13 : 10), rot: CM.rand(0, 6), vr: CM.rand(-4, 4), grav: 230
        });
      }
    },

    sandPuff(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.addPart({
          type: 'sand',
          x: x + CM.rand(-30, 30), y: y,
          vx: CM.rand(-110, 110), vy: CM.rand(-70, 10),
          life: CM.rand(0.3, 0.6),
          color: CM.pick(['#f4dcae', '#ecc98a', '#fbeccb']),
          size: CM.rand(3, 6), rot: 0, vr: 0, grav: 320
        });
      }
    },

    celebrate(topY) {
      for (let i = 0; i < 30; i++) {
        this.addPart({
          type: Math.random() < 0.5 ? 'star' : 'heart',
          x: CM.rand(SLIDE_X - 200, SLIDE_X + 200), y: CM.rand(topY - 60, topY + 60),
          vx: CM.rand(-110, 110), vy: CM.rand(-200, -50),
          life: CM.rand(0.8, 1.5),
          color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
          size: CM.rand(8, 14), rot: CM.rand(0, 6), vr: CM.rand(-4, 4), grav: 200
        });
      }
    },

    floatText(x, y, str, color) {
      this.addPart({ type: 'txt', x: x, y: y, str: str, color: color, vx: 0, vy: -40, life: 1.1, grav: 0, size: 22, rot: 0, vr: 0 });
    },

    updateParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const pt = this.parts[i];
        pt.life -= dt;
        if (pt.life <= 0) { this.parts.splice(i, 1); continue; }
        pt.vy += (pt.grav || 0) * dt;
        pt.x += pt.vx * dt;
        pt.y += pt.vy * dt;
        pt.rot += (pt.vr || 0) * dt;
      }
    },

    /* ================= update ================= */
    update(dt) {
      if (this.shk.t > 0) this.shk.t -= dt;
      if (this.msgT > 0) this.msgT -= dt;
      if (this.bigT > 0) this.bigT -= dt;
      if (this.hostBubbleT > 0) this.hostBubbleT -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      this.updateParts(dt);

      // ease the scroll toward its goal so the tower glides down
      if (Math.abs(this.scrollGoal - this.scroll) > 0.5) {
        this.scroll += (this.scrollGoal - this.scroll) * Math.min(1, dt * 6);
      } else {
        this.scroll = this.scrollGoal;
      }

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.startStacking();
          break;

        case 'stack':
          if (this.resultT > 0) {
            this.resultT -= dt;
            if (this.resultT <= 0) this.beginSlide();
            break;
          }
          if (this.slide.dropping) {
            // animate the block falling onto the tower (dropY climbs from -180 to 0)
            this.dropY += 900 * dt;
            if (this.dropY >= 0) {
              this.dropY = 0;
              this.landBlock();
            }
          } else {
            // slide the block back and forth
            this.slide.t += this.slideSpeed() * dt;
            if (anyPress()) {
              CM.audio.play('click');
              this.dropBlock();
            }
          }
          break;

        case 'done':
          this.decorT += dt;
          this.doneT -= dt;
          // occasional sparkle rain during the celebration
          if (this.parts.length < 70 && Math.random() < 0.25) {
            const ty = this.layerBottomY(this.layers.length - 1) - LAYER_H;
            this.addPart({
              type: 'star', x: CM.rand(SLIDE_X - 220, SLIDE_X + 220), y: CM.rand(ty - 80, ty + 40),
              vx: CM.rand(-20, 20), vy: CM.rand(-30, 20), life: CM.rand(0.7, 1.2),
              color: CM.pick([P.yellow, P.pink, P.mint, P.lavender]), size: CM.rand(6, 11),
              rot: CM.rand(0, 6), vr: CM.rand(-3, 3), grav: 60
            });
          }
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('sandcastle', this.score, CM.clamp(Math.ceil(this.score / 15), 5, 30));
          }
          break;
      }
    },

    /* ================= draw ================= */
    draw(g) {
      g.save();
      if (this.shk.t > 0) {
        const m = this.shk.mag * (this.shk.t / this.shk.dur);
        g.translate(CM.rand(-m, m), CM.rand(-m, m));
      }

      this.drawScene(g);
      this.drawSandbox(g);
      this.drawTower(g);
      if (this.state === 'stack' && !this.slide.dropping && this.resultT <= 0) {
        this.drawSlider(g);
        this.drawGuide(g);
      }
      if (this.state === 'stack' && this.slide.dropping) {
        this.drawDroppingBlock(g);
      }

      // the player building beside the sandbox (kid's character)
      CM.drawPlayer(g, 250, 566, 1.0, 'up', 0);

      // Hello Kitty cheering on the right
      const excited = this.hostHappy > 0 || this.state === 'done';
      CM.drawFriend(g, 'hellokitty', KITTY.x, KITTY.y, 1.1, {
        bob: excited ? (CM.time * 2.4) % 1 : ((CM.time * 0.9) % 1) * 0.4,
        flip: true
      });
      if (this.hostHappy > 0) {
        const lift = Math.abs(Math.sin((CM.time * 2.4 % 1) * Math.PI * 2)) * 5;
        D.star(g, KITTY.x + 18, KITTY.y - 96 - lift, 7, P.yellowDeep, CM.time * 3);
      }

      this.drawParts(g);
      g.restore(); // end shake — context restored on every path

      /* ---- HUD (not shaken) ---- */
      this.drawHud(g);

      // floating "Perfect!" / "What a castle!" banner
      if (this.bigT > 0 && this.bigMsg) {
        const a = CM.clamp(this.bigT, 0, 1);
        const pop = this.state === 'done' ? 1 : Math.min(1, (1.2 - this.bigT) * 4 + 0.3);
        g.save();
        g.globalAlpha = Math.min(1, a + 0.2);
        D.text(g, this.bigMsg, 480, this.state === 'done' ? 250 : 300, {
          size: (this.state === 'done' ? 52 : 38) * pop, color: P.pinkDeep, weight: 800,
          stroke: '#fff', strokeWidth: 10
        });
        g.restore();
      }

      // Hello Kitty's speech bubble on good moments
      if (this.hostBubbleT > 0 && this.state !== 'howto') {
        const txt = this.hostBubble;
        const cw = Math.max(96, txt.length * 9 + 26);
        const bx = CM.clamp(KITTY.x - cw + 30, 8, CM.W - cw - 8);
        D.bubble(g, bx, KITTY.y - 168, cw, 40, KITTY.x - 6);
        D.text(g, txt, bx + cw / 2, KITTY.y - 148, { size: 15, weight: 800, color: P.pinkDeep });
      }

      // hint bar
      if (this.state === 'stack' && CM.sceneTime < 99) {
        let hint = CM.touchMode ? 'Tap to drop the sand block!' : 'Click or SPACE to drop the sand block!';
        D.rr(g, 280, 572, 400, 24, 12, 'rgba(255,255,255,0.78)');
        D.text(g, hint, 480, 584, { size: 14, color: P.pinkDeep, weight: 800 });
      }

      if (this.state === 'howto') this.drawHowto(g);
    },

    /* ---- background scene: beach playground ---- */
    drawScene(g) {
      // soft blue sky
      const sg = g.createLinearGradient(0, 0, 0, 380);
      sg.addColorStop(0, '#bfe7ff');
      sg.addColorStop(1, '#e6f7ff');
      g.fillStyle = sg;
      g.fillRect(0, 0, CM.W, 410);

      // sun
      D.circle(g, 108, 92, 38, '#fff3b0');
      D.circle(g, 108, 92, 30, '#ffe07a');
      g.strokeStyle = 'rgba(255,224,122,0.6)';
      g.lineWidth = 4; g.lineCap = 'round';
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2 + CM.time * 0.15;
        g.beginPath();
        g.moveTo(108 + Math.cos(a) * 44, 92 + Math.sin(a) * 44);
        g.lineTo(108 + Math.cos(a) * 56, 92 + Math.sin(a) * 56);
        g.stroke();
      }

      // drifting clouds
      this.drawCloud(g, (CM.time * 14) % 1120 - 160, 86, 1.0);
      this.drawCloud(g, (CM.time * 9 + 560) % 1120 - 160, 150, 0.72);
      this.drawCloud(g, (CM.time * 11 + 300) % 1120 - 160, 60, 0.55);

      // grass ground
      const gg = g.createLinearGradient(0, 380, 0, CM.H);
      gg.addColorStop(0, '#bfe6a0');
      gg.addColorStop(1, '#a3d585');
      g.fillStyle = gg;
      g.fillRect(0, 380, CM.W, CM.H - 380);
      // grass edge highlight
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, 378, CM.W, 4);
      // little grass tufts
      g.strokeStyle = '#8fc66f'; g.lineWidth = 3; g.lineCap = 'round';
      for (let i = 0; i < 14; i++) {
        const gx = (i * 137 + 30) % 940 + 10;
        const gyb = 396 + ((i * 71) % 30);
        for (let b = -1; b <= 1; b++) {
          g.beginPath();
          g.moveTo(gx + b * 5, gyb);
          g.lineTo(gx + b * 7, gyb - 11 - (b === 0 ? 4 : 0));
          g.stroke();
        }
      }

      // low picket fence across the back
      this.drawFence(g, 370);

      // bunting along the very top
      const cols = [P.pink, P.mint, P.yellow, P.lavender, P.blue];
      g.strokeStyle = 'rgba(150,110,130,0.35)'; g.lineWidth = 2;
      g.beginPath();
      for (let x = 0; x <= CM.W; x += 8) g.lineTo(x, 6 + Math.sin(x * 0.04) * 5);
      g.stroke();
      for (let i = 0; i * 60 < CM.W; i++) {
        const x = 30 + i * 60;
        const dip = 6 + Math.sin(x * 0.04) * 5;
        g.fillStyle = cols[i % cols.length];
        g.beginPath();
        g.moveTo(x - 9, dip); g.lineTo(x + 9, dip); g.lineTo(x, dip + 16); g.closePath();
        g.fill();
      }
    },

    drawCloud(g, x, y, s) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      g.fillStyle = 'rgba(255,255,255,0.92)';
      D.ellipse(g, 0, 0, 34, 22);
      D.ellipse(g, 30, 6, 26, 18);
      D.ellipse(g, -28, 6, 24, 16);
      D.ellipse(g, 6, -12, 22, 16);
      g.restore();
    },

    drawFence(g, y) {
      const postW = 16, gap = 30, top = y, h = 34;
      g.lineWidth = 2;
      for (let x = -10; x < CM.W + 20; x += postW + gap) {
        D.rr(g, x, top, postW, h, 4, '#ffffff', '#e7dccf', 2);
        // pointed cap
        g.fillStyle = '#ffffff';
        g.strokeStyle = '#e7dccf';
        g.beginPath();
        g.moveTo(x, top); g.lineTo(x + postW / 2, top - 9); g.lineTo(x + postW, top); g.closePath();
        g.fill(); g.stroke();
      }
      // two rails
      D.rr(g, -10, top + 7, CM.W + 30, 6, 3, '#ffffff', '#e7dccf', 1.5);
      D.rr(g, -10, top + 22, CM.W + 30, 6, 3, '#ffffff', '#e7dccf', 1.5);
    },

    /* ---- the sandbox tray ---- */
    drawSandbox(g) {
      const S = SANDBOX;
      // wooden frame
      D.shadow(g, S.x + S.w / 2, S.y + S.h + 6, S.w * 0.46, 16);
      D.rr(g, S.x - 14, S.y - 14, S.w + 28, S.h + 28, 16, P.wood, '#cf9f63', 4);
      // corner caps
      const caps = [[S.x - 14, S.y - 14], [S.x + S.w - 6, S.y - 14], [S.x - 14, S.y + S.h - 6], [S.x + S.w - 6, S.y + S.h - 6]];
      for (const c of caps) D.rr(g, c[0], c[1], 20, 20, 6, '#f0cf9c', '#cf9f63', 3);
      // sand fill
      const sg = g.createLinearGradient(0, S.y, 0, S.y + S.h);
      sg.addColorStop(0, '#fbeccb');
      sg.addColorStop(1, '#f0d49a');
      g.fillStyle = sg;
      D.rr(g, S.x, S.y, S.w, S.h, 8);
      g.fill();
      // sand speckle
      g.fillStyle = 'rgba(200,160,90,0.25)';
      for (let i = 0; i < 26; i++) {
        const dx = S.x + ((i * 53) % S.w);
        const dy = S.y + 14 + ((i * 37) % (S.h - 18));
        g.beginPath(); g.arc(dx, dy, 1.6, 0, Math.PI * 2); g.fill();
      }
      // a couple of little shells / a starfish resting in the sand
      this.drawShell(g, S.x + 40, S.y + S.h - 16, '#ffd9e8');
      this.drawStarfish(g, S.x + S.w - 44, S.y + S.h - 18, '#ffb27a');
      // toy bucket + spade leaning on the box
      this.drawBucket(g, S.x + S.w + 4, S.y + S.h + 4, 0.85, P.pink);
    },

    drawShell(g, x, y, c) {
      g.save();
      g.translate(x, y);
      g.fillStyle = c;
      g.strokeStyle = 'rgba(180,120,140,0.5)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(0, 0, 9, Math.PI, Math.PI * 2);
      g.closePath();
      g.fill(); g.stroke();
      g.beginPath();
      for (let i = -2; i <= 2; i++) {
        g.moveTo(0, 0);
        g.lineTo(i * 4, -9 + Math.abs(i) * 1.2);
      }
      g.stroke();
      g.restore();
    },

    drawStarfish(g, x, y, c) {
      D.star(g, x, y, 11, c);
      D.star(g, x, y, 6, 'rgba(255,255,255,0.5)');
    },

    drawBucket(g, x, y, s, c) {
      g.save();
      g.translate(x, y);
      g.scale(s, s);
      // pail (trapezoid)
      g.fillStyle = c;
      g.strokeStyle = 'rgba(0,0,0,0.12)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-20, -34); g.lineTo(20, -34); g.lineTo(15, 0); g.lineTo(-15, 0); g.closePath();
      g.fill(); g.stroke();
      // rim
      D.rr(g, -22, -38, 44, 8, 4, '#ffffff', 'rgba(0,0,0,0.1)', 1.5);
      // handle
      g.strokeStyle = '#ffffff'; g.lineWidth = 3;
      g.beginPath(); g.arc(0, -34, 20, Math.PI * 1.1, Math.PI * 1.9); g.stroke();
      g.restore();
    },

    /* ---- the placed tower ---- */
    drawSandBlock(g, cx, bottomY, hw, opts) {
      opts = opts || {};
      const h = LAYER_H;
      const topY = bottomY - h;
      // bucket-shaped layer: slightly wider at the bottom like a sand-bucket mold
      const tw = hw;            // top half-width
      const bw = hw * 0.92;     // bottom half-width (gentle taper)
      const grad = g.createLinearGradient(0, topY, 0, bottomY);
      grad.addColorStop(0, opts.light || '#fbe6bc');
      grad.addColorStop(1, opts.dark || '#eccb8e');
      g.fillStyle = grad;
      g.strokeStyle = opts.stroke || '#d9b06a';
      g.lineWidth = 2.5;
      g.beginPath();
      const r = 8;
      // rounded-top trapezoid
      g.moveTo(cx - tw + r, topY);
      g.lineTo(cx + tw - r, topY);
      g.quadraticCurveTo(cx + tw, topY, cx + tw, topY + r);
      g.lineTo(cx + bw, bottomY);
      g.lineTo(cx - bw, bottomY);
      g.lineTo(cx - tw, topY + r);
      g.quadraticCurveTo(cx - tw, topY, cx - tw + r, topY);
      g.closePath();
      g.fill();
      g.stroke();
      // crenellation grooves on top (sand-mold ridges) when wide enough
      if (tw > 34) {
        g.strokeStyle = 'rgba(180,135,70,0.35)';
        g.lineWidth = 2;
        const ridges = Math.max(2, Math.floor(tw / 22));
        for (let i = 1; i < ridges; i++) {
          const gx = cx - tw + (i * (2 * tw) / ridges);
          g.beginPath();
          g.moveTo(gx, topY + 5);
          g.lineTo(gx, topY + h - 4);
          g.stroke();
        }
      }
      // top highlight
      g.fillStyle = 'rgba(255,255,255,0.35)';
      D.rr(g, cx - tw + 4, topY + 3, (tw - 6) * 2, 5, 2.5);
      g.fill();
    },

    drawTower(g) {
      for (let i = 0; i < this.layers.length; i++) {
        const L = this.layers[i];
        const by = this.layerBottomY(i);
        // skip layers that have scrolled off the bottom (rare) or far above top
        if (by < -40 || by > CM.H + 40) continue;
        this.drawSandBlock(g, L.cx, by, L.hw, i === 0 ? { light: '#f7dca8', dark: '#e6c081' } : {});
      }
      // decorate the very top when finished
      if (this.state === 'done') this.drawDecorations(g);
      // a cute door on the base layer
      const base = this.layers[0];
      const baseBottom = this.layerBottomY(0);
      if (baseBottom < CM.H + 40 && baseBottom > 60) {
        const dw = Math.min(20, base.hw * 0.4);
        g.fillStyle = '#caa066';
        g.beginPath();
        g.moveTo(base.cx - dw, baseBottom);
        g.lineTo(base.cx - dw, baseBottom - 18);
        g.arc(base.cx, baseBottom - 18, dw, Math.PI, 0, false);
        g.lineTo(base.cx + dw, baseBottom);
        g.closePath();
        g.fill();
        D.circle(g, base.cx + dw * 0.45, baseBottom - 14, 1.8, '#8a5a3b');
      }
    },

    drawDecorations(g) {
      const top = this.topLayer();
      const ty = this.layerBottomY(this.layers.length - 1) - LAYER_H; // top surface y
      const k = CM.clamp(this.decorT * 1.6, 0, 1);   // reveal animation
      g.save();
      g.globalAlpha = k;
      // flag pole rising from the center
      const poleH = 46 * k;
      g.strokeStyle = '#b98a4e'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(top.cx, ty);
      g.lineTo(top.cx, ty - poleH);
      g.stroke();
      // waving pennant flag
      const wave = Math.sin(CM.time * 4) * 5;
      g.fillStyle = P.pinkDeep;
      g.beginPath();
      g.moveTo(top.cx, ty - poleH);
      g.lineTo(top.cx + 34, ty - poleH + 7 + wave);
      g.lineTo(top.cx, ty - poleH + 16);
      g.closePath();
      g.fill();
      // a shining star atop the pole
      D.star(g, top.cx, ty - poleH - 2, 8 + Math.sin(CM.time * 5) * 1.5, P.yellowDeep, CM.time * 1.5);
      // little shells dotted along the top edge
      if (top.hw > 30) {
        this.drawShell(g, top.cx - top.hw * 0.6, ty - 2, '#ffd9e8');
        this.drawShell(g, top.cx + top.hw * 0.6, ty - 2, '#bfe3ff');
      }
      g.restore();
    },

    /* ---- the sliding block + drop animation ---- */
    drawSlider(g) {
      const cx = this.slideX();
      const by = this.layerBottomY(this.layers.length - 1) - LAYER_H; // sits just above the top layer
      // gentle wobble for life
      g.save();
      this.drawSandBlock(g, cx, by, this.slide.hw, { light: '#fff1cf', dark: '#f0d49a', stroke: '#e0b878' });
      g.restore();
    },

    drawGuide(g) {
      // faint vertical guide showing where the block will land (alignment helper)
      const cx = this.slideX();
      const top = this.topLayer();
      const by = this.layerBottomY(this.layers.length - 1) - LAYER_H;
      g.save();
      g.strokeStyle = 'rgba(240,98,146,0.45)';
      g.lineWidth = 2.5;
      g.setLineDash([7, 8]);
      g.beginPath();
      g.moveTo(cx, by);
      g.lineTo(cx, by + 60);
      g.stroke();
      g.restore();
      // a small arrow over the slider
      g.fillStyle = P.pinkDeep;
      const ay = by - LAYER_H - 14 + Math.sin(CM.time * 6) * 3;
      g.beginPath();
      g.moveTo(cx, ay + 12);
      g.lineTo(cx - 11, ay);
      g.lineTo(cx + 11, ay);
      g.closePath();
      g.fill();
      // mark the target center (below layer) so kids see the sweet spot
      g.strokeStyle = 'rgba(103,197,135,0.7)';
      g.lineWidth = 2;
      g.setLineDash([4, 5]);
      g.beginPath();
      g.moveTo(top.cx, by);
      g.lineTo(top.cx, by - 18);
      g.stroke();
      g.setLineDash([]);
    },

    drawDroppingBlock(g) {
      const cx = this.dropCx;
      const by = this.dropTargetY + this.dropY; // dropY animates from -180 up to 0
      this.drawSandBlock(g, cx, by, this.dropFromHw, { light: '#fff1cf', dark: '#f0d49a', stroke: '#e0b878' });
    },

    /* ---- HUD ---- */
    drawHud(g) {
      // score, top-left
      D.rr(g, 14, 12, 168, 44, 20, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      D.star(g, 36, 34, 11, P.yellowDeep);
      D.text(g, String(this.score), 116, 34, { size: 22, color: '#c98a1f', weight: 800 });

      // layer progress, top-center
      if (this.state !== 'howto') {
        const n = Math.min(this.placed, MAX_LAYERS);
        D.rr(g, 396, 12, 168, 44, 20, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
        D.text(g, '🏰 ' + n + '/' + MAX_LAYERS, 480, 34, { size: 22, color: P.blueDeep, weight: 800 });
        // tiny perfect-streak pips
        if (this.perfectStreak > 0 && this.state === 'stack') {
          for (let i = 0; i < Math.min(this.perfectStreak, 5); i++) {
            D.star(g, 574 + i * 16, 34, 6, P.yellowDeep);
          }
        }
      }
    },

    /* ---- particles ---- */
    drawParts(g) {
      for (const pt of this.parts) {
        g.globalAlpha = CM.clamp(pt.life / pt.maxLife, 0, 1);
        if (pt.type === 'star') D.star(g, pt.x, pt.y, pt.size, pt.color, pt.rot);
        else if (pt.type === 'heart') D.heart(g, pt.x, pt.y, pt.size, pt.color);
        else if (pt.type === 'txt') {
          D.text(g, pt.str, pt.x, pt.y, { size: pt.size, color: pt.color, weight: 800, stroke: '#fff', strokeWidth: 5 });
        } else {
          D.circle(g, pt.x, pt.y, pt.size, pt.color);
        }
      }
      g.globalAlpha = 1;
    },

    /* ---- how-to overlay ---- */
    drawHowto(g) {
      g.fillStyle = 'rgba(70,40,70,0.3)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 210, 96, 540, 392, { title: '🏖️ Sand Castle with Hello Kitty' });
      CM.drawFriend(g, 'hellokitty', 300, 440, 1.25, { bob: ((CM.time * 1.2) % 1) * 0.5 });
      D.text(g, '1. A sand block slides side to side', 560, 178, { size: 17, color: P.ink, weight: 700 });
      D.text(g, 'on top of the castle.', 560, 202, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '2. Tap to DROP it right on top!', 560, 244, { size: 17, color: P.ink, weight: 700 });
      D.text(g, '3. Line it up for a ✨Perfect!✨', 560, 286, { size: 17, color: P.pinkDeep, weight: 800 });
      D.text(g, 'Miss a bit? No worries — your', 560, 322, { size: 15, color: '#7a6b75' });
      D.text(g, 'tower just gets a little slimmer!', 560, 344, { size: 15, color: '#7a6b75' });
      D.text(g, 'Stack 12 layers for a grand castle!', 480, 376, { size: 14, color: '#9a8a94' });
      if (CM.ui.button(g, 380, 402, 200, 56, '▶ Start!', { color: P.mintDeep, size: 22 })) {
        this.startStacking();
      }
    }
  });
})();
