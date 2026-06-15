/* ============================================================
   Cinnamoroll Mansion — mansion hub scene
   Walk around, talk to friends, enter mini-games.
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  const DOORS = [
    { id: 'bowling', label: 'Bowling', emoji: '🎳', host: 'hellokitty', wall: 'top',
      door: { x: 130, y: 28, w: 86, h: 92 }, hostPos: { x: 250, y: 195 },
      line: "Hi {name}! Want to bowl with me? I'll cheer SO loud!" },
    { id: 'dance', label: 'Dance Party', emoji: '🎵', host: 'kuromi', wall: 'top',
      door: { x: 434, y: 22, w: 92, h: 98 }, hostPos: { x: 560, y: 195 },
      line: 'Heh heh… think you can keep up with MY dance moves, {name}?' },
    { id: 'baseball', label: 'Baseball', emoji: '⚾', host: 'pompompurin', wall: 'top',
      door: { x: 744, y: 28, w: 86, h: 92 }, hostPos: { x: 700, y: 195 },
      line: "Let's play baseball, {name}! Then maybe… a little nap." },
    { id: 'hideseek', label: 'Hide & Seek', emoji: '🌼', host: 'cinnamoroll', wall: 'left',
      door: { x: 0, y: 240, w: 26, h: 120 }, hostPos: { x: 90, y: 330 },
      line: 'Everyone is hiding in the garden, {name}! Can you find them all?' },
    { id: 'memory', label: 'Memory Match', emoji: '🎴', host: 'mymelody', wall: 'right',
      door: { x: 934, y: 240, w: 26, h: 120 }, hostPos: { x: 870, y: 330 },
      line: 'I made pretty picture cards, {name}! Can you find the pairs?' },
    { id: 'fishing', label: 'Fishing Pond', emoji: '🐟', host: 'keroppi', wall: 'bottom',
      door: { x: 700, y: 556, w: 110, h: 44 }, hostPos: { x: 845, y: 490 },
      line: 'Ribbit! The pond is full of splashy fish today, {name}!' }
  ];

  const MIRROR = { x: 38, y: 426, w: 58, h: 96 };
  // Gift shop counter; host stands behind, player interacts from the front (feet).
  const SHOP = { cx: 175, counterY: 470, counterW: 132, counterH: 30, hostY: 468, frontX: 175, frontY: 526 };
  // Badtz-Maru naps on the sofa; talk to him here to play Red Light, Green Light.
  const SOFA = { hostX: 628, hostY: 446, frontX: 628, frontY: 496 };
  const SOLIDS = [
    { x: 545, y: 415, w: 165, h: 58 },  // sofa
    { x: 272, y: 438, w: 70, h: 46 },   // cake table
    { x: MIRROR.x, y: MIRROR.y + 50, w: MIRROR.w, h: 46 },
    { x: SHOP.cx - SHOP.counterW / 2, y: SHOP.counterY, w: SHOP.counterW, h: SHOP.counterH }, // shop counter
    { x: 18, y: 128, w: 46, h: 52 },    // plants
    { x: 896, y: 128, w: 46, h: 52 },
    { x: 896, y: 500, w: 46, h: 52 }
  ];
  const BOUNDS = { x1: 30, y1: 152, x2: 930, y2: 576 };
  const inRect = CM.hub.inRect;

  function overlapsSolid(px, py) {
    const bx1 = px - 10, bx2 = px + 10, by1 = py - 8, by2 = py + 2;
    if (px < BOUNDS.x1 || px > BOUNDS.x2 || py < BOUNDS.y1 || py > BOUNDS.y2) return true;
    for (const s of SOLIDS) {
      if (bx2 > s.x && bx1 < s.x + s.w && by2 > s.y && by1 < s.y + s.h) return true;
    }
    return false;
  }

  function drawTopDoor(g, d) {
    const r = d.door;
    D.rr(g, r.x - 8, r.y - 6, r.w + 16, r.h + 10, 10, '#fff', '#e8c9d8', 3);
    D.rr(g, r.x, r.y, r.w, r.h, 8, '#b97a4e', '#96603a', 3);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    g.fillRect(r.x + 8, r.y + 8, r.w - 16, r.h * 0.4);
    D.circle(g, r.x + r.w - 14, r.y + r.h / 2, 4.5, '#f6cf5a');
    // sign
    D.rr(g, r.x + r.w / 2 - 56, r.y + r.h + 8, 112, 34, 10, '#fff', '#e8c9d8', 2.5);
    D.text(g, d.emoji + ' ' + d.label, r.x + r.w / 2, r.y + r.h + 25, { size: 14, color: CM.palette.ink, weight: 800 });
  }

  function drawSideDoor(g, d) {
    const r = d.door;
    const left = d.wall === 'left';
    const color = d.id === 'hideseek' ? '#8fce9d' : '#c9a8e8';
    g.fillStyle = color;
    g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = 'rgba(0,0,0,0.18)';
    g.lineWidth = 3;
    g.strokeRect(r.x + 1.5, r.y + 1.5, r.w - 3, r.h - 3);
    const sx = left ? 36 : CM.W - 36 - 112;
    D.rr(g, sx, r.y - 44, 112, 34, 10, '#fff', '#e8c9d8', 2.5);
    D.text(g, d.emoji + ' ' + d.label, sx + 56, r.y - 27, { size: 14, color: CM.palette.ink, weight: 800 });
  }

  function drawBottomDoor(g, d) {
    const r = d.door;
    D.rr(g, r.x, r.y, r.w, r.h, 8, '#7bb3d9', '#5a93bd', 3);
    g.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 3; i++) {
      D.ellipse(g, r.x + 20 + i * 35, r.y + 18 + (i % 2) * 12, 9, 5, 'rgba(255,255,255,0.35)');
    }
    D.rr(g, r.x + r.w / 2 - 56, r.y - 40, 112, 34, 10, '#fff', '#e8c9d8', 2.5);
    D.text(g, d.emoji + ' ' + d.label, r.x + r.w / 2, r.y - 23, { size: 14, color: CM.palette.ink, weight: 800 });
  }

  CM.registerScene('mansion', {
    joystick: true,
    enter() {
      const sp = CM._mansionSpawn || { x: 480, y: 430 };
      this.p = { x: sp.x, y: sp.y, facing: 'down', phase: 0 };
      this.dialog = null;
      this.menu = false;
      this.target = null;
      this.BOUNDS = BOUNDS;
      this.overlaps = overlapsSolid;
      CM.hub.initPet(this);
      CM.audio.music('mansion');
    },
    exit() {
      CM._mansionSpawn = { x: this.p.x, y: this.p.y };
    },

    nearestInteract() {
      let best = null;
      let bestDist = 72;
      for (const d of DOORS) {
        const dd = CM.dist(this.p.x, this.p.y, d.hostPos.x, d.hostPos.y);
        if (dd < bestDist) { bestDist = dd; best = { type: 'door', door: d }; }
      }
      const md = CM.dist(this.p.x, this.p.y, MIRROR.x + MIRROR.w / 2, MIRROR.y + MIRROR.h + 8);
      if (md < 64 && md < bestDist) { bestDist = md; best = { type: 'mirror' }; }
      const sd = CM.dist(this.p.x, this.p.y, SHOP.frontX, SHOP.frontY);
      if (sd < 70 && sd < bestDist) { bestDist = sd; best = { type: 'shop' }; }
      const fd = CM.dist(this.p.x, this.p.y, SOFA.frontX, SOFA.frontY);
      if (fd < 66 && fd < bestDist) best = { type: 'sofa' };
      return best;
    },

    // What did a click at (mx,my) land on? (null = walk there)
    clickInteract(mx, my) {
      for (const d of DOORS) {
        if (CM.dist(mx, my, d.hostPos.x, d.hostPos.y - 42) < 58) return { type: 'door', door: d };
      }
      if (mx > MIRROR.x - 14 && mx < MIRROR.x + MIRROR.w + 14 && my > MIRROR.y - 14 && my < MIRROR.y + MIRROR.h + 14) {
        return { type: 'mirror' };
      }
      if (Math.abs(mx - SHOP.cx) < SHOP.counterW / 2 + 16 && my > SHOP.hostY - 40 && my < SHOP.frontY + 24) {
        return { type: 'shop' };
      }
      if (Math.abs(mx - SOFA.hostX) < 90 && my > SOFA.hostY - 50 && my < SOFA.frontY + 20) {
        return { type: 'sofa' };
      }
      return null;
    },

    interactAnchor(it) {
      if (it.type === 'mirror') return { x: MIRROR.x + MIRROR.w / 2, y: MIRROR.y + MIRROR.h + 8, reach: 64 };
      if (it.type === 'shop') return { x: SHOP.frontX, y: SHOP.frontY, reach: 70 };
      if (it.type === 'sofa') return { x: SOFA.frontX, y: SOFA.frontY, reach: 66 };
      return { x: it.door.hostPos.x, y: it.door.hostPos.y + 18, reach: 74 };
    },

    // Open the right dialog/menu/scene for an interactable.
    triggerInteract(it) {
      const P = CM.palette;
      const close = function () {};
      if (it.type === 'mirror') { CM.hub.openMenu(this); return; }
      CM.audio.play('pop');
      if (it.type === 'shop') {
        this.dialog = { host: 'pochacco', line: 'Hi there! Wanna shop or play Coin Hunt?', sel: 0, options: [
          { label: '🎀 Shop', color: P.pinkDeep, run: function () { CM.switchScene('shop'); } },
          { label: '🎮 Coin Hunt', color: P.mintDeep, run: function () { CM.startGame('coinhunt'); } },
          { label: 'Later', color: '#b9a8b3', run: close }
        ] };
        return;
      }
      if (it.type === 'sofa') {
        this.dialog = { host: 'badtzmaru', line: 'Heh… think you can beat my Red Light, Green Light?', sel: 0, options: [
          { label: "▶ Let's Play!", color: P.mintDeep, run: function () { CM.startGame('redlight'); } },
          { label: 'Maybe Later', color: '#b9a8b3', run: close }
        ] };
        return;
      }
      const d = it.door;
      const name = (CM.save.character || {}).name || 'friend';
      if (CM.games[d.id]) {
        this.dialog = { host: d.host, line: d.line.replace('{name}', name), sel: 0, options: [
          { label: "▶ Let's Play!", color: P.mintDeep, run: function () { CM.startGame(d.id); } },
          { label: 'Maybe Later', color: '#b9a8b3', run: close }
        ] };
      } else {
        this.dialog = { host: d.host, line: 'This room is still being decorated… come back soon!', sel: 0, options: [
          { label: 'OK!', color: P.blueDeep, run: close }
        ] };
      }
    },

    update(dt) {
      CM.hub.update(this, dt);
    },

    draw(g) {
      const P = CM.palette;
      // floor
      g.fillStyle = P.wood;
      g.fillRect(0, 120, CM.W, CM.H - 120);
      g.strokeStyle = 'rgba(140,90,50,0.16)';
      g.lineWidth = 2;
      for (let y = 158; y < CM.H; y += 38) {
        g.beginPath(); g.moveTo(0, y); g.lineTo(CM.W, y); g.stroke();
      }
      // wall
      g.fillStyle = '#f7d7e6';
      g.fillRect(0, 0, CM.W, 120);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      for (let x = 20; x < CM.W; x += 64) g.fillRect(x, 0, 26, 104);
      g.fillStyle = '#fff';
      g.fillRect(0, 104, CM.W, 16);
      g.fillStyle = 'rgba(0,0,0,0.06)';
      g.fillRect(0, 118, CM.W, 4);
      // windows on the wall
      for (const wx of [330, 630]) {
        D.rr(g, wx - 30, 18, 60, 74, 8, '#cdeaff', '#fff', 5);
        g.strokeStyle = '#fff'; g.lineWidth = 3;
        g.beginPath(); g.moveTo(wx, 22); g.lineTo(wx, 88); g.stroke();
        g.beginPath(); g.moveTo(wx - 26, 55); g.lineTo(wx + 26, 55); g.stroke();
        g.fillStyle = '#ffb7d5';
        g.beginPath(); g.moveTo(wx - 30, 16); g.lineTo(wx - 16, 60); g.lineTo(wx - 30, 60); g.closePath(); g.fill();
        g.beginPath(); g.moveTo(wx + 30, 16); g.lineTo(wx + 16, 60); g.lineTo(wx + 30, 60); g.closePath(); g.fill();
      }
      // rug
      D.ellipse(g, 480, 360, 205, 105, '#ffd9e8', '#f0b9d2', 4);
      D.ellipse(g, 480, 360, 165, 80, null, '#fff', 3);
      D.heart(g, 480, 355, 26, '#ff9ec7');
      // doors
      for (const d of DOORS) {
        if (d.wall === 'top') drawTopDoor(g, d);
        else if (d.wall === 'bottom') drawBottomDoor(g, d);
        else drawSideDoor(g, d);
      }

      // ---- depth-sorted sprites ----
      const sprites = [];
      const t = CM.time;
      // plants
      for (const pl of [{ x: 41, y: 180 }, { x: 919, y: 180 }, { x: 919, y: 552 }]) {
        sprites.push({ y: pl.y, fn: () => {
          D.rr(g, pl.x - 14, pl.y - 22, 28, 22, 5, '#d98a5a', '#b56f42', 2);
          D.ellipse(g, pl.x, pl.y - 34, 20, 16, '#8fd6a0', '#6fbc82', 2);
          D.ellipse(g, pl.x - 10, pl.y - 44, 11, 9, '#a5dfae');
          D.ellipse(g, pl.x + 10, pl.y - 44, 11, 9, '#a5dfae');
        } });
      }
      // sofa + sleeping Badtz-Maru
      sprites.push({ y: 473, fn: () => {
        D.rr(g, 545, 400, 165, 46, 14, '#8ecdf6', '#6aaede', 3);
        D.rr(g, 540, 430, 175, 42, 14, '#a8d8f8', '#6aaede', 3);
        D.rr(g, 533, 414, 22, 52, 10, '#8ecdf6', '#6aaede', 3);
        D.rr(g, 700, 414, 22, 52, 10, '#8ecdf6', '#6aaede', 3);
        CM.drawFriend(g, 'badtzmaru', 628, 446, 0.85, { shadow: false });
        const za = Math.sin(t * 2) * 0.5 + 0.5;
        g.globalAlpha = 0.4 + za * 0.5;
        D.text(g, 'z', 660, 380 - za * 8, { size: 16 + za * 6, color: '#5a6b85', weight: 800 });
        D.text(g, 'z', 675, 365 - za * 12, { size: 12 + za * 4, color: '#5a6b85', weight: 800 });
        g.globalAlpha = 1;
      } });
      // cake table
      sprites.push({ y: 484, fn: () => {
        D.ellipse(g, 307, 484, 38, 14, 'rgba(60,40,60,0.10)');
        D.rr(g, 300, 442, 14, 40, 4, '#b97a4e');
        D.ellipse(g, 307, 442, 40, 16, '#fff', '#e8c9d8', 3);
        D.rr(g, 292, 428, 30, 12, 4, '#ffd9e8', '#f0b9d2', 2);
        D.ellipse(g, 307, 428, 17, 6, '#fff');
        D.circle(g, 307, 422, 4, '#ef5b5b');
      } });
      // mirror
      sprites.push({ y: MIRROR.y + MIRROR.h, fn: () => {
        D.rr(g, MIRROR.x - 5, MIRROR.y - 5, MIRROR.w + 10, MIRROR.h + 10, 14, '#f6cf5a', '#d8ab35', 3);
        D.rr(g, MIRROR.x + 3, MIRROR.y + 3, MIRROR.w - 6, MIRROR.h - 6, 10, '#d4ecff');
        const md = CM.dist(this.p.x, this.p.y, MIRROR.x + MIRROR.w / 2, MIRROR.y + MIRROR.h + 8);
        if (md < 110) {
          g.save();
          D.rrPath(g, MIRROR.x + 3, MIRROR.y + 3, MIRROR.w - 6, MIRROR.h - 6, 10);
          g.clip();
          g.globalAlpha = 0.55;
          CM.drawPlayer(g, MIRROR.x + MIRROR.w / 2, MIRROR.y + MIRROR.h - 8, 0.85, 'down', this.p.phase);
          g.globalAlpha = 1;
          g.restore();
        }
        g.strokeStyle = 'rgba(255,255,255,0.8)';
        g.lineWidth = 3;
        g.beginPath();
        g.moveTo(MIRROR.x + 12, MIRROR.y + 14);
        g.lineTo(MIRROR.x + 22, MIRROR.y + 8);
        g.stroke();
      } });
      // hosts
      for (let i = 0; i < DOORS.length; i++) {
        const d = DOORS[i];
        sprites.push({ y: d.hostPos.y, fn: () => {
          CM.drawFriend(g, d.host, d.hostPos.x, d.hostPos.y, 1.05, {
            bob: ((t * 0.8 + i * 0.3) % 1) * 0.4,
            flip: d.hostPos.x > 480
          });
          const nm = CM.FRIENDS[d.host].name;
          D.rr(g, d.hostPos.x - 46, d.hostPos.y + 6, 92, 20, 9, 'rgba(255,255,255,0.85)');
          D.text(g, nm, d.hostPos.x, d.hostPos.y + 16, { size: 12, color: CM.palette.ink, weight: 800 });
        } });
      }
      // gift shop counter + Pochacco the shopkeeper
      sprites.push({ y: SHOP.counterY + SHOP.counterH, fn: () => {
        const cx = SHOP.cx, cw = SHOP.counterW, x0 = cx - cw / 2, y0 = SHOP.counterY;
        // hanging sign above
        D.rr(g, cx - 64, y0 - 60, 128, 28, 9, '#fff', '#e8c9d8', 2.5);
        D.text(g, '🎀 Gift Shop', cx, y0 - 46, { size: 14, color: CM.palette.pinkDeep, weight: 800 });
        // Pochacco behind the counter (waving on a gentle bob)
        CM.drawFriend(g, 'pochacco', cx + 20, SHOP.hostY, 0.9, { bob: ((t * 0.8) % 1) * 0.3, shadow: false });
        // counter body
        D.rr(g, x0, y0, cw, SHOP.counterH + 18, 9, '#f6d8a0', '#d3a366', 3);
        D.rr(g, x0, y0, cw, 13, 6, '#ffd9e8', '#f0b9d2', 2);
        D.text(g, 'SHOP', cx, y0 + 31, { size: 15, color: '#b9824a', weight: 800 });
        // cute goods on the counter
        D.heart(g, x0 + 20, y0 - 5, 12, '#ff9ec7');
        D.star(g, x0 + cw - 22, y0 - 4, 8, '#ffd24a');
      } });
      // pet companion
      if (this.petObj) {
        sprites.push({ y: this.petObj.y, fn: () => CM.hub.drawPetSprite(this, g, t) });
      }
      // player
      sprites.push({ y: this.p.y, fn: () => {
        CM.drawPlayer(g, this.p.x, this.p.y, 1.05, this.p.facing, this.p.phase);
      } });

      sprites.sort((a, b) => a.y - b.y);
      for (const s of sprites) s.fn();

      CM.hub.drawTargetMarker(this, g);

      // ---- prompts ----
      const near = (this.dialog || this.menu) ? null : this.nearestInteract();
      if (near) {
        if (near.type === 'mirror') {
          D.bubble(g, MIRROR.x - 10, MIRROR.y - 64, 170, 46, MIRROR.x + MIRROR.w / 2);
          D.text(g, 'Change your look?', MIRROR.x + 75, MIRROR.y - 47, { size: 14, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★' : 'press SPACE', MIRROR.x + 75, MIRROR.y - 29, { size: 12, color: CM.palette.pinkDeep });
        } else if (near.type === 'shop') {
          D.bubble(g, SHOP.cx - 84, SHOP.frontY - 116, 168, 46, SHOP.cx);
          D.text(g, '🎀 Shop for goodies!', SHOP.cx, SHOP.frontY - 99, { size: 14, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to shop' : 'press SPACE to shop', SHOP.cx, SHOP.frontY - 81, { size: 12, color: CM.palette.pinkDeep });
        } else if (near.type === 'sofa') {
          D.bubble(g, SOFA.hostX - 84, SOFA.hostY - 118, 168, 46, SOFA.hostX);
          D.text(g, '🚦 Red Light, Green Light!', SOFA.hostX, SOFA.hostY - 101, { size: 13, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to play' : 'press SPACE to play', SOFA.hostX, SOFA.hostY - 83, { size: 12, color: CM.palette.pinkDeep });
        } else {
          const d = near.door;
          const bx = CM.clamp(d.hostPos.x - 80, 8, CM.W - 168);
          D.bubble(g, bx, d.hostPos.y - 156, 160, 48, d.hostPos.x);
          D.text(g, d.emoji + ' ' + d.label + '!', bx + 80, d.hostPos.y - 139, { size: 15, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to talk' : 'press SPACE to talk', bx + 80, d.hostPos.y - 121, { size: 12, color: CM.palette.pinkDeep });
        }
      }

      // ---- HUD + overlays ----
      const hint = CM.touchMode
        ? 'Drag to walk  ·  ★ to talk  ·  tap to move  ·  👗 to change clothes'
        : 'Walk: click / WASD   ·   Talk: SPACE   ·   👗 Dress Up   ·   Sound: M';
      CM.hub.drawHud(this, g, hint);
      if (this.dialog) CM.hub.drawDialog(this, g, t);
      if (this.menu) CM.hub.drawMenu(this, g);
    }
  });
})();
