/* Cinnamoroll Mansion — Coloring Book (hosted by Hello Kitty) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  const PALETTE = [
    P.pink, P.red, P.orange, P.yellow,
    P.mintDeep, P.blueDeep, P.lavender, '#ffffff'
  ];

  // The drawing is composed of regions. Each has a path and a current color.
  function buildRegions() {
    return [
      { id: 'sky', color: '#ffffff', draw: (g) => { g.rect(260, 160, 440, 300); } },
      { id: 'sun', color: '#ffffff', draw: (g) => { g.arc(340, 220, 40, 0, Math.PI * 2); } },
      { id: 'grass', color: '#ffffff', draw: (g) => { g.rect(260, 360, 440, 100); } },
      { id: 'house', color: '#ffffff', draw: (g) => { g.rect(420, 280, 120, 100); } },
      { id: 'roof', color: '#ffffff', draw: (g) => { g.moveTo(400, 280); g.lineTo(480, 200); g.lineTo(560, 280); g.closePath(); } },
      { id: 'door', color: '#ffffff', draw: (g) => { g.rect(460, 330, 40, 50); } },
      { id: 'window', color: '#ffffff', draw: (g) => { g.rect(430, 300, 24, 24); } },
      { id: 'trunk', color: '#ffffff', draw: (g) => { g.rect(600, 300, 20, 80); } },
      { id: 'leaves', color: '#ffffff', draw: (g) => { g.arc(610, 280, 40, 0, Math.PI * 2); } }
    ];
  }

  CM.registerGame({
    id: 'coloring',
    name: 'Coloring',

    enter() {
      this.state = 'howto';
      this.score = 0;
      this.finished = false;
      this.regions = buildRegions();
      this.selColor = P.pink;
      this.doneT = 0;
      this.parts = [];
    },

    exit() {},

    addPart(p) { this.parts.push(p); },
    sparkle(x, y, color) {
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + CM.rand(-0.2, 0.2);
        this.addPart({
          x: x, y: y,
          vx: Math.cos(a) * CM.rand(40, 100),
          vy: Math.sin(a) * CM.rand(40, 100) - 20,
          life: CM.rand(0.4, 0.8), size: CM.rand(4, 8), color: color
        });
      }
    },

    update(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= dt;
        if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 150 * dt; // gravity
      }

      if (this.state === 'howto') {
        if (CM.input.pressed('action') || CM.input.mouse.clicked) {
          this.state = 'play';
          CM.audio.play('pop');
        }
      } else if (this.state === 'play') {
        if (CM.input.mouse.clicked) {
          const mx = CM.input.mouse.x;
          const my = CM.input.mouse.y;

          // Check palette
          let hitPalette = false;
          for (let i = 0; i < PALETTE.length; i++) {
            const px = 180;
            const py = 180 + i * 42;
            if (CM.dist(mx, my, px, py) < 18) {
              this.selColor = PALETTE[i];
              CM.audio.play('pop');
              hitPalette = true;
              break;
            }
          }

          // Check regions (in reverse order so top-most is checked first)
          if (!hitPalette) {
            // we have to use pointInPath for each region
            // Since we don't have the canvas context directly here for hit testing,
            // we will create a temporary path to test.
            const cvs = document.createElement('canvas');
            const g = cvs.getContext('2d');
            let hitRegion = false;
            for (let i = this.regions.length - 1; i >= 0; i--) {
              const r = this.regions[i];
              g.beginPath();
              r.draw(g);
              if (g.isPointInPath(mx, my)) {
                if (r.color !== this.selColor) {
                  r.color = this.selColor;
                  CM.audio.play('ding');
                  this.sparkle(mx, my, this.selColor);
                  this.checkWin();
                }
                hitRegion = true;
                break;
              }
            }
          }
        }
      } else if (this.state === 'done') {
        this.doneT -= dt;
        if (this.doneT <= 0 && !this.finished) {
          this.finished = true;
          CM.finishGame('coloring', this.score, 15);
        }
      }
    },

    checkWin() {
      // Check if all regions are not white
      let allColored = true;
      let colorsUsed = new Set();
      for (const r of this.regions) {
        if (r.color === '#ffffff') allColored = false;
        colorsUsed.add(r.color);
      }
      if (allColored) {
        this.state = 'done';
        this.doneT = 2.5;
        this.score = colorsUsed.size * 10 + 50; // Bonus for using more colors
        CM.audio.play('tada');
        for (let i=0; i<10; i++) this.sparkle(480 + CM.rand(-100, 100), 300 + CM.rand(-100, 100), P.pinkDeep);
      }
    },

    draw(g) {
      // Background
      const wg = g.createLinearGradient(0, 0, 0, CM.H);
      wg.addColorStop(0, '#fff0f5');
      wg.addColorStop(1, '#ffe6ef');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, CM.H);

      // Drawing Board
      D.rr(g, 240, 140, 480, 340, 12, '#e8c8a8', '#c9a47e', 4);
      D.rr(g, 260, 160, 440, 300, 0, '#ffffff');

      // Draw regions
      for (const r of this.regions) {
        g.beginPath();
        r.draw(g);
        g.fillStyle = r.color;
        g.fill();
        g.strokeStyle = '#3a3a3a';
        g.lineWidth = 3;
        g.stroke();
      }

      // Palette
      D.rr(g, 150, 150, 60, 360, 12, '#ffffff', '#e0d0d8', 3);
      for (let i = 0; i < PALETTE.length; i++) {
        const px = 180;
        const py = 180 + i * 42;
        const sel = (this.selColor === PALETTE[i]);
        D.circle(g, px, py, sel ? 18 : 14, PALETTE[i], sel ? '#3a3a3a' : '#d0c0b0', sel ? 3 : 2);
      }

      // Host
      CM.drawFriend(g, 'hellokitty', 800, 380, 1.2, { bob: Math.sin(CM.time * 2) * 0.2 });
      if (this.state === 'play') {
        const txt = "Color the picture!";
        D.bubble(g, 720, 220, 160, 40, 800);
        D.text(g, txt, 800, 246, { size: 14, weight: 800, color: P.pinkDeep });
      }

      // Particles
      for (const p of this.parts) {
        D.star(g, p.x, p.y, p.size, p.color);
      }

      if (this.state === 'done') {
        D.rr(g, 360, 280, 240, 60, 12, 'rgba(255,255,255,0.9)', '#ff9ec7', 4);
        D.text(g, 'Beautiful! 🎉', 480, 318, { size: 24, weight: 800, color: P.pinkDeep });
      }

      this.drawHud(g);
      if (this.state === 'howto') this.drawHowto(g);
    },

    drawHud(g) {
      D.rr(g, 16, 16, 40, 40, 8, '#fff', '#e0d0d8', 3);
      D.text(g, '✕', 36, 43, { size: 24, weight: 800, color: '#b9a8b3' });
      if (CM.input.mouse.clicked && CM.dist(CM.input.mouse.x, CM.input.mouse.y, 36, 36) < 30) {
        this.finished = true;
        CM.finishGame('coloring', this.score, 5);
      }
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.rr(g, 300, 200, 360, 180, 16, '#fff', P.pinkDeep, 4);
      D.text(g, 'Coloring Book', 480, 245, { size: 28, weight: 800, color: P.pinkDeep });
      D.text(g, 'Pick colors from the palette', 480, 280, { size: 16, color: P.ink });
      D.text(g, 'and tap the shapes to color them!', 480, 305, { size: 16, color: P.ink });
      D.rr(g, 380, 330, 200, 36, 18, P.pink, P.pinkDeep, 3);
      D.text(g, '▶ Play', 480, 354, { size: 16, weight: 800, color: '#fff' });
    }
  });
})();
