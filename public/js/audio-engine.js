export const GROOVES = [
  {
    id: 'straight-rock',
    label: 'Straight Rock',
    meter: '4/4',
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    pattern: {
      kick: [0, 8],
      snare: [4, 12],
      hat: [0, 2, 4, 6, 8, 10, 12, 14]
    }
  },
  {
    id: 'folk-pop',
    label: 'Folk Pop',
    meter: '4/4',
    beatsPerBar: 4,
    subdivisionsPerBeat: 4,
    pattern: {
      kick: [0, 10],
      snare: [4, 12],
      hat: [0, 2, 4, 6, 8, 10, 12, 14]
    }
  },
  {
    id: 'waltz',
    label: 'Waltz',
    meter: '3/4',
    beatsPerBar: 3,
    subdivisionsPerBeat: 4,
    pattern: {
      kick: [0],
      snare: [4, 8],
      hat: [0, 2, 4, 6, 8, 10]
    }
  },
  {
    id: 'compound-six',
    label: 'Compound 6/8',
    meter: '6/8',
    beatsPerBar: 6,
    subdivisionsPerBeat: 2,
    pattern: {
      kick: [0, 6],
      snare: [4, 10],
      hat: [0, 2, 4, 6, 8, 10]
    }
  }
];

function pulseGain(gainNode, time, peak, decay = 0.12) {
  gainNode.gain.cancelScheduledValues(time);
  gainNode.gain.setValueAtTime(0.0001, time);
  gainNode.gain.exponentialRampToValueAtTime(peak, time + 0.002);
  gainNode.gain.exponentialRampToValueAtTime(0.0001, time + decay);
}

export class AudioEngine {
  constructor(onBeat) {
    this.onBeat = onBeat;
    this.audioContext = null;
    this.noiseBuffer = null;
    this.tempo = 92;
    this.groove = GROOVES[1];
    this.schedulerId = null;
    this.isPlaying = false;
    this.currentStep = 0;
    this.nextStepTime = 0;
  }

  setTempo(tempo) {
    this.tempo = tempo;
  }

  setGroove(grooveId) {
    const groove = GROOVES.find((item) => item.id === grooveId);
    if (groove) this.groove = groove;
  }

  async ensureContext() {
    if (!this.audioContext) {
      const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
      this.audioContext = new AudioContextCtor();
      this.noiseBuffer = this.createNoiseBuffer();
    }
    if (this.audioContext.state === 'suspended') await this.audioContext.resume();
  }

  createNoiseBuffer() {
    const buffer = this.audioContext.createBuffer(1, this.audioContext.sampleRate * 0.25, this.audioContext.sampleRate);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < channel.length; index += 1) {
      channel[index] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  triggerKick(time) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(140, time);
    osc.frequency.exponentialRampToValueAtTime(52, time + 0.11);
    pulseGain(gain, time, 0.42, 0.16);
    osc.connect(gain).connect(this.audioContext.destination);
    osc.start(time);
    osc.stop(time + 0.18);
  }

  triggerSnare(time) {
    const noise = this.audioContext.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 1300;
    const gain = this.audioContext.createGain();
    pulseGain(gain, time, 0.17, 0.08);
    noise.connect(filter).connect(gain).connect(this.audioContext.destination);
    noise.start(time);
    noise.stop(time + 0.08);
  }

  triggerHat(time) {
    const noise = this.audioContext.createBufferSource();
    noise.buffer = this.noiseBuffer;
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 4500;
    const gain = this.audioContext.createGain();
    pulseGain(gain, time, 0.05, 0.03);
    noise.connect(filter).connect(gain).connect(this.audioContext.destination);
    noise.start(time);
    noise.stop(time + 0.03);
  }

  triggerClick(time, accent) {
    const osc = this.audioContext.createOscillator();
    const gain = this.audioContext.createGain();
    osc.type = 'triangle';
    osc.frequency.value = accent ? 1400 : 980;
    pulseGain(gain, time, accent ? 0.12 : 0.06, 0.035);
    osc.connect(gain).connect(this.audioContext.destination);
    osc.start(time);
    osc.stop(time + 0.04);
  }

  stepDuration() {
    return 60 / this.tempo / this.groove.subdivisionsPerBeat;
  }

  scheduleStep(time, stepIndex) {
    const beatIndex = Math.floor(stepIndex / this.groove.subdivisionsPerBeat);
    const isBeat = stepIndex % this.groove.subdivisionsPerBeat === 0;

    if (this.groove.pattern.kick.includes(stepIndex)) this.triggerKick(time);
    if (this.groove.pattern.snare.includes(stepIndex)) this.triggerSnare(time);
    if (this.groove.pattern.hat.includes(stepIndex)) this.triggerHat(time);
    if (isBeat) {
      this.triggerClick(time, beatIndex === 0);
      const delay = Math.max(0, (time - this.audioContext.currentTime) * 1000);
      window.setTimeout(() => this.onBeat(beatIndex), delay);
    }
  }

  scheduler = () => {
    const lookAhead = 0.15;
    const stepsPerBar = this.groove.beatsPerBar * this.groove.subdivisionsPerBeat;

    while (this.nextStepTime < this.audioContext.currentTime + lookAhead) {
      this.scheduleStep(this.nextStepTime, this.currentStep);
      this.nextStepTime += this.stepDuration();
      this.currentStep = (this.currentStep + 1) % stepsPerBar;
    }
  };

  async start() {
    await this.ensureContext();
    if (this.isPlaying) return;
    this.isPlaying = true;
    this.currentStep = 0;
    this.nextStepTime = this.audioContext.currentTime + 0.05;
    this.scheduler();
    this.schedulerId = window.setInterval(this.scheduler, 25);
  }

  stop() {
    this.isPlaying = false;
    if (this.schedulerId) {
      window.clearInterval(this.schedulerId);
      this.schedulerId = null;
    }
    this.onBeat(-1);
  }

  async toggle() {
    if (this.isPlaying) {
      this.stop();
      return false;
    }
    await this.start();
    return true;
  }
}
