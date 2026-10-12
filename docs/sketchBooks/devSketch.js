// --- # example: 808 ?
import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 90;

function ftRand(bias, spread = 1.0) {
  const maxDist = Math.min(bias, 1.0 - bias) * spread;
  return bias + (Math.random() * 2 - 1) * maxDist;
}

const expCurve = (start, end, curve, steps) => {
  const envelope = (_start, _end, _progress, _curve) => {
    if (_curve === 0) {
      return _start + (_end - _start) * _progress;
    }
    const _exp = Math.exp(_curve * _progress);
    const _curveRatio = (_exp - 1) / (Math.exp(_curve) - 1);
    return _start + (_end - _start) * _curveRatio;
  };

  const levels = Array.from({ length: steps + 1 }, (_, i) => envelope(start, end, i / steps, curve));

  return levels;
};

const frqCurve = (startfrequency, endfrequency, curveExponent = 0, divSteps = 256) => {
  const curve = expCurve(startfrequency, endfrequency, curveExponent, divSteps);

  return curve;
};

const volCurve = (startGain, curveExponent = 1, endGain = 0, divSteps = 1024) => {
  const gainCurve = expCurve(startGain, endGain, curveExponent, divSteps);
  return gainCurve.map((gain) => Tone.gainToDb(gain));
};

/*
const frqCurve = (startfrequency, endfrequency = 0, exponent = 1, steps = 50) => {
  const curve = Array.from(
    { length: steps },
    (_, i) => startfrequency * Math.pow(endfrequency / startfrequency, Math.pow(i / (steps - 1), exponent)),
  );

  return curve;
};

const volCurve = (startGain, exponent = 1, endGain = 0, steps = 50) => {
  const curve = Array.from({ length: steps }, (_, i) => {
    const progress = Math.pow(i / (steps - 1), exponent);
    const gain = startGain + (endGain - startGain) * progress;
    return Tone.gainToDb(gain);
  });
  return curve;
};

const steps = 3000;
const duration = 30;
const curve = -225;
*/

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
      const decay = 30;
      const tone = 56;
      const pdf1 = 7.0;
      const pdf2 = 1.35;
      const pdt11 = 0.05;
      const pdt12 = 0.6;
      const pdt21 = 0.03;
      const pdt22 = 0.6;
      const vRampTo = 2.7;

      const sigGain = new Tone.Gain();
      const sig = new Tone.Synth({
        // oscillator: { type: 'sine', phase: 270 },
        oscillator: { type: 'sine' },
        envelope: {
          // attack: 6e-4,
          attack: 0.0,
          decay: 30.0,
          sustain: 1.0,
          release: 0.0,
          attackCurve: 'exponential',
        },
      }).chain(
        ...[
          //,
          sigGain,
        ].filter((n) => n),
      );
      sig.triggerAttack(tone * pdf1);

      //sig.volume.rampTo(-Infinity, vRampTo);

      // sig.frequency.exponentialApproachValueAtTime(tone * pdf2, 0, pdt11);
      // sig.frequency.exponentialApproachValueAtTime(tone, `+${pdt11}`, pdt12);

      sig.volume.setValueCurveAtTime(volCurve(Tone.dbToGain(sig.volume.value), -225), 0, decay);

      sig.frequency.setValueCurveAtTime(frqCurve(tone * pdf1, tone * pdf2, -14), 0, pdt11);
      sig.frequency.setValueCurveAtTime(frqCurve(tone * pdf2, tone, -14), pdt11, pdt12);

      // const subGain = new Tone.Gain(0.05);
      const subGain = new Tone.Gain();
      const sub = new Tone.Synth({
        oscillator: { type: 'triangle' },
        envelope: {
          // attack: 6e-4,
          attack: 0.0,
          decay: 30.0,
          sustain: 0.6,
          release: 0.0,
          attackCurve: 'exponential',
        },
        // volume: Tone.gainToDb(0.05),
      }).chain(
        ...[
          //,
          new Tone.Gain(0.05),
          subGain,
        ].filter((n) => n),
      );

      sub.triggerAttack(tone * pdf1);

      //sub.volume.rampTo(-Infinity, 2);

      //sub.frequency.exponentialApproachValueAtTime(tone * pdf2, 0, pdt11);
      //sub.frequency.exponentialApproachValueAtTime(tone, `+${pdt11}`, pdt12);

      sub.volume.setValueCurveAtTime(volCurve(Tone.dbToGain(sub.volume.value), 230e-5), 0, decay);

      sub.frequency.setValueCurveAtTime(frqCurve(tone * pdf1, tone * pdf2, 0.96), 0, pdt11);
      sub.frequency.setValueCurveAtTime(frqCurve(tone * pdf2, tone, 0.96), pdt11, pdt12);

      const highpass = new Tone.Filter({
        type: 'highpass',
        frequency: 350,
        Q: 1.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      // const punchGain = new Tone.Gain(2);
      const punchGain = new Tone.Gain();
      const punch = new Tone.Synth({
        // oscillator: { type: 'sine', phase: 270 },
        oscillator: { type: 'sine' },
        envelope: {
          // attack: 6e-4,
          attack: 0.0,
          decay: 30.0,
          sustain: 1.0,
          release: 0.0,
          attackCurve: 'exponential',
        },
        // volume: Tone.gainToDb(2),
      }).chain(
        ...[
          //,
          new Tone.Gain(2),
          highpass,
          // new Tone.Gain(2),
          punchGain,
        ].filter((n) => n),
      );

      punch.triggerAttack(tone * pdf1);

      //punch.volume.rampTo(-Infinity, vRampTo);

      //punch.frequency.exponentialApproachValueAtTime(tone * pdf2, 0, pdt21);
      //punch.frequency.exponentialApproachValueAtTime(tone, `+${pdt21}`, pdt22);
      punch.volume.setValueCurveAtTime(volCurve(Tone.dbToGain(punch.volume.value), 230e-5), 0, decay);

      punch.frequency.setValueCurveAtTime(frqCurve(tone * pdf1, tone * pdf2, 0.9), 0, pdt21);
      punch.frequency.setValueCurveAtTime(frqCurve(tone * pdf2, tone, 0.9), pdt21, pdt22);

      const bdGain = new Tone.Gain();
      Tone.fanIn(
        ...[
          //
          sigGain,
          // subGain,
          // punchGain,
        ].filter((n) => n),
        new Tone.Gain().chain(
          ...[
            //,
            // new Tone.Gain(2.5),
            // new Tone.Limiter(-20),
            // new Tone.Gain(2),
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
      kickSampler.triggerAttack(KickNote, time, velocity);
      // kickSampler.triggerAttackRelease(KickNote, `8t`, time, velocity);
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
  const snareNote = 'C3';
  const setSnareBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const tone = 340;
      const tone2 = 189;
      const snappy = 0.3;
      const vRampTo = 3.0;

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

      const noiseGain = new Tone.Gain(snappy);
      const whiteNoise = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: 0.0,
          decay: 4.2,
          sustain: 1.0,
          release: 0.0,
        },
      }).chain(
        ...[
          //
          noiseHighpass,
          noiseLowpass,
          noiseGain,
        ].filter((n) => n),
      );

      whiteNoise.triggerAttack();

      whiteNoise.volume.rampTo(-Infinity, vRampTo);

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

      //whiteNoiseSynth.triggerAttack();
      sineSynth.triggerAttack(189);
      membraneSynth.triggerAttack(340);

      Tone.fanIn(
        ...[
          //
          noiseGain,
          //membraneVolume,
          //sineVolume,
        ].filter((n) => n),
        new Tone.Volume().chain(
          ...[
            //
            // snareHighpass,
            //snareComp,
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
      snareSampler.triggerAttack(snareNote, time, velocity);
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
      //snareSeq.start(time);
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
