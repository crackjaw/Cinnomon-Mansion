/* ============================================================
   Cinnamoroll Mansion — character art
   CM.drawFriend(g, id, x, y, scale, opts)  — Sanrio-style friends
   CM.drawPlayer(g, x, y, scale, facing, walkPhase, cfg) — the player
   All characters are drawn with their FEET at (x, y).
   Friends are ~95px tall at scale 1; the player is ~88px tall.
   ============================================================ */
(function () {
  'use strict';
  const CM = window.CM;
  const D = CM.draw;
  const INK = '#3c3c3c';

  CM.FRIENDS = {
    hellokitty: { name: 'Hello Kitty', color: '#ef5b5b' },
    cinnamoroll: { name: 'Cinnamoroll', color: '#8ecdf6' },
    mymelody: { name: 'My Melody', color: '#ff9ec7' },
    kuromi: { name: 'Kuromi', color: '#9b7bd4' },
    pompompurin: { name: 'Pompompurin', color: '#f2b53c' },
    keroppi: { name: 'Keroppi', color: '#67c587' },
    badtzmaru: { name: 'Badtz-Maru', color: '#4a3b46' },
    pochacco: { name: 'Pochacco', color: '#9fd468' }
  };

  function eye(g, x, y, rx, ry, color) {
    g.fillStyle = color || INK;
    g.beginPath();
    g.ellipse(x, y, rx, ry || rx, 0, 0, Math.PI * 2);
    g.fill();
  }
  function blush(g, x, y, r) {
    g.fillStyle = 'rgba(255,140,160,0.5)';
    g.beginPath();
    g.ellipse(x, y, r, r * 0.7, 0, 0, Math.PI * 2);
    g.fill();
  }
  function smileArc(g, x, y, r) {
    g.strokeStyle = INK;
    g.lineWidth = 2.2;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(x, y, r, 0.15 * Math.PI, 0.85 * Math.PI);
    g.stroke();
  }

  /* ----- each friend, feet at (0,0) ----- */
  const FRIEND_ART = {
    hellokitty(g) {
      D.ellipse(g, -10, -3, 9, 6, '#fff', '#e3d9d2', 2); // feet
      D.ellipse(g, 10, -3, 9, 6, '#fff', '#e3d9d2', 2);
      D.rr(g, -20, -48, 40, 42, 14, '#ef5b5b'); // red dress
      D.ellipse(g, -23, -34, 8, 10, '#fff', '#e3d9d2', 2); // arms
      D.ellipse(g, 23, -34, 8, 10, '#fff', '#e3d9d2', 2);
      // ears
      g.fillStyle = '#fff';
      g.beginPath(); g.moveTo(-28, -76); g.lineTo(-21, -95); g.lineTo(-9, -86); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(28, -76); g.lineTo(21, -95); g.lineTo(9, -86); g.closePath(); g.fill();
      D.ellipse(g, 0, -66, 32, 26, '#fff', '#e8e0da', 2); // head
      // bow (viewer-left ear)
      D.ellipse(g, -27, -88, 8, 6, '#ef5b5b');
      D.ellipse(g, -13, -88, 8, 6, '#ef5b5b');
      D.circle(g, -20, -88, 5, '#c93b3b');
      eye(g, -12, -66, 3, 4);
      eye(g, 12, -66, 3, 4);
      D.ellipse(g, 0, -59, 4, 3, '#f2b53c'); // nose
      g.strokeStyle = INK; g.lineWidth = 1.6; g.lineCap = 'round';
      for (let i = -1; i <= 1; i++) {
        g.beginPath(); g.moveTo(-30, -64 + i * 5); g.lineTo(-42, -66 + i * 7); g.stroke();
        g.beginPath(); g.moveTo(30, -64 + i * 5); g.lineTo(42, -66 + i * 7); g.stroke();
      }
    },
    cinnamoroll(g) {
      D.ellipse(g, -9, -3, 8, 5, '#fff', '#dfe9f5', 2);
      D.ellipse(g, 9, -3, 8, 5, '#fff', '#dfe9f5', 2);
      D.ellipse(g, 0, -26, 24, 22, '#fff', '#dfe9f5', 2); // chubby body
      // long droopy ears
      g.fillStyle = '#fff';
      g.strokeStyle = '#dfe9f5'; g.lineWidth = 2;
      g.beginPath();
      g.moveTo(-14, -80);
      g.bezierCurveTo(-50, -88, -56, -48, -40, -32);
      g.bezierCurveTo(-34, -28, -28, -34, -30, -44);
      g.bezierCurveTo(-34, -58, -28, -68, -12, -70);
      g.closePath(); g.fill(); g.stroke();
      g.beginPath();
      g.moveTo(14, -80);
      g.bezierCurveTo(50, -88, 56, -48, 40, -32);
      g.bezierCurveTo(34, -28, 28, -34, 30, -44);
      g.bezierCurveTo(34, -58, 28, -68, 12, -70);
      g.closePath(); g.fill(); g.stroke();
      D.ellipse(g, 0, -58, 30, 27, '#fff', '#dfe9f5', 2); // head
      eye(g, -15, -57, 3.4, 4.4, '#27486b');
      eye(g, 15, -57, 3.4, 4.4, '#27486b');
      blush(g, -22, -49, 5);
      blush(g, 22, -49, 5);
      smileArc(g, 0, -53, 4.5);
    },
    mymelody(g) {
      D.ellipse(g, -9, -3, 8, 5, '#ffc7dd', '#eda3c2', 2);
      D.ellipse(g, 9, -3, 8, 5, '#ffc7dd', '#eda3c2', 2);
      D.rr(g, -18, -42, 36, 36, 13, '#ffc7dd'); // body
      D.ellipse(g, -21, -30, 7, 9, '#fff', '#eda3c2', 2); // paws
      D.ellipse(g, 21, -30, 7, 9, '#fff', '#eda3c2', 2);
      // hood ears
      g.save();
      g.translate(-19, -88); g.rotate(-0.45);
      D.ellipse(g, 0, 0, 9, 21, '#ff9ec7', '#e87fb2', 2);
      g.restore();
      g.save();
      g.translate(19, -88); g.rotate(0.45);
      D.ellipse(g, 0, 0, 9, 21, '#ff9ec7', '#e87fb2', 2);
      g.restore();
      D.circle(g, 0, -60, 29, '#ff9ec7', '#e87fb2', 2); // hood
      D.ellipse(g, 0, -56, 20, 17, '#fff'); // face
      // flower (viewer-left)
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        D.circle(g, -24 + Math.cos(a) * 5.5, -76 + Math.sin(a) * 5.5, 4, '#fff');
      }
      D.circle(g, -24, -76, 3.4, '#f6d44d');
      eye(g, -9, -57, 2.6, 3.6);
      eye(g, 9, -57, 2.6, 3.6);
      D.ellipse(g, 0, -50, 2.6, 2, '#f6d44d');
      smileArc(g, 0, -47, 3.4);
      blush(g, -14, -49, 3.6);
      blush(g, 14, -49, 3.6);
    },
    kuromi(g) {
      D.ellipse(g, -9, -3, 8, 5, '#4d4458', '#37313f', 2);
      D.ellipse(g, 9, -3, 8, 5, '#4d4458', '#37313f', 2);
      D.rr(g, -18, -42, 36, 36, 13, '#4d4458'); // body
      D.ellipse(g, -21, -30, 7, 9, '#fff', '#cfc7da', 2);
      D.ellipse(g, 21, -30, 7, 9, '#fff', '#cfc7da', 2);
      // hood ears (kinked tips)
      g.save();
      g.translate(-19, -88); g.rotate(-0.5);
      D.ellipse(g, 0, 0, 9, 21, '#4d4458', '#37313f', 2);
      D.circle(g, 0, -19, 6, '#ffb7d5');
      g.restore();
      g.save();
      g.translate(19, -88); g.rotate(0.5);
      D.ellipse(g, 0, 0, 9, 21, '#4d4458', '#37313f', 2);
      D.circle(g, 0, -19, 6, '#ffb7d5');
      g.restore();
      D.circle(g, 0, -60, 29, '#4d4458', '#37313f', 2); // hood
      D.ellipse(g, 0, -56, 20, 17, '#fff'); // face
      // pink skull on hood
      D.circle(g, 0, -84, 6.5, '#ffb7d5');
      D.rr(g, -4, -80, 8, 4, 2, '#ffb7d5');
      eye(g, -2.2, -85, 1.5, 2, '#4d4458');
      eye(g, 2.2, -85, 1.5, 2, '#4d4458');
      eye(g, -9, -57, 2.6, 3.6);
      eye(g, 9, -57, 2.6, 3.6);
      // mischievous smirk
      g.strokeStyle = INK; g.lineWidth = 2.2; g.lineCap = 'round';
      g.beginPath(); g.arc(2, -49, 4.5, 0.2 * Math.PI, 0.9 * Math.PI); g.stroke();
      blush(g, -14, -49, 3.6);
      blush(g, 14, -49, 3.6);
    },
    pompompurin(g) {
      D.ellipse(g, -10, -3, 9, 6, '#f6cf5a', '#d8ab35', 2);
      D.ellipse(g, 10, -3, 9, 6, '#f6cf5a', '#d8ab35', 2);
      D.ellipse(g, 0, -22, 26, 19, '#f6cf5a', '#d8ab35', 2); // body
      // droopy ears
      g.save();
      g.translate(-26, -72); g.rotate(-0.7);
      D.ellipse(g, 0, 0, 8, 14, '#8a5a3b');
      g.restore();
      g.save();
      g.translate(26, -72); g.rotate(0.7);
      D.ellipse(g, 0, 0, 8, 14, '#8a5a3b');
      g.restore();
      D.ellipse(g, 0, -54, 32, 28, '#f6cf5a', '#d8ab35', 2); // head
      D.ellipse(g, 0, -82, 14, 7, '#8a5a3b'); // beret
      D.circle(g, 0, -88, 4, '#8a5a3b');
      eye(g, -12, -56, 3, 4);
      eye(g, 12, -56, 3, 4);
      // muzzle smile
      g.strokeStyle = '#6e4527'; g.lineWidth = 2.4; g.lineCap = 'round';
      g.beginPath(); g.arc(-4, -48, 4.5, 0.1 * Math.PI, Math.PI * 0.95); g.stroke();
      g.beginPath(); g.arc(4, -48, 4.5, 0.05 * Math.PI, Math.PI * 0.9); g.stroke();
      blush(g, -21, -47, 4.5);
      blush(g, 21, -47, 4.5);
    },
    keroppi(g) {
      D.ellipse(g, -10, -2, 10, 5, '#7ccb6f', '#5aa84e', 2);
      D.ellipse(g, 10, -2, 10, 5, '#7ccb6f', '#5aa84e', 2);
      D.ellipse(g, 0, -22, 22, 18, '#7ccb6f', '#5aa84e', 2); // body
      D.ellipse(g, 0, -19, 13, 11, '#fff'); // tummy
      D.ellipse(g, 0, -52, 30, 24, '#7ccb6f', '#5aa84e', 2); // head
      // eye bumps
      D.circle(g, -13, -72, 10, '#fff', '#5aa84e', 2);
      D.circle(g, 13, -72, 10, '#fff', '#5aa84e', 2);
      eye(g, -13, -72, 3.4, 4);
      eye(g, 13, -72, 3.4, 4);
      // big smile
      g.strokeStyle = INK; g.lineWidth = 2.4; g.lineCap = 'round';
      g.beginPath();
      g.moveTo(-14, -48);
      g.quadraticCurveTo(0, -38, 14, -48);
      g.stroke();
      blush(g, -20, -47, 4.5);
      blush(g, 20, -47, 4.5);
    },
    badtzmaru(g) {
      D.ellipse(g, -9, -2, 9, 5, '#f2b53c', '#cf922a', 2); // yellow feet
      D.ellipse(g, 9, -2, 9, 5, '#f2b53c', '#cf922a', 2);
      D.ellipse(g, 0, -24, 22, 20, '#3a3a3a'); // body
      D.ellipse(g, 0, -20, 13, 11, '#fff'); // belly
      D.ellipse(g, 0, -54, 30, 26, '#3a3a3a'); // head
      // spiky hair
      g.fillStyle = '#3a3a3a';
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(i * 11 - 6, -72);
        g.lineTo(i * 11, -92 + Math.abs(i) * 3);
        g.lineTo(i * 11 + 6, -72);
        g.closePath();
        g.fill();
      }
      // half-lidded eyes
      D.ellipse(g, -12, -56, 7, 9, '#fff');
      D.ellipse(g, 12, -56, 7, 9, '#fff');
      g.fillStyle = '#3a3a3a';
      g.fillRect(-19, -65, 14, 5);
      g.fillRect(5, -65, 14, 5);
      eye(g, -11, -54, 2.6, 3);
      eye(g, 11, -54, 2.6, 3);
      D.ellipse(g, 0, -46, 9, 4.5, '#f2b53c'); // beak
    },
    pochacco(g) {
      D.ellipse(g, -9, -3, 8, 5, '#fff', '#dfe5ea', 2);
      D.ellipse(g, 9, -3, 8, 5, '#fff', '#dfe5ea', 2);
      D.ellipse(g, 0, -24, 21, 19, '#fff', '#dfe5ea', 2); // body
      // floppy black ears
      g.fillStyle = '#3a3a3a';
      g.beginPath();
      g.moveTo(-16, -76);
      g.bezierCurveTo(-38, -80, -40, -52, -28, -44);
      g.bezierCurveTo(-22, -42, -18, -50, -20, -58);
      g.closePath(); g.fill();
      g.beginPath();
      g.moveTo(16, -76);
      g.bezierCurveTo(38, -80, 40, -52, 28, -44);
      g.bezierCurveTo(22, -42, 18, -50, 20, -58);
      g.closePath(); g.fill();
      D.ellipse(g, 0, -56, 27, 24, '#fff', '#dfe5ea', 2); // head
      eye(g, -11, -57, 2.8, 3.6);
      eye(g, 11, -57, 2.8, 3.6);
      D.ellipse(g, 0, -50, 3.4, 2.6, '#3a3a3a'); // nose
      smileArc(g, 0, -47, 3.4);
      blush(g, -17, -48, 4);
      blush(g, 17, -48, 4);
    }
  };

  /**
   * Draw a friend with feet at (x, y).
   * opts: { flip: bool, bob: 0..1 walk/bounce phase, shadow: bool (default true) }
   */
  CM.drawFriend = function (g, id, x, y, s, o) {
    s = s || 1;
    o = o || {};
    const art = FRIEND_ART[id];
    if (!art) return;
    if (o.shadow !== false) D.shadow(g, x, y, 26 * s);
    g.save();
    g.translate(x, y);
    g.scale(o.flip ? -s : s, s);
    if (o.bob) g.translate(0, -Math.abs(Math.sin(o.bob * Math.PI * 2)) * 5);
    art(g);
    g.restore();
  };

  /* ============================================================
     Player character
     ============================================================ */
  CM.SKINS = ['#ffe3cf', '#ffd2b0', '#eab184', '#c98a55', '#a06435', '#7c4a26'];
  CM.HAIRC = ['#46342a', '#191512', '#8a5a2b', '#e7b94c', '#c9542e', '#f59ec0', '#9b7bd4', '#3f7fd4', '#bfc3c9'];
  CM.TOPC = ['#ff9ec7', '#8ecdf6', '#67c587', '#f6cf5a', '#9b7bd4', '#ef5b5b', '#ffffff', '#4a3b46', '#ff8b4a'];
  CM.BOTC = ['#4a6fa5', '#ff9ec7', '#4a3b46', '#67c587', '#f6cf5a', '#ffffff', '#9b7bd4', '#8a5a3b'];
  CM.HAIRSTYLES = ['Short', 'Bob', 'Long', 'Pigtails', 'Ponytail', 'Buns', 'Spiky', 'Curly'];
  CM.ACCESSORIES = ['None', 'Bow', 'Cap', 'Glasses', 'Flower', 'Cat Ears'];

  // How many of each option are free from the start; anything past this is a
  // Gift Shop unlock keyed in CM.save.owned as "<kind>:<index>".
  CM.FREE_COUNTS = {
    skin: CM.SKINS.length, hairColor: CM.HAIRC.length, hair: CM.HAIRSTYLES.length,
    top: CM.TOPC.length, bottom: CM.BOTC.length, acc: CM.ACCESSORIES.length
  };
  // premium options appended after the free ones (sold in the shop)
  CM.TOPC.push('#ff4f9a', '#19c3bd', '#7b3fd4', '#ffcf3f');           // 9-12
  CM.BOTC.push('#19c3bd', '#c9a8f0', '#ff8f7a', '#2f3a8f');           // 8-11
  CM.ACCESSORIES.push('Crown', 'Halo', 'Headphones', 'Party Hat', 'Wizard Hat', 'Flower Crown'); // 6-11

  CM.ownsOption = function (kind, index) {
    const free = CM.FREE_COUNTS[kind];
    if (free === undefined || index < free) return true;
    return !!(CM.save.owned && CM.save.owned[kind + ':' + index]);
  };

  CM.defaultCharacter = function () {
    return { body: 'girl', name: 'Cinna', skin: 0, hair: 1, hairColor: 0, top: 0, bottom: 0, acc: 1 };
  };

  // Hair pieces drawn BEHIND the head (feet-origin coords; head center is (0,-66) r=20)
  function hairBack(g, st, hc, facingUp) {
    g.fillStyle = hc;
    if (st === 2) { // long
      D.rr(g, -23, -80, 46, 56, 18, hc);
    } else if (st === 3) { // pigtails
      D.ellipse(g, -27, -60, 8, 16, hc);
      D.ellipse(g, 27, -60, 8, 16, hc);
    } else if (st === 4) { // ponytail
      D.ellipse(g, 0, -88, 11, 8, hc);
      if (facingUp) D.ellipse(g, 0, -58, 8, 20, hc);
      else D.ellipse(g, 14, -58, 6, 16, hc);
    } else if (st === 5) { // buns
      D.circle(g, -17, -85, 9, hc);
      D.circle(g, 17, -85, 9, hc);
    }
  }

  // Hair drawn OVER the head
  function hairFront(g, st, hc, facingUp) {
    g.fillStyle = hc;
    if (facingUp) {
      // back of head — full hair cap
      D.circle(g, 0, -66, 20.5, hc);
      if (st === 1) D.rr(g, -21, -70, 42, 26, 10, hc);
      if (st === 2) D.rr(g, -23, -70, 46, 46, 14, hc);
      return;
    }
    // base cap (upper half of head) for every style
    g.beginPath();
    g.arc(0, -66, 20.5, Math.PI * 0.98, Math.PI * 2.02);
    g.fill();
    // bangs scallops (kept high so they never cover the eyes at y -66)
    if (st !== 6) {
      D.circle(g, -10, -77.5, 5.5, hc);
      D.circle(g, 0, -79, 6, hc);
      D.circle(g, 10, -77.5, 5.5, hc);
    }
    if (st === 1) { // bob — side panels
      D.rr(g, -23, -72, 9, 26, 4, hc);
      D.rr(g, 14, -72, 9, 26, 4, hc);
    } else if (st === 2) { // long — strands past shoulders
      D.rr(g, -24, -72, 9, 40, 4, hc);
      D.rr(g, 15, -72, 9, 40, 4, hc);
    } else if (st === 3) { // pigtail ties
      D.circle(g, -22, -68, 3.4, '#ff5f8f');
      D.circle(g, 22, -68, 3.4, '#ff5f8f');
    } else if (st === 4) { // ponytail tie
      D.circle(g, 0, -84, 3.4, '#ff5f8f');
    } else if (st === 6) { // spiky
      for (let i = -2; i <= 2; i++) {
        g.beginPath();
        g.moveTo(i * 8 - 5, -76);
        g.lineTo(i * 8, -92 + Math.abs(i) * 2);
        g.lineTo(i * 8 + 5, -76);
        g.closePath();
        g.fill();
      }
    } else if (st === 7) { // curly
      for (let i = 0; i < 7; i++) {
        const a = Math.PI + (i / 6) * Math.PI;
        D.circle(g, Math.cos(a) * 17, -66 + Math.sin(a) * 17, 7.5, hc);
      }
    }
  }

  function accessory(g, acc, facingUp) {
    if (acc === 1) { // bow
      g.fillStyle = '#ff5f8f';
      g.beginPath(); g.moveTo(14, -82); g.lineTo(5, -88); g.lineTo(5, -76); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(14, -82); g.lineTo(23, -88); g.lineTo(23, -76); g.closePath(); g.fill();
      D.circle(g, 14, -82, 3.4, '#e0407a');
    } else if (acc === 2) { // cap (brim kept above the eyes at y -66)
      g.fillStyle = '#4a9fdc';
      g.beginPath();
      g.arc(0, -74, 19, Math.PI, Math.PI * 2);
      g.fill();
      if (!facingUp) D.ellipse(g, 0, -74, 20.5, 4.5, '#3d83b5');
      D.circle(g, 0, -91, 3.5, '#3d83b5');
    } else if (acc === 3 && !facingUp) { // glasses
      g.strokeStyle = '#4a3b46';
      g.lineWidth = 2;
      g.beginPath(); g.arc(-7, -64, 6, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.arc(7, -64, 6, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(-1, -64); g.lineTo(1, -64); g.stroke();
    } else if (acc === 4) { // flower
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        D.circle(g, -14 + Math.cos(a) * 4.5, -80 + Math.sin(a) * 4.5, 3.4, '#fff');
      }
      D.circle(g, -14, -80, 2.8, '#f6d44d');
    } else if (acc === 5) { // cat ears
      g.fillStyle = '#ff9ec7';
      g.beginPath(); g.moveTo(-16, -80); g.lineTo(-12, -94); g.lineTo(-5, -82); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(16, -80); g.lineTo(12, -94); g.lineTo(5, -82); g.closePath(); g.fill();
      g.fillStyle = '#ffd9e8';
      g.beginPath(); g.moveTo(-13.5, -82.5); g.lineTo(-11.8, -89); g.lineTo(-8.5, -83); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(13.5, -82.5); g.lineTo(11.8, -89); g.lineTo(8.5, -83); g.closePath(); g.fill();
    } else if (acc === 6) { // crown (shop)
      g.fillStyle = '#ffcf3f';
      g.beginPath();
      g.moveTo(-15, -80); g.lineTo(-15, -91); g.lineTo(-7, -85); g.lineTo(0, -95);
      g.lineTo(7, -85); g.lineTo(15, -91); g.lineTo(15, -80);
      g.closePath(); g.fill();
      g.strokeStyle = '#e0a81f'; g.lineWidth = 1.5; g.stroke();
      D.circle(g, 0, -89, 2.2, '#ff5f8f');
      D.circle(g, -11, -87, 1.7, '#7ec8ff');
      D.circle(g, 11, -87, 1.7, '#7ec8ff');
    } else if (acc === 7) { // halo (shop)
      g.strokeStyle = '#ffe07a'; g.lineWidth = 4;
      g.beginPath(); g.ellipse(0, -97, 13, 4, 0, 0, Math.PI * 2); g.stroke();
      g.strokeStyle = '#fff6c8'; g.lineWidth = 1.5;
      g.beginPath(); g.ellipse(0, -97, 13, 4, 0, 0, Math.PI * 2); g.stroke();
    } else if (acc === 8) { // headphones (shop)
      g.strokeStyle = '#4a4a55'; g.lineWidth = 4; g.lineCap = 'round';
      g.beginPath(); g.arc(0, -66, 22, Math.PI * 1.18, Math.PI * 1.82); g.stroke();
      D.rr(g, -27, -71, 9, 13, 4, '#ff5f8f', '#4a4a55', 1.5);
      D.rr(g, 18, -71, 9, 13, 4, '#ff5f8f', '#4a4a55', 1.5);
    } else if (acc === 9) { // party hat (shop)
      g.fillStyle = '#ff7eb6';
      g.beginPath(); g.moveTo(-13, -82); g.lineTo(0, -104); g.lineTo(13, -82); g.closePath(); g.fill();
      g.strokeStyle = '#fff'; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.moveTo(-9, -90); g.lineTo(9, -90); g.stroke();
      g.beginPath(); g.moveTo(-6, -96); g.lineTo(6, -96); g.stroke();
      D.circle(g, 0, -105, 3, '#ffe07a');
    } else if (acc === 10) { // wizard hat (shop)
      g.fillStyle = '#6a4bb0';
      g.beginPath();
      g.moveTo(-16, -82); g.quadraticCurveTo(0, -86, 6, -107);
      g.quadraticCurveTo(11, -101, 16, -82); g.closePath(); g.fill();
      D.ellipse(g, 0, -82, 20, 5, '#7b5cc8');
      D.star(g, -2, -93, 4, '#ffe07a');
    } else if (acc === 11) { // flower crown (shop)
      const cols = ['#ff9ec7', '#ffe07a', '#a8d8ff', '#c9a8f0', '#ff9ec7'];
      for (let i = 0; i < 5; i++) {
        const ang = Math.PI + (i / 4) * Math.PI;
        const fx = Math.cos(ang) * 19, fy = -66 + Math.sin(ang) * 19;
        for (let p = 0; p < 5; p++) {
          const a2 = (p / 5) * Math.PI * 2;
          D.circle(g, fx + Math.cos(a2) * 3, fy + Math.sin(a2) * 3, 2.3, cols[i]);
        }
        D.circle(g, fx, fy, 1.6, '#fff7d0');
      }
    }
  }

  /**
   * Draw the player with feet at (x, y).
   * facing: 'down' | 'up' | 'left' | 'right'
   * phase: 0 = standing; otherwise 0..1 looping walk cycle
   * cfg: character config (defaults to CM.save.character)
   */
  CM.drawPlayer = function (g, x, y, s, facing, phase, cfg) {
    s = s || 1;
    facing = facing || 'down';
    phase = phase || 0;
    cfg = cfg || CM.save.character || CM.defaultCharacter();
    const skin = CM.SKINS[cfg.skin] || CM.SKINS[0];
    const hc = CM.HAIRC[cfg.hairColor] || CM.HAIRC[0];
    const tc = CM.TOPC[cfg.top] || CM.TOPC[0];
    const bc = CM.BOTC[cfg.bottom] || CM.BOTC[0];
    const girl = cfg.body !== 'boy';
    const up = facing === 'up';

    D.shadow(g, x, y, 19 * s);
    g.save();
    g.translate(x, y);
    g.scale(facing === 'left' ? -s : s, s);

    const walking = phase > 0;
    const sw = Math.sin(phase * Math.PI * 2);
    if (walking) g.translate(0, -Math.abs(sw) * 2.5);

    // legs + shoes (alternating little steps)
    const liftL = walking ? Math.max(0, sw) * 4 : 0;
    const liftR = walking ? Math.max(0, -sw) * 4 : 0;
    const legColor = girl ? skin : bc;
    D.rr(g, -11, -18 - liftL, 8, 18 + liftL - 2, 4, legColor);
    D.rr(g, 3, -18 - liftR, 8, 18 + liftR - 2, 4, legColor);
    D.ellipse(g, -7, -2 - liftL, 7.5, 4.5, '#fff', '#d8c8d2', 1.5);
    D.ellipse(g, 7, -2 - liftR, 7.5, 4.5, '#fff', '#d8c8d2', 1.5);

    // bottom
    if (girl) {
      g.fillStyle = bc;
      g.beginPath();
      g.moveTo(-15, -33);
      g.lineTo(15, -33);
      g.lineTo(20, -15);
      g.lineTo(-20, -15);
      g.closePath();
      g.fill();
    } else {
      D.rr(g, -14, -32, 28, 16, 6, bc);
      g.strokeStyle = 'rgba(0,0,0,0.15)';
      g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(0, -28); g.lineTo(0, -17); g.stroke();
    }

    // torso + arms
    D.rr(g, -14, -50, 28, 22, 10, tc);
    D.ellipse(g, -17, -38, 5, 8.5, tc);
    D.ellipse(g, 17, -38, 5, 8.5, tc);
    D.circle(g, -17, -31, 3.4, skin); // hands
    D.circle(g, 17, -31, 3.4, skin);

    // head
    hairBack(g, cfg.hair, hc, up);
    D.circle(g, 0, -66, 20, skin);
    if (!up) {
      const off = facing === 'down' ? 0 : 5; // eyes shift toward facing side
      eye(g, -7 + off, -66, 2.8, 3.8);
      eye(g, 7 + off, -66, 2.8, 3.8);
      g.fillStyle = '#fff';
      g.beginPath(); g.arc(-6 + off, -68, 1.1, 0, Math.PI * 2); g.fill();
      g.beginPath(); g.arc(8 + off, -68, 1.1, 0, Math.PI * 2); g.fill();
      blush(g, -12 + off, -59, 3.4);
      blush(g, 12 + off, -59, 3.4);
      g.strokeStyle = INK; g.lineWidth = 2; g.lineCap = 'round';
      g.beginPath(); g.arc(off, -60, 3.6, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    }
    hairFront(g, cfg.hair, hc, up);
    accessory(g, cfg.acc, up);

    g.restore();
  };

  /* ============================================================
     Pet companions (sold in the Gift Shop) — feet at (x, y), ~36px tall
     ============================================================ */
  CM.PETS = {
    chick: { name: 'Chick', color: '#f6cf5a' },
    kitten: { name: 'Kitten', color: '#ffffff' },
    puppy: { name: 'Puppy', color: '#d9a86a' },
    bunny: { name: 'Bunny', color: '#ffc7dd' },
    star: { name: 'Star Buddy', color: '#ffe07a' }
  };
  // pet recolour palette (index 0 = the pet's natural colour) and little accessories
  CM.PET_COLORS = [null, '#ffd6e8', '#bfe3ff', '#d9c4f5', '#cdeccd', '#ffe6a8', '#ffffff', '#c9a6e8', '#b9c4cf'];
  CM.PET_COLOR_NAMES = ['Natural', 'Pink', 'Blue', 'Purple', 'Mint', 'Yellow', 'White', 'Lavender', 'Grey'];
  CM.PET_ACCS = ['None', 'Bow', 'Flower', 'Crown'];

  function darker(hex, k) {
    k = k === undefined ? 0.82 : k;
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * k), gg = Math.round(((n >> 8) & 255) * k), b = Math.round((n & 255) * k);
    return 'rgb(' + r + ',' + gg + ',' + b + ')';
  }

  // art functions take the resolved body colour `c`
  const PET_ART = {
    chick(g, c) {
      const ol = darker(c);
      D.ellipse(g, -5, -3, 3, 2, '#e8a93a'); D.ellipse(g, 5, -3, 3, 2, '#e8a93a'); // feet
      D.ellipse(g, 0, -13, 13, 12, c, ol, 2);   // body
      D.ellipse(g, -11, -14, 5, 7, c, ol, 1.5); // wing
      D.ellipse(g, 11, -14, 5, 7, c, ol, 1.5);
      D.circle(g, -4, -16, 1.6, INK); D.circle(g, 4, -16, 1.6, INK);
      g.fillStyle = '#ef9b2f';
      g.beginPath(); g.moveTo(-3, -12); g.lineTo(3, -12); g.lineTo(0, -8); g.closePath(); g.fill();
      g.fillStyle = c;
      g.beginPath(); g.moveTo(-3, -24); g.lineTo(0, -29); g.lineTo(2, -24); g.closePath(); g.fill();
    },
    kitten(g, c) {
      const ol = darker(c, 0.9);
      D.ellipse(g, 0, -8, 13, 10, c, ol, 2);       // body
      D.ellipse(g, 15, -12, 5, 9, c, ol, 2);       // tail
      g.fillStyle = c; g.strokeStyle = ol; g.lineWidth = 1.5;
      g.beginPath(); g.moveTo(-9, -26); g.lineTo(-12, -34); g.lineTo(-4, -29); g.closePath(); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(7, -26); g.lineTo(10, -34); g.lineTo(2, -29); g.closePath(); g.fill(); g.stroke();
      D.circle(g, -1, -22, 10, c, ol, 2);          // head
      D.circle(g, -5, -23, 1.7, INK); D.circle(g, 3, -23, 1.7, INK);
      D.ellipse(g, -1, -19, 1.6, 1.2, '#ff9ec7');
      blush(g, -8, -19, 2.4); blush(g, 6, -19, 2.4);
    },
    puppy(g, c) {
      const ol = darker(c);
      D.ellipse(g, 0, -8, 13, 10, c, ol, 2);    // body
      D.circle(g, -1, -21, 10, c, ol, 2);       // head
      D.ellipse(g, -11, -20, 5, 9, darker(c, 0.7));  // floppy ears
      D.ellipse(g, 9, -20, 5, 9, darker(c, 0.7));
      D.circle(g, -5, -22, 1.7, INK); D.circle(g, 3, -22, 1.7, INK);
      D.ellipse(g, -1, -18, 2.2, 1.7, INK);
      smileArc(g, -1, -15, 2.6);
    },
    bunny(g, c) {
      const ol = darker(c, 0.9);
      D.ellipse(g, 0, -9, 12, 11, c, ol, 2);       // body
      D.ellipse(g, -5, -34, 4, 12, c, ol, 2);      // ears
      D.ellipse(g, 5, -34, 4, 12, c, ol, 2);
      D.ellipse(g, -5, -34, 2, 8, '#ffc7dd'); D.ellipse(g, 5, -34, 2, 8, '#ffc7dd');
      D.circle(g, -1, -20, 9, c, ol, 2);           // head
      D.circle(g, -5, -21, 1.6, INK); D.circle(g, 3, -21, 1.6, INK);
      D.ellipse(g, -1, -18, 1.6, 1.2, '#ff7eb6');
      blush(g, -7, -17, 2.3); blush(g, 5, -17, 2.3);
    },
    star(g, c, bobT) {
      const yo = -22 + Math.sin((bobT || 0) * Math.PI * 2) * 3; // floats, no feet
      D.star(g, 0, yo, 16, darker(c), -Math.PI / 2); // outline halo
      D.star(g, 0, yo, 14, c, -Math.PI / 2);         // face
      D.circle(g, -4, yo, 1.6, INK); D.circle(g, 4, yo, 1.6, INK);
      smileArc(g, 0, yo + 3, 3);
      blush(g, -7, yo + 2, 2.2); blush(g, 7, yo + 2, 2.2);
    }
  };
  const PET_HEAD = { chick: -26, kitten: -34, puppy: -31, bunny: -30, star: -38 };

  // little accessory drawn just above the pet's head (centred at 0, hy)
  function drawPetAcc(g, acc, hy) {
    if (acc === 1) { // bow
      g.fillStyle = '#ff5f8f';
      g.beginPath(); g.moveTo(0, hy); g.lineTo(-7, hy - 4); g.lineTo(-7, hy + 4); g.closePath(); g.fill();
      g.beginPath(); g.moveTo(0, hy); g.lineTo(7, hy - 4); g.lineTo(7, hy + 4); g.closePath(); g.fill();
      D.circle(g, 0, hy, 2.2, '#e0407a');
    } else if (acc === 2) { // flower
      for (let i = 0; i < 5; i++) {
        const a = (i / 5) * Math.PI * 2;
        D.circle(g, Math.cos(a) * 4, hy + Math.sin(a) * 4, 2.8, '#fff');
      }
      D.circle(g, 0, hy, 2, '#ffd24a');
    } else if (acc === 3) { // crown
      g.fillStyle = '#ffcf3f';
      g.beginPath();
      g.moveTo(-7, hy + 4); g.lineTo(-7, hy - 3); g.lineTo(-3, hy + 1); g.lineTo(0, hy - 5);
      g.lineTo(3, hy + 1); g.lineTo(7, hy - 3); g.lineTo(7, hy + 4);
      g.closePath(); g.fill();
      D.circle(g, 0, hy - 1, 1.4, '#ff5f8f');
    }
  }

  /**
   * Draw a pet with feet at (x, y).
   * opts: { flip, bob: 0..1 walk/float phase, shadow (default true), color, acc }
   * When drawing the player's EQUIPPED pet (id === CM.save.pet) and color/acc aren't
   * given, the saved customization (CM.save.petColor / petAcc) is applied automatically.
   */
  CM.drawPet = function (g, id, x, y, s, o) {
    s = s || 1;
    o = o || {};
    const art = PET_ART[id];
    if (!art) return;
    const isEq = id === CM.save.pet;
    let colIdx = o.color;
    if (colIdx === undefined) colIdx = isEq ? (CM.save.petColor || 0) : 0;
    const baseColor = (CM.PET_COLORS[colIdx] || null) || CM.PETS[id].color;
    let acc = o.acc;
    if (acc === undefined) acc = isEq ? (CM.save.petAcc || 0) : 0;
    if (o.shadow !== false && id !== 'star') D.shadow(g, x, y, 14 * s);
    g.save();
    g.translate(x, y);
    g.scale(o.flip ? -s : s, s);
    if (o.bob && id !== 'star') g.translate(0, -Math.abs(Math.sin(o.bob * Math.PI * 2)) * 4);
    if (id === 'star') art(g, baseColor, o.bob);
    else art(g, baseColor);
    if (acc) {
      const hy = id === 'star' ? (-22 + Math.sin((o.bob || 0) * Math.PI * 2) * 3) - 14 : PET_HEAD[id];
      drawPetAcc(g, acc, hy);
    }
    g.restore();
  };
})();
