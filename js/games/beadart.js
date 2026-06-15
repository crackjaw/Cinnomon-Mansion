/* Cinnamoroll Mansion — Bead Art (hosted by My Melody) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  // Pattern definition characters to colors mapping
  const C = {
    'R': '#ff5f8f', 'P': P.pink, 'Y': P.yellow, 'G': '#8fd6a0',
    'B': P.blue, 'W': '#ffffff', 'K': '#3a3a3a', '.': null
  };
  const PALETTE = [
    C.R, C.P, C.Y, C.G, C.B, C.W, C.K
  ];

  const PATTERNS = [
    {
      name: 'Heart',
      grid: [
        "..........",
        "..RR..RR..",
        ".RRRRRRRR.",
        ".RRRRRRRR.",
        "..RRRRRR..",
        "...RRRR...",
        "....RR....",
        ".........."
      ]
    },
    {
      name: 'Flower',
      grid: [
        "....PP....",
        "...PPPP...",
        "....PP....",
        "..PPPPPP..",
        ".PPPYYPPP.",
        "..PPPPPP..",
        "....GG....",
        "....GG...."
      ]
    },
    {
      name: 'Star',
      grid: [
        "....YY....",
        "...YYYY...",
        ".YYYYYYYY.",
        "..YYYYYY..",
        "...YYYY...",
        "..YY..YY..",
        ".Y......Y.",
        ".........."
      ]
    }
  ];

  const GRID_SIZE = 28;
  const GRID_X = 360;
  const GRID_Y = 160;

  CM.registerGame({
    id: 'beadart',
    name: 'Bead Art',

    enter() {
      this.state = 'howto';
      this.score = 0;
      this.finished = false;
      this.target = PATTERNS[CM.randInt(0, PATTERNS.length - 1)];
      this.rows = this.target.grid.length;
      this.cols = this.target.grid[0].length;
      
      this.board = [];
      for (let r = 0; r < this.rows; r++) {
        let row = [];
        for (let c = 0; c < this.cols; c++) {
          row.push(null);
        }
        this.board.push(row);
      }
      
      this.selColor = C.R;
      this.doneT = 0;
      this.parts = [];
    },

    exit() {},

    addPart(p) { this.parts.push(p); },

    sparkle(x, y, color) {
      for (let i = 0; i < 4; i++) {
        const a = (i / 4) * Math.PI * 2 + CM.rand(-0.2, 0.2);
        this.addPart({
          x: x, y: y,
          vx: Math.cos(a) * CM.rand(40, 80),
          vy: Math.sin(a) * CM.rand(40, 80) - 20,
          life: CM.rand(0.4, 0.7), size: CM.rand(3, 6), color: color
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
        p.vy += 120 * dt;
      }

      if (this.state === 'howto') {
        if (CM.input.pressed('action') || CM.input.mouse.clicked) {
          this.state = 'play';
          CM.audio.play('pop');
        }
      } else if (this.state === 'play') {
        if (CM.input.mouse.clicked || CM.input.mouse.down) {
          const mx = CM.input.mouse.x;
          const my = CM.input.mouse.y;

          // Check palette
          if (CM.input.mouse.clicked) {
            let hitPalette = false;
            for (let i = 0; i < PALETTE.length; i++) {
              const px = 200;
              const py = 180 + i * 42;
              if (CM.dist(mx, my, px, py) < 18) {
                this.selColor = PALETTE[i];
                CM.audio.play('pop');
                hitPalette = true;
                break;
              }
            }
            if (hitPalette) return;
          }

          // Check board
          if (mx >= GRID_X && mx < GRID_X + this.cols * GRID_SIZE &&
              my >= GRID_Y && my < GRID_Y + this.rows * GRID_SIZE) {
            
            const c = Math.floor((mx - GRID_X) / GRID_SIZE);
            const r = Math.floor((my - GRID_Y) / GRID_SIZE);
            
            if (this.board[r][c] !== this.selColor) {
              this.board[r][c] = this.selColor;
              CM.audio.play('ding');
              const bx = GRID_X + c * GRID_SIZE + GRID_SIZE / 2;
              const by = GRID_Y + r * GRID_SIZE + GRID_SIZE / 2;
              this.sparkle(bx, by, this.selColor);
              this.checkWin();
            }
          }
        }
      } else if (this.state === 'done') {
        this.doneT -= dt;
        if (this.doneT <= 0 && !this.finished) {
          this.finished = true;
          CM.finishGame('beadart', this.score, 10);
        }
      }
    },

    checkWin() {
      let isWin = true;
      let totalBeads = 0;
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const char = this.target.grid[r][c];
          const targetColor = C[char];
          if (targetColor !== null) {
            totalBeads++;
            if (this.board[r][c] !== targetColor) isWin = false;
          } else {
            if (this.board[r][c] !== null) isWin = false; // placed bead where none should be
          }
        }
      }

      if (isWin) {
        this.state = 'done';
        this.doneT = 2.5;
        this.score = totalBeads * 5 + 50;
        CM.audio.play('tada');
        for (let i=0; i<15; i++) this.sparkle(GRID_X + (this.cols*GRID_SIZE)/2, GRID_Y + (this.rows*GRID_SIZE)/2, P.yellowDeep);
      }
    },

    draw(g) {
      // Background
      const wg = g.createLinearGradient(0, 0, 0, CM.H);
      wg.addColorStop(0, '#ffe6f0');
      wg.addColorStop(1, '#ffcce0');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, CM.H);

      // Pegboard
      const pw = this.cols * GRID_SIZE + 20;
      const ph = this.rows * GRID_SIZE + 20;
      D.rr(g, GRID_X - 10, GRID_Y - 10, pw, ph, 8, '#ffffff', P.pinkDeep, 4);

      // Grid + Beads
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const bx = GRID_X + c * GRID_SIZE + GRID_SIZE / 2;
          const by = GRID_Y + r * GRID_SIZE + GRID_SIZE / 2;
          
          // Peg hole
          D.circle(g, bx, by, 3, '#ffe6f0');
          
          // Target ghost
          const char = this.target.grid[r][c];
          if (char !== '.') {
             const tColor = C[char];
             g.globalAlpha = 0.2;
             D.circle(g, bx, by, 10, tColor);
             g.globalAlpha = 1.0;
          }

          // Placed bead
          if (this.board[r][c]) {
            D.circle(g, bx, by, 12, this.board[r][c]);
            D.circle(g, bx - 3, by - 3, 3, 'rgba(255,255,255,0.6)');
          }
        }
      }

      // Palette
      D.rr(g, 170, 150, 60, 310, 12, '#ffffff', '#e0d0d8', 3);
      for (let i = 0; i < PALETTE.length; i++) {
        const px = 200;
        const py = 180 + i * 42;
        const sel = (this.selColor === PALETTE[i]);
        D.circle(g, px, py, sel ? 18 : 14, PALETTE[i], sel ? '#3a3a3a' : '#d0c0b0', sel ? 3 : 2);
      }

      // Host
      CM.drawFriend(g, 'mymelody', 800, 380, 1.2, { bob: Math.sin(CM.time * 2) * 0.2 });
      if (this.state === 'play') {
        const txt = "Make a " + this.target.name + "!";
        D.bubble(g, 720, 220, 160, 40, 800);
        D.text(g, txt, 800, 246, { size: 14, weight: 800, color: P.pinkDeep });
      }

      // Particles
      for (const p of this.parts) {
        D.star(g, p.x, p.y, p.size, p.color);
      }

      if (this.state === 'done') {
        D.rr(g, 360, 280, 240, 60, 12, 'rgba(255,255,255,0.9)', P.pinkDeep, 4);
        D.text(g, 'So Cute! 🎉', 480, 318, { size: 24, weight: 800, color: P.pinkDeep });
      }

      this.drawHud(g);
      if (this.state === 'howto') this.drawHowto(g);
    },

    drawHud(g) {
      D.rr(g, 16, 16, 40, 40, 8, '#fff', '#e0d0d8', 3);
      D.text(g, '✕', 36, 43, { size: 24, weight: 800, color: '#b9a8b3' });
      if (CM.input.mouse.clicked && CM.dist(CM.input.mouse.x, CM.input.mouse.y, 36, 36) < 30) {
        this.finished = true;
        CM.finishGame('beadart', this.score, 5);
      }
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.rr(g, 300, 200, 360, 180, 16, '#fff', P.pinkDeep, 4);
      D.text(g, 'Bead Art', 480, 245, { size: 28, weight: 800, color: P.pinkDeep });
      D.text(g, 'Select beads from the palette', 480, 280, { size: 16, color: P.ink });
      D.text(g, 'and place them to match the pattern!', 480, 305, { size: 16, color: P.ink });
      D.rr(g, 380, 330, 200, 36, 18, P.pink, P.pinkDeep, 3);
      D.text(g, '▶ Play', 480, 354, { size: 16, weight: 800, color: '#fff' });
    }
  });
})();
