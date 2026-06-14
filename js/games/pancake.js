/* Cinnamoroll Mansion — Flip 'Em! (hosted by Pompompurin) */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const P = CM.palette;

  /* ----------------------------------------------------------
     Cute "Cooking Mama"-style pancake griddle.
     Up to 3 pancakes cook in fixed slots. Each pancake's
     "cook" value rises over time. When it's in the GOLDEN
     window, TAP it to flip. Flip BOTH sides -> served onto
     the plate (+points). A golden flip is perfect (+bonus).
     Flipping raw, or letting it go dark, is GENTLE — fewer
     points, never a game-over. A friendly ~55s timer ends it.
     ---------------------------------------------------------- */

  const GAME_TIME = 55;          // friendly session length (seconds)
  const SLOTS = [                // griddle slot centres
    { x: 300, y: 330 },
    { x: 480, y: 360 },
    { x: 660, y: 330 }
  ];
  const PAN_R = 56;              // pancake radius (tap target)
  const COOK_RATE = 0.62;       // doneness units/sec while cooking (1.0 = top of bar)
  // Doneness windows (0..1 along the bar):
  const RAW_END = 0.40;          // below this = raw (flip = floppy, fewer pts)
  const GOLD_START = 0.46;       // golden window start
  const GOLD_END = 0.74;         // golden window end (the "just right" zone)
  // above GOLD_END = getting dark (still flips/serves, just funnier & fewer pts)

  const MAX_PARTS = 90;

  const PURIN = { x: 820, y: 470 }; // host chef, lower-right by the griddle

  // pancake fill colour by doneness (raw batter -> golden -> toasty)
  function doneColor(d) {
    // d: 0..1+. blend pale batter -> golden -> brown
    let r, g, b;
    if (d < GOLD_START) {
      // pale batter to light gold
      const t = CM.clamp(d / GOLD_START, 0, 1);
      r = CM.lerp(245, 247, t); g = CM.lerp(228, 196, t); b = CM.lerp(168, 96, t);
    } else if (d < GOLD_END) {
      // light gold -> rich golden brown
      const t = (d - GOLD_START) / (GOLD_END - GOLD_START);
      r = CM.lerp(247, 214, t); g = CM.lerp(196, 150, t); b = CM.lerp(96, 70, t);
    } else {
      // golden -> toasty brown (caps so it stays cute, never black)
      const t = CM.clamp((d - GOLD_END) / 0.5, 0, 1);
      r = CM.lerp(214, 150, t); g = CM.lerp(150, 96, t); b = CM.lerp(70, 56, t);
    }
    return 'rgb(' + Math.round(r) + ',' + Math.round(g) + ',' + Math.round(b) + ')';
  }

  function isGolden(d) { return d >= GOLD_START && d <= GOLD_END; }

  function anyPress() {
    return CM.input.pressed('action') || CM.input.mouse.clicked;
  }

  CM.registerGame({
    id: 'pancake',
    name: "Flip 'Em!",

    /* ================= lifecycle ================= */
    enter() {
      this.state = 'howto';   // howto -> count -> cook -> orderup -> done (-> finish once)
      this.score = 0;
      this.finished = false;

      this.timeLeft = GAME_TIME;
      this.served = 0;        // pancakes finished
      this.perfects = 0;      // golden flips
      this.flips = 0;

      this.countT = 0;
      this.lastSeg = -1;
      this.orderT = 0;
      this.doneT = 0;

      this.parts = [];
      this.plate = [];        // little stack of served pancakes (visual)
      this.shake = 0;

      this.hostBubble = { text: '', t: 0 };
      this.hostHappy = 0;

      // create one fresh pancake per slot
      this.pans = [];
      for (let i = 0; i < SLOTS.length; i++) this.pans.push(this.makePancake(i));

      // a tiny drifting steam wisp set for ambiance
      this.steamT = 0;
    },

    exit() {},

    /* ================= a pancake ================= */
    makePancake(slot) {
      return {
        slot: slot,
        // start a touch raw so there's a moment before golden
        cook: CM.rand(0, 0.12),
        side: 0,           // 0 = first side cooking, 1 = second side cooking
        cookedSides: 0,    // how many sides are done
        flipping: 0,       // flip animation timer (0 = not flipping)
        flipDur: 0.42,
        wob: 0,            // gentle wobble when freshly placed / nudged
        bob: CM.rand(0, 6.28),
        serving: 0,        // serve animation timer (0 = on griddle)
        servedColor: null, // colour locked in at serve time
        gone: false        // removed (served), slot empty briefly
      };
    },

    /* ================= input ================= */
    handleTap() {
      const m = CM.input.mouse;
      // find a pancake under the tap (only ones still cooking, not mid-flip/serve)
      for (let i = 0; i < this.pans.length; i++) {
        const p = this.pans[i];
        if (p.gone || p.flipping > 0 || p.serving > 0) continue;
        const s = SLOTS[p.slot];
        if (CM.dist(m.x, m.y, s.x, s.y) <= PAN_R + 14) {
          this.flip(p);
          return;
        }
      }
    },

    flip(p) {
      // begin the flip arc; the result is judged when the flip lands
      p.flipping = p.flipDur;
      p.flipFrom = p.cook;
      p.flipGolden = isGolden(p.cook);
      this.flips++;
      CM.audio.play('whoosh');
      CM.audio.tone(p.flipGolden ? 660 : 480, 0.12, 'sine', 0.1, 0, p.flipGolden ? 880 : 560);
      const s = SLOTS[p.slot];
      this.sizzle(s.x, s.y, 4);
    },

    // called when a flip animation lands
    landFlip(p) {
      const s = SLOTS[p.slot];
      const wasGolden = p.flipGolden;
      const wasRaw = p.flipFrom < RAW_END;
      // this side is now considered cooked
      p.cookedSides++;
      CM.audio.play('pop');

      if (wasGolden) {
        this.perfects++;
        this.score += 8;
        this.shake = Math.max(this.shake, 3);
        this.burst(s.x, s.y - 8, P.yellowDeep, false);
        this.floatText(s.x, s.y - 50, 'Perfect!', '#e0a81f');
        if (Math.random() < 0.5) this.say(CM.pick(['Golden! Yay!', 'Perfect flip!', 'Just right!']), 1.2);
      } else if (wasRaw) {
        // floppy early flip — gentle, a couple points, funny
        this.score += 2;
        this.floatText(s.x, s.y - 50, 'Floppy!', P.lavenderDeep);
        if (Math.random() < 0.35) this.say(CM.pick(['A bit raw!', 'Whoops, floppy!']), 1.1);
      } else {
        // a touch dark — still fine, gentle
        this.score += 4;
        this.floatText(s.x, s.y - 50, 'Toasty!', '#b9831f');
      }

      if (p.cookedSides >= 2) {
        // both sides done -> serve it!
        this.serve(p);
      } else {
        // flip to the second side: reset the cook timer for this fresh side
        p.side = 1;
        p.cook = wasRaw ? CM.rand(0, 0.08) : CM.rand(0, 0.12);
        p.wob = 1;
      }
    },

    serve(p) {
      p.serving = 0.5;
      p.servedColor = doneColor(p.flipFrom);
      this.served++;
      // base points for serving + tidy bonus if it was golden-finished
      const golden = p.flipGolden;
      this.score += golden ? 14 : 9;
      this.shake = Math.max(this.shake, golden ? 5 : 3);
      const s = SLOTS[p.slot];
      CM.audio.play('ding');
      if (golden) CM.audio.play('cheer');
      this.burst(s.x, s.y - 8, golden ? P.yellowDeep : P.pink, golden);
      this.floatText(s.x, s.y - 64, golden ? 'Yum! +' + 14 : 'Yum! +' + 9, golden ? '#e0a81f' : P.pinkDeep);
      this.say(CM.pick(['Yum yum!', 'Order ready!', 'So tasty!', 'Pancake done!']), 1.3);
    },

    say(text, t) {
      this.hostBubble = { text: text, t: t };
      this.hostHappy = Math.max(this.hostHappy, 1.0);
    },

    beginCount() {
      this.state = 'count';
      this.countT = 0;
      this.lastSeg = -1;
      this.say('Let\'s flip pancakes!', 2.4);
    },

    /* ================= particles / juice ================= */
    addPart(p) { if (this.parts.length < MAX_PARTS) { p.maxLife = p.life; this.parts.push(p); } },

    sizzle(x, y, n) {
      for (let i = 0; i < n; i++) {
        this.addPart({
          kind: 'puff', x: x + CM.rand(-26, 26), y: y + CM.rand(-8, 8),
          vx: CM.rand(-24, 24), vy: CM.rand(-50, -18),
          life: CM.rand(0.3, 0.6), size: CM.rand(5, 10), color: 'rgba(255,255,255,0.8)'
        });
      }
    },

    burst(x, y, color, big) {
      const n = big ? 12 : 7;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * Math.PI * 2;
        this.addPart({
          kind: 'spark', x: x, y: y,
          vx: Math.cos(a) * CM.rand(70, big ? 180 : 120),
          vy: Math.sin(a) * CM.rand(70, big ? 180 : 120) - 40,
          life: CM.rand(0.45, 0.85), size: CM.rand(4, big ? 10 : 7),
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

    floatText(x, y, str, color) {
      this.addPart({ kind: 'txt', x: x, y: y, str: str, color: color, vx: 0, vy: -42, life: 1.1 });
    },

    confetti() {
      if (this.parts.length > MAX_PARTS - 6) return;
      this.addPart({
        kind: 'spark', x: CM.rand(120, 840), y: CM.rand(110, 320),
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
        else if (p.kind === 'puff') { p.vy -= 10 * dt; p.size += 9 * dt; }
      }
    },

    /* ================= update ================= */
    update(dt) {
      this.shake = Math.max(0, this.shake - dt * 16);
      if (this.hostBubble.t > 0) this.hostBubble.t -= dt;
      this.hostHappy = Math.max(0, this.hostHappy - dt);
      this.steamT += dt;
      this.tickParts(dt);

      switch (this.state) {
        case 'howto':
          if (anyPress()) this.beginCount();
          break;

        case 'count':
          this.countT += dt;
          this.tickPancakes(dt, false); // let them gently warm during the count-in
          {
            const seg = Math.floor(this.countT / 0.8);
            if (seg !== this.lastSeg && seg <= 3) {
              this.lastSeg = seg;
              if (seg < 3) CM.audio.tone(620 + seg * 90, 0.14, 'triangle', 0.12);
              else { CM.audio.play('ding'); CM.audio.tone(523, 0.18, 'square', 0.1); }
            }
            if (this.countT >= 3.4) this.state = 'cook';
          }
          break;

        case 'cook':
          this.updateCook(dt);
          break;

        case 'orderup':
          this.orderT += dt;
          this.tickPancakes(dt, true); // finish any in-flight flip/serve animations
          if (Math.random() < 0.5) this.confetti();
          if (this.orderT >= 2.2) {
            this.state = 'done';
            this.doneT = 1.6;
          }
          break;

        case 'done':
          if (Math.random() < 0.4) this.confetti();
          this.doneT -= dt;
          if (this.doneT <= 0 && !this.finished) {
            this.finished = true;
            CM.finishGame('pancake', this.score, CM.clamp(Math.ceil(this.score / 12), 5, 30));
          }
          break;
      }
    },

    updateCook(dt) {
      // countdown
      this.timeLeft -= dt;
      if (this.timeLeft <= 0) {
        this.timeLeft = 0;
        this.state = 'orderup';
        this.orderT = 0;
        this.shake = 6;
        CM.audio.play('tada');
        this.say('Order up! Great job!', 3);
        for (let i = 0; i < 12; i++) this.confetti();
        return;
      }

      // tap to flip
      if (CM.input.mouse.clicked) this.handleTap();
      // keyboard bonus: action flips the most-golden ready pancake
      if (CM.input.pressed('action')) {
        let best = null, bestScore = -1;
        for (const p of this.pans) {
          if (p.gone || p.flipping > 0 || p.serving > 0) continue;
          // prefer golden ones, else the most-cooked
          const sc = isGolden(p.cook) ? 2 + p.cook : p.cook;
          if (sc > bestScore) { bestScore = sc; best = p; }
        }
        if (best) this.flip(best);
      }

      this.tickPancakes(dt, false);
    },

    // advance every pancake's cook/flip/serve state.
    // freezeCook = true keeps doneness steady (used in count-in / order-up).
    tickPancakes(dt, freezeCook) {
      for (let i = 0; i < this.pans.length; i++) {
        const p = this.pans[i];
        if (p.gone) continue;
        if (p.wob > 0) p.wob = Math.max(0, p.wob - dt * 3);

        if (p.serving > 0) {
          p.serving -= dt;
          if (p.serving <= 0) {
            // land it on the plate stack, then start a fresh pancake here
            this.plate.push({ color: p.servedColor || '#e0b46e', wob: 1 });
            if (this.plate.length > 7) this.plate.shift();
            this.pans[i] = this.makePancake(p.slot);
            this.pans[i].wob = 1;
          }
          continue;
        }

        if (p.flipping > 0) {
          p.flipping -= dt;
          if (p.flipping <= 0) {
            p.flipping = 0;
            this.landFlip(p);
          }
          continue;
        }

        // normal cooking: doneness rises (no hard fail — it just keeps toasting)
        if (!freezeCook && this.state === 'cook') {
          p.cook += COOK_RATE * dt;
          if (p.cook > 1.35) p.cook = 1.35; // cap so it stays cute, never burnt black
        }
      }
    },

    /* ================= draw ================= */
    draw(g) {
      g.save();
      if (this.shake > 0.2) {
        const m = this.shake;
        g.translate(CM.rand(-m, m) * 0.7, CM.rand(-m, m) * 0.7);
      }

      this.drawKitchen(g);
      this.drawGriddle(g);
      this.drawPancakes(g);
      this.drawPlate(g);
      this.drawHost(g);
      this.drawParts(g);

      g.restore(); // end shake

      this.drawHud(g);

      // speech bubble (not shaken)
      if (this.hostBubble.t > 0 && this.state !== 'howto') {
        const txt = this.hostBubble.text;
        const cw = Math.max(130, txt.length * 9.5 + 30);
        const bx = CM.clamp(PURIN.x - cw + 30, 8, CM.W - cw - 8);
        D.bubble(g, bx, PURIN.y - 168, cw, 44, PURIN.x - 6);
        D.text(g, txt, bx + cw / 2, PURIN.y - 146, { size: 17, weight: 800, color: P.pinkDeep });
      }

      if (this.state === 'count') this.drawCount(g);
      if (this.state === 'orderup' || this.state === 'done') this.drawOrderBanner(g);
      if (this.state === 'howto') this.drawHowto(g);
    },

    /* ----- cozy pastel kitchen ----- */
    drawKitchen(g) {
      const wg = g.createLinearGradient(0, 0, 0, CM.H);
      wg.addColorStop(0, '#ffe9f2');
      wg.addColorStop(1, '#fff4ea');
      g.fillStyle = wg;
      g.fillRect(0, 0, CM.W, CM.H);

      // checker wall tiles up top
      g.globalAlpha = 0.5;
      for (let yy = 0; yy < 3; yy++) {
        for (let xx = 0; xx < 16; xx++) {
          if ((xx + yy) % 2 === 0) {
            g.fillStyle = '#ffd9e8';
            g.fillRect(xx * 60, yy * 40, 60, 40);
          }
        }
      }
      g.globalAlpha = 1;

      // a shelf with cute jars
      D.rr(g, 60, 132, 240, 14, 6, P.wood || '#caa06a', '#a87f4a', 2);
      this.drawJar(g, 96, 132, P.pink, 'Mix');
      this.drawJar(g, 150, 132, P.mint, 'Jam');
      this.drawJar(g, 204, 132, P.lavender, 'Sugar');
      this.drawJar(g, 258, 132, P.blue, 'Milk');

      // a bottle of syrup hanging out on the wall
      g.save();
      g.translate(700, 150);
      D.rr(g, -16, -64, 32, 64, 12, '#b9712e', '#8a5320', 2);
      D.rr(g, -8, -78, 16, 16, 5, '#e0b46e', '#b08a4a', 2);
      D.text(g, 'Syrup', 0, -30, { size: 12, color: '#fff', weight: 800 });
      g.restore();

      // counter band where the griddle + plate sit
      const cg = g.createLinearGradient(0, 430, 0, CM.H);
      cg.addColorStop(0, '#f7d9b8');
      cg.addColorStop(1, '#e8c19a');
      g.fillStyle = cg;
      g.fillRect(0, 430, CM.W, CM.H - 430);
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.fillRect(0, 430, CM.W, 5);
    },

    drawJar(g, x, baseY, col, label) {
      D.rr(g, x - 17, baseY - 44, 34, 44, 8, 'rgba(255,255,255,0.55)', '#e6cdbb', 2);
      D.rr(g, x - 17, baseY - 30, 34, 30, 8, col);
      D.rr(g, x - 12, baseY - 52, 24, 12, 5, '#fff', '#e6cdbb', 2); // lid
      D.text(g, label, x, baseY - 14, { size: 11, color: '#5a4636', weight: 800 });
    },

    /* ----- the griddle ----- */
    drawGriddle(g) {
      // big rounded griddle pan resting on the counter
      D.shadow(g, 480, 432, 320);
      D.rr(g, 150, 250, 660, 200, 40, '#5a5560', '#3c3742', 4); // pan body
      D.rr(g, 168, 266, 624, 168, 32, '#43404a', '#2c2932', 3); // cooking surface
      // glossy highlight
      g.save();
      D.rrPath(g, 168, 266, 624, 60, 28);
      g.clip();
      g.fillStyle = 'rgba(255,255,255,0.07)';
      g.fillRect(168, 266, 624, 60);
      g.restore();

      // little handle on the left
      D.rr(g, 96, 330, 70, 30, 14, '#7a4a2a', '#5a3418', 3);

      // slot guides (faint rings so kids see where pancakes go)
      for (const s of SLOTS) {
        g.strokeStyle = 'rgba(255,255,255,0.10)';
        g.lineWidth = 3;
        g.beginPath();
        g.ellipse(s.x, s.y + PAN_R * 0.55, PAN_R + 6, (PAN_R + 6) * 0.55, 0, 0, Math.PI * 2);
        g.stroke();
      }

      // drifting steam wisps over the surface
      g.save();
      g.globalAlpha = 0.5;
      for (let i = 0; i < 4; i++) {
        const sx = 230 + i * 150 + Math.sin(this.steamT * 1.2 + i) * 14;
        const sy = 286 - ((this.steamT * 26 + i * 40) % 90);
        const a = 0.4 * (1 - ((this.steamT * 26 + i * 40) % 90) / 90);
        g.fillStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')';
        D.circle(g, sx, sy, 10, 'rgba(255,255,255,' + a.toFixed(3) + ')');
      }
      g.restore();
    },

    /* ----- pancakes ----- */
    drawPancakes(g) {
      for (const p of this.pans) {
        if (p.gone) continue;
        this.drawPancake(g, p);
      }
    },

    drawPancake(g, p) {
      const s = SLOTS[p.slot];
      const t = CM.time;
      let cy = s.y;
      let squashX = 1, squashY = 1;
      let lift = 0;
      let rot = 0;

      // flip animation: hop up in an arc + spin
      if (p.flipping > 0) {
        const f = 1 - p.flipping / p.flipDur; // 0..1
        lift = Math.sin(f * Math.PI) * 70;
        rot = f * Math.PI; // half turn
        squashY = 1 - Math.sin(f * Math.PI) * 0.25;
      } else if (p.serving > 0) {
        const f = 1 - p.serving / 0.5;
        lift = Math.sin(f * Math.PI) * 40;
        // it slides toward the plate as it fades
        cy = s.y;
      } else if (p.wob > 0) {
        squashY = 1 - Math.sin(p.wob * 6) * 0.08 * p.wob;
        squashX = 1 + Math.sin(p.wob * 6) * 0.08 * p.wob;
      } else {
        // gentle idle bob
        lift = Math.sin(t * 2 + p.bob) * 1.5;
      }

      // colour from the (currently cooking) side's doneness
      const col = p.flipping > 0 ? doneColor(p.flipFrom) : doneColor(p.cook);

      D.shadow(g, s.x, s.y + PAN_R * 0.55 + 6, PAN_R * (1 - lift * 0.002));

      g.save();
      g.translate(s.x, cy - lift);
      g.rotate(rot * 0.06); // tiny tilt for the flip
      g.scale(squashX, squashY);
      if (p.serving > 0) g.globalAlpha = CM.clamp(p.serving / 0.5, 0, 1) * 0.6 + 0.4;

      // pancake disc (slightly squashed ellipse so it reads as flat)
      const stroke = this.shade(col, 0.78);
      D.ellipse(g, 0, 0, PAN_R, PAN_R * 0.62, col, stroke, 3);
      // top highlight
      D.ellipse(g, -PAN_R * 0.28, -PAN_R * 0.2, PAN_R * 0.34, PAN_R * 0.16, 'rgba(255,255,255,0.30)');
      // bubbling batter dots when it's nearly golden (a "ready" cue)
      if (p.flipping === 0 && p.serving === 0) {
        const d = p.cook;
        if (d > RAW_END && d < GOLD_END + 0.06) {
          g.fillStyle = this.shade(col, 0.86);
          for (let i = 0; i < 5; i++) {
            const a = i * 1.4 + p.bob;
            const rr = PAN_R * 0.5;
            const bx = Math.cos(a) * rr * 0.7;
            const by = Math.sin(a) * rr * 0.42;
            const pop = 0.5 + 0.5 * Math.sin(t * 6 + i + p.bob);
            D.circle(g, bx, by, 2 + pop * 1.6, this.shade(col, 0.84));
          }
        }
      }
      g.restore();

      // doneness bar + glow, floating just above the pancake (not when flipping/serving)
      if (p.flipping === 0 && p.serving === 0 && (this.state === 'cook' || this.state === 'count')) {
        this.drawDoneBar(g, p, s.x, s.y - PAN_R * 0.62 - 26);
        // golden glow ring + "TAP!" cue when it's in the sweet spot
        if (isGolden(p.cook)) {
          const pulse = 0.5 + 0.5 * Math.sin(t * 7 + p.bob);
          g.save();
          g.globalAlpha = 0.35 + pulse * 0.4;
          g.strokeStyle = '#ffd64a';
          g.lineWidth = 5;
          g.beginPath();
          g.ellipse(s.x, s.y, PAN_R + 9 + pulse * 3, (PAN_R + 9) * 0.62, 0, 0, Math.PI * 2);
          g.stroke();
          g.restore();
          if (this.state === 'cook') {
            D.text(g, p.cookedSides === 1 ? 'FLIP!' : 'TAP!', s.x, s.y + PAN_R * 0.62 + 18, {
              size: 18, color: '#e0a81f', weight: 800, stroke: '#fff', strokeWidth: 4
            });
          }
        }
      }
    },

    drawDoneBar(g, p, x, y) {
      const bw = 86, bh = 12;
      D.rr(g, x - bw / 2, y, bw, bh, 6, 'rgba(255,255,255,0.9)', '#e6cdbb', 2);
      // green "just right" zone marker behind the fill
      const gz0 = GOLD_START / 1.0, gz1 = Math.min(GOLD_END, 1) / 1.0;
      D.rr(g, x - bw / 2 + 2 + (bw - 4) * gz0, y + 2, (bw - 4) * (gz1 - gz0), bh - 4, 3, 'rgba(120,210,150,0.55)');
      // fill
      const f = CM.clamp(p.cook, 0, 1);
      const fillCol = isGolden(p.cook) ? P.mintDeep : (p.cook < RAW_END ? '#f0c84a' : '#c98a3a');
      D.rr(g, x - bw / 2 + 2, y + 2, (bw - 4) * f, bh - 4, 4, fillCol);
      // side pips (which sides are cooked)
      for (let i = 0; i < 2; i++) {
        D.circle(g, x - bw / 2 - 12 + i * (bw + 24), y + bh / 2, 5,
          i < p.cookedSides ? P.mintDeep : 'rgba(255,255,255,0.85)', '#e6cdbb', 2);
      }
    },

    // darken a 'rgb(r,g,b)' colour by factor k (0..1)
    shade(rgb, k) {
      const m = rgb.match(/\d+/g);
      if (!m) return rgb;
      return 'rgb(' + Math.round(m[0] * k) + ',' + Math.round(m[1] * k) + ',' + Math.round(m[2] * k) + ')';
    },

    /* ----- the serving plate (stack of finished pancakes) ----- */
    drawPlate(g) {
      const px = 480, py = 540;
      // plate
      D.shadow(g, px, py + 8, 90);
      D.ellipse(g, px, py + 8, 86, 22, '#fff', '#e6cdbb', 3);
      D.ellipse(g, px, py + 4, 70, 17, '#ffeef6', '#f0d6e2', 2);
      // stacked pancakes
      const n = this.plate.length;
      for (let i = 0; i < n; i++) {
        const cake = this.plate[i];
        if (cake.wob > 0) cake.wob = Math.max(0, cake.wob - 0.04);
        const yy = py - i * 9;
        D.ellipse(g, px, yy, 56, 16, cake.color, this.shade(cake.color, 0.78), 2);
      }
      // a pat of butter + syrup drip on top if there's a stack
      if (n > 0) {
        const topY = py - (n - 1) * 9;
        D.rr(g, px - 11, topY - 13, 22, 12, 4, '#ffe9a0', '#e6c95a', 2); // butter
        // syrup drips
        g.fillStyle = 'rgba(176,110,36,0.85)';
        g.beginPath();
        g.moveTo(px - 30, topY - 4);
        g.bezierCurveTo(px - 26, topY + 8, px - 18, topY + 6, px - 14, topY - 2);
        g.bezierCurveTo(px + 2, topY + 12, px + 20, topY + 2, px + 30, topY - 4);
        g.lineTo(px + 30, topY - 1);
        g.bezierCurveTo(px + 12, topY + 8, px - 6, topY + 6, px - 30, topY + 1);
        g.closePath();
        g.fill();
      }
      // label
      D.text(g, 'Served: ' + this.served, px + 150, py, { size: 18, color: '#7a5a3a', weight: 800 });
    },

    /* ----- host: Pompompurin the chef ----- */
    drawHost(g) {
      const t = CM.time;
      const happy = this.hostHappy > 0 || this.state === 'orderup' || this.state === 'done';
      const bob = happy ? (t * 2.6) % 1 : ((t * 1.2) % 1) * 0.4;
      const x = PURIN.x, y = PURIN.y;

      // Pompompurin the chef
      CM.drawFriend(g, 'pompompurin', x, y, 1.15, { bob: bob });

      // apron (drawn over the body)
      g.save();
      D.rr(g, x - 17, y - 40, 34, 34, 8, '#fff', '#f0b9d2', 2);
      D.text(g, '♥', x, y - 24, { size: 16, color: P.pinkDeep, weight: 800 });
      // a tiny chef hat
      D.ellipse(g, x, y - 96, 17, 11, '#fff', '#e6dcd2', 2);
      D.rr(g, x - 13, y - 92, 26, 12, 4, '#fff', '#e6dcd2', 2);
      g.restore();

      // a spatula in hand, waving when happy
      g.save();
      g.translate(x - 26, y - 44);
      g.rotate(happy ? Math.sin(t * 9) * 0.4 - 0.3 : -0.2);
      g.strokeStyle = '#9a7a4a'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.moveTo(0, 0); g.lineTo(-2, -26); g.stroke();
      D.rr(g, -12, -40, 24, 16, 5, '#d7d3da', '#a8a4ad', 2);
      g.restore();
    },

    drawParts(g) {
      for (const p of this.parts) {
        g.globalAlpha = CM.clamp(p.life / p.maxLife, 0, 1);
        if (p.kind === 'spark') D.star(g, p.x, p.y, p.size, p.color || P.yellowDeep);
        else if (p.kind === 'heart') D.heart(g, p.x, p.y, p.size, P.pink);
        else if (p.kind === 'puff') D.circle(g, p.x, p.y, p.size, p.color);
        else if (p.kind === 'txt') {
          D.text(g, p.str, p.x, p.y, { size: 22, color: p.color || '#c98a1f', weight: 800, stroke: '#ffffff', strokeWidth: 5 });
        }
      }
      g.globalAlpha = 1;
    },

    /* ----- HUD ----- */
    drawHud(g) {
      if (this.state === 'howto') return;
      const t = CM.time;

      // score, top-left
      D.rr(g, 14, 12, 174, 44, 20, 'rgba(255,255,255,0.92)', '#f0b9d2', 2);
      D.star(g, 36, 34, 12, P.yellowDeep);
      D.text(g, String(this.score), 116, 34, { size: 22, color: '#c98a1f', weight: 800 });

      // timer bar, top-centre
      const prog = CM.clamp(this.timeLeft / GAME_TIME, 0, 1);
      const bx = 300, bw = 360, by = 18, bh = 22;
      D.rr(g, bx, by, bw, bh, 11, 'rgba(255,255,255,0.92)', '#f0b9d2', 2);
      const tcol = prog > 0.3 ? P.mintDeep : (prog > 0.12 ? P.yellowDeep : P.pinkDeep);
      D.rr(g, bx + 3, by + 3, (bw - 6) * prog, bh - 6, 8, tcol);
      D.text(g, 'Time: ' + Math.ceil(this.timeLeft) + 's', bx + bw / 2, by + bh / 2, {
        size: 16, color: '#7a5a3a', weight: 800
      });

      // a flip hint early in the round
      if (this.state === 'cook' && this.timeLeft > GAME_TIME - 9) {
        const pulse = 1 + Math.sin(t * 5) * 0.04;
        D.rr(g, 300, 560, 360, 30, 15, 'rgba(255,255,255,0.8)');
        D.text(g, 'TAP a golden pancake to FLIP it!', 480, 575, {
          size: Math.round(16 * pulse), color: P.pinkDeep, weight: 800
        });
      }
    },

    drawCount(g) {
      const SEGS = ['3', '2', '1', 'Go!'];
      const seg = Math.min(3, Math.floor(this.countT / 0.8));
      const frac = (this.countT - seg * 0.8) / 0.8;
      const size = (seg === 3 ? 76 : 96) * (1 + 0.3 * Math.max(0, 1 - frac * 3));
      D.text(g, SEGS[seg], 480, 250, {
        size: Math.round(size), color: P.pinkDeep, weight: 800,
        stroke: '#ffffff', strokeWidth: 10
      });
      D.text(g, 'Get the griddle ready!', 480, 320, {
        size: 22, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 5
      });
    },

    drawOrderBanner(g) {
      const t = CM.time;
      g.fillStyle = 'rgba(255,255,255,0.30)';
      g.fillRect(0, 0, CM.W, CM.H);
      D.text(g, 'Order up! 🥞', 480, 170, {
        size: 50, color: P.pinkDeep, weight: 800, stroke: '#ffffff', strokeWidth: 10
      });
      D.text(g, 'You served ' + this.served + ' pancakes!', 480, 230, {
        size: 26, color: P.ink, weight: 800, stroke: '#fff', strokeWidth: 6
      });
      D.text(g, this.perfects + ' golden flips ✨', 480, 272, {
        size: 22, color: P.mintDeep, weight: 800, stroke: '#fff', strokeWidth: 6
      });
      D.text(g, 'Score: ' + this.score, 480, 316, {
        size: 30, color: P.blueDeep, weight: 800, stroke: '#fff', strokeWidth: 6
      });
      D.star(g, 250, 160 + Math.sin(t * 5) * 6, 18, P.yellowDeep, t * 2);
      D.star(g, 710, 160 + Math.cos(t * 5) * 6, 18, P.yellowDeep, -t * 2);
    },

    drawHowto(g) {
      const t = CM.time;
      g.fillStyle = 'rgba(70,40,70,0.28)';
      g.fillRect(0, 0, CM.W, CM.H);
      CM.ui.panel(g, 175, 92, 610, 404, { title: '🥞 Flip \'Em! 🥞' });
      CM.drawFriend(g, 'pompompurin', 280, 396, 1.3, { bob: ((t * 1.1) % 1) * 0.5 });
      // little chef hat on the howto host
      D.ellipse(g, 280, 396 - 124, 18, 12, '#fff', '#e6dcd2', 2);
      D.rr(g, 280 - 14, 396 - 120, 28, 13, 4, '#fff', '#e6dcd2', 2);
      D.text(g, 'Pompompurin', 280, 420, { size: 14, color: P.pinkDeep, weight: 800 });

      D.text(g, 'Cook pancakes on the griddle!', 565, 158, { size: 22, color: P.ink, weight: 800 });
      D.text(g, 'Watch them turn GOLDEN, then', 565, 206, { size: 17, color: P.ink });
      D.text(g, 'TAP a pancake to FLIP it! 🥄', 565, 230, { size: 17, color: P.pinkDeep, weight: 800 });
      D.text(g, 'Flip BOTH sides golden to serve', 565, 270, { size: 17, color: P.ink });
      D.text(g, 'it for big points & a "Yum!" ✨', 565, 294, { size: 17, color: P.yellowDeep, weight: 800 });
      D.text(g, 'A little dark? That\'s okay — still tasty!', 565, 338, { size: 14, color: '#9a8a94' });

      // a tiny golden-pancake teaser
      D.ellipse(g, 470, 372, 26, 16, doneColor(0.6), this.shade(doneColor(0.6), 0.78), 2.5);
      D.ellipse(g, 470, 369, 9, 4, 'rgba(255,255,255,0.4)');

      if (CM.ui.button(g, 465, 408, 210, 58, '▶ Start!', { color: P.mintDeep, size: 24 })) {
        this.beginCount();
      }
    }
  });
})();
