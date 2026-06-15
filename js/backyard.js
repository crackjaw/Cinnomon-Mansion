/* ============================================================
   Cinnamoroll Mansion — backyard hub
   The outdoor area out back: same friends, outdoor mini-games.
   Reached from the Town map; leave with the 🗺 Town button.
   Shares walk-around movement / dialog / dress-up menu / pet with
   the other hubs through CM.hub.
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  // game stations (2 rows of 4): walk up to the friend and they invite you to play
  const STATIONS = [
    { id: 'puttputt', label: 'Putt-Putt', emoji: '⛳', host: 'pompompurin', x: 150, y: 232,
      line: 'Wanna play a round of mini-golf, {name}?' },
    { id: 'followleader', label: 'Follow Leader', emoji: '🎵', host: 'cinnamoroll', x: 372, y: 232,
      line: 'Copy my moves, {name}! Follow the leader!' },
    { id: 'hopscotch', label: 'Hopscotch', emoji: '🔢', host: 'hellokitty', x: 588, y: 232,
      line: 'Hop the squares with me, {name}!' },
    { id: 'soccer', label: 'Penalty Kicks', emoji: '⚽', host: 'pochacco', x: 810, y: 232,
      line: "Bet you can't score on me, {name}!" },
    { id: 'splash', label: 'Water Balloons', emoji: '💦', host: 'badtzmaru', x: 150, y: 470,
      line: 'Heh… ready for a water-balloon toss, {name}?' },
    { id: 'jumprope', label: 'Jump Rope', emoji: '🪢', host: 'kuromi', x: 372, y: 470,
      line: "Let's see how long you can jump, {name}!" },
    { id: 'redlight', label: 'Red Light!', emoji: '🚦', host: 'keroppi', x: 588, y: 470,
      line: 'Ribbit! Badtz is running Red Light, Green Light — go play!' },
    { id: 'butterfly', label: 'Butterfly Catch', emoji: '🦋', host: 'mymelody', x: 810, y: 470,
      line: 'Catch the pretty butterflies with me, {name}!' }
  ];

  const AMBIENT = []; // every friend hosts a game now — the yard is packed with things to do!

  const POND = { x: 436, y: 322, w: 90, h: 42 };
  const BOUNDS = { x1: 30, y1: 110, x2: 930, y2: 576 };
  const SOLIDS = [
    { x: POND.x, y: POND.y, w: POND.w, h: POND.h },
    { x: 44, y: 150, w: 24, h: 24 },   // tree trunks
    { x: 892, y: 150, w: 24, h: 24 }
  ];

  function overlaps(px, py) {
    const bx1 = px - 10, bx2 = px + 10, by1 = py - 8, by2 = py + 2;
    if (px < BOUNDS.x1 || px > BOUNDS.x2 || py < BOUNDS.y1 || py > BOUNDS.y2) return true;
    for (const s of SOLIDS) {
      if (bx2 > s.x && bx1 < s.x + s.w && by2 > s.y && by1 < s.y + s.h) return true;
    }
    return false;
  }

  /* ---------- decoration drawing ---------- */
  function tree(g, x, y, s) {
    s = s || 1;
    D.shadow(g, x, y, 34 * s);
    D.rr(g, x - 9 * s, y - 44 * s, 18 * s, 46 * s, 6, '#b07a45', '#8a5a3b', 2);
    D.circle(g, x - 18 * s, y - 58 * s, 26 * s, '#8fd6a0', '#6fbc82', 2);
    D.circle(g, x + 18 * s, y - 58 * s, 26 * s, '#8fd6a0', '#6fbc82', 2);
    D.circle(g, x, y - 80 * s, 30 * s, '#a5dfae', '#6fbc82', 2);
    D.circle(g, x, y - 62 * s, 28 * s, '#a5dfae');
    for (let i = 0; i < 4; i++) {
      D.circle(g, x - 24 * s + i * 16 * s, y - 88 * s + (i % 2) * 14 * s, 3, '#ff9ec7');
    }
  }
  function flower(g, x, y, c) {
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * Math.PI * 2;
      D.circle(g, x + Math.cos(a) * 5, y + Math.sin(a) * 5, 3.5, c);
    }
    D.circle(g, x, y, 2.6, '#ffe07a');
  }
  function bush(g, x, y, s) {
    s = s || 1;
    D.ellipse(g, x, y, 30 * s, 18 * s, '#8fd6a0', '#6fbc82', 2);
    D.ellipse(g, x - 16 * s, y + 4, 16 * s, 12 * s, '#a5dfae');
    D.ellipse(g, x + 16 * s, y + 4, 16 * s, 12 * s, '#a5dfae');
  }
  function sign(g, cx, y, emoji, label) {
    const w = 24 + label.length * 8.2;
    D.rr(g, cx - w / 2, y, w, 24, 9, '#fff', '#cfe6c4', 2.5);
    D.text(g, emoji + ' ' + label, cx, y + 12, { size: 13, color: CM.palette.mintDeep, weight: 800 });
  }

  // each station's prop, drawn behind its host
  function stationProp(g, st, t) {
    if (st.id === 'puttputt') {
      D.ellipse(g, st.x, st.y + 18, 70, 26, '#bfe8c8', '#8fce9d', 2); // green
      D.circle(g, st.x + 36, st.y + 14, 7, '#3a3a3a');                 // hole
      g.strokeStyle = '#b9824a'; g.lineWidth = 3; g.lineCap = 'round';
      g.beginPath(); g.moveTo(st.x + 36, st.y + 12); g.lineTo(st.x + 36, st.y - 26); g.stroke();
      g.fillStyle = '#ff5f8f';
      g.beginPath(); g.moveTo(st.x + 36, st.y - 26); g.lineTo(st.x + 56, st.y - 20); g.lineTo(st.x + 36, st.y - 14); g.closePath(); g.fill();
    } else if (st.id === 'soccer') {
      // goal frame + net behind the host
      const gx = st.x, gy = st.y - 70, gw = 150, gh = 64;
      D.rr(g, gx - gw / 2, gy, gw, gh, 6, 'rgba(255,255,255,0.18)', '#fff', 5);
      g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 1.5;
      for (let i = 1; i < 6; i++) { g.beginPath(); g.moveTo(gx - gw / 2 + i * gw / 6, gy + 4); g.lineTo(gx - gw / 2 + i * gw / 6, gy + gh - 2); g.stroke(); }
      for (let j = 1; j < 4; j++) { g.beginPath(); g.moveTo(gx - gw / 2 + 4, gy + j * gh / 4); g.lineTo(gx + gw / 2 - 4, gy + j * gh / 4); g.stroke(); }
      D.circle(g, gx - 38, st.y + 16, 9, '#fff', '#cfcfcf', 2); // a ball on the grass
      g.strokeStyle = '#3a3a3a'; g.lineWidth = 1.2;
      g.beginPath(); g.arc(gx - 38, st.y + 16, 9, 0, Math.PI * 2); g.stroke();
    } else if (st.id === 'splash') {
      // a tub + stacked target cans
      D.rr(g, st.x - 30, st.y + 4, 60, 26, 8, '#7bb3d9', '#5a93bd', 3);
      D.ellipse(g, st.x, st.y + 6, 28, 8, '#bfe4f5');
      for (let i = 0; i < 3; i++) D.rr(g, st.x + 22 + (i % 2) * 14, st.y - 8 - i * 16, 16, 16, 3, '#ef8f6f', '#cf6f4f', 2);
    } else if (st.id === 'butterfly') {
      for (let i = 0; i < 7; i++) flower(g, st.x - 36 + i * 12, st.y + 16 + (i % 2) * 8, ['#ff9ec7', '#c9a8f0', '#ffd24a'][i % 3]);
      // a couple of butterflies fluttering
      for (let i = 0; i < 2; i++) {
        const bx = st.x - 18 + i * 40 + Math.sin(t * 2 + i) * 8;
        const by = st.y - 30 + Math.cos(t * 2.4 + i) * 8;
        const fl = Math.abs(Math.sin(t * 8 + i)) * 5 + 2;
        g.fillStyle = i ? '#ffd24a' : '#a8d8ff';
        D.ellipse(g, bx - fl, by, 4, 6, g.fillStyle);
        D.ellipse(g, bx + fl, by, 4, 6, g.fillStyle);
      }
    } else if (st.id === 'followleader') {
      // floating "move" notes in the four lane colours
      const cols = ['#ff9ec7', '#8ecdf6', '#ffe07a', '#bdeccd'];
      for (let i = 0; i < 4; i++) {
        const nx = st.x - 30 + i * 20;
        const ny = st.y - 24 + Math.sin(t * 3 + i) * 6;
        D.circle(g, nx, ny, 6, cols[i], 'rgba(0,0,0,0.1)', 1.5);
        D.text(g, '♪', nx, ny + 1, { size: 9, color: '#fff', weight: 800 });
      }
    } else if (st.id === 'hopscotch') {
      // chalk squares with numbers on the grass
      for (let i = 0; i < 3; i++) {
        const sx = st.x - 26 + (i % 2 ? 0 : 0), sy = st.y + 22 - i * 18;
        D.rr(g, sx - 13, sy - 9, 26, 18, 4, 'rgba(255,255,255,0.7)', '#f0b9d2', 2);
        D.text(g, String(i + 1), sx, sy, { size: 12, color: CM.palette.pinkDeep, weight: 800 });
      }
    } else if (st.id === 'jumprope') {
      // a turning rope arc beside Kuromi
      g.strokeStyle = '#ff8fc4'; g.lineWidth = 3; g.lineCap = 'round';
      const sw = Math.sin(t * 3) * 0.5 + 0.5;
      g.beginPath();
      g.ellipse(st.x + 8, st.y - 4, 30, 30 * sw + 6, 0, Math.PI * 0.1, Math.PI * 0.9);
      g.stroke();
    } else if (st.id === 'redlight') {
      // a little traffic light on a post
      g.strokeStyle = '#9a8a94'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(st.x - 34, st.y + 16); g.lineTo(st.x - 34, st.y - 18); g.stroke();
      D.rr(g, st.x - 44, st.y - 44, 20, 32, 6, '#4d4458');
      const go = Math.sin(t * 1.5) > 0;
      D.circle(g, st.x - 34, st.y - 36, 5, go ? '#5a3a3a' : '#ef5b5b');
      D.circle(g, st.x - 34, st.y - 22, 5, go ? '#67c587' : '#3a5a3a');
    }
  }

  CM.registerScene('backyard', {
    joystick: true,
    enter() {
      const sp = CM._backyardSpawn || { x: 480, y: 150 };
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
      CM._backyardSpawn = { x: this.p.x, y: this.p.y };
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
      return { x: it.station.x, y: it.station.y + 22, reach: 76 };
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
        this.dialog = { host: st.host, line: 'This game is still being set up… come back soon!', sel: 0, options: [
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
      const sky = g.createLinearGradient(0, 0, 0, 220);
      sky.addColorStop(0, '#aedcff');
      sky.addColorStop(1, '#d8f0e0');
      g.fillStyle = sky;
      g.fillRect(0, 0, CM.W, 130);
      // clouds
      for (const c of [[140, 38, 1], [760, 30, 0.8], [560, 60, 0.6]]) {
        const cx = (c[0] + t * 6) % (CM.W + 120) - 60;
        D.ellipse(g, cx, c[1], 40 * c[2], 18 * c[2], 'rgba(255,255,255,0.92)');
        D.ellipse(g, cx - 24 * c[2], c[1] + 6, 24 * c[2], 13 * c[2], 'rgba(255,255,255,0.92)');
        D.ellipse(g, cx + 26 * c[2], c[1] + 5, 26 * c[2], 14 * c[2], 'rgba(255,255,255,0.92)');
      }
      // grass
      const grass = g.createLinearGradient(0, 110, 0, CM.H);
      grass.addColorStop(0, '#9bdaa9');
      grass.addColorStop(1, '#86d199');
      g.fillStyle = grass;
      g.fillRect(0, 110, CM.W, CM.H - 110);
      g.strokeStyle = 'rgba(110,188,130,0.5)';
      g.lineWidth = 2;
      for (let i = 0; i < 60; i++) {
        const gx = (i * 137 + 20) % CM.W, gy = 140 + ((i * 53) % 420);
        g.beginPath(); g.moveTo(gx, gy); g.lineTo(gx - 3, gy - 7); g.moveTo(gx + 2, gy); g.lineTo(gx + 5, gy - 6); g.stroke();
      }

      // house back wall + windows
      g.fillStyle = '#f7d7e6';
      g.fillRect(0, 0, CM.W, 54);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      for (let x = 16; x < CM.W; x += 60) g.fillRect(x, 0, 24, 48);
      g.fillStyle = '#fff';
      g.fillRect(0, 48, CM.W, 8);
      for (const wx of [150, 300, 480, 660, 810]) {
        D.rr(g, wx - 22, 8, 44, 34, 6, '#cdeaff', '#fff', 3);
        g.strokeStyle = '#fff'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(wx, 10); g.lineTo(wx, 40); g.moveTo(wx - 20, 25); g.lineTo(wx + 20, 25); g.stroke();
      }

      // flat ground decor (under sprites)
      D.ellipse(g, POND.x + POND.w / 2, POND.y + POND.h / 2, POND.w / 2, POND.h / 2, '#8fd0ee', '#6bb6dd', 3);
      D.ellipse(g, POND.x + POND.w / 2, POND.y + POND.h / 2 - 4, POND.w / 2 - 14, POND.h / 2 - 10, '#b6e4f6');
      for (let i = 0; i < 3; i++) {
        const rp = (t * 0.4 + i / 3) % 1;
        g.globalAlpha = (1 - rp) * 0.5;
        D.ellipse(g, POND.x + POND.w / 2, POND.y + POND.h / 2, 8 + rp * 34, (8 + rp * 34) * 0.4, null, '#fff', 1.5);
        g.globalAlpha = 1;
      }
      // scattered flowers
      const fc = ['#ff9ec7', '#fff', '#ffd24a', '#c9a8f0'];
      for (let i = 0; i < 16; i++) {
        flower(g, (i * 211 + 70) % CM.W, 150 + ((i * 97) % 400), fc[i % 4]);
      }

      // ---- depth-sorted sprites ----
      const sprites = [];
      sprites.push({ y: 176, fn: () => tree(g, 70, 176, 1) });
      sprites.push({ y: 176, fn: () => tree(g, 892, 176, 1) });

      // game stations (prop + host + sign)
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
          if (a.picnic) {
            D.ellipse(g, a.x, a.y + 8, 78, 34, '#ffd9e8', '#f0b9d2', 3);
            g.strokeStyle = 'rgba(255,255,255,0.6)'; g.lineWidth = 2;
            for (let k = -2; k <= 2; k++) { g.beginPath(); g.moveTo(a.x + k * 26, a.y - 20); g.lineTo(a.x + k * 26, a.y + 34); g.stroke(); }
            D.circle(g, a.x + 40, a.y + 2, 8, '#fff', '#e8c9d8', 2); // a little basket/plate
            D.circle(g, a.x + 40, a.y - 2, 4, '#ef5b5b');
          }
          CM.drawFriend(g, a.id, a.x, a.y, a.picnic ? 0.95 : 1.0, { bob: ((t * 0.7 + i * 0.4) % 1) * (a.pond ? 0.5 : 0.3), flip: a.x > 480 });
          const nm = CM.FRIENDS[a.id].name;
          D.rr(g, a.x - 44, a.y + 6, 88, 18, 9, 'rgba(255,255,255,0.8)');
          D.text(g, nm, a.x, a.y + 15, { size: 11, color: CM.palette.ink, weight: 800 });
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
        D.text(g, CM.touchMode ? 'tap ★ to play' : 'press SPACE to play', bx + 80, st.y - 115, { size: 12, color: CM.palette.pinkDeep });
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
