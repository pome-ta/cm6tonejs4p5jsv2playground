// --- # example: async load
import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 130;

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
      // kickSampler.triggerAttack(KickNote, time, velocity);
      kickSampler.triggerAttackRelease(KickNote, `64i`, time, velocity);
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
  const snareNote = 'C3';
  const setSnareBuffer = async (smplr) => {
    const buffer = await Tone.Offline((context) => {
      context.transport.bpm.value = BPM;

      const whiteNoiseHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 1800,
        Q: 1.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      const whiteNoiseLowpass = new Tone.Filter({
        type: 'lowpass',
        frequency: 8850,
        Q: 2.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const whiteNoiseVolume = new Tone.Volume();
      const whiteNoiseSynth = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: 2e-3,
          decay: 0.175,
          sustain: 0.0,
          release: 0.0,
        },
      }).chain(
        ...[
          //
          whiteNoiseHighpass,
          whiteNoiseLowpass,
          whiteNoiseVolume,
        ].filter((n) => n),
      );

      const membraneVolume = new Tone.Volume();
      const membraneSynth = new Tone.MembraneSynth({
        // oscillator: { type: 'sine' },
        // oscillator: { type: 'sine', phase: 270 },
        oscillator: { type: 'triangle' },
        envelope: {
          //
          attack: 2e-3,
          decay: 0.25,
          sustain: 0.0,
          release: 0.0,
        },
        pitchDecay: 0.02,
        octaves: 4.0,
      }).chain(
        ...[
          //
          membraneVolume,
        ].filter((n) => n),
      );

      const sineVolume = new Tone.Volume();
      const sineSynth = new Tone.Synth({
        // oscillator: { type: 'sine', phase: 270 },
        oscillator: { type: 'sine' },
        envelope: {
          //
          // attackCurve: 'exponential',
          attack: 2e-3,
          decay: 0.25,
          sustain: 0.0,
          release: 0.0,
        },
      }).chain(
        ...[
          //
          sineVolume,
        ].filter((n) => n),
      );

      const snareComp = new Tone.Compressor({
        threshold: -40, // -100-0 : -24
        ratio: 20, // 1-20 : 12
        attack: 5e-1,
        release: 2e-4,
        knee: 40, // 0-40 : 30
      });
      const snareHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 300,
        Q: 0.9,
        rolloff: -12, // -12, -24, -48, -96
      });

      whiteNoiseSynth.triggerAttack();
      sineSynth.triggerAttack(189);
      membraneSynth.triggerAttack(340);

      whiteNoiseVolume.volume.value = Tone.gainToDb(0.4);
      membraneVolume.volume.value = Tone.gainToDb(0.05);
      sineVolume.volume.value = Tone.gainToDb(0.6);

      Tone.fanIn(
        ...[
          //
          whiteNoiseVolume,
          membraneVolume,
          sineVolume,
        ].filter((n) => n),
        new Tone.Volume().chain(
          ...[
            //
            // snareHighpass,
            snareComp,
            new Tone.Volume(),
            Tone.getDestination(),
          ].filter((n) => n),
        ),
      );
    }, 1.75);
    smplr.add(snareNote, buffer);
  };

  const snareSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      // snareSampler.triggerAttack(snareNote, time, velocity);
      // snareSampler.triggerAttack(`G#2`, time, velocity);
      // snareSampler.triggerAttackRelease(snareNote,`32i`, time, velocity);
      snareSampler.triggerAttackRelease(`G#2`, `48i`, time, velocity);
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
  // kickVol.set({ volume: Tone.gainToDb(0.7) }),
  snareVol.volume.value = Tone.gainToDb(0.35);
  masterVol.volume.value = Tone.gainToDb(0.9);
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
