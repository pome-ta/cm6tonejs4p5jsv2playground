import TapIndicator from 'modules/TapIndicator.js';

const sketch = (p) => {
  let tapIndicator;

  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  const v = 360;

  let mainMixer;
  let mainOsc;
  let lfo;
  let subOsc;
  
  let fft;

  p.setup = () => {
    // put setup code here
    tapIndicator = new TapIndicator(p);

    cnvs = p.createCanvas(w, h);
    cnvs.mouseReleased(p.userStartAudio);

    p.colorMode(p.HSL, v, 1, 1);

    const types = ['sine', 'triangle', 'sawtooth', 'square'];

    mainOsc = new p5.Oscillator(440 + p.random() * 440, types[2]);
    mainOsc.amp(0.3);
    mainOsc.disconnect();

    lfo = new p5.Oscillator(0.3, 'sine'); // 速さ
    lfo.amp(180); // 幅
    lfo.disconnect();

    subOsc = new p5.Oscillator(880 + p.random() * 440, types[3]);
    subOsc.amp(0.3);
    subOsc.disconnect();

    mainMixer = new p5.Gain();
    lfo.node.connect(mainOsc.node.frequency);
    mainOsc.connect(mainMixer);
    subOsc.connect(mainMixer);

    lfo.start();
    mainOsc.start();
    subOsc.start();
    
    fft = new p5.FFT(32);
    mainMixer.connect(fft);
    
  };

  p.draw = () => {
    // put drawing code here
    p.background(p.frameCount % v, 1, 0.5);
    
    
    let spectrum = fft.analyze();
    
    p.fill(v, 0.5, 0.1);
    p.noStroke();
    
    for (let i = 0; i < spectrum.length; i++) {
      let x = p.map(i, 0, spectrum.length, 0, w);     
      let y = -h + p.map(spectrum[i], 0, 0.1, h, 0);
      p.rect(x, h, w / spectrum.length, y)
    }
    
    
    let waveform = fft.waveform();
  
    p.noFill();
    
    p.beginShape();
    p.stroke(20);
    
    for (let i = 0; i < waveform.length; i++){
      let x = p.map(i, 0, waveform.length, 0, w);
      let y = p.map( waveform[i], -1, 1, 0, h);
      p.vertex(x,y);
    }
    p.endShape();
    
  };

  p.windowResized = (e) => {
    //console.log('windowResized');
    w = p.windowWidth;
    h = p.windowHeight;
    cnvs = p.resizeCanvas(w, h);
  };
};

new p5(sketch);
