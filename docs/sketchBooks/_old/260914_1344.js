// --- # example: hh ?

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
  /* Starting Audio */
  document.addEventListener('pointerup', async () => await Tone.start(), {
    once: true,
  });

  const transport = Tone.getTransport();
  const BPM = transport.bpm;
  const masterCh = new Tone.Channel().toDestination();

  const wnCh = new Tone.Channel();
  const wn = new Tone.NoiseSynth({
    noise: { type: 'white' },
    envelope: {
      attack: 0.0,
      // decay: '1n',
      decay: 1.0,
      sustain: 0.0,
      // sustain: 0.0,
      release: 0.0,
    },
  });

  const crusher = new Tone.BitCrusher(16);
  const distn = new Tone.Distortion({
    distortion: 64.0,
    oversample: 'none',
    // oversample: '2x',
  });

  const cheby = new Tone.Chebyshev({
    order: 33,
    //  oversample:'2x' ,
    oversample: 'none',
  });

  const boost = new Tone.Filter({
    type: 'bandpass',
    //type: 'peaking',
    frequency: 12000,
    Q: 7.4,
    rolloff: -24, // -12, -24, -48, -96
    gain: 64,
  });

  const cutLow = new Tone.Filter({
    type: 'lowshelf',
    frequency: 300,
    gain: -64,
  });

  const boost1k = new Tone.Filter({
    type: 'peaking',
    frequency: 14000,
    Q: 0.2,
    rolloff: -48, // -12, -24, -48, -96
    gain: 4, // 1kHz付近を+6dB
  });

  const cutHigh = new Tone.Filter({
    type: 'highshelf',
    frequency: 6000,
    gain: -64,
  });

  const wnChainAry = [
    cheby,
    // cutLow,
    boost,
    boost1k,
    wnCh,
  ];
  wn.chain(...wnChainAry.filter((n) => n));
  wnCh.chain(masterCh);

  // --- Sketch
  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  let pointerId = null;
  let xyPad;

  const holdColor = 'rgba(128, 0, 0, 0.64)';
  const holdAlpha = 0.4;
  const idleAlpha = 0.12;
  const idleBg = (a) => `rgba(0, 0, 128, ${a})`;

  p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

    BPM.value = 130;

    new Tone.Sequence(
      (time, _) => {
        wn.triggerAttack();
        // wn.triggerAttackRelease('32n', time);
      },
      // prettier-ignore
      [
        1,
      ],
      '4n',
    ).start(0);

    transport.start(0);

    tapIndicator.setup();
    spectrumAnalyzer.targetNodes(masterCh);
    domSetup();

    //p.noLoop();
    // p.frameRate(1);
  };

  /* tone 操作 */
  const toneOperation = {
    pointerdown: (ratioPointer) => {
      //console.log('pointerdown');
      //wn.triggerAttack();
    },
    pointermove: (ratioPointer) => {
      //boost.frequency.value = 1000 * p.map(ratioPointer.x, 0, 1, 0.5, 1.5);
      //console.log()
      // distn.distortion = p.map(ratioPointer.x, 0, 1, 0.0, 32);
      // boost.Q.value = p.map(ratioPointer.y, 0, 1, 10, 0);
    },
    pointerup: () => {
      //console.log('pointerup');
      //wn.triggerRelease();
    },
    pointercancel: () => {},
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
    domLayout();
  };

  const xyPadClientFrame = (event) => {
    const {
      left: rectLeft,
      top: rectTop,
      width: rectWidth,
      height: rectHeight,
    } = event.currentTarget.getBoundingClientRect();

    // xxx: 外の要素まで拾わなくていいと思うのだけど・・・
    const absPointer = {
      x: p.map(event.clientX - rectLeft, 0, rectWidth, 0, rectWidth, true),
      y: p.map(event.clientY - rectTop, 0, rectHeight, 0, rectHeight, true),
    };
    const ratioPointer = {
      x: p.map(absPointer.x, 0, rectWidth, 0.0, 1.0, true),
      y: p.map(absPointer.y, 0, rectHeight, 0.0, 1.0, true),
    };

    return {
      absPointer,
      ratioPointer,
      size: { width: rectWidth, height: rectHeight },
      position: { x: rectLeft, y: rectTop },
      client: { x: event.clientX, y: event.clientY },
    };
  };

  const domSetup = () => {
    /* dom (xyPad) 定義 */
    xyPad = p.createDiv();
    xyPad
      .style('width', '16rem')
      .style('height', '16rem')
      .style('background', idleBg(idleAlpha))
      .style('-webkit-touch-callout', 'none')
      .style('-webkit-user-select', 'none')
      .style('user-select', 'none')
      .style('touch-action', 'none');

    /* xyPad Action */
    const styleTransformPerspective = (ratioPointer) => {
      const xMap = p.map(ratioPointer.y, 0, 1, -7.5, 7.5, true);
      const yMap = p.map(ratioPointer.x, 0, 1, 7.5, -7.5, true);

      return `rotateY(${yMap}deg) rotateX(${xMap}deg)`;
    };

    const styleRadialGradient = (absPointer) => {
      const stylePos = `circle at ${absPointer.x}px ${absPointer.y}px `;
      const selectColors = `${holdColor} 8%, ${idleBg(holdAlpha)}  1%`;

      return `radial-gradient(${stylePos} in hsl longer hue, ${selectColors})`;
    };

    const xyPadAction = (ratioPointer, absPointer) => {
      xyPad.style('transform', `perspective(16rem) ${styleTransformPerspective(ratioPointer)}`);
      xyPad.style('background', `${styleRadialGradient(absPointer)}`);
    };

    const idleSignal = (event) => {
      xyPad.elt.releasePointerCapture(event.pointerId);
      xyPad.style('background', idleBg(idleAlpha));
      pointerId = null;
    };

    /* pointer event 定義 */
    const eventlLiteral = {
      pointerdown: (event) => {
        xyPad.elt.setPointerCapture(event.pointerId);
        pointerId = event.pointerId;
        const { ratioPointer: rp, absPointer: ap } = xyPadClientFrame(event);

        xyPadAction(rp, ap);
        toneOperation.pointerdown(rp);
      },

      pointermove: (event) => {
        if (event.buttons === 0 || event.pointerId !== pointerId) {
          pointerId = null;
          return;
        }
        const { ratioPointer: rp, absPointer: ap } = xyPadClientFrame(event);

        xyPadAction(rp, ap);
        toneOperation.pointermove(rp);
      },

      pointerup: (event) => {
        idleSignal(event);
        toneOperation.pointerup();
      },

      pointercancel: (event) => {
        console.log('pointercancel');
        idleSignal(event);
        toneOperation.pointercancel();
      },
    };

    const signalEvent = (event) => {
      eventlLiteral[event.type](event);
    };
    xyPad.mousePressed(signalEvent);
    xyPad.mouseMoved(signalEvent);
    xyPad.mouseReleased(signalEvent);

    const myScriptUrl = import.meta.url;

    /* suffix */
    const markerSuffix = 'TARGET_MARK ===';
    const startMarker = `// === START_${markerSuffix}`;
    const endMarker = `// === END_${markerSuffix}`;

    const codeSubmit = (sourceCode) => {
      const startIndex = sourceCode.indexOf(startMarker);
      const endIndex = sourceCode.indexOf(endMarker);

      if (startIndex === -1 || endIndex === -1) {
        console.warn('対象マーカーが見つかりません');
        return;
      }
      const extractedCode = sourceCode.substring(startIndex + startMarker.length, endIndex).trim();

      $.bus.emit('codeSubmit', extractedCode);
    };

    window.addEventListener('message', (event) => {
      if (event.data?.type !== 'message') {
        return;
      }
      const codeBuffer = event.data.text;
      //codeSubmit(codeBuffer);
    });

    xyPad.elt.addEventListener('pointerup', (event) => {
      window.parent.postMessage(
        {
          type: 'editorCodeBuffer',
        },
        '*',
      );
    });

    domLayout();
  };

  const domLayout = () => {
    // console.log('layout');
    const cw = xyPad.size().width;
    const ch = xyPad.size().height;
    const x = w / 2 - cw / 2;
    const y = h / 2 - ch / 2;

    xyPad.position(x, y / 2);
  };
};

new p5(sketch);
