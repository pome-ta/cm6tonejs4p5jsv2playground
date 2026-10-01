// --- # example:
import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 105;

function ftRand(bias, spread = 1.0) {
  const maxDist = Math.min(bias, 1.0 - bias) * spread;
  return bias + (Math.random() * 2 - 1) * maxDist;
}

const sketch = (p) => {
  // --- Tone.js
  const ctx = p.getAudioContext();
  Tone.setContext(ctx, true);
  /* Starting Audio */
  document.addEventListener('pointerup', async () => await Tone.start(), {
    once: true,
  });
  const transport = Tone.getTransport();
  transport.bpm.value = BPM;

  const toTime = (t) => new Tone.TimeClass(transport.context, t).toSeconds();

  const masterCh = new Tone.Channel().toDestination();
  const emitter = new Tone.Emitter();

  // メトロノーム
  const clickSynth = new Tone.MembraneSynth({
    pitchDecay: `3i`, // 0 ~ 0.5 秒
    octaves: 1.25, // 0.5 ~ 8
    envelope: {
      attack: 0.0,
      decay: 1.0,
      sustain: 0.0,
      release: `8t`,
    },
    oscillator: { type: 'sine' },
  });
  const clickSeq = new Tone.Sequence({
    callback: (time, note) => {
      clickSynth.triggerAttackRelease(note, '1i', time);
    },
    events: ['A5', 'A4', 'A4', 'A4'],
    subdivision: '4n',
  });
  const clickCh = new Tone.Channel(-4);
  clickSynth.chain(clickCh);

  const fmPolyCh = new Tone.Channel();
  const fmPolySynth = new Tone.PolySynth(Tone.FMSynth, {
    harmonicity: 5.0,
    modulationIndex: 2.0,

    oscillator: { type: 'sine' },
    // oscillator: { type: 'sawtooth' },
    // oscillator: { type: 'triangle' },
    // oscillator: { type: 'square' },
    // oscillator: { type: 'fmsawtooth' },
    // oscillator: { type: 'pulse', width: 0.3 },

    envelope: {
      //
      attack: 1e-2,
      decay: 1.37,
      sustain: 0.8,
      release: `32i`,
    },
    // modulation: { type: 'pulse', width: 0.07 },
    // modulation: { type: 'square'},
    // modulation: { type: 'sawtooth' },
    // modulation: { type: 'triangle' },
    // modulation: { type: 'fmsawtooth' },
    modulation: { type: 'sine' },
    modulationEnvelope: {
      //
      attack: 5e-4,
      decay: 2.9,
      sustain: 0.15,
      release: '128i',
    },
  }).chain(
    ...[
      //
      fmPolyCh,
    ].filter((n) => n),
  );

  const fmPolySeq = new Tone.Sequence({
    callback: (time, value) => {
      fmPolySynth.triggerAttackRelease(value.notes, '2n', time, ftRand(0.8));
      /*
      value.notes.forEach((note, idx) => {
        // const computedTime = toTime('16n.');
        const computedTime = toTime({ '8n.': 1.25 });
        // const durationSeconds = idx * toTime({ '8n': 1, '16t': 1 });
        const durationSeconds = idx * toTime({ '16t': 1.0 }) * (1 + ftRand(0.125));
        fmPolySynth.triggerAttackRelease(note, computedTime, time + durationSeconds, ftRand(0.8));
      });
      */
    },
    events: [
      
{ notes: ['G3', 'B3', 'D4', 'E4'] },   // Cmaj9
{ notes: ['Ab3', 'C4', 'Eb4', 'G4'] }, // Fm9
{ notes: ['A3', 'C4', 'E4', 'G4'] },   // Am7
{ notes: ['Ab3', 'C4', 'D4', 'F4'] },  // Dm7b5 / color

      /*
      { notes: ['G3', 'B3', 'D4', 'E4'] }, // Cmaj9
      // { notes: ['G3', 'B3', 'C4', 'E4'] }, // Am9
      // { notes: ['G#3', 'B3', 'D4', 'F4'] }, // E7b9
      // { notes: ['G#3', 'B3', 'D4', 'F4'] }, // E7b9
      // { notes: ['A3', 'D#4', 'E4', 'F4'] }, // B7#11
      { notes: ['F3', 'A3', 'C4', 'G4'] }, // Dm11
      { notes: ['A3', 'C4', 'E4', 'G4'] }, // Fmaj9
      { notes: ['Gb3', 'Bb3', 'C4', 'F4'] }, // Ab13
      */

      /*
      { notes: ['G3', 'B3', 'D4', 'E4'] }, // Cmaj9
      { notes: ['G3', 'B3', 'C4', 'E4'] }, // Am9
      { notes: ['F3', 'A3', 'C4', 'G4'] }, // Dm11
      // { notes: ['F3', 'Ab3', 'Bb3', 'B3'] }, // Db13
      { notes: ['Ab3', 'C4', 'Eb4', 'G4'] }, // Fm9


      
      { notes: ['G3', 'B3', 'D4', 'E4'] }, // Cmaj9
      { notes: ['G#3', 'B3', 'D4', 'F4'] }, // E7b9
      { notes: ['G3', 'B3', 'C4', 'E4'] }, // Am9
      { notes: ['Gb3', 'Bb3', 'C4', 'F4'] }, // Ab13

      { notes: ['G3', 'B3', 'D4', 'E4'] }, // Cmaj9
      { notes: ['F3', 'Ab3', 'C4', 'G4'] }, // Db7#11
      { notes: ['A3', 'C4', 'E4', 'G4'] }, // Fmaj9
      { notes: ['Ab3', 'C4', 'Eb4', 'G4'] }, // Fm9

      { notes: ['G3', 'B3', 'D4', 'E4'] }, // Cmaj9
      { notes: ['A3', 'D#4', 'E4', 'F4'] }, // B7#11
      { notes: ['A3', 'C4', 'D4', 'F4'] }, // Bbmaj9
      { notes: ['Gb3', 'C4', 'D4', 'G4'] }, // Ab7#11
      */
      
    ],
    subdivision: '2n',
  });

  // ---  master mixer
  const fanInNodes = [
    //
    fmPolyCh,
    clickCh,
  ];
  Tone.fanIn(...fanInNodes.filter((n) => n), masterCh);

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    //transport.start();
    transport.scheduleOnce((time) => {
      clickSeq.start(time);
      fmPolySeq.start(time);
    }, transport.context.now());
    // }, 0);
  });

  // --- Sketch
  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  // --- Plugins
  const tapIndicator = new TapIndicator(p);
  const spectrumAnalyzer = new SpectrumAnalyzer(p, 2048);

  //p.setup = async () => {
  p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

    // xxx: インクルード要検討
    transport.start();
    emitter.emit('startOnceCallSeqs');

    tapIndicator.setup();
    spectrumAnalyzer.targetNodes(masterCh);

    // p.noLoop();
    // p.frameRate(1);
  };

  p.draw = () => {
    // put drawing code here
    p.background(80);
    spectrumAnalyzer.drawGraph();
  };

  p.windowResized = (e) => {
    console.log('windowResized');
    w = p.windowWidth;
    h = p.windowHeight;
    cnvs = p.resizeCanvas(w, h);
  };
};

new p5(sketch);
