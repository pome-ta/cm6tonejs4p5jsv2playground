// --- # example:

import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const sketch = (p) => {
  // --- Sketch
  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  // --- Plugins
  const tapIndicator = new TapIndicator(p);
  const spectrumAnalyzer = new SpectrumAnalyzer(p, 2048);

  // --- Tone.js
  const ctx = p.getAudioContext();
  Tone.setContext(ctx, true);
  /* Starting Audio */
  document.addEventListener('pointerup', async () => await Tone.start(), {
    once: true,
  });

  const transport = Tone.getTransport();
  transport.bpm.value = 125;

  const toTime = (t) => new Tone.TimeClass(transport.context, t).toSeconds();

  const masterCh = new Tone.Channel().toDestination();
  const emitter = new Tone.Emitter();

  const kick = 'kick',
    crap = 'crap',
    snare = 'snare',
    hihta = 'hihta';
  const drumKit = new Tone.Players();
  drumKit.fadeIn = '1i';
  drumKit.fadeOut = '2i';

  const drumSeq = new Tone.Sequence({
    callback: (time, nameTrigger) => {
      Object.values(nameTrigger).forEach((trigger) => {
        drumKit.player(trigger).start(time);
      });
    },
    events: [
      // prettier-ignore
      [  // 
        { kick }, { kick, crap }, { kick }, { kick, crap },
      ],
      // prettier-ignore
      [  // 
        { kick }, { kick, crap }, { kick }, { kick, crap },
      ],
      // prettier-ignore
      [  // 
        { kick }, { kick, crap }, { kick }, { kick, crap },
      ],
      // prettier-ignore
      [
        { kick }, { kick, crap }, { kick }, [{ kick, crap }, { kick }],
      ],
    ],
    subdivision: '1n',
    // humanize: 0.001,
  });

  // メトロノーム
  const clickSynth = new Tone.MembraneSynth();
  const clickSeq = new Tone.Sequence({
    callback: (time, note) => {
      clickSynth.triggerAttackRelease(note, '1i', time);
    },
    events: ['A5', 'A4', 'A4', 'A4'],
    subdivision: '4n',
  });

  emitter.once('startCall', (nowTime) => {
    transport.start(nowTime);
    transport.scheduleOnce((time) => {
      drumSeq.start(time);
      //clickSeq.start(time);
    }, 0);
  });

  // --- mixer
  const drumCh = new Tone.Channel();
  const drumChainAry = [
    //
    drumCh,
  ];
  drumKit.chain(...drumChainAry.filter((n) => n));

  const clickCh = new Tone.Channel(-4);
  clickSynth.chain(clickCh);

  const fanInNodes = [
    //
    drumCh,
    clickCh,
  ];
  Tone.fanIn(...fanInNodes.filter((n) => n), masterCh);

  p.setup = async () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

    const kickBuffer = await Tone.Offline((context) => {
      context.transport.bpm.value = transport.bpm.value;
      const synth = new Tone.Synth({
        oscillator: { type: 'sine', phase: 270 },
        // oscillator: { type: 'sine', },
        //oscillator: { type: 'pulse', width: 0 },
        envelope: {
          attack: 0,
          decay: 2.75,
          sustain: 0.0,
          release: '1i',
          attackCurve: 'exponential',
        },
      });
      const channel = new Tone.Channel(12).toDestination();

      Tone.fanIn(synth, channel);

      synth.triggerAttackRelease('A3', 0.475);
      synth.frequency.rampTo('C2', 0.185);
    }, 1.5);

    const crapBuffer = await Tone.Offline((context) => {
      context.transport.bpm.value = transport.bpm.value;

      const whiteNoise = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: 0.0,
          decay: 0.75,
          sustain: 0.0,
          release: 0.0,
        },
      });
      const bitCrusher = new Tone.BitCrusher(16);

      const chebyshev = new Tone.Chebyshev({
        order: 33,
        oversample: 'none',
      });

      const bandpass = new Tone.Filter({
        type: 'bandpass',
        frequency: 1100,
        Q: 3.4,
        rolloff: -12, // -12, -24, -48, -96
        gain: 64,
      });

      const channel = new Tone.Channel(36).toDestination();
      whiteNoise.chain(
        ...[
          bitCrusher,
          chebyshev,
          bandpass,
          // bitCrusher,
          //,
          channel,
        ].filter((n) => n),
      );

      whiteNoise.triggerAttack();
    }, 1.5);

    drumKit.add(kick, kickBuffer);
    drumKit.add(crap, crapBuffer);
    // drumKit.player(kick).mute = true;

    emitter.emit('startCall', transport.context.now());

    tapIndicator.setup();
    spectrumAnalyzer.targetNodes(masterCh);

    // p.noLoop();
    // p.frameRate(1);
  };

  p.draw = () => {
    // put drawing code here
    p.background(80);
    spectrumAnalyzer.drawGraph();
  };

  p.windowResized = (e) => {
    console.log('windowResized');
    w = p.windowWidth;
    h = p.windowHeight;
    cnvs = p.resizeCanvas(w, h);
  };
};

new p5(sketch);
