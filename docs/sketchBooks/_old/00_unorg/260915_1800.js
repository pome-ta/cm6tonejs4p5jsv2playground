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

  const kickADSR = {
    attack: 0.0,
    decay: 0.75,
    sustain: 0.0,
    release: 0.075,
    // attackCurve: 'linear',
    // attackCurve: 'cosine',
    // decayCurve: 'linear',
    // releaseCurve: 'linear',
    // releaseCurve: 'exponential',
    // releaseCurve: 'bounce',
    // decayCurve: 'exponential',
    // decayCurve: 'cosine',
    // decayCurve: 'sine',
    // decayCurve: 'step',
    // decayCurve: 'ripple',
    // decayCurve: 'bounce',
  };

  const kickSynth = new Tone.MonoSynth({
    // oscillator: { type: 'pulse', width: 0 },
    oscillator: { type: 'sine' },
    envelope: {
      attack: 0.0,
      decay: 1.75,
      sustain: 0.0,
      release: 2.5,
    },
    filter: {
      type: 'lowpass',
      rolloff: -12, // -12, -24, -48, -96
      gain: 2,
      Q: 1.2,
      frequency: 0,
    },
    filterEnvelope: {
      ...kickADSR,
      baseFrequency: 225, // 下限
      octaves: 4.1,
    },
  });

  const kickPitchFrq = new Tone.FrequencyEnvelope({
    ...kickADSR,
    baseFrequency: 'A0', // 下限
    octaves: 1.8, // 上限 = baseFrequency * 2^octaves
    decayCurve: 'linear',
    // releaseCurve: 'linear',
  });

  kickPitchFrq.connect(kickSynth.oscillator.frequency);

  const kickComp = new Tone.Compressor({
    attack: 1,
    knee: 20,
    ratio: 2,
    release: 0.1,
    threshold: -30,
  });

  const kickCh = new Tone.Channel();
  const kickChainAry = [
    // kickComp,
    //
    kickCh,
  ];
  kickSynth.chain(...kickChainAry.filter((n) => n));
  kickCh.chain(masterCh);

  const kickSeq = new Tone.Sequence({
    callback: (time, _signal) => {
      kickSynth.triggerAttack(0, time);
      kickPitchFrq.triggerAttack(time);
    },
    // prettier-ignore
    events: [
      // 1, 1, null, 1,
      1, [null, 1, 1, null], 1, [1, 1],
      [null, 1, 1, null], 1, 1, [1, 1],
      // 1,
    ],
    subdivision: '4n',
    // humanize: 0.001,
  });

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
