/* ============================================================
   Cinnamoroll Mansion — Town overworld
   A cute little town map: the hub that ties everything together.
   Walk up to a building (or tap it) to visit that area. Shares the
   walk-around movement / dress-up menu / pet companion with the
   other hubs through CM.hub.
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  const BOUNDS = { x1: 40, y1: 198, x2: 920, y2: 402 };

  // central fountain in the plaza (a solid you walk around)
  const FOUNTAIN = { x: 480, y: 296, r: 40 };

  // every destination, laid out as buildings around the plaza
  const BUILD = [
    { scene: 'mansion',    label: 'Mansion',    emoji: '🏰', row: 'top',    cx: 122, wall: '#ffd9e8', roof: '#8ecdf6', edge: '#5da4d6', trim: '#e8a9c6' },
    { scene: 'school',     label: 'School',     emoji: '🏫', row: 'top',    cx: 362, wall: '#ffe3ef', roof: '#ef8f6f', edge: '#cf6f4f', trim: '#f0b9d2' },
    { scene: 'cafe',       label: 'Cafe',       emoji: '☕', row: 'top',    cx: 600, wall: '#fff1e6', roof: '#e0a05a', edge: '#cf7a3a', trim: '#e8b48f', awning: true },
    { scene: 'pool',       label: 'Pool',       emoji: '🏊', row: 'top',    cx: 838, wall: '#dff2ff', roof: '#6bb6dd', edge: '#4a9fdc', trim: '#9ec9e6' },
    { scene: 'boutique',   label: 'Boutique',   emoji: '👗', row: 'bottom', cx: 202, wall: '#fff0f6', roof: '#ef8fb6', edge: '#cf6a9a', trim: '#e8a9c8', awning: true },
    { scene: 'playground', label: 'Playground', emoji: '🛝', row: 'bottom', cx: 480, wall: '#fff3d6', roof: '#f2c45a', edge: '#e0a32a', trim: '#f2c45a' },
    { scene: 'backyard',   label: 'Backyard',   emoji: '🌳', row: 'bottom', cx: 760, park: true }
  ];

  // compute building geometry once at load
  (function layout() {
    const BW = 152, BH_TOP = 126, BH_BOT = 118, TOP_Y = 56, BOT_BASE = 546;
    for (const b of BUILD) {
      b.bw = b.park ? 176 : BW;
      b.bx = b.cx - b.bw / 2;
      if (b.row === 'top') {
        b.by = TOP_Y; b.bh = BH_TOP;
        b.signY = b.by + b.bh + 14;
        b.fx = b.cx; b.fy = b.by + b.bh + 54;
      } else {
        b.bh = BH_BOT; b.by = BOT_BASE - b.bh;
        b.signY = b.by - 16;
        b.fx = b.cx; b.fy = b.by - 50;
      }
    }
  })();

  // a couple of friends strolling the plaza (purely decorative)
  const STROLL = [
    { id: 'cinnamoroll', bx: 360, by: 322, range: 86, sp: 0.5, ph: 0 },
    { id: 'pompompurin', bx: 600, by: 326, range: 78, sp: 0.42, ph: 2.1 }
  ];

  const inRect = CM.hub.inRect;

  function overlaps(px, py) {
    if (px < BOUNDS.x1 || px > BOUNDS.x2 || py < BOUNDS.y1 || py > BOUNDS.y2) return true;
    // fountain basin (keep the feet a little clear of it)
    if (CM.dist(px, py + 2, FOUNTAIN.x, FOUNTAIN.y + 8) < FOUNTAIN.r + 8) return true;
    return false;
  }

  /* ---------------- drawing ---------------- */
  function townSign(g, cx, y, emoji, label, col) {
    const w = 44 + label.length * 9.5;
    D.rr(g, cx - w / 2, y, w, 30, 9, '#fff', col || '#e8c9d8', 2.5);
    D.text(g, emoji + ' ' + label, cx, y + 15, { size: 15, color: CM.palette.ink, weight: 800 });
  }

  function drawBuilding(g, b) {
    const bx = b.bx, by = b.by, bw = b.bw, bh = b.bh;
    D.shadow(g, b.cx, by + bh + 4, bw * 0.46, 12);
    // body
    D.rr(g, bx, by + 30, bw, bh - 30, 12, b.wall, b.trim, 3);
    // roof
    g.fillStyle = b.roof;
    g.beginPath();
    g.moveTo(bx - 12, by + 38); g.lineTo(b.cx, by - 2); g.lineTo(bx + bw + 12, by + 38);
    g.closePath(); g.fill();
    g.strokeStyle = b.edge; g.lineWidth = 3; g.lineJoin = 'round'; g.stroke();
    // little flag
    g.strokeStyle = b.edge; g.lineWidth = 2.5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(b.cx, by - 2); g.lineTo(b.cx, by - 22); g.stroke();
    g.fillStyle = b.trim;
    g.beginPath(); g.moveTo(b.cx, by - 22); g.lineTo(b.cx + 16, by - 17); g.lineTo(b.cx, by - 12); g.closePath(); g.fill();
    // striped awning for the shops
    if (b.awning) {
      const ax = bx + 16, aw = bw - 32, ay = by + 34, ah = 15;
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#ff9ec7' : '#fff7fb'; g.fillRect(ax + i * aw / 6, ay, aw / 6 + 0.6, ah); }
      for (let i = 0; i < 6; i++) { g.fillStyle = i % 2 ? '#ff9ec7' : '#fff7fb'; D.circle(g, ax + (i + 0.5) * aw / 6, ay + ah, aw / 12, g.fillStyle); }
      g.strokeStyle = '#e87faa'; g.lineWidth = 1.5; g.strokeRect(ax, ay, aw, ah);
    }
    // windows
    for (const wx of [bx + 30, bx + bw - 30]) {
      const wy = by + (b.awning ? 60 : 50);
      D.rr(g, wx - 16, wy, 32, 30, 5, '#cdeaff', '#fff', 3);
      g.strokeStyle = '#fff'; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(wx, wy + 2); g.lineTo(wx, wy + 28);
      g.moveTo(wx - 14, wy + 15); g.lineTo(wx + 14, wy + 15);
      g.stroke();
    }
    // door
    const dw = 46, dh = 56, dy = by + bh - dh;
    D.rr(g, b.cx - dw / 2, dy, dw, dh, 9, '#b97a4e', '#96603a', 3);
    g.fillStyle = 'rgba(255,255,255,0.16)'; g.fillRect(b.cx - dw / 2 + 6, dy + 6, dw - 12, dh * 0.4);
    D.circle(g, b.cx + dw / 2 - 10, dy + dh / 2, 3.5, '#f6cf5a');
    townSign(g, b.cx, b.signY, b.emoji, b.label, b.trim);
  }

  function drawPark(g, b) {
    const bx = b.bx, by = b.by, bw = b.bw, bh = b.bh;
    D.shadow(g, b.cx, by + bh + 2, bw * 0.46, 12);
    // trees poking above the hedge
    for (const tx of [bx + 30, bx + bw - 30]) {
      D.rr(g, tx - 6, by + 8, 12, 40, 4, '#b07a45', '#8a5a3b', 2);
      D.circle(g, tx, by + 4, 24, '#a5dfae', '#6fbc82', 2);
      D.circle(g, tx - 12, by + 12, 14, '#8fd6a0');
      D.circle(g, tx + 12, by + 12, 14, '#8fd6a0');
    }
    // hedge wall
    D.rr(g, bx, by + 44, bw, bh - 44, 16, '#8fd6a0', '#6fbc82', 3);
    for (let i = 0; i < 5; i++) D.ellipse(g, bx + 22 + i * (bw - 44) / 4, by + 48, 18, 12, '#a5dfae');
    // little flowers along the hedge
    const fc = ['#ff9ec7', '#fff', '#ffd24a', '#c9a8f0'];
    for (let i = 0; i < 5; i++) {
      const fx = bx + 24 + i * (bw - 48) / 4;
      for (let k = 0; k < 5; k++) { const a = (k / 5) * Math.PI * 2; D.circle(g, fx + Math.cos(a) * 4, by + 70 + Math.sin(a) * 4, 2.6, fc[i % 4]); }
      D.circle(g, fx, by + 70, 2, '#ffe07a');
    }
    // archway opening
    const ow = 60, ox = b.cx - ow / 2, oy = by + bh - 60;
    D.rr(g, ox, oy, ow, 60, 16, '#cdeeff', '#9ec9e6', 2);
    g.fillStyle = '#bfe4f6';
    g.fillRect(ox + 6, oy + 14, ow - 12, 44);
    townSign(g, b.cx, b.signY, b.emoji, b.label, '#cfe6c4');
  }

  function drawFountain(g, t) {
    const fx = FOUNTAIN.x, fy = FOUNTAIN.y, r = FOUNTAIN.r;
    D.shadow(g, fx, fy + r * 0.7, r * 1.1, r * 0.42);
    // basin
    D.ellipse(g, fx, fy + r * 0.5, r, r * 0.5, '#cdeeff', '#9ec9e6', 4);
    D.ellipse(g, fx, fy + r * 0.5, r - 8, r * 0.5 - 6, '#bfe4f6');
    for (let i = 0; i < 3; i++) {
      const rp = (t * 0.5 + i / 3) % 1;
      g.globalAlpha = (1 - rp) * 0.5;
      D.ellipse(g, fx, fy + r * 0.5, 8 + rp * (r - 12), (8 + rp * (r - 12)) * 0.5, null, '#fff', 1.5);
      g.globalAlpha = 1;
    }
    // pillar + bowl
    D.rr(g, fx - 7, fy - 20, 14, 34, 4, '#dfeaf2', '#b9cdd9', 2);
    D.ellipse(g, fx, fy - 20, 22, 9, '#dfeaf2', '#b9cdd9', 2);
    // water arcs
    g.strokeStyle = 'rgba(140,205,246,0.85)'; g.lineWidth = 3; g.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      g.beginPath();
      g.moveTo(fx, fy - 26);
      g.quadraticCurveTo(fx + i * 16, fy - 42 + Math.sin(t * 4 + i) * 2, fx + i * 22, fy - 18);
      g.stroke();
    }
    D.circle(g, fx, fy - 32 + Math.sin(t * 3) * 2, 4, '#bfe4f6', '#9ec9e6', 1.5);
  }

  CM.registerScene('town', {
    joystick: true,
    enter() {
      const sp = CM._townSpawn || { x: 360, y: 372 };
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
      CM._townSpawn = { x: this.p.x, y: this.p.y };
    },

    nearestInteract() {
      let best = null, bestDist = 74;
      for (const b of BUILD) {
        const d = CM.dist(this.p.x, this.p.y, b.fx, b.fy);
        if (d < bestDist) { bestDist = d; best = { type: 'build', b: b }; }
      }
      return best;
    },

    clickInteract(mx, my) {
      for (const b of BUILD) {
        if (mx > b.bx - 12 && mx < b.bx + b.bw + 12 && my > b.by - 40 && my < b.by + b.bh + 34) {
          return { type: 'build', b: b };
        }
      }
      return null;
    },

    interactAnchor(it) {
      return { x: it.b.fx, y: it.b.fy, reach: 72 };
    },

    triggerInteract(it) {
      CM.audio.play('pop');
      CM.switchScene(it.b.scene);
    },

    update(dt) {
      CM.hub.update(this, dt);
    },

    draw(g) {
      const t = CM.time;
      // sky
      const sky = g.createLinearGradient(0, 0, 0, 200);
      sky.addColorStop(0, '#aedcff');
      sky.addColorStop(1, '#e6f4ff');
      g.fillStyle = sky;
      g.fillRect(0, 0, CM.W, 200);
      // clouds
      for (const c of [[120, 40, 1], [520, 28, 0.7], [820, 56, 0.9]]) {
        const cx = (c[0] + t * 6) % (CM.W + 120) - 60;
        D.ellipse(g, cx, c[1], 40 * c[2], 18 * c[2], 'rgba(255,255,255,0.9)');
        D.ellipse(g, cx - 24 * c[2], c[1] + 6, 24 * c[2], 13 * c[2], 'rgba(255,255,255,0.9)');
        D.ellipse(g, cx + 26 * c[2], c[1] + 5, 26 * c[2], 14 * c[2], 'rgba(255,255,255,0.9)');
      }
      // grass
      const grass = g.createLinearGradient(0, 150, 0, CM.H);
      grass.addColorStop(0, '#9bdaa9');
      grass.addColorStop(1, '#86d199');
      g.fillStyle = grass;
      g.fillRect(0, 150, CM.W, CM.H - 150);
      // paved plaza
      D.rr(g, 26, 194, CM.W - 52, 220, 28, '#f3e7d2', '#e3d2b6', 3);
      g.strokeStyle = 'rgba(200,178,148,0.45)'; g.lineWidth = 2;
      for (let x = 84; x < CM.W - 40; x += 58) { g.beginPath(); g.moveTo(x, 200); g.lineTo(x, 410); g.stroke(); }
      for (let y = 234; y < 410; y += 40) { g.beginPath(); g.moveTo(36, y); g.lineTo(CM.W - 36, y); g.stroke(); }

      // top-row buildings (background)
      for (const b of BUILD) if (b.row === 'top') (b.park ? drawPark : drawBuilding)(g, b);
      // fountain centerpiece
      drawFountain(g, t);
      // bottom-row buildings (player never overlaps them — drawn as backdrop)
      for (const b of BUILD) if (b.row === 'bottom') (b.park ? drawPark : drawBuilding)(g, b);

      // depth-sorted moving sprites (strollers, pet, player)
      const sprites = [];
      for (let i = 0; i < STROLL.length; i++) {
        const s = STROLL[i];
        const sx = s.bx + Math.sin(t * s.sp + s.ph) * s.range;
        const sy = s.by;
        const flip = Math.cos(t * s.sp + s.ph) < 0;
        sprites.push({ y: sy, fn: () => CM.drawFriend(g, s.id, sx, sy, 1.0, { bob: (t * 0.9 + i * 0.4) % 1, flip: flip }) });
      }
      if (this.petObj) sprites.push({ y: this.petObj.y, fn: () => CM.hub.drawPetSprite(this, g, t) });
      sprites.push({ y: this.p.y, fn: () => CM.drawPlayer(g, this.p.x, this.p.y, 1.05, this.p.facing, this.p.phase) });
      sprites.sort((a, b) => a.y - b.y);
      for (const s of sprites) s.fn();

      CM.hub.drawTargetMarker(this, g);

      // welcome banner (on top so it stays readable)
      D.rr(g, 332, 6, 296, 38, 15, 'rgba(255,255,255,0.93)', '#f0b9d2', 3);
      D.text(g, '🎀 Cinnamon Town 🎀', 480, 26, { size: 21, color: CM.palette.pinkDeep, weight: 800 });

      // ---- prompt for the nearest building ----
      const near = (this.dialog || this.menu) ? null : this.nearestInteract();
      if (near) {
        const b = near.b;
        const bx = CM.clamp(b.fx - 82, 8, CM.W - 172);
        const by = b.row === 'top' ? b.fy + 8 : b.fy - 92;
        D.bubble(g, bx, by, 164, 44, b.fx);
        D.text(g, b.emoji + ' ' + b.label + '!', b.fx, by + 16, { size: 14, weight: 800 });
        D.text(g, CM.touchMode ? 'tap ★ to go' : 'press SPACE to go', b.fx, by + 33, { size: 12, color: CM.palette.pinkDeep });
      }

      // ---- HUD + overlays ----
      const hint = CM.touchMode
        ? 'Tap a building to visit  ·  drag to walk  ·  👗 to change clothes'
        : 'Walk: click / WASD   ·   Enter a building: SPACE   ·   👗 Dress Up   ·   Sound: M';
      CM.hub.drawHud(this, g, hint);
      if (this.dialog) CM.hub.drawDialog(this, g, t);
      if (this.menu) CM.hub.drawMenu(this, g);
    }
  });
})();
