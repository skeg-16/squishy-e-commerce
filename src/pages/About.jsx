import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { PRODUCT_MODELS } from '../data/productModels';

const ProductViewer3D = lazy(() => import('../components/ProductViewer3D'));

const SISO_TEAM = [
  {
    role: 'Team Leader',
    name: 'Goyena, Shawn Kieffer E.',
    title: 'Lead Vision & Product Architecture',
    bio: 'Oversees product direction, design systems, and ensures every Squishies release delivers genuine sensory delight and quality.',
    avatarColor: 'linear-gradient(135deg, #ff7bac 0%, #e0327e 100%)',
    initials: 'SG',
    tag: 'Leadership',
  },
  {
    role: 'Scrum Master',
    name: 'Navarro, Sofia Alexi P.',
    title: 'Agile Delivery & Sprint Coordination',
    bio: 'Drives sprint ceremonies, unblocks engineering roadmaps, and keeps the SISO team aligned on quality and delivery milestones.',
    avatarColor: 'linear-gradient(135deg, #a78bfa 0%, #7c3aed 100%)',
    initials: 'SN',
    tag: 'Scrum & Ops',
  },
  {
    role: 'Core Member',
    name: 'Manguni, John Gabriel',
    title: 'Full-Stack & Systems Engineering',
    bio: 'Engineers responsive client interfaces, backend data models, and fluid component interactions across the storefront.',
    avatarColor: 'linear-gradient(135deg, #fbbf24 0%, #d97706 100%)',
    initials: 'JM',
    tag: 'Development',
  },
  {
    role: 'Core Member',
    name: 'Palcoto, Russell Andrew L.',
    title: '3D Graphics & Tactile Physics',
    bio: 'Specializes in procedural soft-body mechanics, Three.js shaders, and interactive 3D model compression.',
    avatarColor: 'linear-gradient(135deg, #34d399 0%, #059669 100%)',
    initials: 'RP',
    tag: '3D Engine',
  },
  {
    role: 'Core Member',
    name: 'Batac, Mary Ruth',
    title: 'UX Research & Quality Assurance',
    bio: 'Researches tactile ergonomic satisfaction, accessibility, and verifies non-toxic compliance standards.',
    avatarColor: 'linear-gradient(135deg, #f472b6 0%, #db2777 100%)',
    initials: 'MB',
    tag: 'UX & QA',
  },
  {
    role: 'Core Member',
    name: 'Penafiel, Daniella',
    title: 'Brand Styling & Visual Aesthetics',
    bio: 'Crafts the playful pastel brand identity, packaging aesthetics, and delightful micro-interactions.',
    avatarColor: 'linear-gradient(135deg, #60a5fa 0%, #2563eb 100%)',
    initials: 'DP',
    tag: 'Design & Brand',
  },
];

const COMPANY_PILLARS = [
  {
    id: 'overview',
    title: 'Product Overview',
    kicker: 'Calming Sensory Innovation',
    badge: 'Flagship Line',
    summary:
      'Squishies are premium, ultra-soft sensory stress relievers designed to provide a calming tactile experience. Made from high-quality, non-toxic materials, they serve as a safe and engaging tool for anxiety relief, focus enhancement, and everyday entertainment. Their unique value lies in their durable, slow-rising texture combined with adorable, trend-forward designs that stand out in the current market while prioritizing consumer safety.',
    highlights: [
      { label: 'Core Mission', val: 'Safe, tactile anxiety relief accessible to everyone.' },
      { label: 'Sensory Texture', val: 'Hypnotic 30–45s slow-rising memory rebound.' },
      { label: 'Safety First', val: 'Hypoallergenic, non-toxic, and 100% BPA-free.' },
    ],
  },
  {
    id: 'features',
    title: 'Key Features',
    kicker: 'Engineering & Materials',
    badge: '100% Safe TPR',
    features: [
      {
        num: '01',
        title: 'Ultra-Soft, Slow-Rising Texture',
        desc: 'Engineered for maximum tactile satisfaction with an authentic pneumatic memory rebound.',
      },
      {
        num: '02',
        title: '100% Non-Toxic & BPA-Free',
        desc: 'Crafted exclusively from hypoallergenic Thermoplastic Rubber (TPR) and clean memory foam.',
      },
      {
        num: '03',
        title: 'Durable & Tear-Resistant',
        desc: 'Tested to withstand frequent stretching, pinching, and thousands of deep squeezes.',
      },
      {
        num: '04',
        title: 'Water-Resistant & Washable',
        desc: 'Easily rinsed with mild soap and warm water — restores like new with zero sticky residue.',
      },
      {
        num: '05',
        title: 'Trend-Forward Aesthetic Designs',
        desc: 'Featuring aesthetic fan favorites like Steamed Dumplings, Cheese Cube, and Mochi Cat Paw.',
      },
    ],
  },
  {
    id: 'specs',
    title: 'Specifications',
    kicker: 'Lab Dimensions & Standards',
    badge: 'Eco-Friendly Pouch',
    specs: [
      { label: 'Material', val: 'Premium Thermoplastic Rubber (TPR) & Memory Foam Core' },
      { label: 'Dimensions', val: 'Average 3 × 3 × 2.5 inches (varies slightly by design)' },
      { label: 'Weight', val: 'Approximately 45–55 grams per unit' },
      { label: 'Packaging', val: 'Individually wrapped in eco-friendly matte zip pouches with care instructions' },
      { label: 'Safety Standards', val: 'Non-toxic and low-odor. Safe for ages 3+. Not edible.' },
      { label: 'Rebound Duration', val: '30 to 45 seconds gradual pneumatic recovery' },
    ],
  },
  {
    id: 'audiences',
    title: 'Target Audience',
    kicker: 'Who We Design For',
    badge: 'Study & Work',
    audiences: [
      {
        icon: '🎓',
        title: 'Students & Learners',
        desc: 'Quick stress relief and focus aid during long study sessions, lectures, and exam preparations.',
      },
      {
        icon: '💻',
        title: 'Office & Remote Workers',
        desc: 'Ergonomic desk accessories to reduce anxiety, combat fidgeting, and unwind during screen breaks.',
      },
      {
        icon: '🧸',
        title: 'Toy Collectors & Teens',
        desc: 'Enthusiasts actively participating in the aesthetic squishy and tactile fidget collecting trend.',
      },
      {
        icon: '✨',
        title: 'Sensory Processing Seekers',
        desc: 'Individuals benefiting from calming tactile stimulation, grounding routines, and soft-touch reassurance.',
      },
      {
        icon: '📦',
        title: 'Resellers & Small Shops',
        desc: 'Online sellers, gift shops, and party planners stocking viral, high-demand sensory trend items.',
      },
    ],
  },
  {
    id: 'usecases',
    title: 'Use Cases',
    kicker: 'Everyday Applications',
    badge: 'Everyday Joy',
    useCases: [
      {
        tag: 'Relief',
        title: 'Stress & Anxiety Relief',
        desc: 'Deep kneading and squeezing during high-pressure moments, tight deadlines, or tense study sessions.',
      },
      {
        tag: 'Focus',
        title: 'Fidget & Focus Aid',
        desc: 'Keeps restless hands engaged quietly without disrupting colleagues, classmates, or roommates.',
      },
      {
        tag: 'Gifting',
        title: 'Gifting & Event Favors',
        desc: 'Trendy birthday gifts, sweet care packages, and memorable school or corporate event giveaways.',
      },
      {
        tag: 'Decor',
        title: 'Aesthetic Desk Decor',
        desc: 'Charming pastel companions on study desks, bookshelves, and workstations to brighten the workspace.',
      },
      {
        tag: 'ASMR',
        title: 'Content & ASMR Squeezes',
        desc: 'Perfect for soothing slow-motion clips, unboxing showcases, and tactile sound design recordings.',
      },
    ],
  },
  {
    id: 'pricing',
    title: 'Pricing & Packages',
    kicker: 'Direct Accessible Packages',
    badge: 'Direct Value',
    packages: [
      {
        name: 'Solo Squish',
        price: '₱89',
        qty: '1 Unit',
        desc: 'A single signature squishy in individual matte pouch. Perfect desk companion.',
        highlight: false,
      },
      {
        name: 'Stress-Free Trio Bundle',
        price: '₱249',
        qty: '3 Units',
        desc: 'Save ₱18! One for your desk, one for your bag, and one to gift a best friend.',
        highlight: true,
        pill: 'Save ₱18',
      },
      {
        name: "Collector's Box",
        price: '₱459',
        qty: 'Set of 6 Distinct Designs',
        desc: 'The complete edition collection with a free collectible sticker sheet and keepsake gift box.',
        highlight: false,
        pill: 'Free Sticker Sheet',
      },
      {
        name: 'Wholesale / Party Package',
        price: '₱1,400',
        qty: '20 Units',
        desc: 'Bulk pricing for event giveaways, classroom rewards, party bags, or small shop reselling.',
        highlight: false,
        pill: 'Best Bulk Value',
      },
    ],
  },
];

const MODEL_CHOICES = [
  { slug: 'dumpling', name: 'Dumpling', quote: 'Puff! Squeezed away the study stress!' },
  { slug: 'cheese', name: 'Cheese Cube', quote: 'Melty slow-rise cheddar goodness!' },
  { slug: 'catpaw', name: 'Cat Paw', quote: 'Purrfect toe-bean squish achieved!' },
  { slug: 'toast', name: 'Pastel Toast', quote: 'Warm slow-rise toast vibes!' },
  { slug: 'butter', name: 'Butter Stick', quote: 'Melting under your thumb so smoothly!' },
  { slug: 'peanut', name: 'Peanut', quote: 'Crackly texture, mega satisfying!' },
];

export default function About() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeModel, setActiveModel] = useState('dumpling');
  const [squishCount, setSquishCount] = useState(0);
  const [speechBubble, setSpeechBubble] = useState('');
  const [cheers, setCheers] = useState({ 0: 12, 1: 15, 2: 9, 3: 18, 4: 11, 5: 14 });
  const speechTimerRef = useRef(null);

  useEffect(() => {
    document.title = 'About SISO — Squishies Company & Collective';
    return () => {
      if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    };
  }, []);

  function handleSquishModel(modelSlug) {
    const chosen = MODEL_CHOICES.find((m) => m.slug === modelSlug) || MODEL_CHOICES[0];
    setSquishCount((prev) => prev + 1);
    setSpeechBubble(chosen.quote);

    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    speechTimerRef.current = setTimeout(() => {
      setSpeechBubble('');
    }, 2800);

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(15);
      }
    } catch {}
  }

  function handleCheerMember(index, name) {
    setCheers((prev) => ({
      ...prev,
      [index]: (prev[index] || 0) + 1,
    }));
    setSpeechBubble(`Cheered for ${name}!`);

    if (speechTimerRef.current) clearTimeout(speechTimerRef.current);
    speechTimerRef.current = setTimeout(() => {
      setSpeechBubble('');
    }, 2200);

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(20);
      }
    } catch {}
  }

  const currentPillar = COMPANY_PILLARS[activeTab];

  return (
    <main className="siso-page-wrapper">
      {/* ================= HERO SECTION ================= */}
      <section className="siso-hero-block">
        <div className="siso-container">
          <div className="siso-hero-grid">
            {/* Left: SISO Brand Profile */}
            <div className="siso-hero-card">
              <div className="siso-brand-badge-row">
                <div className="siso-brand-pill">
                  <img
                    src="/assets/images/logo-mark.svg"
                    alt="SISO Logo"
                    className="siso-logo-icon"
                  />
                  <span className="siso-brand-pill-title">SISO</span>
                  <span className="siso-brand-pill-sub">Official Company Profile</span>
                </div>
                <span className="siso-status-pill">● Student-Led Innovation</span>
              </div>

              <h1 className="siso-hero-title">
                Meet <span className="siso-text-highlight">SISO</span>.
                <br />
                The Creators Behind Squishies.
              </h1>

              <p className="siso-hero-description">
                <strong>SISO</strong> is an agile project and innovation collective dedicated
                to engineering safe, slow-rising tactile stress relievers. We combine 100% non-toxic,
                hypoallergenic materials with adorable, trend-forward designs that bring genuine
                calm, focus, and tactile satisfaction to study sessions and desks everywhere.
              </p>

              {/* 4 Core Quick Facts */}
              <div className="siso-facts-row">
                <div className="siso-fact-item">
                  <span className="siso-fact-num">6</span>
                  <span className="siso-fact-lbl">SISO Builders</span>
                </div>
                <div className="siso-fact-item">
                  <span className="siso-fact-num">100%</span>
                  <span className="siso-fact-lbl">Non-Toxic TPR</span>
                </div>
                <div className="siso-fact-item">
                  <span className="siso-fact-num">30–45s</span>
                  <span className="siso-fact-lbl">Slow Rebound</span>
                </div>
                <div className="siso-fact-item">
                  <span className="siso-fact-num">₱89</span>
                  <span className="siso-fact-lbl">Entry Price</span>
                </div>
              </div>

              {/* Hero Call to Action */}
              <div className="siso-hero-actions">
                <a
                  href="mailto:siso@gmail.com"
                  className="siso-primary-btn"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" strokeWidth="2" />
                    <path d="M22 7l-10 7L2 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Email SISO: siso@gmail.com
                </a>
                <Link to="/shop.html" className="siso-secondary-btn">
                  Browse Catalog →
                </Link>
              </div>
            </div>

            {/* Right: Interactive 3D Tactile Chamber */}
            <div className="siso-chamber-card">
              <div className="siso-chamber-top">
                <div className="siso-chamber-title-box">
                  <span className="siso-chamber-kicker">Interactive Tactile Lab</span>
                  <h3 className="siso-chamber-title">3D Prototype Squeeze Studio</h3>
                </div>
                <span className="siso-pulse-badge">Live 3D</span>
              </div>

              {/* Speech bubble on squish */}
              {speechBubble && (
                <div className="siso-chamber-bubble" role="status">
                  {speechBubble}
                </div>
              )}

              {/* 3D Model Stage */}
              <div className="siso-chamber-stage">
                <Suspense
                  fallback={
                    <div className="siso-chamber-loading">
                      Loading tactile 3D model…
                    </div>
                  }
                >
                  <ProductViewer3D
                    key={activeModel}
                    url={PRODUCT_MODELS[activeModel]}
                    alt={`SISO 3D ${activeModel} Squishy`}
                    compact
                    hideHint
                    scaleBoost={1.15}
                    pulseSignal={squishCount}
                    onSquish={() => handleSquishModel(activeModel)}
                  />
                </Suspense>
              </div>

              {/* Model Choice Selectors */}
              <div className="siso-model-selector-wrap">
                <span className="siso-selector-label">Select 3D Edition:</span>
                <div className="siso-model-pill-row">
                  {MODEL_CHOICES.map((m) => (
                    <button
                      key={m.slug}
                      type="button"
                      className={`siso-model-pill${activeModel === m.slug ? ' is-active' : ''}`}
                      onClick={() => {
                        setActiveModel(m.slug);
                        handleSquishModel(m.slug);
                      }}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Action & Squeeze Tracker */}
              <div className="siso-chamber-footer">
                <button
                  type="button"
                  className="siso-squish-action-btn"
                  onClick={() => handleSquishModel(activeModel)}
                >
                  ✨ Squeeze 3D {MODEL_CHOICES.find((m) => m.slug === activeModel)?.name}
                </button>
                <div className="siso-chamber-counter">
                  <span>Interactive Squeezes Logged: </span>
                  <strong>{squishCount}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ================= TEAM ROSTER SECTION ================= */}
      <section className="siso-section siso-team-block">
        <div className="siso-container">
          <div className="siso-section-heading">
            <span className="siso-section-eyebrow">● THE TALENT BEHIND SISO</span>
            <h2 className="siso-section-title">The SISO Collective</h2>
            <p className="siso-section-subtitle">
              Meet the 6 dedicated team members driving product vision, agile coordination,
              full-stack systems, 3D graphics, ergonomics, and aesthetic brand craft.
            </p>
          </div>

          <div className="siso-team-cards-grid">
            {SISO_TEAM.map((member, index) => (
              <div key={member.name} className="siso-team-member-card">
                <div className="siso-member-header">
                  <div
                    className="siso-member-avatar"
                    style={{ background: member.avatarColor }}
                  >
                    {member.initials}
                  </div>
                  <div className="siso-member-meta">
                    <span className="siso-role-tag">{member.role}</span>
                    <span className="siso-dept-tag">{member.tag}</span>
                  </div>
                </div>

                <div className="siso-member-body">
                  <h3 className="siso-member-name">{member.name}</h3>
                  <div className="siso-member-specialty">{member.title}</div>
                  <p className="siso-member-bio">{member.bio}</p>
                </div>

                <div className="siso-member-footer">
                  <button
                    type="button"
                    className="siso-cheer-btn"
                    onClick={() => handleCheerMember(index, member.name)}
                    aria-label={`Send a cheer to ${member.name}`}
                  >
                    <span className="siso-cheer-heart">💖</span>
                    <span className="siso-cheer-text">Cheer</span>
                    <span className="siso-cheer-count">{cheers[index] || 0}</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ================= KNOWLEDGE DOSSIER SECTION ================= */}
      <section className="siso-section siso-dossier-block">
        <div className="siso-container">
          <div className="siso-section-heading">
            <span className="siso-section-eyebrow">● OFFICIAL KNOWLEDGE BASE</span>
            <h2 className="siso-section-title">Product &amp; Company Dossier</h2>
            <p className="siso-section-subtitle">
              Explore official specifications, engineering standards, safety verifications,
              target audiences, and wholesale packages.
            </p>
          </div>

          {/* Tab Navigation */}
          <div className="siso-tab-bar" role="tablist" aria-label="SISO Knowledge Base Sections">
            {COMPANY_PILLARS.map((pillar, idx) => (
              <button
                key={pillar.id}
                type="button"
                role="tab"
                aria-selected={activeTab === idx}
                className={`siso-tab-button${activeTab === idx ? ' is-active' : ''}`}
                onClick={() => setActiveTab(idx)}
              >
                {pillar.title}
              </button>
            ))}
          </div>

          {/* Active Tab Panel */}
          <div className="siso-dossier-panel" role="tabpanel">
            <div className="siso-dossier-panel-head">
              <div>
                <span className="siso-dossier-kicker">{currentPillar.kicker}</span>
                <h3 className="siso-dossier-title">{currentPillar.title}</h3>
              </div>
              <span className="siso-dossier-badge">{currentPillar.badge}</span>
            </div>

            {/* TAB: Product Overview */}
            {currentPillar.id === 'overview' && (
              <div className="siso-overview-content">
                <p className="siso-overview-lead">{currentPillar.summary}</p>
                <div className="siso-overview-chips">
                  {currentPillar.highlights?.map((hl, i) => (
                    <div key={i} className="siso-overview-chip">
                      <strong>{hl.label}:</strong>
                      <span>{hl.val}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB: Key Features */}
            {currentPillar.id === 'features' && (
              <div className="siso-features-cards-grid">
                {currentPillar.features?.map((feat, i) => (
                  <div key={i} className="siso-feature-card">
                    <span className="siso-feature-num">{feat.num}</span>
                    <div className="siso-feature-text">
                      <h4>{feat.title}</h4>
                      <p>{feat.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* TAB: Specifications */}
            {currentPillar.id === 'specs' && (
              <div className="siso-specs-list">
                {currentPillar.specs?.map((spec, i) => (
                  <div key={i} className="siso-spec-item">
                    <span className="siso-spec-property">{spec.label}</span>
                    <span className="siso-spec-detail">{spec.val}</span>
                  </div>
                ))}
              </div>
            )}

            {/* TAB: Target Audience */}
            {currentPillar.id === 'audiences' && (
              <div className="siso-audience-cards-grid">
                {currentPillar.audiences?.map((aud, i) => (
                  <div key={i} className="siso-audience-card">
                    <div className="siso-audience-icon">{aud.icon}</div>
                    <h4>{aud.title}</h4>
                    <p>{aud.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {/* TAB: Use Cases */}
            {currentPillar.id === 'usecases' && (
              <div className="siso-usecases-cards-grid">
                {currentPillar.useCases?.map((uc, i) => (
                  <div key={i} className="siso-usecase-card">
                    <span className="siso-usecase-tag">{uc.tag}</span>
                    <h4>{uc.title}</h4>
                    <p>{uc.desc}</p>
                  </div>
                ))}
              </div>
            )}

            {/* TAB: Pricing & Packages */}
            {currentPillar.id === 'pricing' && (
              <div className="siso-packages-cards-grid">
                {currentPillar.packages?.map((pkg, i) => (
                  <div
                    key={i}
                    className={`siso-package-card${pkg.highlight ? ' is-highlight' : ''}`}
                  >
                    {pkg.pill && <span className="siso-pkg-promo-pill">{pkg.pill}</span>}
                    <div className="siso-pkg-header">
                      <h4>{pkg.name}</h4>
                      <span className="siso-pkg-qty">{pkg.qty}</span>
                    </div>
                    <div className="siso-pkg-price">{pkg.price}</div>
                    <p className="siso-pkg-desc">{pkg.desc}</p>
                    <Link to="/shop.html" className="siso-pkg-order-btn">
                      Order in Store →
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      {/* ================= CONTACT & COLLABORATION ================= */}
      <section className="siso-section siso-contact-block">
        <div className="siso-container">
          <div className="siso-contact-panel">
            <div className="siso-contact-left">
              <span className="siso-section-eyebrow">● OFFICIAL CONTACT &amp; SUPPORT</span>
              <h2 className="siso-contact-headline">Ready to Collaborate with SISO?</h2>
              <p className="siso-contact-subtext">
                For customer support, wholesale partnerships, event giveaways, or school packages,
                our student team is readily accessible.
              </p>
              <div className="siso-email-display">
                <span>Official Support Email:</span>
                <a href="mailto:siso@gmail.com" className="siso-email-link">
                  siso@gmail.com
                </a>
              </div>
            </div>

            <div className="siso-contact-right">
              <div className="siso-leadership-summary">
                <div className="siso-lead-row">
                  <strong>Project Leader:</strong>
                  <span>Goyena, Shawn Kieffer E.</span>
                </div>
                <div className="siso-lead-row">
                  <strong>Scrum Master:</strong>
                  <span>Navarro, Sofia Alexi P.</span>
                </div>
                <a
                  href="mailto:siso@gmail.com"
                  className="siso-contact-action-btn"
                >
                  Send an Inquiry to SISO →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
