/* ============================================================
   Cinnamoroll Mansion — Design Studio
   Make your own clothes: pick a garment, colour, pattern, trim
   and a little motif, see it on your character live, then Wear It
   or Save it to your Closet. Reached from the Boutique.
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  const GARMENTS = [
    { key: 'top', label: '👕 Top' },
    { key: 'bottom', label: '👖 Skirt' },
    { key: 'dress', label: '✨ Dress' }
  ];

  function design(self) {
    return {
      garment: self.garment,
      color: CM.GARMENT_COLORS[self.colorIdx],
      accent: CM.GARMENT_ACCENTS[self.accentIdx],
      pattern: CM.GARMENT_PATTERNS[self.patternIdx].toLowerCase(),
      motif: CM.GARMENT_MOTIFS[self.motifIdx].toLowerCase()
    };
  }
  function applyTo(cfg, d) {
    if (d.garment === 'top') { cfg.customTop = d; }
    else if (d.garment === 'bottom') { cfg.customBottom = d; }
    else { cfg.customTop = Object.assign({}, d); cfg.customBottom = Object.assign({}, d); }
  }
  function previewCfg(self) {
    const base = CM.save.character || CM.defaultCharacter();
    const c = {};
    for (const k in base) c[k] = base[k];
    applyTo(c, design(self));
    return c;
  }

  // a little rectangular fabric swatch showing colour + pattern
  function chip(g, d, x, y, w, h) {
    const path = (gg) => { gg.beginPath(); gg.moveTo(x + 6, y); gg.arcTo(x + w, y, x + w, y + h, 6); gg.arcTo(x + w, y + h, x, y + h, 6); gg.arcTo(x, y + h, x, y, 6); gg.arcTo(x, y, x + w, y, 6); gg.closePath(); };
    CM.fillGarment(g, d, path, x, y, w, h);
    g.strokeStyle = 'rgba(0,0,0,0.15)'; g.lineWidth = 2; path(g); g.stroke();
  }

  function swatchRow(g, label, y, colors, sel, onPick) {
    D.text(g, label, 366, y, { size: 17, align: 'left', color: P.ink, weight: 800 });
    const m = CM.input.mouse;
    const startX = 492, span = 404;
    const step = Math.min(40, span / Math.max(1, colors.length - 1));
    const hit = Math.max(13, step * 0.5);
    for (let i = 0; i < colors.length; i++) {
      const cx = startX + i * step;
      if (i === sel) D.circle(g, cx, y, 16, null, P.pinkDeep, 3.5);
      D.circle(g, cx, y, i === sel ? 13 : 11, colors[i], 'rgba(0,0,0,0.18)', 1.5);
      if (colors[i] === '#ffffff') D.circle(g, cx, y, i === sel ? 13 : 11, null, '#d8c8d2', 1.5);
      if (m.clicked && CM.dist(m.x, m.y, cx, y) < hit) { m.clicked = false; CM.audio.play('pop'); onPick(i); }
    }
  }

  function arrowRow(g, label, y, valueText, onPrev, onNext, chipFn) {
    D.text(g, label, 366, y, { size: 17, align: 'left', color: P.ink, weight: 800 });
    if (CM.ui.button(g, 492, y - 17, 36, 34, '◀', { color: P.blueDeep, size: 16, sfx: 'pop' })) onPrev();
    if (chipFn) chipFn(g, 612, y - 16);
    D.text(g, valueText, 720, y, { size: 18, color: P.pinkDeep, weight: 800 });
    if (CM.ui.button(g, 860, y - 17, 36, 34, '▶', { color: P.blueDeep, size: 16, sfx: 'pop' })) onNext();
  }

  CM.registerScene('design', {
    enter(params) {
      params = params || {};
      this.from = CM.HUBS[params.from] ? params.from : 'boutique';
      this.garment = 'top';
      this.colorIdx = 0;
      this.patternIdx = 0;
      this.accentIdx = 0;
      this.motifIdx = 0;
      this.showCloset = !!params.closet;
      this.msg = '';
      this.msgT = 0;
      this.parts = [];
    },
    exit() { this.parts = []; },

    flash(text) { this.msg = text; this.msgT = 2.2; },
    confetti() {
      const cols = ['#ff9ec7', '#8ecdf6', '#ffe9a8', '#bdeccd', '#d8c9f2', '#f6cf5a'];
      for (let i = 0; i < 40 && this.parts.length < 80; i++) {
        this.parts.push({ x: CM.rand(60, 300), y: CM.rand(120, 320), vx: CM.rand(-80, 80), vy: CM.rand(-220, -90),
          rot: CM.rand(0, 7), vr: CM.rand(-6, 6), size: CM.rand(5, 10), color: CM.pick(cols), life: CM.rand(0.8, 1.4), t: 0 });
      }
    },
    wearIt() {
      if (!CM.save.character) CM.save.character = CM.defaultCharacter();
      applyTo(CM.save.character, design(this));
      CM.persist();
      CM.audio.play('tada');
      this.confetti();
      this.flash('Wearing your design! 👗');
    },
    saveDesign() {
      if (!CM.save.customDesigns) CM.save.customDesigns = [];
      CM.save.customDesigns.unshift(design(this));
      if (CM.save.customDesigns.length > 15) CM.save.customDesigns.length = 15;
      CM.persist();
      CM.audio.play('coin');
      this.flash('Saved to your closet! 💾');
    },
    loadDesign(d) {
      this.garment = d.garment || 'top';
      const ci = CM.GARMENT_COLORS.indexOf(d.color); if (ci >= 0) this.colorIdx = ci;
      const ai = CM.GARMENT_ACCENTS.indexOf(d.accent); if (ai >= 0) this.accentIdx = ai;
      const pi = CM.GARMENT_PATTERNS.map((s) => s.toLowerCase()).indexOf(d.pattern || 'solid'); if (pi >= 0) this.patternIdx = pi;
      const mi = CM.GARMENT_MOTIFS.map((s) => s.toLowerCase()).indexOf(d.motif || 'none'); if (mi >= 0) this.motifIdx = mi;
    },

    update(dt) {
      this.msgT = Math.max(0, this.msgT - dt);
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const c = this.parts[i];
        c.t += dt;
        if (c.t >= c.life) { this.parts.splice(i, 1); continue; }
        c.x += c.vx * dt; c.y += c.vy * dt; c.vy += 480 * dt; c.rot += c.vr * dt;
      }
      if (CM.input.pressed('back')) {
        if (this.showCloset) { this.showCloset = false; }
        else { CM.switchScene(this.from); }
      }
    },

    draw(g) {
      const grad = g.createLinearGradient(0, 0, 0, CM.H);
      grad.addColorStop(0, '#ffe9f6');
      grad.addColorStop(1, '#e7dcff');
      g.fillStyle = grad;
      g.fillRect(0, 0, CM.W, CM.H);
      for (let i = 0; i < 10; i++) {
        const dx = (i * 191 + 50) % CM.W;
        const dy = (i * 133 + Math.sin(CM.time + i) * 12 + 70) % CM.H;
        g.globalAlpha = 0.2;
        D.circle(g, dx, dy, 9 + (i % 3) * 5, i % 2 ? '#ff9ec7' : '#b9a0f0');
        g.globalAlpha = 1;
      }
      D.text(g, '✂️ Design Studio', 480, 34, { size: 30, color: P.pinkDeep, stroke: '#fff', strokeWidth: 8, weight: 800 });

      // ---- live preview (left) ----
      CM.ui.panel(g, 24, 64, 300, 476);
      D.text(g, 'Your Look', 174, 92, { size: 18, color: P.pinkDeep, weight: 800 });
      D.ellipse(g, 174, 452, 86, 22, '#ffeaf3', '#f3cfe0', 2);
      const phase = (CM.sceneTime * 1.0) % 1;
      CM.drawPlayer(g, 174, 446, 3.1, 'down', phase, previewCfg(this));
      D.text(g, (CM.save.character || {}).name || 'Friend', 174, 486, { size: 19, color: P.blueDeep, weight: 800 });
      // the garment on a little hanger tag
      chip(g, design(this), 52, 110, 30, 24);
      D.text(g, this.garment === 'dress' ? 'a Dress' : (this.garment === 'bottom' ? 'a Skirt' : 'a Top'),
        110, 122, { size: 14, align: 'left', color: '#9a8a94', weight: 700 });

      if (this.showCloset) {
        this.drawCloset(g);
      } else {
        this.drawOptions(g);
      }

      // ---- message banner ----
      if (this.msgT > 0) {
        g.globalAlpha = Math.min(1, this.msgT);
        D.rr(g, 250, 502, 460, 32, 16, '#fff6d6', P.yellowDeep, 2);
        D.text(g, this.msg, 480, 518, { size: 16, color: P.ink, weight: 800 });
        g.globalAlpha = 1;
      }

      // ---- bottom action buttons ----
      if (CM.ui.button(g, 32, 552, 150, 38, '← Back', { color: P.blueDeep, size: 16 })) { CM.switchScene(this.from); return; }
      if (CM.ui.button(g, 196, 552, 196, 38, this.showCloset ? '✏️ Keep Designing' : '🗂 My Designs', { color: P.lavenderDeep, size: 15 })) {
        this.showCloset = !this.showCloset;
      }
      if (!this.showCloset) {
        if (CM.ui.button(g, 500, 552, 150, 38, '💾 Save', { color: P.pink, size: 16, sfx: 'pop' })) this.saveDesign();
        if (CM.ui.button(g, 664, 549, 236, 44, '👗 Wear It!', { color: P.mintDeep, size: 21, sfx: 'tada' })) this.wearIt();
      }

      // ---- confetti ----
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

    drawOptions(g) {
      CM.ui.panel(g, 344, 64, 592, 476);
      D.text(g, 'Make it yours! 🎀', 640, 92, { size: 18, color: P.pinkDeep, weight: 800 });

      // garment buttons
      D.text(g, 'Garment', 366, 130, { size: 17, align: 'left', color: P.ink, weight: 800 });
      for (let i = 0; i < GARMENTS.length; i++) {
        const gm = GARMENTS[i];
        const x = 492 + i * 138;
        if (CM.ui.button(g, x, 112, 128, 36, gm.label, { color: this.garment === gm.key ? P.pinkDeep : '#d3bcd0', size: 16, sfx: 'pop' })) {
          this.garment = gm.key;
        }
      }

      swatchRow(g, 'Colour', 184, CM.GARMENT_COLORS, this.colorIdx, (i) => (this.colorIdx = i));

      arrowRow(g, 'Pattern', 240, CM.GARMENT_PATTERNS[this.patternIdx],
        () => { this.patternIdx = (this.patternIdx - 1 + CM.GARMENT_PATTERNS.length) % CM.GARMENT_PATTERNS.length; CM.audio.play('pop'); },
        () => { this.patternIdx = (this.patternIdx + 1) % CM.GARMENT_PATTERNS.length; CM.audio.play('pop'); },
        (g2, x, y) => chip(g2, design(this), x, y, 34, 28));

      swatchRow(g, 'Trim', 298, CM.GARMENT_ACCENTS, this.accentIdx, (i) => (this.accentIdx = i));

      arrowRow(g, 'Motif', 354, CM.GARMENT_MOTIFS[this.motifIdx],
        () => { this.motifIdx = (this.motifIdx - 1 + CM.GARMENT_MOTIFS.length) % CM.GARMENT_MOTIFS.length; CM.audio.play('pop'); },
        () => { this.motifIdx = (this.motifIdx + 1) % CM.GARMENT_MOTIFS.length; CM.audio.play('pop'); },
        (g2, x, y) => {
          D.rr(g2, x, y, 34, 28, 7, '#fff5fb', '#f0d8e6', 2);
          const d = design(this);
          CM.garmentMotif(g2, d.motif, x + 17, y + 14, 8, '#ff5f8f');
        });

      D.text(g, '✨ Tip: try a pattern + a trim colour + a cute motif!', 640, 410, { size: 14, color: P.lavenderDeep, weight: 700 });
    },

    drawCloset(g) {
      CM.ui.panel(g, 344, 64, 592, 476);
      D.text(g, '🗂 My Designs', 640, 92, { size: 20, color: P.pinkDeep, weight: 800 });
      const saved = CM.save.customDesigns || [];
      const m = CM.input.mouse;
      if (!saved.length) {
        D.text(g, 'No designs yet!', 640, 260, { size: 22, color: P.ink, weight: 800 });
        D.text(g, 'Make something cute and tap 💾 Save', 640, 296, { size: 16, color: '#9a8a94', weight: 700 });
        return;
      }
      D.text(g, 'Tap a design to wear it · tap ✕ to remove', 640, 118, { size: 14, color: '#9a8a94', weight: 700 });
      const cols = 5, cw = 100, ch = 108, gx = 8, gy = 8, ax = 366, ay = 132;
      for (let i = 0; i < saved.length; i++) {
        const d = saved[i];
        const col = i % cols, row = Math.floor(i / cols);
        const x = ax + col * (cw + gx), y = ay + row * (ch + gy);
        if (y + ch > 476) break; // keep within the panel
        const hover = m.x >= x && m.x <= x + cw && m.y >= y && m.y <= y + ch;
        D.rr(g, x, y, cw, ch, 14, '#fff', hover ? P.pink : '#f0d8e6', hover ? 3.5 : 2.5);
        CM.drawDesignIcon(g, d, x + cw / 2, y + 52, 1.5);
        D.text(g, d.garment === 'dress' ? 'Dress' : (d.garment === 'bottom' ? 'Skirt' : 'Top'), x + cw / 2, y + ch - 16, { size: 14, color: P.ink, weight: 800 });
        // delete button (top-right of the card)
        const dxc = x + cw - 14, dyc = y + 14;
        D.circle(g, dxc, dyc, 11, '#ffd9d9', '#e88', 2);
        D.text(g, '✕', dxc, dyc, { size: 13, color: '#d65a5a', weight: 800 });
        if (m.clicked) {
          if (CM.dist(m.x, m.y, dxc, dyc) < 15) {
            m.clicked = false; saved.splice(i, 1); CM.persist(); CM.audio.play('pop'); return;
          }
          if (hover) {
            m.clicked = false;
            this.loadDesign(d);
            if (!CM.save.character) CM.save.character = CM.defaultCharacter();
            applyTo(CM.save.character, design(this));
            CM.persist();
            CM.audio.play('tada');
            this.flash('Wearing it! 👗');
            this.showCloset = false;
            return;
          }
        }
      }
    }
  });
})();
