import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../styles/about-studio.css';

const ANATOMY_LAYERS = [
  {
    id: 'skin',
    code: '01',
    label: 'Outer TPR Skin',
    spec: 'BPA-Free · Hypoallergenic',
    summary:
      'Velvet-matte Thermoplastic Rubber formulated to stay dry, lint-resistant, and safe for ages 3+ with zero oily sheen.',
    metricLabel: 'Tear Resistance',
    metricValue: 96,
  },
  {
    id: 'core',
    code: '02',
    label: 'Memory Foam Core',
    spec: '30–45s Slow Rebound',
    summary:
      'Micro-porous air cells gently vent air under finger pressure and slowly draw breath back to recover shape smoothly.',
    metricLabel: 'Cloud Softness',
    metricValue: 98,
  },
  {
    id: 'pouch',
    code: '03',
    label: 'Eco Matte Zip Pouch',
    spec: '3 × 3 × 2.5 in · 45–55g',
    summary:
      'Every Squishy ships sealed inside a reusable matte zip pouch printed with mild-soap wash & desk care guidance.',
    metricLabel: 'Portability Index',
    metricValue: 92,
  },
  {
    id: 'wash',
    code: '04',
    label: 'Washable Seal',
    spec: 'Water-Resistant Surface',
    summary:
      'Quickly rinse under cool water with mild hand soap and pat dry—ideal for daily study breaks and shared desks.',
    metricLabel: 'Easy Care Score',
    metricValue: 95,
  },
];

const SISO_TEAM = [
  {
    role: 'Team Leader',
    name: 'Goyena, Shawn Kieffer E.',
    shortName: 'Goyena S.',
    title: 'Product Vision & Architecture',
    bio: 'Directs SISO strategy, release standards, and cross-functional reviews so every collection delivers calm tactile delight and safe craftsmanship.',
    focus: 'Roadmap & Product Standards',
    initials: 'SG',
    accent: '#e84a7a',
    cheerSeed: 18,
  },
  {
    role: 'Scrum Master',
    name: 'Navarro, Sofia Alexi P.',
    shortName: 'Navarro S.',
    title: 'Agile Delivery & Sprint Ops',
    bio: 'Facilitates daily ceremonies, unblocks sprint workflows, and aligns design, testing, and logistics ahead of every drop.',
    focus: 'Sprint Cadence & Ops',
    initials: 'SN',
    accent: '#7c4dff',
    cheerSeed: 21,
  },
  {
    role: 'Core Member',
    name: 'Manguni, John Gabriel',
    shortName: 'Manguni J.',
    title: 'Full-Stack Engineering',
    bio: 'Builds responsive storefront interfaces, database persistence, and seamless cart-to-checkout reliability.',
    focus: 'Commerce & API Systems',
    initials: 'JM',
    accent: '#d97706',
    cheerSeed: 14,
  },
  {
    role: 'Core Member',
    name: 'Palcoto, Russell Andrew L.',
    shortName: 'Palcoto R.',
    title: '3D Graphics & Tactile Motion',
    bio: 'Crafts interactive soft-body geometry, responsive motion tuning, and lightweight asset compression.',
    focus: 'Interactive Motion & 3D',
    initials: 'RP',
    accent: '#059669',
    cheerSeed: 24,
  },
  {
    role: 'Core Member',
    name: 'Batac, Mary Ruth',
    shortName: 'Batac M.',
    title: 'UX Research & QA Lead',
    bio: 'Tests ergonomic hand comfort, accessibility clarity, and consumer safety labeling across all SISO SKUs.',
    focus: 'Ergonomics & Safety QA',
    initials: 'MB',
    accent: '#db2777',
    cheerSeed: 16,
  },
  {
    role: 'Core Member',
    name: 'Penafiel, Daniella',
    shortName: 'Penafiel D.',
    title: 'Brand Styling & Aesthetics',
    bio: 'Shapes signature SISO packaging aesthetics, palette harmony, and gift-ready unboxing presentation.',
    focus: 'Visual Identity & Packaging',
    initials: 'DP',
    accent: '#2563eb',
    cheerSeed: 19,
  },
];

const DOSSIER_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'features', label: '5 Features' },
  { id: 'specs', label: 'Specs & Safety' },
  { id: 'audience', label: 'Who & Uses' },
  { id: 'packages', label: 'Packages' },
];

const KEY_FEATURES = [
  { num: '01', title: 'Slow-Rising Memory', desc: 'Uniform 30–45s pneumatic recovery for deep tactile stress relief.' },
  { num: '02', title: 'Non-Toxic & BPA-Free', desc: '100% hypoallergenic Thermoplastic Rubber & low-odor foam, ages 3+.' },
  { num: '03', title: 'Tear-Resistant Core', desc: 'Built to endure repeated desk pinching, kneading, and stretching.' },
  { num: '04', title: 'Soap & Water Washable', desc: 'Water-resistant skin rinses clean cleanly in seconds.' },
  { num: '05', title: 'Collectible Designs', desc: 'Iconic Dumpling, Cheese Cube, Mochi Cat Paw, Toast, Butter, and Peanut drops.' },
];

const TECH_SPECS = [
  { label: 'Material', value: 'Premium Thermoplastic Rubber (TPR) + Memory Foam' },
  { label: 'Dimensions', value: 'Avg. 3 × 3 × 2.5 inches (varies slightly by shape)' },
  { label: 'Weight', value: '45–55 grams per sealed unit' },
  { label: 'Packaging', value: 'Reusable matte zip pouch + care card' },
  { label: 'Safety Note', value: 'Low-odor, BPA-free, safe for ages 3+. Not edible.' },
];

const AUDIENCE_LIST = [
  { tag: 'Students', note: 'Exam prep calm & quiet lecture focus' },
  { tag: 'Remote & Office', note: 'Ergonomic desk breaks & call fidgeting' },
  { tag: 'Collectors', note: 'Unboxing sets, ASMR & shelf display' },
  { tag: 'Sensory Needs', note: 'Predictable slow pressure stimulation' },
  { tag: 'Resellers & Events', note: 'Party favors, loot bags & pop-up stock' },
];

const USE_CASE_LIST = [
  { label: 'Stress Relief', detail: 'High-pressure deadlines & crunch hours' },
  { label: 'Focus Aid', detail: 'Silent hand engagement while reading' },
  { label: 'Gifting & Parties', detail: 'Birthdays & school event giveaways' },
  { label: 'Aesthetic Decor', detail: 'Pastel companions for study setups' },
];

const PACKAGES = [
  {
    id: 'solo',
    name: 'Solo Squish',
    units: 1,
    price: 89,
    bonus: 'Eco matte zip pouch',
    bestFor: 'Single desk pick-me-up',
  },
  {
    id: 'trio',
    name: 'Stress-Free Trio',
    units: 3,
    price: 249,
    bonus: 'Save ₱18 total',
    bestFor: 'Desk, bag & friend gift',
    popular: true,
  },
  {
    id: 'collector',
    name: "Collector's Box",
    units: 6,
    price: 459,
    bonus: 'Includes free sticker sheet',
    bestFor: 'Complete display set',
  },
  {
    id: 'party',
    name: 'Wholesale / Party Pack',
    units: 20,
    price: 1400,
    bonus: 'Event & reseller rate',
    bestFor: 'Giveaways & small shops',
  },
];

function Icon({ name }) {
  const shared = {
    width: 17,
    height: 17,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round',
    'aria-hidden': 'true',
  };

  switch (name) {
    case 'mail':
      return (
        <svg {...shared}>
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      );
    case 'check':
      return (
        <svg {...shared}>
          <polyline points="20 6 9 17 4 12" />
        </svg>
      );
    case 'copy':
      return (
        <svg {...shared}>
          <rect x="9" y="9" width="13" height="13" rx="2" />
          <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
        </svg>
      );
    case 'arrow-left':
      return (
        <svg {...shared}>
          <path d="m15 18-6-6 6-6" />
        </svg>
      );
    case 'arrow-right':
      return (
        <svg {...shared}>
          <path d="m9 18 6-6-6-6" />
        </svg>
      );
    case 'heart':
      return (
        <svg {...shared} fill="currentColor" stroke="none">
          <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
        </svg>
      );
    case 'sparkles':
      return (
        <svg {...shared}>
          <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z" />
        </svg>
      );
    default:
      return (
        <svg {...shared}>
          <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
        </svg>
      );
  }
}

export default function About() {
  const [activeLayerId, setActiveLayerId] = useState('skin');
  const [squishCompression, setSquishCompression] = useState(0);
  const [isPressing, setIsPressing] = useState(false);
  const [squeezeTotal, setSqueezeTotal] = useState(0);
  const [activeMemberIdx, setActiveMemberIdx] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  const [selectedPkgId, setSelectedPkgId] = useState('trio');
  const [emailCopied, setEmailCopied] = useState(false);
  const [cheers, setCheers] = useState(() =>
    SISO_TEAM.map((member) => member.cheerSeed)
  );

  const compressionRef = useRef(0);
  const isPressingRef = useRef(false);
  const releaseTimerRef = useRef(null);

  useEffect(() => {
    document.title = 'About SISO — Squishies Tactile Collective';
    return () => {
      if (releaseTimerRef.current) clearTimeout(releaseTimerRef.current);
    };
  }, []);

  // Real slow-rising pneumatic compression & recovery loop
  useEffect(() => {
    let rafId = null;
    let lastTime = performance.now();

    function step(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;

      let next = compressionRef.current;
      if (isPressingRef.current) {
        next = Math.min(1, next + dt * 3.1);
      } else {
        // Gradual slow-rise rebound feel (~1.8s smooth recovery curve)
        next = Math.max(0, next - dt * 0.52);
      }

      if (Math.abs(next - compressionRef.current) > 0.002) {
        compressionRef.current = next;
        setSquishCompression(next);
      }

      if (isPressingRef.current || next > 0.002) {
        rafId = requestAnimationFrame(step);
      } else if (compressionRef.current !== 0) {
        compressionRef.current = 0;
        setSquishCompression(0);
      }
    }

    if (isPressing || compressionRef.current > 0.002) {
      rafId = requestAnimationFrame(step);
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
    };
  }, [isPressing]);

  function startSquish() {
    if (releaseTimerRef.current) {
      clearTimeout(releaseTimerRef.current);
      releaseTimerRef.current = null;
    }
    isPressingRef.current = true;
    setIsPressing(true);
    setSqueezeTotal((count) => count + 1);
    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(14);
      }
    } catch {}
  }

  function releaseSquish() {
    // Guarantee even a quick click reaches a satisfying slow-rise compression peak
    const remaining = compressionRef.current < 0.72 ? 260 : 0;
    if (remaining > 0) {
      releaseTimerRef.current = setTimeout(() => {
        isPressingRef.current = false;
        setIsPressing(false);
        releaseTimerRef.current = null;
      }, remaining);
    } else {
      isPressingRef.current = false;
      setIsPressing(false);
    }
  }

  function handleCopyEmail() {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText('siso@gmail.com').catch(() => {});
    }
    setEmailCopied(true);
    setTimeout(() => setEmailCopied(false), 2000);
  }

  function handleCheer(idx) {
    setCheers((prev) => prev.map((val, i) => (i === idx ? val + 1 : val)));
  }

  const activeLayer =
    ANATOMY_LAYERS.find((item) => item.id === activeLayerId) || ANATOMY_LAYERS[0];
  const activeMember = SISO_TEAM[activeMemberIdx];
  const selectedPkg =
    PACKAGES.find((item) => item.id === selectedPkgId) || PACKAGES[1];

  const unitCost = (selectedPkg.price / selectedPkg.units).toFixed(
    selectedPkg.price % selectedPkg.units === 0 ? 0 : 2
  );
  const scaleX = 1 + squishCompression * 0.24;
  const scaleY = 1 - squishCompression * 0.28;
  const bouncePct = Math.round((1 - squishCompression) * 100);

  return (
    <div className="siso-studio-page">
      {/* ================= BAND 1: EDITORIAL MASTHEAD + INTERACTIVE ANATOMY ================= */}
      <section className="siso-studio-hero">
        <div className="siso-container siso-hero-layout">
          {/* Left: Studio Editorial Column */}
          <div className="siso-editorial-col">
            <div className="siso-kicker-strip">
              <div className="siso-emblem-lockup">
                <img
                  src="/assets/images/logo-mark.svg"
                  alt="SISO Company Emblem"
                  className="siso-emblem-img"
                />
                <span>SISO Collective</span>
              </div>
              <span className="siso-safety-pill">Ages 3+ · Non-Toxic TPR</span>
            </div>

            <h1 className="siso-display-heading">
              Crafted for calm.
              <br />
              <span className="siso-heading-accent">Engineered by SISO.</span>
            </h1>

            <p className="siso-lead-copy">
              We are a 6-member Philippine student innovation company designing
              ultra-soft, slow-rising sensory Squishies built for study focus,
              desk relief, and tactile joy without harsh materials or markup.
            </p>

            {/* Tactile Quick-Spec Ledger */}
            <div className="siso-ledger-strip" aria-label="SISO key benchmarks">
              <div className="siso-ledger-cell">
                <strong>6</strong>
                <span>SISO Builders</span>
              </div>
              <div className="siso-ledger-cell">
                <strong>30–45s</strong>
                <span>Slow Rebound</span>
              </div>
              <div className="siso-ledger-cell">
                <strong>45–55g</strong>
                <span>BPA-Free Core</span>
              </div>
              <div className="siso-ledger-cell">
                <strong>₱89</strong>
                <span>Starting Price</span>
              </div>
            </div>

            <div className="siso-cta-row">
              <Link to="/shop.html" className="siso-btn-primary">
                Explore the 20 Squishies
                <Icon name="arrow-right" />
              </Link>

              <button
                type="button"
                className={`siso-btn-copy${emailCopied ? ' is-copied' : ''}`}
                onClick={handleCopyEmail}
              >
                <Icon name={emailCopied ? 'check' : 'copy'} />
                {emailCopied ? 'Copied siso@gmail.com' : 'siso@gmail.com'}
              </button>
            </div>
          </div>

          {/* Right: Interactive Tactile Anatomy & Bounce Studio (No WebGL 3D) */}
          <div className="siso-anatomy-card">
            <div className="siso-anatomy-top">
              <div>
                <span className="siso-micro-label">Interactive Material Explorer</span>
                <h2 className="siso-card-heading">Squish Anatomy &amp; Bounce Test</h2>
              </div>
              <span className="siso-counter-chip">
                <Icon name="sparkles" />
                {squeezeTotal} {squeezeTotal === 1 ? 'Test' : 'Tests'}
              </span>
            </div>

            <div className="siso-blueprint-stage">
              {/* Interactive Hold-to-Squish Cross-Section Illustration */}
              <button
                type="button"
                className={`siso-blueprint-canvas${isPressing ? ' is-squished' : ''}`}
                onPointerDown={startSquish}
                onPointerUp={releaseSquish}
                onPointerLeave={releaseSquish}
                onKeyDown={(e) => {
                  if (e.key === ' ' || e.key === 'Enter') startSquish();
                }}
                onKeyUp={releaseSquish}
                aria-label="Press and hold to test slow-rising compression and rebound"
              >
                <svg
                  viewBox="0 0 260 210"
                  className="siso-dumpling-svg"
                  style={{
                    transform: `scale(${scaleX.toFixed(3)}, ${scaleY.toFixed(3)})`,
                  }}
                >
                  {/* Eco Zip Pouch Halo when Pouch layer selected */}
                  <rect
                    x="18"
                    y="14"
                    width="224"
                    height="182"
                    rx="24"
                    className={`siso-svg-pouch${activeLayerId === 'pouch' ? ' is-selected' : ''}`}
                  />
                  {/* Ground shadow */}
                  <ellipse cx="130" cy="176" rx="74" ry="12" className="siso-svg-shadow" />
                  {/* Outer TPR Skin */}
                  <path
                    d="M52 128 C52 78, 86 58, 108 54 C106 38, 118 32, 130 38 C142 32, 154 38, 152 54 C174 58, 208 78, 208 128 C208 164, 174 174, 130 174 C86 174, 52 164, 52 128 Z"
                    className={`siso-svg-skin${activeLayerId === 'skin' ? ' is-selected' : ''}`}
                  />
                  {/* Inner Cutaway Memory Foam Core */}
                  <ellipse
                    cx="130"
                    cy="126"
                    rx="46"
                    ry="28"
                    className={`siso-svg-core${activeLayerId === 'core' ? ' is-selected' : ''}`}
                  />
                  {/* Micro-porous foam air cells */}
                  <g className={`siso-svg-pores${activeLayerId === 'core' ? ' is-selected' : ''}`}>
                    <circle cx="108" cy="122" r="4" />
                    <circle cx="126" cy="115" r="5" />
                    <circle cx="148" cy="124" r="3.5" />
                    <circle cx="118" cy="135" r="4" />
                    <circle cx="139" cy="136" r="4.5" />
                  </g>
                  {/* Subtle water droplet glints for washable layer */}
                  <g className={`siso-svg-drops${activeLayerId === 'wash' ? ' is-selected' : ''}`}>
                    <path d="M188 70 C188 70, 195 80, 195 85 C195 89, 192 92, 188 92 C184 92, 181 89, 181 85 C181 80, 188 70, 188 70 Z" />
                    <path d="M72 78 C72 78, 77 86, 77 90 C77 93, 75 95, 72 95 C69 95, 67 93, 67 90 C67 86, 72 78, 72 78 Z" />
                  </g>
                  {/* Expression */}
                  <circle cx="112" cy="96" r="4" className="siso-svg-eye" />
                  <circle cx="148" cy="96" r="4" className="siso-svg-eye" />
                  <path d="M123 101 Q130 108 137 101" className="siso-svg-smile" />
                </svg>

                <span className="siso-hold-hint">
                  {isPressing ? 'Compressing Foam… Release to Rebound' : 'Tap or Hold Squishy to Test Rebound'}
                </span>
              </button>

              {/* Layer Pin Selector Pills */}
              <div className="siso-layer-pills" role="tablist" aria-label="Material layers">
                {ANATOMY_LAYERS.map((layer) => (
                  <button
                    key={layer.id}
                    type="button"
                    role="tab"
                    aria-selected={activeLayerId === layer.id}
                    className={`siso-layer-btn${activeLayerId === layer.id ? ' is-active' : ''}`}
                    onClick={() => setActiveLayerId(layer.id)}
                  >
                    <span className="siso-layer-code">{layer.code}</span>
                    <span>{layer.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Active Layer Detail & Live Rebound Meter */}
            <div className="siso-layer-readout">
              <div className="siso-layer-head">
                <strong>{activeLayer.label}</strong>
                <span>{activeLayer.spec}</span>
              </div>
              <p className="siso-layer-desc">{activeLayer.summary}</p>
              <div className="siso-meter-pair">
                <div className="siso-meter-row">
                  <span>{activeLayer.metricLabel}</span>
                  <strong>{activeLayer.metricValue}%</strong>
                </div>
                <div className="siso-meter-track">
                  <div
                    className="siso-meter-fill"
                    style={{ width: `${activeLayer.metricValue}%` }}
                  />
                </div>
                <div className="siso-meter-row">
                  <span>Live Pneumatic Rebound</span>
                  <strong>{bouncePct}% Restored</strong>
                </div>
                <div className="siso-meter-track is-rebound">
                  <div
                    className="siso-meter-fill is-rebound"
                    style={{ width: `${bouncePct}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= BAND 2: COMPACT WORKBENCH — BUILDERS + DOSSIER ================= */}
      <section className="siso-studio-workbench">
        <div className="siso-container siso-workbench-grid">
          {/* Left: Interactive 6-Builder Spotlight Deck */}
          <div className="siso-panel siso-team-deck">
            <div className="siso-panel-head">
              <div>
                <span className="siso-micro-label">The Collective</span>
                <h2 className="siso-card-heading">6 Builders Behind SISO</h2>
              </div>
              <div className="siso-deck-arrows">
                <button
                  type="button"
                  aria-label="Previous team member"
                  onClick={() =>
                    setActiveMemberIdx((prev) => (prev - 1 + SISO_TEAM.length) % SISO_TEAM.length)
                  }
                >
                  <Icon name="arrow-left" />
                </button>
                <button
                  type="button"
                  aria-label="Next team member"
                  onClick={() => setActiveMemberIdx((prev) => (prev + 1) % SISO_TEAM.length)}
                >
                  <Icon name="arrow-right" />
                </button>
              </div>
            </div>

            {/* Selector Rail */}
            <div className="siso-member-rail" role="tablist" aria-label="SISO team roster">
              {SISO_TEAM.map((member, idx) => (
                <button
                  key={member.name}
                  type="button"
                  role="tab"
                  aria-selected={activeMemberIdx === idx}
                  className={`siso-rail-chip${activeMemberIdx === idx ? ' is-active' : ''}`}
                  onClick={() => setActiveMemberIdx(idx)}
                >
                  <span
                    className="siso-rail-dot"
                    style={{ background: member.accent }}
                    aria-hidden="true"
                  >
                    {member.initials}
                  </span>
                  <span>{member.shortName}</span>
                </button>
              ))}
            </div>

            {/* Active Builder Spotlight */}
            <div className="siso-spotlight-card">
              <div className="siso-spotlight-top">
                <div
                  className="siso-spotlight-avatar"
                  style={{ background: activeMember.accent }}
                >
                  {activeMember.initials}
                </div>
                <div>
                  <span className="siso-role-badge">{activeMember.role}</span>
                  <h3 className="siso-spotlight-name">{activeMember.name}</h3>
                  <div className="siso-spotlight-role">{activeMember.title}</div>
                </div>
              </div>

              <p className="siso-spotlight-bio">{activeMember.bio}</p>

              <div className="siso-spotlight-footer">
                <div className="siso-focus-pill">
                  <span>Sprint Focus:</span>
                  <strong>{activeMember.focus}</strong>
                </div>

                <button
                  type="button"
                  className="siso-cheer-action"
                  onClick={() => handleCheer(activeMemberIdx)}
                  aria-label={`Send cheer to ${activeMember.name}`}
                >
                  <Icon name="heart" />
                  <span>Cheer</span>
                  <strong>{cheers[activeMemberIdx]}</strong>
                </button>
              </div>
            </div>
          </div>

          {/* Right: Interactive Company Dossier & Value Calculator */}
          <div className="siso-panel siso-dossier-deck">
            <div className="siso-panel-head">
              <div>
                <span className="siso-micro-label">Company &amp; Product Guide</span>
                <h2 className="siso-card-heading">SISO Knowledge Dossier</h2>
              </div>
              <a href="mailto:siso@gmail.com" className="siso-mail-inline">
                <Icon name="mail" />
                <span>Support</span>
              </a>
            </div>

            <div className="siso-dossier-tabs" role="tablist" aria-label="SISO documentation tabs">
              {DOSSIER_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`siso-tab-chip${activeTab === tab.id ? ' is-active' : ''}`}
                  onClick={() => setActiveTab(tab.id)}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            <div className="siso-dossier-body" role="tabpanel">
              {activeTab === 'overview' && (
                <div className="siso-tab-pane">
                  <p className="siso-pane-lead">
                    Squishies are premium, ultra-soft sensory stress relievers crafted by{' '}
                    <strong>SISO</strong> to pair durable 30–45s slow-rising rebound with
                    non-toxic, consumer-safe materials and trend-forward aesthetic silhouettes.
                  </p>
                  <div className="siso-mini-grid">
                    <div className="siso-mini-box">
                      <span>Core Mission</span>
                      <strong>Safe daily anxiety &amp; focus relief</strong>
                    </div>
                    <div className="siso-mini-box">
                      <span>Team Leadership</span>
                      <strong>Goyena, S. &amp; Navarro, S.</strong>
                    </div>
                    <div className="siso-mini-box">
                      <span>Safety Assurance</span>
                      <strong>100% BPA-Free, Low-Odor, Ages 3+</strong>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'features' && (
                <div className="siso-tab-pane siso-features-rows">
                  {KEY_FEATURES.map((feat) => (
                    <div key={feat.num} className="siso-feature-row">
                      <span className="siso-feature-idx">{feat.num}</span>
                      <div>
                        <strong>{feat.title}</strong>
                        <p>{feat.desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'specs' && (
                <div className="siso-tab-pane siso-spec-rows">
                  {TECH_SPECS.map((row) => (
                    <div key={row.label} className="siso-spec-row">
                      <span>{row.label}</span>
                      <strong>{row.value}</strong>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'audience' && (
                <div className="siso-tab-pane siso-aud-use-split">
                  <div>
                    <span className="siso-sublabel">Designed For</span>
                    <div className="siso-tag-list">
                      {AUDIENCE_LIST.map((item) => (
                        <div key={item.tag} className="siso-tag-item">
                          <strong>{item.tag}</strong>
                          <span>{item.note}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <span className="siso-sublabel">Everyday Use Cases</span>
                    <div className="siso-tag-list">
                      {USE_CASE_LIST.map((item) => (
                        <div key={item.label} className="siso-tag-item">
                          <strong>{item.label}</strong>
                          <span>{item.detail}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'packages' && (
                <div className="siso-tab-pane siso-packages-pane">
                  <div className="siso-pkg-grid">
                    {PACKAGES.map((pkg) => (
                      <button
                        key={pkg.id}
                        type="button"
                        className={`siso-pkg-btn${selectedPkgId === pkg.id ? ' is-selected' : ''}`}
                        onClick={() => setSelectedPkgId(pkg.id)}
                      >
                        <div className="siso-pkg-top">
                          <strong>{pkg.name}</strong>
                          {pkg.popular && <span className="siso-pkg-pop">Popular</span>}
                        </div>
                        <div className="siso-pkg-price-row">
                          <span className="siso-pkg-amt">₱{pkg.price.toLocaleString()}</span>
                          <span className="siso-pkg-units">
                            {pkg.units} {pkg.units === 1 ? 'pc' : 'pcs'}
                          </span>
                        </div>
                        <span className="siso-pkg-bonus">{pkg.bonus}</span>
                      </button>
                    ))}
                  </div>

                  {/* Interactive Per-Unit Value Readout */}
                  <div className="siso-value-bar">
                    <div>
                      <span className="siso-micro-label">Selected Package Breakdown</span>
                      <div className="siso-value-summary">
                        <strong>{selectedPkg.name}</strong> — ₱{unitCost} per squishy ·{' '}
                        {selectedPkg.bestFor}
                      </div>
                    </div>
                    <Link to="/shop.html" className="siso-value-cta">
                      Shop Now
                      <Icon name="arrow-right" />
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ================= COMPACT CONTACT FOOTER BAR ================= */}
      <section className="siso-studio-footer-band">
        <div className="siso-container">
          <div className="siso-signature-bar">
            <div className="siso-sig-left">
              <strong>Need Wholesale or Event Giveaways?</strong>
              <span>
                Project Lead: Goyena, Shawn Kieffer E. · Scrum Master: Navarro, Sofia Alexi P.
              </span>
            </div>
            <a href="mailto:siso@gmail.com" className="siso-sig-btn">
              <Icon name="mail" />
              Email siso@gmail.com
            </a>
          </div>
        </div>
      </section>
    </div>
  );
}
