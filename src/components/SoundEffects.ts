class SoundFX {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // Lazy initializing Web Audio Context upon user interaction
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
  }

  public toggle(state?: boolean) {
    this.enabled = state !== undefined ? state : !this.enabled;
    return this.enabled;
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Simple synthetic click sound
   */
  public playClick() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;
      
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      
      osc.type = "sine";
      osc.frequency.setValueAtTime(600, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(150, this.ctx.currentTime + 0.08);
      
      gain.gain.setValueAtTime(0.05, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);
      
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      
      osc.start();
      osc.stop(this.ctx.currentTime + 0.08);
    } catch (e) {
      console.warn("Audio Context init blocked:", e);
    }
  }

  /**
   * Soccer referee double whistle sound (piiiii piiiiiiiii!)
   */
  public playWhistle() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const playSegment = (start: number, duration: number, pitchOffset: number = 0) => {
        if (!this.ctx) return;
        
        // Two oscillators to create the trilling metal whistle effect
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        // Fast trill LFO
        const lfo = this.ctx.createOscillator();
        const lfoGain = this.ctx.createGain();
        lfo.frequency.value = 65; // High-frequency trill
        lfoGain.gain.value = 50;  // FM depth
        
        osc1.frequency.value = 1100 + pitchOffset;
        osc2.frequency.value = 1120 + pitchOffset;
        
        lfo.connect(lfoGain);
        lfoGain.connect(osc1.frequency);
        lfoGain.connect(osc2.frequency);
        
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(0.12, start + 0.03);
        gain.gain.setValueAtTime(0.12, start + duration - 0.05);
        gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
        
        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(this.ctx.destination);
        
        lfo.start(start);
        osc1.start(start);
        osc2.start(start);
        
        lfo.stop(start + duration);
        osc1.stop(start + duration);
        osc2.stop(start + duration);
      };

      const now = this.ctx.currentTime;
      // Trill 1 (short): 0.15s
      playSegment(now, 0.12, -50);
      // Trill 2 (long, intense): 0.35s
      playSegment(now + 0.18, 0.35, 20);
    } catch (e) {
      console.warn("Whistle audio failed:", e);
    }
  }

  /**
   * Synthesize a roaring crowd cheer (GOOOOOOOAL!) using dynamic bandpass noise
   */
  public playGoalCheer() {
    if (!this.enabled) return;
    try {
      this.initCtx();
      if (!this.ctx) return;

      const now = this.ctx.currentTime;
      const bufferSize = this.ctx.sampleRate * 2; // 2 seconds
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      
      // Generate white noise
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
      
      const noiseNode = this.ctx.createBufferSource();
      noiseNode.buffer = buffer;
      
      // Filter the white noise so it sounds like a real crowd rumble
      const filter = this.ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.setValueAtTime(4, now);
      filter.frequency.setValueAtTime(150, now);
      
      // Simulate stadium crowd frequency swell (rumble rises up to high cheer)
      filter.frequency.exponentialRampToValueAtTime(650, now + 0.4);
      filter.frequency.linearRampToValueAtTime(300, now + 1.8);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.3, now + 0.15);
      gain.gain.setValueAtTime(0.3, now + 0.4);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 2.0);
      
      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);
      
      // Add a higher pitch horn to celebrate
      const horn = this.ctx.createOscillator();
      const hornGain = this.ctx.createGain();
      horn.type = "sawtooth";
      horn.frequency.setValueAtTime(320, now);
      horn.frequency.setValueAtTime(320, now + 0.3);
      horn.frequency.linearRampToValueAtTime(450, now + 0.7);
      
      hornGain.gain.setValueAtTime(0, now);
      hornGain.gain.linearRampToValueAtTime(0.08, now + 0.2);
      hornGain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      
      const hornFilter = this.ctx.createBiquadFilter();
      hornFilter.type = "lowpass";
      hornFilter.frequency.setValueAtTime(1000, now);
      
      horn.connect(hornFilter);
      hornFilter.connect(hornGain);
      hornGain.connect(this.ctx.destination);

      noiseNode.start(now);
      horn.start(now);
      
      noiseNode.stop(now + 2.0);
      horn.stop(now + 1.2);
    } catch (e) {
      console.warn("Goal cheer audio failed:", e);
    }
  }
}

export const sounds = new SoundFX();
export default sounds;
