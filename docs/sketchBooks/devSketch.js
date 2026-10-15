// --- # example:
import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 110;

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
      const tone = 56;

      const noiseLowpass = new Tone.Filter({
        type: 'lowpass',
        frequency: 800,
        Q: 1.0,
        rolloff: -96, // -12, -24, -48, -96
      });
      const ocsGain = new Tone.Gain();
      const osc = new Tone.OmniOscillator({
        frequency: 0,
        type: 'sine',
        // type: 'triangle',
        phase: 270,
        // type: 'pulse',
        // width: 0,
      })
        .chain(
          ...[
            //,
            // noiseLowpass,
            ocsGain,
          ],
        )
        .start();

      osc.volume.rampTo(Tone.gainToDb(0.0), 2.25);

      osc.frequency.setValueCurveAtTime(frqCurve(tone*7, tone * 1.35, -14), 0, 0.05);
      osc.frequency.setValueCurveAtTime(frqCurve(tone * 1.35,tone, -14), 0.0, 0.6);


      Tone.fanIn(ocsGain, Tone.getDestination());
    }, 2.5);
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

  // --- hat
  const closeHatVol = new Tone.Volume();
  const closeHatSampler = new Tone.Sampler({
    attack: 0.0,
    release: '2i',
    curve: 'exponential',
  }).chain(
    ...[
      //
      closeHatVol,
    ].filter((n) => n),
  );

  const closeHatNote = 'A4';
  const setCloseHatBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const decay = 0.42;
      const amp = 1;
      const pan = 0;

      const frqs = [203.52, 366.31, 301.77, 518.19, 811.16, 538.75];
      const LFPulse = (frq) => {
        const osc = new Tone.AudioToGain();
        new Tone.PulseOscillator(frq, 0).connect(osc).start();
        return osc;
      };

      const sighi = new Tone.Gain();
      const sighiBandpass = new Tone.Filter({
        type: 'bandpass',
        frequency: 8900,
        Q: 1.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      const sighiHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 9000,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      Tone.fanIn(
        ...[...frqs].map((frq) => LFPulse(frq)),
        new Tone.Gain().chain(
          ...[
            //
            sighiBandpass,
            sighiHighpass,
            sighi,
          ].filter((n) => n),
        ),
      );

      const siglow = new Tone.Gain();
      const siglowBandpass = new Tone.Filter({
        type: 'bandpass',
        frequency: 8900,
        Q: 0.8,
        rolloff: -12, // -12, -24, -48, -96
      });
      const siglowHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 9000,
        Q: 0.3,
        rolloff: -12, // -12, -24, -48, -96
      });
      Tone.fanIn(
        ...[...frqs].map((frq) => LFPulse(frq)),
        new Tone.Gain().chain(
          ...[
            //
            siglowBandpass,
            siglowHighpass,
            siglow,
          ].filter((n) => n),
        ),
      );

      const sig = new Tone.Volume();
      sig.volume.setValueCurveAtTime(volCurve(1, -30), 0, decay);
      Tone.fanIn(
        ...[
          //
          sighi,
          siglow,
        ].filter((n) => n),
        sig,
      );

      const sigPeaking = new Tone.Filter({
        type: 'peaking',
        frequency: 9700,
        Q: 1.7,
        rolloff: -12, // -12, -24, -48, -96
      });

      const sigGain = new Tone.Gain();
      sig.chain(
        ...[
          //,
          sigPeaking,
          new Tone.Gain(amp),
          new Tone.Channel(),
          sigGain,
        ].filter((n) => n),
      );

      Tone.fanIn(sigGain, Tone.getDestination());
    }, 5.75);
    smplr.add(snareNote, buffer);
  };

  const closeHatSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      closeHatSampler.triggerAttack(closeHatNote, time, velocity);
      // snareSampler.triggerAttackRelease(snareNote, '16t', time, velocity);
    },
    events: [[null, 1]],
    subdivision: '4n',
  });

  // --- openhihat
  const openHatVol = new Tone.Volume();
  const openHatSampler = new Tone.Sampler({
    attack: 0.0,
    release: '2i',
    curve: 'exponential',
  }).chain(
    ...[
      //
      openHatVol,
    ].filter((n) => n),
  );

  const openHatNote = 'A4';
  const setOpenHatBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const decay = 0.5;
      const amp = 4;
      const pan = 0;

      /*
SynthDef.new(\openhihat, {
	arg decay=0.5, amp=4, pan=0;
	var sig, siga, sigb, env1, env2, osc1, osc2, osc3, osc4, osc5, osc6, sum;
	env1 = EnvGen.kr(Env.perc(0.1, decay, curve:-3), doneAction:2);
	env2 = EnvGen.kr(Env.new([0, 1, 0], [0, decay*5], curve:-150), doneAction:0);
	osc1 = LFPulse.ar(203.52) * 0.6;
	osc2 = LFPulse.ar(366.31) * 0.6;
	osc3 = LFPulse.ar(301.77) * 0.6;
	osc4 = LFPulse.ar(518.19) * 0.6;
	osc5 = LFPulse.ar(811.16) * 0.6;
	osc6 = LFPulse.ar(538.75) * 0.6;
	sig = osc1 + osc2 + osc3 + osc4 + osc5 +osc6;
	sig = BLowShelf.ar(sig, 990, 2, -3);
	sig = BPF.ar(sig, 7700);
	sig = BPeakEQ.ar(sig, 7200, 0.5, 5);
	sig = BHiPass4.ar(sig, 8100, 0.7);
	sig = BHiShelf.ar(sig, 9400, 1, 5);
	siga = sig * env1 * 0.6;
	sigb = sig * env2;
	sum = siga + sigb;
	sum = LPF.ar(sum, 4000);
	sum = Pan2.ar(sum, 0);
	sum = sum * amp * 2;
	Out.ar(0, sum);
}).add;
*/

      const frqs = [203.52, 366.31, 301.77, 518.19, 811.16, 538.75];
      const LFPulse = (frq) => {
        const osc = new Tone.AudioToGain();

        new Tone.PulseOscillator({
          frequency: frq,
          width: 0,
          volume: Tone.gainToDb(0.6),
        })
          .connect(osc)
          .start();
        return osc;
      };

      const sighi = new Tone.Gain();
      const sighiBandpass = new Tone.Filter({
        type: 'bandpass',
        frequency: 8900,
        Q: 1.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      const sighiHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 9000,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      Tone.fanIn(
        ...[...frqs].map((frq) => LFPulse(frq)),
        new Tone.Gain().chain(
          ...[
            //
            sighiBandpass,
            sighiHighpass,
            sighi,
          ].filter((n) => n),
        ),
      );

      const siglow = new Tone.Gain();
      const siglowBandpass = new Tone.Filter({
        type: 'bandpass',
        frequency: 8900,
        Q: 0.8,
        rolloff: -12, // -12, -24, -48, -96
      });
      const siglowHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 9000,
        Q: 0.3,
        rolloff: -12, // -12, -24, -48, -96
      });
      Tone.fanIn(
        ...[...frqs].map((frq) => LFPulse(frq)),
        new Tone.Gain().chain(
          ...[
            //
            siglowBandpass,
            siglowHighpass,
            siglow,
          ].filter((n) => n),
        ),
      );

      const sig = new Tone.Volume();
      sig.volume.setValueCurveAtTime(volCurve(1, -30), 0, decay);
      Tone.fanIn(
        ...[
          //
          sighi,
          siglow,
        ].filter((n) => n),
        sig,
      );

      const sigPeaking = new Tone.Filter({
        type: 'peaking',
        frequency: 9700,
        Q: 1.7,
        rolloff: -12, // -12, -24, -48, -96
      });

      const sigGain = new Tone.Gain();
      sig.chain(
        ...[
          //,
          sigPeaking,
          new Tone.Gain(amp),
          new Tone.Channel(),
          sigGain,
        ].filter((n) => n),
      );

      Tone.fanIn(sigGain, Tone.getDestination());
    }, 5.75);
    smplr.add(snareNote, buffer);
  };

  const openHatSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      openHatSampler.triggerAttack(openHatNote, time, velocity);
      // snareSampler.triggerAttackRelease(snareNote, '16t', time, velocity);
    },
    events: [[1, null]],
    subdivision: '4n',
  });

  // ---  master mixer
  const masterVol = new Tone.Volume();
  const fanInNodes = [
    //
    clickVol,
    kickVol,
    snareVol,
    closeHatVol,
    openHatVol,
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
      // clickSeq.start(time);
      kickSeq.start(time);
      snareSeq.start(time);
      //closeHatSeq.start(time);
      //openHatSeq.start(time);
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
    await setCloseHatBuffer(closeHatSampler);
    await setOpenHatBuffer(openHatSampler);

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
