/* Cinnamoroll Mansion — Tracing (hosted by Cinnamoroll) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  // Generate path points
  function genCircle() {
    const pts = [];
    for (let i = 0; i <= 30; i++) {
      const a = (i / 30) * Math.PI * 2 - Math.PI / 2;
      pts.push({ x: 480 + Math.cos(a) * 120, y: 260 + Math.sin(a) * 120 });
    }
    return { name: 'Circle', pts: pts, color: P.blueDeep };
  }

  function genTriangle() {
    const pts = [];
    const corners = [ {x: 480, y: 140}, {x: 600, y: 360}, {x: 360, y: 360}, {x: 480, y: 140} ];
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 10; j++) {
        const t = j / 10;
        pts.push({
          x: corners[i].x * (1-t) + corners[i+1].x * t,
          y: corners[i].y * (1-t) + corners[i+1].y * t
        });
      }
    }
    pts.push(corners[3]);
    return { name: 'Triangle', pts: pts, color: P.mintDeep };
  }

  function genStar() {
    const pts = [];
    const corners = [];
    for (let i = 0; i < 11; i++) {
      const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
      const r = (i % 2 === 0) ? 140 : 60;
      corners.push({ x: 480 + Math.cos(a) * r, y: 270 + Math.sin(a) * r });
    }
    for (let i = 0; i < 10; i++) {
      for (let j = 0; j < 5; j++) {
        const t = j / 5;
        pts.push({
          x: corners[i].x * (1-t) + corners[i+1].x * t,
          y: corners[i].y * (1-t) + corners[i+1].y * t
        });
      }
    }
    pts.push(corners[10]);
    return { name: 'Star', pts: pts, color: P.yellowDeep };
  }

  const SHAPES = [genCircle, genTriangle, genStar];

  CM.registerGame({
    id: 'tracing',
    name: 'Tracing',

    enter() {
      this.state = 'howto';
      this.score = 0;
      this.finished = false;
      this.target = SHAPES[CM.randInt(0, SHAPES.length - 1)]();
      this.nextPt = 0;
      this.drawnPts = [];
      this.doneT = 0;
      this.parts = [];
    },

    exit() {},

    addPart(p) { this.parts.push(p); },
    sparkle(x, y, color) {
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2 + CM.rand(-0.2, 0.2);
        this.addPart({
          x: x, y: y,
          vx: Math.cos(a) * CM.rand(20, 60),
          vy: Math.sin(a) * CM.rand(20, 60) - 10,
          life: CM.rand(0.3, 0.6), size: CM.rand(3, 6), color: color
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

          if (this.nextPt < this.target.pts.length) {
            const tp = this.target.pts[this.nextPt];
            if (CM.dist(mx, my, tp.x, tp.y) < 30) {
              this.drawnPts.push({x: mx, y: my});
              this.sparkle(mx, my, this.target.color);
              
              // We could play a continuous tone, or gentle chimes
              if (this.nextPt % 5 === 0) CM.audio.play('ding');

              this.nextPt++;
              if (this.nextPt >= this.target.pts.length) {
                this.state = 'done';
                this.doneT = 2.5;
                this.score = 100;
                CM.audio.play('tada');
                for (let i=0; i<15; i++) this.sparkle(480, 260, this.target.color);
              }
            }
          }
        }
      } else if (this.state === 'done') {
        this.doneT -= dt;
        if (this.doneT <= 0 && !this.finished) {
          this.finished = true;
          CM.finishGame('tracing', this.score, 10);
        }
      }
    },

    draw(g) {
      // Background
      const wg = g.createLinearGradient(0, 0, 0, CM.H);
      wg.addColorStop(0, '#e6f7ff');
      wg.addColorStop(1, '#ccf0ff');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, CM.H);

      // Lightpad
      D.rr(g, 240, 60, 480, 400, 16, '#8fd6a0', '#6fbc82', 4);
      D.rr(g, 260, 80, 440, 360, 8, '#ffffff');

      // Target path (dotted)
      g.strokeStyle = '#cdeedd';
      g.lineWidth = 6;
      g.lineCap = 'round';
      g.lineJoin = 'round';
      g.setLineDash([10, 15]);
      g.beginPath();
      for (let i = 0; i < this.target.pts.length; i++) {
        const p = this.target.pts[i];
        if (i === 0) g.moveTo(p.x, p.y);
        else g.lineTo(p.x, p.y);
      }
      g.stroke();
      g.setLineDash([]);

      // Drawn path
      if (this.drawnPts.length > 0) {
        g.strokeStyle = this.target.color;
        g.lineWidth = 8;
        g.beginPath();
        for (let i = 0; i < this.drawnPts.length; i++) {
          const p = this.drawnPts[i];
          if (i === 0) g.moveTo(p.x, p.y);
          else g.lineTo(p.x, p.y);
        }
        g.stroke();
      }

      // Next point glow
      if (this.state === 'play' && this.nextPt < this.target.pts.length) {
        const p = this.target.pts[this.nextPt];
        const pulse = 0.5 + Math.sin(CM.time * 8) * 0.5;
        g.globalAlpha = 0.3 + pulse * 0.4;
        D.circle(g, p.x, p.y, 16, this.target.color);
        g.globalAlpha = 1.0;
        D.circle(g, p.x, p.y, 6, '#fff');
      }

      if (this.state === 'done') {
        g.fillStyle = this.target.color;
        g.globalAlpha = 0.3;
        g.beginPath();
        for (let i = 0; i < this.target.pts.length; i++) {
          const p = this.target.pts[i];
          if (i === 0) g.moveTo(p.x, p.y);
          else g.lineTo(p.x, p.y);
        }
        g.fill();
        g.globalAlpha = 1.0;
      }

      // Host
      CM.drawFriend(g, 'cinnamoroll', 160, 380, 1.2, { bob: Math.sin(CM.time * 2) * 0.2 });
      if (this.state === 'play') {
        const txt = "Trace a " + this.target.name + "!";
        D.bubble(g, 80, 220, 180, 40, 160);
        D.text(g, txt, 170, 246, { size: 14, weight: 800, color: P.blueDeep });
      }

      // Particles
      for (const p of this.parts) {
        D.star(g, p.x, p.y, p.size, p.color);
      }

      if (this.state === 'done') {
        D.rr(g, 360, 220, 240, 60, 12, 'rgba(255,255,255,0.9)', P.blueDeep, 4);
        D.text(g, 'Great Tracing! 🎉', 480, 258, { size: 24, weight: 800, color: P.blueDeep });
      }

      this.drawHud(g);
      if (this.state === 'howto') this.drawHowto(g);
    },

    drawHud(g) {
      D.rr(g, 16, 16, 40, 40, 8, '#fff', '#e0d0d8', 3);
      D.text(g, '✕', 36, 43, { size: 24, weight: 800, color: '#b9a8b3' });
      if (CM.input.mouse.clicked && CM.dist(CM.input.mouse.x, CM.input.mouse.y, 36, 36) < 30) {
        this.finished = true;
        CM.finishGame('tracing', this.score, 5);
      }
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(0,0,0,0.4)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.rr(g, 300, 200, 360, 180, 16, '#fff', P.blueDeep, 4);
      D.text(g, 'Tracing', 480, 245, { size: 28, weight: 800, color: P.blueDeep });
      D.text(g, 'Drag your finger along the', 480, 280, { size: 16, color: P.ink });
      D.text(g, 'dotted line to draw the shape!', 480, 305, { size: 16, color: P.ink });
      D.rr(g, 380, 330, 200, 36, 18, P.blue, P.blueDeep, 3);
      D.text(g, '▶ Play', 480, 354, { size: 16, weight: 800, color: '#fff' });
    }
  });
})();
