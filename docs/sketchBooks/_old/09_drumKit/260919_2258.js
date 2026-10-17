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
        { kick }, { kick }, { kick }, { kick },
      ],
      // prettier-ignore
      [  // 
        { kick }, { kick }, { kick }, { kick },
      ],
      // prettier-ignore
      [  // 
        { kick }, { kick }, { kick }, { kick },
      ],
      // prettier-ignore
      [
        { kick }, { kick }, { kick }, [{ kick }, { kick }],
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
        // oscillator: { type: 'sine', phase: 270 },
        // oscillator: { type: 'sine', },
        oscillator: { type: 'pulse', width: 0 },
        envelope: {
          attack: 0,
          decay: 2.75,
          sustain: 0.0,
          release: '1i',
          attackCurve: 'exponential',
        },
      });

      const lowpassFilter = new Tone.Filter({
        type: 'lowpass',
        frequency: 0,
        Q: 2.2,
        rolloff: -12, // -12, -24, -48, -96
        gain: 2,
      });

      const fltrFrq = new Tone.FrequencyEnvelope({
        envelope: {
          attack: 0,
          decay: 0.775,
          sustain: 0.0,
          release: 0.775,
        },
        baseFrequency: 120, // 下限
        octaves: 4.75, // 上限 = baseFrequency * 2^octaves
        // releaseCurve: 'linear',
      });
      fltrFrq.connect(lowpassFilter.frequency);

      const outCh = new Tone.Channel(8).toDestination();
      const outChainAry = [
        //
        lowpassFilter,
        outCh,
      ];

      synth.chain(...outChainAry.filter((n) => n));

      synth.triggerAttackRelease('A2', 0.275);
      fltrFrq.triggerAttack();
      synth.frequency.rampTo('A0', 0.0825);
    }, 2.5);

    drumKit.add(kick, kickBuffer);

    //transport.start(0);
    //drumSeq.start();
    //clickSeq.start();
    //bus.emit('startCall', transport.start());
    //emitter.emit('startCall', Tone.now());
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
