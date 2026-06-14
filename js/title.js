/* ============================================================
   Cinnamoroll Mansion — title screen
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  const clouds = [
    { x: 120, y: 80, s: 1.2, v: 12 },
    { x: 500, y: 50, s: 0.8, v: 8 },
    { x: 800, y: 110, s: 1.0, v: 15 },
    { x: 300, y: 150, s: 0.6, v: 10 }
  ];
  const sparkles = [];
  for (let i = 0; i < 18; i++) {
    sparkles.push({ x: Math.random() * 960, y: Math.random() * 380, ph: Math.random() * 7, s: 4 + Math.random() * 6 });
  }

  function cloud(g, x, y, s) {
    g.fillStyle = 'rgba(255,255,255,0.9)';
    D.ellipse(g, x, y, 42 * s, 20 * s, 'rgba(255,255,255,0.9)');
    D.ellipse(g, x - 28 * s, y + 6 * s, 26 * s, 14 * s, 'rgba(255,255,255,0.9)');
    D.ellipse(g, x + 30 * s, y + 5 * s, 28 * s, 15 * s, 'rgba(255,255,255,0.9)');
  }

  function mansion(g) {
    g.save();
    g.translate(480, 0);
    // main body
    D.rr(g, -240, 220, 480, 220, 8, '#ffd9e8', '#e8a9c6', 4);
    // roof
    g.fillStyle = '#8ecdf6';
    g.beginPath();
    g.moveTo(-265, 225); g.lineTo(0, 130); g.lineTo(265, 225);
    g.closePath(); g.fill();
    g.strokeStyle = '#5da4d6'; g.lineWidth = 4; g.stroke();
    // towers
    D.rr(g, -310, 260, 70, 180, 6, '#ffd9e8', '#e8a9c6', 4);
    D.rr(g, 240, 260, 70, 180, 6, '#ffd9e8', '#e8a9c6', 4);
    g.fillStyle = '#8ecdf6';
    g.beginPath(); g.moveTo(-320, 265); g.lineTo(-275, 205); g.lineTo(-230, 265); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(230, 265); g.lineTo(275, 205); g.lineTo(320, 265); g.closePath(); g.fill();
    // door
    D.rr(g, -40, 330, 80, 110, 14, '#b97a4e', '#96603a', 4);
    D.circle(g, 22, 390, 5, '#f6cf5a');
    g.beginPath();
    g.fillStyle = '#ffd9e8';
    g.arc(0, 332, 40, Math.PI, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#e8a9c6'; g.lineWidth = 4;
    g.beginPath(); g.arc(0, 332, 40, Math.PI, Math.PI * 2); g.stroke();
    // windows
    for (const wx of [-180, -110, 110, 180]) {
      D.rr(g, wx - 24, 270, 48, 56, 8, '#cdeaff', '#fff', 5);
      g.strokeStyle = '#fff'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(wx, 274); g.lineTo(wx, 322); g.stroke();
      g.beginPath(); g.moveTo(wx - 20, 298); g.lineTo(wx + 20, 298); g.stroke();
    }
    // heart window in roof
    D.heart(g, 0, 192, 16, '#fff');
    // bushes
    for (const bx of [-290, -210, 210, 290]) {
      D.ellipse(g, bx, 445, 36, 20, '#8fd6a0');
    }
    g.restore();
  }

  CM.registerScene('title', {
    enter() {
      CM.audio.music('mansion');
    },
    update(dt) {
      for (const c of clouds) {
        c.x += c.v * dt;
        if (c.x > 1030) c.x = -80;
      }
    },
    draw(g) {
      const grad = g.createLinearGradient(0, 0, 0, CM.H);
      grad.addColorStop(0, '#aedcff');
      grad.addColorStop(0.7, '#e3f3ff');
      grad.addColorStop(1, '#d2f0d8');
      g.fillStyle = grad;
      g.fillRect(0, 0, CM.W, CM.H);
      for (const c of clouds) cloud(g, c.x, c.y, c.s);
      // lawn
      g.fillStyle = '#a5dfae';
      g.fillRect(0, 440, CM.W, 160);
      g.fillStyle = '#8fd6a0';
      D.ellipse(g, 480, 445, 560, 18, '#8fd6a0');
      mansion(g);
      // path
      g.fillStyle = '#f3e0c8';
      g.beginPath();
      g.moveTo(440, 440); g.lineTo(520, 440); g.lineTo(580, 600); g.lineTo(380, 600);
      g.closePath(); g.fill();
      // friends out front
      const b1 = (CM.time * 0.9) % 1;
      const b2 = (CM.time * 0.9 + 0.4) % 1;
      CM.drawFriend(g, 'cinnamoroll', 320, 520, 1.25, { bob: b1 });
      CM.drawFriend(g, 'hellokitty', 645, 520, 1.25, { bob: b2, flip: true });
      CM.drawFriend(g, 'mymelody', 180, 555, 1.1, { bob: (CM.time * 0.7) % 1 });
      CM.drawFriend(g, 'pompompurin', 790, 555, 1.1, { bob: (CM.time * 0.8 + 0.2) % 1, flip: true });
      // sparkles
      for (const sp of sparkles) {
        const a = 0.4 + 0.6 * Math.abs(Math.sin(CM.time * 1.5 + sp.ph));
        g.globalAlpha = a;
        D.star(g, sp.x, sp.y, sp.s, '#fff');
        g.globalAlpha = 1;
      }
      // logo
      const wob = Math.sin(CM.time * 1.4) * 0.02;
      g.save();
      g.translate(480, 95);
      g.rotate(wob);
      D.text(g, 'Cinnamoroll', 0, -18, { size: 64, color: '#f06292', stroke: '#fff', strokeWidth: 12, weight: 800 });
      D.text(g, '🎀 MANSION 🎀', 0, 40, { size: 36, color: '#4a9fdc', stroke: '#fff', strokeWidth: 10, weight: 800 });
      g.restore();
      D.text(g, 'Play games with all your Hello Kitty friends!', 480, 165, { size: 19, color: '#5a6b85', stroke: 'rgba(255,255,255,0.8)', strokeWidth: 6 });

      // buttons
      const hasChar = !!CM.save.character;
      if (hasChar) {
        if (CM.ui.button(g, 355, 480, 250, 56, '▶  Continue', { color: CM.palette.pinkDeep, size: 24 })) {
          CM.switchScene('mansion');
          return;
        }
        if (CM.ui.button(g, 380, 545, 200, 40, 'New Character', { color: CM.palette.blueDeep, size: 17 })) {
          CM.switchScene('creator', { fresh: true });
          return;
        }
      } else {
        if (CM.ui.button(g, 355, 495, 250, 62, '▶  Start!', { color: CM.palette.pinkDeep, size: 28 })) {
          CM.switchScene('creator', { fresh: true });
          return;
        }
      }
      D.text(g, 'A fan-made game, just for fun', 480, 17, { size: 13, color: 'rgba(90,107,133,0.7)' });
    }
  });
})();
