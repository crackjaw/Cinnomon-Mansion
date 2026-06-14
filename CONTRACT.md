# Cinnamoroll Mansion — Mini-Game Contract

This document is the authoritative API reference for building a mini-game for
Cinnamoroll Mansion. The engine is plain JavaScript on a single `<canvas>`,
no modules, no build step. Your game is **one file** in `js/games/`, loaded
via a plain `<script>` tag (already present in `index.html`).

## Audience & tone

Players are kids aged 6–12. Everything must be:
- **Pastel, rounded, cute.** Use `CM.palette` colors. No harsh reds except accents.
- **Big and readable.** Text at least 14px, important text 20px+.
- **Encouraging.** Celebrate success loudly (sfx + sparkles/hearts/stars).
  Failure is gentle — never insulting, never a harsh "GAME OVER". Use lines
  like "So close!" or "Good try!".
- **Easy to learn.** First state of every game is a "How to Play" overlay with
  1–3 short instruction lines and a big Start button. Difficulty starts very
  easy and ramps gently.
- **Short.** A session lasts roughly 60–150 seconds, then ends automatically.

## File template

```js
/* Cinnamoroll Mansion — <Game Name> */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;

  CM.registerGame({
    id: 'bowling',            // EXACTLY the id you were assigned
    name: 'Bowling',          // display name shown on the results screen
    // joystick: true,        // ONLY if your game uses walk-around movement (axisX/axisY)
    enter() {
      // (re)initialize ALL state here — this is called again for "Play Again"!
      this.state = 'howto';
      this.score = 0;
      // ...
    },
    update(dt) { /* dt = seconds since last frame, capped at 0.05 */ },
    draw(g) { /* g = CanvasRenderingContext2D, canvas is 960x600 */ },
    exit() { /* optional cleanup (timers etc.) — usually empty */ }
  });
})();
```

**Critical rules**

1. Everything lives inside the IIFE. No globals other than the `registerGame` call.
2. `enter()` must fully reset state — the same object is reused when the player
   hits "Play Again" on the results screen.
3. End the session by calling **`CM.finishGame(this.id_or_string, score, coins)`**
   exactly once, e.g. `CM.finishGame('bowling', this.score, Math.ceil(this.score / 4))`.
   The engine then shows a results screen with confetti, saves the high score,
   adds the coins, and offers Play Again / Back to Mansion.
4. Do **not** handle quitting — the engine draws an ✕ button (top-right) and
   handles the Escape key. Never bind your own DOM event listeners; use `CM.input`.
5. Do **not** touch the DOM, create canvases, load images/fonts/sounds, or use
   the network. All art is drawn with canvas paths; all audio via `CM.audio`.
6. The top-right corner (x > 860, y < 60) is reserved for engine buttons —
   don't put interactive things or important info there.
7. Keep ~60fps: no giant per-frame allocations, no thousand-particle storms.
8. `Math.random()` and `Date.now()` are fine inside games.

## Canvas & timing

- Internal resolution is `CM.W` x `CM.H` = **960 x 600**, origin top-left.
  The engine scales it to the window; you always draw in these units.
- `CM.time` — seconds since boot. `CM.sceneTime` — seconds since your `enter()`.
- Your `update(dt)` then `draw(g)` run every frame while your scene is active.
- Always paint the full background each frame (e.g. a `createLinearGradient` fill).

## Input — `CM.input`

```js
CM.input.down('left'|'right'|'up'|'down'|'action')   // held? (arrows+WASD, action = Space/Enter/E)
CM.input.pressed('left'|...|'action')                // newly pressed this frame?
CM.input.pressed('arrowleft')                        // raw keys: lowercase e.key ('a', ' ', 'arrowup'...)
CM.input.axisX(), CM.input.axisY()                   // -1..1 movement incl. touch joystick
CM.input.mouse                                       // { x, y, down, clicked, released } in canvas units
```

- `mouse.clicked` is true only on the press frame. Taps on touch devices arrive
  as mouse events automatically, so **mouse support = touch support**.
- Every game must be fully playable with mouse/tap alone if mechanically possible
  (timing games: clicking anywhere = action). Keyboard is a bonus, not required —
  EXCEPT movement games (joystick flag) where keyboard + joystick both work via axisX/axisY.
- Don't use `pressed('back')`/Escape — the engine owns it.

## Drawing helpers — `CM.draw` (alias `D`)

```js
D.rr(g, x, y, w, h, radius, fill?, stroke?, lineWidth?)   // rounded rect
D.rrPath(g, x, y, w, h, r)                                // path only (for clip())
D.circle(g, x, y, r, fill?, stroke?, lw?)
D.ellipse(g, x, y, rx, ry, fill?, stroke?, lw?)
D.text(g, str, x, y, { size, color, align, baseline, weight, stroke, strokeWidth })
   // defaults: size 24, centered, cute rounded font; stroke draws an outline
D.shadow(g, x, y, rx)            // soft ground shadow ellipse
D.star(g, x, y, r, color)        // 5-point star
D.heart(g, x, y, size, color)
D.coin(g, x, y, r)               // gold coin icon
D.bubble(g, x, y, w, h, tailX?)  // white speech bubble
```

## UI helpers — `CM.ui`

```js
// immediate-mode button: draws AND returns true when clicked (consumes the click)
if (CM.ui.button(g, x, y, w, h, 'Start!', { color: CM.palette.mintDeep, size: 22 })) { ... }
CM.ui.panel(g, x, y, w, h, { title: 'How to Play' })   // white rounded panel
```

## Audio — `CM.audio`

```js
CM.audio.play(name)  // 'click','pop','ding','coin','cheer','tada','miss','boing','splash','crash','whoosh','step'
CM.audio.tone(freq, dur, type, vol, when, slideTo)  // raw synth note (type='sine'|'square'|'triangle'|'sawtooth')
CM.audio.noise(dur, vol, when)                      // soft noise burst
CM.audio.music('off')   // background music: the engine starts a 'game' loop for you;
                        // call music('off') in enter() ONLY if you schedule your own notes (rhythm game)
CM.audio.now            // getter: AudioContext currentTime (0 if not unlocked yet)
```

Audio may be muted/unavailable; never depend on it for gameplay logic.

## Characters

```js
CM.drawFriend(g, id, x, y, scale, { flip, bob, shadow })
// ids: 'hellokitty','cinnamoroll','mymelody','kuromi','pompompurin','keroppi','badtzmaru','pochacco'
// feet anchored at (x,y); ~95px tall at scale 1; bob: 0..1 bounce phase
CM.FRIENDS[id].name / .color

CM.drawPlayer(g, x, y, scale, facing, walkPhase, cfg?)
// facing: 'down'|'up'|'left'|'right'; walkPhase: 0 = standing, else 0..1 loop
// cfg defaults to CM.save.character (the kid's customized character) — usually omit it
// feet anchored at (x,y); ~88px tall at scale 1
```

Use these! The player's own character should appear in your game when it makes
sense (the bowler, the batter, the seeker...), and the host friend should be
there cheering ("Nice one!", "Wow!" speech bubbles on good plays).

## Palette — `CM.palette`

`cream, sky, skyDeep, pinkSoft, pink, pinkDeep, blue, blueDeep, mint, mintDeep,
lavender, lavenderDeep, yellow, yellowDeep, brown, wood, ink, white, red`

## Scoring & coins

- Score is a positive integer; bigger = better. Make a great session land
  roughly between 100 and 600 so the results screen feels juicy.
- Coins awarded: roughly **5–30 per session**, scaled to performance
  (e.g. `Math.ceil(score / 20)` — pick a divisor that fits your score range).
- High score per game is saved by the engine automatically.

## Structure conventions

Use a simple state machine string: `'howto' → 'play' → (finish)`, plus whatever
intermediate states you need (`'aim'`, `'rolling'`, `'roundEnd'`...). On the howto
screen show the host friend, the rules, and a big Start button (also start on
`pressed('action')`). Add a brief 3-2-1-Go count-in if the game is timing-based.

Verify your file parses: `node --check "js/games/<id>.js"`.
