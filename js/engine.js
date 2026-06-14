/* ============================================================
   Cinnamoroll Mansion — core engine
   Global namespace: window.CM
   Internal canvas resolution: 960 x 600 (scaled to fit window)
   ============================================================ */
(function () {
  'use strict';
  const CM = (window.CM = {});
  CM.W = 960;
  CM.H = 600;
  CM.time = 0;       // seconds since boot
  CM.sceneTime = 0;  // seconds since current scene entered
  CM.dt = 0;
  CM.frame = 0;
  CM.touchMode = false;
  CM.font = "'Baloo 2','Comic Sans MS','Chalkboard SE','Segoe UI',sans-serif";

  /* ---------------- palette ---------------- */
  CM.palette = {
    cream: '#fff6ec', sky: '#bfe7ff', skyDeep: '#8ecdf6',
    pinkSoft: '#ffd9e8', pink: '#ff9ec7', pinkDeep: '#f06292',
    blue: '#8ecdf6', blueDeep: '#4a9fdc',
    mint: '#bdeccd', mintDeep: '#67c587',
    lavender: '#d8c9f2', lavenderDeep: '#9b7bd4',
    yellow: '#ffe9a8', yellowDeep: '#f2b53c',
    brown: '#8a5a3b', wood: '#e8c39a',
    ink: '#4a3b46', white: '#ffffff', red: '#ef5b5b'
  };

  /* ---------------- tiny math helpers ---------------- */
  CM.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  CM.lerp = (a, b, t) => a + (b - a) * t;
  CM.rand = (a, b) => a + Math.random() * (b - a);
  CM.randInt = (a, b) => Math.floor(CM.rand(a, b + 1));
  CM.dist = (x1, y1, x2, y2) => Math.hypot(x2 - x1, y2 - y1);
  CM.pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  /* ---------------- save data ---------------- */
  const SAVE_KEY = 'cinnamoroll-mansion-v1';
  CM.save = { coins: 0, best: {}, plays: {}, character: null, muted: false, owned: {}, pet: null, petColor: 0, petAcc: 0, petName: '' };
  CM.persist = function () {
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(CM.save)); } catch (e) { /* private mode */ }
  };
  CM.loadSave = function () {
    try {
      const d = JSON.parse(localStorage.getItem(SAVE_KEY));
      if (!d || typeof d !== 'object') return;
      if (typeof d.coins === 'number' && isFinite(d.coins)) CM.save.coins = Math.max(0, Math.round(d.coins));
      if (d.best && typeof d.best === 'object') CM.save.best = d.best;
      if (d.plays && typeof d.plays === 'object') CM.save.plays = d.plays;
      if (d.character && typeof d.character === 'object' && typeof d.character.name === 'string') {
        CM.save.character = d.character;
      }
      if (d.owned && typeof d.owned === 'object') CM.save.owned = d.owned;
      if (typeof d.pet === 'string' || d.pet === null) CM.save.pet = d.pet;
      if (typeof d.petColor === 'number') CM.save.petColor = d.petColor;
      if (typeof d.petAcc === 'number') CM.save.petAcc = d.petAcc;
      if (typeof d.petName === 'string') CM.save.petName = d.petName.slice(0, 12);
      CM.save.muted = !!d.muted;
    } catch (e) { /* ignore corrupt save */ }
  };
  CM.addCoins = function (n) {
    CM.save.coins = Math.max(0, CM.save.coins + Math.round(n || 0));
    CM.persist();
  };

  /* ---------------- scene manager ---------------- */
  CM.scenes = {};
  CM.scene = null;
  CM.sceneName = '';
  CM.registerScene = function (name, scene) { CM.scenes[name] = scene; };
  CM.switchScene = function (name, params) {
    if (CM.scene && CM.scene.exit) { try { CM.scene.exit(); } catch (e) { console.error(e); } }
    CM.sceneName = name;
    CM.scene = CM.scenes[name];
    CM.sceneTime = 0;
    if (!CM.scene) { console.error('Unknown scene: ' + name); return; }
    if (CM.scene.enter) { try { CM.scene.enter(params || {}); } catch (e) { console.error(e); } }
  };

  /* ---------------- mini-game registry ---------------- */
  CM.games = {};
  CM.gameList = [];
  CM.registerGame = function (game) {
    CM.games[game.id] = game;
    CM.gameList.push(game);
    CM.registerScene('game-' + game.id, game);
  };
  CM._returnHub = 'mansion'; // which hub a finished/quit game returns to
  CM.HUBS = { mansion: 'Mansion', backyard: 'Backyard', pool: 'Pool', playground: 'Playground', school: 'School' };
  CM.startGame = function (id) {
    if (!CM.games[id]) return;
    // remember which hub we launched from (not when replaying from the results screen)
    if (CM.HUBS[CM.sceneName]) CM._returnHub = CM.sceneName;
    CM._activeGame = id;
    CM.save.plays[id] = (CM.save.plays[id] || 0) + 1;
    CM.persist();
    CM.audio.music('game');
    CM.switchScene('game-' + id);
  };
  // Games call this exactly once when a session ends.
  CM.finishGame = function (id, score, coins) {
    score = Math.max(0, Math.round(score || 0));
    coins = Math.max(0, Math.round(coins || 0));
    const prev = CM.save.best[id] || 0;
    const newBest = score > prev;
    if (newBest) CM.save.best[id] = score;
    CM.addCoins(coins);
    CM._activeGame = null;
    CM.audio.music('mansion');
    CM.switchScene('results', { id: id, score: score, coins: coins, newBest: newBest, best: Math.max(prev, score) });
  };
  CM.quitGame = function () {
    CM._activeGame = null;
    CM.audio.music('mansion');
    CM.switchScene(CM._returnHub || 'mansion');
  };

  /* ---------------- input ---------------- */
  const ALIAS = {
    left: ['arrowleft', 'a'],
    right: ['arrowright', 'd'],
    up: ['arrowup', 'w'],
    down: ['arrowdown', 's'],
    action: [' ', 'enter', 'e'],
    back: ['escape']
  };
  const input = (CM.input = {
    keys: Object.create(null),
    just: Object.create(null),
    mouse: { x: -999, y: -999, down: false, clicked: false, released: false },
    joy: { x: 0, y: 0, active: false, moved: false, baseX: 0, baseY: 0, dx: 0, dy: 0, id: null },
    virtualAction: false,
    _virtualJust: false,
    down(name) {
      if (ALIAS[name]) {
        if (name === 'action' && this.virtualAction) return true;
        return ALIAS[name].some((k) => this.keys[k]);
      }
      return !!this.keys[name.toLowerCase()];
    },
    pressed(name) {
      if (ALIAS[name]) {
        if (name === 'action' && this._virtualJust) return true;
        return ALIAS[name].some((k) => this.just[k]);
      }
      return !!this.just[name.toLowerCase()];
    },
    axisX() {
      const v = (this.down('right') ? 1 : 0) - (this.down('left') ? 1 : 0);
      return CM.clamp(v + this.joy.x, -1, 1);
    },
    axisY() {
      const v = (this.down('down') ? 1 : 0) - (this.down('up') ? 1 : 0);
      return CM.clamp(v + this.joy.y, -1, 1);
    }
  });

  const PREVENT = new Set(['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' ']);

  /* ---------------- audio (WebAudio synth) ---------------- */
  CM.audio = (function () {
    let ac = null;
    let unlocked = false;
    let pendingMusic = null;
    let musicName = null;
    let timer = null;
    let nextT = 0;
    let idx = 0;
    const N = {
      G3: 196, A3: 220, B3: 246.94, C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23,
      G4: 392, A4: 440, B4: 493.88, C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46,
      G5: 783.99, A5: 880, B5: 987.77, C6: 1046.5
    };
    const TUNES = {
      mansion: {
        step: 60 / 92 / 2, wave: 'triangle', vol: 0.045,
        seq: [N.C5, 0, N.E5, 0, N.G5, N.E5, N.D5, 0,
              N.B4, 0, N.D5, 0, N.G5, N.D5, N.C5, 0,
              N.A4, 0, N.C5, 0, N.F5, N.C5, N.D5, 0,
              N.G4, 0, N.B4, 0, N.D5, N.B4, N.C5, 0]
      },
      game: {
        step: 60 / 132 / 2, wave: 'square', vol: 0.028,
        seq: [N.G4, N.C5, N.E5, N.C5, N.A4, N.C5, N.F5, N.C5,
              N.G4, N.B4, N.D5, N.B4, N.C5, N.E5, N.G5, 0]
      }
    };
    function ensure() {
      if (!ac) {
        const A = window.AudioContext || window.webkitAudioContext;
        if (A) ac = new A();
      }
      if (ac && ac.state === 'suspended') ac.resume();
      return !!ac;
    }
    function unlock() {
      if (!unlocked) {
        if (ensure()) {
          unlocked = true;
          if (pendingMusic) music(pendingMusic);
        }
      } else ensure();
    }
    function tone(freq, dur, type, vol, when, slideTo) {
      if (CM.save.muted || !freq || !ensure()) return;
      type = type || 'sine'; vol = vol || 0.15; when = when || 0; dur = dur || 0.15;
      const t0 = ac.currentTime + when;
      const o = ac.createOscillator();
      const gn = ac.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), t0 + dur);
      gn.gain.setValueAtTime(0.0001, t0);
      gn.gain.exponentialRampToValueAtTime(vol, t0 + 0.012);
      gn.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
      o.connect(gn).connect(ac.destination);
      o.start(t0);
      o.stop(t0 + dur + 0.05);
    }
    function noise(dur, vol, when) {
      if (CM.save.muted || !ensure()) return;
      dur = dur || 0.2; vol = vol || 0.12; when = when || 0;
      const t0 = ac.currentTime + when;
      const n = Math.floor(ac.sampleRate * dur);
      const buf = ac.createBuffer(1, n, ac.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
      const src = ac.createBufferSource();
      src.buffer = buf;
      const gn = ac.createGain();
      gn.gain.value = vol;
      src.connect(gn).connect(ac.destination);
      src.start(t0);
    }
    const SFX = {
      click() { tone(740, 0.06, 'square', 0.07); },
      pop() { tone(420, 0.09, 'sine', 0.15, 0, 900); },
      ding() { tone(880, 0.12, 'sine', 0.12); tone(1318.5, 0.18, 'sine', 0.1, 0.06); },
      coin() { tone(987.77, 0.07, 'square', 0.08); tone(1318.5, 0.12, 'square', 0.08, 0.07); },
      cheer() { [N.C5, N.E5, N.G5, N.C6].forEach((f, i) => tone(f, 0.14, 'triangle', 0.12, i * 0.08)); noise(0.25, 0.04, 0.1); },
      tada() { [N.G4, N.C5, N.E5, N.G5, N.E5, N.G5].forEach((f, i) => tone(f, 0.16, 'triangle', 0.12, i * 0.09)); },
      miss() { tone(280, 0.25, 'sawtooth', 0.08, 0, 140); },
      boing() { tone(160, 0.22, 'sine', 0.16, 0, 520); },
      splash() { noise(0.3, 0.14); tone(300, 0.2, 'sine', 0.08, 0, 90); },
      crash() { noise(0.35, 0.2); tone(180, 0.2, 'square', 0.1, 0, 80); },
      whoosh() { noise(0.18, 0.07); },
      step() { tone(200, 0.04, 'sine', 0.04); }
    };
    function play(name) { try { if (SFX[name]) SFX[name](); } catch (e) { /* audio is best-effort */ } }
    function music(name) {
      pendingMusic = name;
      if (!unlocked) return;
      if (timer) { clearInterval(timer); timer = null; }
      musicName = name === 'off' ? null : name;
      if (!musicName || !TUNES[musicName] || !ensure()) return;
      idx = 0;
      nextT = ac.currentTime + 0.1;
      timer = setInterval(() => {
        const tu = TUNES[musicName];
        if (!tu) return;
        // background-tab throttling can leave us far behind — skip ahead instead
        // of scheduling all the missed notes as one garbled chord
        if (nextT < ac.currentTime) {
          const behind = Math.ceil((ac.currentTime - nextT) / tu.step);
          nextT += behind * tu.step;
          idx += behind;
        }
        while (nextT < ac.currentTime + 0.25) {
          const f = tu.seq[idx % tu.seq.length];
          if (f) tone(f, tu.step * 0.9, tu.wave, tu.vol, Math.max(0, nextT - ac.currentTime));
          nextT += tu.step;
          idx++;
        }
      }, 80);
    }
    function toggleMute() { CM.save.muted = !CM.save.muted; CM.persist(); }
    return {
      tone, noise, play, music, unlock, toggleMute,
      get now() { return ac ? ac.currentTime : 0; },
      get muted() { return CM.save.muted; }
    };
  })();

  /* ---------------- drawing helpers ---------------- */
  function rrPath(g, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    g.beginPath();
    g.moveTo(x + r, y);
    g.arcTo(x + w, y, x + w, y + h, r);
    g.arcTo(x + w, y + h, x, y + h, r);
    g.arcTo(x, y + h, x, y, r);
    g.arcTo(x, y, x + w, y, r);
    g.closePath();
  }
  CM.draw = {
    rrPath: rrPath,
    rr(g, x, y, w, h, r, fill, stroke, lw) {
      rrPath(g, x, y, w, h, r);
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 3; g.stroke(); }
    },
    circle(g, x, y, r, fill, stroke, lw) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 3; g.stroke(); }
    },
    ellipse(g, x, y, rx, ry, fill, stroke, lw) {
      g.beginPath();
      g.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
      if (fill) { g.fillStyle = fill; g.fill(); }
      if (stroke) { g.strokeStyle = stroke; g.lineWidth = lw || 3; g.stroke(); }
    },
    text(g, str, x, y, o) {
      o = o || {};
      g.save();
      g.font = (o.weight || 700) + ' ' + (o.size || 24) + 'px ' + CM.font;
      g.textAlign = o.align || 'center';
      g.textBaseline = o.baseline || 'middle';
      if (o.stroke) {
        g.lineWidth = o.strokeWidth || 6;
        g.strokeStyle = o.stroke;
        g.lineJoin = 'round';
        g.strokeText(str, x, y);
      }
      g.fillStyle = o.color || CM.palette.ink;
      g.fillText(str, x, y);
      g.restore();
    },
    shadow(g, x, y, rx, ry) {
      g.fillStyle = 'rgba(60,40,60,0.12)';
      g.beginPath();
      g.ellipse(x, y, rx, ry || rx * 0.38, 0, 0, Math.PI * 2);
      g.fill();
    },
    star(g, x, y, r, color, rot) {
      g.save();
      g.translate(x, y);
      g.rotate(rot === undefined ? -Math.PI / 2 : rot);
      g.fillStyle = color || CM.palette.yellowDeep;
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 ? r * 0.45 : r;
        const a = (i * Math.PI) / 5;
        if (i === 0) g.moveTo(Math.cos(a) * rad, Math.sin(a) * rad);
        else g.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
      }
      g.closePath();
      g.fill();
      g.restore();
    },
    heart(g, x, y, s, color) {
      g.save();
      g.translate(x, y);
      g.scale(s / 10, s / 10);
      g.fillStyle = color || CM.palette.pinkDeep;
      g.beginPath();
      g.moveTo(0, 10);
      g.bezierCurveTo(-12, -2, -6, -12, 0, -5);
      g.bezierCurveTo(6, -12, 12, -2, 0, 10);
      g.fill();
      g.restore();
    },
    coin(g, x, y, r) {
      r = r || 10;
      CM.draw.circle(g, x, y, r, '#f6cf5a', '#d99a1f', r * 0.25);
      CM.draw.star(g, x, y, r * 0.55, '#fff1c4');
    },
    bubble(g, x, y, w, h, tailX) {
      rrPath(g, x, y, w, h, 14);
      g.fillStyle = 'rgba(255,255,255,0.95)';
      g.fill();
      g.strokeStyle = '#f3cfe0';
      g.lineWidth = 2.5;
      g.stroke();
      if (tailX !== undefined) {
        tailX = CM.clamp(tailX, x + 16, x + w - 16);
        g.beginPath();
        g.moveTo(tailX - 8, y + h - 1);
        g.lineTo(tailX, y + h + 12);
        g.lineTo(tailX + 8, y + h - 1);
        g.closePath();
        g.fillStyle = 'rgba(255,255,255,0.95)';
        g.fill();
      }
    }
  };

  /* ---------------- immediate-mode UI ---------------- */
  CM.ui = {
    // Draws a rounded button; returns true if clicked this frame (consumes the click).
    button(g, x, y, w, h, label, opts) {
      opts = opts || {};
      const m = input.mouse;
      const hover = m.x >= x && m.x <= x + w && m.y >= y && m.y <= y + h;
      const base = opts.color || CM.palette.pinkDeep;
      const press = hover && m.down ? 2 : 0;
      const r = opts.r !== undefined ? opts.r : Math.min(18, h / 2);
      g.save();
      rrPath(g, x, y + 4, w, h, r);
      g.fillStyle = 'rgba(90,40,70,0.18)';
      g.fill();
      rrPath(g, x, y + press, w, h, r);
      g.fillStyle = base;
      g.fill();
      if (hover) {
        rrPath(g, x, y + press, w, h, r);
        g.fillStyle = 'rgba(255,255,255,0.18)';
        g.fill();
      }
      rrPath(g, x, y + press, w, h, r);
      g.strokeStyle = 'rgba(255,255,255,0.7)';
      g.lineWidth = 2.5;
      g.stroke();
      CM.draw.text(g, label, x + w / 2, y + h / 2 + press + 1, {
        size: opts.size || Math.round(h * 0.42),
        color: opts.textColor || '#fff',
        weight: 800
      });
      g.restore();
      if (hover && m.clicked) {
        m.clicked = false;
        CM.audio.play(opts.sfx || 'click');
        return true;
      }
      return false;
    },
    panel(g, x, y, w, h, opts) {
      opts = opts || {};
      rrPath(g, x + 4, y + 6, w, h, 20);
      g.fillStyle = 'rgba(90,40,70,0.12)';
      g.fill();
      rrPath(g, x, y, w, h, 20);
      g.fillStyle = opts.color || 'rgba(255,255,255,0.93)';
      g.fill();
      g.strokeStyle = opts.border || '#f3cfe0';
      g.lineWidth = 3;
      g.stroke();
      if (opts.title) {
        CM.draw.text(g, opts.title, x + w / 2, y + 26, { size: 22, color: CM.palette.pinkDeep, weight: 800 });
      }
    }
  };

  /* ---------------- fullscreen (handy on tablets) ---------------- */
  CM.fullscreenAvailable = function () {
    const el = document.documentElement;
    return !!(el.requestFullscreen || el.webkitRequestFullscreen);
  };
  CM.isFullscreen = function () {
    return !!(document.fullscreenElement || document.webkitFullscreenElement);
  };
  CM.toggleFullscreen = function () {
    const d = document, el = d.documentElement;
    try {
      if (CM.isFullscreen()) {
        (d.exitFullscreen || d.webkitExitFullscreen).call(d);
      } else {
        (el.requestFullscreen || el.webkitRequestFullscreen).call(el);
      }
    } catch (e) { /* unsupported / blocked */ }
  };

  /* ---------------- engine chrome (mute / quit / fullscreen) ---------------- */
  const MUTE_R = { x: CM.W - 46, y: 12, w: 34, h: 34 };
  const QUIT_R = { x: CM.W - 90, y: 12, w: 34, h: 34 }; // quit during a game, else fullscreen
  const ACT_BTN = { x: CM.W - 86, y: CM.H - 86, r: 46 };

  function inRect(p, r) { return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h; }

  function preUpdate() {
    const m = input.mouse;
    if (m.clicked) {
      if (inRect(m, MUTE_R)) {
        CM.audio.toggleMute();
        CM.audio.play('click');
        m.clicked = false;
      } else if (CM._activeGame && inRect(m, QUIT_R)) {
        m.clicked = false;
        CM.quitGame();
        return;
      } else if (!CM._activeGame && CM.fullscreenAvailable() && inRect(m, QUIT_R)) {
        m.clicked = false;
        CM.audio.play('click');
        CM.toggleFullscreen();
      }
    }
    if (CM._activeGame && input.pressed('back')) CM.quitGame();
  }

  function iconButton(g, r, drawIcon) {
    const hover = inRect(input.mouse, r);
    rrPath(g, r.x, r.y, r.w, r.h, 10);
    g.fillStyle = hover ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.75)';
    g.fill();
    g.strokeStyle = '#f0b9d2';
    g.lineWidth = 2;
    g.stroke();
    drawIcon(r.x + r.w / 2, r.y + r.h / 2);
  }

  function postDraw(g) {
    g.save();
    // mute toggle (always visible)
    iconButton(g, MUTE_R, (cx, cy) => {
      g.fillStyle = CM.palette.ink;
      g.beginPath();
      g.moveTo(cx - 9, cy - 3); g.lineTo(cx - 4, cy - 3); g.lineTo(cx + 2, cy - 9);
      g.lineTo(cx + 2, cy + 9); g.lineTo(cx - 4, cy + 3); g.lineTo(cx - 9, cy + 3);
      g.closePath(); g.fill();
      if (CM.save.muted) {
        g.strokeStyle = CM.palette.red; g.lineWidth = 3; g.lineCap = 'round';
        g.beginPath(); g.moveTo(cx - 10, cy + 10); g.lineTo(cx + 10, cy - 10); g.stroke();
      } else {
        g.strokeStyle = CM.palette.ink; g.lineWidth = 2; g.lineCap = 'round';
        g.beginPath(); g.arc(cx + 4, cy, 7, -0.9, 0.9); g.stroke();
      }
    });
    // quit button during a game; fullscreen toggle everywhere else (handy on tablets)
    if (CM._activeGame) {
      iconButton(g, QUIT_R, (cx, cy) => {
        g.strokeStyle = CM.palette.pinkDeep; g.lineWidth = 4; g.lineCap = 'round';
        g.beginPath();
        g.moveTo(cx - 7, cy - 7); g.lineTo(cx + 7, cy + 7);
        g.moveTo(cx + 7, cy - 7); g.lineTo(cx - 7, cy + 7);
        g.stroke();
      });
    } else if (CM.fullscreenAvailable()) {
      iconButton(g, QUIT_R, (cx, cy) => {
        g.strokeStyle = CM.palette.ink; g.lineWidth = 2.4; g.lineCap = 'round'; g.lineJoin = 'round';
        const r = 8, k = 5, fs = CM.isFullscreen();
        const corner = (sx, sy) => {
          g.beginPath();
          if (!fs) { // expand: brackets point outward
            g.moveTo(cx + sx * (r - k), cy + sy * r);
            g.lineTo(cx + sx * r, cy + sy * r);
            g.lineTo(cx + sx * r, cy + sy * (r - k));
          } else { // compress: brackets point inward
            g.moveTo(cx + sx * (r - k), cy + sy * (r - k));
            g.lineTo(cx + sx * (r - k), cy + sy * r);
            g.moveTo(cx + sx * (r - k), cy + sy * (r - k));
            g.lineTo(cx + sx * r, cy + sy * (r - k));
          }
          g.stroke();
        };
        corner(-1, -1); corner(1, -1); corner(-1, 1); corner(1, 1);
      });
    }
    // touch overlays
    if (CM.touchMode && CM.scene && CM.scene.joystick) {
      if (input.joy.active) {
        g.fillStyle = 'rgba(255,255,255,0.25)';
        g.beginPath(); g.arc(input.joy.baseX, input.joy.baseY, 52, 0, Math.PI * 2); g.fill();
        g.fillStyle = 'rgba(255,255,255,0.6)';
        g.beginPath();
        g.arc(input.joy.baseX + input.joy.x * 36, input.joy.baseY + input.joy.y * 36, 26, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = input.virtualAction ? 'rgba(240,98,146,0.85)' : 'rgba(240,98,146,0.45)';
      g.beginPath(); g.arc(ACT_BTN.x, ACT_BTN.y, ACT_BTN.r, 0, Math.PI * 2); g.fill();
      CM.draw.star(g, ACT_BTN.x, ACT_BTN.y, 22, 'rgba(255,255,255,0.9)');
    }
    g.restore();
  }

  /* ---------------- boot, events & main loop ---------------- */
  let cv = null;
  let g = null;

  function toGame(e) {
    const r = cv.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * CM.W, y: ((e.clientY - r.top) / r.height) * CM.H };
  }

  function resize() {
    // prefer the visual viewport (excludes mobile browser chrome / on-screen keyboard)
    const vv = window.visualViewport;
    const vw = (vv && vv.width) || window.innerWidth;
    const vh = (vv && vv.height) || window.innerHeight;
    const s = Math.min(vw / CM.W, vh / CM.H) * 0.985;
    cv.style.width = Math.round(CM.W * s) + 'px';
    cv.style.height = Math.round(CM.H * s) + 'px';
  }

  function attachEvents() {
    let actTouchId = null;
    // a touch in the joystick region stays a TAP until it drags past this many
    // canvas units — so tapping (e.g. to walk somewhere) on the left side works
    const JOY_DEADZONE = 14;
    window.addEventListener('keydown', (e) => {
      if (e.target && e.target.tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (PREVENT.has(k)) e.preventDefault();
      if (!input.keys[k]) input.just[k] = true;
      input.keys[k] = true;
      if (k === 'm') CM.audio.toggleMute();
      CM.audio.unlock();
    });
    // no INPUT guard on keyup: clearing a key is always safe, and skipping it
    // leaves keys stuck down when focus moves into the name input mid-press
    window.addEventListener('keyup', (e) => {
      input.keys[e.key.toLowerCase()] = false;
    });
    window.addEventListener('blur', () => {
      input.keys = Object.create(null);
      input.joy.active = false; input.joy.x = 0; input.joy.y = 0; input.joy.id = null;
      input.joy.moved = false;
      input.virtualAction = false;
      input.mouse.down = false;
      actTouchId = null;
    });
    cv.addEventListener('contextmenu', (e) => e.preventDefault());
    cv.addEventListener('mousedown', (e) => {
      const p = toGame(e);
      input.mouse.x = p.x; input.mouse.y = p.y;
      input.mouse.down = true; input.mouse.clicked = true;
      CM.audio.unlock();
    });
    window.addEventListener('mousemove', (e) => {
      if (!cv) return;
      const p = toGame(e);
      input.mouse.x = p.x; input.mouse.y = p.y;
    });
    window.addEventListener('mouseup', () => {
      input.mouse.down = false; input.mouse.released = true;
    });

    cv.addEventListener('touchstart', (e) => {
      e.preventDefault();
      CM.touchMode = true;
      CM.audio.unlock();
      for (const t of e.changedTouches) {
        const p = toGame(t);
        const joyScene = CM.scene && CM.scene.joystick;
        if (joyScene && p.x < CM.W * 0.45 && p.y > CM.H * 0.3 && input.joy.id === null) {
          // pending joystick — does NOT steer (and shows no stick) until it drags
          // past JOY_DEADZONE; a release before then is treated as a tap
          input.joy.id = t.identifier;
          input.joy.active = false;
          input.joy.moved = false;
          input.joy.baseX = p.x; input.joy.baseY = p.y;
          input.joy.x = 0; input.joy.y = 0;
        } else if (joyScene && CM.dist(p.x, p.y, ACT_BTN.x, ACT_BTN.y) < ACT_BTN.r + 14 && actTouchId === null) {
          actTouchId = t.identifier;
          input.virtualAction = true;
          input._virtualJust = true;
        } else {
          input.mouse.x = p.x; input.mouse.y = p.y;
          input.mouse.down = true; input.mouse.clicked = true;
        }
      }
    }, { passive: false });
    cv.addEventListener('touchmove', (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        const p = toGame(t);
        if (t.identifier === input.joy.id) {
          const dx = p.x - input.joy.baseX, dy = p.y - input.joy.baseY;
          if (!input.joy.moved && Math.hypot(dx, dy) > JOY_DEADZONE) {
            input.joy.moved = true;   // committed to a drag → become a live joystick
            input.joy.active = true;
          }
          if (input.joy.active) {
            input.joy.x = CM.clamp(dx / 48, -1, 1);
            input.joy.y = CM.clamp(dy / 48, -1, 1);
          }
        } else if (t.identifier !== actTouchId) {
          input.mouse.x = p.x; input.mouse.y = p.y;
        }
      }
    }, { passive: false });
    const touchEnd = (e) => {
      e.preventDefault();
      for (const t of e.changedTouches) {
        if (t.identifier === input.joy.id) {
          if (!input.joy.moved) {
            // never dragged → it was a tap: fire a click where the finger lifted
            const p = toGame(t);
            input.mouse.x = p.x; input.mouse.y = p.y;
            input.mouse.down = false; input.mouse.clicked = true; input.mouse.released = true;
          }
          input.joy.id = null; input.joy.active = false; input.joy.moved = false;
          input.joy.x = 0; input.joy.y = 0;
        } else if (t.identifier === actTouchId) {
          actTouchId = null;
          input.virtualAction = false;
        } else {
          input.mouse.down = false; input.mouse.released = true;
        }
      }
    };
    cv.addEventListener('touchend', touchEnd, { passive: false });
    cv.addEventListener('touchcancel', touchEnd, { passive: false });
  }

  let last = 0;
  function loop(t) {
    requestAnimationFrame(loop);
    const dt = Math.min(0.05, (t - last) / 1000 || 0.016);
    last = t;
    CM.dt = dt;
    CM.time += dt;
    CM.sceneTime += dt;
    CM.frame++;
    preUpdate();
    if (CM.scene && CM.scene.update) { try { CM.scene.update(dt); } catch (e) { console.error(e); } }
    if (CM.scene && CM.scene.draw) { try { CM.scene.draw(g); } catch (e) { console.error(e); } }
    postDraw(g);
    input.just = Object.create(null);
    input.mouse.clicked = false;
    input.mouse.released = false;
    input._virtualJust = false;
  }

  CM.boot = function () {
    cv = document.getElementById('game');
    g = cv.getContext('2d');
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    cv.width = CM.W * dpr;
    cv.height = CM.H * dpr;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    CM.canvas = cv;
    CM.g = g;
    resize();
    // refit on every event that can change the available space on a tablet
    window.addEventListener('resize', resize);
    window.addEventListener('orientationchange', () => { resize(); setTimeout(resize, 250); });
    document.addEventListener('fullscreenchange', resize);
    document.addEventListener('webkitfullscreenchange', resize);
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', resize);
      window.visualViewport.addEventListener('scroll', resize);
    }
    attachEvents();
    // canvas fillText never triggers webfont download on its own — kick it off
    // so the title doesn't render in the fallback font for the whole session
    if (document.fonts && document.fonts.load) {
      document.fonts.load("800 24px 'Baloo 2'");
      document.fonts.load("700 24px 'Baloo 2'");
    }
    CM.loadSave();
    CM.switchScene('title');
    requestAnimationFrame(loop);
  };

  /* ---------------- results scene (shown after every mini-game) ---------------- */
  CM.registerScene('results', {
    enter(p) {
      this.p = p;
      this.gameName = (CM.games[p.id] || {}).name || 'Game';
      this.parts = [];
      const colors = ['#ff9ec7', '#8ecdf6', '#ffe9a8', '#bdeccd', '#d8c9f2', '#f06292'];
      for (let i = 0; i < 130; i++) {
        this.parts.push({
          x: CM.rand(0, CM.W), y: CM.rand(-CM.H, 0),
          vy: CM.rand(60, 160), w: CM.rand(2, 5), ph: CM.rand(0, 7),
          size: CM.rand(5, 11), color: CM.pick(colors), rot: CM.rand(0, 7)
        });
      }
      CM.audio.play(p.newBest ? 'tada' : 'cheer');
    },
    update(dt) {
      for (const c of this.parts) {
        c.y += c.vy * dt;
        c.x += Math.sin(CM.time * c.w + c.ph) * 30 * dt;
        c.rot += dt * 2;
        if (c.y > CM.H + 20) { c.y = -20; c.x = CM.rand(0, CM.W); }
      }
      if (CM.input.pressed('action')) CM.switchScene(CM._returnHub || 'mansion');
    },
    draw(g) {
      const grad = g.createLinearGradient(0, 0, 0, CM.H);
      grad.addColorStop(0, '#ffe2ef');
      grad.addColorStop(1, '#d8ecff');
      g.fillStyle = grad;
      g.fillRect(0, 0, CM.W, CM.H);
      for (const c of this.parts) {
        g.save();
        g.translate(c.x, c.y);
        g.rotate(c.rot);
        g.fillStyle = c.color;
        g.fillRect(-c.size / 2, -c.size / 2, c.size, c.size * 0.6);
        g.restore();
      }
      const p = this.p;
      CM.ui.panel(g, 250, 110, 460, 360);
      CM.draw.text(g, p.newBest ? 'NEW BEST!! 🌟' : 'Yay!! 🎉', 480, 165, { size: 44, color: CM.palette.pinkDeep, weight: 800 });
      CM.draw.text(g, this.gameName, 480, 215, { size: 24, color: CM.palette.ink });
      CM.draw.text(g, 'Score: ' + p.score, 480, 270, { size: 40, color: CM.palette.blueDeep, weight: 800 });
      CM.draw.coin(g, 408, 320, 14);
      CM.draw.text(g, '+' + p.coins + ' coins!', 495, 320, { size: 26, color: '#c98a1f', weight: 800 });
      CM.draw.text(g, 'Best: ' + p.best, 480, 358, { size: 19, color: '#9a8a94' });
      const canReplay = !!CM.games[p.id];
      if (canReplay && CM.ui.button(g, 295, 392, 180, 50, 'Play Again', { color: CM.palette.mintDeep })) {
        CM.startGame(p.id);
        return;
      }
      const hubLabel = CM.HUBS[CM._returnHub] || 'Mansion';
      if (CM.ui.button(g, canReplay ? 490 : 390, 392, 180, 50, hubLabel, { color: CM.palette.blueDeep })) {
        CM.switchScene(CM._returnHub || 'mansion');
        return;
      }
      const wob = Math.sin(CM.time * 3) * 6;
      if (CM.drawFriend) {
        CM.drawFriend(g, 'hellokitty', 190, 480 + wob * 0.3, 1.1, { bob: (CM.time * 1.5) % 1 });
        CM.drawFriend(g, 'cinnamoroll', 775, 480 - wob * 0.3, 1.1, { bob: (CM.time * 1.5 + 0.5) % 1, flip: true });
      }
    }
  });
})();
