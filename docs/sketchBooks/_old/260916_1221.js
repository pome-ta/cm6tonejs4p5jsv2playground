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
    attack: 0,
    decay: 0.075,
    sustain: 0.0,
    release: 1.75,
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

  const kickSynth = new Tone.Synth({
    // oscillator: { type: 'pulse', width: 0 },
    oscillator: { type: 'sine' },
    envelope: {
      attack: 1e-3,
      decay: 2.5,
      sustain: 0.0,
      release: '2n',
      // attackCurve: 'exponential',
      decayCurve: 'cosine',
      releaseCurve: 'sine',
    },
  });

  const kickPitchFrq = new Tone.FrequencyEnvelope({
    ...kickADSR,
    baseFrequency: 'A1', // 下限
    octaves: 2.8, // 上限 = baseFrequency * 2^octaves
    // decayCurve: 'linear',
    releaseCurve: 'cosine',
  });
  
  const kickFilter = new Tone.Filter({
    type: 'lowpass',
    frequency: 0,
    Q: 8.2,
    rolloff: -12, // -12, -24, -48, -96
    gain: 2,
  });
  
  const kickFltrFrq = new Tone.FrequencyEnvelope({
    ...kickADSR,
    baseFrequency: 175, // 下限
    octaves: 2.1, // 上限 = baseFrequency * 2^octaves
    // releaseCurve: 'linear',
  });

  //kickPitchFrq.connect(kickSynth.oscillator.frequency);
  //kickFltrFrq.connect(kickFilter.frequency);

  const kickCh = new Tone.Channel(8);
  const kickChainAry = [
    //
    kickCh,
  ];
  kickSynth.chain(...kickChainAry.filter((n) => n));
  kickCh.chain(masterCh);

  const kickSeq = new Tone.Sequence({
    callback: (time, _signal) => {
      kickSynth.triggerAttack('A3', time);
      // kickSynth.triggerAttackRelease('A3', '1n', time);

      //kickPitchFrq.triggerAttack(time);
      //kickFltrFrq.triggerAttack(time);
      // kickPitchFrq.triggerAttackRelease('64i', time);
    },
    // prettier-ignore
    events: [
      // 1, 1, null, 1,
      // 1, [null, 1, 1, null], 1, [1, 1],
      // [null, 1, 1, null], 1, 1, [1, 1],
      1,1,1,[1,1]
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

    BPM.value = 120;

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
