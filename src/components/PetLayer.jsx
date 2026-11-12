import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import '../styles/pet-layer.css';

const DESKTOP_SIZE = 96;
const MOBILE_SIZE = 72;
const VIEWPORT_PAD = 8;
const POINTER_OFFSET = 70;
const FOLLOW_THRESHOLD = 140;
const MAX_HOP_DIST = 160;
const LITE_HOP_DIST = 108;
const DRAG_THRESHOLD = 8;
const GRAVITY = 2200;
const RESTITUTION = 0.62;
const FLOOR_FRICTION = 5.4;
const THROW_STOP_SPEED = 30;
const THROW_SETTLE_DELAY = 600;
const DESKTOP_SLEEP_MS = 6000;
const TOUCH_WANDER_MS = 3000;
const SPARKLE_COUNT = 6;
const LITE_FPS_INTERVAL = 1000 / 30;

const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, label, [role="button"], [tabindex]';

const DEFAULT_CHAR = {
  slug: 'dumpling',
  name: 'Dumpling',
  c1: '#fff7f0',
  c2: '#fbd9c9',
  c3: '#dfa38f',
  deco: 'dumpling',
};

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function detectStaticLiteMode() {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency;
  const mem = navigator.deviceMemory;
  return (
    (typeof cores === 'number' && cores <= 4) ||
    (typeof mem === 'number' && mem <= 4)
  );
}

function computeBounds(vw, vh, petSize) {
  const halfW = petSize * 0.5;
  const minX = halfW + VIEWPORT_PAD;
  const maxX = Math.max(minX, vw - halfW - VIEWPORT_PAD);
  const minY = petSize + VIEWPORT_PAD;
  const maxY = Math.max(minY, vh - VIEWPORT_PAD);
  return { minX, maxX, minY, maxY, halfW };
}

function getViewportMetrics() {
  const vw = window.innerWidth || 1024;
  const vh = window.innerHeight || 768;
  const petSize = vw < 480 ? MOBILE_SIZE : DESKTOP_SIZE;
  return { vw, vh, petSize, ...computeBounds(vw, vh, petSize) };
}

function PetSpriteSvg({ character, liteMode }) {
  const k = character || DEFAULT_CHAR;
  const deco = k.deco || k.slug || 'dumpling';
  const gradId = `pet-grad-${deco}`;
  const clipId = `pet-clip-${deco}`;

  let bodyPath =
    'M60,18 C89,18 106,39 106,66 C106,93 90,108 60,108 C30,108 14,93 14,66 C14,39 31,18 60,18 Z';
  let glossCx = 40;
  let glossCy = 39;

  if (deco === 'cheese') {
    bodyPath =
      'M60,18 C88,18 104,24 104,63 C104,97 91,108 60,108 C29,108 16,97 16,63 C16,24 32,18 60,18 Z';
  } else if (deco === 'toast') {
    bodyPath =
      'M60,18 C86,18 104,22 104,42 C104,54 101,60 101,74 C101,97 92,108 60,108 C28,108 19,97 19,74 C19,60 16,54 16,42 C16,22 34,18 60,18 Z';
  } else if (deco === 'butter') {
    bodyPath =
      'M60,16 C83,16 96,21 96,62 C96,100 86,108 60,108 C34,108 24,100 24,62 C24,21 37,16 60,16 Z';
    glossCx = 38;
    glossCy = 52;
  } else if (deco === 'peanut') {
    bodyPath =
      'M60,17 C78,17 91,27 91,43 C91,53 84,58 84,64 C84,71 95,78 95,91 C95,103 80,108 60,108 C40,108 25,103 25,91 C25,78 36,71 36,64 C36,58 29,53 29,43 C29,27 42,17 60,17 Z';
  } else if (deco === 'dumpling') {
    bodyPath =
      'M60,21 C86,21 105,40 106,68 C107,95 90,108 60,108 C30,108 13,95 14,68 C15,40 34,21 60,21 Z';
  }

  return (
    <svg
      className="pet-entity__svg"
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={gradId} cx="34%" cy="26%" r="74%">
          <stop offset="0%" stopColor={k.c1} />
          <stop offset="54%" stopColor={k.c2} />
          <stop offset="100%" stopColor={k.c3} />
        </radialGradient>
        <clipPath id={clipId}>
          <path d={bodyPath} />
        </clipPath>
      </defs>

      {/* Behind-body character attachments */}
      {deco === 'dumpling' && (
        <g>
          <ellipse
            cx="48"
            cy="21"
            rx="6"
            ry="7.5"
            transform="rotate(-14 48 21)"
            fill={k.c2}
            stroke="rgba(210,145,120,0.45)"
            strokeWidth="1.5"
          />
          <ellipse
            cx="72"
            cy="21"
            rx="6"
            ry="7.5"
            transform="rotate(14 72 21)"
            fill={k.c2}
            stroke="rgba(210,145,120,0.45)"
            strokeWidth="1.5"
          />
          <ellipse
            cx="60"
            cy="19"
            rx="6.2"
            ry="8"
            fill={k.c1}
            stroke="rgba(210,145,120,0.45)"
            strokeWidth="1.5"
          />
        </g>
      )}

      {deco === 'catpaw' && (
        <g>
          {[
            [33, 29, -22],
            [50, 20, -7],
            [70, 20, 7],
            [87, 29, 22],
          ].map(([tx, ty, rot], idx) => (
            <g key={idx} transform={`translate(${tx}, ${ty}) rotate(${rot})`}>
              <ellipse cx="0" cy="0" rx="8.5" ry="10.5" fill="#fff5fa" />
              <ellipse cx="0" cy="1" rx="4.5" ry="5.8" fill="#ff94b8" />
            </g>
          ))}
        </g>
      )}

      {deco === 'peanut' && (
        <ellipse
          cx="60"
          cy="17"
          rx="10"
          ry="5.2"
          transform="rotate(-6 60 17)"
          fill="#fff8ee"
        />
      )}

      {deco === 'peach' && (
        <path
          d="M62,18 C67,7 81,7 82,16 C75,20 67,20 62,18 Z"
          fill="#7ed48b"
        />
      )}

      {deco === 'chickie' && (
        <path
          d="M55,18 C53,9 60,7 61,15 C64,8 70,11 66,18 Z"
          fill={k.c2}
        />
      )}

      {deco === 'bunbun' && (
        <g>
          <ellipse cx="44" cy="15" rx="7.5" ry="16" fill={k.c2} />
          <ellipse cx="44" cy="15" rx="4" ry="10" fill="#ffb3d1" />
          <ellipse cx="76" cy="15" rx="7.5" ry="16" fill={k.c2} />
          <ellipse cx="76" cy="15" rx="4" ry="10" fill="#ffb3d1" />
        </g>
      )}

      {/* Main body */}
      <path d={bodyPath} fill={`url(#${gradId})`} />

      {/* Inner clipped character details */}
      <g clipPath={`url(#${clipId})`}>
        {deco === 'cheese' && (
          <g>
            {[
              [50, 38, 5],
              [84, 46, 7.8],
              [34, 80, 6],
              [81, 86, 6.8],
              [66, 51, 3.8],
            ].map(([hx, hy, hr], i) => (
              <g key={i}>
                <circle cx={hx} cy={hy} r={hr} fill="rgba(205, 138, 18, 0.42)" />
                <circle
                  cx={hx - 1}
                  cy={hy - 1}
                  r={hr * 0.7}
                  fill="rgba(255, 245, 190, 0.45)"
                />
              </g>
            ))}
          </g>
        )}

        {deco === 'toast' && (
          <rect
            x="33"
            y="29"
            width="54"
            height="16"
            rx="6"
            fill="rgba(255, 255, 255, 0.52)"
          />
        )}

        {deco === 'butter' && (
          <g>
            <rect x="20" y="14" width="80" height="32" fill="#ffd34d" />
            <rect
              x="20"
              y="45"
              width="80"
              height="1.5"
              fill="rgba(180, 130, 10, 0.2)"
            />
            <text
              x="60"
              y="36"
              textAnchor="middle"
              fill="#8a6b00"
              fontFamily="Nunito, Fredoka, sans-serif"
              fontWeight="800"
              fontSize="8.5"
            >
              BUTTER
            </text>
            <text
              x="60"
              y="91"
              textAnchor="middle"
              fill="#a98a2e"
              fontFamily="Nunito, sans-serif"
              fontWeight="800"
              fontSize="6.5"
            >
              4oz
            </text>
          </g>
        )}

        {deco === 'peanut' && (
          <g fill="none" stroke="rgba(150, 98, 42, 0.24)" strokeWidth="1.8">
            <path d="M35,34 A22,22 0 0 0 35,56" />
            <path d="M85,74 A22,22 0 0 1 85,96" />
          </g>
        )}

        {deco === 'catpaw' && (
          <ellipse
            cx="60"
            cy="72"
            rx="26"
            ry="20"
            fill="rgba(255, 148, 188, 0.25)"
          />
        )}

        {deco === 'dumpling' && (
          <path
            d="M60,46 C55.5,40.5 51.5,43.5 55,47.5 L60,52 L65,47.5 C68.5,43.5 64.5,40.5 60,46 Z"
            fill="#e86c9a"
          />
        )}

        {/* Right-bottom soft rim depth */}
        <path
          d="M95,28 C108,52 106,96 70,108 L112,108 L112,24 Z"
          fill="rgba(120, 30, 80, 0.14)"
        />
      </g>

      {/* Soft translucent outer rim */}
      <path
        d={bodyPath}
        fill="none"
        stroke="rgba(255, 255, 255, 0.45)"
        strokeWidth="2"
      />

      {/* Gloss ellipse top-left */}
      <ellipse
        className="pet-gloss"
        cx={glossCx}
        cy={glossCy}
        rx="8.5"
        ry="4.4"
        transform={`rotate(-36 ${glossCx} ${glossCy})`}
        fill={liteMode ? 'rgba(255,255,255,0.68)' : 'rgba(255,255,255,0.78)'}
      />
      <circle cx={glossCx + 9} cy={glossCy - 7} r="2" fill="rgba(255,255,255,0.72)" />

      {/* Cheeks */}
      <ellipse cx="39" cy="74" rx="5.2" ry="3.3" fill="rgba(255, 90, 130, 0.55)" />
      <ellipse cx="81" cy="74" rx="5.2" ry="3.3" fill="rgba(255, 90, 130, 0.55)" />

      {/* Chickie beak if present */}
      {deco === 'chickie' && (
        <polygon points="56,70 64,70 60,76" fill="#ff9f43" />
      )}

      {/* AWAKE face */}
      <g className="pet-face pet-face--awake">
        <g className="pet-eye-open">
          <ellipse cx="47" cy="67" rx="2.7" ry="3.2" fill="#3d1f3d" />
          <circle cx="46.1" cy="65.8" r="0.95" fill="#ffffff" />
          <ellipse cx="73" cy="67" rx="2.7" ry="3.2" fill="#3d1f3d" />
          <circle cx="72.1" cy="65.8" r="0.95" fill="#ffffff" />
        </g>
        <path
          d="M55,74.5 Q60,79 65,74.5"
          fill="none"
          stroke="#3d1f3d"
          strokeWidth="2.3"
          strokeLinecap="round"
        />
      </g>

      {/* SQUISH "> <" face */}
      <g className="pet-face pet-face--squish">
        <polyline
          points="43,63.5 50,67 43,70.5"
          fill="none"
          stroke="#3d1f3d"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="77,63.5 70,67 77,70.5"
          fill="none"
          stroke="#3d1f3d"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <ellipse cx="60" cy="76.5" rx="3.8" ry="4.8" fill="#3d1f3d" />
      </g>

      {/* SLEEP closed-eyes face */}
      <g className="pet-face pet-face--sleep">
        <path
          d="M43.5,67.5 Q47,70.2 50.5,67.5"
          fill="none"
          stroke="#3d1f3d"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <path
          d="M69.5,67.5 Q73,70.2 76.5,67.5"
          fill="none"
          stroke="#3d1f3d"
          strokeWidth="2.2"
          strokeLinecap="round"
        />
        <circle cx="60" cy="75.5" r="2.1" fill="#3d1f3d" />
      </g>
    </svg>
  );
}

export default function PetLayer({
  active,
  returning,
  character,
  launchOrigin,
  getHomeTarget,
  scrollHomeIntoView,
  onReturned,
  onRequestReturn,
}) {
  const [liteMode, setLiteMode] = useState(detectStaticLiteMode);
  const [reducedMotion, setReducedMotion] = useState(() =>
    typeof window !== 'undefined' &&
    Boolean(window.matchMedia?.('(prefers-reduced-motion: reduce)').matches)
  );
  const [liveMsg, setLiveMsg] = useState('');

  const petRef = useRef(null);
  const squashRef = useRef(null);
  const flipRef = useRef(null);
  const shadowRef = useRef(null);
  const sparkleRefs = useRef([]);

  const liveMsgRef = useRef(liveMsg);
  liveMsgRef.current = liveMsg;

  // Shared mutable physics & state container so rAF never triggers React re-renders
  const engineRef = useRef({
    mounted: false,
    active: false,
    returning: false,
    state: 'IDLE', // IDLE | HOP | DRAG | THROWN | SLEEP | RETURNING
    lite: liteMode,
    reduced: reducedMotion,
    vp: { vw: 1024, vh: 768, petSize: 96, minX: 56, maxX: 968, minY: 104, maxY: 760, halfW: 48 },
    x: 500,
    y: 420,
    groundY: 420,
    opacity: 0,
    facing: 1,
    sqX: 1,
    sqY: 1,
    sqVx: 0,
    sqVy: 0,
    stretchAngle: 0,
    stretchAmt: 0,
    ptr: {
      x: 500,
      y: 420,
      hasPtr: false,
      isTouch: false,
      dirty: false,
      lastMovedAt: 0,
    },
    hop: {
      startX: 0,
      startY: 0,
      endX: 0,
      endY: 0,
      duration: 360,
      elapsed: 0,
      arcH: 48,
      pauseLeft: 0,
      landed: false,
      thenSleep: false,
    },
    drag: {
      pointerId: null,
      downX: 0,
      downY: 0,
      pressed: false,
      isDragging: false,
      samples: [],
    },
    throwPhys: {
      vx: 0,
      vy: 0,
      settleTimer: 0,
      settling: false,
    },
    sparkles: Array.from({ length: SPARKLE_COUNT }, () => ({
      active: false,
      x: 0,
      y: 0,
      vx: 0,
      vy: 0,
      life: 0,
    })),
    returnFlow: {
      phase: 'none', // 'scroll' | 'hop' | 'shrink'
      waitMs: 0,
      targetX: 0,
      targetY: 0,
      shrinkMs: 0,
    },
    frameSamples: [],
    rafId: 0,
    lastFrameTime: 0,
    lastLiteTick: 0,
    sleepTimerId: 0,
    touchSleepPending: false,
  });

  // Keep refs synced to callbacks and flags without re-binding listeners
  const callbacksRef = useRef({
    getHomeTarget,
    scrollHomeIntoView,
    onReturned,
    onRequestReturn,
  });
  callbacksRef.current = {
    getHomeTarget,
    scrollHomeIntoView,
    onReturned,
    onRequestReturn,
  };

  useEffect(() => {
    engineRef.current.lite = liteMode;
  }, [liteMode]);

  useEffect(() => {
    engineRef.current.reduced = reducedMotion;
  }, [reducedMotion]);

  // Listen to prefers-reduced-motion changes
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReducedMotion(Boolean(e.matches));
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
    };
  }, []);

  // Announce mount/return cleanly via aria-live
  useEffect(() => {
    if (active && !returning) {
      setLiveMsg('Squishy is roaming the page');
    } else if (!active && liveMsgRef.current === 'Squishy is roaming the page') {
      setLiveMsg('Squishy is back home');
    }
  }, [active, returning]);

  useEffect(() => {
    if (!active) {
      engineRef.current.active = false;
      engineRef.current.returning = false;
      if (engineRef.current.rafId) {
        cancelAnimationFrame(engineRef.current.rafId);
        engineRef.current.rafId = 0;
      }
      if (engineRef.current.sleepTimerId) {
        clearTimeout(engineRef.current.sleepTimerId);
        engineRef.current.sleepTimerId = 0;
      }
      return undefined;
    }

    const eng = engineRef.current;
    eng.mounted = true;
    eng.active = true;
    eng.returning = false;
    eng.lite = detectStaticLiteMode() || eng.lite;
    eng.vp = getViewportMetrics();
    eng.frameSamples.length = 0;

    // Position at exact hero handoff origin
    const originX = clamp(
      launchOrigin?.x ?? eng.vp.vw * 0.5,
      eng.vp.minX,
      eng.vp.maxX
    );
    const originGroundY = clamp(
      launchOrigin?.groundY ?? eng.vp.vh * 0.65,
      eng.vp.minY,
      eng.vp.maxY
    );
    eng.x = originX;
    eng.groundY = originGroundY;
    eng.y = launchOrigin?.y ?? originGroundY;
    eng.opacity = 1;
    eng.facing = 1;
    eng.sqX = launchOrigin?.scaleX ?? 0.92;
    eng.sqY = launchOrigin?.scaleY ?? 1.12;
    eng.sqVx = 0;
    eng.sqVy = 0;
    eng.stretchAmt = 0;
    eng.state = 'HOP';
    eng.touchSleepPending = false;

    const firstTargetX = clamp(originX + 48, eng.vp.minX, eng.vp.maxX);
    const firstTargetY = originGroundY;
    eng.hop = {
      startX: originX,
      startY: originGroundY,
      endX: firstTargetX,
      endY: firstTargetY,
      duration: eng.reduced ? 220 : 340,
      elapsed: 90,
      arcH: eng.reduced ? 0 : Math.max(42, (originGroundY - eng.y) + 28),
      pauseLeft: 0,
      landed: false,
      thenSleep: false,
    };

    if (typeof launchOrigin?.ptrX === 'number') {
      eng.ptr.x = launchOrigin.ptrX;
      eng.ptr.y = launchOrigin.ptrY;
      eng.ptr.hasPtr = true;
      eng.ptr.lastMovedAt = performance.now();
    } else {
      eng.ptr.x = originX;
      eng.ptr.y = originGroundY - eng.vp.petSize * 0.5;
      eng.ptr.hasPtr = false;
      eng.ptr.lastMovedAt = performance.now();
    }

    function applyClasses() {
      const el = petRef.current;
      const sh = shadowRef.current;
      if (!el) return;
      el.classList.toggle('is-idle', eng.state === 'IDLE');
      el.classList.toggle('is-sleeping', eng.state === 'SLEEP');
      el.classList.toggle('is-dragging', eng.state === 'DRAG');
      el.classList.toggle('is-squishing', eng.drag.pressed && !eng.drag.isDragging);
      el.classList.toggle('is-lite', Boolean(eng.lite));
      el.classList.toggle('is-reduced', Boolean(eng.reduced));
      if (sh) sh.classList.toggle('is-reduced', Boolean(eng.reduced));
    }

    function renderDom() {
      const el = petRef.current;
      const sqEl = squashRef.current;
      const flEl = flipRef.current;
      const shEl = shadowRef.current;
      if (!el || !sqEl || !flEl || !shEl) return;

      el.style.transform = `translate3d(${eng.x.toFixed(1)}px, ${eng.y.toFixed(1)}px, 0)`;
      el.style.opacity = String(eng.opacity);

      if (eng.stretchAmt > 0.01 && eng.state === 'DRAG') {
        sqEl.style.transform = `rotate(${eng.stretchAngle.toFixed(1)}deg) scale(${(
          eng.sqX *
          (1 + eng.stretchAmt)
        ).toFixed(3)}, ${(eng.sqY * (1 - eng.stretchAmt * 0.5)).toFixed(3)}) rotate(${(
          -eng.stretchAngle
        ).toFixed(1)}deg)`;
      } else {
        sqEl.style.transform = `scale(${eng.sqX.toFixed(3)}, ${eng.sqY.toFixed(3)})`;
      }

      flEl.style.transform = `scaleX(${eng.facing})`;

      const heightAboveGround = Math.max(0, eng.groundY - eng.y);
      const shScale = Math.max(0.45, 1 - heightAboveGround * 0.0045) * (0.9 + eng.sqX * 0.1);
      const shOpacity = Math.max(0.12, 0.92 - heightAboveGround * 0.0055) * eng.opacity;
      shEl.style.transform = `translate3d(${eng.x.toFixed(1)}px, ${eng.groundY.toFixed(
        1
      )}px, 0) scale(${shScale.toFixed(3)})`;
      shEl.style.opacity = shOpacity.toFixed(3);
    }

    function clearSleepTimer() {
      if (eng.sleepTimerId) {
        clearTimeout(eng.sleepTimerId);
        eng.sleepTimerId = 0;
      }
    }

    function computeFollowTarget() {
      const { minX, maxX, minY, maxY, petSize } = eng.vp;
      if (!eng.ptr.hasPtr) {
        return { x: eng.x, y: eng.groundY };
      }
      const centerPetY = eng.groundY - petSize * 0.5;
      const dx = eng.x - eng.ptr.x;
      const dy = centerPetY - eng.ptr.y;
      const len = Math.hypot(dx, dy);
      const ux = len > 0.5 ? dx / len : 1;
      const uy = len > 0.5 ? dy / len : 0;
      const rawX = eng.ptr.x + ux * POINTER_OFFSET;
      const rawFloorY = eng.ptr.y + uy * POINTER_OFFSET + petSize * 0.5;
      return {
        x: clamp(rawX, minX, maxX),
        y: clamp(rawFloorY, minY, maxY),
      };
    }

    function startHopToward(destX, destY, thenSleep = false) {
      const dx = destX - eng.x;
      const dy = destY - eng.groundY;
      const dist = Math.hypot(dx, dy);

      if (eng.reduced) {
        // Reduced motion: simple short eased glide without arc
        eng.x = clamp(destX, eng.vp.minX, eng.vp.maxX);
        eng.groundY = clamp(destY, eng.vp.minY, eng.vp.maxY);
        eng.y = eng.groundY;
        if (Math.abs(dx) > 4) eng.facing = dx < 0 ? -1 : 1;
        eng.state = thenSleep ? 'SLEEP' : 'IDLE';
        applyClasses();
        renderDom();
        if (!thenSleep) scheduleInactivityTimer();
        stopRaf();
        return;
      }

      const maxStep = eng.lite ? LITE_HOP_DIST : MAX_HOP_DIST;
      const stepDist = Math.min(dist, maxStep);
      const ratio = dist > 0.001 ? stepDist / dist : 0;
      const endX = clamp(eng.x + dx * ratio, eng.vp.minX, eng.vp.maxX);
      const endY = clamp(eng.groundY + dy * ratio, eng.vp.minY, eng.vp.maxY);

      if (Math.abs(dx) > 4) {
        eng.facing = dx < 0 ? -1 : 1;
      }

      const durMin = eng.lite ? 250 : 320;
      const durMax = eng.lite ? 310 : 420;
      const duration = Math.round(lerp(durMin, durMax, Math.min(1, stepDist / maxStep)));
      const arcH = eng.lite
        ? clamp(stepDist * 0.24, 18, 40)
        : clamp(stepDist * 0.36, 26, 68);

      eng.hop = {
        startX: eng.x,
        startY: eng.groundY,
        endX,
        endY,
        duration,
        elapsed: 0,
        arcH,
        pauseLeft: 0,
        landed: false,
        thenSleep,
      };
      eng.state = 'HOP';
      applyClasses();
      ensureRaf();
    }

    function scheduleInactivityTimer() {
      clearSleepTimer();
      if (!eng.active || eng.returning || eng.drag.isDragging) return;
      const delay = eng.ptr.isTouch ? TOUCH_WANDER_MS : DESKTOP_SLEEP_MS;
      eng.sleepTimerId = window.setTimeout(() => {
        eng.sleepTimerId = 0;
        if (!eng.active || eng.returning) return;
        if (eng.ptr.isTouch) {
          // On touch after 3s idle: wander to bottom-right corner area, then sleep
          const cornerX = clamp(eng.vp.vw - eng.vp.halfW - 24, eng.vp.minX, eng.vp.maxX);
          const cornerY = clamp(eng.vp.vh - 24, eng.vp.minY, eng.vp.maxY);
          const distCorner = Math.hypot(cornerX - eng.x, cornerY - eng.groundY);
          if (distCorner > 28) {
            eng.touchSleepPending = true;
            eng.ptr.hasPtr = false;
            startHopToward(cornerX, cornerY, true);
          } else {
            enterSleep();
          }
        } else {
          enterSleep();
        }
      }, delay);
    }

    function enterIdle() {
      eng.state = 'IDLE';
      eng.ptr.dirty = false;
      eng.sqX = 1;
      eng.sqY = 1;
      eng.sqVx = 0;
      eng.sqVy = 0;
      applyClasses();
      renderDom();
      scheduleInactivityTimer();
      if (!hasActiveSparkles()) {
        stopRaf();
      }
    }

    function enterSleep() {
      clearSleepTimer();
      eng.state = 'SLEEP';
      eng.ptr.dirty = false;
      eng.touchSleepPending = false;
      eng.sqX = 1;
      eng.sqY = 1;
      applyClasses();
      renderDom();
      stopRaf();
    }

    function hasActiveSparkles() {
      for (let i = 0; i < SPARKLE_COUNT; i += 1) {
        if (eng.sparkles[i].active) return true;
      }
      return false;
    }

    function triggerSparkles() {
      if (eng.lite || eng.reduced) return;
      const cx = eng.x;
      const cy = eng.y - eng.vp.petSize * 0.45;
      for (let i = 0; i < SPARKLE_COUNT; i += 1) {
        const angle = (i / SPARKLE_COUNT) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
        const speed = 130 + Math.random() * 110;
        eng.sparkles[i] = {
          active: true,
          x: cx,
          y: cy,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 40,
          life: 1,
        };
      }
      ensureRaf();
    }

    function updateSparkles(dt) {
      let any = false;
      for (let i = 0; i < SPARKLE_COUNT; i += 1) {
        const s = eng.sparkles[i];
        const node = sparkleRefs.current[i];
        if (!s.active) {
          if (node && node.style.opacity !== '0') node.style.opacity = '0';
          continue;
        }
        any = true;
        s.x += s.vx * dt;
        s.y += s.vy * dt;
        s.vy += 320 * dt;
        s.life -= dt * 2.6;
        if (s.life <= 0) {
          s.active = false;
          if (node) node.style.opacity = '0';
        } else if (node) {
          node.style.transform = `translate3d(${s.x.toFixed(1)}px, ${s.y.toFixed(
            1
          )}px, 0) scale(${(0.45 + s.life * 0.75).toFixed(2)})`;
          node.style.opacity = s.life.toFixed(2);
        }
      }
      return any;
    }

    function springSquashStep(dt) {
      const k = 280;
      const d = 18;
      eng.sqVx += (k * (1 - eng.sqX) - d * eng.sqVx) * dt;
      eng.sqVy += (k * (1 - eng.sqY) - d * eng.sqVy) * dt;
      eng.sqX += eng.sqVx * dt;
      eng.sqY += eng.sqVy * dt;
    }

    function stopRaf() {
      if (eng.rafId) {
        cancelAnimationFrame(eng.rafId);
        eng.rafId = 0;
      }
    }

    function ensureRaf() {
      if (!eng.active || document.hidden) return;
      if (!eng.rafId) {
        eng.lastFrameTime = performance.now();
        eng.lastLiteTick = eng.lastFrameTime;
        eng.rafId = requestAnimationFrame(tick);
      }
    }

    function recordAdaptiveFrame(rawDeltaMs) {
      if (eng.lite || rawDeltaMs <= 0) return;
      eng.frameSamples.push(rawDeltaMs);
      if (eng.frameSamples.length >= 30) {
        let sum = 0;
        for (let i = 0; i < eng.frameSamples.length; i += 1) {
          sum += eng.frameSamples[i];
        }
        const avg = sum / eng.frameSamples.length;
        eng.frameSamples.length = 0;
        if (avg > 24) {
          eng.lite = true;
          setLiteMode(true);
          applyClasses();
        }
      }
    }

    function tick(now) {
      eng.rafId = 0;
      if (!eng.active || document.hidden) return;

      const rawDeltaMs = now - eng.lastFrameTime;
      eng.lastFrameTime = now;
      recordAdaptiveFrame(rawDeltaMs);

      if (eng.lite && eng.state !== 'IDLE' && eng.state !== 'SLEEP') {
        if (now - eng.lastLiteTick < LITE_FPS_INTERVAL * 0.85) {
          eng.rafId = requestAnimationFrame(tick);
          return;
        }
        eng.lastLiteTick = now;
      }

      const dt = Math.min(0.033, Math.max(0.001, rawDeltaMs / 1000));
      let keepRunning = false;

      if (eng.state === 'IDLE' || eng.state === 'SLEEP') {
        if (eng.ptr.dirty) {
          eng.ptr.dirty = false;
          const target = computeFollowTarget();
          const dist = Math.hypot(target.x - eng.x, target.y - eng.groundY);
          if (eng.state === 'SLEEP') {
            enterIdle();
          } else {
            scheduleInactivityTimer();
          }
          if (dist > FOLLOW_THRESHOLD) {
            startHopToward(target.x, target.y, false);
            keepRunning = true;
          }
        }
      } else if (eng.state === 'HOP') {
        keepRunning = true;
        if (!eng.hop.landed) {
          eng.hop.elapsed += dt * 1000;
          const u = Math.min(1, eng.hop.elapsed / eng.hop.duration);
          eng.x = lerp(eng.hop.startX, eng.hop.endX, u);
          eng.groundY = lerp(eng.hop.startY, eng.hop.endY, u);
          const lift = 4 * eng.hop.arcH * u * (1 - u);
          eng.y = eng.groundY - lift;

          // Subtle mid-air elongation transitioning into landing squash
          const airStretch = u < 0.7 ? Math.sin(u * Math.PI) * 0.08 : 0;
          eng.sqX = 1 - airStretch * 0.7;
          eng.sqY = 1 + airStretch;

          if (u >= 1) {
            eng.hop.landed = true;
            eng.y = eng.groundY;
            eng.sqX = 1.15;
            eng.sqY = 0.85;
            eng.sqVx = 0;
            eng.sqVy = 0;
            eng.hop.pauseLeft = 80 + Math.random() * 80;
          }
        } else {
          springSquashStep(dt);
          eng.hop.pauseLeft -= dt * 1000;
          if (eng.hop.pauseLeft <= 0) {
            if (eng.hop.thenSleep) {
              const cornerX = clamp(eng.vp.vw - eng.vp.halfW - 24, eng.vp.minX, eng.vp.maxX);
              const cornerY = clamp(eng.vp.vh - 24, eng.vp.minY, eng.vp.maxY);
              const dCorner = Math.hypot(cornerX - eng.x, cornerY - eng.groundY);
              if (dCorner > 28) {
                startHopToward(cornerX, cornerY, true);
              } else {
                enterSleep();
                keepRunning = false;
              }
            } else {
              const target = computeFollowTarget();
              const dist = Math.hypot(target.x - eng.x, target.y - eng.groundY);
              if (dist > FOLLOW_THRESHOLD) {
                startHopToward(target.x, target.y, false);
              } else {
                enterIdle();
                keepRunning = false;
              }
            }
          }
        }
      } else if (eng.state === 'DRAG') {
        keepRunning = false;
      } else if (eng.state === 'THROWN') {
        keepRunning = true;
        const tp = eng.throwPhys;
        if (!tp.settling) {
          tp.vy += GRAVITY * dt;
          eng.x += tp.vx * dt;
          eng.y += tp.vy * dt;

          const { minX, maxX, minY, maxY } = eng.vp;
          let impactSpeed = 0;

          if (eng.x < minX) {
            eng.x = minX;
            impactSpeed = Math.max(impactSpeed, Math.abs(tp.vx));
            tp.vx = Math.abs(tp.vx) * RESTITUTION;
          } else if (eng.x > maxX) {
            eng.x = maxX;
            impactSpeed = Math.max(impactSpeed, Math.abs(tp.vx));
            tp.vx = -Math.abs(tp.vx) * RESTITUTION;
          }

          if (eng.y < minY) {
            eng.y = minY;
            impactSpeed = Math.max(impactSpeed, Math.abs(tp.vy));
            tp.vy = Math.abs(tp.vy) * RESTITUTION;
          } else if (eng.y > maxY) {
            eng.y = maxY;
            impactSpeed = Math.max(impactSpeed, Math.abs(tp.vy));
            tp.vy = -Math.abs(tp.vy) * RESTITUTION;
            if (Math.abs(tp.vy) < 45) tp.vy = 0;
            tp.vx *= Math.exp(-FLOOR_FRICTION * dt);
          }

          eng.groundY = maxY;

          if (impactSpeed > 65) {
            const imp = clamp(impactSpeed / 1450, 0.08, 0.3);
            eng.sqX = 1 + imp;
            eng.sqY = 1 - imp * 1.15;
            eng.sqVx = 0;
            eng.sqVy = 0;
            if (Math.abs(tp.vx) > 25) {
              eng.facing = tp.vx < 0 ? -1 : 1;
            }
          }

          springSquashStep(dt);

          const speed = Math.hypot(tp.vx, tp.vy);
          const onFloor = eng.y >= maxY - 1.5;
          if (onFloor && speed < THROW_STOP_SPEED) {
            tp.vx = 0;
            tp.vy = 0;
            eng.y = maxY;
            eng.groundY = maxY;
            tp.settling = true;
            tp.settleTimer = THROW_SETTLE_DELAY;
          }
        } else {
          springSquashStep(dt);
          tp.settleTimer -= dt * 1000;
          if (tp.settleTimer <= 0) {
            tp.settling = false;
            const target = computeFollowTarget();
            const dist = Math.hypot(target.x - eng.x, target.y - eng.groundY);
            if (dist > FOLLOW_THRESHOLD) {
              startHopToward(target.x, target.y, false);
            } else {
              enterIdle();
              keepRunning = false;
            }
          }
        }
      } else if (eng.state === 'RETURNING') {
        keepRunning = true;
        const rf = eng.returnFlow;
        if (rf.phase === 'scroll') {
          rf.waitMs -= dt * 1000;
          if (rf.waitMs <= 0) {
            const target = callbacksRef.current.getHomeTarget?.();
            rf.targetX = clamp(
              target?.x ?? eng.vp.vw * 0.5,
              eng.vp.minX,
              eng.vp.maxX
            );
            rf.targetY = clamp(
              target?.groundY ?? eng.vp.vh * 0.68,
              eng.vp.minY,
              eng.vp.maxY
            );
            const distHome = Math.hypot(rf.targetX - eng.x, rf.targetY - eng.groundY);
            if (eng.reduced) {
              eng.x = rf.targetX;
              eng.groundY = rf.targetY;
              eng.y = rf.targetY;
              eng.opacity = 0;
              renderDom();
              rf.phase = 'shrink';
              rf.shrinkMs = 180;
            } else {
              const dur = clamp(240 + distHome * 0.28, 260, 440);
              if (Math.abs(rf.targetX - eng.x) > 4) {
                eng.facing = rf.targetX < eng.x ? -1 : 1;
              }
              eng.hop = {
                startX: eng.x,
                startY: eng.groundY,
                endX: rf.targetX,
                endY: rf.targetY,
                duration: dur,
                elapsed: 0,
                arcH: clamp(distHome * 0.35, 36, 90),
                pauseLeft: 0,
                landed: false,
                thenSleep: false,
              };
              rf.phase = 'hop';
            }
          }
        } else if (rf.phase === 'hop') {
          eng.hop.elapsed += dt * 1000;
          const u = Math.min(1, eng.hop.elapsed / eng.hop.duration);
          eng.x = lerp(eng.hop.startX, eng.hop.endX, u);
          eng.groundY = lerp(eng.hop.startY, eng.hop.endY, u);
          const lift = 4 * eng.hop.arcH * u * (1 - u);
          eng.y = eng.groundY - lift;
          eng.sqX = 1 - Math.sin(u * Math.PI) * 0.08;
          eng.sqY = 1 + Math.sin(u * Math.PI) * 0.1;
          if (u >= 1) {
            rf.phase = 'shrink';
            rf.shrinkMs = 150;
          }
        } else if (rf.phase === 'shrink') {
          rf.shrinkMs -= dt * 1000;
          const p = Math.max(0, rf.shrinkMs / 150);
          eng.y = eng.groundY;
          eng.sqX = 1.24 - 0.18 * p;
          eng.sqY = 0.72 + 0.15 * p;
          eng.opacity = p;
          if (rf.shrinkMs <= 0) {
            eng.opacity = 0;
            renderDom();
            stopRaf();
            callbacksRef.current.onReturned?.();
            return;
          }
        }
      }

      const sparksRunning = updateSparkles(dt);
      eng.x = clamp(eng.x, eng.vp.minX, eng.vp.maxX);
      eng.groundY = clamp(eng.groundY, eng.vp.minY, eng.vp.maxY);
      eng.y = clamp(eng.y, eng.vp.minY, eng.vp.maxY);
      renderDom();

      if (
        (keepRunning || sparksRunning || eng.ptr.dirty) &&
        eng.active &&
        !document.hidden &&
        !eng.rafId
      ) {
        eng.rafId = requestAnimationFrame(tick);
      }
    }

    function onDocumentPointerMove(e) {
      if (!eng.active || eng.returning || eng.drag.pressed) return;
      if (e.pointerType === 'touch') return;
      // Passive pointermove handler: ONLY stores coordinates (all math happens inside rAF)
      eng.ptr.x = e.clientX;
      eng.ptr.y = e.clientY;
      eng.ptr.hasPtr = true;
      eng.ptr.isTouch = false;
      eng.ptr.lastMovedAt = performance.now();
      eng.ptr.dirty = true;
      if (eng.state === 'IDLE' || eng.state === 'SLEEP') {
        ensureRaf();
      }
    }

    function onDocumentPointerDown(e) {
      if (!eng.active || eng.returning || eng.drag.pressed) return;
      if (petRef.current && petRef.current.contains(e.target)) return;
      if (e.target && e.target.closest && e.target.closest(INTERACTIVE_SELECTOR)) {
        return;
      }
      eng.ptr.x = e.clientX;
      eng.ptr.y = e.clientY;
      eng.ptr.hasPtr = true;
      eng.ptr.isTouch = e.pointerType === 'touch' || eng.ptr.isTouch;
      eng.ptr.lastMovedAt = performance.now();
      eng.ptr.dirty = true;
      eng.touchSleepPending = false;
      if (eng.state === 'IDLE' || eng.state === 'SLEEP') {
        ensureRaf();
      }
    }

    function onResize() {
      eng.vp = getViewportMetrics();
      eng.x = clamp(eng.x, eng.vp.minX, eng.vp.maxX);
      eng.groundY = clamp(eng.groundY, eng.vp.minY, eng.vp.maxY);
      eng.y = clamp(eng.y, eng.vp.minY, eng.vp.maxY);
      eng.hop.startX = clamp(eng.hop.startX, eng.vp.minX, eng.vp.maxX);
      eng.hop.endX = clamp(eng.hop.endX, eng.vp.minX, eng.vp.maxX);
      eng.hop.startY = clamp(eng.hop.startY, eng.vp.minY, eng.vp.maxY);
      eng.hop.endY = clamp(eng.hop.endY, eng.vp.minY, eng.vp.maxY);
      eng.returnFlow.targetX = clamp(eng.returnFlow.targetX, eng.vp.minX, eng.vp.maxX);
      eng.returnFlow.targetY = clamp(eng.returnFlow.targetY, eng.vp.minY, eng.vp.maxY);
      if (eng.ptr.hasPtr) {
        eng.ptr.x = clamp(eng.ptr.x, 0, eng.vp.vw);
        eng.ptr.y = clamp(eng.ptr.y, 0, eng.vp.vh);
      }
      renderDom();
    }

    function onVisibilityChange() {
      if (document.hidden) {
        stopRaf();
      } else if (
        eng.active &&
        (eng.state === 'HOP' ||
          eng.state === 'THROWN' ||
          eng.state === 'RETURNING' ||
          hasActiveSparkles())
      ) {
        ensureRaf();
      }
    }

    function onKeyDown(e) {
      if (e.key === 'Escape' && eng.active && !eng.returning) {
        callbacksRef.current.onRequestReturn?.();
      }
    }

    // Store internal trigger helpers on engineRef so React event handlers & returning prop can invoke them
    eng._applyClasses = applyClasses;
    eng._renderDom = renderDom;
    eng._ensureRaf = ensureRaf;
    eng._stopRaf = stopRaf;
    eng._enterIdle = enterIdle;
    eng._clearSleepTimer = clearSleepTimer;
    eng._triggerSparkles = triggerSparkles;

    applyClasses();
    renderDom();
    ensureRaf();

    document.addEventListener('pointermove', onDocumentPointerMove, { passive: true });
    document.addEventListener('pointerdown', onDocumentPointerDown, { passive: true });
    window.addEventListener('resize', onResize, { passive: true });
    window.visualViewport?.addEventListener('resize', onResize, { passive: true });
    document.addEventListener('visibilitychange', onVisibilityChange);
    document.addEventListener('keydown', onKeyDown);

    return () => {
      eng.active = false;
      eng.mounted = false;
      stopRaf();
      clearSleepTimer();
      document.removeEventListener('pointermove', onDocumentPointerMove);
      document.removeEventListener('pointerdown', onDocumentPointerDown);
      window.removeEventListener('resize', onResize);
      window.visualViewport?.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [active, launchOrigin]);

  // Trigger return home sequence when returning prop flips true
  useEffect(() => {
    if (!active || !returning) return;
    const eng = engineRef.current;
    if (eng.returning) return;
    eng.returning = true;
    eng.drag.pressed = false;
    eng.drag.isDragging = false;
    eng.state = 'RETURNING';
    eng._clearSleepTimer?.();
    eng._applyClasses?.();

    const didScroll = callbacksRef.current.scrollHomeIntoView?.();
    eng.returnFlow = {
      phase: 'scroll',
      waitMs: didScroll ? (eng.reduced ? 40 : 280) : 0,
      targetX: eng.x,
      targetY: eng.groundY,
      shrinkMs: 150,
    };
    eng._ensureRaf?.();
  }, [active, returning]);

  // Sync reduced/lite class changes live
  useEffect(() => {
    if (active) {
      engineRef.current._applyClasses?.();
    }
  }, [active, liteMode, reducedMotion]);

  if (!active || typeof document === 'undefined') return null;

  function triggerQuickSquish() {
    const eng = engineRef.current;
    if (!eng.active || eng.returning) return;
    eng._clearSleepTimer?.();
    if (navigator.vibrate) navigator.vibrate(8);

    const el = petRef.current;
    eng.state = 'IDLE';
    eng.drag.pressed = true;
    eng.drag.isDragging = false;
    eng.sqX = 1.25;
    eng.sqY = 0.7;
    eng._applyClasses?.();
    eng._renderDom?.();

    window.setTimeout(() => {
      if (!eng.active || eng.returning) return;
      eng.drag.pressed = false;
      eng.sqX = 1;
      eng.sqY = 1;
      eng._applyClasses?.();
      eng._renderDom?.();
      if (el && !eng.reduced) {
        el.classList.remove('is-wobbling');
        void el.offsetWidth;
        el.classList.add('is-wobbling');
        window.setTimeout(() => el.classList.remove('is-wobbling'), 380);
      }
      eng._triggerSparkles?.();
      eng._enterIdle?.();
    }, 150);
  }

  function handlePetPointerDown(e) {
    const eng = engineRef.current;
    if (!eng.active || eng.returning) return;
    e.stopPropagation();

    eng._clearSleepTimer?.();
    eng.drag.pointerId = e.pointerId;
    eng.drag.downX = e.clientX;
    eng.drag.downY = e.clientY;
    eng.drag.pressed = true;
    eng.drag.isDragging = false;
    eng.drag.samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    eng.stretchAmt = 0;

    if (navigator.vibrate) navigator.vibrate(8);

    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic events without active pointer
      }
    }

    // Immediate squish expression on press
    eng.sqX = 1.25;
    eng.sqY = 0.7;
    eng.state = 'IDLE';
    eng._applyClasses?.();
    eng._renderDom?.();
  }

  function handlePetPointerMove(e) {
    const eng = engineRef.current;
    if (!eng.drag.pressed || eng.drag.pointerId !== e.pointerId || eng.returning) {
      return;
    }

    const now = performance.now();
    const dxDown = e.clientX - eng.drag.downX;
    const dyDown = e.clientY - eng.drag.downY;

    if (!eng.drag.isDragging && Math.hypot(dxDown, dyDown) > DRAG_THRESHOLD) {
      eng.drag.isDragging = true;
      eng.state = 'DRAG';
      eng.sqX = 1;
      eng.sqY = 1;
      eng._applyClasses?.();
    }

    if (eng.drag.isDragging) {
      const prevSample = eng.drag.samples[eng.drag.samples.length - 1];
      const nextX = clamp(e.clientX, eng.vp.minX, eng.vp.maxX);
      const nextY = clamp(
        e.clientY + eng.vp.petSize * 0.48,
        eng.vp.minY,
        eng.vp.maxY
      );

      if (prevSample) {
        const dtMs = Math.max(4, now - prevSample.t);
        const vx = ((e.clientX - prevSample.x) / dtMs) * 1000;
        const vy = ((e.clientY - prevSample.y) / dtMs) * 1000;
        const speed = Math.hypot(vx, vy);
        eng.stretchAmt = eng.reduced ? 0 : Math.min(0.18, speed / 2600);
        eng.stretchAngle = (Math.atan2(vy, vx) * 180) / Math.PI;
        if (Math.abs(vx) > 25) {
          eng.facing = vx < 0 ? -1 : 1;
        }
      }

      eng.x = nextX;
      eng.y = nextY;
      eng.groundY = eng.vp.maxY;

      eng.drag.samples.push({ x: e.clientX, y: e.clientY, t: now });
      if (eng.drag.samples.length > 5) {
        eng.drag.samples.shift();
      }
      eng._renderDom?.();
    }
  }

  function handlePetPointerUp(e) {
    const eng = engineRef.current;
    if (!eng.drag.pressed || eng.drag.pointerId !== e.pointerId) return;

    const wasDragging = eng.drag.isDragging;
    eng.drag.pressed = false;
    eng.drag.isDragging = false;
    eng.drag.pointerId = null;
    eng.stretchAmt = 0;

    if (e.currentTarget.releasePointerCapture) {
      try {
        if (e.currentTarget.hasPointerCapture?.(e.pointerId)) {
          e.currentTarget.releasePointerCapture(e.pointerId);
        }
      } catch {
        // Ignore if already released
      }
    }

    if (!wasDragging) {
      // Tap/hold release: spring wobble + sparkles
      eng.sqX = 1;
      eng.sqY = 1;
      eng._applyClasses?.();
      eng._renderDom?.();

      const el = petRef.current;
      if (el && !eng.reduced) {
        el.classList.remove('is-wobbling');
        void el.offsetWidth;
        el.classList.add('is-wobbling');
        window.setTimeout(() => el.classList.remove('is-wobbling'), 380);
      }
      eng._triggerSparkles?.();
      eng._enterIdle?.();
      return;
    }

    // Compute release velocity from last up-to-5 pointer samples
    const samples = eng.drag.samples;
    let vx = 0;
    let vy = 0;
    if (samples.length >= 2) {
      const first = samples[0];
      const last = samples[samples.length - 1];
      const dtSec = Math.max(0.016, (last.t - first.t) / 1000);
      vx = clamp((last.x - first.x) / dtSec, -2200, 2200);
      vy = clamp((last.y - first.y) / dtSec, -2200, 2200);
    }

    if (eng.reduced) {
      eng.groundY = eng.vp.maxY;
      eng.y = eng.vp.maxY;
      eng._enterIdle?.();
      return;
    }

    eng.throwPhys = {
      vx,
      vy,
      settleTimer: 0,
      settling: false,
    };
    eng.state = 'THROWN';
    eng._applyClasses?.();
    eng._ensureRaf?.();
  }

  function handlePetKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      triggerQuickSquish();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onRequestReturn?.();
    }
  }

  return createPortal(
    <div className="pet-layer">
      <div className="pet-layer__sr" aria-live="polite">
        {liveMsg}
      </div>

      {/* Ground contact ellipse shadow */}
      <div ref={shadowRef} className="pet-shadow" aria-hidden="true" />

      {/* Pre-allocated sparkle pool (max 6 DOM elements) */}
      {Array.from({ length: SPARKLE_COUNT }, (_, idx) => (
        <span
          key={idx}
          ref={(el) => {
            sparkleRefs.current[idx] = el;
          }}
          className={`pet-sparkle${idx % 2 === 1 ? ' pet-sparkle--alt' : ''}`}
          aria-hidden="true"
        />
      ))}

      {/* Interactive floating pet sprite */}
      <button
        ref={petRef}
        type="button"
        className="pet-entity"
        aria-label="Squishy pet. Press Enter to squish."
        onPointerDown={handlePetPointerDown}
        onPointerMove={handlePetPointerMove}
        onPointerUp={handlePetPointerUp}
        onPointerCancel={handlePetPointerUp}
        onKeyDown={handlePetKeyDown}
      >
        <div ref={squashRef} className="pet-entity__squash">
          <div className="pet-entity__pose">
            <div ref={flipRef} className="pet-entity__flip">
              <PetSpriteSvg character={character} liteMode={liteMode} />
            </div>
          </div>
        </div>
        <span className="pet-sleep-z" aria-hidden="true">
          z
        </span>
      </button>

      {/* Bottom-right Send Home frosted pill (>= 44px touch target) */}
      <button
        type="button"
        className="pet-send-home"
        onClick={() => onRequestReturn?.()}
      >
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M3 10.5 12 3l9 7.5" />
          <path d="M5 9.5V20a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V9.5" />
        </svg>
        <span>Send home</span>
      </button>
    </div>,
    document.body
  );
}

