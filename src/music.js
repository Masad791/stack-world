// Live-synthesized music (Web Audio, no audio files): a few original melodic pieces played on
// home-made instruments (piano, flute, string pad, music-box bell) through a generated reverb.
const midi = (n) => 440 * 2 ** ((n - 69) / 12);

// Each song: tempo, beats per bar, one chord per bar (MIDI notes), and a melody across all bars as
// [beat, note, length in beats]. `lead` picks the melody instrument, `feel` the accompaniment.
const SONGS = {
  // The Music Grove's waltz in C: oom-pah-pah piano, music-box melody.
  waltz: {
    bpm: 84,
    beats: 3,
    feel: 'waltz',
    lead: 'piano',
    chords: [[53, 57, 60, 64], [55, 59, 62, 64], [52, 55, 59, 62], [57, 60, 64, 71], [53, 57, 60, 64], [55, 59, 62, 64], [52, 55, 59, 62], [57, 60, 64, 71]],
    melody: [
      [0, 69, 1], [1, 72, 1], [2, 77, 1], [3, 74, 1], [4, 76, 1], [5, 79, 1], [6, 71, 1], [7, 76, 1], [8, 79, 1], [9, 81, 2.5], [11, 76, 1],
      [12, 77, 1], [13, 76, 1], [14, 72, 1], [15, 74, 1.5], [16.5, 67, 0.5], [17, 71, 1], [18, 79, 1.5], [19.5, 76, 1.5], [21, 76, 1], [22, 74, 1], [23, 72, 1],
    ],
  },
  // Sunset theme in D major: a flute singing over rolling piano arpeggios and strings.
  sunset: {
    bpm: 72,
    beats: 4,
    feel: 'arpeggio',
    lead: 'flute',
    chords: [[50, 62, 66, 69, 73], [47, 59, 62, 66, 69], [43, 55, 59, 62, 66], [45, 57, 61, 64, 69], [50, 62, 66, 69, 73], [47, 59, 62, 66, 69], [43, 55, 59, 62, 66], [45, 57, 61, 64, 67]],
    melody: [
      [0, 78, 1.5], [1.5, 76, 0.5], [2, 74, 1], [3, 69, 1],
      [4, 71, 1.5], [5.5, 73, 0.5], [6, 74, 1], [7, 78, 1],
      [8, 76, 2], [10, 74, 1], [11, 71, 1],
      [12, 73, 3], [15, 69, 1],
      [16, 78, 1], [17, 81, 1.5], [18.5, 79, 0.5], [19, 78, 1],
      [20, 76, 1.5], [21.5, 74, 0.5], [22, 76, 1], [23, 78, 1],
      [24, 79, 1], [25, 78, 1], [26, 76, 1], [27, 74, 1],
      [28, 76, 2], [30, 74, 2],
    ],
  },
  // Night nocturne in A minor: soft piano, a slow melody and the odd starry bell.
  nocturne: {
    bpm: 62,
    beats: 4,
    feel: 'nocturne',
    lead: 'piano',
    chords: [[45, 57, 60, 64, 71], [41, 53, 57, 60, 64], [43, 55, 60, 64, 67], [40, 52, 56, 59, 62], [45, 57, 60, 64, 71], [41, 53, 57, 60, 64], [38, 50, 57, 60, 65], [40, 52, 56, 59, 64]],
    melody: [
      [0, 76, 1.5], [1.5, 74, 0.5], [2, 72, 1], [3, 71, 1],
      [4, 72, 3], [7, 69, 1],
      [8, 67, 1], [9, 72, 1], [10, 76, 1.5], [11.5, 74, 0.5],
      [12, 74, 2], [14, 71, 1], [15, 68, 1],
      [16, 69, 1], [17, 72, 1], [18, 76, 1], [19, 81, 1],
      [20, 79, 1.5], [21.5, 77, 0.5], [22, 76, 2],
      [24, 74, 1], [25, 77, 1], [26, 76, 1], [27, 72, 1],
      [28, 71, 2], [30, 68, 1], [31, 71, 1],
    ],
  },
  // Home island by day: a light G-major tune, flute over gentle piano arpeggios.
  meadow: {
    bpm: 92,
    beats: 4,
    feel: 'arpeggio',
    lead: 'flute',
    chords: [[43, 55, 59, 62, 67], [40, 52, 55, 59, 64], [36, 48, 52, 55, 60], [38, 50, 54, 57, 62], [43, 55, 59, 62, 67], [47, 59, 62, 66, 69], [36, 48, 52, 55, 64], [38, 50, 54, 57, 60]],
    melody: [
      [0, 74, 1], [1, 71, 0.5], [1.5, 74, 0.5], [2, 79, 1.5], [3.5, 78, 0.5],
      [4, 76, 1], [5, 74, 1], [6, 71, 2],
      [8, 72, 1], [9, 76, 1], [10, 79, 1], [11, 76, 1],
      [12, 74, 3], [15, 72, 1],
      [16, 71, 1], [17, 74, 0.5], [17.5, 79, 0.5], [18, 83, 1.5], [19.5, 81, 0.5],
      [20, 79, 1], [21, 78, 1], [22, 74, 2],
      [24, 76, 1], [25, 79, 1], [26, 76, 1], [27, 72, 1],
      [28, 74, 2], [30, 78, 1], [31, 74, 1],
    ],
  },
  // Roman Forum: D Dorian on a plucked lyre, with a frame drum keeping a slow processional beat.
  forum: {
    bpm: 76,
    beats: 4,
    feel: 'lyre',
    lead: 'lyre',
    chords: [[38, 50, 57, 62, 65], [36, 48, 55, 60, 64], [38, 50, 57, 62, 65], [33, 45, 52, 57, 60], [34, 46, 53, 58, 62], [36, 48, 55, 60, 64], [33, 45, 52, 57, 64], [38, 50, 57, 62, 65]],
    melody: [
      [0, 69, 1], [1, 67, 0.5], [1.5, 65, 0.5], [2, 67, 1], [3, 69, 1],
      [4, 72, 1.5], [5.5, 71, 0.5], [6, 69, 2],
      [8, 74, 1], [9, 72, 1], [10, 71, 1], [11, 69, 1],
      [12, 67, 1.5], [13.5, 69, 0.5], [14, 64, 2],
      [16, 62, 1], [17, 65, 1], [18, 69, 1], [19, 74, 1],
      [20, 72, 1], [21, 71, 0.5], [21.5, 72, 0.5], [22, 67, 2],
      [24, 69, 1], [25, 71, 1], [26, 72, 1], [27, 74, 1],
      [28, 69, 3], [31, 62, 1],
    ],
  },
  // Karakoram: a bansuri-style flute in a pentatonic raag (Bhupali in D) over a tanpura drone.
  karakoram: {
    bpm: 56,
    beats: 4,
    feel: 'drone',
    lead: 'bansuri',
    chords: Array.from({ length: 8 }, () => [38, 45, 50, 57, 62]),
    melody: [
      [0, 74, 2], [2, 71, 1], [3, 69, 1],
      [4, 71, 3], [7, 69, 1],
      [8, 66, 1.5], [9.5, 69, 0.5], [10, 71, 1], [11, 74, 1],
      [12, 76, 3], [15, 74, 1],
      [16, 78, 2], [18, 76, 1], [19, 74, 1],
      [20, 71, 2], [22, 69, 1], [23, 66, 1],
      [24, 64, 1.5], [25.5, 66, 0.5], [26, 69, 2],
      [28, 62, 4],
    ],
  },
  // Coral Coast: a calypso in F, steel drum melody over marimba off-beats and a shaker.
  lagoon: {
    bpm: 104,
    beats: 4,
    feel: 'calypso',
    lead: 'steel',
    chords: [[41, 57, 60, 65, 69], [46, 58, 62, 65, 70], [48, 55, 60, 64, 67], [41, 57, 60, 65, 69], [38, 57, 62, 65, 69], [43, 55, 58, 62, 67], [48, 55, 60, 64, 70], [41, 57, 60, 65, 69]],
    melody: [
      [0, 72, 0.5], [0.5, 74, 0.5], [1, 77, 1], [2.5, 76, 0.5], [3, 74, 1],
      [4, 74, 0.5], [4.5, 77, 0.5], [5, 82, 1], [6.5, 81, 0.5], [7, 77, 1],
      [8, 79, 1], [9, 76, 0.5], [9.5, 72, 1], [11, 76, 1],
      [12, 77, 2], [14.5, 72, 0.5], [15, 74, 1],
      [16, 77, 0.5], [16.5, 76, 0.5], [17, 74, 1], [18.5, 72, 0.5], [19, 69, 1],
      [20, 70, 0.5], [20.5, 72, 0.5], [21, 74, 1], [22.5, 79, 0.5], [23, 77, 1],
      [24, 76, 1], [25, 74, 0.5], [25.5, 72, 1], [27, 70, 1],
      [28, 72, 0.5], [28.5, 76, 0.5], [29, 77, 2], [31, 72, 1],
    ],
  },
};
export const SONG_NAMES = { waltz: 'Grove Waltz', sunset: 'Sunset Theme', nocturne: 'Nocturne', meadow: 'Meadow Song', forum: 'Forum Lyre', karakoram: 'Karakoram Dawn', lagoon: 'Lagoon Calypso' };

export function createMusic(getAudio) {
  let ac;
  let out;
  let timer = null;
  let nextBar = 0;
  let bar = 0;
  let loops = 0;
  let volume = 0;
  let wanted = 0;
  let request = 'auto'; // a song name, or 'auto' for the playlist
  let playing = 'waltz';
  let night = false;

  function init() {
    ac = getAudio();
    out = ac.createGain();
    out.gain.value = 0;
    const reverb = ac.createConvolver();
    const len = ac.sampleRate * 3.2;
    const ir = ac.createBuffer(2, len, ac.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len) ** 3.2;
    }
    reverb.buffer = ir;
    const wet = ac.createGain();
    wet.gain.value = 0.5;
    out.connect(ac.destination);
    out.connect(reverb).connect(wet).connect(ac.destination);
  }

  const env = (g, start, peak, attack, end) => {
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(peak, start + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
  };
  const osc = (type, freq, start, stop, dest, detune = 0) => {
    const o = ac.createOscillator();
    o.type = type;
    o.frequency.value = freq;
    o.detune.value = detune;
    o.connect(dest);
    o.start(start);
    o.stop(stop);
    return o;
  };

  // Piano: a few partials, slightly detuned pair for warmth, a filter that closes as the note decays.
  function piano(note, start, beats, vel = 1) {
    const f = midi(note);
    const decay = Math.min(4.5, Math.max(1.4, 3.8 - (note - 60) * 0.06)) + beats * 0.2;
    const g = ac.createGain();
    env(g, start, 0.075 * vel, 0.004, start + decay);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 7, start);
    lp.frequency.exponentialRampToValueAtTime(f * 1.8, start + decay * 0.6);
    lp.connect(g).connect(out);
    osc('triangle', f, start, start + decay, lp, -2);
    osc('sine', f, start, start + decay, lp, 2);
    const h = ac.createGain();
    h.gain.value = 0.35;
    h.connect(lp);
    osc('sine', f * 2, start, start + decay * 0.6, h);
    const h3 = ac.createGain();
    h3.gain.value = 0.12;
    h3.connect(lp);
    osc('sine', f * 3, start, start + decay * 0.35, h3);
  }

  // Flute: breathy sine with a gentle vibrato that blooms after the attack.
  function flute(note, start, beats, beat) {
    const f = midi(note);
    const end = start + beats * beat + 0.25;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(0.06, start + 0.08);
    g.gain.setValueAtTime(0.055, end - 0.2);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    g.connect(out);
    const o = osc('sine', f, start, end + 0.05, g);
    const o2g = ac.createGain();
    o2g.gain.value = 0.12;
    o2g.connect(g);
    const o2 = osc('triangle', f * 2, start, end + 0.05, o2g);
    const lfo = ac.createOscillator();
    lfo.frequency.value = 5.2;
    const depth = ac.createGain();
    depth.gain.setValueAtTime(0, start);
    depth.gain.linearRampToValueAtTime(f * 0.007, start + 0.35);
    lfo.connect(depth);
    depth.connect(o.frequency);
    depth.connect(o2.frequency);
    lfo.start(start);
    lfo.stop(end + 0.05);
    // A puff of breath at the start of each note.
    const n = ac.createBufferSource();
    n.buffer = breath();
    const bp = ac.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = f * 2;
    bp.Q.value = 2;
    const ng = ac.createGain();
    env(ng, start, 0.02, 0.02, start + 0.25);
    n.connect(bp).connect(ng).connect(out);
    n.start(start);
    n.stop(start + 0.3);
  }
  let breathBuf = null;
  const breath = () => {
    if (!breathBuf) {
      breathBuf = ac.createBuffer(1, ac.sampleRate * 0.4, ac.sampleRate);
      const d = breathBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return breathBuf;
  };

  // String pad: detuned saws, softly filtered, slow swell.
  function pad(notes, start, dur) {
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(0.012, start + dur * 0.35);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur + 1.2);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1100;
    lp.connect(g).connect(out);
    notes.forEach((n) => {
      osc('sawtooth', midi(n), start, start + dur + 1.3, lp, -7);
      osc('sawtooth', midi(n), start, start + dur + 1.3, lp, 7);
    });
  }

  // Music-box bell for sparkles.
  function bell(note, start, vel = 1) {
    const g = ac.createGain();
    env(g, start, 0.045 * vel, 0.003, start + 2.2);
    g.connect(out);
    osc('sine', midi(note), start, start + 2.3, g);
    const g2 = ac.createGain();
    env(g2, start, 0.012 * vel, 0.003, start + 0.8);
    g2.connect(out);
    osc('sine', midi(note) * 2.76, start, start + 0.9, g2); // inharmonic shimmer
  }

  // Lyre: a bright pluck that dies away quickly, its filter closing like a gut string.
  function lyre(note, start, vel = 1) {
    const f = midi(note);
    const g = ac.createGain();
    env(g, start, 0.07 * vel, 0.002, start + 1.6);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(f * 9, start);
    lp.frequency.exponentialRampToValueAtTime(f * 1.5, start + 0.6);
    lp.connect(g).connect(out);
    osc('triangle', f, start, start + 1.7, lp);
    osc('sawtooth', f, start, start + 0.5, lp, 4);
  }
  // Tanpura: long buzzing drone plucks.
  function tanpura(note, start, dur) {
    const f = midi(note);
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, start);
    g.gain.linearRampToValueAtTime(0.022, start + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    const lp = ac.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = f * 6;
    lp.Q.value = 3; // the "jivari" buzz
    lp.connect(g).connect(out);
    osc('sawtooth', f, start, start + dur, lp, -3);
    osc('sawtooth', f, start, start + dur, lp, 3);
  }
  // Marimba: a woody sine with a short fourth-partial knock.
  function marimba(note, start, vel = 1) {
    const f = midi(note);
    const g = ac.createGain();
    env(g, start, 0.06 * vel, 0.002, start + 0.7);
    g.connect(out);
    osc('sine', f, start, start + 0.75, g);
    const k = ac.createGain();
    env(k, start, 0.025 * vel, 0.001, start + 0.08);
    k.connect(out);
    osc('sine', f * 4, start, start + 0.1, k);
  }
  // Steel drum: a sine with metallic, slightly inharmonic overtones.
  function steel(note, start, beats, beat) {
    const f = midi(note);
    const end = start + Math.max(0.6, beats * beat * 1.2);
    [[1, 0.06], [2, 0.03], [3.01, 0.012], [4.2, 0.008]].forEach(([m, a]) => {
      const g = ac.createGain();
      env(g, start, a, 0.004, end / m + start * (1 - 1 / m));
      g.connect(out);
      osc('sine', f * m, start, end, g);
    });
  }
  // Percussion: a low frame-drum thump, or a shaker tick.
  function hit(start, kind) {
    const n = ac.createBufferSource();
    n.buffer = breath();
    const f = ac.createBiquadFilter();
    const g = ac.createGain();
    if (kind === 'drum') {
      f.type = 'lowpass';
      f.frequency.value = 220;
      env(g, start, 0.35, 0.003, start + 0.35);
      const body = ac.createGain();
      env(body, start, 0.09, 0.003, start + 0.3);
      body.connect(out);
      const o = osc('sine', 95, start, start + 0.32, body);
      o.frequency.exponentialRampToValueAtTime(60, start + 0.25);
    } else {
      f.type = 'highpass';
      f.frequency.value = 6000;
      env(g, start, 0.025, 0.002, start + 0.07);
    }
    n.connect(f).connect(g).connect(out);
    n.start(start);
    n.stop(start + 0.4);
  }

  function scheduleBar(start) {
    const song = SONGS[playing];
    const beat = 60 / song.bpm;
    const nBars = song.chords.length;
    const i = bar % nBars;
    const chord = song.chords[i];
    const tones = chord.length > 4 ? chord.slice(1) : chord;
    const bass = chord.length > 4 ? chord[0] : chord[0] - 12;
    if (song.feel !== 'drone') pad(tones.slice(0, 3), start, song.beats * beat);

    if (song.feel === 'lyre') {
      // Rolled lyre chords and a processional drum.
      lyre(bass, start, 0.9);
      tones.forEach((n, k) => lyre(n, start + k * 0.06, 0.45));
      [0, 1, 2, 3, 2, 1].forEach((k, e) => lyre(tones[k % tones.length], start + (1 + e * 0.5) * beat, 0.3));
      hit(start, 'drum');
      hit(start + 2.5 * beat, 'drum');
    } else if (song.feel === 'drone') {
      // Tanpura cycle: Pa, Sa, Sa, low Sa across the bar.
      [chord[1], chord[2], chord[2], chord[0]].forEach((n, k) => tanpura(n, start + k * beat, beat * 3.5));
    } else if (song.feel === 'calypso') {
      piano(bass, start, 1, 0.7);
      piano(bass + 7, start + 1.5 * beat, 1, 0.5);
      piano(bass, start + 2 * beat, 1, 0.6);
      [0.5, 1.5, 2.5, 3.5].forEach((b) => tones.slice(0, 3).forEach((n) => marimba(n, start + b * beat, 0.45)));
      for (let e = 0; e < 8; e++) hit(start + e * 0.5 * beat, 'shake');
    } else if (song.feel === 'waltz') {
      piano(bass, start, 1, 0.9);
      [1, 2].forEach((b) => tones.slice(1, 3).forEach((n) => piano(n, start + b * beat, 1, 0.35)));
    } else if (song.feel === 'arpeggio') {
      piano(bass, start, 2, 0.8);
      piano(bass + 7, start + 2 * beat, 2, 0.5);
      const order = [0, 1, 2, 3, 2, 1, 2, 3];
      order.forEach((k, e) => piano(tones[k % tones.length], start + e * 0.5 * beat, 0.5, 0.32));
    } else {
      // Nocturne: a slow rolling figure, left hand low and soft.
      piano(bass, start, 4, 0.7);
      [0, 1, 2, 3, 2, 1].forEach((k, e) => piano(tones[k] - 12 + (k > 1 ? 12 : 0), start + (e * 4 * beat) / 6, 1, 0.26));
    }

    // Melody: the notes that fall in this bar. Second time through, the lead swaps instrument.
    const from = i * song.beats;
    const lead = loops % 2 && song.lead === 'flute' ? 'piano' : song.lead;
    song.melody
      .filter(([b]) => b >= from && b < from + song.beats)
      .forEach(([b, note, len]) => {
        const t = start + (b - from) * beat;
        if (lead === 'flute') flute(note, t, len, beat);
        else if (lead === 'bansuri') flute(note - 12, t, len, beat);
        else if (lead === 'lyre') lyre(note, t, 1);
        else if (lead === 'steel') steel(note, t, len, beat);
        else {
          piano(note, t, len, 1);
          if (playing === 'waltz') bell(note + 12, t, 0.5);
        }
      });
    if (playing === 'nocturne' && Math.random() < 0.4) bell(tones[2] + 24, start + (1 + Math.floor(Math.random() * 3)) * beat, 0.6);

    bar += 1;
    if (bar % nBars === 0) {
      loops += 1;
      // Playlist: after two passes, move on (at night it stays with the nocturne and the sunset theme).
      if (request === 'auto' && loops % 2 === 0) {
        const list = night ? ['nocturne', 'sunset'] : ['meadow', 'sunset']; // the waltz belongs to the Music Grove only
        playing = list[(list.indexOf(playing) + 1) % list.length];
        bar = 0;
      }
    }
    return song.beats * beat;
  }

  function loop() {
    while (nextBar < ac.currentTime + 0.4) nextBar += scheduleBar(nextBar);
  }

  return {
    // 0 = silent, 1 = full. Fades smoothly; the scheduler only runs while audible.
    setVolume(v) {
      wanted = v;
    },
    // A song name to play now, or 'auto' for the time-of-day playlist.
    setTrack(name, isNight = false) {
      night = isNight;
      if (name === request) return;
      request = name;
      const next = name === 'auto' ? (isNight ? 'nocturne' : 'meadow') : name;
      if (next !== playing) {
        playing = next;
        bar = 0;
        loops = 0;
      }
    },
    get track() {
      return playing;
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
