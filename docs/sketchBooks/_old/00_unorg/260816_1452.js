//import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const sketch = (p) => {
  let tapIndicator;

  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  const v = 360;

  let mainMixer;
  let mainOsc;
  let lfo;
  let subOsc;
  let panner;
  let lfo2;

  let fft;
  let spectrum;

  const spectrumAnalyzer = new SpectrumAnalyzer(p, 1024);

  p.setup = () => {
    // put setup code here
    //tapIndicator = new TapIndicator(p);
    const ctx = p.getAudioContext();
    //Tone.setContext(ctx);

    cnvs = p.createCanvas(w, h);
    cnvs.mouseReleased(p.userStartAudio);

    p.colorMode(p.HSL, v, 1, 1);

    const types = ['sine', 'triangle', 'sawtooth', 'square'];

    mainOsc = new p5.Oscillator(880, types[2]);
    mainOsc.amp(0.8);
    //mainOsc.disconnect();

    lfo = new p5.Oscillator(0.1, 'sine'); // 速さ
    lfo.amp(360); // 幅
    lfo.disconnect();

    lfo.node.connect(mainOsc.node.frequency);

    subOsc = new p5.Oscillator(880, types[0]);
    // subOsc = new Tone.Oscillator(880, types[0]);
    subOsc.amp(1);
    subOsc.disconnect();

    panner = new p5.Panner();
    lfo2 = new p5.Oscillator(0.1);
    lfo2.amp(1);
    lfo2.disconnect();
    panner.pan(lfo2);
    subOsc.connect(panner);
    //panner.disconnect();

    //mainMixer = new p5.Gain();

    //mainOsc.connect(mainMixer);
    //subOsc.connect(mainMixer);
    //panner.connect(mainMixer);
    // subOsc.connect(mainMixer.input);

    lfo.start();
    mainOsc.start();
    subOsc.start();
    lfo2.start();

    //spectrumAnalyzer.targetNodes(mainMixer);
    spectrumAnalyzer.targetNodes(mainOsc, panner);
    //spectrumAnalyzer.targetNodes(mainOsc);



    //p.noLoop();
  };

  p.draw = () => {
    // put drawing code here
    p.background(0.8);
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
