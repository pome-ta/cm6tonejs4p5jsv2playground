// --- # example: 808 ?
import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 130;

const ftRand = (bias, spread = 1.0) => {
  const maxDist = Math.min(bias, 1.0 - bias) * spread;
  return bias + (Math.random() * 2 - 1) * maxDist;
};

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

const scParams = (levels, times, curve) => ({ levels, times, curve });

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
    ].filter((n) => n),
    kickVol,
  );
  const KickNote = 'A4';
  const setKickBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const decay = 30; //58; //30;
      const amp = 2; //1.55; //2;
      const tone = 56; //58; //56;
      const envParams = scParams([0.11, 1, 0], [0, decay], -225);
      const trienvParams = scParams([0.11, 0.6, 0], [0, decay], -230);
      const fenvParams = scParams([tone * 7, tone * 1.35, tone], [0.05, 0.6], -14);
      const pfenvParams = scParams([tone * 7, tone * 1.35, tone], [0.03, 0.6], -10);

      const sigGain = new Tone.Gain();
      const sig = new Tone.Oscillator({
        frequency: fenvParams.levels[0],
        // oscillator: { type: 'sine' },
        oscillator: { type: 'sine', phase: 270 },
      })
        .chain(
          ...[
            //,
          ].filter((n) => n),
          sigGain,
        )
        .start();

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
      const sub = new Tone.Oscillator({
        frequency: fenvParams.levels[0],
        oscillator: { type: 'triangle' },
      })
        .chain(
          ...[
            //,
            new Tone.Gain(0.05),
          ].filter((n) => n),
          subGain,
        )
        .start();

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
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const punchGain = new Tone.Gain();
      const punch = new Tone.Oscillator({
        frequency: pfenvParams.levels[0],
        // oscillator: { type: 'sine' },
        oscillator: { type: 'sine', phase: 270 },
      })
        .chain(
          ...[
            //,
            new Tone.Gain(2),
            highpass,
          ].filter((n) => n),
          punchGain,
        )
        .start();
      punch.volume.setValueCurveAtTime(volCurve(envParams.times[1], envParams.curve), 0, decay);

      punch.frequency.setValueCurveAtTime(
        frqCurve(pfenvParams.levels[0], pfenvParams.levels[1], pfenvParams.curve),
        0,
        pfenvParams.times[0],
      );
      punch.frequency.setValueCurveAtTime(
        frqCurve(pfenvParams.levels[1], pfenvParams.levels[2], pfenvParams.curve),
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
          ].filter((n) => n),
          bdGain,
        ),
      );
      Tone.fanIn(bdGain, Tone.getDestination());
    }, 10.5);

    smplr.add(KickNote, buffer);
  };

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
          ].filter((n) => n),
          noiseGain,
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
          ].filter((n) => n),
          osc1Gain,
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
          ].filter((n) => n),
          osc2Gain,
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
          ].filter((n) => n),
          sumGain,
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
          ].filter((n) => n),
          sigGain,
        ),
      );
      Tone.fanIn(sigGain, Tone.getDestination());
    }, 5.75);

    smplr.add(snareNote, buffer);
  };

  // --- rimshot
  const rimshotVol = new Tone.Volume();
  const rimshotSampler = new Tone.Sampler({
    attack: 0.0,
    release: '2i',
    curve: 'exponential',
  }).chain(
    ...[
      //
    ].filter((n) => n),
    rimshotVol,
  );
  const rimshotNote = 'A4';
  const setRimshotBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const amp = 1;

      const envParams = scParams([1, 1, 0], [0.00272, 0.07], -42);

      const tri1Gain = new Tone.Gain();
      const tri1 = new Tone.Oscillator({
        frequency: 1667 * 1.1,
        // oscillator: { type: 'triangle' },
        oscillator: { type: 'triangle', phase: 270 },
      })
        .chain(
          ...[
            //,
          ].filter((n) => n),
          tri1Gain,
        )
        .start();

      const tri2Gain = new Tone.Gain();
      const tri2 = new Tone.OmniOscillator({
        frequency: 455 * 1.1,
        type: 'pulse',
        width: 0.8,
      })
        .chain(
          ...[
            //,
            new Tone.AudioToGain(),
          ].filter((n) => n),
          tri2Gain,
        )
        .start();

      const punchGain = new Tone.Gain();
      const punch = new Tone.Noise({
        noise: { type: 'white' },
      })
        .chain(
          ...[
            //
            new Tone.Gain(0.46),
          ].filter((n) => n),
          punchGain,
        )
        .start();

      tri1.volume.setValueCurveAtTime(
        volCurve(envParams.levels[0], envParams.curve),
        envParams.times[0],
        envParams.times[1],
      );

      tri2.volume.setValueCurveAtTime(
        volCurve(envParams.levels[0], envParams.curve),
        envParams.times[0],
        envParams.times[1],
      );

      punch.volume.setValueCurveAtTime(
        volCurve(envParams.levels[0], envParams.curve),
        envParams.times[0],
        envParams.times[1],
      );

      const sigPeaking = new Tone.Filter({
        type: 'peaking',
        frequency: 464,
        Q: 0.44,
        rolloff: -12, // -12, -24, -48, -96
        gain: 8,
      });

      const sigHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 315,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const sigLowpass = new Tone.Filter({
        type: 'lowpass',
        frequency: 7300,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const sigGain = new Tone.Gain();
      Tone.fanIn(
        ...[
          //
          tri1Gain,
          tri2Gain,
          punchGain,
        ].filter((n) => n),
        new Tone.Gain().chain(
          ...[
            //
            sigPeaking,
            sigHighpass,
            sigLowpass,
            new Tone.Gain(amp),
            new Tone.Channel(),
          ].filter((n) => n),
          sigGain,
        ),
      );
      Tone.fanIn(sigGain, Tone.getDestination());
    }, 1.75);

    smplr.add(snareNote, buffer);
  };

  // --- hat
  const closeHatVol = new Tone.Volume();
  const closeHatSampler = new Tone.Sampler({
    attack: 0.0,
    // release: '2i',
    release: 0.0,
    curve: 'exponential',
  }).chain(
    ...[
      //
    ].filter((n) => n),
    closeHatVol,
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
          ].filter((n) => n),
          sighi,
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
          ].filter((n) => n),
          siglow,
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
        ].filter((n) => n),
        sigGain,
      );
      Tone.fanIn(sigGain, Tone.getDestination());
    }, 1.25);

    smplr.add(snareNote, buffer);
  };

  // --- openhihat
  const openHatVol = new Tone.Volume();
  const openHatSampler = new Tone.Sampler({
    attack: 0.0,
    // release: '2i',
    release: 0.0,
    curve: 'exponential',
  }).chain(
    ...[
      //
    ].filter((n) => n),
    openHatVol,
  );

  const openHatNote = 'A4';
  const setOpenHatBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const decay = 0.5;
      const amp = 4;
      const pan = 0;
      const env1Params = {
        attack: 0.1,
        release: decay,
        level: 1,
        curve: -13,
      };
      const env2Params = scParams([0, 1, 0], [0, decay * 5], -150);

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

      const sigLowshelf = new Tone.Filter({
        type: 'lowshelf',
        frequency: 990,
        rolloff: -12, // -12, -24, -48, -96
        gain: -3,
      });
      const sigBandpass = new Tone.Filter({
        type: 'bandpass',
        frequency: 7700,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      const sigPeaking = new Tone.Filter({
        type: 'peaking',
        frequency: 7200,
        Q: 0.5,
        rolloff: -12, // -12, -24, -48, -96
      });

      const sigHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 8100,
        Q: 0.7,
        rolloff: -48, // -12, -24, -48, -96
      });

      const sigHighshelf = new Tone.Filter({
        type: 'highshelf',
        frequency: 9400,
        Q: 1.7,
        rolloff: -12, // -12, -24, -48, -96
      });
      const sig = new Tone.Gain();
      const siga = new Tone.Volume();
      const sigb = new Tone.Volume();
      Tone.fanIn(
        ...[...frqs].map((frq) => LFPulse(frq)),
        new Tone.Gain().chain(
          ...[
            //
            sigLowshelf,
            sigBandpass,
            sigPeaking,
            sigHighpass,
            sigHighshelf,
          ].filter((n) => n),
          sig.fan(siga, sigb),
        ),
      );

      new Tone.Gain(0.6).chain(siga);
      siga.volume.setValueCurveAtTime(
        volCurve(env1Params.level, env1Params.curve),
        env1Params.attack,
        env1Params.release,
      );

      sigb.volume.setValueCurveAtTime(
        volCurve(env2Params.levels[1], env2Params.curve),
        env2Params.times[0],
        env2Params.times[1],
      );

      const sumLowpass = new Tone.Filter({
        type: 'lowpass',
        frequency: 4000,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const sumGain = new Tone.Gain();
      Tone.fanIn(
        siga,
        sigb,
        new Tone.Gain().chain(
          ...[
            //,
            sumLowpass,
            new Tone.Channel(),
            new Tone.Gain(amp),
            new Tone.Gain(2),
          ].filter((n) => n),
          sumGain,
        ),
      );
      Tone.fanIn(sumGain, Tone.getDestination());
    }, 1.75);

    smplr.add(snareNote, buffer);
  };

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    transport.scheduleOnce((time) => {
      kickSeq.start(time);
      snareSeq.start(time);
      rimshotSeq.start(time);
      hihatSeq.start(time);

      // }, transport.context.now());
    }, transport.seconds);
  });

  // --- seq
  const kickSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      kickSampler.triggerAttack(KickNote, time, ftRand(velocity));
      // kickSampler.triggerAttackRelease(KickNote, `8n.`, time, ftRand(velocity));
    },
    events: [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, [1, 0.225]],
    ],
    subdivision: '1n',
  });

  const snareSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      snareSampler.triggerAttack(snareNote, time, ftRand(velocity));
      // snareSampler.triggerAttack(`B4`, time, ftRand(velocity));
    },
    events: [
      [null, 1, null, 1],
      [null, 1, null, 1],
      [null, 1, null, 1],
      [null, [1, [null, 0.45]], null, 1],
    ],
    subdivision: '1n',
  });

  const rimshotSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      rimshotSampler.triggerAttack(rimshotNote, time, ftRand(velocity));
      // snareSampler.triggerAttack(`B4`, time, ftRand(velocity));
    },
    events: [
      [null, 1, null, 1],
      [null, 1, null, 1],
      [null, 1, null, 1],
      [null, [1, [null, 0.45]], null, 1],
    ],
    subdivision: '1n',
  });

  const hihatHandlers = new Map([
    [
      1, // close
      (time, velocity) => {
        openHatSampler?.triggerRelease();
        closeHatSampler.triggerAttack(closeHatNote, time, ftRand(velocity));
      },
    ],

    [
      -1, // open
      (time, velocity) => {
        closeHatSampler?.triggerRelease();
        openHatSampler.triggerAttack(openHatNote, time, ftRand(velocity));
      },
    ],
  ]);

  const hihatSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      hihatHandlers.get(Math.sign(velocity))?.(time, Math.abs(velocity));
    },
    events: [
      [null, 1, -1, 1, null, 1, -1, 1],
      [null, 1, -1, 1, null, 1, -1, [1, -1, null, 1]],
      [null, 1, -1, 1, null, 1, -1, 1],
      [null, 1, -1, [1, -1], [1, -1], 1, null, [-1, 1]],
    ],
    subdivision: '1n',
  });

  // --- drumKit
  const drumKitBusName = 'drums';

  const toChannel = (fromNode, channelOptions, busName = drumKitBusName) => {
    const channel = new Tone.Channel(channelOptions);
    fromNode.connect(channel);
    channel.send(busName);
    return channel;
  };

  const kickCh = toChannel(kickVol, { volume: 0.0, pan: 0.0, channelCount: 1 });
  const snareCh = toChannel(snareVol, {
    volume: 1.0,
    pan: -0.1,
    channelCount: 1,
  });
  const rimshotCh = toChannel(rimshotVol, {
    volume: 3.0,
    pan: -0.1,
    channelCount: 1,
  });
  const closeHatCh = toChannel(closeHatVol, {
    volume: 0.0,
    pan: 0.3,
    channelCount: 1,
  });
  const openHatCh = toChannel(openHatVol, {
    volume: 0.0,
    pan: 0.4,
    channelCount: 1,
  });

  const drumKitVol = new Tone.Volume();
  const drumKitCh = new Tone.Channel({ volume: 2, channelCount: 2 });
  //drumKitCh.receive(drumKitBusName);
  drumKitCh
    .chain(
      ...[
        //
      ].filter((n) => n),
      drumKitVol,
    )
    .receive(drumKitBusName);

  // ---  master mixer
  const masterVol = new Tone.Volume();
  const masterLimiter = new Tone.Limiter(-16);

  Tone.fanIn(
    ...[
      //
      drumKitVol,
    ].filter((n) => n),
    masterVol.chain(
      ...[
        //
        // new Tone.Gain(1.1),
        // masterLimiter,
        // new Tone.Gain(1.1),
      ].filter((n) => n),
      Tone.getDestination(),
    ),
  );

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
    await setRimshotBuffer(rimshotSampler);
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
