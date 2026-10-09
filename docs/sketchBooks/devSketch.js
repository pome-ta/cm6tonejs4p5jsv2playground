// --- # example:
import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 90;

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
  const KickNote = 'A4';
  const setKickBuffer = async (smplr, tone = 56) => {
    const buffer = await Tone.Offline(() => {
      const sig = new Tone.Oscillator({
        frequency: tone * 7,
        // phase: 90,
      }).start();
      sig.volume.setTargetAtTime(-Infinity, 0.0, 5e-2);

      sig.frequency.rampTo(tone * 1.35, 0.05, 0);
      sig.frequency.rampTo(tone * 1.35, 0.6, "+0.05");
      // sig.frequency.exponentialRampTo(tone * 1.35, 0.5);
      // sig.frequency.linearRampTo(tone * 1.35, 0.5);
      // sig.frequency.exponentialApproachValueAtTime(tone * 1.35, 0, 0.05);

      // const sig = new Tone.Synth({
      //   //oscillator: { type: 'sine', phase: 270 },
      //   oscillator: { type: 'sine' },
      //   envelope: {
      //     attack: 6e-4,
      //     decay: 30.0,
      //     sustain: 1.0,
      //     release: 0.0,
      //   },
      // });

      const sub = new Tone.Synth({
        //oscillator: { type: 'sine', phase: 270 },
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 6e-4,
          // attack: 0.0,
          decay: 0.35,
          sustain: 0.0,
          release: 0.0,
          attackCurve: 'exponential',
        },
      });

      const punch = new Tone.Synth({
        //oscillator: { type: 'sine', phase: 270 },
        oscillator: { type: 'sine' },
        envelope: {
          attack: 6e-4,
          // attack: 0.0,
          decay: 0.35,
          sustain: 0.0,
          release: 0.0,
          attackCurve: 'exponential',
        },
      });

      const synth = new Tone.Synth({
        oscillator: { type: 'sine', phase: 270 },
        envelope: {
          attack: 6e-4,
          // attack: 0.0,
          decay: 0.35,
          sustain: 0.0,
          release: 0.0,
          attackCurve: 'exponential',
        },
      });
      //sig.triggerAttackRelease(KickNote, 3);
      // sig.triggerAttack(KickNote);
      //synth.triggerAttack(KickNote);
      //synth.frequency.rampTo('C1', 0.043);
      sig.chain(
        ...[
          //,
          new Tone.Volume(),
          //,
          Tone.getDestination(),
        ].filter((n) => n),
      );
    }, 30.0);
    smplr.add(KickNote, buffer);
  };

  const kickSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      //kickSampler?.triggerRelease(time)
      kickSampler.triggerAttack(KickNote, time, velocity);
      // kickSampler.triggerAttackRelease(KickNote, `64i`, time, velocity);
    },
    events: [
      //[0,1]
      // 1,

      [1, 1, 1, 1],
      // [1, 1, 1, 1],
      // [1, 1, 1, 1],
      // [1, 1, 1, [1, ftRand(0.125)]],
    ],
    subdivision: '1n',
  });

  // ---  master mixer

  const fanInNodes = [
    //
    clickVol,
    kickVol,
  ];
  // kickVol.set({ volume: Tone.gainToDb(5.7) });
  // masterVol.volume.value = Tone.gainToDb(0.9);

  const masterLimiter = new Tone.Limiter(-1);
  const masterVol = new Tone.Volume().chain(
    ...[
      //
      // masterLimiter,
      Tone.getDestination(),
    ].filter((n) => n),
  );
  Tone.fanIn(...fanInNodes.filter((n) => n), masterVol);

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    transport.scheduleOnce((time) => {
      // clickSeq.start(time);
      kickSeq.start(time);
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
