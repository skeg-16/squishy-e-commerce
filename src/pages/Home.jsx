import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SquishiesAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { FALLBACK_PRODUCTS } from '../data/catalogFallback';
import { PRODUCT_MODELS } from '../data/productModels';
import { createHeroSquishy3D } from '../components/HeroSquishy3D';

const ProductViewer3D = lazy(() => import('../components/ProductViewer3D'));

const HERO_CHARS = [
  {
    name: 'Dumpling',
    slug: 'dumpling',
    c1: '#fff7f0',
    c2: '#fbd9c9',
    c3: '#dfa38f',
    n: 2.1,
    deco: 'dumpling',
    p: 89,
    pitch: 640,
    lines: [
      'Hehe, bao-tiful squish!',
      'Ooh, so steamy and soft!',
      'Squish my chubby cheeks!',
      'Bye-bye stress!',
      'Yay, study break hugs!',
    ],
  },
  {
    name: 'Cheese Cube',
    slug: 'cheese',
    c1: '#fff6b3',
    c2: '#fbd852',
    c3: '#d89d1e',
    n: 4.5,
    deco: 'cheese',
    p: 89,
    pitch: 700,
    lines: [
      'Say cheese!',
      'Hehe, so gouda to squish!',
      'Eee, that tickles!',
      'Melting your stress away!',
      'Extra cheesy smiles!',
    ],
  },
  {
    name: 'Cat Paw',
    slug: 'catpaw',
    c1: '#fff9fc',
    c2: '#ffd4e6',
    c3: '#e38eb4',
    n: 2.3,
    deco: 'catpaw',
    p: 89,
    pitch: 760,
    lines: [
      'Meow! Purr-fect squish!',
      'Hehe, boop my pink toe beans!',
      'Paws-itively ultra soft!',
      'Purr, stress is all gone!',
      'Squish me again, meow!',
    ],
  },
  {
    name: 'Pastel Toast',
    slug: 'toast',
    c1: '#fff1d4',
    c2: '#f6cf92',
    c3: '#c88f48',
    n: 4.3,
    deco: 'toast',
    p: 89,
    pitch: 610,
    lines: [
      'Stay toasty and happy!',
      'Warm bread hugs for you!',
      'Fresh out of the bakery!',
      'Ooh, so fluffy and slow-rising!',
      'You’re doing great today!',
    ],
  },
  {
    name: 'Butter Stick',
    slug: 'butter',
    c1: '#fff9db',
    c2: '#ffebb0',
    c3: '#dfc059',
    n: 5.2,
    deco: 'butter',
    p: 89,
    pitch: 680,
    lines: [
      'You’re so butter-ful!',
      'Hehe, smooth like butter!',
      'Everything feels butter now!',
      'Squeeze the stress away!',
      'Ooh, so soft and creamy!',
    ],
  },
  {
    name: 'Peanut',
    slug: 'peanut',
    c1: '#f8e5c8',
    c2: '#e0bb87',
    c3: '#b08046',
    n: 2.4,
    deco: 'peanut',
    p: 89,
    pitch: 650,
    lines: [
      'I’m nuts about you!',
      'Hehe, crack a happy smile!',
      'Mega squeezable shell!',
      'Yay, squish me some more!',
      'Slow-rising peanut power!',
    ],
  },
];

const featuredProducts = [
  {
    slug: 'dumpling',
    name: 'Steamed Dumpling Squishy',
    description: 'Plump pastel bao with handmade pleats and a slow, pillowy rise.',
    image: '/assets/images/product-dumpling.svg',
    alt: 'Steamed Dumpling Squishy — pastel bao with a happy face',
    badge: 'Fan Fave',
    badgeClass: 'badge--pink',
    riseTime: '4.2s Rise',
    softness: 99,
    feel: 'Velvet Bao TPR',
    shelf: 'faves',
  },
  {
    slug: 'catpaw',
    name: 'Cat Paw Squishy',
    description: 'Four jelly pink toe-beans and a cloud-soft memory-foam palm pad.',
    image: '/assets/images/product-catpaw.svg',
    alt: 'Cat Paw Squishy — pink paw pads, ultra soft',
    badge: 'So Cute',
    badgeClass: 'badge--pink',
    riseTime: '3.8s Rise',
    softness: 98,
    feel: 'Mochi Jelly Pad',
    shelf: 'faves',
  },
  {
    slug: 'peanut',
    name: 'Peanut Squishy',
    description: 'Ergonomic figure-eight shell designed for one-hand desk fidgeting.',
    image: '/assets/images/product-peanut.svg',
    alt: 'Peanut Squishy — textured shell, mega squeezable',
    badge: 'Bestseller',
    badgeClass: 'badge--mint',
    riseTime: '4.5s Rise',
    softness: 96,
    feel: 'Textured Shell Foam',
    shelf: 'faves',
  },
  {
    slug: 'toast',
    name: 'Pastel Toast Squishy',
    description: 'Thick-cut milk bread slice with a sweet-cream glaze and bouncy crust.',
    image: '/assets/images/product-toast.svg',
    alt: 'Pastel Toast Squishy — pastel square toast, 4 colors',
    badge: 'Trending',
    badgeClass: 'badge--pink',
    riseTime: '4.0s Rise',
    softness: 97,
    feel: 'Airy Brioche Foam',
    shelf: 'bakery',
  },
  {
    slug: 'butter',
    name: 'Butter Stick Squishy',
    description: 'Salted sweet-cream butter block that melts right into your palm.',
    image: '/assets/images/product-butter.svg',
    alt: 'Butter Stick Squishy — salted butter block, pink and yellow',
    badge: 'New Drop',
    badgeClass: 'badge--mint',
    riseTime: '4.4s Rise',
    softness: 99,
    feel: 'Smooth Cream TPR',
    shelf: 'bakery',
  },
];

const promoSets = [
  {
    slug: 'solo-squish',
    name: 'Solo Squish',
    meta: '1 Squishy · Desk Starter',
    vibe: 'desk',
    unitPrice: '₱89 / squish',
    perk: 'Includes Matte Gift Pouch',
    accent: 'lavender',
    description: 'A classic first squish: one smiling Dumpling ready for your study desk.',
    items: [
      '1 Steamed Dumpling Squishy',
      'Individual frosted gift pouch',
      'Holographic collector sticker',
    ],
    button: 'Get Solo Pack',
    buttonClass: 'btn--lavender',
    previewImages: ['/assets/images/product-dumpling.svg'],
    countLabel: '1×',
  },
  {
    slug: 'stress-free-trio',
    name: 'Stress-Free Trio',
    meta: '3 Squishies · Bestie Gift Set',
    vibe: 'trio',
    unitPrice: '₱83 / squish',
    perk: 'Ribbon Gift Box Included',
    accent: 'pink',
    description: 'One for your desk, one for your bag, and one to make a friend smile.',
    items: [
      'Dumpling, Cat Paw & Peanut',
      'Ribbon-tied keepsake gift box',
      '2 bonus die-cut stickers',
    ],
    button: 'Get the Trio',
    buttonClass: 'btn--pink',
    previewImages: [
      '/assets/images/product-dumpling.svg',
      '/assets/images/product-catpaw.svg',
      '/assets/images/product-peanut.svg',
    ],
    countLabel: '3×',
    savings: 'Save ₱18',
    oldPrice: 267,
  },
  {
    slug: 'collectors-box',
    name: "Collector's Box",
    meta: '6 Different Designs · Full Lineup',
    vibe: 'collector',
    unitPrice: '₱76.50 / squish',
    perk: '+ Mystery Bonus Item Inside',
    accent: 'purple',
    description: 'The complete Squishies experience. All six signature designs curated in one box.',
    items: [
      'All 6 unique Squishies designs',
      'Magnetic keepsake collector box',
      'Full kawaii sticker sheet',
      '1 surprise mystery mini charm',
    ],
    button: 'Build My Collection',
    buttonClass: 'btn--dark',
    previewImages: [
      '/assets/images/product-dumpling.svg',
      '/assets/images/product-catpaw.svg',
      '/assets/images/product-butter.svg',
      '/assets/images/product-toast.svg',
    ],
    countLabel: '6×',
    featured: true,
    savings: 'Save ₱75 + Freebies',
    oldPrice: 534,
  },
  {
    slug: 'party-pack',
    name: 'Wholesale / Party Pack',
    meta: '20 Squishies · Lowest Unit Price',
    vibe: 'party',
    unitPrice: '₱70 / squish',
    perk: 'Save ₱380 · Priority Dispatch',
    accent: 'peach',
    description: 'Made for classroom giveaways, barkada gifts, or starting your own mini booth.',
    items: [
      '4 Dumplings, 4 Cat Paws & 3 each of the other designs',
      '20 individual zip gift pouches',
      'Custom gift note cards included',
      'Express priority dispatch',
    ],
    button: 'Order Party Pack',
    buttonClass: 'btn--peach',
    previewImages: [
      '/assets/images/product-peanut.svg',
      '/assets/images/product-cheese.svg',
      '/assets/images/product-dumpling.svg',
    ],
    countLabel: '20×',
    savings: 'Save ₱380',
    oldPrice: 1780,
  },
];

function formatPeso(value) {
  return `₱${Number(value || 0).toLocaleString('en-PH', {
    maximumFractionDigits: 2,
  })}`;
}

function getImage(product, fallback) {
  const image = product?.image || product?.imageUrl || product?.image_url;

  if (!image) return fallback;
  if (/^(https?:\/\/|\/)/i.test(image)) return image;

  return `/${image.replace(/^\.?\//, '')}`;
}

function getCatalogArray(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.products)) return result.products;
  return [];
}

export default function Home() {
  const [products, setProducts] = useState(
    () => SquishiesAPI.getCachedProducts?.() || FALLBACK_PRODUCTS
  );
  const [activeShelf, setActiveShelf] = useState('faves');
  const [squishPulses, setSquishPulses] = useState({});
  const [activePromoVibe, setActivePromoVibe] = useState('all');
  const { addToCart, syncProducts, showToast } = useCart();
  const heroRef = useRef(null);
  const canvas3dRef = useRef(null);
  const canvasRef = useRef(null);
  const hintRef = useRef(null);
  const pickRef = useRef(null);
  const stressBarRef = useRef(null);
  const stressValRef = useRef(null);
  const squishCountRef = useRef(null);

  useEffect(() => {
    const hero = heroRef.current;
    const c3d = canvas3dRef.current;
    const c = canvasRef.current;
    const hintEl = hintRef.current;
    const pickEl = pickRef.current;
    const sbEl = stressBarRef.current;
    const svEl = stressValRef.current;
    const cnEl = squishCountRef.current;
    if (!hero || !c || !pickEl || !sbEl || !svEl || !cnEl) return undefined;

    const hero3d = c3d ? createHeroSquishy3D(c3d) : null;
    const x = c.getContext('2d');
    let ch = 0;
    let W = 0;
    let H = 0;
    let R = 0;
    let floor = 0;
    let cx = 0;

    function resize() {
      const r = c.getBoundingClientRect();
      const d = Math.min(window.devicePixelRatio || 1, 2);
      W = r.width;
      H = r.height;
      c.width = W * d;
      c.height = H * d;
      x.setTransform(d, 0, 0, d, 0, 0);
      R = Math.min(W * 0.3, H * 0.25);
      floor = H * (W < 860 ? 0.62 : 0.8);
      cx = W / 2;
    }

    window.addEventListener('resize', resize);
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(resize) : null;
    if (ro) ro.observe(c);
    resize();

    const N = 64;
    const pts = Array.from({ length: N }, (_, i) => ({
      a: (i / N) * Math.PI * 2,
      o: 0,
      v: 0,
      x: 0,
      y: 0,
      bx: 0,
      by: 0,
    }));

    let sq = 0;
    let sqv = 0;
    let press = false;
    let px = 0;
    let py = 0;
    let lx = 0;
    let ly = 0;
    let squishes = 0;
    let stress = 100;
    let t = 0;
    let blink = 0;
    let sparks = [];
    let used = false;
    let lastLine = '';
    let speech = { text: 'Squish me~!', timer: 2.6, pop: 1 };
    let audioCtx = null;
    let activeVoiceSource = null;
    const voiceBufferCache = new Map();

    function getAudioCtx() {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      if (!audioCtx) audioCtx = new AudioContextClass();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      return audioCtx;
    }

    function playPlushSqueak(isRelease = false) {
      try {
        const ctx = getAudioCtx();
        if (!ctx) return;
        const now = ctx.currentTime;

        // Soft physical rubber/plush toy air-valve squeak
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'triangle';
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(isRelease ? 1150 : 1350, now);
        filter.Q.setValueAtTime(4.5, now);

        if (!isRelease) {
          osc.frequency.setValueAtTime(680, now);
          osc.frequency.exponentialRampToValueAtTime(1180, now + 0.055);
          osc.frequency.exponentialRampToValueAtTime(890, now + 0.11);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(0.085, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.13);
        } else {
          // Gentle rising air-puff when the slow-rising squishy bounces back
          osc.frequency.setValueAtTime(920, now);
          osc.frequency.exponentialRampToValueAtTime(620, now + 0.08);
          gain.gain.setValueAtTime(0.001, now);
          gain.gain.exponentialRampToValueAtTime(0.045, now + 0.018);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
          osc.connect(filter);
          filter.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.095);
        }
      } catch {
        // Ignore audio context errors if blocked
      }
    }

    async function playCuteVoice(charObj, customIdx) {
      let idx =
        typeof customIdx === 'number'
          ? customIdx
          : Math.floor(Math.random() * charObj.lines.length);
      if (charObj.lines[idx] === lastLine && charObj.lines.length > 1) {
        idx = (idx + 1) % charObj.lines.length;
      }
      const phrase = charObj.lines[idx];
      lastLine = phrase;
      speech = { text: phrase, timer: 3.2, pop: 0 };

      playPlushSqueak(false);

      try {
        const ctx = getAudioCtx();
        if (!ctx) return;

        const clipUrl = `/assets/voices/${charObj.slug}-${idx}.mp3?v=3`;
        let audioBuffer = voiceBufferCache.get(clipUrl);
        if (!audioBuffer) {
          const res = await fetch(clipUrl);
          if (!res.ok) return;
          const arrayBuf = await res.arrayBuffer();
          audioBuffer = await ctx.decodeAudioData(arrayBuf);
          voiceBufferCache.set(clipUrl, audioBuffer);
        }

        if (activeVoiceSource) {
          try {
            activeVoiceSource.stop();
          } catch {
            // already stopped
          }
        }

        const source = ctx.createBufferSource();
        source.buffer = audioBuffer;
        source.playbackRate.value = 1.0;

        // Subtle warm filter so the voice sounds cozy inside the plush toy
        const warmFilter = ctx.createBiquadFilter();
        warmFilter.type = 'lowpass';
        warmFilter.frequency.value = 7500;

        const voiceGain = ctx.createGain();
        voiceGain.gain.value = 0.95;

        source.connect(warmFilter);
        warmFilter.connect(voiceGain);
        voiceGain.connect(ctx.destination);

        activeVoiceSource = source;
        source.start(ctx.currentTime + 0.03);
      } catch {
        // Ignore playback errors if audio is not yet unlocked
      }
    }

    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    let reduce = mq.matches;
    const onMotionChange = (e) => {
      reduce = e.matches;
      if (reduce) {
        hero.querySelectorAll('.l').forEach((l) => {
          l.style.transform = '';
        });
      }
    };
    if (mq.addEventListener) mq.addEventListener('change', onMotionChange);

    function pos(e) {
      const r = c.getBoundingClientRect();
      return [e.clientX - r.left, e.clientY - r.top];
    }

    function hit(p) {
      const sy = 1 - 0.42 * sq;
      return Math.hypot(p[0] - cx, p[1] - (floor - R * sy)) < R * 1.35;
    }

    function onPointerDown(e) {
      const p = pos(e);
      if (!hit(p)) return;
      press = true;
      px = p[0];
      py = p[1];
      c.classList.add('down');
      if (c.setPointerCapture) {
        try {
          c.setPointerCapture(e.pointerId);
        } catch {
          // ignore synthetic pointer events without active pointerId
        }
      }
      if (navigator.vibrate) navigator.vibrate(8);
      if (hintEl) hintEl.style.opacity = '0';
      used = true;
      playCuteVoice(HERO_CHARS[ch]);
      e.preventDefault();
    }

    function onPointerMove(e) {
      const p = pos(e);
      lx = (p[0] - cx) / R;
      ly = (p[1] - (floor - R)) / R;
      if (press) {
        px = p[0];
        py = p[1];
      }
    }

    function release() {
      if (!press) return;
      press = false;
      c.classList.remove('down');
      playPlushSqueak(true);
      squishes += 1;
      cnEl.textContent = String(squishes);
      stress = Math.max(0, stress - 4);
      for (let i = 0; i < 10; i += 1) {
        sparks.push({
          x: px,
          y: py,
          vx: (Math.random() - 0.5) * 340,
          vy: -Math.random() * 300 - 60,
          l: 1,
          s: 3 + Math.random() * 5,
          h: Math.random() < 0.5,
        });
      }
    }

    function onPointerLeave() {
      lx = 0;
      ly = 0;
    }

    function onPickClick(e) {
      const b = e.target.closest('button');
      if (!b) return;
      ch = +b.dataset.i;
      [...pickEl.children].forEach((o, i) =>
        o.setAttribute('aria-pressed', String(i === ch))
      );
      sq = 0.9;
      sqv = 0;
      playCuteVoice(HERO_CHARS[ch], 0);
    }

    c.addEventListener('pointerdown', onPointerDown);
    c.addEventListener('pointermove', onPointerMove);
    c.addEventListener('pointerup', release);
    c.addEventListener('pointercancel', release);
    c.addEventListener('pointerleave', onPointerLeave);
    pickEl.addEventListener('click', onPickClick);

    function step(dt) {
      const tg = press ? 1 : 0;
      const k = press ? 150 : 38;
      const d = press ? 15 : 3.2;
      sqv += (k * (tg - sq) - d * sqv) * dt;
      sq += sqv * dt;
      if (press) {
        stress = Math.max(0, stress - 24 * dt);
      } else {
        stress = Math.min(100, stress + 2.2 * dt);
      }
      if (speech.timer > 0) {
        speech.timer = Math.max(0, speech.timer - dt);
        speech.pop = Math.min(1, speech.pop + dt * 9);
      }
      const curChar = HERO_CHARS[ch];
      const sx = (1 + 0.3 * sq) * (curChar.deco === 'butter' ? 0.88 : curChar.deco === 'peanut' ? 0.86 : 1);
      const sy = (1 - 0.42 * sq) * (curChar.deco === 'butter' ? 1.04 : 1);
      const cy = floor - R * sy;
      const n = curChar.n;
      for (let i = 0; i < N; i += 1) {
        const p = pts[i];
        const c0 = Math.cos(p.a);
        const s0 = Math.sin(p.a);
        let r = R / Math.pow(Math.pow(Math.abs(c0), n) + Math.pow(Math.abs(s0), n), 1 / n);
        if (curChar.deco === 'peanut') {
          // Peanut figure-8 waist pinch
          r *= 1 - 0.22 * Math.pow(c0, 4) + 0.08 * Math.pow(s0, 2);
        } else if (curChar.deco === 'toast') {
          // Toast top crust ears
          if (s0 < -0.15) {
            r *= 1 + 0.1 * Math.pow(Math.abs(c0), 1.6) * Math.abs(s0);
          }
        } else if (curChar.deco === 'dumpling') {
          // Plump bao bottom fullness
          r *= 1 + 0.06 * Math.max(0, s0);
        }
        p.bx = cx + c0 * r * sx;
        p.by = cy + s0 * r * sy;
        let tgt = 0;
        if (press) {
          const dd = Math.hypot(p.bx - px, p.by - py);
          const f = Math.max(0, 1 - dd / (R * 0.95));
          tgt = -f * f * R * 0.4;
        }
        const a = pts[(i + N - 1) % N].o;
        const b = pts[(i + 1) % N].o;
        p.v += (220 * (tgt - p.o) - 8 * p.v + 320 * (a + b - 2 * p.o)) * dt;
        p.o += p.v * dt;
        p.x = p.bx + c0 * p.o;
        p.y = p.by + s0 * p.o;
      }
      sparks.forEach((s) => {
        s.vy += 700 * dt;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.l -= dt * 1.6;
      });
      sparks = sparks.filter((s) => s.l > 0);
      blink -= dt;
      if (blink < -0.12) blink = 2 + Math.random() * 3;
    }

    function body() {
      x.beginPath();
      const m = (a, b) => [(a.x + b.x) / 2, (a.y + b.y) / 2];
      const s = m(pts[N - 1], pts[0]);
      x.moveTo(s[0], s[1]);
      for (let i = 0; i < N; i += 1) {
        const q = m(pts[i], pts[(i + 1) % N]);
        x.quadraticCurveTo(pts[i].x, pts[i].y, q[0], q[1]);
      }
      x.closePath();
    }

    function callouts(sx, sy, cy) {
      if (W < 1080) return;
      const a = Math.max(0, 1 - Math.abs(sq) * 2.5) * (press ? 0 : 1);
      if (a < 0.03) return;
      const fs = Math.max(14, R * 0.08);
      const defs = [
        [-0.62, -0.62, -1, -0.2, 'Ultra-soft skin', 'Smooth TPR, never sticky'],
        [0.9, 0.25, 1, 0.1, 'Memory-foam core', 'Presses in, rises back slowly'],
        [-0.9, 0.05, -1, -0.1, 'Slow-rising', 'Takes its time to bounce back'],
      ];
      x.save();
      x.lineWidth = 1.5;
      x.strokeStyle = '#fff';
      x.lineJoin = 'round';
      defs.forEach((d, i) => {
        const ax = cx + d[0] * R * sx;
        const ay = cy + d[1] * R * sy;
        const ex = ax + d[2] * R * 0.25;
        const ey = ay + d[3] * R;
        const fx = ex + d[2] * R * 0.3;
        x.globalAlpha = a * 0.85;
        x.beginPath();
        x.moveTo(ax, ay);
        x.lineTo(ex, ey);
        x.lineTo(fx, ey);
        x.stroke();
        x.globalAlpha = a;
        x.fillStyle = '#fff';
        x.beginPath();
        x.arc(ax, ay, 4, 0, 7);
        x.fill();
        const p = (t * 0.7 + i * 0.33) % 1;
        x.globalAlpha = a * (1 - p) * 0.6;
        x.beginPath();
        x.arc(ax, ay, 4 + p * 12, 0, 7);
        x.stroke();
        x.globalAlpha = a;
        x.textAlign = d[2] < 0 ? 'right' : 'left';
        const tx = fx + d[2] * 8;
        x.fillStyle = '#fff';
        x.font = `600 ${fs}px Fredoka,sans-serif`;
        x.fillText(d[4], tx, ey - 3);
        x.fillStyle = 'rgba(255,236,246,.85)';
        x.font = `500 ${fs * 0.82}px Nunito,sans-serif`;
        x.fillText(d[5], tx, ey + fs * 0.95);
      });
      x.restore();
    }

    function drawSpeechBubble(sx, sy, cy) {
      if (speech.timer <= 0 || !speech.text) return;
      const fade = Math.min(1, speech.timer * 2.5);
      const scale = 0.72 + 0.28 * Math.sin(Math.min(1, speech.pop) * Math.PI * 0.65);
      const fs = Math.max(13, Math.min(16, R * 0.085));
      x.save();
      x.font = `700 ${fs}px Fredoka,sans-serif`;
      const tw = x.measureText(speech.text).width;
      const padX = 16;
      const bw = tw + padX * 2;
      const bh = fs + 18;
      const isMobile = W < 860;
      const bx = isMobile
        ? cx
        : Math.min(W - bw / 2 - 20, cx + R * 0.88 * sx + bw * 0.18);
      const by = isMobile
        ? Math.max(bh + 16, cy - R * 1.15 * sy)
        : Math.max(bh + 20, cy - R * 0.52 * sy);

      x.translate(bx, by);
      x.scale(scale, scale);
      x.globalAlpha = fade;

      // Bubble pill shadow + fill
      x.fillStyle = 'rgba(75, 36, 72, 0.22)';
      x.beginPath();
      x.roundRect(-bw / 2, -bh / 2 + 4, bw, bh, bh / 2);
      x.fill();

      x.fillStyle = '#ffffff';
      x.strokeStyle = '#ffc4de';
      x.lineWidth = 2.5;
      x.beginPath();
      x.roundRect(-bw / 2, -bh / 2, bw, bh, bh / 2);
      x.fill();
      x.stroke();

      // Tail pointing to squishy
      x.beginPath();
      if (isMobile) {
        x.moveTo(-8, bh / 2 - 1);
        x.lineTo(0, bh / 2 + 9);
        x.lineTo(8, bh / 2 - 1);
      } else {
        x.moveTo(-bw * 0.26, bh / 2 - 1);
        x.lineTo(-bw * 0.38, bh / 2 + 9);
        x.lineTo(-bw * 0.12, bh / 2 - 1);
      }
      x.closePath();
      x.fillStyle = '#ffffff';
      x.fill();

      // Phrase text
      x.fillStyle = '#4b2448';
      x.textAlign = 'center';
      x.textBaseline = 'middle';
      x.fillText(speech.text, 0, 1);
      x.restore();
    }

    function draw(dt = 0.016) {
      const k = HERO_CHARS[ch];
      const sx = (1 + 0.3 * sq) * (k.deco === 'butter' ? 0.88 : k.deco === 'peanut' ? 0.86 : 1);
      const sy = (1 - 0.42 * sq) * (k.deco === 'butter' ? 1.04 : 1);
      const cy = floor - R * sy;
      x.clearRect(0, 0, W, H);
      if (hero3d) {
        hero3d.renderFrame({
          W,
          H,
          cx,
          floor,
          R,
          ch,
          charObj: k,
          sq,
          sqv,
          press,
          px,
          py,
          lx,
          ly,
          blink,
          t,
          dt,
        });
        callouts(sx, sy, cy);
        drawSpeechBubble(sx, sy, cy);
        sparks.forEach((s) => {
          x.globalAlpha = Math.max(0, s.l);
          x.fillStyle = s.h ? '#fff' : '#ffc4de';
          x.beginPath();
          x.arc(s.x, s.y, s.s * s.l + 1, 0, 7);
          x.fill();
        });
        x.globalAlpha = 1;
        return;
      }

      // floor glow + shadow (2D fallback)
      let g = x.createRadialGradient(cx, floor + 8, 0, cx, floor + 8, R * 1.8);
      g.addColorStop(0, 'rgba(255,225,240,.55)');
      g.addColorStop(1, 'rgba(255,225,240,0)');
      x.fillStyle = g;
      x.beginPath();
      x.ellipse(cx, floor + 8, R * 1.8, R * 0.42, 0, 0, 7);
      x.fill();
      x.fillStyle = `rgba(60,25,60,${0.32 + 0.1 * sq})`;
      x.beginPath();
      x.ellipse(cx, floor + 6, R * (0.95 + 0.35 * sq), R * 0.17, 0, 0, 7);
      x.fill();

      // decorations behind body (2D fallback if WebGL unavailable)
      const top = cy - R * sy;
      if (k.deco === 'dumpling') {
        // Steamed dumpling top knots / pleats
        for (const a of [-0.24, 0, 0.24]) {
          x.save();
          x.translate(cx + a * R * sx, top + R * 0.03);
          x.rotate(a * 0.7 + sqv * 0.02);
          x.fillStyle = a === 0 ? k.c1 : k.c2;
          x.beginPath();
          x.ellipse(0, -R * 0.11, R * 0.13, R * 0.16, 0, 0, 7);
          x.fill();
          x.strokeStyle = 'rgba(210, 145, 120, 0.45)';
          x.lineWidth = 2;
          x.stroke();
          x.restore();
        }
      } else if (k.deco === 'catpaw') {
        // 4 puffy cat paw toe beans along the top arc
        const toes = [
          [-0.58, 0.18, -0.38],
          [-0.21, -0.02, -0.12],
          [0.21, -0.02, 0.12],
          [0.58, 0.18, 0.38],
        ];
        toes.forEach(([ox, oy, rot]) => {
          x.save();
          x.translate(cx + ox * R * sx, top + oy * R * sy);
          x.rotate(rot + sqv * 0.015 * ox);
          x.fillStyle = '#fff5fa';
          x.beginPath();
          x.ellipse(0, 0, R * 0.19, R * 0.23, 0, 0, 7);
          x.fill();
          x.fillStyle = '#ff94b8';
          x.beginPath();
          x.ellipse(0, R * 0.02, R * 0.1, R * 0.13, 0, 0, 7);
          x.fill();
          x.restore();
        });
      } else if (k.deco === 'peanut') {
        // Cute cream puff on top of the peanut
        x.save();
        x.translate(cx, top + R * 0.02);
        x.rotate(sqv * 0.02);
        x.fillStyle = '#fff8ee';
        x.beginPath();
        x.ellipse(0, -R * 0.06, R * 0.22, R * 0.11, -0.1, 0, 7);
        x.fill();
        x.restore();
      }

      // body
      body();
      g = x.createRadialGradient(cx - R * 0.4 * sx, cy - R * 0.5 * sy, R * 0.05, cx, cy, R * 1.5);
      g.addColorStop(0, k.c1);
      g.addColorStop(0.5, k.c2);
      g.addColorStop(1, k.c3);
      x.fillStyle = g;
      x.fill();

      // Inner product details clipped to body
      x.save();
      x.clip();
      if (k.deco === 'cheese') {
        // Swiss cheese craters
        const holes = [
          [-0.18, -0.56, 0.11],
          [0.52, -0.36, 0.17],
          [-0.58, 0.38, 0.13],
          [0.48, 0.48, 0.15],
          [0.14, -0.28, 0.08],
        ];
        holes.forEach(([hx, hy, hr]) => {
          x.fillStyle = 'rgba(205, 138, 18, 0.42)';
          x.beginPath();
          x.ellipse(cx + hx * R * sx, cy + hy * R * sy, hr * R * sx, hr * R * sy, 0, 0, 7);
          x.fill();
          x.fillStyle = 'rgba(255, 245, 190, 0.45)';
          x.beginPath();
          x.ellipse(
            cx + (hx - 0.02) * R * sx,
            cy + (hy - 0.02) * R * sy,
            hr * 0.7 * R * sx,
            hr * 0.7 * R * sy,
            0,
            0,
            7
          );
          x.fill();
        });
      } else if (k.deco === 'toast') {
        // Pastel toast top glaze band
        x.fillStyle = 'rgba(255, 255, 255, 0.52)';
        x.beginPath();
        x.roundRect(
          cx - R * 0.58 * sx,
          cy - R * 0.72 * sy,
          R * 1.16 * sx,
          R * 0.34 * sy,
          R * 0.14
        );
        x.fill();
      } else if (k.deco === 'butter') {
        // Full top wrapper cap starting from the very top edge (matching product-butter.svg)
        x.fillStyle = '#ffd34d';
        x.fillRect(cx - R * 1.2 * sx, cy - R * 1.25 * sy, R * 2.4 * sx, R * 0.78 * sy);
        // Subtle wrapper fold line
        x.fillStyle = 'rgba(180, 130, 10, 0.18)';
        x.fillRect(cx - R * 1.2 * sx, cy - R * 0.47 * sy, R * 2.4 * sx, R * 0.025 * sy);
        // Crisp unobstructed 'BUTTER' title
        x.fillStyle = '#8a6b00';
        x.font = `800 ${Math.max(15, R * 0.15)}px Nunito,Fredoka,sans-serif`;
        x.textAlign = 'center';
        x.fillText('BUTTER', cx, cy - R * 0.66 * sy);
        // Bottom weight markings matching product-butter.svg
        x.fillStyle = '#a98a2e';
        x.font = `800 ${Math.max(11, R * 0.085)}px Nunito,sans-serif`;
        x.fillText('4oz', cx, cy + R * 0.56 * sy);
        x.fillStyle = '#bba254';
        x.font = `700 ${Math.max(9, R * 0.065)}px Nunito,sans-serif`;
        x.fillText('NET WT. (113 G)', cx, cy + R * 0.68 * sy);
      } else if (k.deco === 'peanut') {
        // Subtle woven peanut shell ridges along outer edges
        x.strokeStyle = 'rgba(150, 98, 42, 0.24)';
        x.lineWidth = Math.max(2, R * 0.024);
        x.beginPath();
        x.arc(cx - R * 0.22 * sx, cy - R * 0.34 * sy, R * 0.48 * sy, Math.PI * 0.75, Math.PI * 1.25);
        x.stroke();
        x.beginPath();
        x.arc(cx + R * 0.22 * sx, cy + R * 0.34 * sy, R * 0.48 * sy, -Math.PI * 0.25, Math.PI * 0.25);
        x.stroke();
      } else if (k.deco === 'catpaw') {
        // Soft pink central paw cushion glow behind face
        x.fillStyle = 'rgba(255, 148, 188, 0.25)';
        x.beginPath();
        x.ellipse(cx, cy + R * 0.12 * sy, R * 0.58 * sx, R * 0.46 * sy, 0, 0, 7);
        x.fill();
      } else if (k.deco === 'dumpling') {
        // Cute pink heart mark on the dumpling forehead
        const hx = cx;
        const hy = cy - R * 0.42 * sy;
        const hs = R * 0.075;
        x.fillStyle = '#e86c9a';
        x.beginPath();
        x.moveTo(hx, hy + hs);
        x.bezierCurveTo(hx - hs * 1.4, hy, hx - hs * 0.8, hy - hs * 1.1, hx, hy - hs * 0.35);
        x.bezierCurveTo(hx + hs * 0.8, hy - hs * 1.1, hx + hs * 1.4, hy, hx, hy + hs);
        x.fill();
      }

      g = x.createRadialGradient(cx, floor + R * 0.1, R * 0.1, cx, floor, R * 1.1);
      g.addColorStop(0, 'rgba(255,255,255,.34)');
      g.addColorStop(1, 'rgba(255,255,255,0)');
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
      g = x.createLinearGradient(cx + R * 0.5, cy - R, cx + R, cy + R);
      g.addColorStop(0, 'rgba(120,30,80,0)');
      g.addColorStop(1, 'rgba(120,30,80,.28)');
      x.fillStyle = g;
      x.fillRect(0, 0, W, H);
      if (press) {
        g = x.createRadialGradient(px, py, 0, px, py, R * 0.7);
        g.addColorStop(0, 'rgba(120,30,80,.3)');
        g.addColorStop(1, 'rgba(120,30,80,0)');
        x.fillStyle = g;
        x.fillRect(0, 0, W, H);
      }
      x.restore();
      body();
      x.lineWidth = 2;
      x.strokeStyle = 'rgba(255,255,255,.4)';
      x.stroke();
      // gloss
      const glossX = k.deco === 'butter' ? -0.62 : -0.42;
      const glossY = k.deco === 'butter' ? -0.22 : -0.48;
      const dotX = k.deco === 'butter' ? -0.48 : -0.22;
      const dotY = k.deco === 'butter' ? -0.36 : -0.62;
      x.save();
      x.translate(cx + R * glossX * sx, cy + R * glossY * sy);
      x.rotate(-0.65);
      x.fillStyle = `rgba(255,255,255,${0.72 - 0.3 * sq})`;
      x.beginPath();
      x.ellipse(0, 0, R * 0.18 * (1 + 0.2 * sq), R * 0.09, 0, 0, 7);
      x.fill();
      x.restore();
      x.fillStyle = 'rgba(255,255,255,.7)';
      x.beginPath();
      x.arc(cx + R * dotX * sx, cy + R * dotY * sy, R * 0.035, 0, 7);
      x.fill();
      // face
      const fx = cx + Math.max(-1, Math.min(1, lx)) * R * 0.1;
      const fy = cy + R * 0.08 * sy + Math.max(-1, Math.min(1, ly)) * R * 0.05;
      const ex = R * 0.28 * sx;
      const ink = '#3d1f3d';
      x.fillStyle = 'rgba(255,90,130,.55)';
      for (const sd of [-1, 1]) {
        x.beginPath();
        x.ellipse(fx + sd * R * 0.45 * sx, fy + R * 0.14, R * 0.1, R * 0.065, 0, 0, 7);
        x.fill();
      }
      x.strokeStyle = ink;
      x.fillStyle = ink;
      x.lineWidth = R * 0.04;
      x.lineCap = 'round';
      x.lineJoin = 'round';
      for (const sd of [-1, 1]) {
        const ox = fx + sd * ex;
        if (sq > 0.35) {
          x.beginPath();
          x.moveTo(ox - sd * R * 0.07, fy - R * 0.07);
          x.lineTo(ox + sd * R * 0.07, fy);
          x.lineTo(ox - sd * R * 0.07, fy + R * 0.07);
          x.stroke();
        } else if (blink < 0) {
          x.beginPath();
          x.moveTo(ox - R * 0.06, fy);
          x.lineTo(ox + R * 0.06, fy);
          x.stroke();
        } else {
          x.beginPath();
          x.ellipse(ox, fy, R * 0.05, R * (sq < -0.25 ? 0.075 : 0.06), 0, 0, 7);
          x.fill();
          x.fillStyle = '#fff';
          x.beginPath();
          x.arc(ox - R * 0.015, fy - R * 0.02, R * 0.016, 0, 7);
          x.fill();
          x.fillStyle = ink;
        }
      }
      x.beginPath();
      if (sq > 0.35) {
        x.ellipse(fx, fy + R * 0.2, R * 0.07, R * 0.09 * (1 + sq * 0.4), 0, 0, 7);
        x.fill();
      } else if (sq < -0.25) {
        x.ellipse(fx, fy + R * 0.18, R * 0.05, R * 0.06, 0, 0, 7);
        x.fill();
      } else {
        x.arc(fx, fy + R * 0.1, R * 0.1, 0.15 * Math.PI, 0.85 * Math.PI);
        x.stroke();
      }
      callouts(sx, sy, cy);
      drawSpeechBubble(sx, sy, cy);
      // sparks
      sparks.forEach((s) => {
        x.globalAlpha = Math.max(0, s.l);
        x.fillStyle = s.h ? '#fff' : '#ffc4de';
        x.beginPath();
        x.arc(s.x, s.y, s.s * s.l + 1, 0, 7);
        x.fill();
      });
      x.globalAlpha = 1;
    }

    const hist = new Array(48).fill(0);
    const letters = [...hero.querySelectorAll('.l')];
    function ripple() {
      hist.push(sq);
      hist.shift();
      hero.style.setProperty('--sq', sq.toFixed(3));
      if (reduce) return;
      letters.forEach((l, i) => {
        const v = hist[47 - Math.min(47, i * 2)];
        l.style.transform = `translateY(${v * 10}px) scale(${1 + v * 0.06},${1 - v * 0.2})`;
      });
    }

    let last = performance.now();
    let rafId = 0;
    let heroVisible = true;
    let pageVisible = !document.hidden;

    function loop(now) {
      if (!heroVisible || !pageVisible) {
        rafId = 0;
        return;
      }
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      t += dt;
      for (let i = 0; i < 3; i += 1) step(dt / 3);
      if (!reduce && !press && !used && Math.abs(sq) < 0.02) {
        sq = 0.04 * Math.sin(t * 2.2);
      }
      ripple();
      draw(dt);
      sbEl.style.height = `${stress}%`;
      svEl.textContent = `${Math.round(stress)}%`;
      rafId = requestAnimationFrame(loop);
    }

    function syncLoop() {
      if (heroVisible && pageVisible) {
        if (!rafId) {
          last = performance.now();
          rafId = requestAnimationFrame(loop);
        }
      } else if (rafId) {
        cancelAnimationFrame(rafId);
        rafId = 0;
      }
    }

    function onVisibilityChange() {
      pageVisible = !document.hidden;
      syncLoop();
    }

    const io =
      typeof IntersectionObserver !== 'undefined'
        ? new IntersectionObserver(
            ([entry]) => {
              heroVisible = Boolean(entry?.isIntersecting);
              syncLoop();
            },
            { threshold: 0.01 }
          )
        : null;
    if (io) io.observe(hero);
    document.addEventListener('visibilitychange', onVisibilityChange);

    rafId = requestAnimationFrame(loop);

    return () => {
      if (rafId) cancelAnimationFrame(rafId);
      if (io) io.disconnect();
      document.removeEventListener('visibilitychange', onVisibilityChange);
      if (hero3d) hero3d.dispose();
      window.removeEventListener('resize', resize);
      if (ro) ro.disconnect();
      if (mq.removeEventListener) mq.removeEventListener('change', onMotionChange);
      c.removeEventListener('pointerdown', onPointerDown);
      c.removeEventListener('pointermove', onPointerMove);
      c.removeEventListener('pointerup', release);
      c.removeEventListener('pointercancel', release);
      c.removeEventListener('pointerleave', onPointerLeave);
      pickEl.removeEventListener('click', onPickClick);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCatalog() {
      try {
        const result = await SquishiesAPI.fetchProducts();
        const catalog = getCatalogArray(result);

        if (cancelled || catalog.length === 0) return;

        setProducts(catalog);
        syncProducts(catalog);
      } catch (error) {
        if (cancelled) return;
        console.warn('Using fallback Squishies catalog:', error.message);
      }
    }

    loadCatalog();

    return () => {
      cancelled = true;
    };
  }, [syncProducts]);

  const productsBySlug = new Map(
    products.map((product) => [product.slug, product])
  );

  function handleAddToCart(slug) {
    const product = productsBySlug.get(slug);

    if (!product) {
      showToast('This product could not be loaded. Please refresh.');
      return;
    }

    addToCart(product);
  }

  function getProductName(product, fallbackName) {
    return product?.name || fallbackName;
  }

  function getProductPrice(product) {
    return product ? formatPeso(product.price) : '—';
  }

  function isUnavailable(product) {
    return !product || product.stockQuantity <= 0;
  }

  function getAddButtonText(product, normalText) {
    if (!product) return 'Unavailable';
    if (product.stockQuantity <= 0) return 'Out of stock';
    return normalText;
  }

  return (
    <div className="home-jelly">
    <>
      {/* ============ HERO ============ */}
      <header className="hero" id="hero" ref={heroRef}>
        <h1 aria-label="Squeeze the stress away.">
          <span className="ln" data-t="Squeeze the">
            {[...'Squeeze the'].map((k, idx) => (
              <span key={`a-${idx}`} className="l" aria-hidden="true">
                {k === ' ' ? '\u00A0' : k}
              </span>
            ))}
          </span>
          <span className="ln b" data-t="stress away.">
            {[...'stress away.'].map((k, idx) => (
              <span key={`b-${idx}`} className="l" aria-hidden="true">
                {k === ' ' ? '\u00A0' : k}
              </span>
            ))}
          </span>
        </h1>
        <canvas
          className="hero__canvas-3d"
          ref={canvas3dRef}
          aria-hidden="true"
        />
        <canvas
          id="c"
          ref={canvasRef}
          aria-label="Interactive 3D squishy. Tap to poke, press and hold to squish."
        />
        <div className="o gauge" aria-live="polite">
          <div className="tube">
            <i id="sb" ref={stressBarRef} />
          </div>
          <b id="sv" ref={stressValRef}>
            100%
          </b>
          <span>stress</span>
          <em>
            <b
              id="cn"
              ref={squishCountRef}
              style={{ display: 'inline', fontSize: 'inherit' }}
            >
              0
            </b>{' '}
            squishes
          </em>
        </div>
        <div className="o intro">
          <p>
            Cute, ultra-soft, slow-rising Squishies made for your study breaks,
            desk moments, and everyday smiles.
          </p>
          <a className="cta" href="#shop">
            Pick your squish
          </a>
          <ul className="facts">
            <li>Ages 3+</li>
            <li>Non-toxic</li>
            <li>BPA-free</li>
            <li>Hypoallergenic</li>
            <li>Low-odor</li>
          </ul>
        </div>
        <div className="hint" id="hint" ref={hintRef}>
          Tap to poke. Press and hold to squish.
        </div>
        <div
          className="pick"
          role="group"
          aria-label="Choose a squishy"
          id="pick"
          ref={pickRef}
        >
          {HERO_CHARS.map((k, i) => (
            <button
              key={k.name}
              type="button"
              aria-pressed={i === 0 ? 'true' : 'false'}
              data-i={i}
            >
              {k.name}
            </button>
          ))}
        </div>
      </header>

      {/* ============ MOST SQUEEZED (3D INTERACTIVE SHOWROOM) ============ */}
      <section className="products" id="shop">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow eyebrow--pink">
              ★ Interactive 3D Showroom
            </span>
            <h2>Most Squeezed</h2>
            <p>
              Spin, inspect, and squish our real 3D models right from the shelf.
            </p>

            <div
              className="shelf-tabs"
              role="tablist"
              aria-label="3D Product Lineup"
            >
              <button
                type="button"
                role="tab"
                aria-selected={activeShelf === 'faves'}
                className={`shelf-tab${activeShelf === 'faves' ? ' is-active' : ''}`}
                onClick={() => setActiveShelf('faves')}
              >
                Fan Faves Trio (3D)
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={activeShelf === 'bakery'}
                className={`shelf-tab${activeShelf === 'bakery' ? ' is-active' : ''}`}
                onClick={() => setActiveShelf('bakery')}
              >
                Bakery &amp; Sweet Cream (3D)
              </button>
            </div>
          </div>

          <div className="product-grid">
            {(activeShelf === 'faves'
              ? featuredProducts.slice(0, 3)
              : [featuredProducts[3], featuredProducts[4], featuredProducts[0]]
            ).map((featured) => {
              const product = productsBySlug.get(featured.slug);
              const modelUrl = PRODUCT_MODELS[featured.slug];
              const pulseCount = squishPulses[featured.slug] || 0;

              return (
                <article
                  className="product-card product-card--3d"
                  key={featured.slug}
                  onPointerEnter={() =>
                    SquishiesAPI.prefetchProduct?.(featured.slug)
                  }
                >
                  <div className="product-card__media product-card__media--3d">
                    <div className="product-card__pedestal" aria-hidden="true" />
                    {modelUrl ? (
                      <Suspense
                        fallback={
                          <img
                            src={getImage(product, featured.image)}
                            alt={featured.alt}
                            width="400"
                            height="300"
                            loading="lazy"
                          />
                        }
                      >
                        <ProductViewer3D
                          url={modelUrl}
                          alt={featured.alt}
                          fallbackImage={getImage(product, featured.image)}
                          compact
                          pulseSignal={pulseCount}
                        />
                      </Suspense>
                    ) : (
                      <img
                        src={getImage(product, featured.image)}
                        alt={featured.alt}
                        width="400"
                        height="300"
                        loading="lazy"
                      />
                    )}
                    <span className={`badge ${featured.badgeClass}`}>
                      {featured.badge}
                    </span>
                    <button
                      type="button"
                      className="squish-3d-btn"
                      onClick={() =>
                        setSquishPulses((prev) => ({
                          ...prev,
                          [featured.slug]: (prev[featured.slug] || 0) + 1,
                        }))
                      }
                      aria-label={`Squish ${featured.name} in 3D`}
                    >
                      Squish 3D
                    </button>
                  </div>

                  <div className="product-card__body">
                    <div className="product-card__specs-row">
                      <span className="spec-chip">{featured.riseTime}</span>
                      <span className="spec-chip">{featured.feel}</span>
                    </div>

                    <h3>
                      <Link
                        to={`/product.html?slug=${encodeURIComponent(featured.slug)}`}
                      >
                        {getProductName(product, featured.name)}
                      </Link>
                    </h3>

                    <p className="product-card__desc">{featured.description}</p>

                    <div className="softness-meter" aria-label={`Softness rating ${featured.softness}%`}>
                      <div className="softness-meter__label">
                        <span>Squish Softness</span>
                        <strong>{featured.softness}%</strong>
                      </div>
                      <div className="softness-meter__track">
                        <div
                          className="softness-meter__fill"
                          style={{ width: `${featured.softness}%` }}
                        />
                      </div>
                    </div>

                    <div className="product-card__footer">
                      <div className="product-card__price-stack">
                        <span className="price">{getProductPrice(product)}</span>
                        <Link
                          to={`/product.html?slug=${encodeURIComponent(featured.slug)}`}
                          className="inspect-3d-link"
                        >
                          Open 3D Studio →
                        </Link>
                      </div>

                      <button
                        className="btn btn--pink btn--sm add-to-cart"
                        type="button"
                        data-slug={featured.slug}
                        disabled={isUnavailable(product)}
                        onClick={() => handleAddToCart(featured.slug)}
                      >
                        {getAddButtonText(product, '+ Add to Cart')}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="section-cta">
            <Link to="/shop.html" className="btn btn--outline">
              View All Squishies →
            </Link>
          </div>
        </div>
      </section>

      {/* ============ PROMO SETS (UNBOX & SAVE SHOWCASE) ============ */}
      <section className="promo" id="promo">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow eyebrow--pink">
              ★ Curated Gift Boxes &amp; Bundles
            </span>
            <h2>Promo Sets</h2>
            <p>
              More squish, bigger savings. Pick a vibe below or unbox a curated
              set.
            </p>

            <div
              className="promo-vibe-bar"
              role="group"
              aria-label="Match your squish goal"
            >
              {[
                { id: 'all', label: 'All Sets' },
                { id: 'desk', label: 'Study Desk (1×)' },
                { id: 'trio', label: 'Bestie Gift (3×)' },
                { id: 'collector', label: 'Full Collector (6×)' },
                { id: 'party', label: 'Party / Bulk (20×)' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  className={`promo-vibe-pill${activePromoVibe === tab.id ? ' is-active' : ''}`}
                  onClick={() => setActivePromoVibe(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="promo-grid">
            {promoSets.map((bundle) => {
              const product = productsBySlug.get(bundle.slug);
              const isSpotlight =
                activePromoVibe !== 'all' && activePromoVibe === bundle.vibe;
              const isDimmed =
                activePromoVibe !== 'all' && activePromoVibe !== bundle.vibe;

              return (
                <article
                  className={`promo-card promo-card--${bundle.accent}${
                    bundle.featured ? ' promo-card--featured' : ''
                  }${isSpotlight ? ' promo-card--spotlight' : ''}${
                    isDimmed ? ' promo-card--dimmed' : ''
                  }`}
                  key={bundle.slug}
                >
                  {bundle.featured && (
                    <span className="badge badge--purple badge--pill">
                      Most Popular ★
                    </span>
                  )}

                  {/* Visual Gift Box Stage */}
                  <div className="promo-card__stage" aria-hidden="true">
                    <div className="promo-card__stage-glow" />
                    <span className="promo-card__count-orb">
                      {bundle.countLabel}
                    </span>
                    <span className="promo-card__unit-pill">
                      {bundle.unitPrice}
                    </span>

                    <div
                      className={`promo-card__fan promo-card__fan--${bundle.previewImages.length}`}
                    >
                      {bundle.previewImages.map((imgSrc, idx) => (
                        <div
                          className="promo-card__fan-item"
                          key={`${bundle.slug}-img-${idx}`}
                          style={{ '--fan-idx': idx }}
                        >
                          <img
                            src={imgSrc}
                            alt=""
                            width="88"
                            height="66"
                            loading="lazy"
                          />
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="promo-card__body">
                    <div className="promo-card__top-tags">
                      <span className="promo-card__perk-tag">
                        {bundle.perk}
                      </span>
                      {bundle.savings && (
                        <span className="badge badge--mint badge--floating">
                          {bundle.savings}
                        </span>
                      )}
                    </div>

                    <h3>{getProductName(product, bundle.name)}</h3>

                    <p className="promo-card__meta">{bundle.meta}</p>

                    <p className="promo-card__price">
                      {getProductPrice(product)}
                      {bundle.oldPrice && (
                        <>
                          {' '}
                          <s>{formatPeso(bundle.oldPrice)}</s>
                        </>
                      )}
                    </p>

                    <p className="promo-card__desc">{bundle.description}</p>

                    <ul className="promo-card__list">
                      {bundle.items.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  </div>

                  <button
                    className={`btn ${bundle.buttonClass} promo-card__btn add-to-cart`}
                    type="button"
                    data-slug={bundle.slug}
                    disabled={isUnavailable(product)}
                    onClick={() => handleAddToCart(bundle.slug)}
                  >
                    {getAddButtonText(product, bundle.button)}
                  </button>
                </article>
              );
            })}
          </div>
        </div>
      </section>
    </>
    </div>
  );
}
