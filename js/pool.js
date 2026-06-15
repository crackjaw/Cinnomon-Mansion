/* ============================================================
   Cinnamoroll Mansion — pool hub
   The poolside area: same friends, water-themed mini-games.
   Reached from the Town map; leave with the 🗺 Town button.
   Shares movement / dialog / dress-up menu / pet with the other
   hubs via CM.hub.
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  // the swimming pool (a solid — you walk the deck around it)
  const POOL = { x: 300, y: 220, w: 360, h: 206 };

  // game stations around the deck
  const STATIONS = [
    { id: 'waterslide', label: 'Water Slide', emoji: '🛝', host: 'cinnamoroll', x: 138, y: 192,
      line: 'Wheee! Ride the water slide with me, {name}!' },
    { id: 'cannonball', label: 'Cannonball', emoji: '🌊', host: 'keroppi', x: 824, y: 192,
      line: 'Ribbit! Make the biggest splash you can, {name}!' },
    { id: 'ducks', label: 'Duck Round-Up', emoji: '🦆', host: 'mymelody', x: 108, y: 372,
      line: 'Help me scoop up all the rubber duckies, {name}!' },
    { id: 'beachball', label: 'Beach Ball', emoji: '🏐', host: 'pompompurin', x: 850, y: 372,
      line: 'Keep the beach ball up in the air, {name}!' },
    { id: 'poolrace', label: 'Pool Race', emoji: '🏊', host: 'pochacco', x: 300, y: 528,
      line: "Race me across the pool, {name} — go go go!" },
    { id: 'squirt', label: 'Squirt Splash', emoji: '🔫', host: 'kuromi', x: 662, y: 528,
      line: 'Heh heh… water fight! Squirt the targets, {name}!' }
  ];

  // ambient friends lounging poolside
  const AMBIENT = [
    { id: 'hellokitty', x: 480, y: 322, float: true },   // on a ring float in the pool
    { id: 'badtzmaru', x: 480, y: 540, chair: true }      // on a deck chair
  ];

  const BOUNDS = { x1: 30, y1: 110, x2: 930, y2: 576 };
  const SOLIDS = [
    { x: POOL.x, y: POOL.y, w: POOL.w, h: POOL.h }
  ];

  function overlaps(px, py) {
    const bx1 = px - 10, bx2 = px + 10, by1 = py - 8, by2 = py + 2;
    if (px < BOUNDS.x1 || px > BOUNDS.x2 || py < BOUNDS.y1 || py > BOUNDS.y2) return true;
    for (const s of SOLIDS) {
      if (bx2 > s.x && bx1 < s.x + s.w && by2 > s.y && by1 < s.y + s.h) return true;
    }
    return false;
  }

  function sign(g, cx, y, emoji, label) {
    const w = 24 + label.length * 8.2;
    D.rr(g, cx - w / 2, y, w, 24, 9, '#fff', '#bfe3ff', 2.5);
    D.text(g, emoji + ' ' + label, cx, y + 12, { size: 13, color: CM.palette.blueDeep, weight: 800 });
  }
  function umbrella(g, x, y, c) {
    D.shadow(g, x, y, 22);
    g.strokeStyle = '#b9824a'; g.lineWidth = 3;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x, y - 50); g.stroke();
    for (let i = 0; i < 6; i++) {
      g.fillStyle = i % 2 ? c : '#fff';
      g.beginPath(); g.moveTo(x, y - 50);
      g.arc(x, y - 50, 34, Math.PI + i * Math.PI / 6, Math.PI + (i + 1) * Math.PI / 6);
      g.closePath(); g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,0.1)'; g.lineWidth = 1;
    g.beginPath(); g.arc(x, y - 50, 34, Math.PI, Math.PI * 2); g.stroke();
  }

  // each station's poolside prop, drawn behind its host
  function stationProp(g, st, t) {
    if (st.id === 'waterslide') {
      // a little blue slide chute coming down toward the pool
      g.strokeStyle = '#8fd0ee'; g.lineWidth = 16; g.lineCap = 'round';
      g.beginPath(); g.moveTo(st.x - 6, st.y - 36); g.quadraticCurveTo(st.x + 60, st.y - 10, st.x + 90, st.y + 40); g.stroke();
      g.strokeStyle = '#bfe8f6'; g.lineWidth = 8;
      g.beginPath(); g.moveTo(st.x - 6, st.y - 36); g.quadraticCurveTo(st.x + 60, st.y - 10, st.x + 90, st.y + 40); g.stroke();
    } else if (st.id === 'cannonball') {
      // a diving board reaching out over the pool
      D.rr(g, st.x - 96, st.y + 8, 96, 12, 5, '#cfe6f2', '#a8cee0', 2);
      D.rr(g, st.x - 20, st.y + 4, 16, 26, 3, '#fff', '#cfcfcf', 2);
    } else if (st.id === 'ducks') {
      for (let i = 0; i < 3; i++) {
        const dx = st.x + 18 + i * 16, dy = st.y + 18 + Math.sin(t * 2 + i) * 3;
        D.ellipse(g, dx, dy, 7, 5, '#f6cf5a', '#e0b733', 1.5);
        D.circle(g, dx - 3, dy - 5, 4, '#f6cf5a', '#e0b733', 1.5);
        g.fillStyle = '#ef9b2f'; g.beginPath(); g.moveTo(dx - 7, dy - 5); g.lineTo(dx - 10, dy - 4); g.lineTo(dx - 7, dy - 3); g.closePath(); g.fill();
      }
    } else if (st.id === 'beachball') {
      umbrella(g, st.x + 6, st.y + 18, '#ff9ec7');
      // striped beach ball
      const bx = st.x - 28, by = st.y - 20 + Math.sin(t * 3) * 6;
      D.circle(g, bx, by, 11, '#fff', '#e0b0c8', 1.5);
      const cols = ['#ff9ec7', '#8ecdf6', '#ffe07a'];
      for (let i = 0; i < 3; i++) { g.fillStyle = cols[i]; g.beginPath(); g.moveTo(bx, by); g.arc(bx, by, 11, i * 2.1, i * 2.1 + 0.9); g.closePath(); g.fill(); }
    } else if (st.id === 'poolrace') {
      // lane ropes on the water edge
      g.strokeStyle = '#ff8fc4'; g.lineWidth = 3;
      for (let i = 0; i < 2; i++) { g.beginPath(); g.moveTo(st.x - 30, st.y - 18 + i * 12); g.lineTo(st.x + 40, st.y - 18 + i * 12); g.stroke(); }
    } else if (st.id === 'squirt') {
      // a target float + a little water gun
      D.circle(g, st.x - 32, st.y + 6, 12, '#fff', '#ff9ec7', 3);
      D.circle(g, st.x - 32, st.y + 6, 6, '#ff5f8f');
      D.rr(g, st.x + 14, st.y - 6, 20, 9, 3, '#67c587', '#4f9f6b', 2);
      D.rr(g, st.x + 14, st.y + 1, 6, 10, 2, '#67c587', '#4f9f6b', 2);
    }
  }

  CM.registerScene('pool', {
    joystick: true,
    enter() {
      const sp = CM._poolSpawn || { x: 480, y: 156 };
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
      CM._poolSpawn = { x: this.p.x, y: this.p.y };
    },

    nearestInteract() {
      let best = null, bestDist = 74;
      for (const st of STATIONS) {
        const d = CM.dist(this.p.x, this.p.y, st.x, st.y);
        if (d < bestDist) { bestDist = d; best = { type: 'station', station: st }; }
      }
      return best;
    },

    clickInteract(mx, my) {
      for (const st of STATIONS) {
        if (CM.dist(mx, my, st.x, st.y - 30) < 60) return { type: 'station', station: st };
      }
      return null;
    },

    interactAnchor(it) {
      return { x: it.station.x, y: it.station.y + 22, reach: 78 };
    },

    triggerInteract(it) {
      const P = CM.palette;
      CM.audio.play('pop');
      const st = it.station;
      const name = (CM.save.character || {}).name || 'friend';
      if (CM.games[st.id]) {
        this.dialog = { host: st.host, line: st.line.replace('{name}', name), sel: 0, options: [
          { label: "▶ Let's Play!", color: P.mintDeep, run: function () { CM.startGame(st.id); } },
          { label: 'Maybe Later', color: '#b9a8b3', run: function () {} }
        ] };
      } else {
        this.dialog = { host: st.host, line: 'This pool game is still filling up… come back soon!', sel: 0, options: [
          { label: 'OK!', color: P.blueDeep, run: function () {} }
        ] };
      }
    },

    update(dt) {
      CM.hub.update(this, dt);
    },

    draw(g) {
      const t = CM.time;
      // sky + hedge across the top
      const sky = g.createLinearGradient(0, 0, 0, 70);
      sky.addColorStop(0, '#aedcff');
      sky.addColorStop(1, '#cfeecf');
      g.fillStyle = sky;
      g.fillRect(0, 0, CM.W, 48);
      g.fillStyle = '#7fc98f';
      g.fillRect(0, 30, CM.W, 22);
      for (let x = 14; x < CM.W; x += 40) D.circle(g, x, 36, 14, '#8fd6a0');
      // pool deck (pale tiles)
      g.fillStyle = '#e7eef2';
      g.fillRect(0, 48, CM.W, CM.H - 48);
      g.strokeStyle = 'rgba(150,175,190,0.35)';
      g.lineWidth = 2;
      for (let x = 0; x < CM.W; x += 60) { g.beginPath(); g.moveTo(x, 48); g.lineTo(x, CM.H); g.stroke(); }
      for (let y = 60; y < CM.H; y += 60) { g.beginPath(); g.moveTo(0, y); g.lineTo(CM.W, y); g.stroke(); }

      // the pool
      D.rr(g, POOL.x - 8, POOL.y - 8, POOL.w + 16, POOL.h + 16, 24, '#cfe6f2', '#a8cee0', 4); // coping
      const water = g.createLinearGradient(0, POOL.y, 0, POOL.y + POOL.h);
      water.addColorStop(0, '#9fe0f2');
      water.addColorStop(1, '#5cb6e6');
      D.rr(g, POOL.x, POOL.y, POOL.w, POOL.h, 18, water, '#4a9fdc', 3);
      // shimmer ripples
      g.strokeStyle = 'rgba(255,255,255,0.5)'; g.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        const yy = POOL.y + 24 + i * 38;
        g.beginPath();
        for (let x = POOL.x + 12; x < POOL.x + POOL.w - 12; x += 8) {
          const wy = yy + Math.sin((x + t * 50 + i * 30) / 16) * 3;
          if (x === POOL.x + 12) g.moveTo(x, wy); else g.lineTo(x, wy);
        }
        g.stroke();
      }
      // ladder
      g.strokeStyle = '#fff'; g.lineWidth = 4; g.lineCap = 'round';
      for (const lx of [POOL.x + 40, POOL.x + 58]) { g.beginPath(); g.moveTo(lx, POOL.y - 6); g.lineTo(lx, POOL.y + 40); g.stroke(); }
      for (let i = 0; i < 3; i++) { g.beginPath(); g.moveTo(POOL.x + 40, POOL.y + 4 + i * 14); g.lineTo(POOL.x + 58, POOL.y + 4 + i * 14); g.stroke(); }

      // ---- depth-sorted sprites ----
      const sprites = [];
      // poolside umbrellas / chairs decor
      sprites.push({ y: 150, fn: () => umbrella(g, 60, 150, '#8ecdf6') });
      sprites.push({ y: 150, fn: () => umbrella(g, 900, 150, '#ffe07a') });

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
        sprites.push({ y: a.float ? POOL.y - 1 : a.y, fn: () => {
          if (a.float) {
            const fy = a.y + Math.sin(t * 1.6) * 4;
            D.ellipse(g, a.x, fy + 18, 46, 16, 'rgba(0,0,0,0.08)');
            D.circle(g, a.x, fy + 14, 30, '#ffd24a', '#e0b733', 3); // ring float
            D.circle(g, a.x, fy + 14, 16, water || '#7fc7e8');
            CM.drawFriend(g, a.id, a.x, fy + 8, 0.7, { bob: 0, shadow: false });
          } else {
            // deck chair
            D.rr(g, a.x - 26, a.y - 2, 52, 12, 4, '#ff9ec7', '#e87fb2', 2);
            D.rr(g, a.x - 26, a.y - 34, 52, 10, 4, '#ff9ec7', '#e87fb2', 2);
            CM.drawFriend(g, a.id, a.x, a.y - 2, 0.85, { bob: 0, shadow: false });
          }
          const nm = CM.FRIENDS[a.id].name;
          const ny = a.float ? a.y + Math.sin(t * 1.6) * 4 + 30 : a.y + 14;
          D.rr(g, a.x - 42, ny, 84, 18, 9, 'rgba(255,255,255,0.8)');
          D.text(g, nm, a.x, ny + 9, { size: 11, color: CM.palette.ink, weight: 800 });
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
        const st = near.station;
        const bx = CM.clamp(st.x - 80, 8, CM.W - 168);
        D.bubble(g, bx, st.y - 150, 160, 48, st.x);
        D.text(g, st.emoji + ' ' + st.label + '!', bx + 80, st.y - 133, { size: 15, weight: 800 });
        D.text(g, CM.touchMode ? 'tap ★ to play' : 'press SPACE to play', bx + 80, st.y - 115, { size: 12, color: CM.palette.blueDeep });
      }

      // ---- HUD + overlays ----
      const hint = CM.touchMode
        ? 'Drag to walk  ·  ★ to play  ·  🗺 town  ·  👗 dress up'
        : 'Walk: click / WASD   ·   Play: SPACE   ·   🗺 Town   ·   👗 Dress Up';
      CM.hub.drawHud(this, g, hint);
      if (this.dialog) CM.hub.drawDialog(this, g, t);
      if (this.menu) CM.hub.drawMenu(this, g);
    }
  });
})();
