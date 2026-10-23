// --- # example: 808 ?
import * as Tone from 'tone';
import { Bd, Sn, CpRaw, CpReverb, Hat, Openhihat } from 'modules/tr808scWorklet/drumKit.js';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const BPM = 110;

const ftRand = (bias, spread = 1.0) => {
  const maxDist = Math.min(bias, 1.0 - bias) * spread;
  return bias + (Math.random() * 2 - 1) * maxDist;
};

const sketch = (p) => {
  // --- Sketch
  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  // --- Plugins
  const tapIndicator = new TapIndicator(p);
  const spectrumAnalyzer = new SpectrumAnalyzer(p, 2048);

  // --- Tone.js
  const p5Ctx = p.getAudioContext();
  Tone.setContext(p5Ctx, true);
  const toneCtx = Tone.getContext();
  /* Starting Audio */
  document.addEventListener('pointerup', async () => await Tone.start(), {
    once: true,
  });
  const transport = Tone.getTransport();
  transport.bpm.value = BPM;

  const emitter = new Tone.Emitter();

  // --- bd
  const kickVol = new Tone.Volume();
  const kickGen = new Bd({
    /*decay: 58, amp: 1.45, tone: 50, */
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    kickVol,
  );

  // --- snare
  const snareVol = new Tone.Volume();
  const snareGen = new Sn({
    /*
    amp: 1.12,
    tone: 300.9,
    tone2: 167.265,
    snappy: 0.226,
    amp2: 0.775,
    */
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    snareVol,
  );

  // --- cpRaw
  const cpRawVol = new Tone.Volume();
  const cpRawGen = new CpRaw({
    /*
    amp: 1.12,
    */
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    cpRawVol,
  );

  // --- cpReverb
  const cpReverbVol = new Tone.Volume();
  const cpReverbGen = new CpReverb({
    /*
    amp: 1.12,
    */
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    cpReverbVol,
  );

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

    smplr.add(rimshotNote, buffer);
  };

  // --- claves
  const clavesVol = new Tone.Volume();
  const clavesSampler = new Tone.Sampler({
    attack: 0.0,
    // release: '2i',
    release: 0.0,
    curve: 'exponential',
  }).chain(
    ...[
      //
    ].filter((n) => n),
    clavesVol,
  );

  const clavesNote = 'A4';
  const setClavesBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const amp = 1;

      const envParams = scParams([1, 1, 0], [0, 0.1], -20);
      const sigGain = new Tone.Gain();
      const sig = new Tone.Oscillator({
        frequency: 2500,
        oscillator: { type: 'sine' },
        // oscillator: { type: 'sine', phase: 270 },
      })
        .chain(
          ...[
            //,
            new Tone.Gain(amp),
            new Tone.Channel(),
          ].filter((n) => n),
          sigGain,
        )
        .start();
      sig.volume.setValueCurveAtTime(volCurve(envParams.levels[1], envParams.curve), 0, envParams.times[1]);

      Tone.fanIn(sigGain, Tone.getDestination());
    }, 1.125);

    smplr.add(clavesNote, buffer);
  };

  // --- maracas
  const maracasVol = new Tone.Volume();
  const maracasSampler = new Tone.Sampler({
    attack: 0.0,
    // release: '2i',
    release: 0.0,
    curve: 'exponential',
  }).chain(
    ...[
      //
    ].filter((n) => n),
    maracasVol,
  );

  const maracasNote = 'A4';
  const setMaracasBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const amp = 1;
      const gate = 0;

      const envParams = scParams([0.3, 1, 0], [0.027, 0.07], -250);

      const sigHighpass = new Tone.Filter({
        type: 'highpass',
        frequency: 5500,
        Q: 0.0,
        rolloff: -12, // -12, -24, -48, -96
      });
      const sigGain = new Tone.Gain();
      const sig = new Tone.Noise({
        noise: { type: 'white' },
      })
        .chain(
          ...[
            //
            new Tone.Gain(amp),
            sigHighpass,
            new Tone.Channel(),
          ].filter((n) => n),
          sigGain,
        )
        .start();
      sig.volume.setValueCurveAtTime(
        volCurve(envParams.levels[0], envParams.curve, envParams.levels[1]),
        0,
        envParams.times[0],
      );
      sig.volume.setValueCurveAtTime(
        volCurve(envParams.levels[1], envParams.curve),
        envParams.times[0],
        envParams.times[1],
      );

      Tone.fanIn(sigGain, Tone.getDestination());
    }, 1.125);

    smplr.add(maracasNote, buffer);
  };
  // --- hat
  const closeHatVol = new Tone.Volume();
  const closeHatGen = new Hat({
    /*
    decay: 0.42,
    amp: 1.025,
    */
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    closeHatVol,
  );

  // --- openhihat
  const openHatVol = new Tone.Volume();
  const openHatGen = new Openhihat({
    /*
    decay: 0.42,
    amp: 1.025,
    */
    context: toneCtx,
  }).chain(
    ...[
      //
    ].filter((n) => n),
    openHatVol,
  );

  // --- seq
  const kickSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      kickGen.triggerAttack(time, ftRand(velocity));
      // kickGen.triggerAttackRelease(`8t.`, time, ftRand(velocity));
    },
    events: [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, [1, 0.6]],
    ],
    subdivision: '1n',
  });

  const snareSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      snareGen.triggerAttack(time, ftRand(velocity));
      // snareSampler.triggerAttack(`B4`, time, ftRand(velocity));
    },
    events: [
      [null, 1, null, 1],
      // [null, [1, [null, 0.45]], null, 1],
    ],
    subdivision: '1n',
  });
  const cpRawSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      cpRawGen.triggerAttack(time, ftRand(velocity));
    },
    events: [null, [null, [null, null, 1, null], [null, 1, null, null], null]],
    subdivision: '1n',
  });

  const cpReverbSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      cpReverbGen.triggerAttack(time, ftRand(velocity));
    },
    events: [1, [1, [1, null, 1, null], null, null]],
    subdivision: '1n',
  });
  const rimshotSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      rimshotSampler.triggerAttack(rimshotNote, time, ftRand(velocity));
      // snareSampler.triggerAttack(`B4`, time, ftRand(velocity));
    },
    events: [[null, [1, [null, 0.55]], null, 1]],
    subdivision: '1n',
  });

  const clavesSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      clavesSampler.triggerAttack(clavesNote, time, ftRand(velocity));
      // snareSampler.triggerAttack(`B4`, time, ftRand(velocity));
    },
    events: [
      [
        [null, 1, 1, null],
        [1, [null, 1], null, 1],
      ],
    ],
    subdivision: '1n',
  });

  const maracasSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      maracasSampler.triggerAttack(maracasNote, time, ftRand(velocity));
      // snareSampler.triggerAttack(`B4`, time, ftRand(velocity));
    },
    events: [[[[null, null, 1, 1], null, [null, null, 1, 1], null]]],
    subdivision: '1n',
    humanize: 0.006,
  });

  const hihatHandlers = new Map([
    [
      1, // close
      (time, velocity) => {
        openHatGen?.triggerRelease(time);
        closeHatGen.triggerAttack(time, ftRand(velocity));
      },
    ],

    [
      -1, // open
      (time, velocity) => {
        closeHatGen?.triggerRelease(time);
        openHatGen.triggerAttack(time, ftRand(velocity));
      },
    ],
  ]);

  const hihatSeq = new Tone.Sequence({
    callback: (time, velocity) => {
      hihatHandlers.get(Math.sign(velocity))?.(time, Math.abs(velocity));
    },
    events: [
      [null, 1, -1, 1, null, 1, -1, 1],
      [null, 1, -1, 1, null, 1, -1, 1],
      [null, 1, -1, 1, null, 1, -1, 1],
      [null, 1, -1, [1, -1], [1, -1], 1, null, [-1, 1]],
    ],
    subdivision: '1n',
    humanize: 0.006,
  });

  // --- emitter
  emitter.once('startOnceCallSeqs', () => {
    kickSeq.start(0);
    // snareSeq.start(0);

    cpRawSeq.start(0);
    cpReverbSeq.start(0);
    // rimshotSeq.start(0);
    // clavesSeq.start(0);
    // maracasSeq.start(0);
    hihatSeq.start(0);
    transport.start();
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
    volume: 2.0,
    pan: -0.1,
    channelCount: 1,
  });
  const cpRawCh = toChannel(cpRawVol, {
    volume: 2.0,
    pan: 0.0,
    channelCount: 1,
  });
  const cpReverbCh = toChannel(cpReverbVol, {
    volume: 3.0, // 30 とかでやっと
    pan: 0.0,
    channelCount: 1,
  });
  const rimshotCh = toChannel(rimshotVol, {
    volume: 3.0,
    pan: -0.1,
    channelCount: 1,
  });
  const clavesCh = toChannel(clavesVol, {
    volume: 12.0,
    pan: 0.0,
    channelCount: 1,
  });

  const maracasCh = toChannel(maracasVol, {
    volume: 1.0,
    pan: 0.0,
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
  drumKitCh
    .chain(
      ...[
        //
        // new Tone.Gain(1.55),
        // new Tone.Limiter(-2),
        // new Tone.Gain(1.1),
      ].filter((n) => n),
      drumKitVol,
    )
    .receive(drumKitBusName);

  // ---  master mixer
  const masterVol = new Tone.Volume();
  const masterLimiter = new Tone.Limiter(-8);

  Tone.fanIn(
    ...[
      //
      drumKitVol,
    ].filter((n) => n),
    masterVol.chain(
      ...[
        //
        // new Tone.Gain(2.1),
        // masterLimiter,
        // new Tone.Gain(1.1),
      ].filter((n) => n),
      Tone.getDestination(),
    ),
  );

  p.setup = async () => {
    //p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

    emitter.emit('startOnceCallSeqs');
    //transport.start();

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
