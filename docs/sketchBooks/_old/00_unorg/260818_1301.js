// --- # example: DOM 要素

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

  let domContainer;
  let labelBPM;
  let labelBPM2;
  let ctrContainer;
  let plusBtn;
  let minusBtn;
  let slider;

  p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);
    //cnvs.mouseReleased(p.userStartAudio);

    BPM.value = bpm;

    const click = new Tone.Synth({
      oscillator: { type: 'sine' },
    }).toDestination();
    const seq = new Tone.Sequence(
      (time, noteNum) => {
        click.triggerAttackRelease(`A${noteNum}`, '32n', time);
      },
      [5, 4, 4, 4],
      '4n',
    ).start(0);
    Tone.getTransport().start();

    domContainer = p.createDiv();
    domContainer.style('background-color', 'lightblue');
    //domContainer.style('display', 'grid');
    // domContainer.style('grid-template-columns', '1fr 50% 1fr');
    // domContainer.style('grid-template-rows', '1fr 1fr 1fr');

    // labelBPM = p.createP(`${BPM.value}`);
    labelBPM = p.createP(`BPM`);
    // labelBPM = p.createDiv();
    // labelBPM.html(`${BPM.value}`);
    labelBPM.parent(domContainer);
    //labelBPM.style('grid-column', '2 / 3');
    //labelBPM.style('grid-row', '1');

    labelBPM2 = p.createDiv();
    labelBPM2.html(`${bpm}`);
    labelBPM2.parent(domContainer);
    //labelBPM2.style('grid-column', '2 / 3');
    //labelBPM2.style('grid-row', '2');

    ctrContainer = p.createDiv();
    ctrContainer.style('background-color', 'magenta');
    ctrContainer.parent(domContainer);
    //ctrContainer.style('display', 'grid');
    ctrContainer.style('grid-template-columns', '1fr 100% 1fr');
    //ctrContainer.style('grid-template-rows', '1fr 1fr 1fr

    minusBtn = p.createButton('ま', false);
    minusBtn.mouseReleased(handleButtonClick);
    minusBtn.parent(ctrContainer);
    minusBtn.style('grid-column', '1 / 3');
    //minusBtn.style('grid-row', '3');

    slider = p.createSlider(60, 300, bpm);
    slider.input(onSliderInput);
    slider.parent(ctrContainer);
    slider.style('grid-column', '2 / 3');
    //slider.style('grid-row', '3');

    plusBtn = p.createButton('ぷ', true);
    plusBtn.mouseReleased(handleButtonClick);
    plusBtn.parent(ctrContainer);
    plusBtn.style('grid-column', '3 / 3');
    //plusBtn.style('grid-row', '3');

    // domContainer.child(labelBPM);
    // domContainer.child(slider);
    // domContainer.position(100, 200);

    tapIndicator.setup();
    spectrumAnalyzer.targetNodes(click);

    domSetLayout();

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
    domSetLayout();
  };

  const domSetLayout = () => {
    console.log('layout');

    // domContainer.size(w * 0.8, domContainer.size().height);
    domContainer.size(w * 0.8, '100%');

    const cw = domContainer.size().width;
    const ch = domContainer.size().height;

    //ctrContainer.size(cw, '100%');

    console.log('--- width');
    console.log(domContainer.width);
    console.log(domContainer.size().width);
    console.log('--- height');
    console.log(domContainer.height);
    console.log(domContainer.size().height);

    domContainer.position(w / 2 - cw / 2, h / 2 - ch / 2);
  };

  function onSliderInput() {
    bpm = this.value();
    labelBPM2.html(`${bpm}`);
    BPM.value = bpm;
  }

  function handleButtonClick() {
    bpm += this.value() ? 1 : -1;
    labelBPM2.html(`${bpm}`);
    BPM.value = bpm;
  }
};

new p5(sketch);
