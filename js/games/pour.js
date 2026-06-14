/* Cinnamoroll Mansion — Pour It! (hosted by Hello Kitty) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ============================================================
     POUR IT!  — hold to pour, release at the target band.
     A cup sits under the spout. HOLD (tap & hold / Space) to pour;
     the liquid level RISES. RELEASE to stop. Land inside the marked
     TARGET BAND for "Just right!". A little over/under is still
     served (fewer points). Overflow is a funny gentle spill.
     ~7 cups, then "All served!" and finishGame.
     ============================================================ */

  const TOTAL_CUPS = 7;
  const MAX_PARTS = 90;

  // cup geometry (in canvas units) — the glass body the liquid fills
  const CUP = {
    cx: 480,          // cup centre x
    top: 250,         // y of the glass rim (where overflow happens)
    bottom: 470,      // y of the inside floor (level = 0 here)
    halfW: 86,        // half-width of the glass at the rim
    bottomHalfW: 66   // half-width at the base (a gentle taper)
  };
  const CUP_H = CUP.bottom - CUP.top;      // usable inner height
  const SPOUT_Y = 150;                     // where the stream leaves the spout

  // the different cute drinks (vary colour each cup)
  const DRINKS = [
    { id: 'milk',  name: 'Milk',       fill: '#f6f4ee', edge: '#e3ddcf', foam: '#ffffff' },
    { id: 'juice', name: 'Orange Juice', fill: '#ffb84d', edge: '#f29a1f', foam: '#ffd9a0' },
    { id: 'tea',   name: 'Tea',        fill: '#cf8a4a', edge: '#a86a32', foam: '#e7c79e' },
    { id: 'cocoa', name: 'Cocoa',      fill: '#7a4a32', edge: '#5e3826', foam: '#caa07e' },
    { id: 'soda',  name: 'Grape Soda', fill: '#a87fd6', edge: '#8761bd', foam: '#d6c2f0' },
    { id: 'mint',  name: 'Mint Cooler', fill: '#7fd6b4', edge: '#4fb792', foam: '#c2f0df' },
    { id: 'berry', name: 'Berry Punch', fill: '#ef7aa6', edge: '#d44f80', foam: '#ffc2da' }
  ];

  const POUR_RATE = 0.62;   // fraction of the cup filled per second of holding
  const HK = { x: 760, y: 488 }; // host: Hello Kitty at the counter, right side

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'pour',
    name: 'Pour It!',

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';     // howto -> pour -> result -> slide -> (loop) -> alldone -> done(once)
      this.score = 0;
      this.finished = false;

      this.cupIdx = 0;          // which cup (0..TOTAL_CUPS-1)
      this.perfectCount = 0;    // cups landed inside the band
      this.servedCount = 0;

      // current cup's pour state
      this.level = 0;           // 0..>1 fill fraction (can exceed 1 = overflow)
      this.pouring = false;
      this.spilled = false;
      this.resultKind = '';     // 'perfect' | 'close' | 'spill'
      this.resultPts = 0;

      // target band for the current cup (fractions of the cup height)
      this.bandLo = 0.5;
      this.bandHi = 0.65;

      // timers / juice
      this.resultT = 0;
      this.slideT = 0;
      this.cupOffset = 0;       // x slide offset for the cup entering/leaving
      this.shake = 0;
      this.streamWobble = 0;
      this.parts = [];
      this.alldoneT = 0;
      this.doneT = 0;

      this.hostBubble = { text: '', t: 0 };
      this.hostHappy = 0;

      // little floating cafe sparkles in the backdrop
      this.bg = [];
      for (let i = 0; i < 7; i++) {
        this.bg.push({ x: CM.rand(40, 920), y: CM.rand(60, 220), ph: CM.rand(0, 6.28), s: CM.rand(0.6, 1.2) });
      }

      this.setupCup();
    },

    exit() {},

    /* ================= per-cup setup ================= */
    setupCup() {
      this.level = 0;
      this.pouring = false;
      this.spilled = false;
      this.resultKind = '';
      this.resultPts = 0;
      this.cupOffset = 0;

      // pick this cup's drink (cycle so each is distinct & varied)
      this.drink = DRINKS[this.cupIdx % DRINKS.length];

      // choose a target band — vary the centre & width, ramp width down a touch.
      // keep it generous for little kids (never razor-thin).
      const t = this.cupIdx / Math.max(1, TOTAL_CUPS - 1);
      const halfW = CM.lerp(0.12, 0.075, t) / 2;   // band half-height (fraction)
      const centre = CM.rand(0.42, 0.78);          // where to fill to
      this.bandLo = CM.clamp(centre - halfW, 0.18, 0.9);
      this.bandHi = CM.clamp(centre + halfW, 0.22, 0.95);
    },

    say(text, t) {
      this.hostBubble = { text: text, t: t };
      this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    /* ================= particles ================= */
    addPart(p) { if (this.parts.length < MAX_PARTS) { p.maxLife = p.life; this.parts.push(p); } },

    sparkleBurst(x, y, color, big) {
      const n = big ? 14 : 8;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.addPart({
          kind: 'spark', x: x, y: y,
          vx: Math.cos(a) * CM.rand(60, big ? 180 : 120),
          vy: Math.sin(a) * CM.rand(60, big ? 180 : 120) - 40,
          life: CM.rand(0.45, 0.9), size: CM.rand(4, big ? 10 : 7),
          color: color
        });
      }
      const hearts = big ? 3 : 1;
      for (let i = 0; i < hearts; i++) {
        this.addPart({
          kind: 'heart', x: x + CM.rand(-16, 16), y: y - 8,
          vx: CM.rand(-30, 30), vy: CM.rand(-120, -60),
          life: 1.0, size: CM.rand(7, 11)
        });
      }
    },

    splashDrops(x, y, color) {
      for (let i = 0; i < 9; i++) {
        const a = -Math.PI * (0.15 + Math.random() * 0.7);
        this.addPart({
          kind: 'drop', x: x + CM.rand(-26, 26), y: y,
          vx: Math.cos(a) * CM.rand(40, 150), vy: Math.sin(a) * CM.rand(60, 180),
          life: CM.rand(0.4, 0.7), size: CM.rand(3, 6), color: color
        });
      }
    },

    floatText(x, y, str, color) {
      this.addPart({ kind: 'txt', x: x, y: y, str: str, color: color, vx: 0, vy: -42, life: 1.2 });
    },

    confetti() {
      if (this.parts.length > MAX_PARTS - 6) return;
      this.addPart({
        kind: 'spark', x: CM.rand(120, 840), y: CM.rand(100, 320),
        vx: CM.rand(-40, 40), vy: CM.rand(-70, -20),
        life: CM.rand(0.7, 1.2), size: CM.rand(6, 12),
        color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep])
      });
    },

    tickParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= dt;
        if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'spark') { p.vy += 230 * dt; p.vx *= 1 - dt * 1.1; }
        else if (p.kind === 'heart') p.vy += 30 * dt;
        else if (p.kind === 'drop') p.vy += 420 * dt;
      }
    },

    /* ================= flow ================= */
    startPlay() {
      this.state = 'pour';
      this.say('Pour to the line!', 2.0);
    },

    // begin pouring (on press)
    beginPour() {
      if (this.pouring || this.spilled) return;
      this.pouring = true;
      CM.audio.play('whoosh');
      CM.audio.tone(300, 0.12, 'sine', 0.08, 0, 240);
    },

    // stop pouring & judge (on release)
    stopPour() {
      if (!this.pouring) return;
      this.pouring = false;
      this.judge();
    },

    judge() {
      // figure out the result based on the final level
      let kind, pts;
      const L = this.level;
      if (L >= 1) {
        kind = 'spill'; pts = 8;          // overflow — funny, small points
      } else if (L >= this.bandLo && L <= this.bandHi) {
        kind = 'perfect'; pts = 60;       // landed in the band!
      } else {
        // gentle: how far off the nearest band edge?
        const off = L < this.bandLo ? (this.bandLo - L) : (L - this.bandHi);
        if (off < 0.1) { kind = 'close'; pts = 38; }     // just a hair off
        else { kind = 'close'; pts = 22; }               // more off, still served
      }
      this.resultKind = kind;
      this.resultPts = pts;
      this.score += pts;
      this.resultT = 0;
      this.state = 'result';

      const liqY = this.levelY(Math.min(L, 1));

      if (kind === 'perfect') {
        this.perfectCount++;
        this.servedCount++;
        this.shake = 5;
        CM.audio.play('ding');
        CM.audio.play('cheer');
        this.sparkleBurst(CUP.cx, liqY, P.yellowDeep, true);
        this.floatText(CUP.cx, liqY - 30, '+' + pts, '#c98a1f');
        this.say(CM.pick(['Just right!', 'Perfect pour!', 'Yum, perfect!']), 1.8);
      } else if (kind === 'spill') {
        this.spilled = true;
        this.servedCount++;
        this.shake = 6;
        CM.audio.play('splash');
        this.splashDrops(CUP.cx, CUP.top + 4, this.drink.fill);
        this.floatText(CUP.cx, CUP.top - 20, 'Oops! +' + pts, P.lavenderDeep);
        this.say(CM.pick(['Whoopsie spill!', 'Too full, hehe!', 'A little splashy!']), 1.8);
      } else {
        this.servedCount++;
        this.shake = 2;
        CM.audio.play('pop');
        this.sparkleBurst(CUP.cx, liqY, this.drink.edge, false);
        this.floatText(CUP.cx, liqY - 26, '+' + pts, P.pinkDeep);
        const under = L < this.bandLo;
        this.say(under ? CM.pick(['A bit more next time!', 'Almost there!'])
                       : CM.pick(['A touch over!', 'So close!']), 1.7);
      }
    },

    nextCup() {
      this.cupIdx++;
      if (this.cupIdx >= TOTAL_CUPS) {
        this.state = 'alldone';
        this.alldoneT = 0;
        this.shake = 7;
        CM.audio.play('tada');
        for (let i = 0; i < 12; i++) this.confetti();
        this.say('All served! Yay!', 3);
        return;
      }
      // slide the new cup in
      this.setupCup();
      this.state = 'slide';
      this.slideT = 0;
      this.cupOffset = 520; // start off to the right, slide to centre
    },

    // map a fill fraction (0..1) to a screen y for the liquid surface
    levelY(frac) {
      return CUP.bottom - CUP_H * CM.clamp(frac, 0, 1);
    },
    // half-width of the glass interior at a given fraction (taper)
    halfWAt(frac) {
      return CM.lerp(CUP.bottomHalfW, CUP.halfW, CM.clamp(frac, 0, 1));
    },

    /* ================= update ================= */
    update(dt) {
      this.shake = Math.max(0, this.shake - dt * 16);
      if (this.hostBubble.t > 0) this.hostBubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      this.streamWobble += dt * 12;
      this.tickParts(dt);

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.startPlay();
          break;

        case 'pour': {
          // HOLD to pour. Press starts; while held (mouse.down or action), fill rises.
          if (anyPress()) this.beginPour();
          const held = CM.input.mouse.down || CM.input.down('action');
          if (this.pouring) {
            if (held) {
              this.level += POUR_RATE * dt;
              // drip particles at the liquid surface for juice
              if (Math.random() < 0.5) {
                const sy = this.levelY(Math.min(this.level, 1));
                this.addPart({
                  kind: 'drop', x: CUP.cx + CM.rand(-10, 10), y: sy,
                  vx: CM.rand(-20, 20), vy: CM.rand(-30, 10),
                  life: CM.rand(0.2, 0.4), size: CM.rand(2, 4), color: this.drink.foam
                });
              }
              // overflow → auto-stop & judge as a spill
              if (this.level >= 1.06) {
                this.level = 1.06;
                this.pouring = false;
                this.judge();
              }
            } else {
              // released → stop & judge
              this.stopPour();
            }
          }
          break;
        }

        case 'result':
          this.resultT += dt;
          if (Math.random() < 0.15 && this.resultKind === 'perfect') this.confetti();
          {
            const dur = this.resultKind === 'perfect' ? 1.6 : 1.5;
            const canSkip = this.resultT > 0.5 && anyPress();
            if (this.resultT >= dur || canSkip) this.nextCup();
          }
          break;

        case 'slide':
          this.slideT += dt;
          // ease the cup in from the right
          this.cupOffset = CM.lerp(520, 0, CM.clamp(this.slideT / 0.55, 0, 1));
          if (this.slideT >= 0.6) {
            this.cupOffset = 0;
            this.state = 'pour';
            this.say('Pour to the line!', 1.4);
          }
          break;

        case 'alldone':
          this.alldoneT += dt;
          if (Math.random() < 0.45) this.confetti();
          if (this.alldoneT >= 2.2) {
            this.state = 'done';
            this.doneT = 1.6;
          }
          break;

        case 'done':
          if (Math.random() < 0.4) this.confetti();
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('pour', this.score, CM.clamp(Math.ceil(this.score / 18), 5, 30));
          }
          break;
      }
    },

    /* ================= draw ================= */
    draw(g) {
      g.save();
      if (this.shake > 0.2) {
        const m = this.shake;
        g.translate(CM.rand(-m, m) * 0.7, CM.rand(-m, m) * 0.7);
      }

      this.drawBackdrop(g);
      this.drawCounter(g);
      this.drawSpout(g);

      // cup + liquid (with current slide offset)
      g.save();
      g.translate(this.cupOffset, 0);
      this.drawCup(g);
      g.restore();

      // pouring stream only when the cup is centred & we're pouring
      if (this.state === 'pour' && this.pouring) this.drawStream(g);

      this.drawHost(g);
      this.drawParts(g);

      g.restore(); // end shake

      this.drawHud(g);

      if (this.state === 'result') this.drawResultBanner(g);
      if (this.state === 'alldone' || this.state === 'done') this.drawAllDone(g);
      if (this.state === 'howto') this.drawHowto(g);
    },

    /* ----- cafe backdrop ----- */
    drawBackdrop(g) {
      const wg = g.createLinearGradient(0, 0, 0, CM.H);
      wg.addColorStop(0, '#ffe9f3');
      wg.addColorStop(1, '#fff4ea');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, CM.H);

      // soft wall stripes
      g.fillStyle = 'rgba(255,255,255,0.35)';
      for (let i = 0; i < 8; i++) g.fillRect(i * 130, 0, 60, CM.H);

      // a cute "CAFE" sign hanging up top-left (away from reserved corner)
      D.rr(g, 40, 40, 168, 50, 14, 'rgba(255,255,255,0.92)', '#f0b9d2', 3);
      D.text(g, '☕ Café ☕', 124, 65, { size: 24, color: P.pinkDeep, weight: 800 });

      // floating sparkles
      const t = CM.time;
      for (const b of this.bg) {
        const tw = 0.4 + 0.4 * Math.sin(t * 2 + b.ph);
        g.globalAlpha = tw;
        D.star(g, b.x, b.y + Math.sin(t + b.ph) * 6, 6 * b.s, 'rgba(255,255,255,0.9)');
      }
      g.globalAlpha = 1;
    },

    /* ----- the counter Hello Kitty serves at ----- */
    drawCounter(g) {
      // wooden counter top
      const cy = 500;
      D.rr(g, -10, cy, CM.W + 20, 120, 16, P.wood || '#d9a86a', '#b9854a', 3);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(0, cy, CM.W, 6);
      // a little doily under the cup
      D.ellipse(g, CUP.cx, cy + 6, 120, 18, 'rgba(255,255,255,0.7)');
    },

    /* ----- spout / dispenser above the cup ----- */
    drawSpout(g) {
      const x = CUP.cx;
      // machine body
      D.rr(g, x - 70, 70, 140, 64, 16, '#cfe6ff', '#9ec6ee', 3);
      D.rr(g, x - 70, 70, 140, 20, 16, 'rgba(255,255,255,0.5)');
      D.text(g, this.drink ? this.drink.name : '', x, 102, { size: 16, color: P.blueDeep, weight: 800 });
      // nozzle
      D.rr(g, x - 16, 130, 32, 26, 8, '#b9d6f2', '#88b4e0', 2.5);
      D.rr(g, x - 9, SPOUT_Y - 4, 18, 12, 5, '#88b4e0');
      // a heart sticker
      D.heart(g, x - 50, 100, 14, P.pink);
      D.heart(g, x + 50, 100, 14, P.pink);
    },

    /* ----- the cup + liquid + target band ----- */
    drawCup(g) {
      const x = CUP.cx;
      // ground shadow
      D.ellipse(g, x, CUP.bottom + 18, 92, 16, 'rgba(120,80,90,0.18)');

      // ----- glass outline path (a gentle tumbler taper) -----
      const tx = CUP.halfW, bx = CUP.bottomHalfW;
      const top = CUP.top, bot = CUP.bottom;
      function glassPath() {
        g.beginPath();
        g.moveTo(x - tx, top);
        g.lineTo(x - bx, bot);
        g.quadraticCurveTo(x - bx, bot + 14, x - bx + 16, bot + 14);
        g.lineTo(x + bx - 16, bot + 14);
        g.quadraticCurveTo(x + bx, bot + 14, x + bx, bot);
        g.lineTo(x + tx, top);
        g.closePath();
      }

      // glass interior (pale)
      glassPath();
      g.fillStyle = 'rgba(255,255,255,0.55)';
      g.fill();

      // ----- liquid (clipped to the glass) -----
      const frac = Math.min(this.level, 1);
      if (frac > 0.001) {
        g.save();
        glassPath();
        g.clip();
        const surfaceY = this.levelY(frac);
        // body
        const lg = g.createLinearGradient(0, surfaceY, 0, bot);
        lg.addColorStop(0, this.drink.fill);
        lg.addColorStop(1, this.drink.edge);
        g.fillStyle = lg;
        g.fillRect(x - tx - 4, surfaceY, tx * 2 + 8, bot - surfaceY + 16);
        // wavy surface foam
        g.fillStyle = this.drink.foam;
        g.globalAlpha = 0.9;
        g.beginPath();
        g.moveTo(x - tx - 4, surfaceY + 2);
        const amp = this.pouring ? 5 : 2.5;
        for (let sx = -tx - 4; sx <= tx + 4; sx += 12) {
          const yy = surfaceY + Math.sin((sx + this.streamWobble * 6) * 0.12) * amp;
          g.lineTo(x + sx, yy);
        }
        g.lineTo(x + tx + 4, surfaceY + 14);
        g.lineTo(x - tx - 4, surfaceY + 14);
        g.closePath();
        g.fill();
        g.globalAlpha = 1;
        g.restore();
      }

      // ----- TARGET BAND marked on the glass (a "fill to here" zone) -----
      const yLo = this.levelY(this.bandHi); // higher fraction = higher on screen (smaller y)
      const yHi = this.levelY(this.bandLo);
      // tinted band
      g.save();
      glassPath();
      g.clip();
      g.fillStyle = 'rgba(95, 183, 146, 0.22)';
      g.fillRect(x - tx - 4, yLo, tx * 2 + 8, yHi - yLo);
      g.restore();
      // band edge lines + "fill to here" label
      g.strokeStyle = P.mintDeep; g.lineWidth = 3; g.setLineDash([8, 6]);
      g.beginPath(); g.moveTo(x - CUP.halfW - 6, yLo); g.lineTo(x + CUP.halfW + 6, yLo); g.stroke();
      g.beginPath(); g.moveTo(x - this.halfWAt(this.bandLo) - 6, yHi); g.lineTo(x + this.halfWAt(this.bandLo) + 6, yHi); g.stroke();
      g.setLineDash([]);
      // little flag label on the right of the band
      const midY = (yLo + yHi) / 2;
      D.rr(g, x + CUP.halfW + 8, midY - 16, 116, 32, 9, '#eafaf2', P.mintDeep, 2.5);
      D.text(g, 'fill here', x + CUP.halfW + 66, midY + 1, { size: 16, color: '#2e8f68', weight: 800 });

      // ----- glass outline & shine on top -----
      glassPath();
      g.strokeStyle = 'rgba(150,170,200,0.9)'; g.lineWidth = 4; g.stroke();
      // rim
      D.ellipse(g, x, top, tx, 9, 'rgba(255,255,255,0.6)', 'rgba(150,170,200,0.9)', 3);
      // vertical shine streak
      g.fillStyle = 'rgba(255,255,255,0.4)';
      g.beginPath();
      g.moveTo(x - tx + 16, top + 12);
      g.lineTo(x - tx + 26, top + 12);
      g.lineTo(x - bx + 22, bot - 12);
      g.lineTo(x - bx + 14, bot - 12);
      g.closePath();
      g.fill();
    },

    /* ----- the pouring stream from spout to liquid ----- */
    drawStream(g) {
      const x = CUP.cx;
      const surfaceY = this.levelY(Math.min(this.level, 1));
      const w = 12;
      // gradient stream
      const sg = g.createLinearGradient(0, SPOUT_Y, 0, surfaceY);
      sg.addColorStop(0, this.drink.foam);
      sg.addColorStop(1, this.drink.fill);
      g.fillStyle = sg;
      g.beginPath();
      // slight wobble in the stream for life
      for (let yy = SPOUT_Y; yy <= surfaceY; yy += 8) {
        const wob = Math.sin(yy * 0.08 + this.streamWobble) * 2;
        g.lineTo(x - w / 2 + wob, yy);
      }
      for (let yy = surfaceY; yy >= SPOUT_Y; yy -= 8) {
        const wob = Math.sin(yy * 0.08 + this.streamWobble) * 2;
        g.lineTo(x + w / 2 + wob, yy);
      }
      g.closePath();
      g.fill();
      // little ripple at the surface
      D.ellipse(g, x, surfaceY, 16, 5, 'rgba(255,255,255,0.45)');
    },

    /* ----- host: Hello Kitty at the counter in an apron ----- */
    drawHost(g) {
      const t = CM.time;
      const happy = this.hostHappy > 0 || this.state === 'alldone' || this.state === 'done';
      const bob = happy ? (t * 2.6) % 1 : ((t * 1.2) % 1) * 0.4;
      // a little apron behind the friend (a pastel triangle/bib)
      g.save();
      g.fillStyle = '#ffd1e3';
      D.rr(g, HK.x - 30, HK.y - 58, 60, 56, 14, '#ffd1e3', '#f0b9d2', 2);
      D.rr(g, HK.x - 10, HK.y - 78, 20, 24, 8, '#ffd1e3', '#f0b9d2', 2);
      D.heart(g, HK.x, HK.y - 34, 16, '#ffffff');
      g.restore();
      CM.drawFriend(g, 'hellokitty', HK.x, HK.y, 1.05, { bob: bob });
      D.rr(g, HK.x - 52, HK.y + 6, 104, 22, 11, 'rgba(255,255,255,0.85)');
      D.text(g, 'Hello Kitty', HK.x, HK.y + 17, { size: 15, color: P.pinkDeep, weight: 800 });

      // speech bubble
      if (this.hostBubble.t > 0 && this.state !== 'howto') {
        const txt = this.hostBubble.text;
        const cw = Math.max(130, txt.length * 10 + 28);
        const bx = CM.clamp(HK.x - cw + 40, 8, CM.W - cw - 8);
        D.bubble(g, bx, HK.y - 150, cw, 44, HK.x - 10);
        D.text(g, txt, bx + cw / 2, HK.y - 128, { size: 17, weight: 800, color: P.pinkDeep });
      }
    },

    drawParts(g) {
      for (const p of this.parts) {
        g.globalAlpha = CM.clamp(p.life / p.maxLife, 0, 1);
        if (p.kind === 'spark') D.star(g, p.x, p.y, p.size, p.color || P.yellowDeep);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, P.pink);
        else if (p.kind === 'drop') D.circle(g, p.x, p.y, p.size, p.color);
        else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, { size: 24, color: p.color || '#c98a1f', weight: 800, stroke: '#ffffff', strokeWidth: 5 });
        }
      }
      g.globalAlpha = 1;
    },

    /* ----- HUD ----- */
    drawHud(g) {
      if (this.state === 'howto') return;
      // score, top-left under the cafe sign
      D.rr(g, 40, 100, 168, 44, 20, 'rgba(255,255,255,0.92)', '#f0b9d2', 2);
      D.star(g, 62, 122, 12, P.yellowDeep);
      D.text(g, String(this.score), 136, 122, { size: 22, color: '#c98a1f', weight: 800 });

      // cup progress pips, top-centre (clear of reserved corner)
      const n = TOTAL_CUPS;
      const pw = 18, pgap = 9, tw = n * pw + (n - 1) * pgap;
      const sx = (CM.W - tw) / 2;
      for (let i = 0; i < n; i++) {
        const done = i < this.cupIdx;
        const cur = i === this.cupIdx && this.state !== 'alldone' && this.state !== 'done';
        D.circle(g, sx + i * (pw + pgap) + pw / 2, 30, 7,
          done ? P.mintDeep : (cur ? P.yellow : 'rgba(255,255,255,0.85)'),
          '#f0b9d2', 2);
      }
      D.text(g, 'Cups served', CM.W / 2, 52, { size: 14, color: '#9a7a86', weight: 700 });

      // pour hint while playing (early cups)
      if (this.state === 'pour' && this.cupIdx === 0) {
        const hint = CM.touchMode ? 'HOLD to pour — let go at the line!' : 'HOLD (tap / SPACE) to pour — let go at the line!';
        const pulse = 1 + Math.sin(CM.time * 5) * 0.04;
        D.rr(g, 230, 556, 500, 32, 16, 'rgba(255,255,255,0.82)');
        D.text(g, hint, 480, 572, { size: Math.round(15 * pulse), color: P.pinkDeep, weight: 800 });
      }
    },

    /* ----- result banner ----- */
    drawResultBanner(g) {
      let txt, col;
      if (this.resultKind === 'perfect') { txt = 'Just right! ⭐'; col = P.mintDeep; }
      else if (this.resultKind === 'spill') { txt = 'A little spill! 💦'; col = P.lavenderDeep; }
      else { txt = 'Served! Good try!'; col = P.pinkDeep; }
      const pop = 1 + 0.18 * Math.max(0, 1 - this.resultT * 3);
      D.text(g, txt, CUP.cx, 200, {
        size: Math.round(34 * pop), color: col, weight: 800, stroke: '#ffffff', strokeWidth: 9
      });
    },

    /* ----- end banner ----- */
    drawAllDone(g) {
      const t = CM.time;
      g.fillStyle = 'rgba(255,255,255,0.32)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.text(g, 'All served! 🥤', 480, 180, {
        size: 50, color: P.pinkDeep, weight: 800, stroke: '#ffffff', strokeWidth: 10
      });
      D.text(g, this.perfectCount + ' of ' + TOTAL_CUPS + ' poured just right!', 480, 244, {
        size: 26, color: P.mintDeep, weight: 800, stroke: '#fff', strokeWidth: 6
      });
      D.text(g, 'Score: ' + this.score, 480, 292, {
        size: 30, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6
      });
      D.star(g, 280, 175 + Math.sin(t * 5) * 6, 18, P.yellowDeep, t * 2);
      D.star(g, 680, 175 + Math.cos(t * 5) * 6, 18, P.yellowDeep, -t * 2);
    },

    /* ----- how to play ----- */
    drawHowto(g) {
      const t = CM.time;
      g.fillStyle = 'rgba(70,40,70,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 175, 90, 610, 404, { title: '🥤 Pour It! ☕' });
      CM.drawFriend(g, 'hellokitty', 280, 392, 1.3, { bob: ((t * 1.1) % 1) * 0.5 });
      D.text(g, 'Hello Kitty', 280, 416, { size: 14, color: P.pinkDeep, weight: 800 });

      D.text(g, 'Help serve yummy drinks!', 565, 158, { size: 24, color: P.ink, weight: 800 });
      D.text(g, 'HOLD to pour — the drink', 565, 208, { size: 18, color: P.ink });
      D.text(g, 'rises up the cup.', 565, 232, { size: 18, color: P.ink });
      D.text(g, 'LET GO at the green line! 🟢', 565, 274, { size: 18, color: P.mintDeep, weight: 800 });
      D.text(g, 'Land in the band = Just right!', 565, 312, { size: 17, color: P.pinkDeep, weight: 800 });
      D.text(g, 'A spill is just silly — keep going!', 565, 348, { size: 14, color: '#9a8a94' });

      if (CM.ui.button(g, 465, 400, 210, 58, '▶ Start!', { color: P.mintDeep, size: 24 })) {
        this.startPlay();
      }
    }
  });
})();
