/**
 * Sunset City - Synthesized Audio System
 * Uses Web Audio API for programmatic sound effects and engine loops.
 */
export class SoundSystem {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.muted = false;
    this.engineOsc1 = null;
    this.engineOsc2 = null;
    this.engineFilter = null;
    this.engineNoise = null;
    this.engineGain = null;
    this.engineRunning = false;
    this.sirenOsc1 = null;
    this.sirenOsc2 = null;
    this.sirenGain = null;
    this.sirenTimer = null;
    this.sirenState = false;
  }

  ensure() {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtx) return;
      this.ctx = new AudioCtx();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = this.muted ? 0 : 0.5;
      this.masterGain.connect(this.ctx.destination);
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  setMuted(m) {
    this.muted = !!m;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.5, this.ctx.currentTime);
    }
  }

  engineStart() {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(40, now);
    osc.frequency.exponentialRampToValueAtTime(120, now + 0.6);
    gain.gain.setValueAtTime(0.01, now);
    gain.gain.linearRampToValueAtTime(0.3, now + 0.2);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.8);
  }

  engineHum(speed01 = 0) {
    this.ensure();
    if (!this.ctx || this.muted) return;
    if (this.engineRunning) {
      this.setEngine(speed01);
      return;
    }
    const now = this.ctx.currentTime;
    this.engineRunning = true;

    // Two detuned sawtooths for engine growl
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineGain = this.ctx.createGain();

    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'sawtooth';

    const baseFreq = 60 + speed01 * 180;
    this.engineOsc1.frequency.setValueAtTime(baseFreq, now);
    this.engineOsc2.frequency.setValueAtTime(baseFreq * 1.02, now);

    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.setValueAtTime(200 + speed01 * 800, now);
    this.engineFilter.Q.setValueAtTime(3, now);

    this.engineGain.gain.setValueAtTime(0.15, now);

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.masterGain);

    this.engineOsc1.start(now);
    this.engineOsc2.start(now);
  }

  setEngine(speed01 = 0) {
    if (!this.ctx || !this.engineRunning) return;
    const now = this.ctx.currentTime;
    const baseFreq = 50 + speed01 * 160;
    if (this.engineOsc1) {
      this.engineOsc1.frequency.setTargetAtTime(baseFreq, now, 0.1);
    }
    if (this.engineOsc2) {
      this.engineOsc2.frequency.setTargetAtTime(baseFreq * 1.02, now, 0.1);
    }
    if (this.engineFilter) {
      this.engineFilter.frequency.setTargetAtTime(180 + speed01 * 900, now, 0.1);
    }
    if (this.engineGain) {
      const vol = 0.05 + speed01 * 0.15;
      this.engineGain.gain.setTargetAtTime(vol, now, 0.1);
    }
  }

  stopEngine() {
    if (!this.ctx || !this.engineRunning) return;
    const now = this.ctx.currentTime;
    if (this.engineGain) {
      this.engineGain.gain.setValueAtTime(this.engineGain.gain.value, now);
      this.engineGain.gain.linearRampToValueAtTime(0.001, now + 0.2);
    }
    setTimeout(() => {
      try {
        if (this.engineOsc1) { this.engineOsc1.stop(); this.engineOsc1.disconnect(); }
        if (this.engineOsc2) { this.engineOsc2.stop(); this.engineOsc2.disconnect(); }
        if (this.engineFilter) { this.engineFilter.disconnect(); }
        if (this.engineGain) { this.engineGain.disconnect(); }
      } catch (e) {}
      this.engineOsc1 = null;
      this.engineOsc2 = null;
      this.engineFilter = null;
      this.engineNoise = null;
      this.engineGain = null;
      this.engineRunning = false;
    }, 250);
  }

  skid() {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.3;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.Q.setValueAtTime(6, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.3);
  }

  crash() {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.6;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(300, now);
    filter.frequency.exponentialRampToValueAtTime(80, now + 0.5);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.6);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);

    noise.start(now);
    noise.stop(now + 0.6);
  }

  gunshot() {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    
    // Noise crack
    const bufferSize = this.ctx.sampleRate * 0.15;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.setValueAtTime(800, now);

    const gain = this.ctx.createGain();
    gain.gain.setValueAtTime(0.4, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.masterGain);
    noise.start(now);
    noise.stop(now + 0.15);

    // Square blip punch
    const osc = this.ctx.createOscillator();
    const oscGain = this.ctx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(30, now + 0.1);
    oscGain.gain.setValueAtTime(0.3, now);
    oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);
    osc.connect(oscGain);
    oscGain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.1);
  }

  punchHit() {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(120, now);
    osc.frequency.exponentialRampToValueAtTime(40, now + 0.15);
    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  siren(on) {
    this.ensure();
    if (!this.ctx) return;
    if (!on) {
      if (this.sirenTimer) {
        clearInterval(this.sirenTimer);
        this.sirenTimer = null;
      }
      try {
        if (this.sirenOsc1) { this.sirenOsc1.stop(); this.sirenOsc1.disconnect(); }
        if (this.sirenGain) { this.sirenGain.disconnect(); }
      } catch (e) {}
      this.sirenOsc1 = null;
      this.sirenGain = null;
      this.sirenState = false;
      return;
    }

    if (this.sirenRunning || this.sirenTimer) return;
    this.sirenRunning = true;
    const now = this.ctx.currentTime;

    this.sirenOsc1 = this.ctx.createOscillator();
    this.sirenGain = this.ctx.createGain();
    this.sirenOsc1.type = 'sawtooth';
    this.sirenOsc1.frequency.setValueAtTime(600, now);

    this.sirenGain.gain.setValueAtTime(0.12, now);
    this.sirenOsc1.connect(this.sirenGain);
    this.sirenGain.connect(this.masterGain);
    this.sirenOsc1.start(now);

    let high = false;
    this.sirenTimer = setInterval(() => {
      if (!this.ctx || !this.sirenOsc1) return;
      const t = this.ctx.currentTime;
      high = !high;
      this.sirenOsc1.frequency.setTargetAtTime(high ? 900 : 600, t, 0.2);
    }, 450);
  }

  missionComplete() {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.12;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  pickup() {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [987.77, 1318.51]; // B5, E6
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.08;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.2, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.2);
    });
  }

  click() {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(800, now);
    osc.frequency.exponentialRampToValueAtTime(400, now + 0.04);
    gain.gain.setValueAtTime(0.15, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain);
    gain.connect(this.masterGain);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  gameOver() {
    this.ensure();
    if (!this.ctx || this.muted) return;
    const now = this.ctx.currentTime;
    const notes = [440, 415.30, 392, 349.23]; // A4, Ab4, G4, F4
    notes.forEach((freq, idx) => {
      const t = now + idx * 0.2;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.25, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.35);
      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(t);
      osc.stop(t + 0.35);
    });
  }
}
