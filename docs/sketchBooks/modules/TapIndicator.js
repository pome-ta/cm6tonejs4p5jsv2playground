export default class TapIndicator {
  #p;
  #pg;
  #markSize;
  #markSizeRatio = [1, 0.64, 0.64, 0.48];

  baseColorHSB = [0.3, 0.1, 0.9];

  constructor(mainInstance, markSize = 64) {
    this.#p = mainInstance;
    this.#markSize = markSize;
    this.#pg = null;
  }

  setup(mainInstance = null, markSize = null) {
    this.#p = mainInstance || this.#p;
    this.#markSize = markSize || this.#markSize;
    this.#initGraphics();
    this.#hookDraw();
  }

  #hookDraw() {
    const originalDraw = this.#p.draw;
    this.#p.draw = (...args) => {
      originalDraw?.apply(this.#p, args);
      this.#render();
    };
  }

  #initGraphics() {
    this.#pg && this.#pg.remove();
    this.#pg = this.#p.createGraphics(this.#p.width, this.#p.height);
    this.#pg.elt.id = `${this.constructor.name}Graphics`;

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

  #drawCircle(x, y) {
    this.#markSizeRatio.forEach((ratio) => {
      this.#pg.circle(x, y, this.#markSize * ratio);
    });
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
          //this.#pg.circle(touch.x, touch.y, this.#markSize);
          this.#drawCircle(touch.x, touch.y);
          hasInput = true;
        }
      }
    }
    // PC等のマウス入力チェック (タッチがない場合)
    else if (this.#p.mouseIsPressed) {
      if (this.#isInsideCanvas(this.#p.mouseX, this.#p.mouseY)) {
        //this.#pg.circle(this.#p.mouseX, this.#p.mouseY, this.#markSize);
        this.#drawCircle(this.#p.mouseX, this.#p.mouseY);
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
