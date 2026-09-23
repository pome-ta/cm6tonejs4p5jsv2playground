// [p5.sound.js/examples/005-Oscillator-Reverb/sketch.js at main · processing/p5.sound.js · GitHub](https://github.com/processing/p5.sound.js/blob/main/examples/005-Oscillator-Reverb/sketch.js)

const sketch = (p) => {
  let osc, reverb;
  let playing = false;

  p.setup = () => {
    // put setup code here
    let cnv = p.createCanvas(100, 100);
    p.background(220);
    cnv.mousePressed(playSound);
    osc = new p5.Oscillator();
    reverb = new p5.Reverb();
    osc.disconnect();
    osc.connect(reverb);
    p.textAlign(p.CENTER);
    p.text('click to play', p.width / 2, 20);
  };

  p.draw = () => {
    // put drawing code here
    osc.freq(p.map(p.mouseX, 0, p.width, 100, 1000));
  };

  function playSound() {
    if (!playing) {
      osc.start();
      playing = true;
    } else {
      osc.stop();
      playing = false;
    }
  }
};

new p5(sketch);
