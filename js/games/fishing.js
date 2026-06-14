/* Cinnamoroll Mansion — Fishing Pond (hosted by Keroppi) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  const WATER_Y = 210;
  const MAX_CASTS = 8;
  const PLAYER = { x: 120, y: 552 };
  const ROD_TIP = { x: 300, y: 358 };
  const KERO = { x: 752, y: 452 };
  const BAR = { x: 874, y: 140, w: 40, h: 380 };

  /* ============ fish table & art (each centered at 0,0, faces right) ============ */
  function fishEye(g, x, y, r) {
    D.circle(g, x, y, r, '#3c3c3c');
    D.circle(g, x + r * 0.35, y - r * 0.4, r * 0.35, '#fff');
  }
  function artMinnow(g) {
    g.fillStyle = '#8fb8d8';
    g.beginPath(); g.moveTo(-13, 0); g.lineTo(-23, -8); g.lineTo(-23, 8); g.closePath(); g.fill();
    D.ellipse(g, 0, 0, 15, 7.5, '#a8cbe3', '#7da4c4', 2);
    D.ellipse(g, 2, 2.5, 9, 3, 'rgba(255,255,255,0.55)');
    fishEye(g, 8, -2, 2.2);
  }
  function artGoldfish(g) {
    g.fillStyle = '#ffb35c';
    g.beginPath();
    g.moveTo(-13, 0);
    g.quadraticCurveTo(-32, -15, -26, 0);
    g.quadraticCurveTo(-32, 15, -13, 0);
    g.fill();
    g.fillStyle = '#ffb35c';
    g.beginPath(); g.moveTo(-2, -9); g.lineTo(-7, -17); g.lineTo(5, -12); g.closePath(); g.fill();
    D.ellipse(g, 0, 0, 16, 10, '#ffa54f', '#e2873a', 2);
    D.ellipse(g, 2, 4, 9, 4, 'rgba(255,255,255,0.5)');
    fishEye(g, 9, -3, 2.4);
    g.fillStyle = 'rgba(255,140,160,0.5)';
    g.beginPath(); g.ellipse(5, 2, 3, 2, 0, 0, Math.PI * 2); g.fill();
  }
  function artTrout(g) {
    g.fillStyle = '#a5d4e8';
    g.beginPath(); g.moveTo(-16, 0); g.lineTo(-27, -9); g.lineTo(-27, 9); g.closePath(); g.fill();
    D.ellipse(g, 0, 0, 19, 9.5, '#bfe3f0', '#8fc3dc', 2);
    D.circle(g, -6, -2, 3, '#e6f7fc');
    D.circle(g, 1, 3, 2.4, '#e6f7fc');
    D.circle(g, 6, -3, 2, '#e6f7fc');
    fishEye(g, 11, -2.5, 2.4);
    g.strokeStyle = 'rgba(255,255,255,0.85)';
    g.lineWidth = 1.5;
    g.beginPath(); g.arc(17, -12, 3, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.arc(22, -18, 2, 0, Math.PI * 2); g.stroke();
  }
  function artCrab(g) {
    g.strokeStyle = '#e2607c'; g.lineWidth = 2; g.lineCap = 'round';
    for (let s = -1; s <= 1; s += 2) {
      g.beginPath(); g.moveTo(10 * s, 6); g.lineTo(17 * s, 12); g.stroke();
      g.beginPath(); g.moveTo(12 * s, 2); g.lineTo(20 * s, 6); g.stroke();
    }
    D.circle(g, -17, -3, 5, '#ff9ec7', '#e87fa2', 1.5);
    D.circle(g, 17, -3, 5, '#ff9ec7', '#e87fa2', 1.5);
    g.fillStyle = '#ff7d92';
    g.beginPath();
    g.moveTo(0, 14);
    g.bezierCurveTo(-19, 5, -15, -13, 0, -13);
    g.bezierCurveTo(15, -13, 19, 5, 0, 14);
    g.fill();
    D.ellipse(g, -4.5, -13, 5, 2.6, '#67c587');
    D.ellipse(g, 4.5, -13, 5, 2.6, '#67c587');
    g.fillStyle = '#ffe9a8';
    for (const sd of [[-6, 3], [0, 7], [6, 3], [-3, -2], [3, -2]]) {
      g.beginPath(); g.arc(sd[0], sd[1], 1.3, 0, Math.PI * 2); g.fill();
    }
    fishEye(g, -4, -6.5, 1.9);
    fishEye(g, 4, -6.5, 1.9);
    g.strokeStyle = '#3c3c3c'; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.arc(0, -3, 2.5, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
  }
  function artKoi(g) {
    g.fillStyle = '#ffd9e8';
    g.beginPath();
    g.moveTo(-16, 0);
    g.quadraticCurveTo(-36, -18, -29, 0);
    g.quadraticCurveTo(-36, 18, -16, 0);
    g.fill();
    D.ellipse(g, 0, 0, 20, 10, '#fff', '#f0cfe0', 2);
    D.ellipse(g, -7, -3, 6, 4, '#ff9ec7');
    D.ellipse(g, 4, 3, 5, 3.5, '#8ecdf6');
    D.ellipse(g, 10, -4, 4, 3, '#ffe9a8');
    D.ellipse(g, -1, 5, 4, 2.5, '#bdeccd');
    fishEye(g, 13, -3, 2.4);
    g.strokeStyle = '#f0b9d2'; g.lineWidth = 1.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(19, 2); g.lineTo(24, 5); g.stroke();
    g.beginPath(); g.moveTo(18, 4); g.lineTo(22, 8); g.stroke();
    D.star(g, -4, -12, 3, '#fff');
    D.star(g, 13, 9, 2.5, '#fff');
  }
  function artBoot(g) {
    D.rr(g, -12, -17, 14, 24, 4, '#9c7350', '#7c5a3e', 2);
    D.rr(g, -12, 0, 27, 11, 5, '#9c7350', '#7c5a3e', 2);
    D.rr(g, -14, 8, 31, 5, 2.5, '#6b4c34');
    D.rr(g, -9, -11, 7, 6, 2, '#c49a6c');
    g.strokeStyle = '#5f4632'; g.lineWidth = 1.6; g.lineCap = 'round';
    g.beginPath(); g.moveTo(-9, -15); g.lineTo(-1, -12); g.stroke();
    g.beginPath(); g.moveTo(-9, -12); g.lineTo(-1, -15); g.stroke();
  }
  function artCan(g) {
    g.save();
    g.rotate(0.22);
    D.rr(g, -9, -13, 18, 26, 4, '#dfe7ec', '#aebdc6', 2);
    D.rr(g, -9, -6, 18, 12, 2, '#ff9ec7');
    D.heart(g, 0, 0, 5, '#fff');
    D.ellipse(g, 0, -13, 8.5, 3, '#c4d1d8', '#aebdc6', 1.5);
    g.strokeStyle = '#8da0ab'; g.lineWidth = 1.6;
    g.beginPath(); g.moveTo(-2, -13); g.lineTo(3, -13); g.stroke();
    g.restore();
  }

  const FISH = [
    { id: 'minnow', name: 'Minnow', pts: 10, w: 22, art: artMinnow },
    { id: 'goldfish', name: 'Goldfish', pts: 20, w: 24, art: artGoldfish },
    { id: 'trout', name: 'Bubble Trout', pts: 35, w: 22, art: artTrout },
    { id: 'crab', name: 'Strawberry Crab', pts: 50, w: 14, art: artCrab },
    { id: 'koi', name: 'Rainbow Koi', pts: 100, w: 6, art: artKoi },
    { id: 'boot', name: 'Old Boot', pts: 5, w: 6, art: artBoot },
    { id: 'can', name: 'Soda Can', pts: 5, w: 6, art: artCan }
  ];
  const TOTALW = FISH.reduce((s, f) => s + f.w, 0);
  function pickFish() {
    let r = Math.random() * TOTALW;
    for (const f of FISH) { r -= f.w; if (r <= 0) return f; }
    return FISH[0];
  }
  function drawFishIcon(g, f, x, y, s, rot) {
    g.save();
    g.translate(x, y);
    if (rot) g.rotate(rot);
    g.scale(s, s);
    f.art(g);
    g.restore();
  }

  /* ============ input shortcuts ============ */
  function actPressed() { return CM.input.pressed('action') || CM.input.mouse.clicked; }
  function actDown() { return CM.input.down('action') || CM.input.mouse.down; }

  /* ============ scenery pieces ============ */
  const PADS = [
    { x: 430, y: 302, s: 0.62, ph: 0.5 },
    { x: 590, y: 528, s: 0.9, ph: 2.1 },
    { x: 330, y: 438, s: 0.6, ph: 3.6 },
    { x: 856, y: 322, s: 0.7, ph: 5.0 }
  ];
  const REEDS_FAR = [
    { x: 30, h: 30, ph: 0 }, { x: 48, h: 24, ph: 1.2 }, { x: 362, h: 28, ph: 2.1 },
    { x: 384, h: 22, ph: 0.6 }, { x: 555, h: 26, ph: 3.0 }, { x: 838, h: 30, ph: 1.7 },
    { x: 858, h: 23, ph: 4.1 }
  ];
  const REEDS_NEAR = [
    { x: 888, y: 612, h: 76, ph: 0.4 }, { x: 912, y: 618, h: 102, ph: 1.6 },
    { x: 933, y: 610, h: 86, ph: 2.8 }, { x: 950, y: 616, h: 64, ph: 0.9 }
  ];

  function drawReed(g, x, y, h, ph) {
    const sway = Math.sin(CM.time * 1.2 + ph) * (h * 0.08);
    g.strokeStyle = '#5fa84e';
    g.lineWidth = Math.max(2.5, h * 0.04);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + sway * 0.4, y - h * 0.6, x + sway, y - h);
    g.stroke();
    D.rr(g, x + sway - 3.5, y - h - 2, 7, h * 0.22 + 8, 3.5, '#8a5a3b');
  }

  function drawDragonfly(g, x, y, dir) {
    g.save();
    g.translate(x, y);
    g.scale(dir, 1);
    const fl = Math.sin(CM.time * 38) * 0.5 + 0.5;
    const wcol = 'rgba(255,255,255,' + (0.4 + fl * 0.35).toFixed(2) + ')';
    g.save(); g.translate(-3, -2); g.rotate(-0.55 - fl * 0.3); D.ellipse(g, 0, -8, 2.6, 8, wcol); g.restore();
    g.save(); g.translate(-3, -2); g.rotate(0.55 + fl * 0.3); D.ellipse(g, 0, -8, 2.6, 8, wcol); g.restore();
    D.rr(g, -12, -1.5, 22, 3, 1.5, '#6fc3df');
    D.circle(g, 11, 0, 3, '#4a9fdc');
    g.restore();
  }

  function drawBobber(g, x, y) {
    g.save();
    g.beginPath(); g.arc(x, y, 9, Math.PI, Math.PI * 2); g.closePath();
    g.fillStyle = '#ff6b6b'; g.fill();
    g.beginPath(); g.arc(x, y, 9, 0, Math.PI); g.closePath();
    g.fillStyle = '#fff'; g.fill();
    D.circle(g, x, y, 9, null, '#d94f4f', 2);
    D.circle(g, x, y - 11, 2.6, '#ffe9a8', '#d8ab35', 1.2);
    g.restore();
  }

  /* ============ the game ============ */
  CM.registerGame({
    id: 'fishing',
    name: 'Fishing Pond',

    enter() {
      this.state = 'howto';
      this.t = 0;
      this.casts = 0;
      this.score = 0;
      this.log = [];
      this.parts = [];
      this.shake = 0;
      this.finished = false;
      this.msg = '';
      this.msgT = 0;
      this.keroMsg = '';
      this.keroT = 0;
      this.fish = null;
      this.reel = null;
      this.waitDur = 0;
      this.splashT = 0;
      this.bob = { x: ROD_TIP.x, y: ROD_TIP.y + 52 };
      this.castFrom = { x: ROD_TIP.x, y: ROD_TIP.y };
      this.castTo = { x: 500, y: 380 };
      this.ripples = [];
      for (let i = 0; i < 8; i++) {
        this.ripples.push({
          x: CM.rand(60, 900), y: CM.rand(WATER_Y + 50, 560),
          ph: CM.rand(0, 1), sp: CM.rand(0.12, 0.26), r: CM.rand(20, 44)
        });
      }
      this.flies = [
        { ph: 0, cx: 470, cy: 150, rx: 170, ry: 38, sp: 0.5 },
        { ph: 2.4, cx: 700, cy: 255, rx: 110, ry: 26, sp: 0.36 }
      ];
    },

    exit() {},

    kero(msg, dur) { this.keroMsg = msg; this.keroT = dur; },

    addP(p) {
      if (this.parts.length > 90) this.parts.shift();
      this.parts.push(p);
    },
    addRipple(x, y) { this.addP({ type: 'ripple', x: x, y: y, life: 0.9, max: 0.9, size: CM.rand(26, 38) }); },
    addDrop(x, y) {
      this.addP({
        type: 'drop', x: x, y: y, vx: CM.rand(-70, 70), vy: CM.rand(-180, -60),
        life: 0.55, max: 0.55
      });
    },
    addSpark(x, y, big) {
      const heart = Math.random() < 0.35;
      const l = CM.rand(0.6, 1.1);
      this.addP({
        type: heart ? 'heart' : 'star', x: x, y: y,
        vx: CM.rand(-80, 80), vy: CM.rand(-150, -30),
        size: big ? CM.rand(7, 13) : CM.rand(5, 10),
        color: heart ? P.pinkDeep : (big ? '#ffd34d' : P.yellowDeep),
        life: l, max: l
      });
    },
    addText(str, x, y, color) {
      this.addP({ type: 'text', str: str, x: x, y: y, vx: 0, vy: -42, life: 1.2, max: 1.2, color: color || P.blueDeep });
    },
    updateParts(dt) {
      const ps = this.parts;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life -= dt;
        if (p.life <= 0) { ps.splice(i, 1); continue; }
        if (p.vx !== undefined) { p.x += p.vx * dt; p.y += p.vy * dt; }
        if (p.type === 'drop') p.vy += 520 * dt;
        if (p.type === 'star' || p.type === 'heart') p.vy += 70 * dt;
      }
    },

    startPlay() {
      this.state = 'idle';
      this.t = 0;
      this.kero('Ribbit! Tap to cast your line!', 2.4);
    },

    doCast() {
      let tx = 500, ty = 380;
      for (let i = 0; i < 8; i++) {
        tx = CM.rand(370, 830);
        ty = CM.rand(265, 520);
        if (!(tx > 650 && tx < 860 && ty > 390 && ty < 530)) break;
      }
      this.castFrom = { x: ROD_TIP.x, y: ROD_TIP.y };
      this.castTo = { x: tx, y: ty };
      this.state = 'casting';
      this.t = 0;
      CM.audio.play('whoosh');
    },

    startReel() {
      const f = this.fish || pickFish();
      this.fish = f;
      this.state = 'reeling';
      this.t = 0;
      this.reel = {
        fishPos: 0.5,
        target: CM.rand(0.15, 0.85),
        retime: CM.rand(0.6, 1.2),
        speed: 0.14 + (Math.min(f.pts, 100) / 100) * 0.13,
        zonePos: 0.55, zoneVel: 0, zoneH: 0.34,
        meter: 0.4
      };
      this.kero('Hold tight! Reel it in!', 1.6);
    },

    updateReel(dt) {
      const r = this.reel;
      r.retime -= dt;
      if (r.retime <= 0) {
        r.retime = CM.rand(0.7, 1.4);
        r.target = CM.rand(0.12, 0.88);
      }
      const d = r.target - r.fishPos;
      const step = r.speed * dt;
      if (Math.abs(d) <= step) r.fishPos = r.target;
      else r.fishPos += Math.sign(d) * step;

      r.zoneVel += (actDown() ? -2.6 : 2.2) * dt;
      r.zoneVel = CM.clamp(r.zoneVel, -0.85, 0.85);
      r.zonePos += r.zoneVel * dt;
      const half = r.zoneH / 2;
      if (r.zonePos < half) { r.zonePos = half; r.zoneVel = 0; }
      if (r.zonePos > 1 - half) { r.zonePos = 1 - half; r.zoneVel = 0; }

      const inside = Math.abs(r.fishPos - r.zonePos) < half + 0.02;
      r.meter += inside ? dt / 2.0 : -dt / 3.2;
      r.meter = CM.clamp(r.meter, 0, 1.001);

      this.bob.x = this.castTo.x + Math.sin(this.t * 9) * 5;
      this.bob.y = this.castTo.y + 4 + Math.sin(this.t * 13) * 3;
      this.splashT -= dt;
      if (this.splashT <= 0) {
        this.splashT = 0.18;
        this.addDrop(this.bob.x, this.bob.y);
      }

      if (r.meter >= 1) this.catchIt();
      else if (r.meter <= 0) {
        this.state = 'escaped';
        this.t = 0;
        CM.audio.play('miss');
        this.msg = 'It slipped away! Next one!';
        this.msgT = 1.6;
        this.kero('So close! Good try!', 2);
        this.addRipple(this.bob.x, this.bob.y);
      }
    },

    catchIt() {
      const f = this.fish;
      this.state = 'caught';
      this.t = 0;
      this.score += f.pts;
      this.log.push(f);
      const koi = f.id === 'koi';
      const junk = f.id === 'boot' || f.id === 'can';
      CM.audio.play(koi ? 'tada' : 'cheer');
      if (junk) CM.audio.play('boing');
      this.shake = koi ? 0.5 : 0.2;
      const n = koi ? 24 : 13;
      for (let i = 0; i < n; i++) {
        this.addSpark(PLAYER.x + CM.rand(-65, 65), PLAYER.y - 130 + CM.rand(-55, 30), koi);
      }
      this.addText('+' + f.pts, PLAYER.x + 60, PLAYER.y - 190, koi ? P.pinkDeep : P.blueDeep);
      this.addRipple(this.bob.x, this.bob.y);
      this.kero(
        koi ? 'WOW!! A Rainbow Koi!!'
          : junk ? 'Hee hee! Splashy treasure!'
            : CM.pick(['Ribbit! Nice catch!', 'Wow, great one!', 'Yay! So splashy!']),
        2.2
      );
    },

    endCast() {
      this.casts++;
      this.t = 0;
      if (this.casts >= MAX_CASTS) {
        this.state = 'done';
        CM.audio.play('ding');
        this.kero('What a fishing day! Ribbit!', 1.6);
      } else {
        this.state = 'idle';
      }
    },

    update(dt) {
      this.t += dt;
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 1.4);
      if (this.msgT > 0) this.msgT -= dt;
      if (this.keroT > 0) this.keroT -= dt;
      this.updateParts(dt);

      const st = this.state;
      if (st === 'howto') {
        if (actPressed()) { CM.audio.play('click'); this.startPlay(); }
      } else if (st === 'idle') {
        this.bob.x = ROD_TIP.x + Math.sin(CM.time * 1.6) * 7;
        this.bob.y = ROD_TIP.y + 52;
        if (actPressed()) this.doCast();
      } else if (st === 'casting') {
        const k = Math.min(1, this.t / 0.7);
        this.bob.x = CM.lerp(this.castFrom.x, this.castTo.x, k);
        this.bob.y = CM.lerp(this.castFrom.y, this.castTo.y, k) - Math.sin(k * Math.PI) * 130;
        if (k >= 1) {
          CM.audio.play('splash');
          this.addRipple(this.bob.x, this.bob.y);
          for (let i = 0; i < 5; i++) this.addDrop(this.bob.x, this.bob.y);
          this.shake = Math.max(this.shake, 0.07);
          this.state = 'waiting';
          this.t = 0;
          this.waitDur = CM.rand(1, 4);
          this.fish = pickFish();
        }
      } else if (st === 'waiting') {
        this.bob.x = this.castTo.x;
        this.bob.y = this.castTo.y + Math.sin(CM.time * 2.2) * 2.5;
        if (actPressed()) {
          CM.audio.play('whoosh');
          this.addRipple(this.bob.x, this.bob.y);
          this.state = 'scared';
          this.t = 0;
          this.msg = 'Too soon! Wait for the tug...';
          this.msgT = 1.6;
          this.kero('Shhh... be sneaky!', 2);
        } else if (this.t >= this.waitDur) {
          this.state = 'bite';
          this.t = 0;
          CM.audio.play('pop');
          this.addRipple(this.bob.x, this.bob.y);
          this.kero('A bite! Tap NOW!', 1.1);
        }
      } else if (st === 'bite') {
        this.bob.x = this.castTo.x;
        this.bob.y = this.castTo.y + 8 + Math.sin(this.t * 24) * 4;
        this.splashT -= dt;
        if (this.splashT <= 0) {
          this.splashT = 0.3;
          this.addRipple(this.bob.x, this.bob.y);
        }
        if (actPressed()) {
          CM.audio.play('ding');
          this.startReel();
        } else if (this.t > 0.9) {
          this.state = 'missed';
          this.t = 0;
          CM.audio.play('miss');
          this.msg = 'Ooh, it got shy! Try again!';
          this.msgT = 1.6;
          this.addRipple(this.bob.x, this.bob.y);
        }
      } else if (st === 'reeling') {
        this.updateReel(dt);
      } else if (st === 'caught') {
        if (this.t > 2.4 || (this.t > 0.7 && actPressed())) this.endCast();
      } else if (st === 'scared' || st === 'missed' || st === 'escaped') {
        if (this.t > 1.5) this.endCast();
      } else if (st === 'done') {
        if (this.t > 1.5 && !this.finished) {
          this.finished = true;
          CM.finishGame('fishing', this.score, CM.clamp(Math.ceil(this.score / 14), 5, 30));
        }
      }
    },

    rodTip() {
      if (this.state === 'reeling') {
        return { x: ROD_TIP.x + 8, y: ROD_TIP.y + 14 + Math.sin(CM.time * 26) * 2 };
      }
      return ROD_TIP;
    },

    /* ---------------- drawing ---------------- */
    drawSky(g) {
      const grad = g.createLinearGradient(0, -12, 0, WATER_Y);
      grad.addColorStop(0, '#ffe6b8');
      grad.addColorStop(0.55, '#ffd2a1');
      grad.addColorStop(1, '#ffbfa4');
      g.fillStyle = grad;
      g.fillRect(-12, -12, CM.W + 24, WATER_Y + 12);
      // sun + halo
      g.save();
      g.globalAlpha = 0.35;
      D.circle(g, 640, 152, 58, '#fff3c9');
      g.globalAlpha = 1;
      D.circle(g, 640, 152, 36, '#fff7d9', '#ffe9a8', 3);
      g.restore();
      // soft clouds
      for (const c of [{ x: 170, y: 76, s: 1 }, { x: 790, y: 58, s: 0.8 }]) {
        g.save();
        g.globalAlpha = 0.85;
        D.ellipse(g, c.x, c.y, 46 * c.s, 15 * c.s, '#fff4e6');
        D.ellipse(g, c.x - 26 * c.s, c.y + 4 * c.s, 26 * c.s, 11 * c.s, '#fff4e6');
        D.ellipse(g, c.x + 28 * c.s, c.y + 5 * c.s, 28 * c.s, 12 * c.s, '#fff4e6');
        g.restore();
      }
      // far shore
      g.fillStyle = '#b9dca6';
      g.fillRect(-12, WATER_Y - 16, CM.W + 24, 16);
      for (const b of [{ x: 120, r: 26 }, { x: 250, r: 18 }, { x: 480, r: 22 }, { x: 690, r: 18 }, { x: 905, r: 24 }]) {
        D.ellipse(g, b.x, WATER_Y - 16, b.r, b.r * 0.62, '#a3cf90');
      }
      for (const r of REEDS_FAR) drawReed(g, r.x, WATER_Y + 8, r.h, r.ph);
    },

    drawWater(g) {
      const grad = g.createLinearGradient(0, WATER_Y, 0, CM.H + 12);
      grad.addColorStop(0, '#a9ddd3');
      grad.addColorStop(0.5, '#7ec4bb');
      grad.addColorStop(1, '#5fa8a4');
      g.fillStyle = grad;
      g.fillRect(-12, WATER_Y, CM.W + 24, CM.H - WATER_Y + 24);
      // golden sun glints
      g.save();
      g.globalAlpha = 0.16;
      D.ellipse(g, 640, 262, 80, 7, '#fff3c9');
      D.ellipse(g, 646, 326, 122, 9, '#fff3c9');
      D.ellipse(g, 634, 408, 165, 11, '#fff3c9');
      D.ellipse(g, 642, 502, 200, 13, '#fff3c9');
      g.restore();
      // looping ambient ripples
      for (const r of this.ripples) {
        const k = (CM.time * r.sp + r.ph) % 1;
        g.strokeStyle = 'rgba(255,255,255,' + (0.32 * (1 - k)).toFixed(3) + ')';
        g.lineWidth = 2;
        g.beginPath();
        g.ellipse(r.x, r.y, r.r * k + 5, (r.r * k + 5) * 0.32, 0, 0, Math.PI * 2);
        g.stroke();
      }
    },

    drawPads(g) {
      for (const p of PADS) {
        const yo = Math.sin(CM.time * 1.2 + p.ph) * 2;
        D.ellipse(g, p.x, p.y + yo, 40 * p.s, 13 * p.s, '#7bbf6e', '#5fa84e', 2);
        D.ellipse(g, p.x - 8 * p.s, p.y + yo - 2 * p.s, 16 * p.s, 5 * p.s, 'rgba(255,255,255,0.22)');
      }
      // lily flower on the first pad
      const fp = PADS[0];
      const fy = fp.y + Math.sin(CM.time * 1.2 + fp.ph) * 2 - 6;
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + 0.3;
        D.ellipse(g, fp.x + Math.cos(a) * 7, fy + Math.sin(a) * 4, 6, 3.5, '#ffd9e8');
      }
      D.circle(g, fp.x, fy, 3.5, '#ffe9a8');
      // Keroppi's big pad + Keroppi
      const ky = Math.sin(CM.time * 1.1) * 3;
      D.ellipse(g, KERO.x, KERO.y + 8 + ky, 56, 17, '#7bbf6e', '#5fa84e', 2.5);
      D.ellipse(g, KERO.x - 12, KERO.y + 5 + ky, 22, 6, 'rgba(255,255,255,0.22)');
      const excited = this.state === 'caught' || this.state === 'bite' || this.state === 'done';
      CM.drawFriend(g, 'keroppi', KERO.x, KERO.y + 4 + ky, 0.95, {
        flip: true,
        bob: excited ? (CM.time * 2.4) % 1 : ((CM.time * 0.7) % 1) * 0.35,
        shadow: false
      });
      if (this.keroT > 0) {
        const bw = Math.max(150, this.keroMsg.length * 8.4 + 26);
        const bx = CM.clamp(KERO.x - bw + 30, 8, CM.W - bw - 8);
        D.bubble(g, bx, KERO.y - 152 + ky, bw, 42, KERO.x - 24);
        D.text(g, this.keroMsg, bx + bw / 2, KERO.y - 131 + ky, { size: 14, weight: 800, color: P.ink });
      }
    },

    drawDock(g) {
      // posts in the water
      D.rr(g, 30, 466, 16, 56, 5, '#a9743f', '#8a5a3b', 2);
      D.rr(g, 216, 460, 16, 62, 5, '#a9743f', '#8a5a3b', 2);
      D.ellipse(g, 38, 524, 18, 6, 'rgba(255,255,255,0.3)');
      D.ellipse(g, 224, 524, 18, 6, 'rgba(255,255,255,0.3)');
      // deck
      D.rr(g, -14, 492, 270, 122, 12, '#caa06b', '#a9743f', 3);
      D.rr(g, -14, 492, 270, 12, 6, '#e0b87f');
      g.strokeStyle = 'rgba(140,90,50,0.3)';
      g.lineWidth = 2;
      for (let x = 16; x < 250; x += 28) {
        g.beginPath(); g.moveTo(x, 496); g.lineTo(x, 610); g.stroke();
      }
      // little bait bucket
      D.rr(g, 34, 556, 30, 26, 6, '#8ecdf6', '#6aaede', 2);
      D.ellipse(g, 49, 556, 15, 5, '#bfe3f5', '#6aaede', 2);
    },

    drawPlayerAndRod(g) {
      const st = this.state;
      if (st === 'caught') {
        CM.drawPlayer(g, PLAYER.x, PLAYER.y, 1.05, 'down', 0);
        const f = this.fish;
        if (f) {
          const fy = PLAYER.y - 168 + Math.sin(this.t * 5) * 4;
          const s = 1.3 + Math.min(this.t * 2.5, 0.25);
          drawFishIcon(g, f, PLAYER.x, fy, s, Math.sin(this.t * 4) * 0.12);
          if (f.id === 'koi') {
            for (let i = 0; i < 5; i++) {
              const a = this.t * 2 + (i / 5) * Math.PI * 2;
              const tw = 0.5 + 0.5 * Math.sin(CM.time * 8 + i * 1.7);
              D.star(g, PLAYER.x + Math.cos(a) * 56, fy + Math.sin(a) * 34, 4 + tw * 4, '#fff');
            }
          }
        }
        return;
      }
      const reeling = st === 'reeling';
      CM.drawPlayer(g, PLAYER.x, PLAYER.y, 1.05, 'right', reeling ? (CM.time * 1.5) % 1 : 0);
      // rod
      const tip = this.rodTip();
      g.save();
      g.lineCap = 'round';
      g.strokeStyle = '#8a5a3b';
      g.lineWidth = 4.5;
      g.beginPath();
      g.moveTo(PLAYER.x + 10, PLAYER.y - 26);
      g.quadraticCurveTo(PLAYER.x + 90, PLAYER.y - 110, tip.x, tip.y);
      g.stroke();
      g.strokeStyle = '#6b4c34';
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(PLAYER.x + 6, PLAYER.y - 22);
      g.lineTo(PLAYER.x + 28, PLAYER.y - 46);
      g.stroke();
      g.restore();
      D.circle(g, PLAYER.x + 26, PLAYER.y - 36, 5.5, '#5f4632', '#4a3727', 2);
      D.circle(g, PLAYER.x + 31, PLAYER.y - 32, 2, '#c9a14e');
      // line + bobber
      const inWater = st === 'waiting' || st === 'bite' || st === 'reeling';
      const flying = st === 'casting';
      const bx = (inWater || flying) ? this.bob.x : ROD_TIP.x + Math.sin(CM.time * 1.6) * 7;
      const by = (inWater || flying) ? this.bob.y : ROD_TIP.y + 52;
      const sag = reeling ? 4 : (flying ? 14 : 26);
      g.strokeStyle = 'rgba(255,255,255,0.75)';
      g.lineWidth = 1.5;
      g.beginPath();
      g.moveTo(tip.x, tip.y);
      g.quadraticCurveTo((tip.x + bx) / 2, (tip.y + by) / 2 + sag, bx, by);
      g.stroke();
      if (inWater) D.ellipse(g, bx, by + 6, 13, 4.5, 'rgba(255,255,255,0.4)');
      if (reeling) {
        const sp = Math.sin(CM.time * 16);
        D.ellipse(g, bx, by + 4, 15 + sp * 3, 5, 'rgba(255,255,255,0.55)');
      }
      drawBobber(g, bx, by);
      if (st === 'bite') {
        const pop = 1 + 0.22 * Math.sin(this.t * 18);
        D.circle(g, bx, by - 46, 20 * pop, '#ffe9a8', P.yellowDeep, 3);
        D.text(g, '!', bx, by - 45, { size: Math.round(30 * pop), color: '#e2574c', weight: 800 });
      }
    },

    drawParts(g) {
      for (const p of this.parts) {
        const k = Math.max(0, p.life / p.max);
        if (p.type === 'ripple') {
          const r = p.size * (1 - k) + 6;
          g.strokeStyle = 'rgba(255,255,255,' + (0.7 * k).toFixed(3) + ')';
          g.lineWidth = 2.5;
          g.beginPath(); g.ellipse(p.x, p.y, r, r * 0.34, 0, 0, Math.PI * 2); g.stroke();
          g.beginPath(); g.ellipse(p.x, p.y, r * 0.55, r * 0.19, 0, 0, Math.PI * 2); g.stroke();
        } else if (p.type === 'drop') {
          g.fillStyle = 'rgba(200,236,242,' + k.toFixed(3) + ')';
          g.beginPath(); g.arc(p.x, p.y, 2.6, 0, Math.PI * 2); g.fill();
        } else if (p.type === 'star') {
          g.save(); g.globalAlpha = k;
          D.star(g, p.x, p.y, p.size, p.color, CM.time * 3);
          g.restore();
        } else if (p.type === 'heart') {
          g.save(); g.globalAlpha = k;
          D.heart(g, p.x, p.y, p.size, p.color);
          g.restore();
        } else if (p.type === 'text') {
          g.save(); g.globalAlpha = k;
          D.text(g, p.str, p.x, p.y, { size: 26, color: p.color, weight: 800, stroke: '#fff', strokeWidth: 5 });
          g.restore();
        }
      }
    },

    drawHUD(g) {
      const castNum = Math.min(this.casts + 1, MAX_CASTS);
      D.rr(g, 14, 12, 124, 36, 18, 'rgba(255,255,255,0.88)', '#bcd9f0', 2);
      D.text(g, 'Cast ' + castNum + ' / ' + MAX_CASTS, 76, 31, { size: 17, weight: 800, color: P.blueDeep });
      D.rr(g, 148, 12, 112, 36, 18, 'rgba(255,255,255,0.88)', '#f0dca8', 2);
      D.star(g, 170, 30, 9, P.yellowDeep);
      D.text(g, String(this.score), 218, 31, { size: 18, weight: 800, color: '#c98a1f' });
      // caught log slots
      for (let i = 0; i < MAX_CASTS; i++) {
        const x = 308 + i * 44;
        D.circle(g, x, 32, 17, 'rgba(255,255,255,0.5)', 'rgba(255,255,255,0.85)', 2);
        if (this.log[i]) drawFishIcon(g, this.log[i], x, 32, 0.42);
      }
    },

    drawReelUI(g) {
      const r = this.reel;
      if (!r) return;
      const zy = BAR.y + (r.zonePos - r.zoneH / 2) * BAR.h;
      const zh = r.zoneH * BAR.h;
      const fy = BAR.y + r.fishPos * BAR.h;
      const inside = Math.abs(r.fishPos - r.zonePos) < r.zoneH / 2 + 0.02;
      // bar
      D.rr(g, BAR.x - 5, BAR.y - 10, BAR.w + 10, BAR.h + 20, 16, 'rgba(255,255,255,0.85)', '#bcd9f0', 2.5);
      D.rr(g, BAR.x, BAR.y, BAR.w, BAR.h, 12, '#d8f0f4');
      // zone
      D.rr(g, BAR.x + 2, zy, BAR.w - 4, zh, 10, 'rgba(103,197,135,0.55)', inside ? P.yellowDeep : P.mintDeep, inside ? 3.5 : 2.5);
      // fish marker
      drawFishIcon(g, this.fish, BAR.x + BAR.w / 2, fy, 0.52, Math.sin(CM.time * 6) * 0.15);
      // meter
      D.rr(g, BAR.x - 22, BAR.y, 13, BAR.h, 6, 'rgba(255,255,255,0.8)', '#f0b9d2', 2);
      const mh = r.meter * (BAR.h - 6);
      if (mh > 4) D.rr(g, BAR.x - 20, BAR.y + BAR.h - 3 - mh, 9, mh, 4.5, P.pinkDeep);
      if (r.meter > 0.8) D.star(g, BAR.x - 15.5, BAR.y - 14, 8 + Math.sin(CM.time * 10) * 2, P.yellowDeep);
      D.text(g, 'HOLD to lift!', BAR.x + BAR.w / 2 - 12, BAR.y + BAR.h + 26, { size: 14, weight: 800, color: P.ink, stroke: '#fff', strokeWidth: 4 });
      if (this.t < 1.2) {
        D.text(g, 'Keep the fish in the green!', 480, 130, { size: 24, weight: 800, color: P.mintDeep, stroke: '#fff', strokeWidth: 6 });
      }
    },

    drawCaughtBanner(g) {
      const f = this.fish;
      if (!f) return;
      CM.ui.panel(g, 290, 86, 380, 100);
      drawFishIcon(g, f, 345, 138, 1.05, 0);
      D.text(g, f.name + '!', 505, 120, { size: 25, weight: 800, color: f.id === 'koi' ? P.pinkDeep : P.ink });
      D.text(g, '+' + f.pts + ' points!', 505, 155, { size: 20, weight: 800, color: P.blueDeep });
      if (f.id === 'koi') {
        D.star(g, 305, 100, 7, P.yellowDeep);
        D.star(g, 655, 100, 7, P.yellowDeep);
        D.star(g, 655, 172, 6, P.pink);
      }
    },

    drawHowto(g) {
      g.fillStyle = 'rgba(70,40,70,0.25)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 220, 105, 520, 380, { title: 'Fishing Pond' });
      CM.drawFriend(g, 'keroppi', 305, 440, 1.1, { bob: ((CM.time * 1.1) % 1) * 0.5 });
      D.text(g, "Ribbit! Welcome to Keroppi's pond!", 480, 162, { size: 18, weight: 800, color: P.mintDeep });
      D.text(g, '1. Tap to cast your line... then wait quietly.', 490, 204, { size: 16, color: P.ink });
      D.text(g, '2. When the bobber goes  !  tap FAST to hook it!', 490, 234, { size: 16, color: P.ink });
      D.text(g, '3. Then HOLD to lift the green zone and keep', 490, 264, { size: 16, color: P.ink });
      D.text(g, 'the fish inside until the meter fills up!', 500, 288, { size: 16, color: P.ink });
      const pv = [FISH[0], FISH[1], FISH[2], FISH[3], FISH[4]];
      for (let i = 0; i < pv.length; i++) drawFishIcon(g, pv[i], 365 + i * 60, 330, 0.55);
      if (CM.ui.button(g, 380, 372, 200, 56, 'Start!', { color: CM.palette.mintDeep, size: 24 })) {
        this.startPlay();
      }
      D.text(g, CM.touchMode ? 'or tap anywhere to begin' : 'or press SPACE to begin', 480, 458, { size: 14, color: '#9a8a94' });
    },

    draw(g) {
      // shaken world
      g.save();
      if (this.shake > 0.01) {
        const a = this.shake * 9;
        g.translate(CM.rand(-a, a), CM.rand(-a, a));
      }
      this.drawSky(g);
      this.drawWater(g);
      this.drawPads(g);
      this.drawDock(g);
      this.drawPlayerAndRod(g);
      for (const f of this.flies) {
        const T = CM.time * f.sp + f.ph;
        drawDragonfly(g, f.cx + Math.sin(T) * f.rx, f.cy + Math.sin(T * 2.3 + 1) * f.ry, Math.cos(T) >= 0 ? 1 : -1);
      }
      for (const r of REEDS_NEAR) drawReed(g, r.x, r.y, r.h, r.ph);
      this.drawParts(g);
      g.restore();

      // steady UI
      this.drawHUD(g);
      const st = this.state;
      if (st === 'idle') {
        const pulse = 0.7 + 0.3 * Math.sin(CM.time * 4);
        g.save();
        g.globalAlpha = pulse;
        D.text(g, CM.touchMode ? 'Tap anywhere to cast!' : 'Click or press SPACE to cast!', 520, 582, { size: 20, weight: 800, color: '#fff', stroke: 'rgba(74,59,70,0.55)', strokeWidth: 5 });
        g.restore();
      } else if (st === 'waiting') {
        g.save();
        g.globalAlpha = 0.55 + 0.25 * Math.sin(CM.time * 3);
        D.text(g, 'Shh... wait for the tug...', 480, 96, { size: 22, weight: 800, color: '#fff', stroke: 'rgba(74,59,70,0.5)', strokeWidth: 5 });
        g.restore();
      }
      if (this.msgT > 0 && st !== 'caught') {
        D.text(g, this.msg, 480, 96, { size: 26, weight: 800, color: P.pinkDeep, stroke: '#fff', strokeWidth: 6 });
      }
      if (st === 'reeling') this.drawReelUI(g);
      if (st === 'caught') this.drawCaughtBanner(g);
      if (st === 'done') {
        CM.ui.panel(g, 320, 240, 320, 110);
        D.text(g, 'All done!', 480, 280, { size: 28, weight: 800, color: P.pinkDeep });
        D.text(g, 'What a great fishing day!', 480, 318, { size: 17, color: P.ink });
      }
      if (st === 'howto') this.drawHowto(g);
    }
  });
})();
