//import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const sketch = (p) => {
  let tapIndicator;
  const spectrumAnalyzer = new SpectrumAnalyzer(p, 2048);

  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  let mainOsc;
  let sound;
  let amp;

  p.setup = async () => {
    // put setup code here
    sound = await p.loadSound('https://tonejs.github.io/audio/loop/kick.mp3');

    tapIndicator = new TapIndicator(p);
    //const ctx = p.getAudioContext();
    //Tone.setContext(ctx);

    cnvs = p.createCanvas(w, h);
    cnvs.mouseReleased(p.userStartAudio);

    const types = ['sine', 'triangle', 'sawtooth', 'square'];
    mainOsc = new p5.Oscillator(880, types[2]);

    //const mainMixer = new p5.Gain();
    //amp.connect(mainMixer)

    //mainOsc.start();

    spectrumAnalyzer.targetNodes(sound);
  };

  p.draw = () => {
    p.background(88);
    spectrumAnalyzer.drawGraph();
  };

  p.mouseReleased = () => {
    sound.play();
  };

  p.windowResized = (e) => {
    console.log('windowResized');
    w = p.windowWidth;
    h = p.windowHeight;
    cnvs = p.resizeCanvas(w, h);
  };
};

new p5(sketch);
