import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * SquishyPageLoader
 * A genuine route transition & lazy suspense loading screen
 * featuring an animated slow-rising squishy mascot.
 */
export default function SquishyPageLoader({ isSuspense = false }) {
  const location = useLocation();
  const [loading, setLoading] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    // If used as standard suspense fallback, keep active
    if (isSuspense) return;

    // Trigger authentic route transition animation on URL change
    setLoading(true);
    setFading(false);

    // Natural responsive window allowing browser paint and model mounts
    const mountTimer = setTimeout(() => {
      setFading(true);
      const doneTimer = setTimeout(() => {
        setLoading(false);
        setFading(false);
      }, 260); // match fadeOut duration
      return () => clearTimeout(doneTimer);
    }, 420);

    return () => clearTimeout(mountTimer);
  }, [location.pathname, isSuspense]);

  if (!isSuspense && !loading) {
    return null;
  }

  return (
    <div
      className={`squishy-loader-backdrop${fading ? ' is-fading-out' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Loading page..."
    >
      <div className="squishy-loader-content">
        {/* Animated Kawaii Squishy Mascot */}
        <div className="squishy-mascot-rig">
          <svg
            className="squishy-mascot-svg"
            viewBox="0 0 160 140"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <defs>
              <linearGradient id="squishBodyGrad" x1="20" y1="20" x2="140" y2="130" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ffc0dc" />
                <stop offset="0.5" stopColor="#ffa6cd" />
                <stop offset="1" stopColor="#f484b7" />
              </linearGradient>
              <linearGradient id="squishShineGrad" x1="45" y1="30" x2="80" y2="70" gradientUnits="userSpaceOnUse">
                <stop stopColor="#ffffff" stopOpacity="0.8" />
                <stop offset="1" stopColor="#ffffff" stopOpacity="0" />
              </linearGradient>
              <filter id="softGlow" x="0" y="0" width="160" height="140" filterUnits="userSpaceOnUse">
                <feDropShadow dx="0" dy="6" stdDeviation="8" floodColor="#ff7bac" floodOpacity="0.35" />
              </filter>
            </defs>

            {/* Pleated Top Knot */}
            <path
              d="M74 38C70 26 80 18 80 18C80 18 90 26 86 38"
              fill="#ffa6cd"
              stroke="#f484b7"
              strokeWidth="3"
              strokeLinecap="round"
            />
            <circle cx="70" cy="24" r="7" fill="#ffb4d6" />
            <circle cx="80" cy="18" r="8" fill="#ffa6cd" />
            <circle cx="90" cy="24" r="7" fill="#ffb4d6" />

            {/* Main Dumpling Soft Body */}
            <ellipse
              cx="80"
              cy="80"
              rx="58"
              ry="48"
              fill="url(#squishBodyGrad)"
              filter="url(#softGlow)"
            />

            {/* Soft highlight glare */}
            <ellipse
              cx="54"
              cy="58"
              rx="16"
              ry="10"
              transform="rotate(-25 54 58)"
              fill="url(#squishShineGrad)"
            />

            {/* Kawaii Eyes */}
            <circle cx="62" cy="78" r="5" fill="#381b3d" />
            <circle cx="60.5" cy="76" r="2" fill="#ffffff" />
            <circle cx="98" cy="78" r="5" fill="#381b3d" />
            <circle cx="96.5" cy="76" r="2" fill="#ffffff" />

            {/* Rosy Blush Cheeks */}
            <ellipse cx="50" cy="86" rx="8" ry="5" fill="#ff4d94" fillOpacity="0.55" />
            <ellipse cx="110" cy="86" rx="8" ry="5" fill="#ff4d94" fillOpacity="0.55" />

            {/* Smiling Mouth */}
            <path
              d="M74 88C77 93 83 93 86 88"
              stroke="#381b3d"
              strokeWidth="3.2"
              strokeLinecap="round"
            />

            {/* Small forehead heart mark */}
            <path
              d="M80 57C79 55 76 54 74.5 56C73 58 75 61 80 64C85 61 87 58 85.5 56C84 54 81 55 80 57Z"
              fill="#ffffff"
              fillOpacity="0.85"
            />
          </svg>

          {/* Dynamic pneumatic floor shadow */}
          <div className="squishy-mascot-shadow" aria-hidden="true" />
        </div>

        {/* Status text with subtle bounce */}
        <div className="squishy-loader-text-group">
          <span className="squishy-loader-title">Slow-rising into place…</span>
          <span className="squishy-loader-sub">Preparing soft-body experience</span>
        </div>
      </div>
    </div>
  );
}

