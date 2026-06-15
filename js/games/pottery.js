/* Cinnamoroll Mansion — Pottery (hosted by Pompompurin) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  const CLAY_SLICES = 20;
  const SLICE_H = 8;
  const BASE_Y = 400;
  const CLAY_X = 480;

  const TARGETS = [
    { name: 'A Bowl', w: [40, 45, 55, 65, 75, 80, 85, 85, 80, 75, 65, 50, 40, 30, 25, 20, 20, 20, 20, 20] },
    { name: 'A Tall Vase', w: [30, 35, 40, 45, 45, 40, 35, 30, 25, 25, 30, 40, 50, 55, 60, 55, 45, 35, 30, 30] },
    { name: 'An Hourglass', w: [50, 55, 60, 60, 55, 45, 35, 25, 20, 20, 25, 35, 45, 55, 60, 60, 55, 50, 45, 45] }
  ];

  CM.registerGame({
    id: 'pottery',
    name: 'Pottery',

    enter() {
      this.state = 'howto';
      this.score = 0;
      this.finished = false;
      this.target = TARGETS[CM.randInt(0, TARGETS.length - 1)];
      this.widths = [];
      for (let i = 0; i < CLAY_SLICES; i++) this.widths.push(80); // max block
      this.doneT = 0;
      this.parts = [];
      this.matchPct = 0;
    },

    exit() {},

    addPart(p) { this.parts.push(p); },

    sparkle(x, y) {
      this.addPart({
        x: x, y: y,
        vx: CM.rand(-40, 40), vy: CM.rand(-40, 10) - 20,
        life: CM.rand(0.3, 0.6), size: CM.rand(3, 6), color: '#d8a774'
      });
    },

    update(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= dt;
        if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 100 * dt;
      }

      if (this.state === 'howto') {
        if (CM.input.pressed('action') || CM.input.mouse.clicked) {
          this.state = 'play';
          CM.audio.play('pop');
        }
      } else if (this.state === 'play') {
        if (CM.input.mouse.down) {
          const mx = CM.input.mouse.x;
          const my = CM.input.mouse.y;

          // Check if dragging on clay
          const topY = BASE_Y - CLAY_SLICES * SLICE_H;
          if (my >= topY - 20 && my <= BASE_Y + 20) {
            let sliceIdx = Math.floor((BASE_Y - my) / SLICE_H);
            sliceIdx = CM.clamp(sliceIdx, 0, CLAY_SLICES - 1);
            
            const dist = Math.abs(mx - CLAY_X);
            // Can only make it thinner
            if (dist < this.widths[sliceIdx]) {
              this.widths[sliceIdx] = Math.max(10, dist);
              this.sparkle(mx, my);
              
              // Smooth adjacent slices a bit
              if (sliceIdx > 0 && this.widths[sliceIdx-1] > this.widths[sliceIdx] + 5) this.widths[sliceIdx-1] -= 2;
              if (sliceIdx < CLAY_SLICES - 1 && this.widths[sliceIdx+1] > this.widths[sliceIdx] + 5) this.widths[sliceIdx+1] -= 2;

              this.checkShape();
            }
          }
        }
      } else if (this.state === 'done') {
        this.doneT -= dt;
        if (this.doneT <= 0 && !this.finished) {
          this.finished = true;
          CM.finishGame('pottery', this.score, 15);
        }
      }
    },

    checkShape() {
      let diff = 0;
      let maxDiff = 0;
      for (let i = 0; i < CLAY_SLICES; i++) {
        diff += Math.abs(this.widths[i] - this.target.w[i]);
        maxDiff += Math.max(80 - this.target.w[i], this.target.w[i] - 10);
      }
      this.matchPct = Math.max(0, 1 - (diff / maxDiff));

      if (this.matchPct > 0.85) {
        this.state = 'done';
        this.doneT = 2.5;
        this.score = Math.floor(this.matchPct * 100);
        CM.audio.play('tada');
        for (let i=0; i<15; i++) this.sparkle(CLAY_X, BASE_Y - 80);
      }
    },

    draw(g) {
      // Background
      const wg = g.createLinearGradient(0, 0, 0, CM.H);
      wg.addColorStop(0, '#fff5e6');
      wg.addColorStop(1, '#ffe6cc');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, CM.H);

      // Pottery Wheel
      D.ellipse(g, CLAY_X, BASE_Y + 10, 120, 30, '#9a9aa4', '#7a7a84', 4);
      D.ellipse(g, CLAY_X, BASE_Y, 110, 26, '#cdced6', '#9a9aa4', 3);
      
      const t = CM.time;
      const spinning = (this.state === 'play' || this.state === 'done');
      const rot = spinning ? t * 10 : 0;
      // Wheel details to show spinning
      g.save();
      g.translate(CLAY_X, BASE_Y);
      g.scale(1, 0.23);
      g.rotate(rot);
      D.circle(g, 0, 0, 80, null, 'rgba(122,122,132,0.5)', 2);
      g.beginPath(); g.moveTo(-100, 0); g.lineTo(100, 0); g.stroke();
      g.beginPath(); g.moveTo(0, -100); g.lineTo(0, 100); g.stroke();
      g.restore();

      // Target shape ghost
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.strokeStyle = 'rgba(255,255,255,0.8)';
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < CLAY_SLICES; i++) {
        const y = BASE_Y - i * SLICE_H;
        g.lineTo(CLAY_X - this.target.w[i], y);
      }
      for (let i = CLAY_SLICES - 1; i >= 0; i--) {
        const y = BASE_Y - i * SLICE_H;
        g.lineTo(CLAY_X + this.target.w[i], y);
      }
      g.closePath();
      g.fill(); g.stroke();

      // Clay Slices
      for (let i = 0; i < CLAY_SLICES; i++) {
        const y = BASE_Y - i * SLICE_H;
        const w = this.widths[i];
        const nextW = i < CLAY_SLICES - 1 ? this.widths[i+1] : w;
        
        g.fillStyle = '#d8a774';
        g.beginPath();
        g.moveTo(CLAY_X - w, y);
        g.lineTo(CLAY_X - nextW, y - SLICE_H);
        g.lineTo(CLAY_X + nextW, y - SLICE_H);
        g.lineTo(CLAY_X + w, y);
        g.closePath();
        g.fill();
        
        // Spin lines
        if (spinning && Math.random() < 0.2) {
          g.strokeStyle = '#b9854f';
          g.lineWidth = 1;
          g.beginPath();
          g.moveTo(CLAY_X - w * Math.random(), y - SLICE_H / 2);
          g.lineTo(CLAY_X + w * Math.random(), y - SLICE_H / 2);
          g.stroke();
        }
      }
      // Top cap
      D.ellipse(g, CLAY_X, BASE_Y - CLAY_SLICES * SLICE_H, this.widths[CLAY_SLICES-1], 8, '#e8c191');

      // Host
      CM.drawFriend(g, 'pompompurin', 200, 360, 1.2, { bob: Math.sin(t * 3) * 0.1 });
      if (this.state === 'play') {
        const txt = "Shape " + this.target.name + "!";
        D.bubble(g, 120, 180, 200, 40, 200);
        D.text(g, txt, 220, 206, { size: 14, weight: 800, color: '#b9854f' });
      }

      // Progress bar
      D.rr(g, 700, 160, 40, 200, 8, '#fff', '#e0d0d8', 3);
      const fillH = this.matchPct * 192;
      D.rr(g, 704, 356 - fillH, 32, fillH, 4, '#8fd6a0');
      D.text(g, 'Goal', 720, 140, { size: 16, weight: 800, color: P.mintDeep });

      // Particles
      for (const p of this.parts) {
        D.circle(g, p.x, p.y, p.size, p.color);
      }

      if (this.state === 'done') {
        D.rr(g, 360, 160, 240, 60, 12, 'rgba(255,255,255,0.9)', P.yellowDeep, 4);
        D.text(g, 'Perfect Shape! 🎉', 480, 198, { size: 24, weight: 800, color: '#e08a2a' });
      }

      this.drawHud(g);
      if (this.state === 'howto') this.drawHowto(g);
    },

    drawHud(g) {
      D.rr(g, 16, 16, 40, 40, 8, '#fff', '#e0d0d8', 3);
      D.text(g, '✕', 36, 43, { size: 24, weight: 800, color: '#b9a8b3' });
      if (CM.input.mouse.clicked && CM.dist(CM.input.mouse.x, CM.input.mouse.y, 36, 36) < 30) {
        this.finished = true;
        CM.finishGame('pottery', this.score, 5);
      }
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.rr(g, 300, 200, 360, 180, 16, '#fff', '#e08a2a', 4);
      D.text(g, 'Pottery', 480, 245, { size: 28, weight: 800, color: '#e08a2a' });
      D.text(g, 'Drag inward on the spinning clay', 480, 280, { size: 16, color: P.ink });
      D.text(g, 'to match the target shape!', 480, 305, { size: 16, color: P.ink });
      D.rr(g, 380, 330, 200, 36, 18, '#ffe07a', '#e08a2a', 3);
      D.text(g, '▶ Play', 480, 354, { size: 16, weight: 800, color: '#fff' });
    }
  });
})();
