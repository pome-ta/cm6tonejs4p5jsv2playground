class TapIndicator {
  #p;
  #pg;
  #markSize;

  baseColorHSB = [0.3, 0.1, 0.9];

  constructor(mainInstance, markSize = 48) {
    this.#p = mainInstance;
    this.#markSize = markSize;

    this.#initGraphics();
    this.#hookDraw();
  }

  #hookDraw() {
    const originalDraw = this.#p.draw;
    this.#p.draw = (...args) => {
      typeof originalDraw === 'function' && originalDraw.apply(this.#p, args);
      this.#render();
    };
  }

  #initGraphics() {
    this.#pg && this.#pg.remove();
    this.#pg = this.#p.createGraphics(this.#p.width, this.#p.height);

    if (this.#p.canvas) {
      this.#p.canvas.style.touchAction = 'none';
    }

    this.#pg.colorMode(this.#p.HSB, 1.0, 1.0, 1.0, 1.0);
    const pgColor = this.#pg.color(...this.baseColorHSB);
    pgColor.setAlpha(0.25, 1.0);
    this.#pg.fill(pgColor);
    this.#pg.noStroke();
    this.#pg.ellipseMode(this.#pg.CENTER);
  }

  #render() {
    if (!this.#pg) {
      return;
    }

    if (this.#pg.width !== this.#p.width || this.#pg.height !== this.#p.height) {
      this.#initGraphics();
    }

    this.#pg.clear();
    let hasInput = false;

    // スマホ等のタッチ入力チェック (マルチタッチ対応)
    if (Array.isArray(this.#p.touches) && this.#p.touches.length > 0) {
      for (const touch of this.#p.touches) {
        if (this.#isInsideCanvas(touch.x, touch.y)) {
          this.#pg.circle(touch.x, touch.y, this.#markSize);
          hasInput = true;
        }
      }
    }
    // PC等のマウス入力チェック (タッチがない場合)
    else if (this.#p.mouseIsPressed) {
      if (this.#isInsideCanvas(this.#p.mouseX, this.#p.mouseY)) {
        this.#pg.circle(this.#p.mouseX, this.#p.mouseY, this.#markSize);
        hasInput = true;
      }
    }

    if (hasInput) {
      this.#p.push();
      this.#p.blendMode(this.#p.DIFFERENCE);
      this.#p.image(this.#pg, 0, 0);
      this.#p.pop();
    }
  }

  #isInsideCanvas(x, y) {
    return x >= 0 && x <= this.#p.width && y >= 0 && y <= this.#p.height;
  }

  destroy() {
    if (this.#pg) {
      this.#pg.remove();
      this.#pg = null;
    }
  }
}

const sketch = (p) => {
  const v = 360;
  let tapIndicator;

  p.setup = () => {
    //p.noCanvas();
    // put setup code here
    p.createCanvas(v, v);
    p.colorMode(p.HSL, v, 1, 1);

    tapIndicator = new TapIndicator(p);
    //p.frameRate(8);
  };

  p.draw = () => {
    // put drawing code here
    p.background(p.frameCount % v, 1, 0.5);
    //tapIndicator.destroy()

    p.strokeWeight(30);
    p.stroke('blue');
    p.line(25, 25, 75, 75);

    p.stroke('red');
    p.line(75, 25, 25, 75);
  };
};

new p5(sketch);
