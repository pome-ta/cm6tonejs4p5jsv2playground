import TapIndicator from 'modules/TapIndicator.js';

const sketch = (p) => {
  let tapIndicator;

  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  const v = 360;

  let mainTone;
  let lfo;
  let subTone;

  p.setup = () => {
    // put setup code here
    tapIndicator = new TapIndicator(p);

    cnvs = p.createCanvas(w, h);
    cnvs.mouseReleased(p.userStartAudio);

    p.colorMode(p.HSL, v, 1, 1);

    const audioCtx = p.getAudioContext();

    // Initialize the global Web Audio Context

    // 1. Create the primary sound source (Audible Main Oscillator)
    const mainOsc = audioCtx.createOscillator();
    mainOsc.type = 'sawtooth';
    mainOsc.frequency.value = 440 + p.random() * 440; // Base note: A4

    // 2. Create the Main Volume Node
    const mainGain = audioCtx.createGain();
    mainGain.gain.value = 0.3; // Lower volume to avoid clipping

    // 3. Create the LFO Node
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = 6; // 6 oscillations per second (Hz)

    // 4. Create the LFO Depth Node (Modulation Intensity)
    const lfoDepth = audioCtx.createGain();
    lfoDepth.gain.value = 30; // Modulates frequency by +/- 30Hz

    // --- THE CONNECTIONS ---
    // Route the modulation path: LFO -> Depth -> Main Oscillator Pitch
    lfo.connect(lfoDepth);
    lfoDepth.connect(mainOsc.frequency);

    // Route the audio path: Main Oscillator -> Master Volume -> Speakers
    mainOsc.connect(mainGain);
    mainGain.connect(audioCtx.destination);

    // Start both oscillators simultaneously
    lfo.start();
    mainOsc.start();

    /*
    const types = ['sine', 'triangle', 'sawtooth', 'square'];
    
    mainTone = new p5.Oscillator(440 + p.random() * 440, types[3]);
    mainTone.amp(0.4);
    mainTone.start();
    console.log(mainTone)
    console.log(mainTone.node.frequency)

    
    lfo = new p5.Oscillator(10, 'sine'); // 速さ
    lfo.amp(1); // 幅
    lfo.start();
    lfo.disconnect();
    //lfo.connect(mainTone.output);
    mainTone.connect(lfo)
    
    //mainTone.freq(lfo)
    */
  };

  p.draw = () => {
    // put drawing code here
    p.background(p.frameCount % v, 1, 0.5);
  };

  p.windowResized = (e) => {
    //console.log('windowResized');
    w = p.windowWidth;
    h = p.windowHeight;
    cnvs = p.resizeCanvas(w, h);
  };
};

new p5(sketch);
