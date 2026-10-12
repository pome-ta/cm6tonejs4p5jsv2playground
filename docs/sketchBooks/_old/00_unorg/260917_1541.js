// --- # example:

import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const buffer = await Tone.Offline(() => {
  const synth = new Tone.Synth({
    oscillator: { type: 'sine', phase: -80 },
    // oscillator: { type: 'sine' },
    // oscillator: { type: 'sine', phase: -72 },

    // oscillator: { type: 'pulse', width: 0 },
    envelope: {
      attack: 1e-3,
      decay: 12.5,
      sustain: 0.0,
      release: 0.075,
      attackCurve: 'exponential',
      // releaseCurve: 'exponential',
    },
    //portamento: 0.125,
  }).toDestination();
  // const nowTime = Tone.now();

  synth.triggerAttack('A5', 0);
  // synth.frequency.rampTo('A2', 0.1);
  // synth.triggerAttackRelease('A5', nowTime, nowTime+1.5);
  synth.frequency.rampTo('A2', 0.1);
  // synth.triggerAttack('A0', nowTime + 0.001);
  // synth.triggerAttackRelease('A4', 0, 1.5);

  synth.triggerRelease(0.5);
}, 2.5); // レンダリングする長さ(秒)

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
  BPM.value = 80;

  const toTime = (t) => Tone.Time(t).toSeconds();

  const masterCh = new Tone.Channel().toDestination();

  const kickCh = new Tone.Channel();

  const kickSynth = new Tone.Player(buffer);
  // console.log(buffer)

  // const kickSynth = new Tone.Synth({
  //   // oscillator: { type: 'pulse', width: 0},
  //   // oscillator: { type: 'pulse', width: 0, phase: -20 },
  //   oscillator: { type: 'sine', phase: -80 },
  //   // oscillator: { type: 'sine' },
  //   envelope: {
  //     attack: 0,
  //     decay: 2.5,
  //     sustain: 0.0,
  //     release: 0,
  //     // attackCurve: 'exponential',
  //     // releaseCurve: 'exponential',
  //   },
  //   portamento: toTime('16i'),
  // });

  const kickSeq = new Tone.Sequence({
    callback: (time, _signal) => {
      // kickSynth.triggerAttackRelease('A2', '64i', time);
      // kickSynth.triggerAttack('C3', time + toTime('32i'));
      kickSynth.start(time);
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
    // kickComp,
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
