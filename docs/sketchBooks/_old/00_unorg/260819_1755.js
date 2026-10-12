// --- # example: メトロノーム & DOM 要素

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
  const minTempo = 30;
  const maxTempo = 300;

  let isStarted = false;
  const playStr = '▷';
  const pauseStr = '■';

  let click;
  let seq;

  let domContainer;
  let divSignals;
  let labelBPM;

  const containerColors = [
    ['background', 'rgba(0, 0, 0, 0.08)'],
    ['background', 'rgba(255, 255, 255, 0.08)'],
  ];

  const signalColors = [
    ['background', 'rgba(128, 128, 128, 0.12)'],
    ['background', 'rgba(255, 0, 255, 0.12)'],
  ];

  const toneSetup = () => {
    BPM.value = bpm;
    click = new Tone.Synth({
      oscillator: { type: 'sine' },
    }).toDestination();
    seq = new Tone.Sequence(
      (time, idx) => {
        updateSignals(idx);
        //console.log(idx);
        click.triggerAttackRelease(`A${idx ? 4 : 5}`, '32n', time);
      },
      [0, 1, 2, 3],
      '4n',
    ).start(0);
    isStarted && Tone.getTransport().start();
  };

  p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

    toneSetup();
    uiSetup();
    tapIndicator.setup();
    spectrumAnalyzer.targetNodes(click);

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
    domSetLayout();
  };

  const uiSetup = () => {
    domContainer = p.createDiv();
    domContainer
      //.style('background', 'rgba(255, 255, 255, 0.08)')
      .style('backdrop-filter', 'blur(0.1rem) saturate(120%)')
      .style('border', '1px solid rgba(255, 255, 255, 0.3)')
      .style('border-radius', '0.8rem')
      .style('font-family', 'monospace')
      .style('text-align', 'center')
      .style('box-sizing', 'border-box')
      .style('padding', '1rem');

    updateContainer();
    {
      const signalContainer = p.createDiv();
      signalContainer
        .style('width', '80%')
        .style('margin', 'auto')
        .style('border-radius', '0.8rem')
        .style('padding', '1rem')
        .style('background', 'rgba(0, 0, 0, 0.12)')
        .style('backdrop-filter', 'blur(0.1rem) saturate(120%)')
        .style('display', 'flex')
        .style('justify-content', 'space-between');
      signalContainer.parent(domContainer);

      const _divSize = '2rem';
      // xxx: 決め打ち
      divSignals = Array.from({ length: 4 }, (_, idx) => {
        const div = p.createDiv();
        div
          .style('width', _divSize)
          .style('height', _divSize)
          .style('border-radius', '50%')
          .style('backdrop-filter', 'blur(0.1rem) saturate(120%)')
          .style('borderr', '1px solid rgba(255, 255, 255, 0.3)');

        div.parent(signalContainer);

        return div;
      });
      updateSignals();
    }

    {
      const labelContainer = p.createDiv();

      labelContainer
        .style('display', 'flex')
        .style('justify-content', 'center')
        .style('gap', '0.5rem')
        .style('align-items', 'baseline');
      labelContainer.parent(domContainer);

      labelBPM = p.createP(zeroPadValue(bpm));
      const titleBPM = p.createP(`BPM`);

      const _styles = [
        ['font-size', '2rem'],
        ['font-weight', '900'],
      ];

      [labelBPM, titleBPM].forEach((tag, idx) => {
        idx ||
          _styles.forEach((_style) => {
            tag.style(..._style);
          });
        tag.parent(labelContainer);
      });
    }

    const minusBtn = p.createButton('-', '-1');
    const plusBtn = p.createButton('+', '1');
    {
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
    }
    const slider = p.createSlider(minTempo, maxTempo, bpm);
    slider.input(onSliderInput);

    ((parent, ...children) => {
      const _container = p.createDiv();
      _container.parent(parent);
      _container
        .style('display', 'grid')
        .style('grid-template-columns', 'auto 1fr auto')
        .style('gap', '1rem')
        .style('align-items', 'center');
      children.forEach((child) => _container.child(child));
    })(domContainer, minusBtn, slider, plusBtn);

    {
      const plyBtn = p.createButton(`${isStarted ? pauseStr : playStr}`);
      plyBtn
        .style('font-size', '1.25rem')
        .style('width', '25%')
        .style('height', '4rem')
        .style('border-radius', '0.8rem')
        .style('margin-top', '2rem');

      plyBtn.mouseReleased(handleButtonPlay);
      plyBtn.parent(domContainer);
    }
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
    labelBPM.html(zeroPadValue(bpm));
    BPM.value = bpm;
  }

  function handleButtonClick() {
    const delta = Math.trunc(Number(this.value())) ?? 0;
    bpm = Math.min(Math.max(bpm + delta, minTempo), maxTempo);
    labelBPM.html(zeroPadValue(bpm));
    BPM.value = bpm;
  }

  function handleButtonPlay() {
    // updateSignals();
    isStarted = !isStarted;
    isStarted ? Tone.getTransport().start() : Tone.getTransport().stop();
    isStarted || updateSignals();
    updateContainer();
    this.html(`${isStarted ? pauseStr : playStr}`);
  }

  function updateSignals(sIdx = null) {
    divSignals.forEach((div, idx) => {
      div.style(...signalColors[sIdx === idx ? 1 : 0]);
    });
  }
  function updateContainer() {
    domContainer.style(...containerColors[isStarted ? 1 : 0]);
  }
  const zeroPadValue = (value) => `${String(value).padStart(3, '0')}`;
};

new p5(sketch);
