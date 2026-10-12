// --- # example: メトロノーム & DOM 要素

import * as Tone from 'tone';
import 'https://cdn.jsdelivr.net/npm/ios-vibrator-pro-max@3.0.3/+esm';
//import { enableBackgroundPopup } from 'https://cdn.jsdelivr.net/npm/ios-vibrator-pro-max@3.0.3/+esm';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

//enableBackgroundPopup(true);
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
  const minTempo = 30;
  const maxTempo = 300;

  let domContainer;
  let valueBPM;

  p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

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

    domContainer = p.createDiv(`BPM`);
    domContainer
      //   .style('background-color', 'lightblue')
      .style('background', 'rgba(255, 255, 255, 0.12)')
      //   .style('backdrop-filter', 'blur(20px) saturate(180%)')
      //   .style('backdrop-filter', 'blur(2px) saturate(180%)')
      .style('backdrop-filter', 'blur(0.2rem) saturate(120%)')
      .style('border', '1px solid rgba(255, 255, 255, 0.3)')
      .style('border-radius', '0.8rem')
      .style('font-family', 'monospace')
      .style('text-align', 'center')
      .style('box-sizing', 'border-box')
      .style('padding', '1rem');

    valueBPM = p.createP(zeroPadValue(bpm));
    valueBPM.style('font-size', '1.5rem');
    valueBPM.style('font-weight', '700');
    valueBPM.parent(domContainer);

    const minusBtn = p.createButton('-', '-1');
    const plusBtn = p.createButton('+', '1');

    [minusBtn, plusBtn].reduce((maxSize, rBtnObj, idx, array) => {
      rBtnObj.style('font-size', '1.25rem').style('border-radius', '50%');
      rBtnObj.mouseReleased(handleButtonClick);

      const currentMaxSize = Math.max(maxSize, rBtnObj.size?.().width ?? 0, rBtnObj.size?.().height ?? 0);

      idx === array.length - 1 &&
        array.forEach((fBtnObj) => {
          fBtnObj.size(currentMaxSize * 1.25, currentMaxSize * 1.25);
        });

      return currentMaxSize;
    }, -Infinity);

    // const btns = [minusBtn, plusBtn];
    // const btnMaxSize = [...btns]
    //   .flatMap((btn) => {
    //     btn.style('font-size', '1.25rem');
    //     btn.style('border-radius', '50%');
    //     btn.mouseReleased(handleButtonClick);
    //     return [btn.size?.().width ?? 0, btn.size?.().height ?? 0];
    //   })
    //   .reduce((max, val) => Math.max(max, val), -Infinity);
    // btns.forEach((btn) => btn.size(btnMaxSize * 1.25, btnMaxSize * 1.25));

    const slider = p.createSlider(minTempo, maxTempo, bpm);
    // slider.style('width', '100%');
    slider.input(onSliderInput);

    // const createContainerDiv = (parent, ...children) => {
    //   const _container = p.createDiv();
    //   _container.parent(parent);
    //   _container
    //     .style('background-color', 'magenta')
    //     .style('display', 'grid')
    //     .style('grid-template-columns', 'auto 1fr auto')
    //     .style('gap', '1rem')
    //     .style('align-items', 'center');
    //   children.forEach((child) => _container.child(child));
    // };
    // createContainerDiv(domContainer, minusBtn, slider, plusBtn);

    ((parent, ...children) => {
      const _container = p.createDiv();
      _container.parent(parent);
      _container
        // .style('background-color', 'magenta')
        .style('display', 'grid')
        .style('grid-template-columns', 'auto 1fr auto')
        .style('gap', '1rem')
        .style('align-items', 'center');
      children.forEach((child) => _container.child(child));
    })(domContainer, minusBtn, slider, plusBtn);
    // createContainerDiv(domContainer, minusBtn, slider, plusBtn);

    domSetLayout();

    tapIndicator.setup();
    spectrumAnalyzer.targetNodes(click);

    //p.noLoop();
  };

  p.draw = () => {
    // put drawing code here
    p.background(80);
    // p.rect(0, 0, w / 2, h / 2);
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
    // console.log('layout');
    domContainer.size(w * 0.8, '100%');
    const cw = domContainer.size().width;
    const ch = domContainer.size().height;
    const x = w / 2 - cw / 2;
    const y = h / 2 - ch / 2;
    domContainer.position(x, y);
  };

  function onSliderInput() {
    bpm = Math.min(Math.max(this.value()), maxTempo);
    valueBPM.html(zeroPadValue(bpm));
    BPM.value = bpm;
    navigator.vibrate(50);
  }

  function handleButtonClick() {
    const delta = Math.trunc(Number(this.value())) ?? 0;
    bpm = Math.min(Math.max(bpm + delta, minTempo), maxTempo);
    valueBPM.html(zeroPadValue(bpm));
    BPM.value = bpm;
    navigator.vibrate(200);
  }

  const zeroPadValue = (value) => `${String(value).padStart(3, '0')}`;
};

new p5(sketch);
