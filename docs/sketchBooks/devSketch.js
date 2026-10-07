// --- # example: async load
import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 125;

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

  // --- kick
  const kickCh = new Tone.Channel();
  const kickSampler = new Tone.Sampler({
    attack: 0.0,
    release: '2i',
    curve: 'exponential',
  }).chain(
    ...[
      //
      kickCh,
    ].filter((n) => n),
  );
  const setKickBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const synth = new Tone.Synth({
        oscillator: { type: 'sine', phase: 270 },
        envelope: {
          attack: 6e-4,
          decay: 2.25,
          sustain: 0.0,
          release: 0.0,
          attackCurve: 'exponential',
        },
      });
      synth.triggerAttack('A3');
      synth.frequency.rampTo('C#1', 0.083);
      synth.chain(
        ...[
          //,
          new Tone.Channel().toDestination(),
        ].filter((n) => n),
      );
    }, 1.25);
    smplr.add('A3', buffer);
  };

  const kickSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      kickSampler.triggerAttack('A3', time, velocity);
    },
    events: [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, [1, ftRand(0.125)]],
    ],
    subdivision: '1n',
  });

  // --- snare
  const snareCh = new Tone.Channel();
  const snareSampler = new Tone.Sampler({
    attack: 0.0,
    release: '2i',
    curve: 'exponential',
  }).chain(
    ...[
      //
      snareCh,
    ].filter((n) => n),
  );
  const snareNote = 'C3';
  const setSnareBuffer = async (smplr) => {
    const buffer = await Tone.Offline((context) => {
      context.transport.bpm.value = BPM;

      const whiteNoise = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: 1e-3,
          decay: 0.15,
          sustain: 0.0,
          release: 0.0,
        },
      });
      const bandpass = new Tone.Filter({
        type: 'bandpass',
        frequency: 1900,
        Q: 1.0,
        rolloff: -12, // -12, -24, -48, -96
        gain: 1.0,
      });

      const membraneSynth = new Tone.MembraneSynth({
        oscillator: { type: 'sine' },
        // oscillator: { type: 'sine', phase: 270 },
        envelope: {
          //
          attack: 1e-3,
          decay: 0.25,
          sustain: 0.0,
          release: 0.0,
        },
        pitchDecay: 0.02,
        octaves: 1.25,
      });

      // membraneSynth.triggerAttack(snareNote);
      whiteNoise.triggerAttack();
      membraneSynth.triggerAttackRelease(snareNote, '4i');

      const snareChannel = new Tone.Channel();

      membraneSynth.chain(
        ...[
          //
          snareChannel,
        ].filter((n) => n),
      );
      whiteNoise.chain(
        ...[
          //
          bandpass,
          snareChannel,
        ].filter((n) => n),
      );

      Tone.fanIn(snareChannel, Tone.getDestination());
    }, 1.25);
    smplr.add(snareNote, buffer);
  };

  const snareSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      snareSampler.triggerAttack(snareNote, time, velocity);
    },
    events: [[null, 1]],
    subdivision: '2n',
  });

  // ---  master mixer
  const fanInNodes = [
    //
    kickCh,
    snareCh,
    clickCh,
  ];
  Tone.fanIn(...fanInNodes.filter((n) => n), masterCh);

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    transport.scheduleOnce((time) => {
      // clickSeq.start(time);
      kickSeq.start(time);
      snareSeq.start(time);
    }, transport.context.now());
  });

  // --- Sketch
  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  // --- Plugins
  const tapIndicator = new TapIndicator(p);
  const spectrumAnalyzer = new SpectrumAnalyzer(p, 2048);

  p.setup = async () => {
    //p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

    await setKickBuffer(kickSampler);
    await setSnareBuffer(snareSampler);

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
    w = p.windowWidth;
    h = p.windowHeight;
    cnvs = p.resizeCanvas(w, h);
  };
};

new p5(sketch);
