// Shared plush squeak synthesizer + cached hero character voice player

let sharedAudioCtx = null;
let activeVoiceSource = null;
let lastSpokenLine = '';
const voiceBufferCache = new Map();

function getAudioCtx() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedAudioCtx) sharedAudioCtx = new AudioContextClass();
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {});
  }
  return sharedAudioCtx;
}

export function playPlushSqueak(isRelease = false) {
  try {
    const ctx = getAudioCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = 'triangle';
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(isRelease ? 1150 : 1350, now);
    filter.Q.setValueAtTime(4.5, now);

    if (!isRelease) {
      osc.frequency.setValueAtTime(680, now);
      osc.frequency.exponentialRampToValueAtTime(1180, now + 0.055);
      osc.frequency.exponentialRampToValueAtTime(890, now + 0.11);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.085, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.13);
    } else {
      osc.frequency.setValueAtTime(920, now);
      osc.frequency.exponentialRampToValueAtTime(620, now + 0.08);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.exponentialRampToValueAtTime(0.045, now + 0.018);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);
      osc.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.095);
    }
  } catch {
    // Ignore audio errors if audio context is blocked before gesture
  }
}

export function pickCharacterLine(charObj, customIdx) {
  const lines = charObj?.lines;
  if (!lines || lines.length === 0) {
    return { idx: 0, phrase: 'Squish me~!' };
  }
  let idx =
    typeof customIdx === 'number'
      ? Math.max(0, Math.min(lines.length - 1, customIdx))
      : Math.floor(Math.random() * lines.length);
  if (lines[idx] === lastSpokenLine && lines.length > 1) {
    idx = (idx + 1) % lines.length;
  }
  const phrase = lines[idx];
  lastSpokenLine = phrase;
  return { idx, phrase };
}

export async function playCharacterVoiceClip(charObj, lineIdx) {
  try {
    const ctx = getAudioCtx();
    if (!ctx || !charObj?.slug) return;

    const clipUrl = `/assets/voices/${charObj.slug}-${lineIdx}.mp3?v=3`;
    let audioBuffer = voiceBufferCache.get(clipUrl);
    if (!audioBuffer) {
      const res = await fetch(clipUrl);
      if (!res.ok) return;
      const arrayBuf = await res.arrayBuffer();
      audioBuffer = await ctx.decodeAudioData(arrayBuf);
      voiceBufferCache.set(clipUrl, audioBuffer);
    }

    if (activeVoiceSource) {
      try {
        activeVoiceSource.stop();
      } catch {
        // already stopped
      }
    }

    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.playbackRate.value = 1.0;

    const warmFilter = ctx.createBiquadFilter();
    warmFilter.type = 'lowpass';
    warmFilter.frequency.value = 7500;

    const voiceGain = ctx.createGain();
    voiceGain.gain.value = 0.95;

    source.connect(warmFilter);
    warmFilter.connect(voiceGain);
    voiceGain.connect(ctx.destination);

    activeVoiceSource = source;
    source.start(ctx.currentTime + 0.03);
  } catch {
    // Ignore playback errors if audio is not unlocked
  }
}

