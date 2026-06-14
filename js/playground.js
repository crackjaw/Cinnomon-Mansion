/* ============================================================
   Cinnamoroll Mansion — playground hub
   The playground: same friends, playground mini-games (swings,
   sand castle, tag, seesaw, monkey bars, kites). Reached from the
   backyard's playground gate; the gate at the top returns to the
   backyard. Shares movement / dialog / dress-up menu / pet via CM.hub.
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  // gate back to the backyard (top-centre)
  const BACK = { gate: { x: 432, y: 8, w: 96, h: 62 }, frontX: 480, frontY: 118 };

  // game stations (2 rows of 3)
  const STATIONS = [
    { id: 'swingjump', label: 'Swing Jump', emoji: '🥏', host: 'mymelody', x: 168, y: 224,
      line: 'Swing high and jump far with me, {name}!' },
    { id: 'tag', label: "Tag, You're It!", emoji: '🏃', host: 'pochacco', x: 480, y: 214,
      line: "You're IT, {name}! Catch all our friends!" },
    { id: 'monkeybars', label: 'Monkey Bars', emoji: '🐒', host: 'badtzmaru', x: 792, y: 224,
      line: 'Heh, swing across the bars without falling, {name}.' },
    { id: 'sandcastle', label: 'Sand Castle', emoji: '🏰', host: 'hellokitty', x: 168, y: 474,
      line: "Let's build the tallest sand castle, {name}!" },
    { id: 'kite', label: 'Kite Flying', emoji: '🪁', host: 'cinnamoroll', x: 480, y: 482,
      line: 'The wind is perfect for kites today, {name}!' },
    { id: 'seesaw', label: 'Seesaw Pop', emoji: '⚖️', host: 'pompompurin', x: 792, y: 474,
      line: 'Bounce me up to pop the balloons, {name}!' }
  ];

  // ambient friends hanging out
  const AMBIENT = [
    { id: 'kuromi', x: 74, y: 372, bench: true },
    { id: 'keroppi', x: 892, y: 372, roundabout: true }
  ];

  const BOUNDS = { x1: 30, y1: 110, x2: 930, y2: 576 };
  const SOLIDS = [];

  function overlaps(px, py) {
    return px < BOUNDS.x1 || px > BOUNDS.x2 || py < BOUNDS.y1 || py > BOUNDS.y2;
  }

  function sign(g, cx, y, emoji, label) {
    const w = 24 + label.length * 8.2;
    D.rr(g, cx - w / 2, y, w, 24, 9, '#fff', '#ffe1b0', 2.5);
    D.text(g, emoji + ' ' + label, cx, y + 12, { size: 13, color: '#e08a2a', weight: 800 });
  }
  function tree(g, x, y, s) {
    s = s || 1;
    D.shadow(g, x, y, 32 * s);
    D.rr(g, x - 8 * s, y - 42 * s, 16 * s, 44 * s, 6, '#b07a45', '#8a5a3b', 2);
    D.circle(g, x - 16 * s, y - 56 * s, 24 * s, '#8fd6a0', '#6fbc82', 2);
    D.circle(g, x + 16 * s, y - 56 * s, 24 * s, '#8fd6a0', '#6fbc82', 2);
    D.circle(g, x, y - 76 * s, 28 * s, '#a5dfae', '#6fbc82', 2);
    D.circle(g, x, y - 60 * s, 26 * s, '#a5dfae');
  }
  function flower(g, x, y, c) {
    for (let i = 0; i < 5; i++) { const a = (i / 5) * Math.PI * 2; D.circle(g, x + Math.cos(a) * 4.5, y + Math.sin(a) * 4.5, 3.2, c); }
    D.circle(g, x, y, 2.4, '#ffe07a');
  }

  // each station's play-equipment prop, drawn behind its host
  function stationProp(g, st, t) {
    const x = st.x, y = st.y;
    if (st.id === 'swingjump') {
      // a swing-set frame bracketing the host, seat swaying to the side
      g.strokeStyle = '#cf9b5a'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 48, y + 24); g.lineTo(x - 34, y - 96); g.lineTo(x + 34, y - 96); g.lineTo(x + 48, y + 24); g.stroke();
      g.beginPath(); g.moveTo(x - 20, y + 24); g.lineTo(x - 34, y - 96); g.stroke();
      const sw = Math.sin(t * 1.6) * 12;
      g.strokeStyle = '#9aa0a8'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(x + 30, y - 96); g.lineTo(x + 26 + sw, y - 10); g.stroke();
      g.beginPath(); g.moveTo(x + 40, y - 96); g.lineTo(x + 36 + sw, y - 10); g.stroke();
      D.rr(g, x + 24 + sw, y - 12, 18, 6, 2, '#ff9ec7', '#e87fb2', 1.5);
    } else if (st.id === 'monkeybars') {
      // overhead bars
      g.strokeStyle = '#67b3d9'; g.lineWidth = 6; g.lineCap = 'round';
      g.beginPath(); g.moveTo(x - 52, y + 22); g.lineTo(x - 52, y - 96); g.lineTo(x + 52, y - 96); g.lineTo(x + 52, y + 22); g.stroke();
      g.lineWidth = 4;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(x + i * 22, y - 96); g.lineTo(x + i * 22, y - 86); g.stroke(); }
    } else if (st.id === 'seesaw') {
      // a tilted seesaw on a pivot
      const tilt = Math.sin(t * 1.4) * 0.16;
      D.circle(g, x, y + 18, 12, '#f2b53c', '#d8941f', 2); // pivot
      g.save(); g.translate(x, y + 14); g.rotate(tilt);
      D.rr(g, -56, -5, 112, 10, 5, '#ff9ec7', '#e87fb2', 2);
      D.circle(g, -50, -8, 6, '#8ecdf6'); D.circle(g, 50, -8, 6, '#bdeccd');
      g.restore();
    } else if (st.id === 'sandcastle') {
      // a sandbox with a little castle + bucket
      D.rr(g, x - 44, y + 6, 88, 26, 6, '#f2d9a8', '#d8b878', 3);
      D.rr(g, x - 38, y + 10, 76, 18, 4, '#f6e2b8');
      for (let i = 0; i < 3; i++) D.rr(g, x - 16 + i * 14, y + 4 - i % 2 * 4, 12, 14, 2, '#e8c98a', '#cdac6a', 1.5);
      D.rr(g, x + 22, y + 8, 12, 14, 3, '#ff9ec7', '#e87fb2', 1.5); // bucket
    } else if (st.id === 'kite') {
      // host holds a string up to a kite in the sky
      const kx = x + 44 + Math.sin(t * 1.2) * 12, ky = y - 120 + Math.cos(t * 1.5) * 8;
      g.strokeStyle = 'rgba(120,120,130,0.6)'; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(x + 14, y - 30); g.lineTo(kx, ky); g.stroke();
      g.save(); g.translate(kx, ky); g.rotate(0.5 + Math.sin(t * 1.2) * 0.1);
      g.fillStyle = '#ff9ec7';
      g.beginPath(); g.moveTo(0, -16); g.lineTo(13, 0); g.lineTo(0, 16); g.lineTo(-13, 0); g.closePath(); g.fill();
      g.strokeStyle = '#e87fb2'; g.lineWidth = 1.5; g.stroke();
      g.strokeStyle = '#8ecdf6'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 16); g.quadraticCurveTo(6, 26, -2, 34); g.stroke();
      g.restore();
    } else if (st.id === 'tag') {
      // a painted "base" ring on the ground
      D.ellipse(g, x, y + 22, 40, 14, null, '#ff9ec7', 4);
      D.ellipse(g, x, y + 22, 26, 9, null, '#8ecdf6', 3);
    }
  }

  CM.registerScene('playground', {
    joystick: true,
    enter() {
      const sp = CM._playgroundSpawn || { x: 480, y: 154 };
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
      CM._playgroundSpawn = { x: this.p.x, y: this.p.y };
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
          { label: "▶ Let's Play!", color: P.mintDeep, run: function () { CM.startGame(st.id); } },
          { label: 'Maybe Later', color: '#b9a8b3', run: function () {} }
        ] };
      } else {
        this.dialog = { host: st.host, line: 'This playground game is still being set up… come back soon!', sel: 0, options: [
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
      const sky = g.createLinearGradient(0, 0, 0, 130);
      sky.addColorStop(0, '#aedcff');
      sky.addColorStop(1, '#dff2e2');
      g.fillStyle = sky;
      g.fillRect(0, 0, CM.W, 120);
      for (const c of [[160, 40, 1], [720, 32, 0.8]]) {
        const cx = (c[0] + t * 5) % (CM.W + 120) - 60;
        D.ellipse(g, cx, c[1], 40 * c[2], 18 * c[2], 'rgba(255,255,255,0.92)');
        D.ellipse(g, cx - 24 * c[2], c[1] + 6, 24 * c[2], 13 * c[2], 'rgba(255,255,255,0.92)');
        D.ellipse(g, cx + 26 * c[2], c[1] + 5, 26 * c[2], 14 * c[2], 'rgba(255,255,255,0.92)');
      }
      // wood-chip / grass ground
      const grd = g.createLinearGradient(0, 110, 0, CM.H);
      grd.addColorStop(0, '#c7e6a8');
      grd.addColorStop(1, '#b3dd96');
      g.fillStyle = grd;
      g.fillRect(0, 110, CM.W, CM.H - 110);
      g.fillStyle = 'rgba(150,120,80,0.10)';
      for (let i = 0; i < 90; i++) {
        const gx = (i * 107 + 30) % CM.W, gy = 150 + ((i * 71) % 410);
        g.fillRect(gx, gy, 6, 3);
      }
      // fence band below the house hedge
      g.fillStyle = '#7fc98f';
      g.fillRect(0, 32, CM.W, 20);
      for (let x = 14; x < CM.W; x += 40) D.circle(g, x, 38, 13, '#8fd6a0');

      // back gate (to the backyard)
      const gt = BACK.gate;
      g.fillStyle = '#f7d7e6';
      g.fillRect(0, 0, CM.W, 34);
      D.rr(g, gt.x - 6, gt.y - 4, gt.w + 12, gt.h + 8, 9, '#fff', '#cfe6c4', 3);
      const pw = (gt.w - 6) / 2;
      for (let i = 0; i < 2; i++) D.rr(g, gt.x + 2 + i * (pw + 2), gt.y, pw, gt.h, 6, '#bfe8c8', '#8fce9d', 2);
      D.circle(g, gt.x + gt.w / 2, gt.y + gt.h / 2, 3.5, '#ffd24a');
      D.rr(g, gt.x + gt.w / 2 - 56, gt.y + gt.h + 6, 112, 24, 9, '#fff', '#cfe6c4', 2.5);
      D.text(g, '🌳 Backyard', gt.x + gt.w / 2, gt.y + gt.h + 18, { size: 13, color: CM.palette.mintDeep, weight: 800 });

      // flat ground decor
      const fc = ['#ff9ec7', '#fff', '#ffd24a', '#c9a8f0'];
      for (let i = 0; i < 14; i++) flower(g, (i * 233 + 60) % CM.W, 150 + ((i * 89) % 400), fc[i % 4]);

      // ---- depth-sorted sprites ----
      const sprites = [];
      sprites.push({ y: 168, fn: () => tree(g, 60, 168, 0.9) });
      sprites.push({ y: 168, fn: () => tree(g, 902, 168, 0.9) });

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
          if (a.bench) {
            D.rr(g, a.x - 26, a.y - 2, 56, 10, 3, '#cf9b5a', '#a9794a', 2);
            D.rr(g, a.x - 26, a.y - 28, 56, 8, 3, '#cf9b5a', '#a9794a', 2);
          } else if (a.roundabout) {
            D.ellipse(g, a.x, a.y + 8, 38, 14, '#8ecdf6', '#6aaede', 2);
            g.strokeStyle = 'rgba(255,255,255,0.7)'; g.lineWidth = 2;
            for (let k = 0; k < 4; k++) { const an = t * 0.6 + k * Math.PI / 2; g.beginPath(); g.moveTo(a.x, a.y + 6); g.lineTo(a.x + Math.cos(an) * 34, a.y + 6 + Math.sin(an) * 12); g.stroke(); }
          }
          CM.drawFriend(g, a.id, a.x, a.bench ? a.y - 4 : a.y, 0.9, { bob: 0, shadow: false });
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
          D.text(g, CM.touchMode ? 'tap ★ to play' : 'press SPACE to play', bx + 80, st.y - 115, { size: 12, color: '#e08a2a' });
        }
      }

      // ---- HUD + overlays ----
      const hint = CM.touchMode
        ? 'Drag to walk  ·  ★ to play  ·  🌳 backyard  ·  👗 dress up'
        : 'Walk: click / WASD   ·   Play: SPACE   ·   🌳 Backyard   ·   👗 Dress Up';
      CM.hub.drawHud(this, g, hint);
      if (this.dialog) CM.hub.drawDialog(this, g, t);
      if (this.menu) CM.hub.drawMenu(this, g);
    }
  });
})();
