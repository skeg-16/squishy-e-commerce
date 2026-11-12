import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  pickCharacterLine,
  playCharacterVoiceClip,
  playPlushSqueak,
} from '../utils/squishyVoice';
import '../styles/pet-layer.css';

const DESKTOP_SIZE = 96;
const MOBILE_SIZE = 72;
const VIEWPORT_PAD = 8;
const POINTER_OFFSET = 70;
const FOLLOW_THRESHOLD = 140;
const MAGNET_CALM_RADIUS = 95;
const MAX_HOP_DIST = 160;
const LITE_HOP_DIST = 112;
const DRAG_THRESHOLD = 8;
const GRAVITY = 2200;
const RESTITUTION = 0.62;
const FLOOR_FRICTION = 5.2;
const THROW_STOP_SPEED = 30;
const THROW_SETTLE_DELAY = 600;
const DESKTOP_SLEEP_MS = 6000;
const TOUCH_WANDER_MS = 3000;
const SPARKLE_COUNT = 6;
const SPEECH_DURATION_MS = 3000;

const INTERACTIVE_SELECTOR =
  'a, button, input, select, textarea, label, [role="button"], [tabindex]';

const DEFAULT_CHAR = {
  slug: 'dumpling',
  name: 'Dumpling',
  c1: '#fff7f0',
  c2: '#fbd9c9',
  c3: '#dfa38f',
  deco: 'dumpling',
  lines: ['Hehe, bao-tiful squish!'],
};

function clamp(v, min, max) {
  return v < min ? min : v > max ? max : v;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function easeOutQuad(t) {
  return 1 - (1 - t) * (1 - t);
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

function PetSpriteSvg({ character, liteMode, faceRef }) {
  const k = character || DEFAULT_CHAR;
  const deco = k.deco || k.slug || 'dumpling';
  const sphereId = `pet-sphere-${deco}`;
  const shadeId = `pet-shade-${deco}`;
  const rimId = `pet-rim-${deco}`;
  const clipId = `pet-clip-${deco}`;

  // Chubby 3D ball-like plush silhouettes anchored near bottom y=108
  let rx = 46;
  let ry = 43.5;
  let cy = 64.5;
  let isPeanut = false;

  if (deco === 'cheese') {
    rx = 45.5;
    ry = 43.5;
  } else if (deco === 'toast') {
    rx = 45;
    ry = 44;
  } else if (deco === 'butter') {
    rx = 42;
    ry = 45;
    cy = 63;
  } else if (deco === 'peanut') {
    isPeanut = true;
  }

  const peanutPath =
    'M60,18 C82,18 95,30 95,46 C95,54 89,59 89,64 C89,70 98,77 98,90 C98,103 82,108 60,108 C38,108 22,103 22,90 C22,77 31,70 31,64 C31,59 25,54 25,46 C25,30 38,18 60,18 Z';

  return (
    <svg
      className="pet-entity__svg"
      viewBox="0 0 120 120"
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        {/* Off-center 3D key light spherical volume gradient */}
        <radialGradient id={sphereId} cx="34%" cy="27%" fx="29%" fy="23%" r="74%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.96" />
          <stop offset="16%" stopColor={k.c1} />
          <stop offset="56%" stopColor={k.c2} />
          <stop offset="88%" stopColor={k.c3} />
          <stop offset="100%" stopColor={k.c3} />
        </radialGradient>

        {/* Subsurface bottom bounce + volumetric right terminator */}
        <radialGradient id={shadeId} cx="52%" cy="86%" r="65%">
          <stop offset="0%" stopColor="#ffe5f3" stopOpacity="0.48" />
          <stop offset="55%" stopColor="#802860" stopOpacity="0" />
          <stop offset="100%" stopColor="#461642" stopOpacity="0.28" />
        </radialGradient>

        {/* Top-left 3D clearcoat rim stroke gradient */}
        <linearGradient id={rimId} x1="15%" y1="10%" x2="88%" y2="92%">
          <stop offset="0%" stopColor="rgba(255, 255, 255, 0.88)" />
          <stop offset="45%" stopColor="rgba(255, 255, 255, 0.16)" />
          <stop offset="100%" stopColor="rgba(90, 26, 72, 0.25)" />
        </linearGradient>

        {/* Dumpling / CatPaw attachment spherical gradients */}
        <radialGradient id="pet-knot-grad" cx="35%" cy="28%" r="72%">
          <stop offset="0%" stopColor={k.c1} />
          <stop offset="65%" stopColor={k.c2} />
          <stop offset="100%" stopColor={k.c3} />
        </radialGradient>

        <clipPath id={clipId}>
          {isPeanut ? (
            <path d={peanutPath} />
          ) : (
            <ellipse cx="60" cy={cy} rx={rx} ry={ry} />
          )}
        </clipPath>
      </defs>

      {/* Behind-ball 3D character attachments */}
      {deco === 'dumpling' && (
        <g>
          <ellipse
            cx="47"
            cy="21.5"
            rx="6.2"
            ry="7.8"
            transform="rotate(-14 47 21.5)"
            fill="url(#pet-knot-grad)"
            stroke="rgba(205, 138, 114, 0.38)"
            strokeWidth="1.2"
          />
          <ellipse
            cx="73"
            cy="21.5"
            rx="6.2"
            ry="7.8"
            transform="rotate(14 73 21.5)"
            fill="url(#pet-knot-grad)"
            stroke="rgba(205, 138, 114, 0.38)"
            strokeWidth="1.2"
          />
          <ellipse
            cx="60"
            cy="18.5"
            rx="6.8"
            ry="8.4"
            fill="url(#pet-knot-grad)"
            stroke="rgba(205, 138, 114, 0.38)"
            strokeWidth="1.2"
          />
        </g>
      )}

      {deco === 'catpaw' && (
        <g>
          {[
            [31, 30, -24],
            [49, 20, -8],
            [71, 20, 8],
            [89, 30, 24],
          ].map(([tx, ty, rot], idx) => (
            <g key={idx} transform={`translate(${tx}, ${ty}) rotate(${rot})`}>
              <ellipse
                cx="0"
                cy="0"
                rx="9"
                ry="11"
                fill="url(#pet-knot-grad)"
                stroke="rgba(255,255,255,0.65)"
                strokeWidth="1"
              />
              <ellipse cx="0" cy="1.2" rx="4.6" ry="5.8" fill="#ff89b6" />
              <ellipse cx="-1.8" cy="-1.2" rx="1.6" ry="1.1" fill="rgba(255,255,255,0.75)" />
            </g>
          ))}
        </g>
      )}

      {deco === 'peanut' && (
        <ellipse
          cx="60"
          cy="17"
          rx="11"
          ry="5.5"
          transform="rotate(-6 60 17)"
          fill="#fff9f0"
          stroke="rgba(220,180,120,0.35)"
          strokeWidth="1"
        />
      )}

      {/* Main 3D Plush Ball */}
      {isPeanut ? (
        <path d={peanutPath} fill={`url(#${sphereId})`} />
      ) : (
        <ellipse cx="60" cy={cy} rx={rx} ry={ry} fill={`url(#${sphereId})`} />
      )}

      {/* Clipped 3D details & volumetric shading overlays */}
      <g clipPath={`url(#${clipId})`}>
        {deco === 'dumpling' && (
          <g fill="none" stroke="rgba(204, 146, 124, 0.28)" strokeWidth="1.6">
            <path d="M46,24 C42,32 39,38 38,44" />
            <path d="M54,22 C52,31 50,37 49,43" />
            <path d="M66,22 C68,31 70,37 71,43" />
            <path d="M74,24 C78,32 81,38 82,44" />
          </g>
        )}

        {deco === 'cheese' && (
          <g>
            {[
              [43, 41, 5.6],
              [82, 47, 8],
              [34, 79, 6.2],
              [79, 85, 7],
              [65, 51, 3.8],
            ].map(([hx, hy, hr], i) => (
              <g key={i}>
                <circle cx={hx} cy={hy} r={hr} fill="rgba(182, 114, 12, 0.45)" />
                <circle
                  cx={hx + 0.9}
                  cy={hy + 1.1}
                  r={hr * 0.78}
                  fill="rgba(255, 224, 112, 0.72)"
                />
              </g>
            ))}
          </g>
        )}

        {deco === 'toast' && (
          <g>
            <ellipse
              cx="60"
              cy="34"
              rx="34"
              ry="14"
              fill="rgba(255, 249, 240, 0.56)"
            />
            <path
              d="M15,44 Q60,52 105,44 L105,18 L15,18 Z"
              fill="rgba(188, 122, 52, 0.14)"
            />
          </g>
        )}

        {deco === 'butter' && (
          <g>
            <rect x="16" y="14" width="88" height="31" fill="#ffd34d" />
            <rect
              x="16"
              y="44"
              width="88"
              height="2"
              fill="rgba(180, 128, 10, 0.24)"
            />
            <text
              x="60"
              y="37"
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
              y="93"
              textAnchor="middle"
              fill="#9e7f24"
              fontFamily="Nunito, sans-serif"
              fontWeight="800"
              fontSize="6.5"
            >
              4oz
            </text>
          </g>
        )}

        {deco === 'peanut' && (
          <g fill="none" stroke="rgba(150, 98, 42, 0.25)" strokeWidth="1.8">
            <path d="M33,34 A22,22 0 0 0 33,56" />
            <path d="M87,74 A22,22 0 0 1 87,96" />
          </g>
        )}

        {deco === 'catpaw' && (
          <ellipse
            cx="60"
            cy="72"
            rx="27"
            ry="20"
            fill="rgba(255, 138, 184, 0.28)"
          />
        )}

        {/* Spherical lower subsurface bounce + ambient terminator */}
        <rect x="10" y="12" width="100" height="102" fill={`url(#${shadeId})`} />

        {/* Right-edge spherical depth shadow crescent */}
        <path
          d="M90,22 C110,50 107,95 66,108 L114,108 L114,16 Z"
          fill="rgba(95, 22, 68, 0.16)"
        />
      </g>

      {/* Outer glossy clearcoat rim light */}
      {isPeanut ? (
        <path
          d={peanutPath}
          fill="none"
          stroke={`url(#${rimId})`}
          strokeWidth="2.2"
        />
      ) : (
        <ellipse
          cx="60"
          cy={cy}
          rx={rx}
          ry={ry}
          fill="none"
          stroke={`url(#${rimId})`}
          strokeWidth="2.2"
        />
      )}

      {/* High-clearcoat 3D spherical gloss highlight */}
      <ellipse
        className="pet-gloss"
        cx={deco === 'butter' ? 38 : 40}
        cy={deco === 'butter' ? 50 : 39}
        rx="10"
        ry="5.1"
        transform={`rotate(-34 ${deco === 'butter' ? 38 : 40} ${
          deco === 'butter' ? 50 : 39
        })`}
        fill={liteMode ? 'rgba(255,255,255,0.72)' : 'rgba(255,255,255,0.84)'}
      />
      <circle
        cx={deco === 'butter' ? 49 : 51}
        cy={deco === 'butter' ? 42 : 31}
        r="2.2"
        fill="rgba(255,255,255,0.82)"
      />

      {/* Interactive 2.5D spherical face layer (parallax shifts inside sphere clip) */}
      <g clipPath={`url(#${clipId})`}>
        <g ref={faceRef}>
        {deco === 'dumpling' && (
          <path
            d="M60,46.5 C55.5,41 51.5,44 55,48 L60,52.5 L65,48 C68.5,44 64.5,41 60,46.5 Z"
            fill="#e86c9a"
          />
        )}

        {/* Cheeks */}
        <ellipse cx="38.5" cy="74" rx="5.8" ry="3.6" fill="rgba(255, 90, 130, 0.58)" />
        <ellipse cx="81.5" cy="74" rx="5.8" ry="3.6" fill="rgba(255, 90, 130, 0.58)" />

        {/* AWAKE eyes + cute smile */}
        <g className="pet-face pet-face--awake">
          <g className="pet-eye-open">
            <ellipse cx="47" cy="67" rx="3" ry="3.5" fill="#3d1f3d" />
            <circle cx="46" cy="65.7" r="1.1" fill="#ffffff" />
            <ellipse cx="73" cy="67" rx="3" ry="3.5" fill="#3d1f3d" />
            <circle cx="72" cy="65.7" r="1.1" fill="#ffffff" />
          </g>
          <path
            d="M54.5,74.5 Q60,79.5 65.5,74.5"
            fill="none"
            stroke="#3d1f3d"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        </g>

        {/* SQUISH "> <" eyes + happy open mouth */}
        <g className="pet-face pet-face--squish">
          <polyline
            points="43,63.2 50,67 43,70.8"
            fill="none"
            stroke="#3d1f3d"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="77,63.2 70,67 77,70.8"
            fill="none"
            stroke="#3d1f3d"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <ellipse cx="60" cy="76.5" rx="4.2" ry="5" fill="#3d1f3d" />
        </g>

        {/* SLEEP closed-eyes */}
        <g className="pet-face pet-face--sleep">
          <path
            d="M43.5,67.5 Q47,70.2 50.5,67.5"
            fill="none"
            stroke="#3d1f3d"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <path
            d="M69.5,67.5 Q73,70.2 76.5,67.5"
            fill="none"
            stroke="#3d1f3d"
            strokeWidth="2.3"
            strokeLinecap="round"
          />
          <circle cx="60" cy="75.5" r="2.2" fill="#3d1f3d" />
        </g>
        </g>
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
  const [speechText, setSpeechText] = useState('');
  const [speechVisible, setSpeechVisible] = useState(false);

  const petRef = useRef(null);
  const squashRef = useRef(null);
  const rollRef = useRef(null);
  const faceRef = useRef(null);
  const shadowRef = useRef(null);
  const sparkleRefs = useRef([]);
  const speechTimerRef = useRef(0);
  const activeCharRef = useRef(character || DEFAULT_CHAR);
  const prevSlugRef = useRef((character || DEFAULT_CHAR).slug);

  const liveMsgRef = useRef(liveMsg);
  liveMsgRef.current = liveMsg;

  function showPetSpeech(customIdx, withSound = true) {
    const ch = activeCharRef.current || DEFAULT_CHAR;
    const { idx, phrase } = pickCharacterLine(ch, customIdx);
    setSpeechText(phrase);
    setSpeechVisible(true);
    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    speechTimerRef.current = window.setTimeout(() => {
      setSpeechVisible(false);
    }, SPEECH_DURATION_MS);

    if (withSound) {
      playPlushSqueak(false);
      playCharacterVoiceClip(ch, idx);
    }
  }

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
    rollDeg: 0,
    faceOx: 0,
    faceOy: 0,
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
      duration: 340,
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
      lastBounceSoundAt: 0,
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
      phase: 'none',
      waitMs: 0,
      targetX: 0,
      targetY: 0,
      shrinkMs: 150,
    },
    frameSamples: [],
    rafId: 0,
    lastFrameTime: 0,
    sleepTimerId: 0,
    touchSleepPending: false,
  });

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
    const ch = character || DEFAULT_CHAR;
    activeCharRef.current = ch;
    // Speak and celebrate with a cute hop when switching character while roaming!
    if (active && !returning && prevSlugRef.current !== ch.slug) {
      prevSlugRef.current = ch.slug;
      const eng = engineRef.current;
      eng.sqX = 1.18;
      eng.sqY = 0.82;
      eng._applyClasses?.();
      eng._renderDom?.();
      showPetSpeech(0, true);
    } else {
      prevSlugRef.current = ch.slug;
    }
  }, [character, active, returning]);

  useEffect(() => {
    engineRef.current.lite = liteMode;
  }, [liteMode]);

  useEffect(() => {
    engineRef.current.reduced = reducedMotion;
  }, [reducedMotion]);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return undefined;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e) => setReducedMotion(Boolean(e.matches));
    if (mq.addEventListener) mq.addEventListener('change', onChange);
    return () => {
      if (mq.removeEventListener) mq.removeEventListener('change', onChange);
    };
  }, []);

  useEffect(() => {
    if (active && !returning) {
      setLiveMsg('Squishy is roaming the page');
    } else if (!active && liveMsgRef.current === 'Squishy is roaming the page') {
      setLiveMsg('Squishy is back home');
      setSpeechVisible(false);
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
      if (speechTimerRef.current) {
        clearTimeout(speechTimerRef.current);
        speechTimerRef.current = 0;
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
    eng.rollDeg = 0;
    eng.faceOx = 0;
    eng.faceOy = 0;
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

    // Playful greeting speech on launch
    showPetSpeech(0, false);

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
      const rlEl = rollRef.current;
      const fcEl = faceRef.current;
      const shEl = shadowRef.current;
      if (!el || !sqEl || !rlEl || !shEl) return;

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

      rlEl.style.transform = `rotate(${eng.rollDeg.toFixed(1)}deg)`;

      if (fcEl) {
        fcEl.style.transform = `translate(${eng.faceOx.toFixed(2)}px, ${eng.faceOy.toFixed(
          2
        )}px)`;
      }

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

      // If pointer approaches directly onto/near pet, stay still so it's easy to poke & pet!
      if (len < MAGNET_CALM_RADIUS && !eng.ptr.isTouch) {
        return { x: eng.x, y: eng.groundY };
      }

      const ux = len > 0.5 ? dx / len : 1;
      const uy = len > 0.5 ? dy / len : 0;
      const rawX = eng.ptr.x + ux * POINTER_OFFSET;
      const rawFloorY = eng.ptr.y + uy * POINTER_OFFSET + petSize * 0.5;
      return {
        x: clamp(rawX, minX, maxX),
        y: clamp(rawFloorY, minY, maxY),
      };
    }

    function updateFaceParallaxFromPointer() {
      if (!eng.ptr.hasPtr || eng.state === 'SLEEP') {
        eng.faceOx = 0;
        eng.faceOy = 0;
        return;
      }
      const centerPetY = eng.y - eng.vp.petSize * 0.45;
      eng.faceOx = clamp((eng.ptr.x - eng.x) / 140, -1, 1) * 5.2;
      eng.faceOy = clamp((eng.ptr.y - centerPetY) / 140, -1, 1) * 3.2;
    }

    function startHopToward(destX, destY, thenSleep = false) {
      const dx = destX - eng.x;
      const dy = destY - eng.groundY;
      const dist = Math.hypot(dx, dy);

      if (eng.reduced) {
        eng.x = clamp(destX, eng.vp.minX, eng.vp.maxX);
        eng.groundY = clamp(destY, eng.vp.minY, eng.vp.maxY);
        eng.y = eng.groundY;
        eng.rollDeg = 0;
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

      const durMin = eng.lite ? 260 : 320;
      const durMax = eng.lite ? 320 : 410;
      const duration = Math.round(lerp(durMin, durMax, Math.min(1, stepDist / maxStep)));
      const arcH = eng.lite
        ? clamp(stepDist * 0.28, 22, 44)
        : clamp(stepDist * 0.36, 26, 66);

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
      eng.rollDeg = 0;
      eng.sqX = 1;
      eng.sqY = 1;
      eng.sqVx = 0;
      eng.sqVy = 0;
      updateFaceParallaxFromPointer();
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
      eng.rollDeg = 0;
      eng.faceOx = 0;
      eng.faceOy = 0;
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

      const dt = Math.min(0.033, Math.max(0.001, rawDeltaMs / 1000));
      let keepRunning = false;

      if (eng.state === 'IDLE' || eng.state === 'SLEEP') {
        if (eng.ptr.dirty) {
          eng.ptr.dirty = false;
          updateFaceParallaxFromPointer();
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
          const eu = easeOutQuad(u);
          eng.x = lerp(eng.hop.startX, eng.hop.endX, eu);
          eng.groundY = lerp(eng.hop.startY, eng.hop.endY, eu);
          const lift = 4 * eng.hop.arcH * u * (1 - u);
          eng.y = eng.groundY - lift;

          // Subtle ball roll + tilt during airborne arc
          const dxHop = eng.hop.endX - eng.hop.startX;
          const dir = dxHop < -2 ? -1 : dxHop > 2 ? 1 : 0;
          eng.rollDeg = dir * Math.sin(u * Math.PI) * 14;
          eng.faceOx = clamp(dxHop * 0.04, -5, 5);
          eng.faceOy = lerp(-3, 2, u);

          const airStretch = u < 0.72 ? Math.sin(u * Math.PI) * 0.09 : 0;
          eng.sqX = 1 - airStretch * 0.65;
          eng.sqY = 1 + airStretch;

          if (u >= 1) {
            eng.hop.landed = true;
            eng.y = eng.groundY;
            eng.rollDeg = 0;
            eng.sqX = 1.15;
            eng.sqY = 0.85;
            eng.sqVx = 0;
            eng.sqVy = 0;
            eng.hop.pauseLeft = 75 + Math.random() * 75;
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

          // Real rolling angular velocity proportional to horizontal speed
          eng.rollDeg = (eng.rollDeg + (tp.vx * dt * 180) / (Math.PI * (eng.vp.petSize * 0.45))) % 360;

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
            if (impactSpeed > 260 && now - tp.lastBounceSoundAt > 240) {
              tp.lastBounceSoundAt = now;
              playPlushSqueak(true);
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
          // Ease roll back upright while resting on floor
          const shortest = ((((eng.rollDeg % 360) + 540) % 360) - 180);
          eng.rollDeg = eng.rollDeg - shortest * Math.min(1, dt * 10);
          springSquashStep(dt);
          tp.settleTimer -= dt * 1000;
          if (tp.settleTimer <= 0) {
            tp.settling = false;
            eng.rollDeg = 0;
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
          eng.rollDeg = (eng.hop.endX >= eng.hop.startX ? 1 : -1) * Math.sin(u * Math.PI) * 16;
          eng.sqX = 1 - Math.sin(u * Math.PI) * 0.08;
          eng.sqY = 1 + Math.sin(u * Math.PI) * 0.1;
          if (u >= 1) {
            eng.rollDeg = 0;
            rf.phase = 'shrink';
            rf.shrinkMs = 150;
          }
        } else if (rf.phase === 'shrink') {
          rf.shrinkMs -= dt * 1000;
          const p = Math.max(0, rf.shrinkMs / 150);
          eng.y = eng.groundY;
          eng.rollDeg = 0;
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

    showPetSpeech(undefined, true);

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
      playPlushSqueak(true);
      eng._triggerSparkles?.();
      eng._enterIdle?.();
    }, 150);
  }

  function handlePetPointerDown(e) {
    const eng = engineRef.current;
    if (!eng.active || eng.returning) return;
    e.stopPropagation();

    eng._clearSleepTimer?.();
    eng.ptr.dirty = false;
    eng.drag.pointerId = e.pointerId;
    eng.drag.downX = e.clientX;
    eng.drag.downY = e.clientY;
    eng.drag.pressed = true;
    eng.drag.isDragging = false;
    eng.drag.samples = [{ x: e.clientX, y: e.clientY, t: performance.now() }];
    eng.stretchAmt = 0;

    if (navigator.vibrate) navigator.vibrate(8);

    // Speak & squeak just like clicking the hero squishy!
    showPetSpeech(undefined, true);

    if (e.currentTarget.setPointerCapture) {
      try {
        e.currentTarget.setPointerCapture(e.pointerId);
      } catch {
        // Ignore synthetic events without active pointer
      }
    }

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
        eng.rollDeg = clamp(vx * 0.015, -24, 24);
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
      playPlushSqueak(true);
      eng._triggerSparkles?.();
      eng._enterIdle?.();
      return;
    }

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
      eng.rollDeg = 0;
      eng._enterIdle?.();
      return;
    }

    eng.throwPhys = {
      vx,
      vy,
      settleTimer: 0,
      settling: false,
      lastBounceSoundAt: 0,
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

      {/* Interactive 3D ball-like floating pet sprite + speech bubble */}
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
        <span
          className={`pet-speech${speechVisible ? ' is-visible' : ''}`}
          aria-hidden="true"
        >
          {speechText}
        </span>

        <div ref={squashRef} className="pet-entity__squash">
          <div className="pet-entity__pose">
            <div ref={rollRef} className="pet-entity__roll">
              <PetSpriteSvg
                character={character}
                liteMode={liteMode}
                faceRef={faceRef}
              />
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
