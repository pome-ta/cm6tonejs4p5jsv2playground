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
  BPM.value = 105;

  const masterCh = new Tone.Channel().toDestination();

  const kickCh = new Tone.Channel();
  const player = new Tone.Player();

  const kickADSR = {
    attack: '1i',
    decay: 0.75,
    sustain: 0.0,
    release: 0.075,
    attackCurve: 'exponential',
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
    // oscillator: { type: 'pulse', width: 0},
    oscillator: { type: 'pulse', width: 0, phase: -20 },
    // oscillator: { type: 'sine' , phase: -80 },
    // oscillator: { type: 'sine' },
    envelope: {
      attack: '1i',
      decay: 2.5,
      sustain: 0.0,
      release: 2.5,
      attackCurve: 'exponential',
    },
    filter: {
      type: 'lowpass',
      rolloff: -24, // -12, -24, -48, -96
      gain: 2,
      Q: 3.2,
      frequency: 0,
    },
    filterEnvelope: {
      ...kickADSR,
      baseFrequency: 145,
      octaves: 1.2,
    },
  });

  const kickPitchFrq = new Tone.FrequencyEnvelope({
    ...kickADSR,
    baseFrequency: 'A0',
    octaves: 2.7,
    releaseCurve: 'linear',
  });

  kickPitchFrq.connect(kickSynth.oscillator.frequency);

  const kickComp = new Tone.Compressor({
    threshold: -24,
    ratio: 5,
    attack: 0.05,
    release: 0.125,
    knee: 30,
  });

  const kickSeq = new Tone.Sequence({
    callback: (time, _signal) => {
      kickSynth.triggerAttack(0, time);
      kickPitchFrq.triggerAttack(time);
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
  const playSeq = new Tone.Sequence({
    callback: (time, _signal) => {
      player.start(time);
    },
    // prettier-ignore
    events: [
      // 1, 1, null, 1,
      1, [null, 1, 1, null], 1, [1, 1],
      // [null, 1, 1, null], 1, 1, [1, 1],
      // 1,
    ],
    subdivision: '2n',
    humanize: 0.001,
  });

  player.chain(masterCh);

  const kickChainAry = [
    kickComp,
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

  p.setup = async () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

    // BPM.value = 135;

    const buf = await Tone.Offline(() => {
      const synth = new Tone.Synth({
        // oscillator: { type: 'sine', phase: -80 },
        // oscillator: { type: 'sine' },
        // oscillator: { type: 'sine', phase: -72 },

        oscillator: { type: 'pulse', width: 0 },
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
      const nowTime = Tone.now();
      // console.log(nowTime);

      synth.triggerAttack('A6', 0);
      // synth.frequency.rampTo('A2', 0.1);
      // synth.triggerAttackRelease('A5', nowTime, nowTime+1.5);
      synth.frequency.rampTo('A3', 0.1);
      // synth.triggerAttack('A0', nowTime + 0.001);
      // synth.triggerAttackRelease('A4', 0, 1.5);

      synth.triggerRelease(0.5);
    }, 2.5);

    // const player = new Tone.Player();
    player.buffer = buf;
    // const playSeq = new Tone.Sequence({
    //   callback: (time, _signal) => {
    //     player.start(time);
    //   },
    //   // prettier-ignore
    //   events: [
    //   // 1, 1, null, 1,
    //   1, [null, 1, 1, null], 1, [1, 1],
    //   // [null, 1, 1, null], 1, 1, [1, 1],
    //   // 1,
    // ],
    //   subdivision: '2n',
    //   humanize: 0.001,
    // });

    // player.chain(masterCh);

    transport.start(0);
    kickSeq.start();
    playSeq.start();

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
