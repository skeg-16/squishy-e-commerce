// Adaptive device & network performance profile for mobile phones and low-end devices

let cachedProfile = null;

export function getPerfProfile() {
  if (cachedProfile && typeof window !== 'undefined') {
    return cachedProfile;
  }

  if (typeof window === 'undefined') {
    return {
      isLowEnd: false,
      isMobile: false,
      prefersReducedMotion: false,
      saveData: false,
      maxDpr: 1.5,
      heroSegments: [56, 42],
      heroTexSize: 512,
      textureFps: 20,
      enableEnvMap: true,
    };
  }

  const cores = Number(navigator.hardwareConcurrency || 4);
  const memory = Number(navigator.deviceMemory || 4);
  const connection = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  const saveData = Boolean(connection?.saveData);
  const slowNet =
    connection?.effectiveType === 'slow-2g' ||
    connection?.effectiveType === '2g' ||
    connection?.effectiveType === '3g';

  const isMobile =
    window.matchMedia?.('(max-width: 860px)').matches ||
    window.matchMedia?.('(pointer: coarse)').matches ||
    /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent || '');

  const prefersReducedMotion = Boolean(
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  );

  const isLowEnd =
    prefersReducedMotion ||
    saveData ||
    slowNet ||
    cores <= 4 ||
    memory <= 4 ||
    isMobile;

  cachedProfile = {
    isLowEnd,
    isMobile,
    prefersReducedMotion,
    saveData,
    maxDpr: isLowEnd ? 1.15 : 1.75,
    heroSegments: isLowEnd ? [40, 30] : [64, 48],
    heroTexSize: isLowEnd ? 384 : 512,
    textureFps: isLowEnd ? 15 : 24,
    enableEnvMap: !isLowEnd,
  };

  return cachedProfile;
}

export function resetPerfProfileCache() {
  cachedProfile = null;
}

