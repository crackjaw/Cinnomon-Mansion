/* ============================================================
   Cinnamoroll Mansion — shared hub behaviour
   Used by the mansion (indoor) and backyard (outdoor) hubs so they
   share walk-around movement, the talk dialog, the Dress Up menu,
   the pet companion and the HUD.

   A hub scene must provide:
     scene.p          {x,y,facing,phase}
     scene.BOUNDS     {x1,y1,x2,y2}
     scene.overlaps(x,y)            -> bool (player-center collision)
     scene.clickInteract(mx,my)     -> interact object | null
     scene.interactAnchor(it)       -> {x,y,reach}
     scene.triggerInteract(it)      -> opens a dialog / menu / scene
     scene.nearestInteract()        -> interact object | null
   Hub-managed fields: scene.dialog, scene.menu, scene.target,
                       scene.petObj, scene.petTrail.
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  const hub = (CM.hub = {});
  const DRESS_BTN = (hub.DRESS_BTN = { x: 700, y: 12, w: 150, h: 34 });

  function inRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }
  hub.inRect = inRect;

  // step to the next OWNED index (wraps); free options are always owned
  hub.stepOwned = function (kind, len, cur, dir) {
    let i = cur;
    for (let k = 0; k < len; k++) {
      i = (i + dir + len) % len;
      if (CM.ownsOption(kind, i)) return i;
    }
    return cur;
  };
  // None + every owned pet
  hub.petCycle = function () {
    const list = [null];
    for (const id in CM.PETS) if (CM.save.owned && CM.save.owned['pet:' + id]) list.push(id);
    return list;
  };

  /* ---------------- pet companion ---------------- */
  hub.initPet = function (scene) {
    scene.petTrail = [];
    scene.petObj = CM.save.pet
      ? { x: scene.p.x - 26, y: scene.p.y + 6, flip: false, moving: false }
      : null;
  };
  hub.updatePet = function (scene, dt) {
    if (!scene.petObj) return;
    scene.petTrail.push({ x: scene.p.x, y: scene.p.y });
    if (scene.petTrail.length > 40) scene.petTrail.shift();
    const pet = scene.petObj;
    const back = scene.petTrail[Math.max(0, scene.petTrail.length - 17)];
    const tx = back ? back.x - 4 : scene.p.x - 26;
    const ty = back ? back.y + 8 : scene.p.y + 6;
    const dx = tx - pet.x, dy = ty - pet.y;
    const d = Math.hypot(dx, dy);
    pet.moving = d > 8;
    if (pet.moving) {
      const sp = Math.min(d, 250 * dt);
      pet.x += (dx / d) * sp;
      pet.y += (dy / d) * sp;
      pet.flip = dx < -0.5;
    }
  };
  // draw the equipped pet (call from the scene's depth-sorted sprite list)
  hub.drawPetSprite = function (scene, g, t) {
    if (!scene.petObj) return;
    const pet = scene.petObj;
    CM.drawPet(g, CM.save.pet, pet.x, pet.y, 0.95, {
      bob: pet.moving ? (t * 1.8) % 1 : (CM.save.pet === 'star' ? (t * 0.8) % 1 : 0),
      flip: pet.flip
    });
  };

  hub.openMenu = function (scene) {
    scene.menu = true;
    scene.dialog = null;
    scene.target = null;
    CM.audio.play('pop');
  };

  /* ---------------- per-frame update (movement + overlays) ---------------- */
  // returns true if the scene should stop its update for this frame
  hub.update = function (scene, dt) {
    const inp = CM.input;
    scene.joystick = !scene.dialog && !scene.menu;

    if (scene.menu) {
      if (inp.pressed('back')) scene.menu = false;
      return true;
    }
    if (scene.dialog) {
      const dlg = scene.dialog, n = dlg.options.length;
      if (inp.pressed('left')) dlg.sel = (dlg.sel - 1 + n) % n;
      if (inp.pressed('right')) dlg.sel = (dlg.sel + 1) % n;
      if (inp.pressed('back')) { scene.dialog = null; return true; }
      if (inp.pressed('action')) {
        const opt = dlg.options[dlg.sel];
        scene.dialog = null;
        opt.run();
      }
      return true;
    }

    // click to walk — or click an interactable to walk over and use it
    if (inp.mouse.clicked && !inRect(inp.mouse, DRESS_BTN)) {
      const it = scene.clickInteract(inp.mouse.x, inp.mouse.y);
      const a = it ? scene.interactAnchor(it) : { x: inp.mouse.x, y: inp.mouse.y };
      scene.target = {
        x: CM.clamp(a.x, scene.BOUNDS.x1, scene.BOUNDS.x2),
        y: CM.clamp(a.y, scene.BOUNDS.y1, scene.BOUNDS.y2),
        interact: it, t: 0, stuck: 0
      };
    }

    // movement (keyboard / joystick overrides a click target)
    let ax = inp.axisX(), ay = inp.axisY();
    if (Math.hypot(ax, ay) > 0.15) scene.target = null;
    else if (scene.target) {
      const dx = scene.target.x - scene.p.x, dy = scene.target.y - scene.p.y, d = Math.hypot(dx, dy);
      if (d > 5) { ax = dx / d; ay = dy / d; }
    }
    const len = Math.hypot(ax, ay), ox = scene.p.x, oy = scene.p.y;
    const speed = scene.SPEED || 225;
    if (len > 0.15) {
      const nx = scene.p.x + (ax / (len || 1)) * speed * dt;
      const ny = scene.p.y + (ay / (len || 1)) * speed * dt;
      if (!scene.overlaps(nx, scene.p.y)) scene.p.x = nx;
      if (!scene.overlaps(scene.p.x, ny)) scene.p.y = ny;
      scene.p.facing = Math.abs(ax) > Math.abs(ay) ? (ax > 0 ? 'right' : 'left') : (ay > 0 ? 'down' : 'up');
      scene.p.phase = (scene.p.phase + dt * 2.6) % 1 || 0.01;
    } else {
      scene.p.phase = 0;
    }

    // arrival → auto-interact, or give up if blocked
    if (scene.target) {
      const tgt = scene.target;
      tgt.t += dt;
      if (len > 0.15 && Math.hypot(scene.p.x - ox, scene.p.y - oy) < 0.4) tgt.stuck += dt;
      else tgt.stuck = 0;
      if (tgt.interact) {
        const a = scene.interactAnchor(tgt.interact);
        if (CM.dist(scene.p.x, scene.p.y, a.x, a.y) < a.reach) {
          const it = tgt.interact;
          scene.target = null;
          scene.triggerInteract(it);
          return true;
        }
      }
      if (CM.dist(scene.p.x, scene.p.y, tgt.x, tgt.y) < 6 || tgt.stuck > 0.5) scene.target = null;
    }

    // keyboard / ★ interact
    const near = scene.nearestInteract();
    if (near && inp.pressed('action')) {
      scene.triggerInteract(near);
      return true;
    }

    hub.updatePet(scene, dt);
    return false;
  };

  /* ---------------- shared drawing ---------------- */
  hub.drawTargetMarker = function (scene, g) {
    if (!scene.target) return;
    const tg = scene.target;
    const pulse = 1 - (tg.t % 0.7) / 0.7;
    g.globalAlpha = 0.3 + pulse * 0.45;
    D.circle(g, tg.x, tg.y, 7 + pulse * 10, null, CM.palette.pinkDeep, 2.5);
    D.star(g, tg.x, tg.y, 5, CM.palette.pinkDeep);
    g.globalAlpha = 1;
  };

  hub.drawHud = function (scene, g, hint) {
    // coins
    D.rr(g, 14, 12, 118, 36, 18, 'rgba(255,255,255,0.85)', '#f0b9d2', 2);
    D.coin(g, 36, 30, 12);
    D.text(g, String(CM.save.coins), 84, 31, { size: 20, color: '#c98a1f', weight: 800 });
    // name
    const ch = CM.save.character;
    if (ch && ch.name) {
      D.rr(g, 142, 12, 30 + ch.name.length * 11, 36, 18, 'rgba(255,255,255,0.85)', '#bcd9f0', 2);
      D.text(g, ch.name, 157 + ch.name.length * 5.5, 31, { size: 17, color: CM.palette.blueDeep, weight: 800 });
    }
    // dress-up button (top-right, clear of the reserved mute corner)
    if (!scene.dialog && !scene.menu) {
      if (CM.ui.button(g, DRESS_BTN.x, DRESS_BTN.y, DRESS_BTN.w, DRESS_BTN.h, '👗 Dress Up',
        { color: CM.palette.lavenderDeep, size: 16, r: 17 })) {
        hub.openMenu(scene);
      }
    }
    // hint bar
    if (hint) {
      D.rr(g, 215, 576, 530, 22, 11, 'rgba(255,255,255,0.55)');
      D.text(g, hint, 480, 587, { size: 13, color: '#7a6b75' });
    }
  };

  hub.drawDialog = function (scene, g, t) {
    const dlg = scene.dialog;
    if (!dlg) return;
    g.fillStyle = 'rgba(70,40,70,0.25)';
    g.fillRect(0, 0, CM.W, CM.H);
    CM.ui.panel(g, 140, 408, 680, 172);
    CM.drawFriend(g, dlg.host, 225, 555, 1.15, { bob: ((t * 1.2) % 1) * 0.5 });
    D.text(g, CM.FRIENDS[dlg.host].name, 225, 432, { size: 16, color: CM.palette.pinkDeep, weight: 800 });
    D.text(g, dlg.line, 545, 452, { size: 17, color: CM.palette.ink, weight: 700 });
    const opts = dlg.options;
    const bw = opts.length >= 3 ? 150 : 180;
    const gap = 14;
    const totalW = opts.length * bw + (opts.length - 1) * gap;
    let bx = 480 - totalW / 2;
    if (bx < 320) bx = 320;
    for (let i = 0; i < opts.length; i++) {
      const o = opts[i];
      const x = bx + i * (bw + gap);
      if (dlg.sel === i) D.rr(g, x - 4, 496, bw + 8, 56, 22, null, CM.palette.yellowDeep, 4);
      if (CM.ui.button(g, x, 500, bw, 48, o.label, { color: o.color, size: opts.length >= 3 ? 16 : 18 })) {
        scene.dialog = null;
        o.run();
        return;
      }
    }
  };

  // one labeled ◀ value ▶ row in the dress-up menu
  function menuRow(g, label, y, valueText, swatch, onPrev, onNext) {
    D.text(g, label, 398, y, { size: 16, align: 'left', color: CM.palette.ink, weight: 800 });
    if (CM.ui.button(g, 548, y - 15, 32, 30, '◀', { color: CM.palette.blueDeep, size: 14, sfx: 'pop' })) onPrev();
    if (swatch) D.circle(g, 672, y, 12, swatch, 'rgba(0,0,0,0.15)', 1.5);
    else D.text(g, valueText, 672, y, { size: 16, color: CM.palette.pinkDeep, weight: 800 });
    if (CM.ui.button(g, 772, y - 15, 32, 30, '▶', { color: CM.palette.blueDeep, size: 14, sfx: 'pop' })) onNext();
  }

  hub.drawMenu = function (scene, g) {
    const P = CM.palette;
    const ch = CM.save.character || CM.defaultCharacter();
    const persist = function () { CM.persist(); };
    g.fillStyle = 'rgba(70,40,70,0.34)';
    g.fillRect(0, 0, CM.W, CM.H);
    CM.ui.panel(g, 128, 70, 704, 466);
    D.text(g, '👗 Dress Up', 480, 102, { size: 28, color: P.pinkDeep, weight: 800 });

    // live preview
    D.rr(g, 150, 132, 214, 350, 18, '#fff5fb', '#f3cfe0', 2);
    D.ellipse(g, 240, 446, 74, 18, '#ffeaf3', '#f3cfe0', 2);
    CM.drawPlayer(g, 240, 440, 2.3, 'down', (CM.sceneTime * 1.0) % 1, ch);
    if (CM.save.pet) CM.drawPet(g, CM.save.pet, 312, 446, 1.4, { bob: (CM.sceneTime * 1.4) % 1, flip: true });
    D.text(g, ch.name || 'Friend', 240, 470, { size: 18, color: P.blueDeep, weight: 800 });

    let y = 168;
    const step = 44;
    menuRow(g, 'Body', y, ch.body === 'boy' ? 'Boy' : 'Girl', null,
      function () { ch.body = ch.body === 'boy' ? 'girl' : 'boy'; persist(); },
      function () { ch.body = ch.body === 'boy' ? 'girl' : 'boy'; persist(); });
    y += step;
    menuRow(g, 'Hair', y, CM.HAIRSTYLES[ch.hair], null,
      function () { ch.hair = (ch.hair - 1 + CM.HAIRSTYLES.length) % CM.HAIRSTYLES.length; persist(); },
      function () { ch.hair = (ch.hair + 1) % CM.HAIRSTYLES.length; persist(); });
    y += step;
    menuRow(g, 'Hair Color', y, '', CM.HAIRC[ch.hairColor],
      function () { ch.hairColor = (ch.hairColor - 1 + CM.HAIRC.length) % CM.HAIRC.length; persist(); },
      function () { ch.hairColor = (ch.hairColor + 1) % CM.HAIRC.length; persist(); });
    y += step;
    menuRow(g, 'Top', y, ch.customTop ? '✨ Custom' : '', ch.customTop ? null : CM.TOPC[ch.top],
      function () { ch.customTop = null; ch.top = hub.stepOwned('top', CM.TOPC.length, ch.top, -1); persist(); },
      function () { ch.customTop = null; ch.top = hub.stepOwned('top', CM.TOPC.length, ch.top, 1); persist(); });
    y += step;
    menuRow(g, 'Bottoms', y, ch.customBottom ? '✨ Custom' : '', ch.customBottom ? null : CM.BOTC[ch.bottom],
      function () { ch.customBottom = null; ch.bottom = hub.stepOwned('bottom', CM.BOTC.length, ch.bottom, -1); persist(); },
      function () { ch.customBottom = null; ch.bottom = hub.stepOwned('bottom', CM.BOTC.length, ch.bottom, 1); persist(); });
    y += step;
    menuRow(g, 'Extra', y, CM.ACCESSORIES[ch.acc], null,
      function () { ch.acc = hub.stepOwned('acc', CM.ACCESSORIES.length, ch.acc, -1); persist(); },
      function () { ch.acc = hub.stepOwned('acc', CM.ACCESSORIES.length, ch.acc, 1); persist(); });
    y += step;
    const pets = hub.petCycle();
    const petIdx = Math.max(0, pets.indexOf(CM.save.pet || null));
    menuRow(g, 'Pet', y, CM.save.pet ? CM.PETS[CM.save.pet].name : 'None', null,
      function () { CM.save.pet = pets[(petIdx - 1 + pets.length) % pets.length]; persist(); },
      function () { CM.save.pet = pets[(petIdx + 1) % pets.length]; persist(); });

    if (CM.ui.button(g, 398, 486, 134, 38, '✨ Full Editor', { color: P.blueDeep, size: 14 })) {
      scene.menu = false;
      CM.switchScene('creator', { from: CM.sceneName });
      return;
    }
    if (CM.ui.button(g, 540, 486, 110, 38, '🎀 Shop', { color: P.pinkDeep, size: 15 })) {
      scene.menu = false;
      CM.switchScene('shop');
      return;
    }
    if (CM.ui.button(g, 658, 486, 134, 38, '✓ Done', { color: P.mintDeep, size: 16 })) {
      CM.save.character = ch;
      CM.persist();
      scene.menu = false;
    }
    D.text(g, 'More styles in the Gift Shop! 🎀', 595, 130, { size: 13, color: '#9a8a94', weight: 700 });
  };
})();
