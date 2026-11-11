import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { SquishiesAPI } from '../services/api';
import { useCart } from '../context/CartContext';
import { FALLBACK_PRODUCTS } from '../data/catalogFallback';

const HERO_CHARS = [
  { name: 'Peach Pie', c1: '#ffd2e0', c2: '#ff86ab', c3: '#d9507f', n: 2, deco: 'leaf', p: 89 },
  { name: 'Toasty', c1: '#fdebc2', c2: '#f1c57c', c3: '#c4903f', n: 4.2, deco: 'toast', p: 99 },
  { name: 'Chickie', c1: '#fff6b0', c2: '#ffd94f', c3: '#e5a31c', n: 2, deco: 'chick', p: 89 },
  { name: 'Bun-Bun', c1: '#ffd8e8', c2: '#ff9fc6', c3: '#d4659a', n: 2, deco: 'bunny', p: 109 },
];

const featuredProducts = [
  {
    slug: 'dumpling',
    name: 'Steamed Dumpling Squishy',
    description: 'Pastel bao with a happy face',
    image: '/assets/images/product-dumpling.svg',
    alt: 'Steamed Dumpling Squishy — pastel bao with a happy face',
    badge: 'Fan Fave',
    badgeClass: 'badge--pink',
  },
  {
    slug: 'catpaw',
    name: 'Cat Paw Squishy',
    description: 'Pink paw pads, ultra soft',
    image: '/assets/images/product-catpaw.svg',
    alt: 'Cat Paw Squishy — pink paw pads, ultra soft',
    badge: 'So Cute',
    badgeClass: 'badge--pink',
  },
  {
    slug: 'peanut',
    name: 'Peanut Squishy',
    description: 'Textured shell, mega squeezable',
    image: '/assets/images/product-peanut.svg',
    alt: 'Peanut Squishy — textured shell, mega squeezable',
    badge: 'Bestseller',
    badgeClass: 'badge--mint',
  },
];

const promoSets = [
  {
    slug: 'solo-squish',
    name: 'Solo Squish',
    meta: '1 Squishy',
    description: 'A classic first squish: one smiling Dumpling.',
    items: [
      '1 Dumpling Squishy',
      'Individual gift pouch',
      'Sticker included',
    ],
    button: 'Get One',
    buttonClass: 'btn--lavender',
    image: '/assets/images/product-dumpling.svg',
  },
  {
    slug: 'stress-free-trio',
    name: 'Stress-Free Trio',
    meta: '3 Squishies',
    description: 'One for desk, one for bag, one for gifting.',
    items: [
      'Dumpling, Cat Paw & Peanut',
      'Ribbon-tied gift box',
      '2 bonus stickers',
    ],
    button: 'Get the Trio',
    buttonClass: 'btn--pink',
    image: '/assets/images/product-catpaw.svg',
    savings: 'Save ₱18',
    oldPrice: 267,
  },
  {
    slug: 'collectors-box',
    name: "Collector's Box",
    meta: '6 Different Designs',
    description: 'The full experience. Six unique designs, curated for you.',
    items: [
      '6 unique Squishies',
      'Keepsake collector box',
      'Full sticker sheet',
      'Mystery bonus item',
    ],
    button: 'Build My Collection',
    buttonClass: 'btn--dark',
    image: '/assets/images/hero-collage.svg',
    featured: true,
    savings: 'Free Sticker Sheet',
  },
  {
    slug: 'party-pack',
    name: 'Wholesale / Party Pack',
    meta: '20 Squishies',
    description: 'Events, giveaways, or reselling. Bulk pricing, full variety.',
    items: [
      '4 Dumplings, 4 Cat Paws & 3 each of the other designs',
      'Bulk poly bag packaging',
      'Custom note option',
      'Priority dispatch',
    ],
    button: 'Order in Bulk',
    buttonClass: 'btn--peach',
    image: '/assets/images/product-peanut.svg',
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
  const [products, setProducts] = useState(FALLBACK_PRODUCTS);
  const { addToCart, syncProducts, showToast } = useCart();
  const heroRef = useRef(null);
  const canvasRef = useRef(null);
  const hintRef = useRef(null);
  const pickRef = useRef(null);
  const stressBarRef = useRef(null);
  const stressValRef = useRef(null);
  const squishCountRef = useRef(null);

  useEffect(() => {
    const hero = heroRef.current;
    const c = canvasRef.current;
    const hintEl = hintRef.current;
    const pickEl = pickRef.current;
    const sbEl = stressBarRef.current;
    const svEl = stressValRef.current;
    const cnEl = squishCountRef.current;
    if (!hero || !c || !pickEl || !sbEl || !svEl || !cnEl) return undefined;

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
      const sx = 1 + 0.3 * sq;
      const sy = 1 - 0.42 * sq;
      const cy = floor - R * sy;
      const n = HERO_CHARS[ch].n;
      for (let i = 0; i < N; i += 1) {
        const p = pts[i];
        const c0 = Math.cos(p.a);
        const s0 = Math.sin(p.a);
        const r = R / Math.pow(Math.pow(Math.abs(c0), n) + Math.pow(Math.abs(s0), n), 1 / n);
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

    function draw() {
      const k = HERO_CHARS[ch];
      const sx = 1 + 0.3 * sq;
      const sy = 1 - 0.42 * sq;
      const cy = floor - R * sy;
      x.clearRect(0, 0, W, H);
      // floor glow + shadow
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
      // decorations behind body
      const top = cy - R * sy;
      if (k.deco === 'bunny') {
        for (const sd of [-1, 1]) {
          x.save();
          x.translate(cx + sd * R * 0.38 * sx, top + R * 0.1);
          x.rotate(sd * 0.16 + sqv * 0.02 * sd);
          x.fillStyle = k.c2;
          x.beginPath();
          x.ellipse(0, -R * 0.5 * (1 + 0.15 * sq), R * 0.2, R * 0.5 * (1 + 0.15 * sq), 0, 0, 7);
          x.fill();
          x.fillStyle = '#ffd0e2';
          x.beginPath();
          x.ellipse(0, -R * 0.5 * (1 + 0.15 * sq), R * 0.1, R * 0.36 * (1 + 0.15 * sq), 0, 0, 7);
          x.fill();
          x.restore();
        }
      }
      if (k.deco === 'leaf') {
        x.save();
        x.translate(cx + R * 0.04, top + R * 0.04);
        x.rotate(0.5 + sqv * 0.03);
        x.fillStyle = '#6fcf8a';
        x.beginPath();
        x.ellipse(R * 0.14, -R * 0.12, R * 0.2, R * 0.09, -0.5, 0, 7);
        x.fill();
        x.strokeStyle = '#8b5a6e';
        x.lineWidth = R * 0.05;
        x.lineCap = 'round';
        x.beginPath();
        x.moveTo(0, R * 0.05);
        x.lineTo(-R * 0.03, -R * 0.16);
        x.stroke();
        x.restore();
      }
      if (k.deco === 'chick') {
        x.fillStyle = k.c2;
        for (const a of [-0.3, 0, 0.3]) {
          x.save();
          x.translate(cx + a * R, top + R * 0.05);
          x.rotate(a * 0.8);
          x.beginPath();
          x.ellipse(0, -R * 0.1, R * 0.07, R * 0.15, 0, 0, 7);
          x.fill();
          x.restore();
        }
      }
      // body
      body();
      g = x.createRadialGradient(cx - R * 0.4 * sx, cy - R * 0.5 * sy, R * 0.05, cx, cy, R * 1.5);
      g.addColorStop(0, k.c1);
      g.addColorStop(0.5, k.c2);
      g.addColorStop(1, k.c3);
      x.fillStyle = g;
      x.fill();
      x.save();
      x.clip();
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
      x.save();
      x.translate(cx - R * 0.42 * sx, cy - R * 0.48 * sy);
      x.rotate(-0.65);
      x.fillStyle = `rgba(255,255,255,${0.72 - 0.3 * sq})`;
      x.beginPath();
      x.ellipse(0, 0, R * 0.2 * (1 + 0.2 * sq), R * 0.1, 0, 0, 7);
      x.fill();
      x.restore();
      x.fillStyle = 'rgba(255,255,255,.7)';
      x.beginPath();
      x.arc(cx - R * 0.22 * sx, cy - R * 0.62 * sy, R * 0.035, 0, 7);
      x.fill();
      // face
      const fx = cx + Math.max(-1, Math.min(1, lx)) * R * 0.1;
      const fy = cy + R * 0.06 * sy + Math.max(-1, Math.min(1, ly)) * R * 0.05;
      const ex = R * 0.3 * sx;
      const ink = '#3d1f3d';
      x.fillStyle = 'rgba(255,90,130,.55)';
      for (const sd of [-1, 1]) {
        x.beginPath();
        x.ellipse(fx + sd * R * 0.48 * sx, fy + R * 0.14, R * 0.1, R * 0.065, 0, 0, 7);
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
      if (k.deco === 'chick') {
        x.fillStyle = '#ff9a3c';
        x.beginPath();
        x.moveTo(fx - R * 0.07, fy + R * 0.1);
        x.lineTo(fx + R * 0.07, fy + R * 0.1);
        x.lineTo(fx, fy + R * 0.18);
        x.closePath();
        x.fill();
        x.fillStyle = ink;
      } else {
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
      }
      callouts(sx, sy, cy);
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
    function loop(now) {
      const dt = Math.min(0.033, (now - last) / 1000);
      last = now;
      t += dt;
      for (let i = 0; i < 3; i += 1) step(dt / 3);
      if (!reduce && !press && !used && Math.abs(sq) < 0.02) {
        sq = 0.04 * Math.sin(t * 2.2);
      }
      ripple();
      draw();
      sbEl.style.height = `${stress}%`;
      svEl.textContent = `${Math.round(stress)}%`;
      rafId = requestAnimationFrame(loop);
    }

    rafId = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafId);
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
          id="c"
          ref={canvasRef}
          aria-label="Interactive squishy. Tap to poke, press and hold to squish."
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

      {/* ============ MOST SQUEEZED (PRODUCTS) ============ */}
      <section className="products" id="shop">
        <div className="container">
          <div className="section-head">
            <span className="eyebrow eyebrow--pink">
              ★ Customer Favorites
            </span>
            <h2>Most Squeezed</h2>
            <p>The ones our customers keep coming back for.</p>
          </div>

          <div className="product-grid">
            {featuredProducts.map((featured) => {
              const product = productsBySlug.get(featured.slug);

              return (
                <article className="product-card" key={featured.slug}>
                  <div className="product-card__media">
                    <img
                      src={getImage(product, featured.image)}
                      alt={featured.alt}
                      width="400"
                      height="300"
                      loading="lazy"
                    />
                    <span
                      className={`badge ${featured.badgeClass}`}
                    >
                      {featured.badge}
                    </span>
                  </div>

                  <div className="product-card__body">
                    <h3>
                      <Link
                        to={`/product.html?slug=${encodeURIComponent(featured.slug)}`}
                      >
                        {getProductName(product, featured.name)}
                      </Link>
                    </h3>

                    <p className="product-card__desc">
                      {featured.description}
                    </p>

                    <div className="product-card__footer">
                      <span className="price">
                        {getProductPrice(product)}
                      </span>

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

      {/* ============ PROMO SETS ============ */}
      <section className="promo" id="promo">
        <div className="container">
          <div className="section-head">
            <h2>Promo Sets</h2>
            <p>More squish, more savings. Pick the set that fits you.</p>
          </div>

          <div className="promo-grid">
            {promoSets.map((bundle) => {
              const product = productsBySlug.get(bundle.slug);

              return (
                <article
                  className={`promo-card${bundle.featured ? ' promo-card--featured' : ''}`}
                  key={bundle.slug}
                >
                  {bundle.featured && (
                    <span className="badge badge--purple badge--pill">
                      Most Popular ★
                    </span>
                  )}

                  <div className="promo-card__body">
                    {bundle.savings && (
                      <span className="badge badge--mint badge--floating">
                        {bundle.savings}
                      </span>
                    )}

                    <h3>
                      {getProductName(product, bundle.name)}
                    </h3>

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

                    <p className="promo-card__desc">
                      {bundle.description}
                    </p>

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
