class SpectrumAnalyzer {
  #p;
  #audioContext;
  #fft;

  #minFreq;
  #maxFreq;

  #labelsLayer;
  #gridLayer;
  #spectrumLayer;

  #labelsSize;
  #labelsPosition;
  #gridSize;
  #gridPosition;

  isLinear = false;
  // todo: マージン設定方法要検討
  ratio = 0.96;

  // todo: どこで定義するか要検討
  maxDb = +6;
  minDb = -60;
  dbStep = 6;

  #xyListOld;

  constructor(mainInstance, isLinear = false) {
    this.#p = mainInstance;
    this.#audioContext = mainInstance.getAudioContext();
    this.#fft = null;

    this.#labelsLayer = null;
    this.#gridLayer = null;
    this.#spectrumLayer = null;

    this.isLinear = isLinear;

    this.#xyListOld = [];
  }

  setup(fft) {
    this.#fft = fft;
    this.#setBaseGraphics();
    this.#hookWindowResized();
  }

  drawSpectrum(spectrum) {
    const start = window.performance.now();
    this.#drawBaseGraphics();

    if (this.#p.frameCount % 9 !== 0) {
      // 描画悪あがき
      this.#p.image(this.#spectrumLayer, ...this.#gridPosition);
      return;
    }

    this.#spectrumLayer.clear();

    const [pgw, pgh] = this.#gridSize;
    const [pgx, pgy] = this.#gridPosition;

    const xyList = Array.from(spectrum, (amplitude, index) => {
      const bin = index * this.#minFreq;

      const x = this.#p.map(
        Math.log10(bin ? bin : 1e-12),
        Math.log10(this.#minFreq),
        Math.log10(this.#maxFreq),
        0,
        pgw,
      );

      const logDb = 20 * Math.log10(amplitude || 1e-10);
      const y = this.#p.map(logDb, this.minDb, this.maxDb, pgh, 0);
      return [x, y];
    });

    // xxx: 今後の場合分け用?

    //this.#spectrumLayer.noFill();
    this.#spectrumLayer.noStroke();
    this.#spectrumLayer.fill(0, 255, 255, 64);
    this.#spectrumLayer.beginShape();
    this.#spectrumLayer.vertex(0, pgh);

    [...xyList].forEach((xy) => {
      this.#spectrumLayer.vertex(...xy);
    });

    this.#spectrumLayer.vertex(pgw, pgh);
    this.#spectrumLayer.endShape();

    this.#spectrumLayer.noFill();
    if (this.#xyListOld?.length) {
      this.#spectrumLayer.stroke(255, 0, 255, 192);
      this.#spectrumLayer.beginShape();
      //this.#spectrumLayer.vertex(0, pgh);

      [...this.#xyListOld].forEach((xy) => {
        this.#spectrumLayer.vertex(...xy);
      });

      //this.#spectrumLayer.vertex(pgw, pgh);
      this.#spectrumLayer.endShape();
    }

    this.#spectrumLayer.stroke(0, 255, 255, 192);
    this.#spectrumLayer.beginShape();
    //this.#spectrumLayer.vertex(0, pgh);

    [...xyList].forEach((xy) => {
      this.#spectrumLayer.vertex(...xy);
    });

    //this.#spectrumLayer.vertex(pgw, pgh);
    this.#spectrumLayer.endShape();

    this.#xyListOld = xyList;
    this.#p.image(this.#spectrumLayer, ...this.#gridPosition);

    if (this.#p.frameCount >= 60 * 2 && this.#p.frameCount < 60 * 4) {
      const end = window.performance.now();
      console.log(end - start);
    }
  }

  get #sampleRate() {
    return this.#audioContext.sampleRate;
  }

  #setBaseGraphics() {
    const nyquist = this.#sampleRate / 2;
    const bins = this.#fft.fftSize;
    const bandWidth = nyquist / bins;

    this.#minFreq = bandWidth;
    this.#maxFreq = nyquist;

    this.#setSize();
    this.#createBase();
    this.#drawBaseGraphics();
  }

  #setSize() {
    this.#labelsLayer?.remove();
    this.#gridLayer?.remove();
    this.#spectrumLayer?.remove();

    this.#labelsLayer = this.#p.createGraphics(this.#p.windowWidth * this.ratio, this.#p.windowHeight * this.ratio);

    this.#gridLayer = this.#p.createGraphics(
      this.#labelsLayer.width * this.ratio,
      this.#labelsLayer.height * this.ratio,
    );

    this.#spectrumLayer = this.#p.createGraphics(this.#gridLayer.width, this.#gridLayer.height);

    this.#labelsSize = [this.#labelsLayer.width, this.#labelsLayer.height];
    this.#labelsPosition = [
      (this.#p.windowWidth - this.#labelsLayer.width) / 2,
      (this.#p.windowHeight - this.#labelsLayer.height) / 2,
    ];

    this.#gridSize = [this.#gridLayer.width, this.#gridLayer.height];
    this.#gridPosition = [
      (this.#p.windowWidth - this.#gridLayer.width) / 2,
      (this.#p.windowHeight - this.#gridLayer.height) / 2,
    ];
  }

  #createBase() {
    this.#labelsLayer.clear();
    this.#gridLayer.clear();

    const [lw, lh] = this.#labelsSize;
    const [lx, ly] = this.#labelsPosition;
    const [gw, gh] = this.#gridSize;
    const [gx, gy] = this.#gridPosition;

    const xDistance = (lw - gw) / 2;
    const yDistance = (lh - gh) / 2;

    const minLog = Math.log10(this.#minFreq);
    const maxLog = Math.log10(this.#maxFreq);

    // x: hz set
    const decades = Array.from(
      { length: Math.floor(maxLog) - Math.floor(minLog) + 1 },
      (_, d) => d + Math.floor(minLog),
    );

    const ticks = [...Array(9)].map((_, i) => i + 1);

    const digits = Math.floor(Math.log10(this.#minFreq));
    // 最低（20）hz 用
    const minimumFreq = Math.floor(this.#minFreq / 10 ** digits) * 10 ** digits;

    const majorColor = 100;
    const minorColor = 50;
    const baseColor = 25;
    const textColor = 25;

    this.#labelsLayer.textFont('monospace');
    this.#labelsLayer.textSize(8);
    this.#labelsLayer.textAlign(this.#p.CENTER, this.#p.BOTTOM);
    this.#labelsLayer.fill(textColor);

    // x: hz
    decades.forEach((d, idx) => {
      ticks.forEach((i) => {
        const freq = i * 10 ** d;

        if (freq < minimumFreq || freq >= this.#maxFreq) {
          return;
        }

        const x = this.#p.map(Math.log10(freq), minLog, maxLog, 0, gw);
        const isMajor = i === 1;

        if (i % 2 === 0 || isMajor) {
          this.#gridLayer.stroke(isMajor ? majorColor : minorColor);
          this.#gridLayer.strokeWeight(isMajor ? 1 : 0.8);

          const ty = isMajor ? lh - yDistance / 2 : lh;
          this.#labelsLayer.text(freq >= 1000 ? `${freq / 1000}k` : `${freq}`, x + xDistance, ty);
        } else {
          this.#gridLayer.stroke(baseColor);
          this.#gridLayer.strokeWeight(0.4);
        }

        this.#gridLayer.line(x, 0, x, gh);
      });
    });

    // y: db
    const dbTicks = Array.from(
      { length: Math.floor((this.maxDb - this.minDb) / this.dbStep) + 1 },
      (_, i) => this.minDb + i * this.dbStep,
    );

    this.#labelsLayer.textAlign(this.#p.RIGHT, this.#p.BOTTOM);
    dbTicks.forEach((db) => {
      if (db <= this.minDb || db >= this.maxDb) {
        return;
      }
      const y = this.#p.map(db, this.minDb, this.maxDb, gh, 0);
      const isMajor = db % 12 === 0;

      this.#gridLayer.stroke(isMajor ? 100 : 50);
      this.#gridLayer.strokeWeight(db === 0 ? 2 : isMajor ? 1 : 0.8);
      this.#gridLayer.line(0, y, gw, y);
      this.#labelsLayer.text(`${db}`, lw, y + yDistance);
    });
  }

  #drawBaseGraphics() {
    this.#p.image(this.#labelsLayer, ...this.#labelsPosition);
    this.#p.image(this.#gridLayer, ...this.#gridPosition);
  }

  #hookWindowResized() {
    const originalWindowResized = this.#p.windowResized;
    this.#p.windowResized = (...args) => {
      if (typeof originalWindowResized !== 'function') {
        return;
      }
      //console.log('前class');
      originalWindowResized.apply(this.#p, args);
      //console.log('後class');
      this.#setBaseGraphics();
    };
  }
}

import * as Tone from 'tone';

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
  let spectrum;

  const spectrumAnalyzer = new SpectrumAnalyzer(p);

  p.setup = () => {
    // put setup code here
    //tapIndicator = new TapIndicator(p);
    const ctx = p.getAudioContext();
    Tone.setContext(ctx);

    cnvs = p.createCanvas(w, h);
    cnvs.mouseReleased(p.userStartAudio);

    p.colorMode(p.HSL, v, 1, 1);

    const types = ['sine', 'triangle', 'sawtooth', 'square'];

    mainOsc = new p5.Oscillator(440 + p.random() * 440, types[0]);
    mainOsc.amp(0.8);
    mainOsc.disconnect();

    lfo = new p5.Oscillator(0.1, 'sine'); // 速さ
    lfo.amp(200); // 幅
    lfo.disconnect();

    subOsc = new p5.Oscillator(880 + p.random() * 440, types[2]);
    subOsc.amp(0.3);
    subOsc.disconnect();

    mainMixer = new p5.Gain();
    lfo.node.connect(mainOsc.node.frequency);
    mainOsc.connect(mainMixer);
    subOsc.connect(mainMixer);

    lfo.start();
    mainOsc.start();
    subOsc.start();

    fft = new p5.FFT(1024);

    mainMixer.connect(fft);

    spectrumAnalyzer.setup(fft);

    //p.noLoop();
  };

  p.draw = () => {
    // put drawing code here

    p.background((p.frameCount * 0.5) % v, 1, 0.5);
    spectrum = fft.analyze();

    spectrumAnalyzer.drawSpectrum(spectrum);
  };

  p.windowResized = (e) => {
    console.log('windowResized');
    w = p.windowWidth;
    h = p.windowHeight;
    cnvs = p.resizeCanvas(w, h);
  };
};

new p5(sketch);
