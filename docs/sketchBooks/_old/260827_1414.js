// --- # example:

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
  const transport = Tone.getTransport();
  const BPM = transport.bpm;

  let bpm = 100;

  let masterCh;
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

  let callCounter = 0;
  const notes = ['A3', 'F3', 'D3', 'A4'];

  p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

    BPM.value = bpm;

    synth = new Tone.MonoSynth({
      oscillator: { type: 'pulse', width: 0 },
      envelope: { attack: 0.005, decay: 0.1, sustain: 0.3, release: 1 },
    });

    const lfo = new Tone.LFO(0.5, -0.8, 0.8).start();
    lfo.connect(synth.oscillator.width);

    // --- mixer
    masterCh = new Tone.Channel().toDestination();
    synth.connect(masterCh);

    tapIndicator.setup();
    spectrumAnalyzer.targetNodes(masterCh);
    domSetup();

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
        synth.triggerAttack(notes[callCounter % 4]);
        callCounter++;
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
