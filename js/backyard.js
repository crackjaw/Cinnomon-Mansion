/* ============================================================
   Cinnamoroll Mansion — backyard hub
   The outdoor area out back: same friends, outdoor mini-games.
   Reaches the indoor mansion via the patio door at the top.
   Shares walk-around movement / dialog / dress-up menu / pet with
   the mansion through CM.hub.
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  // patio door back into the mansion (top-centre)
  const INSIDE = { door: { x: 430, y: 8, w: 100, h: 62 }, frontX: 480, frontY: 112 };
  // gate down to the pool (bottom-centre)
  const POOLGATE = { cx: 480, y: 516, w: 96, h: 48, frontX: 480, frontY: 500 };
  // gate over to the playground (bottom-right corner)
  const PLAYGATE = { cx: 876, y: 522, w: 92, h: 44, frontX: 876, frontY: 506 };
  // gate off to school (bottom-left corner)
  const SCHOOLGATE = { cx: 86, y: 522, w: 92, h: 44, frontX: 86, frontY: 506 };
  // cafe storefront on the right edge (mid-height) — its own little shop entrance
  const CAFEGATE = { x: 876, y: 286, w: 64, h: 104, cx: 908, frontX: 842, frontY: 338 };
  // boutique storefront on the left edge (mid-height) — make-your-own-clothes shop
  const SHOPGATE = { x: 20, y: 286, w: 64, h: 104, cx: 52, frontX: 118, frontY: 338 };

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
      const id = CM.dist(this.p.x, this.p.y, INSIDE.frontX, INSIDE.frontY);
      if (id < 72 && id < bestDist) { bestDist = id; best = { type: 'inside' }; }
      const pd = CM.dist(this.p.x, this.p.y, POOLGATE.frontX, POOLGATE.frontY);
      if (pd < 72 && pd < bestDist) { bestDist = pd; best = { type: 'pool' }; }
      const gd = CM.dist(this.p.x, this.p.y, PLAYGATE.frontX, PLAYGATE.frontY);
      if (gd < 70 && gd < bestDist) { bestDist = gd; best = { type: 'play' }; }
      const cd = CM.dist(this.p.x, this.p.y, SCHOOLGATE.frontX, SCHOOLGATE.frontY);
      if (cd < 70 && cd < bestDist) { bestDist = cd; best = { type: 'school' }; }
      const fd = CM.dist(this.p.x, this.p.y, CAFEGATE.frontX, CAFEGATE.frontY);
      if (fd < 72 && fd < bestDist) { bestDist = fd; best = { type: 'cafe' }; }
      const sd = CM.dist(this.p.x, this.p.y, SHOPGATE.frontX, SHOPGATE.frontY);
      if (sd < 72 && sd < bestDist) best = { type: 'boutique' };
      return best;
    },

    clickInteract(mx, my) {
      for (const st of STATIONS) {
        if (CM.dist(mx, my, st.x, st.y - 30) < 60) return { type: 'station', station: st };
      }
      if (mx > INSIDE.door.x - 16 && mx < INSIDE.door.x + INSIDE.door.w + 16 && my < INSIDE.door.y + INSIDE.door.h + 30) {
        return { type: 'inside' };
      }
      if (Math.abs(mx - POOLGATE.cx) < POOLGATE.w / 2 + 16 && my > POOLGATE.y - 30) {
        return { type: 'pool' };
      }
      if (Math.abs(mx - PLAYGATE.cx) < PLAYGATE.w / 2 + 16 && my > PLAYGATE.y - 30) {
        return { type: 'play' };
      }
      if (Math.abs(mx - SCHOOLGATE.cx) < SCHOOLGATE.w / 2 + 16 && my > SCHOOLGATE.y - 30) {
        return { type: 'school' };
      }
      if (mx > CAFEGATE.x - 20 && my > CAFEGATE.y - 30 && my < CAFEGATE.y + CAFEGATE.h + 30) {
        return { type: 'cafe' };
      }
      if (mx < SHOPGATE.x + SHOPGATE.w + 20 && my > SHOPGATE.y - 30 && my < SHOPGATE.y + SHOPGATE.h + 30) {
        return { type: 'boutique' };
      }
      return null;
    },

    interactAnchor(it) {
      if (it.type === 'inside') return { x: INSIDE.frontX, y: INSIDE.frontY, reach: 72 };
      if (it.type === 'pool') return { x: POOLGATE.frontX, y: POOLGATE.frontY, reach: 72 };
      if (it.type === 'play') return { x: PLAYGATE.frontX, y: PLAYGATE.frontY, reach: 72 };
      if (it.type === 'school') return { x: SCHOOLGATE.frontX, y: SCHOOLGATE.frontY, reach: 72 };
      if (it.type === 'cafe') return { x: CAFEGATE.frontX, y: CAFEGATE.frontY, reach: 72 };
      if (it.type === 'boutique') return { x: SHOPGATE.frontX, y: SHOPGATE.frontY, reach: 72 };
      return { x: it.station.x, y: it.station.y + 22, reach: 76 };
    },

    triggerInteract(it) {
      const P = CM.palette;
      if (it.type === 'inside') { CM.audio.play('pop'); CM.switchScene('mansion'); return; }
      if (it.type === 'pool') { CM.audio.play('pop'); CM.switchScene('pool'); return; }
      if (it.type === 'play') { CM.audio.play('pop'); CM.switchScene('playground'); return; }
      if (it.type === 'school') { CM.audio.play('pop'); CM.switchScene('school'); return; }
      if (it.type === 'cafe') { CM.audio.play('pop'); CM.switchScene('cafe'); return; }
      if (it.type === 'boutique') { CM.audio.play('pop'); CM.switchScene('boutique'); return; }
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

      // house back wall + windows + patio door
      g.fillStyle = '#f7d7e6';
      g.fillRect(0, 0, CM.W, 54);
      g.fillStyle = 'rgba(255,255,255,0.4)';
      for (let x = 16; x < CM.W; x += 60) g.fillRect(x, 0, 24, 48);
      g.fillStyle = '#fff';
      g.fillRect(0, 48, CM.W, 8);
      for (const wx of [150, 300, 660, 810]) {
        D.rr(g, wx - 22, 8, 44, 34, 6, '#cdeaff', '#fff', 3);
        g.strokeStyle = '#fff'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(wx, 10); g.lineTo(wx, 40); g.moveTo(wx - 20, 25); g.lineTo(wx + 20, 25); g.stroke();
      }
      // patio door
      const dr = INSIDE.door;
      D.rr(g, dr.x - 6, dr.y - 4, dr.w + 12, dr.h + 8, 9, '#fff', '#e8c9d8', 3);
      const pw = (dr.w - 6) / 2;
      for (let i = 0; i < 2; i++) {
        D.rr(g, dr.x + 2 + i * (pw + 2), dr.y, pw, dr.h, 6, '#ffe7f0', '#f0b9d2', 2);
      }
      D.circle(g, dr.x + dr.w / 2, dr.y + dr.h / 2, 3.5, '#f6cf5a');
      sign(g, dr.x + dr.w / 2, dr.y + dr.h + 6, '🏠', 'Inside');

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
      // gate off to school (bottom-left) — a little schoolhouse archway
      sprites.push({ y: SCHOOLGATE.y + SCHOOLGATE.h, fn: () => {
        const x0 = SCHOOLGATE.cx - SCHOOLGATE.w / 2;
        D.rr(g, SCHOOLGATE.cx - 52, SCHOOLGATE.y - 30, 104, 26, 9, '#fff', '#f0b9d2', 2.5);
        D.text(g, '🏫 School', SCHOOLGATE.cx, SCHOOLGATE.y - 17, { size: 14, color: CM.palette.pinkDeep, weight: 800 });
        D.rr(g, x0, SCHOOLGATE.y, 12, SCHOOLGATE.h, 4, '#fff', '#e8b9c8', 2);
        D.rr(g, x0 + SCHOOLGATE.w - 12, SCHOOLGATE.y, 12, SCHOOLGATE.h, 4, '#fff', '#e8b9c8', 2);
        D.rr(g, x0 + 12, SCHOOLGATE.y + 6, SCHOOLGATE.w - 24, SCHOOLGATE.h - 8, 6, '#ffd9e8', '#f0b9d2', 2);
        // a little roof gable
        g.fillStyle = '#ef8f6f';
        g.beginPath(); g.moveTo(x0 + 4, SCHOOLGATE.y); g.lineTo(SCHOOLGATE.cx, SCHOOLGATE.y - 12); g.lineTo(x0 + SCHOOLGATE.w - 4, SCHOOLGATE.y); g.closePath(); g.fill();
        D.text(g, 'ABC', SCHOOLGATE.cx, SCHOOLGATE.y + SCHOOLGATE.h / 2, { size: 14, color: CM.palette.pinkDeep, weight: 800 });
      } });
      // gate over to the playground (bottom-right) — a sunny archway
      sprites.push({ y: PLAYGATE.y + PLAYGATE.h, fn: () => {
        const x0 = PLAYGATE.cx - PLAYGATE.w / 2;
        D.rr(g, PLAYGATE.cx - 54, PLAYGATE.y - 30, 108, 26, 9, '#fff', '#ffe1b0', 2.5);
        D.text(g, '🛝 Playground', PLAYGATE.cx, PLAYGATE.y - 17, { size: 14, color: '#e08a2a', weight: 800 });
        D.rr(g, x0, PLAYGATE.y, 12, PLAYGATE.h, 4, '#fff', '#e6c79a', 2);
        D.rr(g, x0 + PLAYGATE.w - 12, PLAYGATE.y, 12, PLAYGATE.h, 4, '#fff', '#e6c79a', 2);
        D.rr(g, x0 + 12, PLAYGATE.y + 6, PLAYGATE.w - 24, PLAYGATE.h - 8, 6, '#ffe6a8', '#f2c45a', 2);
        D.star(g, x0 + 22, PLAYGATE.y + PLAYGATE.h / 2, 7, '#ff9ec7');
        D.star(g, x0 + PLAYGATE.w - 22, PLAYGATE.y + PLAYGATE.h / 2, 7, '#8ecdf6');
      } });
      // cafe storefront on the right edge — a cute shop with a striped awning
      sprites.push({ y: CAFEGATE.y + CAFEGATE.h, fn: () => {
        const gx = CAFEGATE.x, gy = CAFEGATE.y, gw = CAFEGATE.w, gh = CAFEGATE.h;
        // storefront wall
        D.rr(g, gx - 16, gy - 14, gw + 32, gh + 22, 10, '#fff1e6', '#e8b48f', 3);
        // window with a little cake
        D.rr(g, gx - 10, gy + 8, 16, 26, 4, '#cdeeff', '#9ec9e6', 2);
        D.rr(g, gx - 9, gy + 24, 14, 10, 2, '#ffd9e8');
        D.circle(g, gx - 2, gy + 24, 2, '#ff5f8f');
        // glass door
        D.rr(g, gx + 12, gy, gw - 12, gh, 8, '#bfe3f5', '#9ec9e6', 3);
        g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(gx + 12 + (gw - 12) / 2, gy + 8); g.lineTo(gx + 12 + (gw - 12) / 2, gy + gh - 8); g.stroke();
        D.circle(g, gx + 12 + (gw - 12) / 2 - 5, gy + gh / 2, 2.5, '#e8a23a');
        D.circle(g, gx + 12 + (gw - 12) / 2 + 5, gy + gh / 2, 2.5, '#e8a23a');
        // striped awning
        const ax = gx - 18, aw = gw + 36, ay = gy - 28, ah = 18;
        for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#ff9ec7' : '#fff7fb'; g.fillRect(ax + i * aw / 7, ay, aw / 7 + 0.6, ah); }
        for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#ff9ec7' : '#fff7fb'; D.circle(g, ax + (i + 0.5) * aw / 7, ay + ah, aw / 14, g.fillStyle); }
        g.strokeStyle = '#e87faa'; g.lineWidth = 2; g.strokeRect(ax, ay, aw, ah);
        // sign
        D.rr(g, CAFEGATE.cx - 48, gy - 56, 96, 24, 9, '#fff', '#e8b48f', 2.5);
        D.text(g, '☕ Cafe', CAFEGATE.cx, gy - 44, { size: 15, color: '#cf7a3a', weight: 800 });
      } });
      // boutique storefront on the left edge — a cute clothes shop with a striped awning
      sprites.push({ y: SHOPGATE.y + SHOPGATE.h, fn: () => {
        const gx = SHOPGATE.x, gy = SHOPGATE.y, gw = SHOPGATE.w, gh = SHOPGATE.h;
        // storefront wall
        D.rr(g, gx - 16, gy - 14, gw + 32, gh + 22, 10, '#fff0f6', '#e8a9c8', 3);
        // window with a little dress on show (toward the yard)
        D.rr(g, gx + gw - 4, gy + 8, 16, 26, 4, '#ffe6f0', '#e8a9c8', 2);
        CM.drawDesignIcon(g, { garment: 'dress', color: '#ff9ec7', accent: '#fff', pattern: 'dots', motif: 'heart' }, gx + gw + 4, gy + 22, 0.5);
        // glass door (near the left edge)
        D.rr(g, gx, gy, gw - 12, gh, 8, '#fbe3f0', '#e6a9c8', 3);
        g.strokeStyle = 'rgba(255,255,255,0.85)'; g.lineWidth = 2;
        g.beginPath(); g.moveTo(gx + (gw - 12) / 2, gy + 8); g.lineTo(gx + (gw - 12) / 2, gy + gh - 8); g.stroke();
        D.circle(g, gx + (gw - 12) / 2 - 5, gy + gh / 2, 2.5, '#cf6a9a');
        D.circle(g, gx + (gw - 12) / 2 + 5, gy + gh / 2, 2.5, '#cf6a9a');
        // striped awning
        const ax = gx - 16, aw = gw + 34, ay = gy - 28, ah = 18;
        for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#ff9ec7' : '#fff7fb'; g.fillRect(ax + i * aw / 7, ay, aw / 7 + 0.6, ah); }
        for (let i = 0; i < 7; i++) { g.fillStyle = i % 2 ? '#ff9ec7' : '#fff7fb'; D.circle(g, ax + (i + 0.5) * aw / 7, ay + ah, aw / 14, g.fillStyle); }
        g.strokeStyle = '#e87faa'; g.lineWidth = 2; g.strokeRect(ax, ay, aw, ah);
        // sign
        D.rr(g, SHOPGATE.cx - 52, gy - 56, 104, 24, 9, '#fff', '#e8a9c8', 2.5);
        D.text(g, '👗 Boutique', SHOPGATE.cx, gy - 44, { size: 14, color: CM.palette.pinkDeep, weight: 800 });
      } });

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

      // gate down to the pool
      sprites.push({ y: POOLGATE.y + POOLGATE.h, fn: () => {
        const x0 = POOLGATE.cx - POOLGATE.w / 2;
        D.rr(g, POOLGATE.cx - 52, POOLGATE.y - 30, 104, 26, 9, '#fff', '#bfe3ff', 2.5);
        D.text(g, '🏊 Pool', POOLGATE.cx, POOLGATE.y - 17, { size: 14, color: CM.palette.blueDeep, weight: 800 });
        D.rr(g, x0, POOLGATE.y, 12, POOLGATE.h, 4, '#fff', '#bcd9f0', 2);
        D.rr(g, x0 + POOLGATE.w - 12, POOLGATE.y, 12, POOLGATE.h, 4, '#fff', '#bcd9f0', 2);
        D.rr(g, x0 + 12, POOLGATE.y + 6, POOLGATE.w - 24, POOLGATE.h - 8, 6, '#8fd0ee', '#6bb6dd', 2);
        g.strokeStyle = 'rgba(255,255,255,0.75)'; g.lineWidth = 2;
        for (let i = 0; i < 2; i++) {
          g.beginPath();
          for (let x = x0 + 16; x < x0 + POOLGATE.w - 16; x += 5) {
            const yy = POOLGATE.y + 20 + i * 14 + Math.sin((x + t * 40) / 8) * 2;
            if (x === x0 + 16) g.moveTo(x, yy); else g.lineTo(x, yy);
          }
          g.stroke();
        }
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
        if (near.type === 'inside') {
          D.bubble(g, INSIDE.frontX - 80, INSIDE.frontY + 6, 160, 44, INSIDE.frontX);
          D.text(g, '🏠 Go back inside!', INSIDE.frontX, INSIDE.frontY + 22, { size: 13, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to go in' : 'press SPACE to go in', INSIDE.frontX, INSIDE.frontY + 39, { size: 12, color: CM.palette.pinkDeep });
        } else if (near.type === 'pool') {
          D.bubble(g, POOLGATE.cx - 82, POOLGATE.y - 92, 164, 44, POOLGATE.cx);
          D.text(g, '🏊 To the Pool!', POOLGATE.cx, POOLGATE.y - 76, { size: 14, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to swim' : 'press SPACE to swim', POOLGATE.cx, POOLGATE.y - 59, { size: 12, color: CM.palette.blueDeep });
        } else if (near.type === 'play') {
          D.bubble(g, CM.clamp(PLAYGATE.cx - 82, 8, CM.W - 172), PLAYGATE.y - 92, 164, 44, PLAYGATE.cx);
          D.text(g, '🛝 To the Playground!', PLAYGATE.cx, PLAYGATE.y - 76, { size: 13, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to play' : 'press SPACE to play', PLAYGATE.cx, PLAYGATE.y - 59, { size: 12, color: '#e08a2a' });
        } else if (near.type === 'school') {
          D.bubble(g, CM.clamp(SCHOOLGATE.cx - 82, 8, CM.W - 172), SCHOOLGATE.y - 92, 164, 44, SCHOOLGATE.cx);
          D.text(g, '🏫 Off to School!', SCHOOLGATE.cx, SCHOOLGATE.y - 76, { size: 14, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to go' : 'press SPACE to go', SCHOOLGATE.cx, SCHOOLGATE.y - 59, { size: 12, color: CM.palette.pinkDeep });
        } else if (near.type === 'cafe') {
          D.bubble(g, CM.clamp(CAFEGATE.frontX - 82, 8, CM.W - 172), CAFEGATE.frontY - 92, 164, 44, CAFEGATE.frontX);
          D.text(g, '☕ Into the Cafe!', CAFEGATE.frontX, CAFEGATE.frontY - 76, { size: 14, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to cook' : 'press SPACE to cook', CAFEGATE.frontX, CAFEGATE.frontY - 59, { size: 12, color: '#cf7a3a' });
        } else if (near.type === 'boutique') {
          D.bubble(g, CM.clamp(SHOPGATE.frontX - 82, 8, CM.W - 172), SHOPGATE.frontY - 92, 164, 44, SHOPGATE.frontX);
          D.text(g, '👗 Into the Boutique!', SHOPGATE.frontX, SHOPGATE.frontY - 76, { size: 13, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to shop' : 'press SPACE to shop', SHOPGATE.frontX, SHOPGATE.frontY - 59, { size: 12, color: CM.palette.pinkDeep });
        } else {
          const st = near.station;
          const bx = CM.clamp(st.x - 80, 8, CM.W - 168);
          D.bubble(g, bx, st.y - 150, 160, 48, st.x);
          D.text(g, st.emoji + ' ' + st.label + '!', bx + 80, st.y - 133, { size: 15, weight: 800 });
          D.text(g, CM.touchMode ? 'tap ★ to play' : 'press SPACE to play', bx + 80, st.y - 115, { size: 12, color: CM.palette.pinkDeep });
        }
      }

      // ---- HUD + overlays ----
      const hint = CM.touchMode
        ? '🏠 · 👗 Shop · 🏫 School · ☕ Cafe · 🏊 Pool · 🛝 Play'
        : '🏠 Inside · 👗 Boutique · 🏫 School · ☕ Cafe · 🏊 Pool · 🛝 Play';
      CM.hub.drawHud(this, g, hint);
      if (this.dialog) CM.hub.drawDialog(this, g, t);
      if (this.menu) CM.hub.drawMenu(this, g);
    }
  });
})();
