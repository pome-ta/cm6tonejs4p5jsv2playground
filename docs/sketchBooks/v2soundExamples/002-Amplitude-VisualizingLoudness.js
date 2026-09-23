// [p5.sound.js/examples/002-Amplitude-VisualizingLoudness/sketch.js at main · processing/p5.sound.js · GitHub](https://github.com/processing/p5.sound.js/blob/main/examples/002-Amplitude-VisualizingLoudness/sketch.js)

const sketch = (p) => {
  let sound;
  let amp;

  p.setup = async () => {
    // put setup code here
    sound = await p.loadSound('https://tonejs.github.io/audio/berklee/gong_1.mp3');

    const cnv = p.createCanvas(400, 400);
    cnv.mouseReleased(p.userStartAudio);

    p.textAlign(p.CENTER);
    p.fill(255);

    amp = new p5.Amplitude();
    sound.connect(amp);
  };

  p.draw = () => {
    // put drawing code here
    let level = amp.getLevel();
    level = p.map(level, 0, 0.2, 0, 255);
    p.background(level, 0, 0);
    p.text('click to play', p.width / 2, p.height / 2);
  };

  p.mouseReleased = () => {
    sound.play();
  };
};

new p5(sketch);
