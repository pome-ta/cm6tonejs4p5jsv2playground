// --- # example: drum kit

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
  //const BPM = Tone.getTransport().bpm;
  const BPM = transport.bpm;

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

    // --- drums
    // --- kick
    kick = new Tone.MembraneSynth({
      pitchDecay: '16t',
      octaves: 8,
      oscillator: { type: 'sine' },
      envelope: {
        attack: 0.001,
        decay: 0.8,
        sustain: 0.01,
        release: '16n',
        attackCurve: 'exponential',
      },
    });
    // --- snare
    snare = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.02, decay: 0.1, sustain: 0 },
    });
    // --- hihat
    hihat = new Tone.MetalSynth({
      envelope: { attack: 0.001, decay: 0.9, release: 0.1 },
      harmonicity: 5.1,
      modulationIndex: 32,
      octaves: 1.5,
      resonance: 4000,
    });

    // ---sequence
    new Tone.Sequence(
      (time, note) => {
        note.triggerAttackRelease('C2', '8n', time);
      },
      // prettier-ignore
      [
        kick, kick, kick, kick,
        kick, kick, kick, [kick, kick],
      ],
      '4n',
    ).start(0);

    new Tone.Sequence(
      (time, note) => {
        note.triggerAttackRelease('8n', time);
      },
      // prettier-ignore
      [
        null, snare, null, snare,
      ],
      '4n',
    ).start(0);

    new Tone.Sequence(
      (time, note) => {
        note.triggerAttackRelease(800, '64t', time);
      },
      // prettier-ignore
      [
        null, hihat, null, hihat,
        null, hihat, null, hihat,
        null, hihat, null, hihat,
        null, hihat, null, [hihat, hihat],
      ],
      '8n',
    ).start(0);

    transport.start();

    // --- mixer
    masterCh = new Tone.Channel().toDestination();
    // prettier-ignore
    drumsCh = [
      kick,
      snare,
      hihat,
    ].map((node, idx) => {
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
