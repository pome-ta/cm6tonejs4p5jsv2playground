// --- # example: bass ?

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
  let bass;

  // --- Sketch
  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

    BPM.value = bpm;

    const click = new Tone.Synth({
      oscillator: { type: 'sine' },
    }); //.toDestination();
    const metroSeq = new Tone.Sequence(
      (time, noteNum) => {
        click.triggerAttackRelease(`A${noteNum}`, '32n', time);
      },
      [5, 4, 4, 4],
      //[null],
      '4n',
    ).start(0);

    bass = new Tone.Synth({
      //portamento: '32n',
      oscillator: { type: 'sawtooth' },
    });

    const bassSeq = new Tone.Sequence(
      (time, note) => {
        bass.triggerAttack(note, time);
      },
      // prettier-ignore
      [
        'a2', 'a2', 'a2', 'a2',
        'a2', 'a3', 'a2', 'a3',
        'g2', 'g3', 'g2', 'g3',
        'd2', 'd3', 'd2', 'd3',
      ],
      '4n',
    ).start(0);

    Tone.getTransport().start();

    const bassCh = new Tone.Channel();
    bass.connect(bassCh);

    masterCh = new Tone.Channel().toDestination();
    //click.connect(masterCh);
    bassCh.connect(masterCh);

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
