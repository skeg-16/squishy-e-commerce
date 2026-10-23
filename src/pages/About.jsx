import { useEffect } from 'react';

export default function About() {
  useEffect(() => {
    document.title = 'About — Squishies';
  }, []);

  return (
    <main>
      {/* ABOUT HERO */}
      <section className="about-hero">
        <div
          className="about-hero__blob about-hero__blob--purple"
          aria-hidden="true"
        />
        <div
          className="about-hero__blob about-hero__blob--pink"
          aria-hidden="true"
        />

        <span className="about-hero__tag-float">
          Premium TPR
          <br />
          <strong>Memory Foam</strong>
        </span>

        <span className="about-hero__pill-float badge badge--mint">
          Non-toxic · BPA-free
        </span>

        <div className="container">
          <div className="about-hero__content">
            <span className="eyebrow eyebrow--pink">
              ● ABOUT SQUISHIES
            </span>
            <h1>More than just cute.</h1>
            <p>
              Squishies creates cute, premium sensory products designed
              to bring comfort, fun, and satisfying moments to everyday
              life. Our ultra-soft, slow-rising Squishies are made for
              squeezing, collecting, and enjoying wherever life takes you.
            </p>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="about-features">
        <div className="container">
          <div className="feature-grid">
            <div className="feature-item">
              <span className="feature-item__icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    cx="12"
                    cy="12"
                    r="8"
                    stroke="#FF6B95"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M12 8v4l3 2"
                    stroke="#FF6B95"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                  />
                </svg>
              </span>
              <h3>Ultra-soft &amp; slow-rising</h3>
              <p>
                A deeply satisfying tactile rebound with every squeeze.
              </p>
            </div>

            <div className="feature-item">
              <span className="feature-item__icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 3l7 3v6c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V6l7-3Z"
                    stroke="#FF6B95"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <h3>Non-toxic materials</h3>
              <p>
                BPA-free, hypoallergenic, and safe for ages 3 and up.
              </p>
            </div>

            <div className="feature-item">
              <span className="feature-item__icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 21s-7-4.5-7-10a5 5 0 0 1 9-3 5 5 0 0 1 9 3c0 5.5-7 10-7 10-1.5 0-3 0-4 0Z"
                    stroke="#FF6B95"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <h3>Durable by design</h3>
              <p>
                Built to handle everyday squeezing without losing shape.
              </p>
            </div>

            <div className="feature-item">
              <span className="feature-item__icon">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M12 3s6 6.5 6 11a6 6 0 0 1-12 0c0-4.5 6-11 6-11Z"
                    stroke="#FF6B95"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              <h3>Easy to clean</h3>
              <p>
                Water-resistant surface — a quick wipe is all it needs.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* USE CASES */}
      <section className="usecases">
        <div className="container">
          <div className="usecases__head">
            <div>
              <span className="usecases__eyebrow">Use Cases</span>
              <h2>A Squish for Every Moment.</h2>
            </div>
            <span className="usecases__badge">Ages 3+</span>
          </div>

          <div className="usecase-list">
            <div className="usecase-item">
              <span className="usecase-item__icon">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="3"
                    y="4"
                    width="18"
                    height="16"
                    rx="2"
                    stroke="#9B6DF0"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M3 9h18"
                    stroke="#9B6DF0"
                    strokeWidth="1.8"
                  />
                </svg>
              </span>
              <div>
                <h3>Study &amp; Focus</h3>
                <p>
                  A satisfying companion for study sessions and moments
                  when you need to keep your hands busy.
                </p>
              </div>
            </div>

            <div className="usecase-item">
              <span className="usecase-item__icon">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="2"
                    y="5"
                    width="20"
                    height="14"
                    rx="2"
                    stroke="#9B6DF0"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M2 9h20"
                    stroke="#9B6DF0"
                    strokeWidth="1.8"
                  />
                </svg>
              </span>
              <div>
                <h3>Work &amp; Desk Time</h3>
                <p>
                  A small desk companion for everyday breaks and quieter
                  work moments.
                </p>
              </div>
            </div>

            <div className="usecase-item">
              <span className="usecase-item__icon">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <rect
                    x="3"
                    y="8"
                    width="18"
                    height="13"
                    rx="2"
                    stroke="#9B6DF0"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M3 12h18M12 8v13"
                    stroke="#9B6DF0"
                    strokeWidth="1.8"
                  />
                  <path
                    d="M12 8c-2 0-3.5-1-3.5-2.5S9.5 3 11 3c1.2 0 1 2 1 5Zm0 0c2 0 3.5-1 3.5-2.5S13.5 3 12 3c-1.2 0-1 2-1 5Z"
                    stroke="#9B6DF0"
                    strokeWidth="1.8"
                  />
                </svg>
              </span>
              <div>
                <h3>Gifts &amp; Events</h3>
                <p>
                  Cute and collectible products that make thoughtful,
                  crowd-pleasing gifts.
                </p>
              </div>
            </div>

            <div className="usecase-item">
              <span className="usecase-item__icon">
                <svg
                  width="18"
                  height="18"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <path
                    d="M4 10l8-6 8 6v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-9Z"
                    stroke="#9B6DF0"
                    strokeWidth="1.8"
                    strokeLinejoin="round"
                  />
                  <path
                    d="M9 20v-6h6v6"
                    stroke="#9B6DF0"
                    strokeWidth="1.8"
                  />
                </svg>
              </span>
              <div>
                <h3>Collect &amp; Display</h3>
                <p>
                  Designed to be enjoyed, collected, and proudly displayed
                  on any shelf.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
