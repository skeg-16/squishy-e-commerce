
import { useEffect, useRef } from 'react';
import { getPerfProfile } from '../utils/devicePerf';

export default function SparkleTrail() {
  const trailRef = useRef(null);

  useEffect(() => {
    const trail = trailRef.current;
    if (!trail) return undefined;

    const perf = getPerfProfile();
    if (perf.isMobile || perf.isLowEnd || perf.prefersReducedMotion) {
      return undefined;
    }

    let lastX = 0;
    let lastY = 0;
    let hasLastPosition = false;
    let activeCount = 0;

    function handlePointerMove(event) {
      // Only create sparkles for a mouse or pen.
      if (event.pointerType === 'touch') return;
      if (activeCount >= 12) return;

      const { clientX, clientY } = event;

      // Keep the trail from becoming too dense.
      if (hasLastPosition) {
        const distance = Math.hypot(
          clientX - lastX,
          clientY - lastY
        );

        if (distance < 24) return;
      }

      lastX = clientX;
      lastY = clientY;
      hasLastPosition = true;
      activeCount += 1;

      const sparkle = document.createElement('span');
      sparkle.className = 'cursor-sparkle';
      sparkle.textContent = '✦';

      sparkle.style.left = `${clientX}px`;
      sparkle.style.top = `${clientY}px`;
      sparkle.style.setProperty(
        '--sparkle-drift',
        `${(Math.random() - 0.5) * 36}px`
      );
      sparkle.style.setProperty(
        '--sparkle-rotation',
        `${Math.random() * 90 - 45}deg`
      );
      sparkle.style.setProperty(
        '--sparkle-size',
        `${12 + Math.random() * 12}px`
      );

      trail.appendChild(sparkle);

      sparkle.addEventListener(
        'animationend',
        () => {
          activeCount = Math.max(0, activeCount - 1);
          sparkle.remove();
        },
        { once: true }
      );
    }

    window.addEventListener('pointermove', handlePointerMove, { passive: true });

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, []);

  return <div className="sparkle-trail" ref={trailRef} aria-hidden="true" />;
}
