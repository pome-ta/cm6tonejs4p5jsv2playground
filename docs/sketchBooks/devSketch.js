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
  const setKickBuffer = async (smplr) => {
    const buffer = await Tone.Offline(() => {
      const tone = 56;
      const pdf1 = 7.0;
      const pdf2 = 1.35;
      const pdt11 = 0.05;
      const pdt12 = 0.6;
      const pdt21 = 0.03;
      const pdt22 = 0.6;

      const sig = new Tone.Synth({
        //oscillator: { type: 'sine', phase: 270 },
        oscillator: { type: 'sine' },
        envelope: {
          attack: 6e-4,
          decay: 30.0,
          sustain: 1.0,
          release: 0.0,
        },
      });
      sig.triggerAttack(tone * pdf1);

      sig.volume.setTargetAtTime(-Infinity, 0.0, 6e-2);

      sig.frequency.rampTo(tone * pdf2, pdt11, 0);
      sig.frequency.rampTo(tone, pdt12, `+${pdt11}`);
      // sig.frequency.exponentialRampTo(tone * 1.35, 0.5);
      // sig.frequency.linearRampTo(tone * 1.35, 0.5);
      // sig.frequency.exponentialApproachValueAtTime(tone * 1.35, 0, 0.05);

      const sub = new Tone.Synth({
        //oscillator: { type: 'sine', phase: 270 },
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 6e-4,
          // attack: 0.0,
          decay: 30.0,
          sustain: 0.6,
          release: 0.0,
          attackCurve: 'exponential',
        },
      });

      sub.triggerAttack(tone * pdf1);

      sub.volume.setTargetAtTime(-Infinity, 0.0, 5e-2);
      sub.frequency.rampTo(tone * pdf2, pdt11, 0);
      sub.frequency.rampTo(tone, pdt12, `+${pdt11}`);

      const punch = new Tone.Synth({
        //oscillator: { type: 'sine', phase: 270 },
        oscillator: { type: 'sine' },
        envelope: {
          attack: 6e-4,
          decay: 30.0,
          sustain: 1.0,
          release: 0.0,
        },
      });
      punch.triggerAttack(tone * pdf1);

      punch.volume.setTargetAtTime(-Infinity, 0.0, 6e-2);

      punch.frequency.rampTo(tone * pdf2, pdt21, 0);
      punch.frequency.rampTo(tone, pdt22, `+${pdt21}`);

      const highpass = new Tone.Filter({
        type: 'highpass',
        frequency: 350,
        Q: 1.0,
        rolloff: -12, // -12, -24, -48, -96
      });

      const sigVol = new Tone.Volume();
      sig.chain(
        ...[
          //,
          sigVol,
        ].filter((n) => n),
      );

      const subVol = new Tone.Volume();
      subVol.volume.value = Tone.gainToDb(Tone.dbToGain(subVol.volume.value) * 0.05);
      sub.chain(
        ...[
          //,
          subVol,
        ].filter((n) => n),
      );

      const punchVol = new Tone.Volume();
      punchVol.volume.value = Tone.gainToDb(Tone.dbToGain(punchVol.volume.value) * 2.0);
      punch.chain(
        ...[
          //,
          highpass,
          punchVol,
        ].filter((n) => n),
      );
      


      /*
      const bdVol = new Tone.Volume();
      .fan(

          ...[
            //
            sigVol,
            subVol,
            punchVol,
            // new Tone.Limiter(-12),
          ].filter((n) => n),
          //bdVol,

      );
      */
      /*
      bdVol = new Tone.Volume().chain(
        ...[
          //,
          // new Tone.Limiter(-12),
        ].filter((n) => n),
      );
      */
      /*
      Tone.fanIn(
        new Tone.Volume().chain(
          ...[
            //
            sigVol,
            subVol,
            punchVol,
          ].filter((n) => n),
        ),
        Tone.getDestination()
      );
*/
      Tone.fanIn(sigVol, Tone.getDestination());
    }, 10.5);
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
