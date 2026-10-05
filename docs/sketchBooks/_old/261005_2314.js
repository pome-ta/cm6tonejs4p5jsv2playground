// --- # example: Tone.Sampler mono82 AudioWorklet add
// [GitHub - kasaitakara/mono82: Simple music sequencer for everyone · GitHub](https://github.com/kasaitakara/mono82)

// [mono82/js/audio.js at main · kasaitakara/mono82 · GitHub](https://github.com/kasaitakara/mono82/blob/main/js/audio.js)

class MoktonFmVoiceProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const p = options.processorOptions || {};
    this.startTime = Number(p.startTime) || 0;
    this.stopTime = Number(p.stopTime) || this.startTime;
    this.note = Number(p.note) || 60;
    this.fmDepth = Math.max(0, Number(p.fmDepth) || 0);
    this.fmRatio = Math.max(0.25, Number(p.fmRatio) || 1);
    this.pitchLfos = Array.isArray(p.pitchLfos) ? p.pitchLfos : [];
    this.fmLfos = Array.isArray(p.fmLfos) ? p.fmLfos : [];
    this.carrierPhase = 0;
    this.modulatorPhase = 0;
    this.pitchRandomStates = this.pitchLfos.map((config) => this.makeRandomState(config));
    this.fmRandomStates = this.fmLfos.map((config) => this.makeRandomState(config));
  }

  frequency(note) {
    return 440 * Math.pow(2, (note - 69) / 12);
  }

  clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  makeRandomState(config) {
    if (config.wave !== 'random') {
      return null;
    }
    return {
      interval: 1 / Math.max(0.001, Number(config.rateHz) || 1), 
      nextTime: 0,
      value: Math.random() * 2 - 1,
    };
  }

  lfoWaveValue(config, elapsedSeconds, randomState) {
    const wave = config.wave;
    const rateHz = Math.max(0.001, Number(config.rateHz) || 1);
    if (wave === 'random') {
      while (elapsedSeconds >= randomState.nextTime) {
        randomState.value = Math.random() * 2 - 1;
        randomState.nextTime += randomState.interval;
      }
      return randomState.value;
    }
    if (wave === 'rise' || wave === 'fall') {
      return (wave === 'fall' ? 1 : -1) * (1 - this.clamp(elapsedSeconds * rateHz, 0, 1));
    }
    const phase = 2 * Math.PI * rateHz * elapsedSeconds;
    switch (wave) {
      case 'triangle':
        return (2 / Math.PI) * Math.asin(Math.sin(phase));
      case 'square':
        return Math.sin(phase) >= 0 ? 1 : -1;
      case 'sawUp':
        return ((elapsedSeconds * rateHz) % 1) * 2 - 1;
      case 'sawDown':
        return 1 - ((elapsedSeconds * rateHz) % 1) * 2;
      default:
        return Math.sin(phase);
    }
  }

  pitchDepthToCents(config) {
    const shaped = Math.pow(this.clamp(Number(config.depth) || 0, 0, 100) / 100, 2);
    return config.wave === 'rise' || config.wave === 'fall' ? shaped * 3600 : shaped * 1200;
  }

  process(inputs, outputs) {
    const channel = outputs[0]?.[0];
    if (!channel) {
      return true;
    }
    const blockStart = currentTime;
    if (blockStart >= this.stopTime) {
      return false;
    }
    const baseFrequency = this.frequency(this.note);
    
    for (let i = 0; i < channel.length; i++) {
      const sampleTime = blockStart + i / sampleRate;
      if (sampleTime < this.startTime || sampleTime >= this.stopTime) {
        channel[i] = 0;
        continue;
      }
      const elapsed = sampleTime - this.startTime;
      let pitchCents = 0;
      for (let n = 0; n < this.pitchLfos.length; n++) {
        pitchCents +=
          this.lfoWaveValue(this.pitchLfos[n], elapsed, this.pitchRandomStates[n]) *
          this.pitchDepthToCents(this.pitchLfos[n]);
      }
      const carrierFrequency = baseFrequency * Math.pow(2, pitchCents / 1200);
      let fmLfoAmount = 0;
      for (let n = 0; n < this.fmLfos.length; n++) {
        fmLfoAmount +=
          this.lfoWaveValue(this.fmLfos[n], elapsed, this.fmRandomStates[n]) *
          (this.clamp(Number(this.fmLfos[n].depth) || 0, 0, 100) / 100) *
          20;
      }
      const effectiveFmDepth = this.clamp(this.fmDepth + fmLfoAmount, 0, 40);
      const instantaneousFrequency =
        carrierFrequency + Math.sin(this.modulatorPhase) * (carrierFrequency * effectiveFmDepth * 0.1);
      channel[i] = Math.sin(this.carrierPhase);
      this.carrierPhase = (this.carrierPhase + (2 * Math.PI * instantaneousFrequency) / sampleRate) % (Math.PI * 2);
      this.modulatorPhase =
        (this.modulatorPhase + (2 * Math.PI * (baseFrequency * this.fmRatio)) / sampleRate) % (Math.PI * 2);
    }
    return true;
  }
}
registerProcessor('mokton-fm-voice', MoktonFmVoiceProcessor);
