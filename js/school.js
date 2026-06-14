/* ============================================================
   Cinnamoroll Mansion — school hub
   The schoolyard: ride to school, then learn with counting,
   adding, letters, spelling and shapes. Reached from the
   backyard's school gate; the gate at the top returns to the
   backyard. Shares movement / dialog / dress-up menu / pet via CM.hub.
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  // gate back to the backyard (top-centre)
  const BACK = { gate: { x: 432, y: 14, w: 96, h: 58 }, frontX: 480, frontY: 118 };

  // learning stations (2 rows of 3)
  const STATIONS = [
    { id: 'counting', label: 'Counting Fun', emoji: '🔢', host: 'mymelody', x: 170, y: 232,
      line: "Let's count together, {name}!" },
    { id: 'addition', label: 'Add It Up', emoji: '➕', host: 'pompompurin', x: 480, y: 224,
      line: 'Can you add the numbers, {name}?' },
    { id: 'letters', label: 'ABC Match', emoji: '🔤', host: 'hellokitty', x: 792, y: 232,
      line: 'Time for our ABCs, {name}!' },
    { id: 'ride', label: 'Ride to School', emoji: '🏍️', host: 'badtzmaru', x: 170, y: 474,
      line: 'Hop on — race me to school, {name}!' },
    { id: 'spelling', label: 'Spell It Out', emoji: '✏️', host: 'cinnamoroll', x: 480, y: 482,
      line: "Let's spell some little words, {name}!" },
    { id: 'shapes', label: 'Shapes & Patterns', emoji: '🔷', host: 'keroppi', x: 792, y: 474,
      line: 'Ribbit! What shape comes next, {name}?' }
  ];

  const AMBIENT = [
    { id: 'pochacco', x: 76, y: 372, desk: true },
    { id: 'kuromi', x: 892, y: 372, flag: true }
  ];

  const BOUNDS = { x1: 30, y1: 110, x2: 930, y2: 576 };
  const SOLIDS = [];

  function overlaps(px, py) {
    return px < BOUNDS.x1 || px > BOUNDS.x2 || py < BOUNDS.y1 || py > BOUNDS.y2;
  }

  function sign(g, cx, y, emoji, label) {
    const w = 26 + label.length * 8.2;
    D.rr(g, cx - w / 2, y, w, 24, 9, '#fff', '#f0d0b0', 2.5);
    D.text(g, emoji + ' ' + label, cx, y + 12, { size: 13, color: '#cf7a3a', weight: 800 });
  }
  function flower(g, x, y, c) {
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; D.circle(g, x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5, 3.2, c); }
    D.circle(g, x, y, 2.4, '#ffe07a');
  }
  function block(g, x, y, ch, c) {
    D.rr(g, x - 9, y - 18, 18, 18, 3, c, 'rgba(0,0,0,0.12)', 1.5);
    D.text(g, ch, x, y - 9, { size: 13, color: '#fff', weight: 800, stroke: 'rgba(0,0,0,0.15)', strokeWidth: 2 });
  }

  // each station's school prop, drawn behind its host
  function stationProp(g, st, t) {
    const x = st.x, y = st.y;
    if (st.id === 'counting') {
      block(g, x - 30, y + 24, '1', '#ff9ec7'); block(g, x - 11, y + 24, '2', '#8ecdf6'); block(g, x + 8, y + 24, '3', '#bdeccd');
    } else if (st.id === 'addition') {
      D.rr(g, x - 34, y - 12, 68, 40, 5, '#5a7d54', '#41603c', 3); // mini chalkboard
      D.text(g, '1 + 1', x, y + 8, { size: 18, color: '#fff', weight: 800 });
    } else if (st.id === 'letters') {
      block(g, x - 30, y + 24, 'A', '#ffd24a'); block(g, x - 11, y + 24, 'B', '#ff9ec7'); block(g, x + 8, y + 24, 'C', '#8ecdf6');
    } else if (st.id === 'spelling') {
      D.rr(g, x - 30, y + 8, 60, 22, 4, '#fff7e6', '#e8c9a0', 2); // a word card
      D.text(g, 'c a t', x, y + 19, { size: 15, color: CM.palette.pinkDeep, weight: 800 });
    } else if (st.id === 'shapes') {
      D.circle(g, x - 26, y + 22, 9, '#ff9ec7');
      D.rr(g, x - 6, y + 13, 18, 18, 3, '#8ecdf6');
      g.fillStyle = '#bdeccd'; g.beginPath(); g.moveTo(x + 26, y + 12); g.lineTo(x + 35, y + 30); g.lineTo(x + 17, y + 30); g.closePath(); g.fill();
    } else if (st.id === 'ride') {
      // a parked little motorbike
      const bx = x - 4, by = y + 24;
      D.circle(g, bx - 16, by, 9, '#3a3a3a', '#222', 2); D.circle(g, bx - 16, by, 3, '#888');
      D.circle(g, bx + 16, by, 9, '#3a3a3a', '#222', 2); D.circle(g, bx + 16, by, 3, '#888');
      D.rr(g, bx - 18, by - 14, 36, 12, 5, '#ef5b5b', '#c93b3b', 2);
      D.rr(g, bx + 10, by - 22, 4, 12, 2, '#3a3a3a');
    }
  }

  CM.registerScene('school', {
    joystick: true,
    enter() {
      const sp = CM._schoolSpawn || { x: 480, y: 154 };
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
      CM._schoolSpawn = { x: this.p.x, y: this.p.y };
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
          { label: "▶ Let's Go!", color: P.mintDeep, run: function () { CM.startGame(st.id); } },
          { label: 'Maybe Later', color: '#b9a8b3', run: function () {} }
        ] };
      } else {
        this.dialog = { host: st.host, line: 'This lesson is still being set up… come back soon!', sel: 0, options: [
          { label: 'OK!', color: P.blueDeep, run: function () {} }
        ] };
      }
    },

    update(dt) {
      CM.hub.update(this, dt);
    },

    draw(g) {
      const t = CM.time;
      // sky
      const sky = g.createLinearGradient(0, 0, 0, 120);
      sky.addColorStop(0, '#aedcff');
      sky.addColorStop(1, '#e7f3df');
      g.fillStyle = sky;
      g.fillRect(0, 0, CM.W, 120);
      for (const c of [[200, 36, 0.9], [700, 28, 0.7]]) {
        const cx = (c[0] + t * 5) % (CM.W + 120) - 60;
        D.ellipse(g, cx, c[1], 38 * c[2], 17 * c[2], 'rgba(255,255,255,0.92)');
        D.ellipse(g, cx + 24 * c[2], c[1] + 5, 24 * c[2], 13 * c[2], 'rgba(255,255,255,0.92)');
      }

      // schoolhouse facade across the top
      g.fillStyle = '#ffd0c0';
      g.fillRect(0, 16, CM.W, 56);
      g.fillStyle = '#ef8f6f';
      g.fillRect(0, 8, CM.W, 14);
      // bell tower
      D.rr(g, 70, -2, 44, 40, 4, '#ffe1d6', '#e8a890', 2);
      g.fillStyle = '#ef8f6f'; g.beginPath(); g.moveTo(66, 4); g.lineTo(92, -16); g.lineTo(118, 4); g.closePath(); g.fill();
      D.circle(g, 92, 18, 7, '#f6cf5a', '#d8941f', 2);
      // SCHOOL banner
      D.rr(g, 700, 24, 150, 26, 8, '#fff', '#f0b9d2', 2.5);
      D.text(g, '🏫 SCHOOL', 775, 37, { size: 16, color: CM.palette.pinkDeep, weight: 800 });
      // windows
      for (const wx of [320, 410, 560, 650]) {
        D.rr(g, wx - 20, 28, 40, 32, 5, '#cdeaff', '#fff', 3);
        g.strokeStyle = '#fff'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(wx, 30); g.lineTo(wx, 58); g.moveTo(wx - 18, 44); g.lineTo(wx + 18, 44); g.stroke();
      }

      // schoolyard ground
      const grd = g.createLinearGradient(0, 110, 0, CM.H);
      grd.addColorStop(0, '#c7e6a8');
      grd.addColorStop(1, '#b3dd96');
      g.fillStyle = grd;
      g.fillRect(0, 110, CM.W, CM.H - 110);
      // a path / blacktop strip across the middle
      g.fillStyle = 'rgba(200,200,210,0.35)';
      g.fillRect(0, 350, CM.W, 36);
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 3; g.setLineDash([18, 14]);
      g.beginPath(); g.moveTo(0, 368); g.lineTo(CM.W, 368); g.stroke();
      g.setLineDash([]);

      // back gate (to the backyard)
      const gt = BACK.gate;
      D.rr(g, gt.x - 6, gt.y - 4, gt.w + 12, gt.h + 8, 9, '#fff', '#cfe6c4', 3);
      const pw = (gt.w - 6) / 2;
      for (let i = 0; i < 2; i++) D.rr(g, gt.x + 2 + i * (pw + 2), gt.y, pw, gt.h, 6, '#bfe8c8', '#8fce9d', 2);
      D.circle(g, gt.x + gt.w / 2, gt.y + gt.h / 2, 3.5, '#ffd24a');
      D.rr(g, gt.x + gt.w / 2 - 56, gt.y + gt.h + 6, 112, 24, 9, '#fff', '#cfe6c4', 2.5);
      D.text(g, '🌳 Backyard', gt.x + gt.w / 2, gt.y + gt.h + 18, { size: 13, color: CM.palette.mintDeep, weight: 800 });

      // flowers
      const fc = ['#ff9ec7', '#fff', '#ffd24a', '#c9a8f0'];
      for (let i = 0; i < 12; i++) flower(g, (i * 251 + 80) % CM.W, 150 + ((i * 83) % 380), fc[i % 4]);

      // ---- depth-sorted sprites ----
      const sprites = [];

      // stations
      for (let i = 0; i < STATIONS.length; i++) {
        const st = STATIONS[i];
        sprites.push({ y: st.y, fn: () => {
          stationProp(g, st, t);
          CM.drawFriend(g, st.host, st.x, st.y, 1.05, { bob: ((t * 0.8 + i * 0.3) % 1) * 0.4, flip: st.x > 480 });
          sign(g, st.x, st.y + 8, st.emoji, st.label);
        } });
      }

      // ambient friends
      for (let i = 0; i < AMBIENT.length; i++) {
        const a = AMBIENT[i];
        sprites.push({ y: a.y, fn: () => {
          if (a.desk) {
            D.rr(g, a.x - 26, a.y + 4, 52, 22, 4, '#cf9b5a', '#a9794a', 2); // school desk
            D.rr(g, a.x - 22, a.y + 2, 44, 6, 2, '#e8c39a');
          } else if (a.flag) {
            g.strokeStyle = '#bcbcc4'; g.lineWidth = 4; g.lineCap = 'round';
            g.beginPath(); g.moveTo(a.x + 28, a.y + 16); g.lineTo(a.x + 28, a.y - 60); g.stroke();
            g.fillStyle = '#ff9ec7';
            g.beginPath(); g.moveTo(a.x + 28, a.y - 60); g.lineTo(a.x + 58, a.y - 52); g.lineTo(a.x + 28, a.y - 44); g.closePath(); g.fill();
          }
          CM.drawFriend(g, a.id, a.x, a.y, 0.9, { bob: 0, shadow: false });
          const nm = CM.FRIENDS[a.id].name;
          D.rr(g, a.x - 42, a.y + 14, 84, 18, 9, 'rgba(255,255,255,0.8)');
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
          D.text(g, '🌳 Back to backyard', BACK.frontX, BACK.frontY + 22, { size: 13, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to go' : 'press SPACE to go', BACK.frontX, BACK.frontY + 39, { size: 12, color: CM.palette.mintDeep });
        } else {
          const st = near.station;
          const bx = CM.clamp(st.x - 80, 8, CM.W - 168);
          D.bubble(g, bx, st.y - 150, 160, 48, st.x);
          D.text(g, st.emoji + ' ' + st.label + '!', bx + 80, st.y - 133, { size: 15, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to play' : 'press SPACE to play', bx + 80, st.y - 115, { size: 12, color: '#cf7a3a' });
        }
      }

      // ---- HUD + overlays ----
      const hint = CM.touchMode
        ? 'Drag to walk  ·  ★ to learn  ·  🌳 backyard  ·  👗 dress up'
        : 'Walk: click / WASD   ·   Play: SPACE   ·   🌳 Backyard   ·   👗 Dress Up';
      CM.hub.drawHud(this, g, hint);
      if (this.dialog) CM.hub.drawDialog(this, g, t);
      if (this.menu) CM.hub.drawMenu(this, g);
    }
  });
})();
