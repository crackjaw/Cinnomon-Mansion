/* ============================================================
   Cinnamoroll Mansion — art studio hub
   The Art Studio: a colorful creative space where you play
   art-focused mini-games (coloring, pottery, spin art, etc).
   Reached from the backyard; the door at the top returns.
   Shares movement / dialog / dress-up menu / pet via CM.hub.
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  // door back out to the town map (top-centre)
  const BACK = { gate: { x: 432, y: 14, w: 96, h: 58 }, frontX: 480, frontY: 120 };

  // art stations (2 rows of 3)
  const STATIONS = [
    { id: 'coloring', label: 'Coloring', emoji: '🖍️', host: 'hellokitty', x: 170, y: 232,
      line: 'Let\'s color a beautiful picture, {name}!' },
    { id: 'pottery', label: 'Pottery', emoji: '🏺', host: 'pompompurin', x: 480, y: 224,
      line: "Help me shape this clay, {name}!" },
    { id: 'spinart', label: 'Spin Art', emoji: '🎨', host: 'badtzmaru', x: 792, y: 232,
      line: 'Heh… let\'s make a messy masterpiece, {name}!' },
    { id: 'beadart', label: 'Bead Art', emoji: '✨', host: 'mymelody', x: 170, y: 474,
      line: 'Place the beads to make a cute pattern, {name}!' },
    { id: 'tracing', label: 'Tracing', emoji: '✏️', host: 'cinnamoroll', x: 480, y: 482,
      line: "Follow the lines carefully, {name}!" },
    { id: 'stickers', label: 'Stickers', emoji: '⭐', host: 'pochacco', x: 792, y: 474,
      line: 'Let\'s decorate with stickers, {name}!' }
  ];

  const AMBIENT = [
    { id: 'keroppi', x: 86, y: 360, painting: true },
    { id: 'kuromi', x: 880, y: 360, critic: true }
  ];

  const BOUNDS = { x1: 30, y1: 110, x2: 930, y2: 576 };

  function overlaps(px, py) {
    return px < BOUNDS.x1 || px > BOUNDS.x2 || py < BOUNDS.y1 || py > BOUNDS.y2;
  }

  function sign(g, cx, y, emoji, label) {
    const w = 26 + label.length * 8.2;
    D.rr(g, cx - w / 2, y, w, 24, 9, '#fff', '#e8c8f0', 2.5);
    D.text(g, emoji + ' ' + label, cx, y + 12, { size: 13, color: '#9a6ab3', weight: 800 });
  }

  // each station's prop
  function stationProp(g, st, t) {
    const x = st.x, y = st.y;
    if (st.id === 'coloring') {
      // an easel
      g.strokeStyle = '#b98a4f'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 20, y + 24); g.lineTo(x, y - 20); g.lineTo(x + 20, y + 24); g.stroke();
      g.beginPath(); g.moveTo(x, y - 10); g.lineTo(x, y + 30); g.stroke();
      D.rr(g, x - 26, y - 16, 52, 36, 4, '#fff', '#d0c0b0', 2);
      // a drawing on it
      D.circle(g, x, y - 2, 8, '#ff9ec7');
    } else if (st.id === 'pottery') {
      // pottery wheel
      D.ellipse(g, x, y + 24, 30, 10, '#9a9aa4', '#7a7a84', 2);
      D.ellipse(g, x, y + 18, 26, 8, '#cdced6', '#9a9aa4', 2);
      // a lump of clay
      D.rr(g, x - 14, y - 6, 28, 26, 8, '#d8a774', '#b9854f', 2);
      D.ellipse(g, x, y - 6, 14, 6, '#e8c191');
    } else if (st.id === 'spinart') {
      // spin art box
      D.rr(g, x - 26, y + 6, 52, 20, 4, '#5a5560', '#3a3640', 2);
      D.ellipse(g, x, y + 6, 22, 8, '#ffe6b0'); // paper inside
      // some paint splashes
      D.circle(g, x - 6, y + 6, 4, '#ff5f8f');
      D.circle(g, x + 8, y + 4, 3, '#8ecdf6');
      D.circle(g, x + 2, y + 8, 3, '#ffe07a');
    } else if (st.id === 'beadart') {
      // a little pegboard
      D.rr(g, x - 24, y + 10, 48, 24, 4, '#fff', '#ffd9e8', 2);
      for (let bx = -16; bx <= 16; bx += 8) {
        for (let by = 16; by <= 28; by += 8) {
          D.circle(g, x + bx, y + by, 2, '#e0c0d0');
        }
      }
      D.circle(g, x - 8, y + 16, 3.5, '#ff9ec7');
      D.circle(g, x, y + 16, 3.5, '#ffd24a');
      D.circle(g, x + 8, y + 24, 3.5, '#8ecdf6');
    } else if (st.id === 'tracing') {
      // a lightpad
      D.rr(g, x - 28, y + 14, 56, 16, 4, '#8fd6a0', '#6fbc82', 2);
      D.rr(g, x - 24, y + 12, 48, 14, 2, '#eafff0');
      g.strokeStyle = '#a5dfae'; g.lineWidth = 2; g.setLineDash([3, 3]);
      g.beginPath(); g.moveTo(x - 14, y + 19); g.lineTo(x + 14, y + 19); g.stroke();
      g.setLineDash([]);
    } else if (st.id === 'stickers') {
      // a scrapbook
      D.rr(g, x - 28, y + 10, 56, 20, 2, '#fff', '#e8a9c8', 2);
      g.strokeStyle = '#b9a8b3'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x, y + 10); g.lineTo(x, y + 30); g.stroke(); // spine
      D.star(g, x - 12, y + 20, 4, '#ffd24a');
      D.circle(g, x + 12, y + 18, 3, '#ff9ec7');
    }
  }

  CM.registerScene('artstudio', {
    joystick: true,
    enter() {
      const sp = CM._artstudioSpawn || { x: 480, y: 156 };
      this.p = { x: sp.x, y: sp.y, facing: 'down', phase: 0 };
      this.dialog = null;
      this.menu = false;
      this.target = null;
      this.BOUNDS = BOUNDS;
      this.overlaps = overlaps;
      CM.hub.initPet(this);
      CM.audio.music('mansion');
    },
    exit() {
      CM._artstudioSpawn = { x: this.p.x, y: this.p.y };
    },

    nearestInteract() {
      let best = null, bestDist = 76;
      for (const st of STATIONS) {
        const d = CM.dist(this.p.x, this.p.y, st.x, st.y);
        if (d < bestDist) { bestDist = d; best = { type: 'station', station: st }; }
      }
      const bd = CM.dist(this.p.x, this.p.y, BACK.frontX, BACK.frontY);
      if (bd < 72 && bd < bestDist) best = { type: 'back' };
      return best;
    },

    clickInteract(mx, my) {
      for (const st of STATIONS) {
        if (CM.dist(mx, my, st.x, st.y - 30) < 60) return { type: 'station', station: st };
      }
      if (mx > BACK.gate.x - 16 && mx < BACK.gate.x + BACK.gate.w + 16 && my < BACK.gate.y + BACK.gate.h + 30) {
        return { type: 'back' };
      }
      return null;
    },

    interactAnchor(it) {
      if (it.type === 'back') return { x: BACK.frontX, y: BACK.frontY, reach: 72 };
      return { x: it.station.x, y: it.station.y + 22, reach: 80 };
    },

    triggerInteract(it) {
      const P = CM.palette;
      if (it.type === 'back') { CM.audio.play('pop'); CM.switchScene('town'); return; }
      CM.audio.play('pop');
      const st = it.station;
      const name = (CM.save.character || {}).name || 'friend';
      if (CM.games[st.id]) {
        this.dialog = { host: st.host, line: st.line.replace('{name}', name), sel: 0, options: [
          { label: "▶ Let's Create!", color: '#9a6ab3', run: function () { CM.startGame(st.id); } },
          { label: 'Maybe Later', color: '#b9a8b3', run: function () {} }
        ] };
      } else {
        this.dialog = { host: st.host, line: 'This art station is still being set up… come back soon!', sel: 0, options: [
          { label: 'OK!', color: P.blueDeep, run: function () {} }
        ] };
      }
    },

    update(dt) {
      CM.hub.update(this, dt);
    },

    draw(g) {
      const t = CM.time;

      // ---- walls ----
      const wall = g.createLinearGradient(0, 0, 0, 120);
      wall.addColorStop(0, '#f2e6ff');
      wall.addColorStop(1, '#e3ccff');
      g.fillStyle = wall;
      g.fillRect(0, 0, CM.W, 104);
      // wainscot trim
      g.fillStyle = '#ccb3e6';
      g.fillRect(0, 98, CM.W, 8);

      // bunting flags across the top
      const bc = ['#ff9ec7', '#8ecdf6', '#bdeccd', '#ffd24a', '#c9a8f0'];
      g.strokeStyle = 'rgba(154,106,179,0.5)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 10); g.quadraticCurveTo(CM.W / 2, 22, CM.W, 10); g.stroke();
      for (let i = 0; i < 16; i++) {
        const fx = 30 + i * 60, fy = 12 + Math.sin(i) * 2;
        g.fillStyle = bc[i % 5];
        g.beginPath(); g.moveTo(fx - 8, fy); g.lineTo(fx + 8, fy); g.lineTo(fx, fy + 14); g.closePath(); g.fill();
      }

      // art supplies shelves on the walls
      D.rr(g, 70, 50, 120, 10, 4, '#e8c8a8', '#c9a47e', 2);
      D.rr(g, 90, 36, 16, 14, 2, '#ff9ec7'); // paint pot
      D.rr(g, 120, 32, 16, 18, 2, '#8ecdf6');
      D.rr(g, 150, 40, 16, 10, 2, '#ffd24a');
      
      D.rr(g, 740, 50, 120, 10, 4, '#e8c8a8', '#c9a47e', 2);
      D.circle(g, 760, 40, 8, '#bdeccd'); // yarn balls
      D.circle(g, 780, 40, 8, '#c9a8f0');
      D.circle(g, 820, 36, 10, '#ff9ec7');

      // ---- floor ----
      // a colorful splattered floor
      g.fillStyle = '#fff9f0';
      g.fillRect(0, 104, CM.W, CM.H - 104);
      // subtle tiles
      g.strokeStyle = 'rgba(230,220,240,0.5)'; g.lineWidth = 2;
      for (let yy = 130; yy < CM.H; yy += 40) { g.beginPath(); g.moveTo(0, yy); g.lineTo(CM.W, yy); g.stroke(); }
      for (let xx = 0; xx < CM.W; xx += 40) { g.beginPath(); g.moveTo(xx, 110); g.lineTo(xx, CM.H); g.stroke(); }
      
      // paint splatters on the floor
      const splatters = [
        {x: 100, y: 150, c: '#ff9ec7', s: 12}, {x: 240, y: 380, c: '#8ecdf6', s: 16},
        {x: 820, y: 180, c: '#ffd24a', s: 14}, {x: 700, y: 500, c: '#bdeccd', s: 18},
        {x: 400, y: 320, c: '#c9a8f0', s: 20}, {x: 550, y: 140, c: '#ffb380', s: 10}
      ];
      for (const splat of splatters) {
        g.fillStyle = splat.c;
        g.globalAlpha = 0.6;
        g.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = i * Math.PI / 3;
          const r = splat.s * (0.5 + Math.random() * 0.5);
          if (i===0) g.moveTo(splat.x + Math.cos(a)*r, splat.y + Math.sin(a)*r*0.5);
          else g.lineTo(splat.x + Math.cos(a)*r, splat.y + Math.sin(a)*r*0.5);
        }
        g.fill();
        g.globalAlpha = 1.0;
      }

      // door back to the backyard
      const gt = BACK.gate;
      D.rr(g, gt.x - 8, gt.y - 6, gt.w + 16, gt.h + 10, 9, '#fff', '#e6c79a', 3);
      D.rr(g, gt.x, gt.y, gt.w, gt.h, 6, '#cdeedd', '#9ecbb0', 2.5);
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(gt.x + gt.w / 2, gt.y + 4); g.lineTo(gt.x + gt.w / 2, gt.y + gt.h - 4); g.stroke();
      D.circle(g, gt.x + gt.w / 2 - 6, gt.y + gt.h / 2, 3, '#e8a23a');
      D.circle(g, gt.x + gt.w / 2 + 6, gt.y + gt.h / 2, 3, '#e8a23a');
      D.rr(g, gt.x + gt.w / 2 - 56, gt.y + gt.h + 6, 112, 24, 9, '#fff', '#cfe6c4', 2.5);
      D.text(g, '🗺 Town', gt.x + gt.w / 2, gt.y + gt.h + 18, { size: 13, color: CM.palette.mintDeep, weight: 800 });

      // ---- depth-sorted sprites ----
      const sprites = [];

      // stations
      for (let i = 0; i < STATIONS.length; i++) {
        const st = STATIONS[i];
        sprites.push({ y: st.y, fn: () => {
          stationProp(g, st, t);
          CM.drawFriend(g, st.host, st.x, st.y, 1.05, { bob: ((t * 0.8 + i * 0.3) % 1) * 0.4, flip: st.x > 480 });
          // a tiny smock hint (a little splash of paint on them)
          D.circle(g, st.x + 8, st.y - 8, 3, ['#ff9ec7', '#8ecdf6', '#ffd24a'][i % 3]);
          sign(g, st.x, st.y + 8, st.emoji, st.label);
        } });
      }

      // ambient friends
      for (let i = 0; i < AMBIENT.length; i++) {
        const a = AMBIENT[i];
        sprites.push({ y: a.y, fn: () => {
          if (a.painting) {
            // an easel in front of Keroppi
            D.rr(g, a.x - 20, a.y + 12, 40, 24, 4, '#e8c8a8', '#c9a47e', 2);
            D.circle(g, a.x, a.y + 20, 6, '#8fd6a0');
          } else if (a.critic) {
            // Kuromi looking at a sculpture
            D.ellipse(g, a.x - 24, a.y + 16, 20, 8, '#9a9aa4', '#7a7a84', 2); // pedestal
            D.rr(g, a.x - 30, a.y - 4, 12, 20, 6, '#e8c191', '#b9854f', 2); // sculpture
          }
          CM.drawFriend(g, a.id, a.x, a.y, 0.95, { bob: ((t * 0.7 + i * 0.4) % 1) * 0.3, flip: a.x > 480 });
          const nm = CM.FRIENDS[a.id].name;
          D.rr(g, a.x - 42, a.y + 14, 84, 18, 9, 'rgba(255,255,255,0.82)');
          D.text(g, nm, a.x, a.y + 23, { size: 11, color: CM.palette.ink, weight: 800 });
        } });
      }

      // pet + player
      if (this.petObj) sprites.push({ y: this.petObj.y, fn: () => CM.hub.drawPetSprite(this, g, t) });
      sprites.push({ y: this.p.y, fn: () => CM.drawPlayer(g, this.p.x, this.p.y, 1.05, this.p.facing, this.p.phase) });

      sprites.sort((a, b) => a.y - b.y);
      for (const s of sprites) s.fn();

      CM.hub.drawTargetMarker(this, g);

      // ---- prompts ----
      const near = (this.dialog || this.menu) ? null : this.nearestInteract();
      if (near) {
        if (near.type === 'back') {
          D.bubble(g, BACK.frontX - 80, BACK.frontY + 6, 160, 44, BACK.frontX);
          D.text(g, '🗺 Back to Town', BACK.frontX, BACK.frontY + 22, { size: 13, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to go' : 'press SPACE to go', BACK.frontX, BACK.frontY + 39, { size: 12, color: CM.palette.mintDeep });
        } else {
          const st = near.station;
          const bx = CM.clamp(st.x - 80, 8, CM.W - 168);
          D.bubble(g, bx, st.y - 150, 160, 48, st.x);
          D.text(g, st.emoji + ' ' + st.label + '!', bx + 80, st.y - 133, { size: 15, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to create' : 'press SPACE to create', bx + 80, st.y - 115, { size: 12, color: '#9a6ab3' });
        }
      }

      // ---- HUD + overlays ----
      const hint = CM.touchMode
        ? 'Drag to walk  ·  ★ to create  ·  🗺 town  ·  👗 dress up'
        : 'Walk: click / WASD   ·   Create: SPACE   ·   🗺 Town   ·   👗 Dress Up';
      CM.hub.drawHud(this, g, hint);
      if (this.dialog) CM.hub.drawDialog(this, g, t);
      if (this.menu) CM.hub.drawMenu(this, g);
    }
  });
})();
