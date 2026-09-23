// [p5.sound.js/examples/001-Oscillator-FrequencyAmplitude/sketch.js at main · processing/p5.sound.js · GitHub](https://github.com/processing/p5.sound.js/blob/main/examples/001-Oscillator-FrequencyAmplitude/sketch.js)

import TapIndicator from '../../sketchBooks/modules/TapIndicator.js';

const sketch = (p) => {
  let tapIndicator;

  let osc, playing, freq, amp;
  let toneScale = [261.6, 311.1, 349.2, 370, 392, 466.2];

  p.setup = () => {
    // put setup code here
    tapIndicator = new TapIndicator(p);

    const cnv = p.createCanvas(500, 500);
    cnv.mousePressed(playOscillator);
    osc = new p5.Oscillator('sawtooth');
  };

  p.draw = () => {
    // put drawing code here
    p.background(220);
    freq = toneScale[p.floor(p.map(p.mouseX, 0, p.width, 0, 5))];

    amp = p.constrain(p.map(p.mouseY, p.height, 0, 0, 1), 0, 1);
    p.text('tap to play', 20, 20);
    p.text('freq: ' + freq, 20, 40);
    p.text('amp: ' + amp, 20, 60);

    if (playing === true) {
      osc.freq(freq);
      osc.amp(amp);
    }
  };

  function playOscillator() {
    // starting an oscillator on a user gesture will enable audio
    // in browsers that have a strict autoplay policy.
    osc.start();
    playing = true;
  }
};

new p5(sketch);
