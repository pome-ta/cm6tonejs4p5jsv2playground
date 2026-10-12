// --- # example: 808 ?
import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 90;

function ftRand(bias, spread = 1.0) {
  const maxDist = Math.min(bias, 1.0 - bias) * spread;
  return bias + (Math.random() * 2 - 1) * maxDist;
}

const scParams = (levels, times, curve) => ({ levels, times, curve });

const expCurve = (start, end, curve, steps) => {
  const envelope = (_start, _end, _progress, _curve) => {
    if (_curve === 0) {
      return _start + (_end - _start) * _progress;
    }
    const _exp = Math.exp(_curve * _progress);
    const _curveRatio = (_exp - 1) / (Math.exp(_curve) - 1);
    return _start + (_end - _start) * _curveRatio;
  };

  const levels = Array.from({ length: steps + 1 }, (_, i) =>
    envelope(start, end, i / steps, curve),
  );

  return levels;
};

const frqCurve = (
  startfrequency,
  endfrequency,
  curveExponent = 0,
  divSteps = 128,
) => {
  const curve = expCurve(startfrequency, endfrequency, curveExponent, divSteps);

  return curve;
};

const volCurve = (
  startGain,
  curveExponent = 1,
  endGain = 0,
  divSteps = 2048,
) => {
  const gainCurve = expCurve(startGain, endGain, curveExponent, divSteps);
  return gainCurve.map((gain) => Tone.gainToDb(gain));
};

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
  const setKickBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const decay = 30; //58; //30;
      const amp = 2; //1.55; //2;
      const tone = 56; //58; //56;
      const envParams = scParams([0.11, 1, 0], [0, decay], -225);
      const trienvParams = scParams([0.11, 0.6, 0], [0, decay], -230);
      const fenvParams = scParams(
        [tone * 7, tone * 1.35, tone],
        [0.05, 0.6],
        -14,
      );
      const pfenvParams = scParams(
        [tone * 7, tone * 1.35, tone],
        [0.03, 0.6],
        -10,
      );

      const sigGain = new Tone.Gain();
      const sig = new Tone.Synth({
        // oscillator: { type: 'sine', phase: 270 },
        oscillator: { type: 'sine' },
        envelope: {
          attack: 6e-4,
          // attack: 0.0,
          decay: decay,
          sustain: 1,
          release: 0.0,
          attackCurve: 'exponential',
        },
      }).chain(
        ...[
          //,
          sigGain,
        ].filter((n) => n),
      );
      sig.triggerAttack(fenvParams.levels[0]);

      sig.volume.setValueCurveAtTime(
        volCurve(envParams.levels[1], envParams.curve),
        envParams.times[0],
        envParams.times[1],
      );

      sig.frequency.setValueCurveAtTime(
        frqCurve(fenvParams.levels[0], fenvParams.levels[1], fenvParams.curve),
        0,
        fenvParams.times[0],
      );
      sig.frequency.setValueCurveAtTime(
        frqCurve(fenvParams.levels[1], fenvParams.levels[2], fenvParams.curve),
        fenvParams.times[0],
        fenvParams.times[1],
      );

      const subGain = new Tone.Gain();
      const sub = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 6e-4,
          // attack: 0.0,
          decay: decay,
          sustain: 1,
          release: 0.0,
          attackCurve: 'exponential',
        },
      }).chain(
        ...[
          //,
          new Tone.Gain(0.05),
          subGain,
        ].filter((n) => n),
      );

      sub.triggerAttack(fenvParams.levels[0]);
      sub.volume.setValueCurveAtTime(
        volCurve(trienvParams.levels[1], trienvParams.curve),
        trienvParams.times[0],
        trienvParams.times[1],
      );

      sub.frequency.setValueCurveAtTime(
        frqCurve(fenvParams.levels[0], fenvParams.levels[1], fenvParams.curve),
        0,
        fenvParams.times[0],
      );
      sub.frequency.setValueCurveAtTime(
        frqCurve(fenvParams.levels[1], fenvParams.levels[2], fenvParams.curve),
        fenvParams.times[0],
        fenvParams.times[1],
      );

      const highpass = new Tone.Filter({
        type: 'highpass',
        frequency: 350,
        Q: 1.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const punchGain = new Tone.Gain();
      const punch = new Tone.Synth({
        // oscillator: { type: 'sine', phase: 270 },
        oscillator: { type: 'sine' },
        envelope: {
          attack: 6e-4,
          decay: decay,
          sustain: 1.0,
          release: 0.0,
          attackCurve: 'exponential',
        },
      }).chain(
        ...[
          //,
          new Tone.Gain(2),
          highpass,
          punchGain,
        ].filter((n) => n),
      );

      punch.triggerAttack(pfenvParams.levels[0]);
      punch.volume.setValueCurveAtTime(
        volCurve(envParams.times[1], envParams.curve),
        0,
        decay,
      );

      punch.frequency.setValueCurveAtTime(
        frqCurve(
          pfenvParams.levels[0],
          pfenvParams.levels[1],
          pfenvParams.curve,
        ),
        0,
        pfenvParams.times[0],
      );
      punch.frequency.setValueCurveAtTime(
        frqCurve(
          pfenvParams.levels[1],
          pfenvParams.levels[2],
          pfenvParams.curve,
        ),
        pfenvParams.times[0],
        pfenvParams.times[1],
      );

      const bdGain = new Tone.Gain();
      Tone.fanIn(
        ...[
          //
          sigGain,
          subGain,
          punchGain,
        ].filter((n) => n),
        new Tone.Gain().chain(
          ...[
            //,
            new Tone.Gain(2.5),
            new Tone.Limiter(-50),
            new Tone.Gain(amp),
            new Tone.Channel(),
            bdGain,
          ].filter((n) => n),
        ),
      );

      Tone.fanIn(bdGain, Tone.getDestination());
    }, 10.5);
    smplr.add(KickNote, buffer);
  };

  const kickSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      // kickSampler.triggerAttack(KickNote, time, velocity);
      kickSampler.triggerAttackRelease(KickNote, `8t`, time, velocity);
    },
    events: [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, [1, ftRand(0.225)]],
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
  const snareNote = 'A4';
  const setSnareBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const amp = 2;
      const tone = 340;
      const tone2 = 189;
      const snappy = 0.3;
      const amp2 = 1;

      const noiseEnvParams = {
        attack: 0.001,
        release: 4.2,
        level: 1,
        curve: -115,
      };
      const atkEnvParams = {
        attack: 0.001,
        release: 0.8,
        level: 1,
        curve: -95,
      };
      const noiseHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 1800,
        Q: 1.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      const noiseLowpass = new Tone.Filter({
        type: 'lowpass',
        frequency: 8850,
        Q: 1.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const noiseGain = new Tone.Gain();
      const whiteNoise = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: 0.0,
          decay: 1.0,
          sustain: 1.0,
          release: 0.0,
        },
      }).chain(
        ...[
          //
          noiseHighpass,
          noiseLowpass,
          new Tone.Gain(snappy),
          noiseGain,
        ].filter((n) => n),
      );

      whiteNoise.triggerAttack();
      whiteNoise.volume.setValueCurveAtTime(
        volCurve(noiseEnvParams.level, noiseEnvParams.curve),
        noiseEnvParams.attack,
        noiseEnvParams.release,
      );

      const osc1Gain = new Tone.Gain();
      const osc1 = new Tone.Synth({
        // oscillator: { type: 'sine', phase: 270 },
        oscillator: { type: 'sine' },
        envelope: {
          attack: 6e-4,
          decay: 1.0,
          sustain: 1.0,
          release: 0.0,
          attackCurve: 'exponential',
        },
      }).chain(
        ...[
          //,
          new Tone.Gain(0.6),
          osc1Gain,
        ].filter((n) => n),
      );

      const osc2Gain = new Tone.Gain();
      const osc2 = new Tone.Synth({
        // oscillator: { type: 'sine', phase: 270 },
        oscillator: { type: 'sine' },
        envelope: {
          attack: 6e-4,
          decay: 1.0,
          sustain: 1.0,
          release: 0.0,
          attackCurve: 'exponential',
        },
      }).chain(
        ...[
          //,
          new Tone.Gain(0.7),
          osc2Gain,
        ].filter((n) => n),
      );

      osc1.triggerAttack(tone2);
      osc2.triggerAttack(tone);

      osc1.volume.setValueCurveAtTime(
        volCurve(atkEnvParams.level, atkEnvParams.curve),
        0,
        atkEnvParams.release,
      );
      osc2.volume.setValueCurveAtTime(
        volCurve(atkEnvParams.level, atkEnvParams.curve),
        0,
        atkEnvParams.release,
      );

      const sumGain = new Tone.Gain();
      Tone.fanIn(
        ...[
          //
          osc1Gain,
          osc2Gain,
        ].filter((n) => n),
        new Tone.Gain().chain(
          ...[
            //,
            new Tone.Gain(2),
            sumGain,
          ].filter((n) => n),
        ),
      );
      const sigHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 340,
        Q: 1.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      const sigGain = new Tone.Gain();
      Tone.fanIn(
        ...[
          //
          noiseGain,
          sumGain,
        ].filter((n) => n),
        new Tone.Gain().chain(
          ...[
            //,
            new Tone.Gain(amp),
            new Tone.Gain(2.5),
            new Tone.Channel(),
            sigHighpass,
            sigGain,
          ].filter((n) => n),
        ),
      );

      Tone.fanIn(sigGain, Tone.getDestination());
    }, 5.75);
    smplr.add(snareNote, buffer);
  };

  const snareSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      snareSampler.triggerAttack(snareNote, time, velocity);
      // snareSampler.triggerAttackRelease(snareNote, '16t', time, velocity);
    },
    events: [[null, 1]],
    subdivision: '2n',
  });

  // ---  master mixer
  const masterVol = new Tone.Volume();
  const fanInNodes = [
    //
    clickVol,
    kickVol,
    snareVol,
  ];
  // kickVol.set({ volume: Tone.gainToDb(5.7) });
  // masterVol.volume.value = Tone.gainToDb(0.9);

  const masterLimiter = new Tone.Limiter(-1);

  Tone.fanIn(
    ...fanInNodes.filter((n) => n),
    masterVol.chain(
      ...[
        //
        // masterLimiter,
        Tone.getDestination(),
      ].filter((n) => n),
    ),
  );

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
