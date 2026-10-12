// --- # example:

import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const sketch = (p) => {
  // --- Tone.js
  const ctx = p.getAudioContext();
  Tone.setContext(ctx);
  /* Starting Audio */
  document.addEventListener('pointerup', async () => await Tone.start(), {
    once: true,
  });

  const transport = Tone.getTransport();
  const BPM = transport.bpm;
  const masterCh = new Tone.Channel().toDestination();

  const kickCh = new Tone.Channel();

  const kickSynth = new Tone.MembraneSynth({
    // oscillator: { type: 'pulse', width: 0},
    // oscillator: { type: 'pulse', width: 0, phase: -20 },
    oscillator: { type: 'sine', phase: -80 },
    // oscillator: { type: 'sine' },
    envelope: {
      attack: 0,
      decay: 2.5,
      sustain: 0.0,
      release: '1i',
      // attackCurve: 'exponential',
    },
    octaves: 3.8,
    pitchDecay: '124n',
  });

  const kickSeq = new Tone.Sequence({
    callback: (time, _signal) => {
      kickSynth.triggerAttack('A1', time);
    },
    // prettier-ignore
    events: [
      // 1, 1, null, 1,
      // 1, [null, 1, 1, null], 1, [1, 1],
      [null, 1, 1, null], 1, 1, [1, 1],
      // 1,
    ],
    subdivision: '4n',
    // humanize: 0.001,
  });

  const kickChainAry = [
    //kickComp,
    //
    kickCh,
  ];
  kickSynth.chain(...kickChainAry.filter((n) => n));
  kickCh.chain(masterCh);

  // --- Sketch
  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  // --- Plugins
  const tapIndicator = new TapIndicator(p);
  const spectrumAnalyzer = new SpectrumAnalyzer(p, 2048);

  p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

    BPM.value = 135;

    transport.start(0);
    kickSeq.start();

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
