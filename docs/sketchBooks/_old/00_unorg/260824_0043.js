// --- # example: channel

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

  let master;
  let tracks = [];
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

    synth = new Tone.Synth({ oscillator: { type: 'sine' } });
    //synth = new Tone.Synth();
    //const channelA = new Tone.Channel({ channelCount: 1 });
    const channelA = new Tone.Channel();
    synth.connect(channelA);

    const osc = new Tone.Oscillator();
    osc.frequency.value = 'B4';
    osc.start();

    //const channelB = new Tone.Channel({ channelCount: 1 });
    const channelB = new Tone.Channel();
    osc.connect(channelB);

    // const channelC = new Tone.Channel({ channelCount: 1 });
    // channelB.connect(channelC);

    const osc2 = new Tone.Oscillator();
    osc2.frequency.value = 'D3';
    osc2.start();

    const channelD = new Tone.Channel();
    osc2.connect(channelD);

    const channelE = new Tone.Channel();
    //channelD.connect(channelE);
    console.log(osc2);

    master = new Tone.Channel(); //.toDestination();
    //master.volume.rampTo(10, 0);
    channelA.connect(master);
    channelB.connect(master);
    // channelC.connect(master);
    // channelD.connect(master);
    //channelE.connect(master);

    // master.toDestination();

    tapIndicator.setup();
    spectrumAnalyzer.targetNodes(channelD);

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
