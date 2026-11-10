
import { useEffect, useRef } from 'react';

export default function SparkleTrail() {
  const trailRef = useRef(null);

  useEffect(() => {
    const trail = trailRef.current;
    if (!trail) return;

    let lastX = 0;
    let lastY = 0;
    let hasLastPosition = false;

    function handlePointerMove(event) {
      // Only create sparkles for a mouse or pen.
      if (event.pointerType === 'touch') return;

      const { clientX, clientY } = event;

      // Keep the trail from becoming too dense.
      if (hasLastPosition) {
        const distance = Math.hypot(
          clientX - lastX,
          clientY - lastY
        );

        if (distance < 18) return;
      }

      lastX = clientX;
      lastY = clientY;
      hasLastPosition = true;

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
        () => sparkle.remove(),
        { once: true }
      );
    }

    window.addEventListener('pointermove', handlePointerMove);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
    };
  }, []);

  return <div className="sparkle-trail" ref={trailRef} aria-hidden="true" />;
}
