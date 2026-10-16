// --- # example:
import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 130;

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

const frqCurve = (startfrequency, endfrequency, curveExponent = 0, divSteps = 128) => {
  const curve = expCurve(startfrequency, endfrequency, curveExponent, divSteps);

  return curve;
};

const volCurve = (startGain, curveExponent = 1, endGain = 0, divSteps = 256) => {
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

  // --- bd
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
      const decay = 2.0;
      const tone = 56;
      const gule = 1.35;
      const timeTone = [0.0, 0.05, 0.5];

      const comp = new Tone.Compressor({
        threshold: -28, // -100-0 : -24
        ratio: 18, // 1-20 : 12
        attack: 1.0,
        release: 4e-4,
        knee: 35, // 0-40 : 30
      });

      const ocsGain = new Tone.Gain();
      const osc = new Tone.OmniOscillator({
        frequency: 0,
        type: 'sine',
        phase: 270,
      })
        .chain(
          ...[
            //,
            comp,
            ocsGain,
          ],
        )
        .start();

      //osc.volume.rampTo(-Infinity, decay);
      osc.volume.setValueCurveAtTime(volCurve(1.08, -45), 0.0125, decay);

      osc.frequency.setValueCurveAtTime(frqCurve(tone * 7, tone * gule, -14), timeTone[0], timeTone[1]);
      osc.frequency.setValueCurveAtTime(frqCurve(tone * gule, tone, -14), timeTone[1], timeTone[2]);

      Tone.fanIn(ocsGain, Tone.getDestination());
    }, 2.25);

    smplr.add(KickNote, buffer);
  };

  const kickSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      kickSampler.triggerAttack(KickNote, time, velocity);
      // kickSampler.triggerAttackRelease(KickNote, `16n.`, time, velocity);
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
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      const noiseLowpass = new Tone.Filter({
        type: 'lowpass',
        frequency: 8850,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const noiseGain = new Tone.Gain();
      const whiteNoise = new Tone.Noise({
        noise: { type: 'white' },
      })
        .chain(
          ...[
            //
            noiseHighpass,
            noiseLowpass,
            new Tone.Gain(snappy),
            noiseGain,
          ].filter((n) => n),
        )
        .start();

      whiteNoise.volume.setValueCurveAtTime(
        volCurve(noiseEnvParams.level, noiseEnvParams.curve),
        noiseEnvParams.attack,
        noiseEnvParams.release,
      );

      const osc1Gain = new Tone.Gain();
      const osc1 = new Tone.Oscillator({
        frequency: tone2,
        // oscillator: { type: 'sine' },
        oscillator: { type: 'sine', phase: 270 },
      })
        .chain(
          ...[
            //,
            new Tone.Gain(0.6),
            osc1Gain,
          ].filter((n) => n),
        )
        .start();

      const osc2Gain = new Tone.Gain();
      const osc2 = new Tone.Oscillator({
        frequency: tone,
        // oscillator: { type: 'sine' },
        oscillator: { type: 'sine', phase: 270 },
      })
        .chain(
          ...[
            //,
            new Tone.Gain(0.7),
            osc2Gain,
          ].filter((n) => n),
        )
        .start();

      osc1.volume.setValueCurveAtTime(volCurve(atkEnvParams.level, atkEnvParams.curve), 0, atkEnvParams.release);
      osc2.volume.setValueCurveAtTime(volCurve(atkEnvParams.level, atkEnvParams.curve), 0, atkEnvParams.release);

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
            new Tone.Gain(amp2),
            sumGain,
          ].filter((n) => n),
        ),
      );
      const sigHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 340,
        Q: 0.0,
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
      // snareSampler.triggerAttack(`B4`, time, velocity);
      // snareSampler.triggerAttackRelease(snareNote, '16t', time, velocity);
    },
    events: [[null, 1]],
    subdivision: '2n',
  });

  // ---  master mixer
  const masterVol = new Tone.Volume();
  const fanInNodes = [
    //
    kickVol,
    snareVol,
  ];
  // kickVol.set({ volume: Tone.gainToDb(5.7) });
  // masterVol.volume.value = Tone.gainToDb(0.9);

  const masterLimiter = new Tone.Limiter(-2);

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
      kickSeq.start(time);
      // snareSeq.start(time);
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
