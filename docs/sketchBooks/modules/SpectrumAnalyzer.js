import { isAnyAudioNode, isAnyAudioParam } from 'https://cdn.jsdelivr.net/npm/standardized-audio-context@25.3.72/+esm';

// https://github.com/processing/p5.sound.js/blob/c01819d9c5adef3362f819c8f368a27a7a7bfef5/src/core/p5soundNode.js#L29
/**
 * 接続元の最深部 AudioNode (output) を取得
 */
const resolveOutput = (node) => {
  while (node && !isAnyAudioNode(node) && node.output !== undefined) {
    node = node.output;
  }
  return node;
};
/**
 * 接続先の最深部 AudioNode または AudioParam (input) を取得
 */
const resolveInput = (node) => {
  while (node && !isAnyAudioNode(node) && !isAnyAudioParam(node) && node.input !== undefined) {
    node = node.input;
  }
  return node;
};

/**
 * チャンネル数を動的に取得(優先順にフォールバック)
 */
const getChannelCount = (node) => {
  const bare = resolveOutput(node);

  return (
    node?.buffer?.numberOfChannels ??
    node?._buffer?.numberOfChannels ??
    bare?.channelCount ??
    bare?.maxChannelCount ??
    node?.numberOfChannels ??
    2
  );
};

/**
 * Tone.js / 生 Web Audio API ノードを透過的に接続
 */
const connectNodes = (fromNode, toNode, outputIndex = 0, inputIndex = 0) => {
  const src = resolveOutput(fromNode);
  const dest = resolveInput(toNode);

  if (!src || !dest) {
    return;
  }

  // 接続先が AudioParam(例: gain.gain 等)の場合は inputIndex を渡さない
  if (isAnyAudioParam(dest)) {
    src.connect(dest, outputIndex);
  } else if (isAnyAudioNode(dest)) {
    src.connect(dest, outputIndex, inputIndex);
  }
};

class CanvasPosition {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  *[Symbol.iterator]() {
    yield this.x;
    yield this.y;
  }
}

class CanvasSize {
  constructor(width, height) {
    this.width = width;
    this.height = height;
  }

  *[Symbol.iterator]() {
    yield this.width;
    yield this.height;
  }
}

export default class SpectrumAnalyzer {
  #p;
  #audioContext;
  #analysers;
  #channelCount;

  // --- specs
  #sampleRate;
  #fftSize;
  #xyRange;
  #xyListOld;
  #xCoordinatesCache;

  // todo: db 調整
  //   - 0.42 : ブラックマン窓による減衰
  //   - 0.5  : 正/負の周波数へのエネルギー分裂
  blackmanOverdrive = 1 / (0.42 * 0.5);

  // --- draw
  #labels;
  #grid;
  #spectrumLayer;

  #minFreq;
  #maxFreq;
  // wip: どこで定義するか要検討
  maxDb = +6;
  minDb = -60;
  dbStep = 6;
  // wip: マージン設定方法要検討
  ratio = 0.96;

  nowFill = { fill: [0, 255, 255, 64] };
  nowStroke = { stroke: [0, 255, 255, 192] };
  oldStroke = { stroke: [255, 0, 255, 192] };

  constructor(mainInstance, fftSize = 1024) {
    this.#p = mainInstance;
    this.#audioContext = mainInstance.getAudioContext();
    this.#fftSize = fftSize;
    this.#analysers = [];
    this.#channelCount = 0;

    this.#xyRange = Array.from({ length: this.#fftSize }, (_, idx) => idx);
    this.#xyListOld = [];

    this.#labels = null;
    this.#grid = null;
    this.#spectrumLayer = null;
  }

  targetNodes(...nodes) {
    this.#channelCount = Math.max(1, ...nodes.map(getChannelCount));

    const gain = this.#createMergeGain(nodes);
    const splitter = new ChannelSplitterNode(this.#audioContext, {
      numberOfOutputs: this.#channelCount,
    });
    connectNodes(gain, splitter);

    this.#analysers = Array.from({ length: this.#channelCount }, (_, idx) => {
      const analyser = new p5.FFT(this.#fftSize);
      connectNodes(splitter, analyser, idx, 0);
      return analyser;
    });

    this.#setBaseAttributes();
    this.#hookWindowResized();
  }

  drawGraph() {
    this.#drawBaseGraphics();

    if (this.#p.frameCount % 3 !== 0) {
      // 描画悪あがき
      this.#p.image(this.#spectrumLayer, ...this.#grid.position);
      return;
    }

    this.#spectrumLayer.clear();

    const floatDataArrays = this.#analysers.map((analyzer) => analyzer.analyze());

    const xyList = this.#xyRange.map((index) => {
      const x = this.#xCoordinatesCache[index];

      let sumOfSquares = 0;
      for (let ch = 0; ch < this.#channelCount; ch++) {
        const ampCh = floatDataArrays[ch][index];
        sumOfSquares += ampCh * ampCh;
      }
      const ampTotal = Math.sqrt(sumOfSquares);
      const amp = ampTotal ? ampTotal * this.blackmanOverdrive : 1e-10;
      const logDb = 20 * Math.log10(amp);

      const y = this.#p.map(logDb, this.minDb, this.maxDb, this.#grid.size.height, 0);

      return [x, y];
    });

    this.#drawSpectrumMap(xyList, this.nowFill);
    this.#xyListOld?.length && this.#drawSpectrumMap(this.#xyListOld, this.oldStroke);
    this.#drawSpectrumMap(xyList, this.nowStroke);

    this.#xyListOld = xyList;
    this.#p.image(this.#spectrumLayer, ...this.#grid.position);
  }

  #drawSpectrumMap(matrixList, { fill, stroke }) {
    this.#spectrumLayer.push();
    {
      // --- init
      this.#spectrumLayer.noFill();
      this.#spectrumLayer.noStroke();

      // -- set
      fill && this.#spectrumLayer.fill(...fill);
      stroke && this.#spectrumLayer.stroke(...stroke);

      // --- shape
      this.#spectrumLayer.beginShape();
      {
        fill && this.#spectrumLayer.vertex(0, this.#grid.size.height);
        matrixList.forEach((xy) => {
          this.#spectrumLayer.vertex(...xy);
        });
        fill && this.#spectrumLayer.vertex(...this.#grid.size);
      }
      this.#spectrumLayer.endShape();
    }
    this.#spectrumLayer.pop();
  }

  #createMergeGain(nodes) {
    const gain = new p5.Gain();
    gain.node.set({
      channelCount: this.#channelCount,
    });

    nodes.forEach((tNode) => connectNodes(tNode, gain));
    gain.disconnect(); // todo: 音は出さない
    return gain;
  }

  #setBaseAttributes() {
    this.#setSpecs();
    this.#setSize();
    this.#calculateXCoordinates();
    this.#createBase();
    this.#drawBaseGraphics();
  }

  #setSpecs() {
    this.#sampleRate = this.#audioContext.sampleRate;
    const nyquist = this.#sampleRate / 2;
    const bandWidth = nyquist / this.#fftSize;

    this.#minFreq = bandWidth;
    this.#maxFreq = nyquist;
  }

  #setSize() {
    this.#labels?.layer?.remove();
    this.#grid?.layer?.remove();
    this.#spectrumLayer?.remove();

    const w = this.#p.width;
    const h = this.#p.height;

    // --- label
    const labelsLayer = this.#p.createGraphics(w * this.ratio, h * this.ratio);
    labelsLayer.elt.id = `${this.constructor.name}LabelGraphics`;
    const labelsSize = new CanvasSize(labelsLayer.width, labelsLayer.height);
    const labelsPosition = new CanvasPosition((w - labelsSize.width) * 0.5, (h - labelsSize.height) * 0.5);
    this.#labels = {
      layer: labelsLayer,
      size: labelsSize,
      position: labelsPosition,
    };

    // --- grid
    const gridLayer = this.#p.createGraphics(labelsSize.width * this.ratio, labelsSize.height * this.ratio);
    gridLayer.elt.id = `${this.constructor.name}GridGraphics`;

    const gridSize = new CanvasSize(gridLayer.width, gridLayer.height);
    const gridPosition = new CanvasPosition((w - gridSize.width) * 0.5, (h - gridSize.height) * 0.5);
    this.#grid = {
      layer: gridLayer,
      size: gridSize,
      position: gridPosition,
    };

    // --- spectrum
    this.#spectrumLayer = this.#p.createGraphics(gridSize.width, gridSize.height);
    this.#spectrumLayer.elt.id = `${this.constructor.name}SpectrumGraphics`;
  }

  #calculateXCoordinates() {
    this.#xCoordinatesCache = this.#xyRange.map((index) => {
      const x = this.#p.map(
        Math.log10(index * this.#minFreq || 1e-12),
        Math.log10(this.#minFreq),
        Math.log10(this.#maxFreq),
        0,
        this.#grid.size.width,
      );
      return x;
    });
  }

  #createBase() {
    this.#labels.layer.clear();
    this.#grid.layer.clear();

    const xDistance = (this.#labels.size.width - this.#grid.size.width) / 2;
    const yDistance = (this.#labels.size.height - this.#grid.size.height) / 2;

    const minLog = Math.log10(this.#minFreq);
    const maxLog = Math.log10(this.#maxFreq);

    // x: hz set
    const decades = Array.from(
      { length: Math.floor(maxLog) - Math.floor(minLog) + 1 },
      (_, d) => d + Math.floor(minLog),
    );

    // 10 で刻む
    const ticks = Array.from({ length: 9 }, (_, idx) => idx + 1);

    const digits = Math.floor(Math.log10(this.#minFreq));
    // 最低(20)hz 用
    const minimumFreq = Math.floor(this.#minFreq / 10 ** digits) * 10 ** digits;

    const majorColor = 100;
    const minorColor = 50;
    const baseColor = 25;
    const textColor = 25;

    this.#labels.layer.textFont('monospace');
    this.#labels.layer.textSize(8);
    this.#labels.layer.textAlign(this.#p.CENTER, this.#p.BOTTOM);
    this.#labels.layer.fill(textColor);

    // x: hz
    decades.forEach((decade, idx) => {
      ticks.forEach((tick) => {
        const freq = tick * 10 ** decade;

        if (freq < minimumFreq || freq >= this.#maxFreq) {
          return;
        }

        const isMajor = tick === 1;
        const x = this.#p.map(Math.log10(freq), minLog, maxLog, 0, this.#grid.size.width);

        if (tick % 2 === 0 || isMajor) {
          this.#grid.layer.stroke(isMajor ? majorColor : minorColor);
          this.#grid.layer.strokeWeight(isMajor ? 1 : 0.8);

          const ty = isMajor ? this.#labels.size.height - yDistance / 2 : this.#labels.size.height;
          const textLabel = freq >= 1000 ? `${freq / 1000}k` : `${freq}`;
          this.#labels.layer.text(textLabel, x + xDistance, ty);
        } else {
          this.#grid.layer.stroke(baseColor);
          this.#grid.layer.strokeWeight(0.4);
        }

        this.#grid.layer.line(x, 0, x, this.#grid.size.height);
      });
    });

    // y: db
    const dbTicks = Array.from(
      { length: Math.floor((this.maxDb - this.minDb) / this.dbStep) + 1 },
      (_, i) => this.minDb + i * this.dbStep,
    );

    this.#labels.layer.textAlign(this.#p.RIGHT, this.#p.BOTTOM);
    dbTicks.forEach((db) => {
      if (db <= this.minDb || db >= this.maxDb) {
        return;
      }
      const y = this.#p.map(db, this.minDb, this.maxDb, this.#grid.size.height, 0);
      const isMajor = db % 12 === 0;

      this.#grid.layer.stroke(isMajor ? 100 : 50);
      this.#grid.layer.strokeWeight(db === 0 ? 2 : isMajor ? 1 : 0.8);
      this.#grid.layer.line(0, y, this.#grid.size.width, y);
      this.#labels.layer.text(`${db}`, this.#labels.size.width, y + yDistance);
    });
  }

  #drawBaseGraphics() {
    this.#p.image(this.#labels.layer, ...this.#labels.position);
    this.#p.image(this.#grid.layer, ...this.#grid.position);
  }

  #hookWindowResized() {
    const originalWindowResized = this.#p.windowResized;
    this.#p.windowResized = (...args) => {
      originalWindowResized?.apply(this.#p, args);
      this.#setBaseAttributes();
    };
  }
}
