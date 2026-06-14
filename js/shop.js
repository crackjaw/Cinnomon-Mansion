/* ============================================================
   Cinnamoroll Mansion — Gift Shop
   Spend coins to unlock new clothes, accessories and pet friends.
   Buying auto-equips the item; tap an owned item to wear it.
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  const TABS = [
    { key: 'top', label: 'Tops', emoji: '👕' },
    { key: 'bottom', label: 'Bottoms', emoji: '👖' },
    { key: 'acc', label: 'Items', emoji: '🎩' },
    { key: 'pet', label: 'Pets', emoji: '🐾' },
    { key: 'mypet', label: 'My Pet', emoji: '🎨' }
  ];

  // Premium catalog. Indices match the entries appended in characters.js.
  const CATALOG = {
    top: [
      { index: 9, name: 'Pink Pop Tee', price: 30 },
      { index: 10, name: 'Teal Tee', price: 30 },
      { index: 11, name: 'Purple Tee', price: 45 },
      { index: 12, name: 'Golden Tee', price: 70 }
    ],
    bottom: [
      { index: 8, name: 'Teal Shorts', price: 30 },
      { index: 9, name: 'Lavender Skirt', price: 35 },
      { index: 10, name: 'Coral Pants', price: 45 },
      { index: 11, name: 'Starry Navy', price: 70 }
    ],
    acc: [
      { index: 9, name: 'Party Hat', price: 35 },
      { index: 8, name: 'Headphones', price: 55 },
      { index: 11, name: 'Flower Crown', price: 60 },
      { index: 7, name: 'Halo', price: 75 },
      { index: 10, name: 'Wizard Hat', price: 85 },
      { index: 6, name: 'Royal Crown', price: 110 }
    ],
    pet: [
      { id: 'chick', name: 'Chick', price: 40 },
      { id: 'kitten', name: 'Kitten', price: 55 },
      { id: 'puppy', name: 'Puppy', price: 55 },
      { id: 'bunny', name: 'Bunny', price: 70 },
      { id: 'star', name: 'Star Buddy', price: 120 }
    ]
  };

  function isOwned(tab, item) {
    if (tab === 'pet') return !!(CM.save.owned && CM.save.owned['pet:' + item.id]);
    return CM.ownsOption(tab, item.index);
  }
  function isEquipped(tab, item) {
    if (tab === 'pet') return CM.save.pet === item.id;
    const ch = CM.save.character || {};
    return ch[tab] === item.index;
  }
  function equip(tab, item) {
    if (tab === 'pet') {
      CM.save.pet = CM.save.pet === item.id ? null : item.id; // toggle
    } else {
      if (!CM.save.character) CM.save.character = CM.defaultCharacter();
      CM.save.character[tab] = item.index;
      // a preset garment replaces any custom-designed one in that slot
      if (tab === 'top') CM.save.character.customTop = null;
      else if (tab === 'bottom') CM.save.character.customBottom = null;
    }
    CM.persist();
  }
  // A cfg preview wearing this clothing item (for the cards & try-on).
  function previewCfg(tab, item) {
    const base = CM.save.character || CM.defaultCharacter();
    if (tab === 'pet') return base;
    const c = {};
    for (const k in base) c[k] = base[k];
    c[tab] = item.index;
    // show the preset being tried on, not a custom design masking it
    if (tab === 'top') c.customTop = null;
    else if (tab === 'bottom') c.customBottom = null;
    return c;
  }

  CM.registerScene('shop', {
    enter() {
      this.tab = 'top';
      this.parts = [];
      this.msg = '';
      this.msgT = 0;
      this.denyT = 0;
      this.pop = 0;
      this.cards = [];   // {item, x, y, w, h}
      this.tabRects = [];
      // pet-name field (HTML overlay) for the My Pet tab
      this.inp = document.getElementById('nameInput');
      this.inp.value = CM.save.petName || '';
      this._nameShown = false;
      this._typing = false;
      this._coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      this._onInput = () => { CM.save.petName = (this.inp.value || '').slice(0, 12); CM.persist(); };
      this._onFocus = () => {
        if (!this._coarse) return;
        this._typing = true;
        const s = this.inp.style;
        s.position = 'fixed'; s.left = '50%'; s.top = 'calc(env(safe-area-inset-top) + 10px)';
        s.transform = 'translateX(-50%)'; s.width = '70%'; s.maxWidth = '420px';
        s.height = '40px'; s.fontSize = '18px'; s.zIndex = '60';
      };
      this._onBlur = () => { this._typing = false; this._placeName(); };
      this.inp.addEventListener('input', this._onInput);
      this.inp.addEventListener('focus', this._onFocus);
      this.inp.addEventListener('blur', this._onBlur);
      this._placeName = () => {
        if (this._typing) return;
        const r = CM.canvas.getBoundingClientRect();
        const sx = r.width / CM.W, sy = r.height / CM.H;
        const s = this.inp.style;
        s.position = 'absolute'; s.transform = 'none'; s.maxWidth = 'none'; s.zIndex = '';
        s.left = r.left + 560 * sx + 'px';
        s.top = r.top + 432 * sy + 'px';
        s.width = 300 * sx + 'px';
        s.height = Math.max(26, 34 * sy) + 'px';
        s.fontSize = Math.max(13, 17 * sx) + 'px';
        s.display = 'block';
      };
      window.addEventListener('resize', () => { if (this._nameShown) this._placeName(); });
    },
    exit() {
      if (this.inp) {
        this.inp.style.display = 'none';
        this.inp.removeEventListener('input', this._onInput);
        this.inp.removeEventListener('focus', this._onFocus);
        this.inp.removeEventListener('blur', this._onBlur);
      }
    },

    confetti() {
      const colors = ['#ff9ec7', '#8ecdf6', '#ffe9a8', '#bdeccd', '#d8c9f2', '#f6cf5a'];
      for (let i = 0; i < 46 && this.parts.length < 90; i++) {
        this.parts.push({
          x: CM.rand(120, 540), y: CM.rand(120, 300),
          vx: CM.rand(-90, 90), vy: CM.rand(-220, -90),
          rot: CM.rand(0, 7), vr: CM.rand(-6, 6),
          size: CM.rand(5, 10), color: CM.pick(colors), life: CM.rand(0.8, 1.4), t: 0
        });
      }
    },
    flash(item, kind) {
      this.msg = kind === 'buy' ? 'Yay! You got the ' + item.name + '! 🎀'
        : (this.tab === 'pet' && CM.save.pet === item.id ? item.name + ' is following you!' : 'Wearing the ' + item.name + '!');
      this.msgT = 2.4;
      this.pop = 1;
    },
    deny() {
      this.denyT = 0.4;
      this.msg = 'Play games to earn more coins! 🎮';
      this.msgT = 2.2;
      CM.audio.play('miss');
    },
    buy(item) {
      const tab = this.tab;
      if (isOwned(tab, item)) {
        equip(tab, item);
        CM.audio.play('pop');
        this.flash(item, 'equip');
        return;
      }
      if (CM.save.coins < item.price) { this.deny(); return; }
      CM.addCoins(-item.price);
      if (!CM.save.owned) CM.save.owned = {};
      CM.save.owned[tab === 'pet' ? 'pet:' + item.id : tab + ':' + item.index] = true;
      equip(tab, item);
      CM.audio.play('coin');
      CM.audio.play('tada');
      this.flash(item, 'buy');
      this.confetti();
    },

    update(dt) {
      this.msgT = Math.max(0, this.msgT - dt);
      this.denyT = Math.max(0, this.denyT - dt);
      this.pop = Math.max(0, this.pop - dt * 2.5);
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const c = this.parts[i];
        c.t += dt;
        if (c.t >= c.life) { this.parts.splice(i, 1); continue; }
        c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 480 * dt; c.rot += c.vr * dt;
      }
      if (CM.input.pressed('back')) { CM.switchScene('mansion'); return; }
    },

    draw(g) {
      const t = CM.time;
      // background
      const grad = g.createLinearGradient(0, 0, 0, CM.H);
      grad.addColorStop(0, '#ffe9f6');
      grad.addColorStop(1, '#e7dcff');
      g.fillStyle = grad;
      g.fillRect(0, 0, CM.W, CM.H);
      for (let i = 0; i < 10; i++) {
        const dx = (i * 191 + 50) % CM.W;
        const dy = (i * 133 + Math.sin(t + i) * 12 + 70) % CM.H;
        g.globalAlpha = 0.22;
        D.circle(g, dx, dy, 9 + (i % 3) * 5, i % 2 ? '#ff9ec7' : '#b9a0f0');
        g.globalAlpha = 1;
      }

      D.text(g, '🎀 Gift Shop 🎀', 480, 34, { size: 32, color: P.pinkDeep, stroke: '#fff', strokeWidth: 8, weight: 800 });

      // coin balance
      D.rr(g, 372, 54, 216, 34, 17, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      D.coin(g, 398, 71, 12);
      D.text(g, CM.save.coins + ' coins', 470, 72, { size: 19, color: '#c98a1f', weight: 800 });

      // ---- tabs ----
      this.tabRects = [];
      const tw = 132, gap = 10, tx0 = (CM.W - (tw * TABS.length + gap * (TABS.length - 1))) / 2;
      for (let i = 0; i < TABS.length; i++) {
        const tb = TABS[i];
        const x = tx0 + i * (tw + gap), y = 100, h = 40;
        const on = this.tab === tb.key;
        if (CM.ui.button(g, x, y, tw, h, tb.emoji + ' ' + tb.label, {
          color: on ? P.pinkDeep : '#d6c2dc', size: 17, sfx: 'pop'
        })) {
          this.tab = tb.key;
          this.parts.length = 0;
        }
        this.tabRects.push({ x, y, w: tw, h, key: tb.key });
      }

      // ---- live preview (left) ----
      const m = CM.input.mouse;
      CM.ui.panel(g, 24, 156, 268, 392);
      if (this.tab === 'mypet') {
        // big preview of the equipped pet
        D.text(g, 'My Pet', 158, 180, { size: 18, color: P.pinkDeep, weight: 800 });
        if (CM.save.pet) {
          D.ellipse(g, 158, 472, 70, 18, '#ffeaf3', '#f3cfe0', 2);
          CM.drawPet(g, CM.save.pet, 158, 466, 4.4, { bob: (CM.sceneTime * 1.4) % 1 });
          const pn = (CM.save.petName || '').trim();
          D.text(g, pn ? pn : CM.PETS[CM.save.pet].name, 158, 504, { size: 19, color: P.blueDeep, weight: 800 });
          D.text(g, pn ? '(' + CM.PETS[CM.save.pet].name + ')' : 'Give me a name!', 158, 528, { size: 14, color: '#9a8a94' });
        } else {
          CM.drawFriend(g, 'mymelody', 158, 430, 1.4, { bob: (CM.sceneTime) % 1 });
          D.text(g, 'No pet yet!', 158, 470, { size: 18, color: P.ink, weight: 800 });
          D.text(g, 'Get a friend in', 158, 500, { size: 14, color: '#9a8a94' });
          D.text(g, 'the 🐾 Pets tab', 158, 520, { size: 14, color: P.pinkDeep, weight: 800 });
        }
      } else {
        D.text(g, 'You', 158, 180, { size: 18, color: P.pinkDeep, weight: 800 });
        D.ellipse(g, 150, 474, 78, 20, '#ffeaf3', '#f3cfe0', 2);
        // try-on: hovered card overrides the preview
        let hovered = null;
        for (const c of this.cards) {
          if (m.x >= c.x && m.x <= c.x + c.w && m.y >= c.y && m.y <= c.y + c.h) { hovered = c; break; }
        }
        const showCfg = (hovered && this.tab !== 'pet') ? previewCfg(this.tab, hovered.item) : (CM.save.character || CM.defaultCharacter());
        const phase = (CM.sceneTime * 1.0) % 1;
        CM.drawPlayer(g, 150, 470, 2.5, 'down', phase, showCfg);
        const petId = (hovered && this.tab === 'pet') ? hovered.item.id : CM.save.pet;
        if (petId) CM.drawPet(g, petId, 230, 476, 1.6, { bob: (CM.sceneTime * 1.4) % 1, flip: true });
        D.text(g, (CM.save.character || {}).name || 'Friend', 158, 502, { size: 19, color: P.blueDeep, weight: 800 });
        D.text(g, hovered ? 'Tap to ' + (isOwned(this.tab, hovered.item) ? 'wear!' : 'buy!') : 'Pick something cute!',
          158, 526, { size: 14, color: '#9a8a94' });
      }

      // ---- right side: customization (My Pet) or item cards ----
      if (this.tab === 'mypet') {
        this.cards = [];
        this.drawMyPet(g, t);
      } else {
        if (this._nameShown) { this.inp.style.display = 'none'; this._nameShown = false; }
        const list = CATALOG[this.tab];
        const ax = 312, ay = 152, cols = 3;
        const cw = 196, chh = 176, cgx = 8, cgy = 14;
        this.cards = [];
        for (let i = 0; i < list.length; i++) {
          const item = list[i];
          const col = i % cols, row = Math.floor(i / cols);
          const x = ax + col * (cw + cgx), y = ay + row * (chh + cgy);
          this.cards.push({ item, x, y, w: cw, h: chh });
          this.drawCard(g, item, x, y, cw, chh, t);
        }
      }

      // ---- message banner ----
      if (this.msgT > 0) {
        g.globalAlpha = Math.min(1, this.msgT);
        const shake = this.denyT > 0 ? Math.sin(t * 50) * 4 : 0;
        D.rr(g, 250 + shake, 556, 460, 34, 17, this.denyT > 0 ? '#ffe0e0' : '#fff6d6', this.denyT > 0 ? P.red : P.yellowDeep, 2);
        D.text(g, this.msg, 480 + shake, 573, { size: 16, color: P.ink, weight: 800 });
        g.globalAlpha = 1;
      }

      // ---- back button ----
      if (CM.ui.button(g, 32, 556, 180, 36, '← Back to Mansion', { color: P.blueDeep, size: 16 })) {
        CM.switchScene('mansion');
        return;
      }

      // ---- confetti (drawn on top) ----
      for (const c of this.parts) {
        g.save();
        g.globalAlpha = Math.max(0, 1 - c.t / c.life);
        g.translate(c.x, c.y); g.rotate(c.rot);
        g.fillStyle = c.color;
        g.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
        g.restore();
      }
      g.globalAlpha = 1;
    },

    drawMyPet(g, t) {
      const m = CM.input.mouse;
      if (!CM.save.pet) {
        if (this._nameShown) { this.inp.style.display = 'none'; this._nameShown = false; }
        D.text(g, 'Pick a pet first! 🐾', 624, 320, { size: 24, color: P.pinkDeep, weight: 800 });
        D.text(g, 'Tap the 🐾 Pets tab to adopt a cute friend,', 624, 360, { size: 16, color: P.ink, weight: 700 });
        D.text(g, 'then come back to make them your own!', 624, 384, { size: 16, color: P.ink, weight: 700 });
        return;
      }
      D.text(g, 'Make your pet your own! 🎨', 624, 178, { size: 20, color: P.pinkDeep, weight: 800 });

      // colour swatches
      D.text(g, 'Colour', 336, 222, { size: 17, align: 'left', color: P.ink, weight: 800 });
      for (let i = 0; i < CM.PET_COLORS.length; i++) {
        const cx = 362 + i * 42, cy = 256;
        const sw = CM.PET_COLORS[i] || CM.PETS[CM.save.pet].color;
        const sel = (CM.save.petColor || 0) === i;
        if (sel) D.circle(g, cx, cy, 18, null, P.pinkDeep, 3.5);
        D.circle(g, cx, cy, 14, sw, 'rgba(0,0,0,0.15)', 1.5);
        if (i === 0) D.star(g, cx, cy, 6, '#f2b53c'); // natural marker
        if (m.clicked && CM.dist(m.x, m.y, cx, cy) < 18) {
          m.clicked = false; CM.save.petColor = i; CM.persist(); CM.audio.play('pop');
        }
      }

      // accessory buttons
      D.text(g, 'Accessory', 336, 318, { size: 17, align: 'left', color: P.ink, weight: 800 });
      for (let i = 0; i < CM.PET_ACCS.length; i++) {
        const bx = 336 + i * 100, by = 336;
        const sel = (CM.save.petAcc || 0) === i;
        if (CM.ui.button(g, bx, by, 92, 42, CM.PET_ACCS[i], { color: sel ? P.mintDeep : '#cbb6d2', size: 15, sfx: 'pop' })) {
          CM.save.petAcc = i; CM.persist();
        }
      }

      // name field (HTML overlay, positioned by _placeName)
      D.text(g, '🐾 Name', 360, 449, { size: 17, align: 'left', color: P.ink, weight: 800 });
      this._placeName();
      this._nameShown = true;

      D.text(g, 'Your pet keeps their look & name! 💕', 624, 512, { size: 14, color: '#9a8a94', weight: 700 });
    },

    drawCard(g, item, x, y, w, h, t) {
      const tab = this.tab;
      const owned = isOwned(tab, item);
      const equipped = isEquipped(tab, item);
      const afford = CM.save.coins >= item.price;
      const m = CM.input.mouse;
      const hover = m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
      const locked = !owned && !afford;

      // card body
      D.rr(g, x + 3, y + 5, w - 6, h - 6, 16, 'rgba(120,70,110,0.10)');
      D.rr(g, x, y, w - 4, h - 4, 16, locked ? '#efe7ef' : '#fff', equipped ? P.mintDeep : (hover ? P.pink : '#f0d8e6'), equipped ? 4 : 3);

      // preview art (figure sized so even tall hats stay inside the card)
      g.save();
      if (locked) g.globalAlpha = 0.55;
      const cx = x + (w - 4) / 2;
      if (tab === 'pet') {
        D.ellipse(g, cx, y + 110, 32, 9, '#f3eef8');
        CM.drawPet(g, item.id, cx, y + 114, 1.9, { bob: (t * 1.4) % 1 });
      } else {
        D.ellipse(g, cx, y + 122, 28, 8, '#f3eef8');
        CM.drawPlayer(g, cx, y + 120, 1.05, 'down', 0, previewCfg(tab, item));
      }
      g.restore();

      D.text(g, item.name, cx, y + 136, { size: 15, color: P.ink, weight: 800 });

      // state chip
      const cy = y + h - 30;
      if (equipped) {
        D.rr(g, x + 24, cy, w - 52, 26, 13, P.mintDeep);
        D.text(g, tab === 'pet' ? 'Following ✓' : 'Wearing ✓', cx, cy + 13, { size: 14, color: '#fff', weight: 800 });
      } else if (owned) {
        D.rr(g, x + 24, cy, w - 52, 26, 13, P.blueDeep);
        D.text(g, tab === 'pet' ? 'Make my pet' : 'Wear it', cx, cy + 13, { size: 14, color: '#fff', weight: 800 });
      } else {
        D.rr(g, x + 24, cy, w - 52, 26, 13, afford ? P.pinkDeep : '#c9b6c2');
        D.coin(g, x + 44, cy + 13, 9);
        D.text(g, (afford ? 'Buy  ' : '') + item.price, cx + 8, cy + 13, { size: 14, color: '#fff', weight: 800 });
      }

      if (hover && m.clicked) {
        m.clicked = false;
        this.buy(item);
      }
    }
  });
})();
