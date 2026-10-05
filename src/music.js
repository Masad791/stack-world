// A gentle 3/4 waltz synthesized live with Web Audio: soft pad chords, a warm bass and a
// music-box melody, through a generated reverb. No audio files.
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// IV - V - iii - vi in C major, one bar each.
const CHORDS = [
  [53, 57, 60, 64], // Fmaj7
  [55, 59, 62, 64], // G6
  [52, 55, 59, 62], // Em7
  [57, 60, 64, 71], // Am(add9)
];
// Two four-bar phrases as [beat within the phrase, note, length in beats].
const PHRASES = [
  [[0, 69, 1], [1, 72, 1], [2, 77, 1], [3, 74, 1], [4, 76, 1], [5, 79, 1], [6, 71, 1], [7, 76, 1], [8, 79, 1], [9, 81, 2.5], [11, 76, 1]],
  [[0, 77, 1], [1, 76, 1], [2, 72, 1], [3, 74, 1.5], [4.5, 67, 0.5], [5, 71, 1], [6, 79, 1.5], [7.5, 76, 1.5], [9, 76, 1], [10, 74, 1], [11, 72, 1]],
];
const BEAT = 60 / 84; // 84 bpm

export function createMusic(getAudio) {
  let ac;
  let out;
  let reverb;
  let timer = null;
  let nextBar = 0;
  let bar = 0;
  let volume = 0;
  let wanted = 0;

  function init() {
    ac = getAudio();
    out = ac.createGain();
    out.gain.value = 0;
    // Reverb: a few seconds of decaying stereo noise as the impulse response.
    reverb = ac.createConvolver();
    const len = ac.sampleRate * 3;
    const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3;
    }
    reverb.buffer = ir;
    const wet = ac.createGain();
    wet.gain.value = 0.55;
    out.connect(ac.destination);
    out.connect(reverb).connect(wet).connect(ac.destination);
  }

  function voice(freq, start, dur, { type = 'sine', gain = 0.1, attack = 0.01, filter = 0 } = {}) {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(0, start);
    g.gain.linearRampToValueAtTime(gain, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0008, start + dur);
    let node = o.connect(g);
    if (filter) {
      const f = ac.createBiquadFilter();
      f.type = 'lowpass';
      f.frequency.value = filter;
      node = node.connect(f);
    }
    node.connect(out);
    o.start(start);
    o.stop(start + dur + 0.05);
  }

  // Music-box tone: a sine plus a quiet octave, quick attack, long ring.
  const bell = (note, start, beats) => {
    voice(midi(note), start, beats * BEAT + 1.4, { gain: 0.07 });
    voice(midi(note + 12), start, beats * BEAT + 0.6, { gain: 0.018 });
  };

  function scheduleBar(start) {
    const chord = CHORDS[bar % 4];
    chord.forEach((n) => voice(midi(n), start, 3 * BEAT + 1.2, { type: 'triangle', gain: 0.025, attack: 0.7, filter: 900 }));
    voice(midi(chord[0] - 12), start, 2 * BEAT, { gain: 0.06, attack: 0.02 });
    voice(midi(chord[2] - 12), start + BEAT, BEAT, { gain: 0.035 });
    voice(midi(chord[2] - 12), start + 2 * BEAT, BEAT, { gain: 0.035 });
    const phrase = PHRASES[Math.floor(bar / 4) % 2];
    const from = (bar % 4) * 3;
    phrase.filter(([b]) => b >= from && b < from + 3).forEach(([b, note, len]) => bell(note, start + (b - from) * BEAT, len));
    // An occasional sparkle an octave up keeps the loop from feeling mechanical.
    if (Math.random() < 0.35) bell(chord[1 + Math.floor(Math.random() * 3)] + 24, start + 2.5 * BEAT, 0.5);
    bar += 1;
  }

  function loop() {
    // Look a little ahead and schedule whole bars on the audio clock.
    while (nextBar < ac.currentTime + 0.4) {
      scheduleBar(nextBar);
      nextBar += 3 * BEAT;
    }
  }

  return {
    // 0 = silent, 1 = full. Fades smoothly; the scheduler only runs while audible.
    setVolume(v) {
      wanted = v;
    },
    update(dt) {
      if (wanted > 0 && !ac) init();
      if (!ac) return;
      volume += (wanted - volume) * Math.min(1, dt * 1.5);
      out.gain.value = volume * 0.9;
      if (volume > 0.01 && !timer) {
        nextBar = ac.currentTime + 0.1;
        timer = setInterval(loop, 100);
      } else if (volume <= 0.01 && wanted === 0 && timer) {
        clearInterval(timer);
        timer = null;
      }
    },
    get level() {
      return volume;
    },
  };
}
