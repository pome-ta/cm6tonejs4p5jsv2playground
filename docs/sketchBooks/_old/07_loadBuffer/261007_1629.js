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

  const masterVol = new Tone.Volume().toDestination();
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
  const clickVol = new Tone.Volume(-4);
  clickSynth.chain(clickVol);

  // --- kick
  const kickVol = new Tone.Volume();
  const kickSampler = new Tone.Sampler({
    attack: 0.0,
    release: '2i',
    curve: 'exponential',
  }).chain(
    ...[
      //
      kickVol,
    ].filter((n) => n),
  );
  const KickNote = 'A3';
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
      synth.triggerAttack(KickNote);
      synth.frequency.rampTo('C#1', 0.083);
      synth.chain(
        ...[
          //,
          new Tone.Volume(),

          //,
          Tone.getDestination(),
        ].filter((n) => n),
      );
    }, 1.25);
    smplr.add(KickNote, buffer);
  };

  const kickSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      kickSampler.triggerAttack(KickNote, time, velocity);
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
  const snareVol = new Tone.Volume();
  const snareSampler = new Tone.Sampler({
    attack: 0.0,
    release: '2i',
    curve: 'exponential',
  }).chain(
    ...[
      //
      snareVol,
    ].filter((n) => n),
  );
  const snareNote = 'C4';
  const setSnareBuffer = async (smplr) => {
    const buffer = await Tone.Offline((context) => {
      context.transport.bpm.value = BPM;

      const snappyBandpass = new Tone.Filter({
        type: 'bandpass',
        frequency: 1900,
        Q: 1.0,
        rolloff: -12, // -12, -24, -48, -96
        // gain: 1.0,  // "peaking"/"lowshelf"/"highshelf"
      });

      const snappyHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 673,
        Q: 1.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const snareHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 4000,
        Q: 1.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const snareComp = new Tone.Compressor({
        threshold: -75, // -100-0 : -24
        ratio: 20, // 1-20 : 12
        attack: 0.01,
        release: 3e-5,
        knee: 40, // 0-40 : 30
      });

      const whiteNoise = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: 2e-3,
          decay: 0.15,
          sustain: 0.0,
          release: 0.0,
        },
      });

      const membraneSynth = new Tone.MembraneSynth({
        // oscillator: { type: 'sine' },
        oscillator: { type: 'sine', phase: 270 },
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
      membraneSynth.triggerAttackRelease(snareNote, '4i');
      whiteNoise.triggerAttack();

      const snareVolume = new Tone.Volume();

      whiteNoise.chain(
        ...[
          //
          snappyHighpass,
          snappyBandpass,
          new Tone.Volume(),
          snareVolume,
        ].filter((n) => n),
      );
      membraneSynth.chain(
        ...[
          //
          new Tone.Volume(),
          snareVolume,
        ].filter((n) => n),
      );

      snareVolume.chain(
        ...[
          //
          // snareHighpass,
          // snareComp,
          snareHighpass,
          new Tone.Volume(),
          Tone.getDestination(),
        ].filter((n) => n),
      );
    }, 1.75);
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
    kickVol,
    snareVol,
    clickVol,
  ];
  Tone.fanIn(...fanInNodes.filter((n) => n), masterVol);

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
    spectrumAnalyzer.targetNodes(masterVol);

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
