// --- # example: kick `Tone.MembraneSynth`

import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const sketch = (p) => {
  // --- Plugins
  const tapIndicator = new TapIndicator(p);
  const spectrumAnalyzer = new SpectrumAnalyzer(p, 2048);

  // --- Tone.js
  const ctx = p.getAudioContext();
  Tone.setContext(ctx);
  const BPM = Tone.getTransport().bpm;

  let master;
  let synth;

  // --- Sketch
  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  let signalBtn;
  const signalStr = {
    hold: '◉',
    idle: '◎',
  };

  p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);
    domSetup();

    BPM.value = 180;

    synth = new Tone.MembraneSynth({
      pitchDecay: 0.5,
      octaves: 0.5,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.4,
        sustain: 0.05,
        release: 0.04,
        attackCurve: 'exponential',
      },
    });

    const channelA = new Tone.Channel({ channelCount: 1 });

    synth.connect(channelA);

    master = new Tone.Channel({ channelCount: 2 }).toDestination();
    //master.volume.rampTo(10, 0);
    channelA.connect(master);

    tapIndicator.setup();
    spectrumAnalyzer.targetNodes(master);

    //p.noLoop();
  };

  p.draw = () => {
    // put drawing code here
    p.background(80);
    //p.rect(0, 0, w / 2, h / 2);
    spectrumAnalyzer.drawGraph();
  };

  p.windowResized = (e) => {
    console.log('windowResized');
    w = p.windowWidth;
    h = p.windowHeight;
    cnvs = p.resizeCanvas(w, h);
    domLayout();
  };

  const domSetup = () => {
    signalBtn = p.createButton(signalStr.idle);
    signalBtn
      // .style('font-family', 'monospace')
      .style('font-size', '2rem')
      .style('width', '4rem')
      .style('height', '4rem')
      .style('border-radius', '50%')
      .style('-webkit-touch-callout', 'none')
      .style('-webkit-user-select', 'none')
      .style('user-select', 'none')
      .style('touch-action', 'none');

    const signalLiteral = {
      pointerdown: (btn) => {
        btn.html(signalStr.hold);
        synth.triggerAttack('A4');
      },
      pointerup: (btn) => {
        btn.html(signalStr.idle);
        synth.triggerRelease();
      },
    };

    const signalEvent = (e) => {
      signalLiteral[e.type](signalBtn);
    };
    signalBtn.mousePressed(signalEvent);
    signalBtn.mouseReleased(signalEvent);

    domLayout();
  };

  const domLayout = () => {
    // console.log('layout');
    const cw = signalBtn.size().width;
    const ch = signalBtn.size().height;
    const x = w / 2 - cw / 2;
    const y = h / 2 - ch / 2;
    signalBtn.position(x, y / 2 + y);
  };
};

new p5(sketch);
