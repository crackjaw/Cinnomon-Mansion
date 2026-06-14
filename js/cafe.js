/* ============================================================
   Cinnamoroll Mansion — cafe hub
   The Cinnamoroll Cafe: cozy little eatery where you play
   Cooking-Mama-style cooking games — chopping, mixing, flipping
   pancakes, pouring drinks, frosting cupcakes and building
   sandwiches. Reached from the backyard's cafe storefront; the
   door at the top returns to the backyard. Shares movement /
   dialog / dress-up menu / pet via CM.hub.
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  // door back out to the backyard (top-centre)
  const BACK = { gate: { x: 432, y: 14, w: 96, h: 58 }, frontX: 480, frontY: 120 };

  // cooking stations (2 rows of 3) — every friend is a little chef
  const STATIONS = [
    { id: 'chop', label: 'Chop Chop!', emoji: '🔪', host: 'keroppi', x: 170, y: 232,
      line: 'Ribbit! Help me chop these up, {name}!' },
    { id: 'mixing', label: 'Mix It Up', emoji: '🥣', host: 'mymelody', x: 480, y: 224,
      line: "Let's stir the batter together, {name}!" },
    { id: 'pancake', label: "Flip 'Em!", emoji: '🥞', host: 'pompompurin', x: 792, y: 232,
      line: 'Flip the pancakes when they go golden, {name}!' },
    { id: 'pour', label: 'Pour It!', emoji: '🫖', host: 'hellokitty', x: 170, y: 474,
      line: 'Pour the drinks just right, {name}!' },
    { id: 'decorate', label: 'Frost Cupcakes', emoji: '🧁', host: 'cinnamoroll', x: 480, y: 482,
      line: "Let's decorate some cupcakes, {name}!" },
    { id: 'sandwich', label: 'Make a Sandwich', emoji: '🥪', host: 'pochacco', x: 792, y: 474,
      line: 'Build the sandwich to order, {name}!' }
  ];

  const AMBIENT = [
    { id: 'kuromi', x: 76, y: 360, barista: true },
    { id: 'badtzmaru', x: 892, y: 360, table: true }
  ];

  const BOUNDS = { x1: 30, y1: 110, x2: 930, y2: 576 };

  function overlaps(px, py) {
    return px < BOUNDS.x1 || px > BOUNDS.x2 || py < BOUNDS.y1 || py > BOUNDS.y2;
  }

  function sign(g, cx, y, emoji, label) {
    const w = 26 + label.length * 8.2;
    D.rr(g, cx - w / 2, y, w, 24, 9, '#fff', '#f0d0b0', 2.5);
    D.text(g, emoji + ' ' + label, cx, y + 12, { size: 13, color: '#cf7a3a', weight: 800 });
  }
  function heart(g, x, y, s, c) {
    g.fillStyle = c;
    g.beginPath();
    g.moveTo(x, y + 2 * s);
    g.bezierCurveTo(x - 3 * s, y - 2 * s, x - 6 * s, y + 1.5 * s, x, y + 4.5 * s);
    g.bezierCurveTo(x + 6 * s, y + 1.5 * s, x + 3 * s, y - 2 * s, x, y + 2 * s);
    g.fill();
  }

  // each station's cooking prop, drawn behind its host
  function stationProp(g, st, t) {
    const x = st.x, y = st.y;
    if (st.id === 'chop') {
      D.rr(g, x - 30, y + 12, 60, 18, 5, '#e0b27a', '#b98a4f', 2);       // cutting board
      D.rr(g, x - 22, y + 8, 26, 7, 3, '#ff9ec7', '#e87faa', 1.5);       // a veggie
      g.save(); g.translate(x + 22, y); g.rotate(-0.35 + Math.sin(t * 2) * 0.05);
      D.rr(g, -2.5, -20, 5, 22, 2, '#cdced6', '#9a9aa4', 1.5);           // blade
      D.rr(g, -3.5, 2, 7, 10, 2, '#7a5a3a', '#5a4028', 1.5);             // handle
      g.restore();
    } else if (st.id === 'mixing') {
      D.rr(g, x - 26, y + 6, 52, 26, 12, '#ffffff', '#e0c0d0', 2.5);     // bowl
      D.ellipse(g, x, y + 9, 23, 7, '#ffe6b0', '#f0cf8a', 1.5);          // batter
      g.strokeStyle = '#bcbcc4'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x + 13 + Math.sin(t * 4) * 4, y - 14); g.lineTo(x + 5, y + 6); g.stroke();
    } else if (st.id === 'pancake') {
      D.circle(g, x, y + 18, 22, '#5a5560', '#3a3640', 2);               // pan
      D.circle(g, x, y + 16, 18, '#6a6570');
      D.circle(g, x - 3, y + 14, 12, '#e8b86a', '#c98a3a', 1.5);         // pancake
      g.strokeStyle = '#3a3640'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x + 20, y + 18); g.lineTo(x + 42, y + 12); g.stroke(); // handle
    } else if (st.id === 'pour') {
      D.rr(g, x - 30, y + 2, 30, 22, 10, '#ff9ec7', '#e87faa', 2);       // teapot
      g.strokeStyle = '#e87faa'; g.lineWidth = 3.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 2, y + 8); g.lineTo(x + 12, y + 3); g.stroke(); // spout
      D.circle(g, x - 15, y + 1, 3, '#fff');                            // lid knob
      D.rr(g, x + 12, y + 16, 14, 13, 3, '#fff', '#d0c0b0', 2);          // cup
      D.rr(g, x + 30, y + 16, 14, 13, 3, '#fff', '#d0c0b0', 2);          // cup
    } else if (st.id === 'decorate') {
      D.rr(g, x - 12, y + 12, 24, 16, 3, '#e8a86a', '#c98a3a', 2);       // wrapper
      D.ellipse(g, x, y + 10, 16, 10, '#ffd9e8', '#ff9ec7', 2);         // frosting
      D.circle(g, x, y + 1, 3.5, '#ff5f8f', '#d83a6a', 1);               // cherry
      g.fillStyle = '#fff7fb';                                          // piping bag
      g.beginPath(); g.moveTo(x + 22, y - 14); g.lineTo(x + 34, y - 4); g.lineTo(x + 22, y + 2); g.closePath(); g.fill();
      g.strokeStyle = '#e0c0d0'; g.lineWidth = 1.5; g.stroke();
    } else if (st.id === 'sandwich') {
      D.ellipse(g, x, y + 24, 34, 9, '#ffffff', '#d8c8b8', 2);          // plate
      D.rr(g, x - 22, y + 8, 44, 12, 5, '#f0c27a', '#d8a24a', 2);        // bottom bread
      D.rr(g, x - 22, y + 4, 44, 6, 2, '#8fd6a0', '#6fbc82', 1.5);       // lettuce
      D.rr(g, x - 18, y, 36, 6, 2, '#ff8f8f', '#e06a6a', 1.5);           // tomato/ham
      D.rr(g, x - 22, y - 6, 44, 9, 4, '#f0c27a', '#d8a24a', 2);         // top bread
    }
  }

  CM.registerScene('cafe', {
    joystick: true,
    enter() {
      const sp = CM._cafeSpawn || { x: 480, y: 156 };
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
      CM._cafeSpawn = { x: this.p.x, y: this.p.y };
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
      if (it.type === 'back') { CM.audio.play('pop'); CM.switchScene('backyard'); return; }
      CM.audio.play('pop');
      const st = it.station;
      const name = (CM.save.character || {}).name || 'friend';
      if (CM.games[st.id]) {
        this.dialog = { host: st.host, line: st.line.replace('{name}', name), sel: 0, options: [
          { label: "▶ Let's Cook!", color: P.mintDeep, run: function () { CM.startGame(st.id); } },
          { label: 'Maybe Later', color: '#b9a8b3', run: function () {} }
        ] };
      } else {
        this.dialog = { host: st.host, line: 'This dish is still cooking… come back soon!', sel: 0, options: [
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
      wall.addColorStop(0, '#ffe9d6');
      wall.addColorStop(1, '#ffdcc2');
      g.fillStyle = wall;
      g.fillRect(0, 0, CM.W, 104);
      // wainscot trim
      g.fillStyle = '#f6c9a6';
      g.fillRect(0, 98, CM.W, 8);

      // bunting flags across the top
      const bc = ['#ff9ec7', '#8ecdf6', '#bdeccd', '#ffd24a'];
      g.strokeStyle = 'rgba(207,122,58,0.5)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 10); g.quadraticCurveTo(CM.W / 2, 22, CM.W, 10); g.stroke();
      for (let i = 0; i < 16; i++) {
        const fx = 30 + i * 60, fy = 12 + Math.sin(i) * 2;
        g.fillStyle = bc[i % 4];
        g.beginPath(); g.moveTo(fx - 8, fy); g.lineTo(fx + 8, fy); g.lineTo(fx, fy + 14); g.closePath(); g.fill();
      }

      // chalkboard menu (right of the door, in the clear gap before Dress Up)
      D.rr(g, 540, 50, 150, 48, 8, '#4d5a52', '#36433c', 3);
      D.text(g, '☕ MENU 🧁', 615, 66, { size: 15, color: '#fff7e6', weight: 800 });
      D.text(g, '🥞  🥪  🫖', 615, 86, { size: 15, color: '#ffd9e8', weight: 700 });
      // a little wall clock on the left, tucked below the coins chip
      D.circle(g, 70, 74, 18, '#fff7ee', '#e0b27a', 3);
      D.circle(g, 70, 74, 2, '#cf7a3a');
      g.strokeStyle = '#cf7a3a'; g.lineWidth = 2.5; g.lineCap = 'round';
      g.beginPath(); g.moveTo(70, 74); g.lineTo(70, 62); g.moveTo(70, 74); g.lineTo(79, 78); g.stroke();

      // ---- floor ----
      const floor = g.createLinearGradient(0, 104, 0, CM.H);
      floor.addColorStop(0, '#f3d8b6');
      floor.addColorStop(1, '#e9c79c');
      g.fillStyle = floor;
      g.fillRect(0, 104, CM.W, CM.H - 104);
      // wood planks
      g.strokeStyle = 'rgba(180,130,80,0.28)'; g.lineWidth = 2;
      for (let yy = 130; yy < CM.H; yy += 40) { g.beginPath(); g.moveTo(0, yy); g.lineTo(CM.W, yy); g.stroke(); }
      for (let i = 0; i < 40; i++) {
        const px = (i * 213) % CM.W, row = Math.floor((130 + (i % 12) * 40) / 40);
        const py = row * 40 + (row % 2 ? 20 : 0);
        if (py > 110 && py < CM.H) { g.beginPath(); g.moveTo(px, py); g.lineTo(px, py + 40); g.stroke(); }
      }
      // a soft rug in the middle
      D.ellipse(g, 480, 360, 150, 70, 'rgba(255,158,199,0.16)', 'rgba(255,158,199,0.3)', 3);

      // door back to the backyard
      const gt = BACK.gate;
      D.rr(g, gt.x - 8, gt.y - 6, gt.w + 16, gt.h + 10, 9, '#fff', '#e8c9a0', 3);
      D.rr(g, gt.x, gt.y, gt.w, gt.h, 6, '#cdeedd', '#9ecbb0', 2.5);     // glass door to the garden
      g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(gt.x + gt.w / 2, gt.y + 4); g.lineTo(gt.x + gt.w / 2, gt.y + gt.h - 4); g.stroke();
      D.circle(g, gt.x + gt.w / 2 - 6, gt.y + gt.h / 2, 3, '#e8a23a');
      D.circle(g, gt.x + gt.w / 2 + 6, gt.y + gt.h / 2, 3, '#e8a23a');
      D.rr(g, gt.x + gt.w / 2 - 56, gt.y + gt.h + 6, 112, 24, 9, '#fff', '#cfe6c4', 2.5);
      D.text(g, '🌳 Backyard', gt.x + gt.w / 2, gt.y + gt.h + 18, { size: 13, color: CM.palette.mintDeep, weight: 800 });

      // ---- depth-sorted sprites ----
      const sprites = [];

      // stations
      for (let i = 0; i < STATIONS.length; i++) {
        const st = STATIONS[i];
        sprites.push({ y: st.y, fn: () => {
          stationProp(g, st, t);
          CM.drawFriend(g, st.host, st.x, st.y, 1.05, { bob: ((t * 0.8 + i * 0.3) % 1) * 0.4, flip: st.x > 480 });
          // a tiny chef's apron hint (a little bow at the waist)
          D.circle(g, st.x, st.y - 6, 2.5, '#ff9ec7');
          sign(g, st.x, st.y + 8, st.emoji, st.label);
        } });
      }

      // ambient friends
      for (let i = 0; i < AMBIENT.length; i++) {
        const a = AMBIENT[i];
        sprites.push({ y: a.y, fn: () => {
          if (a.barista) {
            // a little espresso counter
            D.rr(g, a.x - 30, a.y + 2, 60, 30, 6, '#d9a06a', '#b97f48', 2.5);
            D.rr(g, a.x - 30, a.y - 2, 60, 8, 3, '#f0c79a');
            D.rr(g, a.x + 8, a.y - 20, 18, 22, 4, '#bcbcc4', '#9a9aa4', 2); // espresso machine
            D.circle(g, a.x + 17, a.y - 12, 3, '#ff5f8f');
            for (let s = 0; s < 3; s++) {                                  // steam
              const sy = a.y - 24 - ((t * 0.6 + s / 3) % 1) * 16;
              g.globalAlpha = 0.4 * (1 - ((t * 0.6 + s / 3) % 1));
              D.circle(g, a.x + 17 + Math.sin(t * 3 + s) * 3, sy, 3, '#fff');
              g.globalAlpha = 1;
            }
          } else if (a.table) {
            // a cafe table with a cup
            D.ellipse(g, a.x, a.y + 16, 34, 12, '#e0b27a', '#b98a4f', 2.5);
            D.rr(g, a.x - 4, a.y + 16, 8, 20, 2, '#b98a4f');
            D.rr(g, a.x + 6, a.y + 2, 14, 12, 3, '#fff', '#d0c0b0', 2);     // a cup
          }
          CM.drawFriend(g, a.id, a.x, a.y, 0.95, { bob: ((t * 0.7 + i * 0.4) % 1) * 0.3, flip: a.x > 480 });
          const nm = CM.FRIENDS[a.id].name;
          D.rr(g, a.x - 42, a.y + 14, 84, 18, 9, 'rgba(255,255,255,0.82)');
          D.text(g, nm, a.x, a.y + 23, { size: 11, color: CM.palette.ink, weight: 800 });
        } });
      }

      // potted plants in the corners
      sprites.push({ y: 150, fn: () => {
        D.rr(g, 44, 132, 26, 22, 4, '#e08a6a', '#c06a4a', 2);
        D.circle(g, 47, 126, 12, '#8fd6a0', '#6fbc82', 2);
        D.circle(g, 67, 126, 12, '#8fd6a0', '#6fbc82', 2);
        D.circle(g, 57, 116, 13, '#a5dfae');
      } });

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
          D.text(g, '🌳 Back to backyard', BACK.frontX, BACK.frontY + 22, { size: 13, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to go' : 'press SPACE to go', BACK.frontX, BACK.frontY + 39, { size: 12, color: CM.palette.mintDeep });
        } else {
          const st = near.station;
          const bx = CM.clamp(st.x - 80, 8, CM.W - 168);
          D.bubble(g, bx, st.y - 150, 160, 48, st.x);
          D.text(g, st.emoji + ' ' + st.label + '!', bx + 80, st.y - 133, { size: 15, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to cook' : 'press SPACE to cook', bx + 80, st.y - 115, { size: 12, color: '#cf7a3a' });
        }
      }

      // ---- HUD + overlays ----
      const hint = CM.touchMode
        ? 'Drag to walk  ·  ★ to cook  ·  🌳 backyard  ·  👗 dress up'
        : 'Walk: click / WASD   ·   Cook: SPACE   ·   🌳 Backyard   ·   👗 Dress Up';
      CM.hub.drawHud(this, g, hint);
      if (this.dialog) CM.hub.drawDialog(this, g, t);
      if (this.menu) CM.hub.drawMenu(this, g);
    }
  });
})();
