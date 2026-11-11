import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PRODUCT_MODELS } from '../data/productModels';

const ProductViewer3D = lazy(() => import('../components/ProductViewer3D'));

const LAB_SQUISHIES = [
  {
    slug: 'dumpling',
    name: 'Steamed Bao',
    type: 'Classic Memory Foam',
    baseSoftness: 98,
    reboundSeconds: 40,
    desc: 'Dense micro-cellular core with slow pneumatic air release.',
    quote: 'Ahhh~ that 40-second slow-rise feels amazing!',
    color: '#ffb6d5',
  },
  {
    slug: 'cheese',
    name: 'Swiss Cheddar',
    type: 'Pocketed Honeycomb Foam',
    baseSoftness: 94,
    reboundSeconds: 35,
    desc: 'Recessed vacuum air dimples provide extra tactile finger resistance.',
    quote: 'Squeeze deep! The air pockets pop right back.',
    color: '#ffe07d',
  },
  {
    slug: 'catpaw',
    name: 'Mochi Cat Paw',
    type: 'Dual-Layer Jelly TPR',
    baseSoftness: 99,
    reboundSeconds: 38,
    desc: 'Soft gel-cushioned toe beans over a slow-rise memory palm pad.',
    quote: 'Purrfect squish! Stress melted away.',
    color: '#ff9ec7',
  },
  {
    slug: 'strawberry-mochi',
    name: 'Ichigo Daifuku',
    type: 'Velvet Rice Dough TPR',
    baseSoftness: 97,
    reboundSeconds: 42,
    desc: 'Silky dusted exterior with a weighted slow-rebound strawberry core.',
    quote: 'Sweet slow rise! So relaxing to knead.',
    color: '#ff9ec4',
  },
];

const INTERACTIVE_LAYERS = [
  {
    id: 'tpr-skin',
    title: '1. Soft TPR Skin',
    subtitle: 'Silky, Non-Sticky & Hypoallergenic',
    tag: 'Skin Layer · 0.8mm',
    desc: 'Our outer coat is molded from medical-grade Thermoplastic Rubber (TPR). It never attracts dust or leaves sticky residue on your desk, and wipes clean with warm water in seconds.',
    stat: '100% Non-Toxic',
    statSub: 'BPA & Phthalate Free',
    interactiveTip: 'Tap to test surface tension & hygiene barrier',
  },
  {
    id: 'memory-core',
    title: '2. Micro-Porous Core',
    subtitle: 'Slow Pneumatic Compression',
    tag: 'Core Layer · High-Density',
    desc: 'Millions of microscopic open air cells release trapped air slowly when pressed, then gradually draw it back in over 30 to 45 seconds for that signature hypnotic slow rebound.',
    stat: '30–45s Rebound',
    statSub: 'Pneumatic slow-rise curve',
    interactiveTip: 'Tap to compress air chambers',
  },
  {
    id: 'ergonomic-shape',
    title: '3. Palm-Contoured Shape',
    subtitle: 'Engineered for Study & Desk Breaks',
    tag: 'Form Factor · Hand-Fit',
    desc: 'Every contour, pleat, and curve is shaped to match natural hand grip angles. Reduces repetitive strain during study marathons, coding sprints, and long office calls.',
    stat: '64g Balanced',
    statSub: 'Zero hand fatigue',
    interactiveTip: 'Tap to verify ergonomic weight',
  },
];

const ANATOMY_SPECS = [
  {
    id: 'clean',
    title: 'Clean & Low Odor',
    summary: 'Baked in high-temp clean ovens so there are no chemical smells.',
    details: 'Unlike cheap discount squishies that smell like petroleum, our TPR is cured in clean air chambers, yielding a gentle subtle sweet scent or neutral profile that is pleasant around desks.',
  },
  {
    id: 'safety',
    title: 'Ages 3+ Child & Desk Safe',
    summary: 'Tested to international safety standards (EN71 & ASTM F963).',
    details: 'Heavy metal free, tear-resistant under normal compression, and soft enough that dropping it on laptops, monitors, or phones causes zero scuffs or scratches.',
  },
  {
    id: 'durability',
    title: 'Tensile Memory Lock',
    summary: 'Withstands over 10,000 deep squeezes without ripping or hardening.',
    details: 'Internal cross-linked polymer chains prevent permanent pancake flattening. Even after hours of cramming or desk fidgeting, it returns to its original silhouette.',
  },
];

export default function About() {
  const [activeModelIdx, setActiveModelIdx] = useState(0);
  const [squishCount, setSquishCount] = useState(0);
  const [activeLayer, setActiveLayer] = useState(0);
  const [activeSpec, setActiveSpec] = useState(0);
  const [squishPulse, setSquishPulse] = useState(0);
  const [lastReaction, setLastReaction] = useState('');
  const [stressLevel, setStressLevel] = useState(85);
  const reactionTimerRef = useRef(null);

  useEffect(() => {
    document.title = 'About — Squishies Craft & Science';
    return () => {
      if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    };
  }, []);

  const activeModel = LAB_SQUISHIES[activeModelIdx];

  function handleSquishTest() {
    setSquishPulse((p) => p + 1);
    setSquishCount((c) => c + 1);
    setStressLevel((s) => Math.max(12, s - 8));
    setLastReaction(activeModel.quote);

    if (reactionTimerRef.current) clearTimeout(reactionTimerRef.current);
    reactionTimerRef.current = setTimeout(() => {
      setLastReaction('');
    }, 2400);

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(12);
      }
    } catch {}
  }

  return (
    <main className="about-jelly">
      {/* ============ ABOUT HERO: INTERACTIVE LABORATORY ============ */}
      <section className="about-hero about-hero--creative">
        <div className="about-hero__blob about-hero__blob--purple" aria-hidden="true" />
        <div className="about-hero__blob about-hero__blob--pink" aria-hidden="true" />

        <div className="container container--wide">
          <div className="about-lab-grid">
            {/* LEFT: Story & Philosophy */}
            <div className="about-hero__content">
              <span className="eyebrow eyebrow--pink">
                ● THE SCIENCE OF SLOW-RISE
              </span>
              <h1>More than just cute. Engineered to soothe.</h1>
              <p>
                Squishies wasn’t started to make cheap disposable trinkets. We set
                out to engineer the world’s most tactile, slow-rising stress relief
                companion — combining velvet medical-grade TPR with micro-cellular
                memory foam that returns your desk sanity in slow motion.
              </p>

              {/* Live Interactive Telemetry Box */}
              <div className="about-telemetry-card">
                <div className="about-telemetry-card__header">
                  <div>
                    <span className="about-telemetry-card__sub">Live Tactile Test Rig</span>
                    <strong>{activeModel.name} Edition</strong>
                  </div>
                  <span className="about-telemetry-badge">
                    {activeModel.reboundSeconds}s Slow-Rise
                  </span>
                </div>

                <div className="about-telemetry-meter">
                  <div className="about-telemetry-meter__row">
                    <span>Simulated Stress Level</span>
                    <strong>{stressLevel}%</strong>
                  </div>
                  <div className="about-telemetry-meter__track">
                    <div
                      className="about-telemetry-meter__fill"
                      style={{ width: `${stressLevel}%` }}
                    />
                  </div>
                </div>

                <div className="about-telemetry-stats">
                  <div className="about-stat-item">
                    <span className="about-stat-num">{squishCount}</span>
                    <span className="about-stat-lbl">Lab Squeezes</span>
                  </div>
                  <div className="about-stat-item">
                    <span className="about-stat-num">{activeModel.baseSoftness}%</span>
                    <span className="about-stat-lbl">Softness Rating</span>
                  </div>
                  <div className="about-stat-item">
                    <span className="about-stat-num">{activeModel.reboundSeconds}s</span>
                    <span className="about-stat-lbl">Rebound Duration</span>
                  </div>
                </div>

                <div className="about-model-tabs" role="tablist" aria-label="Choose a model to test">
                  {LAB_SQUISHIES.map((model, idx) => (
                    <button
                      key={model.slug}
                      type="button"
                      role="tab"
                      aria-selected={idx === activeModelIdx}
                      className={`about-model-tab${idx === activeModelIdx ? ' is-active' : ''}`}
                      onClick={() => {
                        setActiveModelIdx(idx);
                        setLastReaction('');
                      }}
                    >
                      {model.name}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* RIGHT: Live 3D Interactive Testing Chamber */}
            <div className="about-lab-stage-col">
              <div className="about-chamber">
                <div className="about-chamber__top">
                  <span className="about-chamber__tag">
                    MATERIAL CHAMBER: {activeModel.type}
                  </span>
                  <span className="badge badge--mint">Press 3D Model</span>
                </div>

                {lastReaction && (
                  <div className="about-chamber__bubble" role="status">
                    {lastReaction}
                  </div>
                )}

                <div className="about-chamber__viewer">
                  <Suspense
                    fallback={
                      <div className="about-chamber__loading">
                        Spinning up 3D material engine…
                      </div>
                    }
                  >
                    <ProductViewer3D
                      key={activeModel.slug}
                      url={PRODUCT_MODELS[activeModel.slug]}
                      alt={`${activeModel.name} tactile test`}
                      compact
                      hideHint
                      scaleBoost={1.14}
                      pulseSignal={squishPulse}
                      onSquish={handleSquishTest}
                    />
                  </Suspense>
                </div>

                <div className="about-chamber__footer">
                  <button
                    type="button"
                    className="btn btn--pink btn--sm about-chamber__squish-btn"
                    onClick={handleSquishTest}
                  >
                    ✦ Squeeze Material (+ Relieve Stress)
                  </button>
                  <p className="about-chamber__hint">
                    Drag to inspect 360° · Tap or hold to compress memory foam
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ INTERACTIVE 3-TIER ANATOMY EXPLORER ============ */}
      <section className="about-anatomy">
        <div className="container container--wide">
          <div className="section-head text-center">
            <span className="eyebrow eyebrow--pink">● INSIDE THE SQUISHY</span>
            <h2>Three Layers of Pure Comfort.</h2>
            <p>
              Click each layer below to dissect what makes our squishies resilient,
              non-toxic, and remarkably slow to rise back.
            </p>
          </div>

          <div className="about-layers-interactive">
            {/* Left Layer Switcher Cards */}
            <div className="about-layer-nav" role="tablist" aria-label="Squishy anatomy layers">
              {INTERACTIVE_LAYERS.map((layer, idx) => {
                const isActive = idx === activeLayer;
                return (
                  <button
                    key={layer.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    className={`about-layer-card${isActive ? ' is-active' : ''}`}
                    onClick={() => setActiveLayer(idx)}
                  >
                    <div className="about-layer-card__header">
                      <span className="about-layer-card__badge">{layer.tag}</span>
                      <span className="about-layer-card__arrow">{isActive ? '▼' : '▶'}</span>
                    </div>
                    <h3>{layer.title}</h3>
                    <p>{layer.subtitle}</p>
                  </button>
                );
              })}
            </div>

            {/* Right Detailed Dissection Board */}
            <div className="about-layer-display">
              <div className="about-layer-display__badge-row">
                <span className="badge badge--pink">Active Dissection</span>
                <span className="about-layer-display__stat">
                  {INTERACTIVE_LAYERS[activeLayer].stat}
                </span>
              </div>

              <h2>{INTERACTIVE_LAYERS[activeLayer].title}</h2>
              <strong className="about-layer-display__sub">
                {INTERACTIVE_LAYERS[activeLayer].subtitle}
              </strong>

              <p className="about-layer-display__desc">
                {INTERACTIVE_LAYERS[activeLayer].desc}
              </p>

              <div className="about-layer-display__card">
                <div className="about-layer-display__icon">✦</div>
                <div>
                  <strong>{INTERACTIVE_LAYERS[activeLayer].statSub}</strong>
                  <p>{INTERACTIVE_LAYERS[activeLayer].interactiveTip}</p>
                </div>
                <button
                  type="button"
                  className="btn btn--outline btn--sm"
                  onClick={handleSquishTest}
                >
                  Test Layer Squeeze
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ INTERACTIVE LAB SPEC TABS ============ */}
      <section className="about-specs-interactive">
        <div className="container container--wide">
          <div className="about-specs-card">
            <div className="about-specs-tabs" role="tablist" aria-label="Material certifications">
              {ANATOMY_SPECS.map((spec, idx) => (
                <button
                  key={spec.id}
                  type="button"
                  role="tab"
                  aria-selected={idx === activeSpec}
                  className={`about-spec-tab${idx === activeSpec ? ' is-active' : ''}`}
                  onClick={() => setActiveSpec(idx)}
                >
                  {spec.title}
                </button>
              ))}
            </div>

            <div className="about-spec-content">
              <div className="about-spec-content__main">
                <span className="eyebrow eyebrow--pink">Certification & Testing</span>
                <h3>{ANATOMY_SPECS[activeSpec].title}</h3>
                <p className="about-spec-lead">{ANATOMY_SPECS[activeSpec].summary}</p>
                <p className="about-spec-body">{ANATOMY_SPECS[activeSpec].details}</p>
              </div>

              <div className="about-spec-cta">
                <p>Want to feel the slow-rise difference for yourself?</p>
                <Link to="/shop.html" className="btn btn--pink btn--lg">
                  Explore All 20 Editions →
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
