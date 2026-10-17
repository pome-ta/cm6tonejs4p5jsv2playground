// --- # example: side chain

import * as Tone from 'tone';

import TapIndicator from 'modules/TapIndicator.js';
import SpectrumAnalyzer from 'modules/SpectrumAnalyzer.js';

const sketch = (p) => {
  // --- Sketch
  let cnvs;
  let w = p.windowWidth;
  let h = p.windowHeight;

  // --- Plugins
  const tapIndicator = new TapIndicator(p);
  const spectrumAnalyzer = new SpectrumAnalyzer(p, 2048);

  // --- Tone.js
  const ctx = p.getAudioContext();
  Tone.setContext(ctx, true);
  /* Starting Audio */
  document.addEventListener('pointerup', async () => await Tone.start(), {
    once: true,
  });

  const transport = Tone.getTransport();
  transport.bpm.value = 124;

  const toTime = (t) => new Tone.TimeClass(transport.context, t).toSeconds();

  const masterCh = new Tone.Channel().toDestination();
  const emitter = new Tone.Emitter();

  const kick = 'kick',
    crap = 'crap',
    rim = 'rim',
    snare = 'snare',
    hihat = 'hihat';
  const drumKit = new Tone.Players();
  drumKit.fadeIn = '1i';
  drumKit.fadeOut = '2i';

  // --- kick
  const kickSeq = new Tone.Sequence({
    callback: (time, _signal) => {
      drumKit.player(kick).start(time);
    },
    events: [
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, 1],
      [1, 1, 1, [1, 1]],
    ],
    subdivision: '1n',
  });

  // --- hihat
  const hihatSeq = new Tone.Sequence({
    callback: (time, _signal) => {
      drumKit.player(hihat).start(time);
    },
    events: [null, 1],
    subdivision: '8n',
    humanize: 0.005,
    // probability: 0.88,
  });

  // --- rim
  const rimSeq = new Tone.Sequence({
    callback: (time, _signal) => {
      drumKit.player(rim).start(time);
    },
    events: [null, 1],
    subdivision: '4n',
    //humanize: 0.005,
    // probability: 0.88,
  });

  // --- bass
  // const bassSynth = new Tone.MonoSynth({
  const bassSynth = new Tone.Synth({
    oscillator: { type: 'pulse', width: 0 },
    envelope: {
      attack: '1i',
      decay: 0.0,
      sustain: 1.0,
      release: '1i',
      attackCurve: 'exponential',
    },
  });
  const bassGain = new Tone.Gain(1);

  /*
  const sideChain = (a, b) => {
    console.log(a);
    console.log(b);
    // kickの出力からエンベロープ(振幅)を抽出

    // smoothingがattack/releaseの追従速度を決める
    
    const follower = new Tone.Follower(0.05);
    b.connect(follower);
    

    // followerの出力(0〜1程度)を反転してduck量にスケール
    // followerが大きい(kickが鳴っている)ほどbassGainのgainを下げたい

    // 入力0→output 1(素通し), 入力1→output 0.2(圧縮時)
    const duckScale = new Tone.Scale(1, 0.2);
    // followerの値を反転してScaleに渡す
    const invert = new Tone.Negate();
    // 0〜1 に戻すためのオフセット
    const offset = new Tone.Add(1);
    

    follower.chain(invert, offset, duckScale);
    //duckScale.connect(bassGain.gain);
    duckScale.connect(a.gain);
    //console.log(a.gain)
    
  };
  */

  const bassSeq = new Tone.Sequence({
    callback: (time, note) => {
      bassSynth.triggerAttack(note, time);
    },
    events: ['A5', , , 'G4'],
    subdivision: '4n',
  });
  //console.log(bassSynth)

  // メトロノーム
  const clickSynth = new Tone.MembraneSynth();
  const clickSeq = new Tone.Sequence({
    callback: (time, note) => {
      clickSynth.triggerAttackRelease(note, '1i', time);
    },
    events: ['A5', 'A4', 'A4', 'A4'],
    subdivision: '4n',
  });

  // --- mixer
  const drumCh = new Tone.Channel();
  drumKit.chain(
    ...[
      //
      drumCh,
    ].filter((n) => n),
  );

  const bassCh = new Tone.Channel(-8);
  bassSynth.chain(
    ...[
      //
      bassGain,
      bassCh,
    ].filter((n) => n),
  );

  const clickCh = new Tone.Channel(-4);
  clickSynth.chain(clickCh);

  const fanInNodes = [
    //
    drumCh,
    bassCh,
    clickCh,
  ];
  Tone.fanIn(...fanInNodes.filter((n) => n), masterCh);

  // --- emitter
  const drumSeqs = [
    //
    kickSeq,
    hihatSeq,
    rimSeq,
  ];
  /*
  emitter.once('startCall', (nowTime) => {
    transport.start(nowTime);
    transport.scheduleOnce((time) => {
      drumSeqs.forEach((seq) => {
        //seq.start(time);
      });
      clickSeq.start(time);
      bassSeq.start(time);
    }, 0);
  });
  */

  //p.setup = async () => {
  p.setup = () => {
    // put setup code here
    cnvs = p.createCanvas(w, h);

    /*

    const sideChain = (a, b) => {
      console.log(a);
      console.log(b);
      // kickの出力からエンベロープ(振幅)を抽出

      // smoothingがattack/releaseの追従速度を決める

      const follower = new Tone.Follower(0.1);
      b.connect(follower);

      // followerの出力(0〜1程度)を反転してduck量にスケール
      // followerが大きい(kickが鳴っている)ほどbassGainのgainを下げたい

      // 入力0→output 1(素通し), 入力1→output 0.2(圧縮時)
      const duckScale = new Tone.Scale(1, -0.2);
      // followerの値を反転してScaleに渡す
      const invert = new Tone.Negate();
      // 0〜1 に戻すためのオフセット
      const offset = new Tone.Add(1);

      follower.chain(invert, offset, duckScale);
      //duckScale.connect(bassGain.gain);
      duckScale.connect(a.gain);
      //console.log(a.gain)
    };

    // --- kick
    const kickBuffer = await Tone.Offline((context) => {
      context.transport.bpm.value = transport.bpm.value;
      const synth = new Tone.Synth({
        oscillator: { type: 'sine', phase: 270 },
        // oscillator: { type: 'sine', },
        // oscillator: { type: 'pulse', width: 0 },
        envelope: {
          attack: 0,
          decay: 1.75,
          sustain: 0.0,
          release: '1i',
          attackCurve: 'exponential',
        },
      });

      synth.triggerAttackRelease('A3', 0.775);
      synth.frequency.rampTo('C0', 0.125);

      synth.chain(
        ...[
          //,
          new Tone.Channel(8).toDestination(),
        ].filter((n) => n),
      );
    }, 1.5);

    // --- hihat
    const hihatBuffer = await Tone.Offline((context) => {
      context.transport.bpm.value = transport.bpm.value;

      const metalSynth = new Tone.MetalSynth({
        envelope: {
          attack: 0.0,
          decay: 1.9,
          sustain: 0.0,
          release: 0.01,
          attackCurve: 'exponential',
          decayCurve: 'exponential',
        },
        harmonicity: 5.1,
        modulationIndex: 32,
        octaves: 1.25,
        resonance: 3000,
      });
      metalSynth.triggerAttackRelease(980, '3i');

      metalSynth.chain(
        ...[
          //,
          new Tone.Channel(8).toDestination(),
        ].filter((n) => n),
      );
    }, 1.5);

    // --- rim
    const rimBuffer = await Tone.Offline((context) => {
      context.transport.bpm.value = transport.bpm.value;

      const whiteNoise = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: {
          attack: 0.0,
          decay: 1.0,
          sustain: 0.0,
          release: '1i',
        },
      });

      const chebyshev = new Tone.Chebyshev({
        order: 32,
        oversample: 'none',
      });
      const bandpass = new Tone.Filter({
        type: 'bandpass',
        frequency: 585,
        Q: 5.2,
        rolloff: -12, // -12, -24, -48, -96
        gain: 64,
      });
      const peaking = new Tone.Filter({
        type: 'peaking',
        frequency: 1980,
        Q: 0.2,
        rolloff: -48, // -12, -24, -48, -96
        gain: 10,
      });

      whiteNoise.chain(
        ...[
          // bitCrusher,
          chebyshev,
          bandpass,
          peaking,
          //,
          new Tone.Channel(2).toDestination(),
        ].filter((n) => n),
      );

      whiteNoise.triggerAttackRelease('24i');
    }, 1.5);

    drumKit.add(kick, kickBuffer);
    drumKit.player(kick).fadeIn = 0;
    drumKit.add(hihat, hihatBuffer);
    drumKit.add(rim, rimBuffer);

    //sideChain(bassGain, drumKit.player(kick));
    */

    /*
    emitter.once('startCall', (nowTime) => {
      transport.start(0);
      transport.scheduleOnce((time) => {
        drumSeqs.forEach((seq) => {
          //seq.start(time);
        });
        clickSeq.start(time);
        bassSeq.start(time);
      }, 0);
    });
    */

    //emitter.emit('startCall', transport.context.now());
    transport.start(0);
    //schedule
    
    //transport.scheduleOnce((time) => {
    transport.schedule((time) => {
      drumSeqs.forEach((seq) => {
        //seq.start(time);
      });
      clickSeq.start();
      bassSeq.start();
    //}, transport.context.now());
    }, 0);
    /*
    drumSeqs.forEach((seq) => {
      //seq.start(time);
    });
    clickSeq.start();
    bassSeq.start();
    */

    tapIndicator.setup();
    spectrumAnalyzer.targetNodes(masterCh);

    // p.noLoop();
    // p.frameRate(1);
  };

  p.draw = () => {
    // put drawing code here
    p.background(80);
    spectrumAnalyzer.drawGraph();
  };

  p.windowResized = (e) => {
    console.log('windowResized');
    w = p.windowWidth;
    h = p.windowHeight;
    cnvs = p.resizeCanvas(w, h);
  };
};

new p5(sketch);

