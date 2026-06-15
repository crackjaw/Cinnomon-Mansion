/* Cinnamoroll Mansion — Spin Art (hosted by Badtz-Maru) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  const PALETTE = [
    P.pink, '#ff5f8f', P.yellow, '#8fd6a0',
    P.blue, P.lavender, '#3a3a3a', '#ffffff'
  ];

  const CANVAS_X = 480;
  const CANVAS_Y = 320;
  const CANVAS_R = 160;

  CM.registerGame({
    id: 'spinart',
    name: 'Spin Art',

    enter() {
      this.state = 'howto';
      this.score = 0;
      this.finished = false;
      this.selColor = P.pink;
      this.drops = [];
      this.timeLeft = 20;
      this.doneT = 0;
    },

    exit() {},

    update(dt) {
      if (this.state === 'howto') {
        if (CM.input.pressed('action') || CM.input.mouse.clicked) {
          this.state = 'play';
          CM.audio.play('pop');
        }
      } else if (this.state === 'play') {
        this.timeLeft -= dt;
        if (this.timeLeft <= 0) {
          this.timeLeft = 0;
          this.state = 'done';
          this.doneT = 3.0;
          this.calculateScore();
          CM.audio.play('tada');
        }

        // Expand drops
        for (const drop of this.drops) {
          if (drop.r < drop.maxR) drop.r += 40 * dt;
          for (const splat of drop.splats) {
            if (splat.r < splat.maxR) splat.r += 20 * dt;
            if (splat.dist < splat.maxDist) splat.dist += 80 * dt;
          }
        }

        if (CM.input.mouse.clicked || CM.input.mouse.down) {
          const mx = CM.input.mouse.x;
          const my = CM.input.mouse.y;

          // Check palette
          if (CM.input.mouse.clicked) {
            let hitPalette = false;
            for (let i = 0; i < PALETTE.length; i++) {
              const px = 180;
              const py = 150 + i * 42;
              if (CM.dist(mx, my, px, py) < 18) {
                this.selColor = PALETTE[i];
                CM.audio.play('pop');
                hitPalette = true;
                break;
              }
            }
            if (hitPalette) return;
          }

          // Add drop if on canvas (throttle slightly if holding down)
          if (CM.dist(mx, my, CANVAS_X, CANVAS_Y) < CANVAS_R) {
            // we have to un-rotate the mouse coord to store it on the spinning canvas
            const rot = -(CM.time * 8);
            const dx = mx - CANVAS_X;
            const dy = my - CANVAS_Y;
            const unrotX = Math.cos(rot) * dx - Math.sin(rot) * dy;
            const unrotY = Math.sin(rot) * dx + Math.cos(rot) * dy;
            
            // Limit drop rate
            if (this.drops.length === 0 || CM.time - this.drops[this.drops.length-1].t > 0.1) {
              const splats = [];
              const numSplats = CM.randInt(3, 8);
              for (let i=0; i<numSplats; i++) {
                splats.push({
                  angle: CM.rand(0, Math.PI*2),
                  dist: 0,
                  maxDist: CM.rand(10, 50),
                  r: 0,
                  maxR: CM.rand(2, 6)
                });
              }

              this.drops.push({
                x: unrotX, y: unrotY,
                r: 0, maxR: CM.rand(10, 25),
                color: this.selColor,
                t: CM.time,
                splats: splats
              });
              
              if (CM.input.mouse.clicked) CM.audio.play('ding');
            }
          }
        }
      } else if (this.state === 'done') {
        this.doneT -= dt;
        if (this.doneT <= 0 && !this.finished) {
          this.finished = true;
          CM.finishGame('spinart', this.score, 15);
        }
      }
    },

    calculateScore() {
      let colors = new Set();
      for (const d of this.drops) colors.add(d.color);
      this.score = Math.min(200, this.drops.length * 2 + colors.size * 10);
    },

    draw(g) {
      // Background
      const wg = g.createLinearGradient(0, 0, 0, CM.H);
      wg.addColorStop(0, '#f0e6ff');
      wg.addColorStop(1, '#e6ccff');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, CM.H);

      const t = CM.time;
      const rot = (this.state === 'play' || this.state === 'howto') ? t * 8 : 0;

      // Spin Art Machine base
      D.rr(g, CANVAS_X - 190, CANVAS_Y - 190, 380, 380, 20, '#5a5560', '#3a3640', 4);
      D.circle(g, CANVAS_X, CANVAS_Y, 175, '#cdced6', '#9a9aa4', 3);

      // Spinning Canvas
      g.save();
      g.translate(CANVAS_X, CANVAS_Y);
      g.rotate(rot);
      
      // Paper
      D.circle(g, 0, 0, CANVAS_R, '#fff7ea', '#e0d0b0', 2);
      
      // Paint Drops
      for (const drop of this.drops) {
        D.circle(g, drop.x, drop.y, drop.r, drop.color);
        for (const splat of drop.splats) {
          const sx = drop.x + Math.cos(splat.angle) * splat.dist;
          const sy = drop.y + Math.sin(splat.angle) * splat.dist;
          D.circle(g, sx, sy, splat.r, drop.color);
        }
      }
      
      g.restore();

      // Palette
      D.rr(g, 150, 120, 60, 360, 12, '#ffffff', '#e0d0d8', 3);
      for (let i = 0; i < PALETTE.length; i++) {
        const px = 180;
        const py = 150 + i * 42;
        const sel = (this.selColor === PALETTE[i]);
        D.circle(g, px, py, sel ? 18 : 14, PALETTE[i], sel ? '#3a3a3a' : '#d0c0b0', sel ? 3 : 2);
      }

      // Host
      CM.drawFriend(g, 'badtzmaru', 800, 380, 1.2, { bob: Math.sin(t * 2) * 0.2 });
      if (this.state === 'play') {
        const txt = "Time: " + Math.ceil(this.timeLeft) + "s";
        D.bubble(g, 720, 220, 160, 40, 800);
        D.text(g, txt, 800, 246, { size: 14, weight: 800, color: '#3a3a3a' });
      }

      if (this.state === 'done') {
        D.rr(g, 360, 280, 240, 60, 12, 'rgba(255,255,255,0.9)', P.lavenderDeep, 4);
        D.text(g, 'Masterpiece! 🎉', 480, 318, { size: 24, weight: 800, color: P.blueDeep });
      }

      this.drawHud(g);
      if (this.state === 'howto') this.drawHowto(g);
    },

    drawHud(g) {
      D.rr(g, 16, 16, 40, 40, 8, '#fff', '#e0d0d8', 3);
      D.text(g, '✕', 36, 43, { size: 24, weight: 800, color: '#b9a8b3' });
      if (CM.input.mouse.clicked && CM.dist(CM.input.mouse.x, CM.input.mouse.y, 36, 36) < 30) {
        this.finished = true;
        CM.finishGame('spinart', this.score, 5);
      }
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.rr(g, 300, 200, 360, 180, 16, '#fff', P.blueDeep, 4);
      D.text(g, 'Spin Art', 480, 245, { size: 28, weight: 800, color: P.blueDeep });
      D.text(g, 'Tap or hold the spinning canvas', 480, 280, { size: 16, color: P.ink });
      D.text(g, 'to drop paint and make a mess!', 480, 305, { size: 16, color: P.ink });
      D.rr(g, 380, 330, 200, 36, 18, P.blue, P.blueDeep, 3);
      D.text(g, '▶ Play', 480, 354, { size: 16, weight: 800, color: '#fff' });
    }
  });
})();
