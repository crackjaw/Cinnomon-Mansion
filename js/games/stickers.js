/* Cinnamoroll Mansion — Stickers (hosted by Pochacco) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  const STICKERS = [
    { id: 'star_y', draw: (g, x, y) => D.star(g, x, y, 16, P.yellowDeep) },
    { id: 'star_p', draw: (g, x, y) => D.star(g, x, y, 16, P.pinkDeep) },
    { id: 'heart', draw: (g, x, y) => {
        g.fillStyle = '#ff5f8f';
        g.beginPath();
        g.moveTo(x, y + 6);
        g.bezierCurveTo(x - 20, y - 10, x - 20, y - 20, x, y - 6);
        g.bezierCurveTo(x + 20, y - 20, x + 20, y - 10, x, y + 6);
        g.fill();
    }},
    { id: 'flower', draw: (g, x, y) => {
        for(let i=0; i<5; i++) {
          const a = (i/5)*Math.PI*2;
          D.circle(g, x+Math.cos(a)*10, y+Math.sin(a)*10, 8, P.mintDeep);
        }
        D.circle(g, x, y, 8, P.yellowDeep);
    }},
    { id: 'bow', draw: (g, x, y) => {
        g.fillStyle = '#8ecdf6';
        g.beginPath(); g.moveTo(x, y); g.lineTo(x-16, y-12); g.lineTo(x-16, y+12); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(x, y); g.lineTo(x+16, y-12); g.lineTo(x+16, y+12); g.closePath(); g.fill();
        D.circle(g, x, y, 6, P.blueDeep);
    }}
  ];

  const CANVAS_RECT = { x: 260, y: 120, w: 440, h: 360 };

  CM.registerGame({
    id: 'stickers',
    name: 'Stickers',

    enter() {
      this.state = 'howto';
      this.score = 0;
      this.finished = false;
      this.placed = [];
      this.dragging = null;
      this.doneT = 0;
      this.parts = [];
    },

    exit() {},

    addPart(p) { this.parts.push(p); },

    update(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= dt;
        if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 150 * dt;
      }

      if (this.state === 'howto') {
        if (CM.input.pressed('action') || CM.input.mouse.clicked) {
          this.state = 'play';
          CM.audio.play('pop');
        }
      } else if (this.state === 'play') {
        const mx = CM.input.mouse.x;
        const my = CM.input.mouse.y;

        if (CM.input.mouse.down && !this.wasDown) {
          // Check palette to start drag
          for (let i = 0; i < STICKERS.length; i++) {
            const px = 180;
            const py = 160 + i * 60;
            if (CM.dist(mx, my, px, py) < 24) {
              this.dragging = { st: STICKERS[i], x: mx, y: my };
              CM.audio.play('pop');
              break;
            }
          }
        }

        if (this.dragging) {
          this.dragging.x = mx;
          this.dragging.y = my;
          
          if (!CM.input.mouse.down) {
            // Drop it
            if (mx > CANVAS_RECT.x && mx < CANVAS_RECT.x + CANVAS_RECT.w &&
                my > CANVAS_RECT.y && my < CANVAS_RECT.y + CANVAS_RECT.h) {
              this.placed.push({ st: this.dragging.st, x: mx, y: my });
              CM.audio.play('ding');
              
              if (this.placed.length >= 10) {
                this.state = 'done';
                this.doneT = 2.5;
                this.score = 100;
                CM.audio.play('tada');
              }
            } else {
              CM.audio.play('pop'); // cancelled
            }
            this.dragging = null;
          }
        }
        this.wasDown = CM.input.mouse.down;

      } else if (this.state === 'done') {
        this.doneT -= dt;
        if (this.doneT <= 0 && !this.finished) {
          this.finished = true;
          CM.finishGame('stickers', this.score, 10);
        }
      }
    },

    draw(g) {
      // Background
      const wg = g.createLinearGradient(0, 0, 0, CM.H);
      wg.addColorStop(0, '#f0fff0');
      wg.addColorStop(1, '#ccffcc');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, CM.H);

      // Scrapbook Canvas
      D.rr(g, CANVAS_RECT.x - 10, CANVAS_RECT.y - 10, CANVAS_RECT.w + 20, CANVAS_RECT.h + 20, 12, '#8fd6a0', '#6fbc82', 4);
      D.rr(g, CANVAS_RECT.x, CANVAS_RECT.y, CANVAS_RECT.w, CANVAS_RECT.h, 0, '#ffffff');

      // Placed stickers
      for (const p of this.placed) {
        // white border for sticker look
        g.save();
        p.st.draw(g, p.x, p.y);
        g.restore();
      }

      // Palette
      D.rr(g, 140, 120, 80, 360, 12, '#ffffff', '#e0d0d8', 3);
      for (let i = 0; i < STICKERS.length; i++) {
        const px = 180;
        const py = 160 + i * 60;
        D.circle(g, px, py, 24, '#f0f0f0');
        STICKERS[i].draw(g, px, py);
      }

      // Dragging
      if (this.dragging) {
        g.globalAlpha = 0.8;
        this.dragging.st.draw(g, this.dragging.x, this.dragging.y);
        g.globalAlpha = 1.0;
      }

      // Host
      CM.drawFriend(g, 'pochacco', 800, 380, 1.2, { bob: Math.sin(CM.time * 2) * 0.2 });
      if (this.state === 'play') {
        const txt = "Place 10 stickers!";
        D.bubble(g, 720, 220, 160, 40, 800);
        D.text(g, txt, 800, 246, { size: 14, weight: 800, color: P.mintDeep });
        
        D.text(g, this.placed.length + "/10", 800, 270, { size: 14, weight: 800, color: P.ink });
      }

      if (this.state === 'done') {
        D.rr(g, 360, 280, 240, 60, 12, 'rgba(255,255,255,0.9)', P.mintDeep, 4);
        D.text(g, 'Beautiful Page! 🎉', 480, 318, { size: 24, weight: 800, color: P.mintDeep });
      }

      this.drawHud(g);
      if (this.state === 'howto') this.drawHowto(g);
    },

    drawHud(g) {
      D.rr(g, 16, 16, 40, 40, 8, '#fff', '#e0d0d8', 3);
      D.text(g, '✕', 36, 43, { size: 24, weight: 800, color: '#b9a8b3' });
      if (CM.input.mouse.clicked && CM.dist(CM.input.mouse.x, CM.input.mouse.y, 36, 36) < 30) {
        this.finished = true;
        CM.finishGame('stickers', this.score, 5);
      }
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.rr(g, 300, 200, 360, 180, 16, '#fff', P.mintDeep, 4);
      D.text(g, 'Stickers', 480, 245, { size: 28, weight: 800, color: P.mintDeep });
      D.text(g, 'Drag stickers from the left', 480, 280, { size: 16, color: P.ink });
      D.text(g, 'to decorate the scrapbook!', 480, 305, { size: 16, color: P.ink });
      D.rr(g, 380, 330, 200, 36, 18, '#8fd6a0', P.mintDeep, 3);
      D.text(g, '▶ Play', 480, 354, { size: 16, weight: 800, color: '#fff' });
    }
  });
})();
