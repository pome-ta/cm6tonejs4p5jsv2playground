// --- # example: kick snare seq

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

  let bpm = 100;

  let masterCh;
  let drumsCh = [];
  let kick;
  let snare;
  let hihat;

  // --- Sketch
  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

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

    snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: {
        attack: 0.05, // ここを少し持たせるとアタック感が出る
        decay: 0.15,
        sustain: 0,
        release: 0.05,
      },
    });

    class DrumTrigger {
      #paramList;
      constructor(node, { note = null, duration } = {}) {
        this.node = node;
        this.note = note;
        this.duration = duration;

        this.#paramList = [this.note, this.duration].filter((p) => p);
      }

      run() {
        this.node.triggerAttackRelease(...this.#paramList);
      }
    }

    const kickTrigger = new DrumTrigger(kick, { note: 'C2', duration: '4n' });
    const snareTrigger = new DrumTrigger(snare, { duration: '16n' });

    const seq = new Tone.Sequence(
      (time, triggerObject) => {
        Object.values(triggerObject).forEach((trigger) => {
          trigger.run();
        });
      },
      [
        { kickTrigger },
        { kickTrigger, snareTrigger },
        { kickTrigger },
        [{ kickTrigger, snareTrigger }, { snareTrigger }, null, { kickTrigger }],
      ],
      '4n',
    ).start(0);
    Tone.getTransport().start();

    masterCh = new Tone.Channel().toDestination();
    //master.volume.rampTo(10, 0);

    drumsCh = [kick, snare].map((node, idx) => {
      const channel = new Tone.Channel();
      node.connect(channel);
      channel.connect(masterCh);
      return channel;
    });

    tapIndicator.setup();
    spectrumAnalyzer.targetNodes(masterCh);

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
  };
};

new p5(sketch);
