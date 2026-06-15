/* ============================================================
   Cinnamoroll Mansion — boutique hub
   A little clothing store where you walk up to the Design Studio
   to MAKE YOUR OWN CLOTHES, browse your Closet, or use the mirror
   to dress up. Reached from the Town map; leave with the 🗺 Town
   button. Shares movement / dialog / dress-up menu / pet via CM.hub.
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  // things to walk up to
  const SPOTS = [
    { type: 'studio', x: 480, y: 300, emoji: '✂️', label: 'Design Studio', host: 'mymelody' },
    { type: 'closet', x: 798, y: 312, emoji: '🗂', label: 'My Closet' },
    { type: 'mirror', x: 150, y: 312, emoji: '🪞', label: 'Dress-Up Mirror' }
  ];

  // sample outfits shown hanging on the racks (just decoration)
  const RACK = [
    { garment: 'top', color: '#ff9ec7', accent: '#ffffff', pattern: 'hearts', motif: 'none' },
    { garment: 'dress', color: '#8ecdf6', accent: '#ffffff', pattern: 'dots', motif: 'star' },
    { garment: 'top', color: '#7fd6a0', accent: '#ffd24a', pattern: 'stripes', motif: 'none' },
    { garment: 'bottom', color: '#c9a8f0', accent: '#ffffff', pattern: 'checks', motif: 'none' },
    { garment: 'dress', color: '#ffd24a', accent: '#ff5f8f', pattern: 'rainbow', motif: 'heart' }
  ];

  const BOUNDS = { x1: 30, y1: 110, x2: 930, y2: 576 };

  function overlaps(px, py) {
    return px < BOUNDS.x1 || px > BOUNDS.x2 || py < BOUNDS.y1 || py > BOUNDS.y2;
  }

  function sign(g, cx, y, emoji, label) {
    const w = 26 + label.length * 8.2;
    D.rr(g, cx - w / 2, y, w, 24, 9, '#fff', '#e8b9d4', 2.5);
    D.text(g, emoji + ' ' + label, cx, y + 12, { size: 13, color: CM.palette.pinkDeep, weight: 800 });
  }

  function hanger(g, x, y, design) {
    // little hook
    g.strokeStyle = '#b9a0b0'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y - 16); g.lineTo(x, y - 8); g.stroke();
    D.circle(g, x, y - 17, 2.4, null, '#b9a0b0', 1.8);
    g.beginPath(); g.moveTo(x - 9, y - 4); g.lineTo(x, y - 9); g.lineTo(x + 9, y - 4); g.stroke();
    CM.drawDesignIcon(g, design, x, y + 10, 0.92);
  }

  function mannequin(g, x, y, design) {
    D.shadow(g, x, y, 22);
    // stand
    D.rr(g, x - 3, y - 20, 6, 20, 2, '#cdbcae');
    D.ellipse(g, x, y, 22, 7, '#cdbcae', '#b09a86', 2);
    // body form wearing the design
    g.save(); g.translate(x, y - 64); g.scale(1.5, 1.5);
    CM.fillGarment(g, design, (gg) => { gg.beginPath(); gg.moveTo(-13, -14); gg.lineTo(-18, -6); gg.lineTo(-12, 0); gg.lineTo(-11, 26); gg.lineTo(11, 26); gg.lineTo(12, 0); gg.lineTo(18, -6); gg.lineTo(13, -14); gg.quadraticCurveTo(0, -8, -13, -14); gg.closePath(); }, -18, -14, 36, 42);
    g.strokeStyle = design.accent || '#fff'; g.lineWidth = 2; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-6, -11); g.quadraticCurveTo(0, -6, 6, -11); g.stroke();
    CM.garmentMotif(g, design.motif, 0, 2, 4, CM.garmentIsLight(design.color) ? '#ff4f9a' : '#fff');
    g.restore();
    // neck knob
    D.circle(g, x, y - 70, 5, '#f0e2d6', '#cdbcae', 2);
  }

  CM.registerScene('boutique', {
    joystick: true,
    enter() {
      const sp = CM._boutiqueSpawn || { x: 480, y: 156 };
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
      CM._boutiqueSpawn = { x: this.p.x, y: this.p.y };
    },

    nearestInteract() {
      let best = null, bestDist = 82;
      for (const s of SPOTS) {
        const d = CM.dist(this.p.x, this.p.y, s.x, s.y + 18);
        if (d < bestDist) { bestDist = d; best = { type: s.type, spot: s }; }
      }
      return best;
    },

    clickInteract(mx, my) {
      for (const s of SPOTS) {
        if (CM.dist(mx, my, s.x, s.y - 20) < 66) return { type: s.type, spot: s };
      }
      return null;
    },

    interactAnchor(it) {
      return { x: it.spot.x, y: it.spot.y + 36, reach: 86 };
    },

    triggerInteract(it) {
      const P = CM.palette;
      CM.audio.play('pop');
      const name = (CM.save.character || {}).name || 'friend';
      if (it.type === 'studio') {
        this.dialog = { host: 'mymelody', line: 'Want to design your own clothes, ' + name + '? Pick a colour, pattern and trim!', sel: 0, options: [
          { label: '✂️ Start Designing!', color: P.pinkDeep, run: function () { CM.switchScene('design', { from: 'boutique' }); } },
          { label: 'Maybe Later', color: '#b9a8b3', run: function () {} }
        ] };
      } else if (it.type === 'closet') {
        CM.switchScene('design', { from: 'boutique', closet: true });
      } else if (it.type === 'mirror') {
        CM.hub.openMenu(this);
      }
    },

    update(dt) {
      CM.hub.update(this, dt);
    },

    draw(g) {
      const t = CM.time;

      // ---- walls ----
      const wall = g.createLinearGradient(0, 0, 0, 120);
      wall.addColorStop(0, '#ffe4f1');
      wall.addColorStop(1, '#ffd3e6');
      g.fillStyle = wall;
      g.fillRect(0, 0, CM.W, 104);
      g.fillStyle = '#f3bcd6';
      g.fillRect(0, 98, CM.W, 8);

      // bunting flags across the top
      const bc = ['#ff9ec7', '#8ecdf6', '#bdeccd', '#ffd24a'];
      g.strokeStyle = 'rgba(207,90,140,0.4)'; g.lineWidth = 2;
      g.beginPath(); g.moveTo(0, 10); g.quadraticCurveTo(CM.W / 2, 22, CM.W, 10); g.stroke();
      for (let i = 0; i < 16; i++) {
        const fx = 30 + i * 60, fy = 12 + Math.sin(i) * 2;
        g.fillStyle = bc[i % 4];
        g.beginPath(); g.moveTo(fx - 8, fy); g.lineTo(fx + 8, fy); g.lineTo(fx, fy + 14); g.closePath(); g.fill();
      }

      // boutique sign (right of the door, in the clear gap before Dress Up)
      D.rr(g, 540, 50, 150, 48, 10, '#fff', '#e8b9d4', 3);
      D.text(g, '👗 BOUTIQUE', 615, 68, { size: 15, color: CM.palette.pinkDeep, weight: 800 });
      D.text(g, 'make your style!', 615, 88, { size: 13, color: '#b07a96', weight: 700 });
      // a little mirror motif on the left, below the coins chip
      D.circle(g, 70, 74, 18, '#eaf6ff', '#bcd9f0', 3);
      D.ellipse(g, 64, 70, 5, 9, 'rgba(255,255,255,0.8)');

      // ---- floor ----
      const floor = g.createLinearGradient(0, 104, 0, CM.H);
      floor.addColorStop(0, '#ffeef6');
      floor.addColorStop(1, '#f6dcea');
      g.fillStyle = floor;
      g.fillRect(0, 104, CM.W, CM.H - 104);
      // checker tiles
      const ts = 48;
      for (let yy = 104, row = 0; yy < CM.H; yy += ts, row++)
        for (let xx = 0, col = 0; xx < CM.W; xx += ts, col++)
          if ((row + col) % 2 === 0) { g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(xx, yy, ts, ts); }
      // a soft runway rug down the middle
      D.rr(g, 410, 150, 140, 410, 16, 'rgba(255,158,199,0.16)', 'rgba(255,158,199,0.3)', 3);

      // clothing racks along the back wall (decor)
      function rack(g2, x0, y0, items) {
        D.rr(g2, x0 - 6, y0 - 22, 12, 8, 3, '#cdbcae');             // post
        D.rr(g2, x0 + (items.length - 1) * 40 - 6, y0 - 22, 12, 8, 3, '#cdbcae');
        g2.strokeStyle = '#b9a0b0'; g2.lineWidth = 4; g2.lineCap = 'round';
        g2.beginPath(); g2.moveTo(x0 - 10, y0 - 18); g2.lineTo(x0 + (items.length - 1) * 40 + 10, y0 - 18); g2.stroke();
        for (let i = 0; i < items.length; i++) hanger(g2, x0 + i * 40, y0, items[i]);
      }

      // ---- depth-sorted sprites ----
      const sprites = [];

      // back-wall racks (drawn first, behind everyone)
      sprites.push({ y: 150, fn: () => { rack(g, 250, 150, RACK.slice(0, 2)); rack(g, 600, 150, RACK.slice(2, 5)); } });

      // mannequins flanking the runway
      sprites.push({ y: 250, fn: () => mannequin(g, 300, 250, RACK[1]) });
      sprites.push({ y: 250, fn: () => mannequin(g, 660, 250, RACK[4]) });

      // Design Studio (My Melody at a table)
      sprites.push({ y: 300, fn: () => {
        const s = SPOTS[0];
        // design table with fabric + a big sewing spool
        D.rr(g, s.x - 46, s.y + 14, 92, 22, 6, '#d9a06a', '#b97f48', 2.5);
        D.rr(g, s.x - 40, s.y + 8, 30, 12, 3, '#ff9ec7', '#e87faa', 1.5);   // fabric bolt
        D.rr(g, s.x - 6, s.y + 8, 26, 12, 3, '#8ecdf6', '#5fa8e0', 1.5);
        D.rr(g, s.x + 24, s.y + 6, 8, 16, 2, '#c9a8f0');                     // spool
        // scissors
        D.circle(g, s.x + 30, s.y - 2, 3.5, null, '#9a8a94', 2);
        D.circle(g, s.x + 30, s.y + 6, 3.5, null, '#9a8a94', 2);
        CM.drawFriend(g, 'mymelody', s.x, s.y, 1.05, { bob: ((t * 0.8) % 1) * 0.4 });
        sign(g, s.x, s.y + 40, s.emoji, s.label);
      } });

      // Closet (a wardrobe full of your saved designs)
      sprites.push({ y: 312, fn: () => {
        const s = SPOTS[1];
        D.rr(g, s.x - 34, s.y - 40, 68, 78, 8, '#e9c79c', '#c79a64', 3);     // wardrobe
        D.rr(g, s.x - 28, s.y - 34, 28, 66, 5, '#fff4ea', '#e3c39a', 2);
        D.rr(g, s.x + 1, s.y - 34, 28, 66, 5, '#fff4ea', '#e3c39a', 2);
        D.circle(g, s.x - 4, s.y, 2.5, '#b97f48'); D.circle(g, s.x + 5, s.y, 2.5, '#b97f48');
        const saved = (CM.save.customDesigns || []);
        if (saved.length) { CM.drawDesignIcon(g, saved[0], s.x - 14, s.y - 8, 0.6); if (saved[1]) CM.drawDesignIcon(g, saved[1], s.x + 15, s.y - 8, 0.6); }
        sign(g, s.x, s.y + 40, s.emoji, s.label);
      } });

      // Mirror (Dress Up)
      sprites.push({ y: 312, fn: () => {
        const s = SPOTS[2];
        D.rr(g, s.x - 26, s.y - 54, 52, 92, 24, '#ffe7a8', '#e8c46a', 3);    // gold frame
        D.rr(g, s.x - 19, s.y - 47, 38, 78, 19, '#dff1ff', '#bcdcf0', 2);    // glass
        g.globalAlpha = 0.5; D.ellipse(g, s.x - 6, s.y - 20, 7, 22, '#fff'); g.globalAlpha = 1;
        sign(g, s.x, s.y + 40, s.emoji, s.label);
      } });

      // ambient shopper
      sprites.push({ y: 500, fn: () => {
        CM.drawFriend(g, 'hellokitty', 300, 500, 0.95, { bob: ((t * 0.7) % 1) * 0.3 });
        D.rr(g, 300 - 40, 500 + 14, 80, 18, 9, 'rgba(255,255,255,0.82)');
        D.text(g, CM.FRIENDS.hellokitty.name, 300, 500 + 23, { size: 11, color: CM.palette.ink, weight: 800 });
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
        const s = near.spot;
        const bx = CM.clamp(s.x - 80, 8, CM.W - 168);
        const verb = s.type === 'studio' ? 'design' : (s.type === 'closet' ? 'open' : 'dress up');
        D.bubble(g, bx, s.y - 132, 160, 48, s.x);
        D.text(g, s.emoji + ' ' + s.label + '!', bx + 80, s.y - 115, { size: 15, weight: 800 });
        D.text(g, (CM.touchMode ? 'tap ★ to ' : 'press SPACE to ') + verb, bx + 80, s.y - 97, { size: 12, color: CM.palette.pinkDeep });
      }

      // ---- HUD + overlays ----
      const hint = CM.touchMode
        ? 'Drag to walk  ·  ✂️ design  ·  🪞 dress up  ·  🗺 town'
        : 'Walk: click / WASD   ·   ✂️ Make clothes: SPACE   ·   🗺 Town   ·   👗 Dress Up';
      CM.hub.drawHud(this, g, hint);
      if (this.dialog) CM.hub.drawDialog(this, g, t);
      if (this.menu) CM.hub.drawMenu(this, g);
    }
  });
})();
