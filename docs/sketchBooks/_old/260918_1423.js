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
  Tone.setContext(ctx);
  /* Starting Audio */
  document.addEventListener('pointerup', async () => await Tone.start(), {
    once: true,
  });

  const transport = Tone.getTransport();
  transport.bpm.value = 135;

  const toTime = (t) => Tone.Time(t).toSeconds();

  const masterCh = new Tone.Channel().toDestination();
  const bus = new Tone.Emitter();

  const kick = 'kick',
    snare = 'snare',
    hihta = 'hihta';
  const drumKit = new Tone.Players();
  drumKit.fadeIn = '1i';
  drumKit.fadeOut = '4i';

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

  bus.on('startCall', () => {
    transport.start();
    transport.schedule((time) => {
      drumSeq.start();
      clickSeq.start();
    }, Tone.now()); // 前回説明したクオンタイズ記法
  });

  // --- mixer
  const drumCh = new Tone.Channel();
  const drumChainAry = [
    //
    drumCh,
  ];
  drumKit.chain(...drumChainAry.filter((n) => n));

  const clickCh = new Tone.Channel();
  clickSynth.chain(clickCh);

  drumCh.chain(masterCh);
  clickCh.chain(masterCh);

  p.setup = async () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

    const kickBuffer = await Tone.Offline(() => {
      const synth = new Tone.Synth({
        oscillator: { type: 'sine', phase: 270 },
        // oscillator: { type: 'sine', },
        // oscillator: { type: 'pulse', width: 0 },
        envelope: {
          attack: 0,
          decay: 1.5,
          sustain: 0.0,
          release: '1i',
          attackCurve: 'exponential',
        },
      });

      const outCh = new Tone.Channel(8).toDestination();
      const outChainAry = [
        //
        outCh,
      ];
      synth.chain(...outChainAry.filter((n) => n));

      synth.triggerAttackRelease('A3', '512i');
      synth.frequency.rampTo('A1', '24i');

    }, toTime('4n'));

    drumKit.add(kick, kickBuffer);

    //transport.start(0);
    //drumSeq.start();
    //clickSeq.start();
    bus.emit('startCall');

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
