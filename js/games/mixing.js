/* Cinnamoroll Mansion — Mix It Up (hosted by My Melody) */
(function () {
  'use strict';

  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ============================================================
     HOLD-to-stir cooking game.
     A big mixing bowl of lumpy batter sits centre-screen. HOLD the
     mouse/finger DOWN anywhere over the bowl to stir: the whisk spins,
     the batter swirls & smooths, and a MIXED meter fills. Release to
     pause. When the meter is full the batter turns fluffy with sparkles
     + "Yum!", score goes up, and a NEW recipe bowl appears.
     ~4 bowls, then a short "All mixed!" beat -> finishGame.
     Plain hold fills the meter on its own; circular dragging adds a
     small flair bonus but is never required.
     ============================================================ */

  const BOWL = { x: 480, y: 360, r: 150 };  // bowl centre + batter radius
  const NUM_BOWLS = 4;
  const FILL_RATE = 0.40;     // meter fraction filled per second of plain stirring
  const FLAIR_BOOST = 0.22;   // extra fill/sec while making nice circular motions
  const MAX_PARTS = 80;

  const MELODY = { x: 130, y: 480 }; // host, lower-left in her apron

  // Recipes: each bowl is a different batter colour / treat.
  const RECIPES = [
    { name: 'Cupcakes', batter: '#ffd9b0', smooth: '#ffe8cf', deep: '#f0b97a', icon: 'cupcake' },
    { name: 'Pancakes', batter: '#ffe6a8', smooth: '#fff2cf', deep: '#f2c95c', icon: 'pancake' },
    { name: 'Cookies',  batter: '#e7c79a', smooth: '#f3ddb8', deep: '#c99a5e', icon: 'cookie' },
    { name: 'Berry Cake', batter: '#f3b8d2', smooth: '#ffd6e8', deep: '#e487b0', icon: 'cake' }
  ];

  function pointInBowl(mx, my) {
    // a generous oval over the bowl so taps anywhere "on the bowl" count
    const dx = (mx - BOWL.x) / (BOWL.r + 36);
    const dy = (my - BOWL.y) / (BOWL.r + 18);
    return dx * dx + dy * dy <= 1;
  }

  CM.registerGame({
    id: 'mixing',
    name: 'Mix It Up',

    /* ---------------- lifecycle ---------------- */
    enter() {
      this.state = 'howto';     // howto -> play -> finale -> done (-> finish once)
      this.score = 0;
      this.finished = false;

      this.bowlIdx = 0;
      this.mix = 0;             // current bowl's MIXED meter, 0..1
      this.whiskAng = 0;        // whisk rotation
      this.whiskSpin = 0;       // current spin speed (eased toward target)
      this.stirring = false;    // holding down over the bowl this frame
      this.bowlTime = 0;        // seconds spent on the current bowl (for speed bonus)
      this.lumps = [];          // little lumps that smooth away as we mix
      this.swirl = 0;           // batter swirl phase

      // flair: reward gentle circular motion (never required)
      this.flair = 0;           // 0..1 smoothed "are they swirling" amount
      this.lastAng = null;      // last finger angle around bowl centre

      // per-bowl celebration beat
      this.popT = 0;            // time since this bowl was completed
      this.completing = false;  // showing the "smooth & fluffy" pop for the current bowl

      this.parts = [];
      this.shake = 0;
      this.bubble = '';
      this.bubbleT = 0;
      this.melodyHappy = 0;

      this.finaleT = 0;
      this.doneT = 0;

      this.setupBowl();
    },

    exit() {},

    /* ---------------- new bowl setup ---------------- */
    setupBowl() {
      this.mix = 0;
      this.whiskAng = 0;
      this.whiskSpin = 0;
      this.bowlTime = 0;
      this.swirl = 0;
      this.flair = 0;
      this.lastAng = null;
      this.popT = 0;
      this.completing = false;
      // scatter a few lumps inside the batter; they fade as the meter fills
      this.lumps = [];
      for (let i = 0; i < 7; i++) {
        const a = CM.rand(0, Math.PI * 2);
        const d = CM.rand(0, BOWL.r * 0.62);
        this.lumps.push({
          x: Math.cos(a) * d,
          y: Math.sin(a) * d * 0.7,
          r: CM.rand(10, 20),
          ph: CM.rand(0, 6.28)
        });
      }
    },

    recipe() { return RECIPES[Math.min(this.bowlIdx, RECIPES.length - 1)]; },

    /* ---------------- particles / juice ---------------- */
    addPart(p) { if (this.parts.length < MAX_PARTS) { p.maxLife = p.life; this.parts.push(p); } },

    sparkleBurst(cx, cy, color, big) {
      const n = big ? 18 : 9;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2 + CM.rand(-0.2, 0.2);
        this.addPart({
          kind: Math.random() < 0.6 ? 'star' : 'heart',
          x: cx, y: cy,
          vx: Math.cos(a) * CM.rand(70, big ? 200 : 130),
          vy: Math.sin(a) * CM.rand(70, big ? 200 : 130) - 50,
          life: CM.rand(0.6, 1.15), size: CM.rand(7, big ? 14 : 11),
          color: color, rot: CM.rand(0, 6), vr: CM.rand(-5, 5)
        });
      }
    },

    splat(cx, cy, color) {
      // a couple of little batter flecks while stirring
      for (let i = 0; i < 2; i++) {
        const a = -Math.PI * (0.15 + Math.random() * 0.7);
        this.addPart({
          kind: 'drop', x: cx + CM.rand(-30, 30), y: cy + CM.rand(-14, 6),
          vx: Math.cos(a) * CM.rand(20, 80), vy: Math.sin(a) * CM.rand(40, 120),
          life: CM.rand(0.3, 0.6), size: CM.rand(3, 6), color: color
        });
      }
    },

    floatText(x, y, str, color) {
      this.addPart({ kind: 'txt', x: x, y: y, str: str, color: color, vx: 0, vy: -42, life: 1.2 });
    },

    confetti() {
      if (this.parts.length > MAX_PARTS - 6) return;
      this.addPart({
        kind: 'star', x: CM.rand(120, 840), y: CM.rand(110, 300),
        vx: CM.rand(-40, 40), vy: CM.rand(-70, -20),
        life: CM.rand(0.7, 1.2), size: CM.rand(7, 13),
        color: CM.pick([P.pink, P.pinkDeep, P.yellowDeep, P.mintDeep, P.lavenderDeep, P.blueDeep]),
        rot: CM.rand(0, 6), vr: CM.rand(-5, 5)
      });
    },

    tickParts(dt) {
      for (let i = this.parts.length - 1; i >= 0; i--) {
        const p = this.parts[i];
        p.life -= dt;
        if (p.life <= 0) { this.parts.splice(i, 1); continue; }
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        if (p.kind === 'star' || p.kind === 'heart') { p.vy += 230 * dt; p.rot += (p.vr || 0) * dt; }
        else if (p.kind === 'drop') p.vy += 360 * dt;
      }
    },

    say(text, t) {
      this.bubble = text;
      this.bubbleT = t;
      this.melodyHappy = Math.max(this.melodyHappy, 1.0);
    },

    /* ---------------- update ---------------- */
    update(dt) {
      if (this.shake > 0) this.shake = Math.max(0, this.shake - dt * 14);
      if (this.bubbleT > 0) this.bubbleT -= dt;
      this.melodyHappy = Math.max(0, this.melodyHappy - dt);
      this.swirl += (this.whiskSpin * 0.5 + 0.6) * dt;
      this.tickParts(dt);

      switch (this.state) {
        case 'howto':
          if (CM.input.pressed('action')) this.startPlay();
          break;

        case 'play':
          this.updatePlay(dt);
          break;

        case 'finale':
          this.finaleT += dt;
          if (Math.random() < 0.5) this.confetti();
          // whisk eases to a stop
          this.whiskSpin = Math.max(0, this.whiskSpin - dt * 6);
          this.whiskAng += this.whiskSpin * dt;
          if (this.finaleT >= 2.2) {
            this.state = 'done';
            this.doneT = 1.8;
          }
          break;

        case 'done':
          if (Math.random() < 0.4) this.confetti();
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('mixing', this.score, CM.clamp(Math.ceil(this.score / 18), 5, 30));
          }
          break;
      }
    },

    updatePlay(dt) {
      const m = CM.input.mouse;

      // showing the per-bowl "fluffy!" pop, then bring in the next bowl
      if (this.completing) {
        this.popT += dt;
        this.whiskSpin = Math.max(0, this.whiskSpin - dt * 5);
        this.whiskAng += this.whiskSpin * dt;
        if (this.popT >= 1.4) {
          this.bowlIdx++;
          if (this.bowlIdx >= NUM_BOWLS) {
            this.state = 'finale';
            this.finaleT = 0;
            this.shake = 8;
            CM.audio.play('tada');
            for (let i = 0; i < 14; i++) this.confetti();
            this.say('All mixed! Yay! 🎉', 3);
          } else {
            this.setupBowl();
            CM.audio.play('whoosh');
            this.say(CM.pick(['New bowl!', 'Next treat!', 'Let\'s stir!']), 1.4);
          }
        }
        return;
      }

      this.bowlTime += dt;

      // HOLD anywhere over the bowl to stir
      this.stirring = m.down && pointInBowl(m.x, m.y);

      // detect gentle circular motion for a flair boost (optional charm)
      let flairTick = false;
      if (this.stirring) {
        const ang = Math.atan2(m.y - BOWL.y, m.x - BOWL.x);
        if (this.lastAng !== null) {
          let da = ang - this.lastAng;
          while (da > Math.PI) da -= Math.PI * 2;
          while (da < -Math.PI) da += Math.PI * 2;
          if (Math.abs(da) > 0.04) flairTick = true; // they're moving around the bowl
        }
        this.lastAng = ang;
      } else {
        this.lastAng = null;
      }
      // ease flair up while swirling, down otherwise
      this.flair += ((flairTick ? 1 : 0) - this.flair) * Math.min(1, dt * 4);

      // spin the whisk: fast while stirring, eases down when paused
      const targetSpin = this.stirring ? (9 + this.flair * 5) : 0;
      this.whiskSpin += (targetSpin - this.whiskSpin) * Math.min(1, dt * 8);
      this.whiskAng += this.whiskSpin * dt;

      if (this.stirring) {
        // plain hold fills on its own; flair adds a little extra
        const rate = FILL_RATE + this.flair * FLAIR_BOOST;
        const before = this.mix;
        this.mix = Math.min(1, this.mix + rate * dt);

        // gradually smooth the lumps as we approach full
        for (const lp of this.lumps) {
          lp.r = Math.max(0, lp.r - rate * 26 * dt);
        }

        // occasional batter flecks + soft "stir" sound
        const rec = this.recipe();
        if (Math.random() < dt * 7) this.splat(BOWL.x, BOWL.y - 20, rec.deep);
        if (Math.random() < dt * 4) CM.audio.tone(180 + this.mix * 120, 0.06, 'sine', 0.05);

        // little milestone dings at quarters
        const milestone = (frac) => before < frac && this.mix >= frac;
        if (milestone(0.5)) { CM.audio.play('pop'); }
        if (milestone(0.75)) { CM.audio.play('pop'); }

        if (this.mix >= 1 && before < 1) this.completeBowl();
      }
    },

    completeBowl() {
      this.completing = true;
      this.popT = 0;
      this.shake = 6;

      // points: base per bowl + speed bonus (faster = more, gently capped)
      const base = 70;
      const speedBonus = Math.round(CM.clamp(40 - this.bowlTime * 6, 0, 40));
      const flairBonus = Math.round(this.flair * 14);
      const gained = base + speedBonus + flairBonus;
      this.score += gained;

      const rec = this.recipe();
      CM.audio.play('ding');
      CM.audio.play('cheer');
      this.sparkleBurst(BOWL.x, BOWL.y - 30, P.yellowDeep, true);
      this.floatText(BOWL.x, BOWL.y - 120, 'Yum! +' + gained, P.pinkDeep);
      this.say(CM.pick(['Yum! So fluffy!', 'Perfectly mixed!', 'Mmm, delicious!', 'Smooth & yummy!']), 1.8);
    },

    startPlay() {
      this.state = 'play';
      this.say('Hold to stir!', 1.6);
    },

    /* ============================================================
       DRAW
       ============================================================ */
    draw(g) {
      g.save();
      if (this.shake > 0.2) {
        g.translate(CM.rand(-this.shake, this.shake) * 0.7, CM.rand(-this.shake, this.shake) * 0.7);
      }

      this.drawKitchen(g);

      // My Melody, the chef helper, lower-left in an apron
      const happy = this.melodyHappy > 0 || this.completing || this.state === 'finale';
      this.drawMelodyChef(g, happy);

      if (this.state !== 'howto') {
        this.drawBowl(g);
        this.drawParts(g);
      }

      g.restore(); // end shake

      // speech bubble (not shaken)
      if (this.bubbleT > 0 && this.state !== 'howto') {
        const txt = this.bubble;
        const cw = Math.max(130, txt.length * 10 + 28);
        const bx = CM.clamp(MELODY.x - 6, 8, CM.W - cw - 8);
        D.bubble(g, bx, MELODY.y - 168, cw, 44, MELODY.x + 24);
        D.text(g, txt, bx + cw / 2, MELODY.y - 146, { size: 17, weight: 800, color: P.pinkDeep });
      }

      // HUD
      if (this.state !== 'howto') this.drawHud(g);

      // overlays
      if (this.state === 'finale' || this.state === 'done') this.drawFinale(g);
      if (this.state === 'howto') this.drawHowto(g);
    },

    /* ---------------- kitchen backdrop ---------------- */
    drawKitchen(g) {
      // soft pastel cafe wall
      const wg = g.createLinearGradient(0, 0, 0, CM.H);
      wg.addColorStop(0, '#fff0f6');
      wg.addColorStop(1, '#ffe4ef');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, CM.H);

      // polka-dot wallpaper (cheap, cute)
      g.fillStyle = 'rgba(255,255,255,0.5)';
      for (let yy = 40; yy < 430; yy += 60) {
        for (let xx = 30 + ((yy / 60) % 2) * 30; xx < CM.W; xx += 60) {
          g.beginPath();
          g.arc(xx, yy, 6, 0, Math.PI * 2);
          g.fill();
        }
      }

      // bunting along the top
      const cols = [P.pink, P.blue, P.yellow, P.mint, P.lavender];
      for (let i = 0; i * 60 < CM.W; i++) {
        g.fillStyle = cols[i % cols.length];
        g.beginPath();
        g.moveTo(i * 60, 0);
        g.lineTo(i * 60 + 60, 0);
        g.lineTo(i * 60 + 30, 26);
        g.closePath();
        g.fill();
      }

      // wooden counter band
      const cy = 470;
      g.fillStyle = P.wood || '#e6c79a';
      g.fillRect(0, cy, CM.W, CM.H - cy);
      g.fillStyle = 'rgba(255,255,255,0.35)';
      g.fillRect(0, cy, CM.W, 6);
      g.strokeStyle = 'rgba(140,100,60,0.25)';
      g.lineWidth = 2;
      for (let xx = 40; xx < CM.W; xx += 120) {
        g.beginPath();
        g.moveTo(xx, cy + 8);
        g.lineTo(xx, CM.H);
        g.stroke();
      }

      // a little shelf with ingredient jars on the right
      this.drawShelf(g, 730, 120);
    },

    drawShelf(g, x, y) {
      D.rr(g, x - 10, y + 64, 220, 12, 4, '#d9a86a', '#b5824a', 2);
      // a few cute jars/eggs
      D.rr(g, x + 6, y + 18, 40, 46, 8, '#cfeffd', '#a9def6', 2);   // milk jar
      D.rr(g, x + 12, y + 8, 28, 14, 5, '#ffffff', '#dcdce6', 2);   // lid
      D.ellipse(g, x + 72, y + 44, 18, 22, '#fff7e6', '#f0dcb0', 2); // egg
      D.ellipse(g, x + 100, y + 48, 15, 19, '#fff7e6', '#f0dcb0', 2);
      D.rr(g, x + 130, y + 20, 38, 44, 8, '#ffe2ef', '#f4b9d2', 2); // sugar jar
      D.text(g, '🌸', x + 149, y + 44, { size: 18 });
      D.rr(g, x + 178, y + 24, 26, 40, 7, '#fff0c2', '#f2d77a', 2); // flour-ish
    },

    /* ---------------- My Melody as chef ---------------- */
    drawMelodyChef(g, happy) {
      const t = CM.time;
      const bob = happy ? (t * 2.6) % 1 : ((t * 1.2) % 1) * 0.4;
      // a little apron behind her (drawn at feet area)
      const ax = MELODY.x, ay = MELODY.y;
      // apron skirt
      g.save();
      g.translate(0, -Math.abs(Math.sin(bob * Math.PI * 2)) * 5);
      D.rr(g, ax - 26, ay - 58, 52, 50, 12, '#ffffff', '#f4b9d2', 3);
      D.rr(g, ax - 18, ay - 60, 36, 10, 5, '#ffe2ef', '#f4b9d2', 2); // apron bib
      D.heart(g, ax, ay - 36, 16, P.pink);
      g.restore();

      CM.drawFriend(g, 'mymelody', MELODY.x, MELODY.y, 1.25, { bob: bob });

      // little chef's hat
      g.save();
      g.translate(0, -Math.abs(Math.sin(bob * Math.PI * 2)) * 5);
      D.ellipse(g, MELODY.x, MELODY.y - 96, 22, 12, '#ffffff', '#eaeaf0', 2);
      D.circle(g, MELODY.x - 10, MELODY.y - 104, 11, '#ffffff', '#eaeaf0', 2);
      D.circle(g, MELODY.x + 10, MELODY.y - 104, 11, '#ffffff', '#eaeaf0', 2);
      D.circle(g, MELODY.x, MELODY.y - 108, 13, '#ffffff', '#eaeaf0', 2);
      g.restore();

      // name tag
      D.rr(g, MELODY.x - 50, MELODY.y + 6, 100, 22, 11, 'rgba(255,255,255,0.88)');
      D.text(g, 'My Melody', MELODY.x, MELODY.y + 17, { size: 14, color: P.pinkDeep, weight: 800 });
    },

    /* ---------------- the mixing bowl ---------------- */
    drawBowl(g) {
      const rec = this.recipe();
      const bx = BOWL.x, by = BOWL.y, r = BOWL.r;

      // ground shadow
      D.shadow(g, bx, by + r * 0.78, r * 0.9);

      // bowl back rim (behind batter)
      D.ellipse(g, bx, by - r * 0.62, r + 14, (r + 14) * 0.42, '#ffe9f1', '#f0b9d2', 4);

      // batter — colour lerps from lumpy to smooth as the meter fills
      const batterCol = this.mixColor(rec.batter, rec.smooth, this.mix);
      g.save();
      // clip to the batter oval so swirl/lumps stay inside
      g.beginPath();
      g.ellipse(bx, by - r * 0.58, r, r * 0.40, 0, 0, Math.PI * 2);
      g.clip();

      g.fillStyle = batterCol;
      g.fillRect(bx - r - 20, by - r - 20, (r + 20) * 2, r + 40);

      // swirl arms (more visible while stirring) — a sweeping smooth look
      g.globalAlpha = 0.35 + this.mix * 0.25;
      g.strokeStyle = 'rgba(255,255,255,0.55)';
      g.lineWidth = 6;
      g.lineCap = 'round';
      for (let a = 0; a < 3; a++) {
        const base = this.swirl + a * (Math.PI * 2 / 3);
        g.beginPath();
        for (let k = 0; k <= 16; k++) {
          const tt = k / 16;
          const rad = tt * r * 0.9;
          const ang = base + tt * 3.4;
          const px = bx + Math.cos(ang) * rad;
          const py = (by - r * 0.58) + Math.sin(ang) * rad * 0.40;
          if (k === 0) g.moveTo(px, py); else g.lineTo(px, py);
        }
        g.stroke();
      }
      g.globalAlpha = 1;

      // lumps (fade as they smooth)
      for (const lp of this.lumps) {
        if (lp.r <= 0.5) continue;
        const wob = Math.sin(CM.time * 3 + lp.ph) * 2;
        D.circle(g, bx + lp.x + wob, (by - r * 0.58) + lp.y * 0.6, lp.r, rec.deep);
      }

      // fluffy peaks when nearly done
      if (this.mix > 0.7) {
        g.globalAlpha = (this.mix - 0.7) / 0.3;
        for (let i = 0; i < 6; i++) {
          const ang = i / 6 * Math.PI * 2 + this.swirl * 0.3;
          const px = bx + Math.cos(ang) * r * 0.5;
          const py = (by - r * 0.58) + Math.sin(ang) * r * 0.5 * 0.40;
          D.circle(g, px, py, 12, 'rgba(255,255,255,0.6)');
        }
        g.globalAlpha = 1;
      }
      g.restore();

      // bowl front (a ceramic bowl in front of the batter)
      g.save();
      g.beginPath();
      g.moveTo(bx - r - 14, by - r * 0.58);
      g.bezierCurveTo(bx - r - 14, by + r * 0.7, bx + r + 14, by + r * 0.7, bx + r + 14, by - r * 0.58);
      g.closePath();
      const bg = g.createLinearGradient(0, by - r * 0.5, 0, by + r * 0.7);
      bg.addColorStop(0, '#ffffff');
      bg.addColorStop(1, '#ffd9ea');
      g.fillStyle = bg;
      g.fill();
      g.strokeStyle = '#f0b9d2';
      g.lineWidth = 5;
      g.stroke();
      g.restore();

      // front rim highlight
      D.ellipse(g, bx, by - r * 0.58, r + 14, (r + 14) * 0.42, null, 'rgba(255,255,255,0.7)', 3);
      // cute stripe + heart on the bowl
      D.rr(g, bx - 70, by + r * 0.18, 140, 14, 7, '#ffe2ef');
      D.heart(g, bx, by + r * 0.30, 22, P.pink);

      // the whisk (spins while stirring)
      this.drawWhisk(g, bx, by - r * 0.58);

      // "hold to stir" hint pulses on the first bowl until they start filling
      if (this.bowlIdx === 0 && this.mix < 0.06 && !this.completing) {
        const pulse = 1 + Math.sin(CM.time * 5) * 0.05;
        const txt = CM.touchMode ? 'HOLD on the bowl to stir!' : 'HOLD / press to stir!';
        D.rr(g, bx - 175, by + r * 0.78, 350, 34, 17, 'rgba(255,255,255,0.85)');
        D.text(g, txt, bx, by + r * 0.78 + 17, { size: Math.round(18 * pulse), color: P.pinkDeep, weight: 800 });
      }
    },

    drawWhisk(g, cx, topY) {
      // whisk handle rising up out of the bowl, head dipped into batter
      const headY = topY + 18;
      const sway = Math.sin(this.whiskAng) * 6;
      g.save();
      // handle
      g.strokeStyle = '#c7cdd6';
      g.lineWidth = 11;
      g.lineCap = 'round';
      g.beginPath();
      g.moveTo(cx + sway, topY - 110);
      g.lineTo(cx + sway * 0.4, headY);
      g.stroke();
      // handle grip
      D.rr(g, cx + sway - 8, topY - 132, 16, 30, 8, P.pink, P.pinkDeep, 2);

      // whisk head — wire loops that rotate (perspective via x-squash by cos)
      g.translate(cx + sway * 0.4, headY);
      g.strokeStyle = '#aeb4be';
      g.lineWidth = 3.5;
      for (let i = 0; i < 4; i++) {
        const a = this.whiskAng + i * (Math.PI / 4);
        const sx = Math.cos(a);          // -1..1 squash
        g.save();
        g.scale(sx < 0 ? Math.max(-1, sx) : Math.max(0.12, sx), 1);
        g.beginPath();
        // a vertical loop
        g.ellipse(0, 14, 11, 26, 0, 0, Math.PI * 2);
        g.stroke();
        g.restore();
      }
      // collar where loops meet handle
      D.circle(g, 0, -2, 6, '#c7cdd6', '#9aa0ab', 2);
      g.restore();
    },

    // simple hex lerp for batter colour
    mixColor(a, b, t) {
      t = CM.clamp(t, 0, 1);
      const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16);
      const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255;
      const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255;
      const r = Math.round(ar + (br - ar) * t);
      const gg = Math.round(ag + (bg - ag) * t);
      const bl = Math.round(ab + (bb - ab) * t);
      return 'rgb(' + r + ',' + gg + ',' + bl + ')';
    },

    /* ---------------- particles ---------------- */
    drawParts(g) {
      for (const p of this.parts) {
        g.globalAlpha = CM.clamp(p.life / p.maxLife, 0, 1);
        if (p.kind === 'star') D.star(g, p.x, p.y, p.size, p.color || P.yellowDeep, p.rot);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, p.color || P.pink);
        else if (p.kind === 'drop') D.circle(g, p.x, p.y, p.size, p.color);
        else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, { size: 26, color: p.color || P.pinkDeep, weight: 800, stroke: '#ffffff', strokeWidth: 6 });
        }
      }
      g.globalAlpha = 1;
    },

    /* ---------------- HUD ---------------- */
    drawHud(g) {
      const rec = this.recipe();

      // score, top-left
      D.rr(g, 14, 12, 168, 44, 20, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      D.star(g, 36, 34, 12, P.yellowDeep);
      D.text(g, String(this.score), 110, 34, { size: 22, color: '#c98a1f', weight: 800 });

      // recipe name + bowl pips, top-center
      const label = (this.state === 'finale' || this.state === 'done') ? 'All done!' : 'Now mixing: ' + rec.name;
      D.rr(g, 300, 14, 360, 40, 18, 'rgba(255,255,255,0.9)', '#f0b9d2', 2);
      D.text(g, label, 480, 34, { size: 20, color: P.pinkDeep, weight: 800 });

      // bowl progress pips just under the recipe banner
      const n = NUM_BOWLS, pw = 16, pgap = 10, tw = n * pw + (n - 1) * pgap;
      const sx = 480 - tw / 2;
      for (let i = 0; i < n; i++) {
        const done = i < this.bowlIdx || (i === this.bowlIdx && this.completing);
        const cur = i === this.bowlIdx && !this.completing && this.state === 'play';
        D.circle(g, sx + i * (pw + pgap) + pw / 2, 70, 7,
          done ? P.mintDeep : (cur ? P.yellow : 'rgba(255,255,255,0.85)'), '#f0b9d2', 2);
      }

      // MIXED meter on the right
      if (this.state === 'play') {
        const mx = 778, my = 470, mw = 150, mh = 26;
        D.text(g, 'MIXED', mx + mw / 2, my - 16, { size: 16, color: P.pinkDeep, weight: 800 });
        D.rr(g, mx, my, mw, mh, 13, 'rgba(255,255,255,0.9)', '#f0b9d2', 3);
        const fillC = this.mix >= 1 ? P.mintDeep : P.pink;
        D.rr(g, mx + 4, my + 4, (mw - 8) * this.mix, mh - 8, 9, fillC);
        if (this.flair > 0.15) {
          D.text(g, '✨ swirl!', mx + mw / 2, my + mh + 16, { size: 14, color: P.lavenderDeep, weight: 800 });
        }
      }
    },

    /* ---------------- overlays ---------------- */
    drawFinale(g) {
      const t = CM.time;
      g.fillStyle = 'rgba(255,255,255,0.32)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.text(g, 'All mixed! 🧁', 480, 190, {
        size: 52, color: P.pinkDeep, weight: 800, stroke: '#ffffff', strokeWidth: 10
      });
      D.text(g, 'You whisked ' + NUM_BOWLS + ' yummy treats!', 480, 252, {
        size: 24, color: P.ink, weight: 800, stroke: '#fff', strokeWidth: 6
      });
      D.text(g, 'Score: ' + this.score, 480, 300, {
        size: 30, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6
      });
      D.star(g, 290, 185 + Math.sin(t * 5) * 6, 18, P.yellowDeep, t * 2);
      D.star(g, 670, 185 + Math.cos(t * 5) * 6, 18, P.yellowDeep, -t * 2);
    },

    drawHowto(g) {
      const t = CM.time;
      g.fillStyle = 'rgba(70,40,70,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 175, 92, 610, 400, { title: '🥄 Mix It Up 🧁' });

      CM.drawFriend(g, 'mymelody', 282, 392, 1.35, { bob: ((t * 1.1) % 1) * 0.5 });
      D.text(g, 'My Melody', 282, 416, { size: 15, color: P.pinkDeep, weight: 800 });

      D.text(g, 'Let\'s bake some treats!', 565, 158, { size: 26, color: P.ink, weight: 800 });
      D.text(g, 'HOLD your finger on the bowl', 565, 210, { size: 18, color: P.ink });
      D.text(g, 'to stir the lumpy batter smooth.', 565, 236, { size: 18, color: P.ink });
      D.text(g, 'Fill the MIXED meter to finish!', 565, 282, { size: 18, color: P.pinkDeep, weight: 800 });
      D.text(g, 'Swirl in circles for extra sparkle ✨', 565, 318, { size: 15, color: P.lavenderDeep, weight: 700 });
      D.text(g, 'Mix 4 bowls — you can\'t lose!', 565, 352, { size: 14, color: '#9a8a94' });

      if (CM.ui.button(g, 465, 402, 210, 58, '▶ Start!', { color: P.mintDeep, size: 24 })) {
        this.startPlay();
      }
    }
  });
})();
