import TapIndicator from '../../sketchBooks/modules/TapIndicator.js';

const sketch = (p) => {
  const v = 360;
  let tapIndicator;

  p.setup = () => {
    // put setup code here
    p.createCanvas(v, v);
    p.colorMode(p.HSL, v, 1, 1);

    tapIndicator = new TapIndicator(p);
  };

  p.draw = () => {
    // put drawing code here
    p.background(p.frameCount % v, 1, 0.5);

    p.strokeWeight(30);
    p.stroke('blue');
    p.line(25, 25, 75, 75);

    p.stroke('red');
    p.line(75, 25, 25, 75);
  };
};

new p5(sketch);
