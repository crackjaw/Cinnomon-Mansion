/* ============================================================
   Cinnamoroll Mansion — character creator
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  const FACINGS = ['down', 'right', 'up', 'left'];
  const NAME_ROW_Y = 478;

  // Only owned swatches are shown; premium colors appear here once bought in the shop.
  function swatchRow(g, label, y, colors, kind, selected, onPick) {
    D.text(g, label, 420, y, { size: 18, align: 'left', color: CM.palette.ink, weight: 800 });
    const m = CM.input.mouse;
    const idxs = [];
    for (let i = 0; i < colors.length; i++) if (!kind || CM.ownsOption(kind, i)) idxs.push(i);
    const startX = 565, span = 350;
    const step = Math.min(36, span / Math.max(1, idxs.length));
    const hit = Math.max(11, step * 0.46);
    for (let j = 0; j < idxs.length; j++) {
      const i = idxs[j];
      const cx = startX + j * step;
      const r = i === selected ? 14 : 11;
      if (i === selected) D.circle(g, cx, y, 16.5, null, CM.palette.pinkDeep, 3.5);
      D.circle(g, cx, y, r, colors[i], 'rgba(0,0,0,0.15)', 1.5);
      if (m.clicked && CM.dist(m.x, m.y, cx, y) < hit) {
        m.clicked = false;
        CM.audio.play('pop');
        onPick(i);
      }
    }
  }

  // step to the next OWNED index in either direction (wraps)
  function stepOwned(kind, len, cur, dir) {
    let i = cur;
    for (let k = 0; k < len; k++) {
      i = (i + dir + len) % len;
      if (CM.ownsOption(kind, i)) return i;
    }
    return cur;
  }

  function arrowRow(g, label, y, value, onStep) {
    D.text(g, label, 420, y, { size: 18, align: 'left', color: CM.palette.ink, weight: 800 });
    if (CM.ui.button(g, 560, y - 17, 36, 34, '◀', { color: CM.palette.blueDeep, size: 16, sfx: 'pop' })) onStep(-1);
    D.text(g, value, 705, y, { size: 19, color: CM.palette.pinkDeep, weight: 800 });
    if (CM.ui.button(g, 814, y - 17, 36, 34, '▶', { color: CM.palette.blueDeep, size: 16, sfx: 'pop' })) onStep(1);
  }

  CM.registerScene('creator', {
    enter(params) {
      this.from = params.from || 'title';
      const base = (!params.fresh && CM.save.character) || CM.defaultCharacter();
      this.cfg = JSON.parse(JSON.stringify(base));
      if (params.fresh && CM.save.character) this.cfg.name = CM.save.character.name || this.cfg.name;
      // a stale save may carry out-of-range indices — clamp so labels never read "undefined"
      const c = this.cfg;
      c.skin = CM.clamp(c.skin | 0, 0, CM.SKINS.length - 1);
      c.hair = CM.clamp(c.hair | 0, 0, CM.HAIRSTYLES.length - 1);
      c.hairColor = CM.clamp(c.hairColor | 0, 0, CM.HAIRC.length - 1);
      c.top = CM.clamp(c.top | 0, 0, CM.TOPC.length - 1);
      c.bottom = CM.clamp(c.bottom | 0, 0, CM.BOTC.length - 1);
      c.acc = CM.clamp(c.acc | 0, 0, CM.ACCESSORIES.length - 1);
      if (c.body !== 'boy') c.body = 'girl';
      // HTML name input overlay
      this.inp = document.getElementById('nameInput');
      this.inp.value = this.cfg.name || '';
      this._coarse = !!(window.matchMedia && window.matchMedia('(pointer: coarse)').matches);
      this._typing = false;
      // place the field over the canvas's Name row
      this._place = () => {
        if (this._typing) return; // while editing on touch, keep it pinned at the top
        const r = CM.canvas.getBoundingClientRect();
        const sx = r.width / CM.W;
        const sy = r.height / CM.H;
        const s = this.inp.style;
        s.display = 'block';
        s.position = 'absolute';
        s.transform = 'none';
        s.maxWidth = 'none';
        s.zIndex = '';
        s.left = r.left + 560 * sx + 'px';
        s.top = r.top + (NAME_ROW_Y - 17) * sy + 'px';
        s.width = 280 * sx + 'px';
        s.height = Math.max(26, 34 * sy) + 'px';
        s.fontSize = Math.max(13, 17 * sx) + 'px';
      };
      // on a tablet, the on-screen keyboard would cover the field — pin it to the top while typing
      this._onFocus = () => {
        if (!this._coarse) return;
        this._typing = true;
        const s = this.inp.style;
        s.display = 'block';
        s.position = 'fixed';
        s.left = '50%';
        s.top = 'calc(env(safe-area-inset-top) + 10px)';
        s.transform = 'translateX(-50%)';
        s.width = '70%';
        s.maxWidth = '420px';
        s.height = '40px';
        s.fontSize = '18px';
        s.zIndex = '60';
      };
      this._onBlur = () => { this._typing = false; this._place(); };
      this.inp.addEventListener('focus', this._onFocus);
      this.inp.addEventListener('blur', this._onBlur);
      this._place();
      window.addEventListener('resize', this._place);
    },
    exit() {
      this._typing = false;
      this.inp.style.display = 'none';
      this.inp.removeEventListener('focus', this._onFocus);
      this.inp.removeEventListener('blur', this._onBlur);
      window.removeEventListener('resize', this._place);
    },
    randomize() {
      const c = this.cfg;
      const ownedOf = (kind, len) => {
        const o = [];
        for (let i = 0; i < len; i++) if (CM.ownsOption(kind, i)) o.push(i);
        return CM.pick(o);
      };
      c.body = Math.random() < 0.5 ? 'girl' : 'boy';
      c.skin = CM.randInt(0, CM.SKINS.length - 1);
      c.hair = CM.randInt(0, CM.HAIRSTYLES.length - 1);
      c.hairColor = CM.randInt(0, CM.HAIRC.length - 1);
      c.top = ownedOf('top', CM.TOPC.length);
      c.bottom = ownedOf('bottom', CM.BOTC.length);
      c.acc = ownedOf('acc', CM.ACCESSORIES.length);
      c.customTop = null;    // a random preset outfit replaces any custom design
      c.customBottom = null;
      CM.audio.play('boing');
    },
    update() {},
    draw(g) {
      const c = this.cfg;
      const grad = g.createLinearGradient(0, 0, 0, CM.H);
      grad.addColorStop(0, '#ffe9f4');
      grad.addColorStop(1, '#dcefff');
      g.fillStyle = grad;
      g.fillRect(0, 0, CM.W, CM.H);
      // floating dots
      for (let i = 0; i < 12; i++) {
        const dx = (i * 167 + 40) % CM.W;
        const dy = (i * 113 + Math.sin(CM.time + i) * 14 + 60) % CM.H;
        g.globalAlpha = 0.25;
        D.circle(g, dx, dy, 10 + (i % 3) * 5, i % 2 ? '#ff9ec7' : '#8ecdf6');
        g.globalAlpha = 1;
      }
      D.text(g, 'Make Your Character!', 480, 36, { size: 34, color: CM.palette.pinkDeep, stroke: '#fff', strokeWidth: 9, weight: 800 });

      // ---- preview panel ----
      CM.ui.panel(g, 24, 70, 350, 470);
      D.ellipse(g, 199, 432, 92, 22, '#ffeaf3', '#f3cfe0', 2);
      const facing = FACINGS[Math.floor(CM.sceneTime / 1.8) % 4];
      const phase = (CM.sceneTime * 1.1) % 1;
      CM.drawPlayer(g, 199, 425, 3.3, facing, phase, c);
      const nm = (this.inp.value || 'Friend').trim() || 'Friend';
      D.text(g, '⭐ ' + nm + ' ⭐', 199, 488, { size: 24, color: CM.palette.blueDeep, weight: 800 });
      D.text(g, c.body === 'girl' ? 'Looking great!' : 'Looking cool!', 199, 518, { size: 16, color: '#9a8a94' });

      // ---- options panel ----
      CM.ui.panel(g, 396, 70, 540, 470);
      let y = 108;
      // body
      D.text(g, 'Body', 420, y, { size: 18, align: 'left', color: CM.palette.ink, weight: 800 });
      if (CM.ui.button(g, 560, y - 18, 110, 36, 'Girl', {
        color: c.body === 'girl' ? CM.palette.pinkDeep : '#cdb9c6', size: 17, sfx: 'pop'
      })) c.body = 'girl';
      if (CM.ui.button(g, 685, y - 18, 110, 36, 'Boy', {
        color: c.body === 'boy' ? CM.palette.blueDeep : '#cdb9c6', size: 17, sfx: 'pop'
      })) c.body = 'boy';
      y += 54;
      swatchRow(g, 'Skin', y, CM.SKINS, 'skin', c.skin, (i) => (c.skin = i));
      y += 54;
      arrowRow(g, 'Hair', y, CM.HAIRSTYLES[c.hair], (d) => {
        c.hair = (c.hair + d + CM.HAIRSTYLES.length) % CM.HAIRSTYLES.length;
      });
      y += 54;
      swatchRow(g, 'Hair Color', y, CM.HAIRC, 'hairColor', c.hairColor, (i) => (c.hairColor = i));
      y += 54;
      swatchRow(g, 'Top', y, CM.TOPC, 'top', c.customTop ? -1 : c.top, (i) => { c.top = i; c.customTop = null; });
      y += 54;
      swatchRow(g, 'Bottoms', y, CM.BOTC, 'bottom', c.customBottom ? -1 : c.bottom, (i) => { c.bottom = i; c.customBottom = null; });
      y += 54;
      // accessories cycle only through owned entries (premium ones unlock in the shop)
      arrowRow(g, 'Extra', y, CM.ACCESSORIES[c.acc], (d) => {
        c.acc = stepOwned('acc', CM.ACCESSORIES.length, c.acc, d);
      });
      y += 54;
      D.text(g, 'Name', 420, NAME_ROW_Y, { size: 18, align: 'left', color: CM.palette.ink, weight: 800 });
      D.text(g, '✨ Unlock more styles & pets in the Gift Shop!', 420, 528,
        { size: 13, align: 'left', color: CM.palette.lavenderDeep, weight: 700 });

      // ---- bottom buttons ----
      if (CM.ui.button(g, 60, 552, 210, 42, '🎲 Surprise Me!', { color: CM.palette.lavenderDeep, size: 18 })) {
        this.randomize();
      }
      // return to whichever hub opened the editor (the town overworld by default)
      const returnHub = CM.HUBS[this.from] ? this.from : 'town';
      if (CM.HUBS[this.from]) {
        if (CM.ui.button(g, 300, 552, 150, 42, 'Cancel', { color: '#b9a8b3', size: 17 })) {
          CM.switchScene(returnHub);
          return;
        }
      }
      if (CM.ui.button(g, 660, 549, 240, 48, '✔ All Done!', { color: CM.palette.mintDeep, size: 22, sfx: 'tada' })) {
        c.name = (this.inp.value || 'Friend').trim().slice(0, 12) || 'Friend';
        CM.save.character = JSON.parse(JSON.stringify(c));
        CM.persist();
        CM.switchScene(returnHub);
        return;
      }
    }
  });
})();
