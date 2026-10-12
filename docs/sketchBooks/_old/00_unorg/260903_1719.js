// --- # example: kick cmp ?

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

  let bpm = 125;

  let masterCh;
  let kick;
  let kickTone;
  let kickFrqEnv;
  let kickCh;

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

    BPM.value = bpm;

    kick = new Tone.MembraneSynth({
      pitchDecay: 0.02,
      octaves: 5,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.8,
        sustain: 0.1,
        release: 1.4,
        attackCurve: 'exponential',
      },
    });

    kickTone = new Tone.MonoSynth({
      oscillator: { type: 'pulse', width: 0 },
      envelope: {
        attack: 0.0,
        decay: 1.35,
        sustain: 0.0,
        release: 2.5,
        // attackCurve: 'exponential',
        attackCurve: 'linear',
      },
      filter: {
        type: 'lowpass',
        Q: 0,
        rolloff: -12,
        frequency: 0, // filterEnvelope の値がそのまま反映されるように
      },
      filterEnvelope: {
        attack: 0.0,
        decay: 140e-3,
        sustain: 0.0,
        release: 80e-3,
        baseFrequency: 105, // 下限
        octaves: 3, // 上限 = baseFrequency * 2^octaves
        // attackCurve: 'exponential',
        decayCurve: 'exponential',
      },
    });

    kickFrqEnv = new Tone.FrequencyEnvelope({
      attack: 0.0,
      decay: 240e-3,
      sustain: 0.0,
      release: 75e-3,
      baseFrequency: 'A0', // 下限
      octaves: 2.5, // 上限 = baseFrequency * 2^octaves
      // attackCurve: 'exponential',
      // decayCurve: 'exponential',
    });
    //console.log(kickTone)
    kickFrqEnv.connect(kickTone.oscillator.frequency);

    // ---sequence
    new Tone.Sequence(
      (time, note) => {
        note.triggerAttackRelease('A0', '1i', time);
        kickFrqEnv.triggerAttackRelease('1i', time);
        // note.triggerAttack('A0', time);
        kick.triggerAttackRelease('A1', '1i', time);
        // kickFrqEnv.triggerAttack(time);
      },
      // prettier-ignore
      [
        kickTone, kickTone, kickTone, kickTone,
        kickTone, kickTone, kickTone, [kickTone,kickTone],
        //[null,null, kickTone,null], kickTone, [null, kickTone], [null,[null,kickTone],kickTone],
      ],
      '4n',
    ).start(0);
    transport.start();

    kickCh = new Tone.Channel(8);
    kickTone.chain(kickCh);
    kick.chain(kickCh);

    // --- effect
    const kickComp = new Tone.Compressor({
      threshold: -20, // -20dB以上の音を圧縮
      ratio: 6, // 6:1で圧縮
      attack: 0.001, // 非常に速いアタック(トランジェントを抑える)
      release: 0.1, // 速めのリリース(次のキックに素早く回復)
      knee: 5, // ハードニー寄り(圧縮の切り替わりが明確)
    });

    // --- mixer
    masterCh = new Tone.Channel().toDestination();
    kickCh.chain(kickComp, masterCh);

    tapIndicator.setup();
    spectrumAnalyzer.targetNodes(masterCh);
    domSetup();

    //p.noLoop();
  };

  /* tone 操作 */
  const toneOperation = {
    pointerdown: (ratioPointer) => {
      //kickTone.triggerAttack('A0');
      //kickFrqEnv.triggerAttack();
    },
    pointermove: (ratioPointer) => {
      const ed = p.map(ratioPointer.x, 0, 1, 55e-3, 2);
      kickTone.envelope.decay = ed;

      const q = p.map(ratioPointer.y, 0, 1, 20, 0);
      kickTone.filter.Q.value = q;
    },
    pointerup: () => {
      //kickTone.triggerRelease();
    },
    pointercancel: () => {
      //kickTone?.triggerRelease();
    },
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
