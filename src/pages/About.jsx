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
    avatarColor: 'linear-gradient(135deg, #ff8ec1 0%, #e04f93 100%)',
    initials: 'SG',
    tag: 'Leadership',
  },
  {
    role: 'Scrum Master',
    name: 'Navarro, Sofia Alexi P.',
    title: 'Agile Delivery & Sprint Coordination',
    bio: 'Drives sprint ceremonies, unblocks engineering roadmaps, and keeps the SISO team aligned on quality and delivery milestones.',
    avatarColor: 'linear-gradient(135deg, #bfa6ff 0%, #8a63e5 100%)',
    initials: 'SN',
    tag: 'Scrum & Ops',
  },
  {
    role: 'Core Member',
    name: 'Manguni, John Gabriel',
    title: 'Full-Stack & Systems Engineering',
    bio: 'Engineers responsive client interfaces, backend data models, and fluid component interactions across the storefront.',
    avatarColor: 'linear-gradient(135deg, #ffd86b 0%, #f0a030 100%)',
    initials: 'JM',
    tag: 'Development',
  },
  {
    role: 'Core Member',
    name: 'Palcoto, Russell Andrew L.',
    title: '3D Graphics & Tactile Physics',
    bio: 'Specializes in procedural soft-body mechanics, Three.js shaders, and interactive 3D model compression.',
    avatarColor: 'linear-gradient(135deg, #74e5c8 0%, #3ca88a 100%)',
    initials: 'RP',
    tag: '3D Engine',
  },
  {
    role: 'Core Member',
    name: 'Batac, Mary Ruth',
    title: 'UX Research & Quality Assurance',
    bio: 'Researches tactile ergonomic satisfaction, accessibility, and verifies non-toxic compliance standards.',
    avatarColor: 'linear-gradient(135deg, #ff9eb5 0%, #d95379 100%)',
    initials: 'MB',
    tag: 'UX & QA',
  },
  {
    role: 'Core Member',
    name: 'Penafiel, Daniella',
    title: 'Brand Styling & Visual Aesthetics',
    bio: 'Crafts the playful pastel brand identity, packaging aesthetics, and delightful micro-interactions.',
    avatarColor: 'linear-gradient(135deg, #a8d5ff 0%, #689ee5 100%)',
    initials: 'DP',
    tag: 'Design & Brand',
  },
];

const COMPANY_PILLARS = [
  {
    id: 'overview',
    title: 'Product Overview',
    kicker: 'Calming Sensory Innovation',
    summary:
      'Squishies are premium, ultra-soft sensory stress relievers designed to provide a calming tactile experience. Made from high-quality, non-toxic materials, they serve as a safe and engaging tool for anxiety relief, focus enhancement, and everyday entertainment. Their unique value lies in their durable, slow-rising texture combined with adorable, trend-forward designs that stand out in the current market while prioritizing consumer safety.',
    badge: 'Flagship Line',
  },
  {
    id: 'features',
    title: 'Key Features',
    kicker: 'Engineering & Materials',
    points: [
      'Ultra-soft, slow-rising texture for maximum tactile satisfaction.',
      'Made from 100% non-toxic, BPA-free, and hypoallergenic materials.',
      'Durable and tear-resistant, designed to withstand frequent stretching and squeezing.',
      'Water-resistant and easy to clean with mild soap and water.',
      'Available in highly popular aesthetic designs (e.g., steamed dumplings, cheese cube).',
    ],
    badge: '100% Safe TPR',
  },
  {
    id: 'specs',
    title: 'Specifications',
    kicker: 'Lab Dimensions & Standards',
    specsList: [
      { label: 'Material', val: 'Premium Thermoplastic Rubber (TPR) and Memory Foam' },
      { label: 'Dimensions', val: 'Average 3 × 3 × 2.5 inches (varies slightly by design)' },
      { label: 'Weight', val: 'Approximately 45–55 grams per unit' },
      { label: 'Packaging', val: 'Individually wrapped in eco-friendly matte zip pouches with product care instructions' },
      { label: 'Safety', val: 'Non-toxic and low-odor. Safe for ages 3+. Not edible.' },
    ],
    badge: 'Eco-Friendly Pouch',
  },
  {
    id: 'audiences',
    title: 'Target Audience',
    kicker: 'Who We Design For',
    points: [
      'Students needing a quick stress relief tool during long study sessions or exam preparations.',
      'Office professionals and remote workers seeking desk accessories to help with focus and anxiety reduction.',
      'Children and teenagers actively participating in the current squishy toy collecting trend.',
      'Individuals with sensory processing needs who benefit from tactile stimulation.',
      'Resellers and small online sellers stocking trend items for their shop.',
    ],
    badge: 'Study & Desk',
  },
  {
    id: 'usecases',
    title: 'Use Cases',
    kicker: 'Everyday Applications',
    useCaseCards: [
      { title: 'Stress Relief', desc: 'Squeezing the toy during high-pressure moments like studying, exams, or intensive work tasks.' },
      { title: 'Focus Aid', desc: 'Keeping hands busy to improve concentration and minimize fidgeting while listening to lectures or reading.' },
      { title: 'Gifting & Events', desc: 'Serving as trendy party favors, birthday gifts, or school/corporate giveaways.' },
      { title: 'Aesthetic Decor', desc: 'Displaying the cute, trendy designs on study desks, workstations, or bedroom shelves.' },
      { title: 'Content & Collecting', desc: 'Unboxing videos, ASMR squish clips, and completing the full design set.' },
    ],
    badge: 'ASMR & Focus',
  },
  {
    id: 'pricing',
    title: 'Pricing & Packages',
    kicker: 'Accessible Wholesale & Retail',
    packages: [
      { name: 'Solo Squish', price: '₱89', qty: '1 unit', note: 'Standard entry unit in individual eco-friendly matte zip pouch.' },
      { name: 'Stress-Free Trio Bundle', price: '₱249', qty: '3 units', note: 'Save ₱18 · Curated mix of 3 bestselling designs.' },
      { name: "Collector's Box", price: '₱459', qty: 'Set of 6 distinct designs', note: 'Includes a free collectible sticker sheet and keepsake gift box.' },
      { name: 'Wholesale / Party Package', price: '₱1,400', qty: '20 units', note: 'Ideal for event giveaways, birthdays, student groups, or reselling.' },
    ],
    badge: 'Save up to ₱18+',
  },
];

export default function About() {
  const [activeTab, setActiveTab] = useState(0);
  const [activeModel, setActiveModel] = useState('dumpling');
  const [squishPulse, setSquishPulse] = useState(0);
  const [teamSqueezes, setTeamSqueezes] = useState(0);
  const [reactionMsg, setReactionMsg] = useState('');
  const [selectedMember, setSelectedMember] = useState(0);
  const timerRef = useRef(null);

  useEffect(() => {
    document.title = 'About SISO — Squishies Company & Team';
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  function triggerInteractiveSquish(who = 'SISO Team') {
    setSquishPulse((p) => p + 1);
    setTeamSqueezes((s) => s + 1);
    setReactionMsg(`Tactile cheer from ${who}! Squeezed ${teamSqueezes + 1} times.`);

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      setReactionMsg('');
    }, 2500);

    try {
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        navigator.vibrate(10);
      }
    } catch {}
  }

  const activePillar = COMPANY_PILLARS[activeTab];

  return (
    <main className="about-jelly siso-about">
      {/* ============ SISO COMPANY HERO ============ */}
      <section className="about-hero about-hero--siso">
        <div className="about-hero__blob about-hero__blob--purple" aria-hidden="true" />
        <div className="about-hero__blob about-hero__blob--pink" aria-hidden="true" />

        <div className="container container--wide">
          <div className="siso-hero-grid">
            {/* Left: Brand Identity & Mission */}
            <div className="siso-hero__info">
              <div className="siso-hero__badge-row">
                <span className="eyebrow eyebrow--pink">● ABOUT SISO COMPANY</span>
                <span className="badge badge--mint">Official Company Profile</span>
              </div>

              <h1>
                Meet <span>SISO</span>.
                <br />
                The creators behind Squishies.
              </h1>

              <p className="siso-hero__lead">
                <strong>SISO</strong> is an agile, student-led innovation team
                dedicated to crafting premium sensory stress relievers. We combine
                durable, non-toxic materials with trend-forward aesthetic designs to
                bring genuine calm, focus, and comfort to classrooms, dorms, and desks everywhere.
              </p>

              {/* Interactive Company Metric Strip */}
              <div className="siso-metrics-strip">
                <div className="siso-metric-card">
                  <span className="siso-metric-card__num">6</span>
                  <span className="siso-metric-card__lbl">SISO Builders</span>
                </div>
                <div className="siso-metric-card">
                  <span className="siso-metric-card__num">100%</span>
                  <span className="siso-metric-card__lbl">Non-Toxic TPR</span>
                </div>
                <div className="siso-metric-card">
                  <span className="siso-metric-card__num">₱89</span>
                  <span className="siso-metric-card__lbl">Accessible Starting Price</span>
                </div>
                <div className="siso-metric-card">
                  <span className="siso-metric-card__num">{teamSqueezes}</span>
                  <span className="siso-metric-card__lbl">Visitor Squeezes</span>
                </div>
              </div>

              <div className="siso-hero__actions">
                <a
                  href="mailto:siso@gmail.com"
                  className="btn btn--pink btn--lg siso-contact-btn"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <rect x="2" y="4" width="20" height="16" rx="3" stroke="#ffffff" strokeWidth="2" />
                    <path d="M22 7l-10 7L2 7" stroke="#ffffff" strokeWidth="2" strokeLinecap="round" />
                  </svg>
                  Contact SISO: siso@gmail.com
                </a>

                <Link to="/shop.html" className="btn btn--outline btn--lg">
                  Explore 20 Squishies →
                </Link>
              </div>
            </div>

            {/* Right: Interactive 3D Mascot & Logo Chamber */}
            <div className="siso-hero__stage-wrap">
              <div className="siso-mascot-card">
                <div className="siso-mascot-card__top">
                  <div className="siso-logo-badge">
                    <img
                      src="/assets/images/logo-mark.svg"
                      alt="SISO Team Logo"
                      width="34"
                      height="34"
                      className="siso-logo-img"
                    />
                    <span>SISO Team Logo</span>
                  </div>
                  <span className="siso-interactive-hint">Tap 3D to Squish</span>
                </div>

                {reactionMsg && (
                  <div className="siso-speech-bubble" role="status">
                    {reactionMsg}
                  </div>
                )}

                <div className="siso-mascot-viewer">
                  <Suspense
                    fallback={
                      <div className="siso-loading-3d">
                        Loading SISO 3D prototype…
                      </div>
                    }
                  >
                    <ProductViewer3D
                      key={activeModel}
                      url={PRODUCT_MODELS[activeModel]}
                      alt="SISO Interactive 3D Mascot"
                      compact
                      hideHint
                      scaleBoost={1.12}
                      pulseSignal={squishPulse}
                      onSquish={() => triggerInteractiveSquish('SISO Mascot')}
                    />
                  </Suspense>
                </div>

                <div className="siso-mascot-controls">
                  <div className="siso-mascot-tabs" role="tablist" aria-label="Switch 3D squishy">
                    {['dumpling', 'cheese', 'catpaw', 'toast'].map((slug) => (
                      <button
                        key={slug}
                        type="button"
                        role="tab"
                        aria-selected={activeModel === slug}
                        className={`siso-mini-pill${activeModel === slug ? ' is-active' : ''}`}
                        onClick={() => {
                          setActiveModel(slug);
                          triggerInteractiveSquish(slug);
                        }}
                      >
                        {slug}
                      </button>
                    ))}
                  </div>

                  <button
                    type="button"
                    className="btn btn--pink btn--sm siso-test-squeeze-btn"
                    onClick={() => triggerInteractiveSquish('SISO Studio')}
                  >
                    ✦ Squeeze 3D Prototype
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============ SISO TEAM ROSTER SECTION ============ */}
      <section className="siso-team-section">
        <div className="container container--wide">
          <div className="section-head text-center">
            <span className="eyebrow eyebrow--pink">● THE TALENT BEHIND THE SQUISH</span>
            <h2>Meet the SISO Organization</h2>
            <p>
              An agile project collective working together on product design, soft-body
              engineering, quality assurance, and community joy.
            </p>
          </div>

          <div className="siso-team-grid">
            {SISO_TEAM.map((member, idx) => {
              const isSelected = selectedMember === idx;
              return (
                <div
                  key={member.name}
                  className={`siso-member-card${isSelected ? ' is-active' : ''}`}
                  onClick={() => {
                    setSelectedMember(idx);
                    triggerInteractiveSquish(member.name);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      setSelectedMember(idx);
                      triggerInteractiveSquish(member.name);
                    }
                  }}
                  aria-label={`View ${member.name}'s profile`}
                >
                  <div className="siso-member-card__top">
                    <div
                      className="siso-member-avatar"
                      style={{ background: member.avatarColor }}
                    >
                      {member.initials}
                    </div>
                    <span className="siso-member-role-badge">{member.role}</span>
                  </div>

                  <h3 className="siso-member-name">{member.name}</h3>
                  <strong className="siso-member-title">{member.title}</strong>
                  <p className="siso-member-bio">{member.bio}</p>

                  <div className="siso-member-footer">
                    <span className="siso-member-tag">{member.tag}</span>
                    <span className="siso-member-action">Tap to say hi ✦</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ============ INTERACTIVE PRODUCT & COMPANY KNOWLEDGE TABS ============ */}
      <section className="siso-knowledge-section">
        <div className="container container--wide">
          <div className="section-head text-center">
            <span className="eyebrow eyebrow--pink">● OFFICIAL KNOWLEDGE BASE</span>
            <h2>Product Specs, Use Cases &amp; Wholesale</h2>
            <p>
              Click through the interactive dossier tabs to explore specifications,
              target audiences, and wholesale options.
            </p>
          </div>

          <div className="siso-knowledge-box">
            {/* Horizontal Tabs */}
            <div className="siso-tab-nav" role="tablist" aria-label="Company knowledge topics">
              {COMPANY_PILLARS.map((pillar, idx) => (
                <button
                  key={pillar.id}
                  type="button"
                  role="tab"
                  aria-selected={idx === activeTab}
                  className={`siso-tab-btn${idx === activeTab ? ' is-active' : ''}`}
                  onClick={() => setActiveTab(idx)}
                >
                  {pillar.title}
                </button>
              ))}
            </div>

            {/* Tab Body */}
            <div className="siso-tab-body">
              <div className="siso-tab-body__header">
                <div>
                  <span className="siso-tab-kicker">{activePillar.kicker}</span>
                  <h3>{activePillar.title}</h3>
                </div>
                <span className="badge badge--pink">{activePillar.badge}</span>
              </div>

              {/* Product Overview render */}
              {activePillar.id === 'overview' && (
                <div className="siso-overview-block">
                  <p className="siso-overview-text">{activePillar.summary}</p>
                  <div className="siso-highlight-callout">
                    <strong>Unique Value Proposition:</strong>
                    <p>
                      Durable, slow-rising micro-pore memory foam combined with
                      trend-forward cute aesthetics, prioritizing 100% consumer safety,
                      non-toxicity, and accessible pricing starting at ₱89.
                    </p>
                  </div>
                </div>
              )}

              {/* Bullet Points render (Key Features / Target Audience) */}
              {activePillar.points && (
                <ul className="siso-points-list">
                  {activePillar.points.map((pt, i) => (
                    <li key={i}>
                      <span className="siso-point-check" aria-hidden="true">✓</span>
                      <span>{pt}</span>
                    </li>
                  ))}
                </ul>
              )}

              {/* Specifications render */}
              {activePillar.specsList && (
                <div className="siso-specs-table">
                  {activePillar.specsList.map((spec, i) => (
                    <div key={i} className="siso-specs-row">
                      <dt className="siso-spec-label">{spec.label}</dt>
                      <dd className="siso-spec-val">{spec.val}</dd>
                    </div>
                  ))}
                </div>
              )}

              {/* Use Cases Cards render */}
              {activePillar.useCaseCards && (
                <div className="siso-usecases-grid">
                  {activePillar.useCaseCards.map((uc, i) => (
                    <div key={i} className="siso-usecase-box">
                      <div className="siso-usecase-num">0{i + 1}</div>
                      <h4>{uc.title}</h4>
                      <p>{uc.desc}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Pricing & Packages render */}
              {activePillar.packages && (
                <div className="siso-pricing-grid">
                  {activePillar.packages.map((pkg, i) => (
                    <div key={i} className="siso-pkg-card">
                      <div className="siso-pkg-card__head">
                        <h4>{pkg.name}</h4>
                        <span className="siso-pkg-qty">{pkg.qty}</span>
                      </div>
                      <div className="siso-pkg-price">{pkg.price}</div>
                      <p className="siso-pkg-note">{pkg.note}</p>
                      <Link
                        to="/shop.html"
                        className="btn btn--outline btn--sm siso-pkg-btn"
                      >
                        Order in Shop →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ============ CONTACT & SUPPORT BANNER ============ */}
      <section className="siso-support-section">
        <div className="container container--wide">
          <div className="siso-support-banner">
            <div className="siso-support-banner__left">
              <span className="eyebrow eyebrow--pink">● INQUIRIES &amp; ORDERS</span>
              <h2>Ready to collaborate with SISO?</h2>
              <p>
                Whether you need bulk event giveaways, custom school packages,
                or have customer support questions, our team is here for you.
              </p>
              <div className="siso-contact-chip">
                <span>Official Support Email:</span>
                <a href="mailto:siso@gmail.com">siso@gmail.com</a>
              </div>
            </div>

            <div className="siso-support-banner__right">
              <div className="siso-support-card">
                <strong>Project Lead: Goyena, Shawn Kieffer E.</strong>
                <p>Scrum Master: Navarro, Sofia Alexi P.</p>
                <a
                  href="mailto:siso@gmail.com"
                  className="btn btn--pink btn--lg siso-banner-email-btn"
                >
                  Send SISO an Email →
                </a>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
