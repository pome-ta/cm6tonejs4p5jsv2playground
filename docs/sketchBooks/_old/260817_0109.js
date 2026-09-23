// --- # example: `Tone.Part` メトロノーム

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

  // --- Sketch
  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  let bpm = 92;

  p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);
    //cnvs.mouseReleased(p.userStartAudio);

    BPM.value = bpm;

    const click = new Tone.MembraneSynth().toDestination();
    const part = new Tone.Part(
      (time) => {
        click.triggerAttackRelease('A2', '8n', time);
      },
      [
        ['0:0:0', null],
        ['0:1:0', null],
        ['0:2:0', null],
        ['0:3:0', null],
      ],
    ).start(0);
    part.loop = true;
    part.loopEnd = '1m';
    Tone.getTransport().start();

    tapIndicator.setup();
    spectrumAnalyzer.targetNodes(click);

    //p.noLoop();
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

