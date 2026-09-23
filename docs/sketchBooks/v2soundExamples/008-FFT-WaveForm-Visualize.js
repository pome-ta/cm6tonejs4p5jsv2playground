// [p5.sound.js/examples/008-FFT-WaveForm-Visualize/sketch.js at main · processing/p5.sound.js · GitHub](https://github.com/processing/p5.sound.js/blob/main/examples/008-FFT-WaveForm-Visualize/sketch.js)

const sketch = (p) => {
  let osc;
  let fft;

  p.setup = () => {
    // put setup code here
    const cnv = p.createCanvas(100, 100);
    cnv.mouseReleased(p.userStartAudio);
    cnv.mouseClicked(togglePlay);

    fft = new p5.FFT(32);
    osc = new p5.TriOsc(440);
    osc.connect(fft);
  };

  p.draw = () => {
    // put drawing code here
    p.background(220);
    let spectrum = fft.analyze();
    p.noStroke();
    p.fill(255, 0, 0);

    for (let i = 0; i < spectrum.length; i++) {
      let x = p.map(i, 0, spectrum.length, 0, p.width);
      let h = -p.height + p.map(spectrum[i], 0, 0.1, p.height, 0);
      p.rect(x, p.height, p.width / spectrum.length, h);
    }

    let waveform = fft.waveform();

    p.noFill();

    p.beginShape();
    p.stroke(20);

    for (let i = 0; i < waveform.length; i++) {
      let x = p.map(i, 0, waveform.length, 0, p.width);
      let y = p.map(waveform[i], -1, 1, 0, p.height);
      p.vertex(x, y);
    }
    p.endShape();

    p.textAlign(p.CENTER);
    p.text('tap to play', p.width / 2, 20);

    osc.freq(p.map(p.mouseX, 0, p.width, 100, 2000));
    p.describe('The sketch displays the frequency spectrum and waveform of the sound that plays.');
  };

  function togglePlay() {
    osc.start();
  }
};

new p5(sketch);
