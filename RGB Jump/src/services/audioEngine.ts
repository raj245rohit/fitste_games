import type { ColorZone } from '../types/game';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // AudioContext will be initialized on first user gesture
  }

  private initCtx() {
    if (!this.ctx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  /**
   * Speak color name using SpeechSynthesis API with custom pitch/rate
   */
  public speakColor(color: ColorZone) {
    this.initCtx();
    if (this.isMuted) return;

    // Synthesize voice or fallback to speech synthesis
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel(); // cancel any active speech
      const text = color.toUpperCase();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 1.3;
      utterance.pitch = 1.2;
      utterance.volume = 1.0;

      // Select an English voice if available
      const voices = window.speechSynthesis.getVoices();
      const englishVoice = voices.find(v => v.lang.startsWith('en'));
      if (englishVoice) {
        utterance.voice = englishVoice;
      }

      window.speechSynthesis.speak(utterance);
    } else {
      // Fallback synthesizer tone if SpeechSynthesis is unavailable
      this.playColorTone(color);
    }
  }

  /**
   * Synth sound tone fallback for colors
   */
  private playColorTone(color: ColorZone) {
    if (!this.ctx || this.isMuted) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'triangle';
    const freqMap: Record<ColorZone, number> = {
      RED: 261.63,   // C4
      GREEN: 329.63, // E4
      BLUE: 392.00,  // G4
    };
    osc.frequency.value = freqMap[color];

    gain.gain.setValueAtTime(0.3, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.5);
  }

  /**
   * Sound effect: Countdown tick
   */
  public playCountdownTick(isFinal: boolean = false) {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(isFinal ? 880 : 440, this.ctx.currentTime); // A5 or A4

    gain.gain.setValueAtTime(0.2, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.15);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.15);
  }

  /**
   * Sound effect: Success chime
   */
  public playSuccess() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6 (Major arpeggio)

    notes.forEach((freq, idx) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + idx * 0.06);

      gain.gain.setValueAtTime(0.25, now + idx * 0.06);
      gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.06 + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + idx * 0.06);
      osc.stop(now + idx * 0.06 + 0.25);
    });
  }

  /**
   * Sound effect: Failure buzzer
   */
  public playFailure() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.5);

    gain.gain.setValueAtTime(0.35, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start(now);
    osc.stop(now + 0.5);
  }

  /**
   * Sound effect: Zone change pulse
   */
  public playZoneChange() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(300, this.ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(450, this.ctx.currentTime + 0.08);

    gain.gain.setValueAtTime(0.1, this.ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.08);

    osc.connect(gain);
    gain.connect(this.ctx.destination);

    osc.start();
    osc.stop(this.ctx.currentTime + 0.08);
  }

  /**
   * Sound effect: New High Score celebration
   */
  public playHighScoreFanfare() {
    this.initCtx();
    if (!this.ctx || this.isMuted) return;

    const now = this.ctx.currentTime;
    const sequence = [
      { freq: 440, time: 0, dur: 0.15 },
      { freq: 554.37, time: 0.15, dur: 0.15 },
      { freq: 659.25, time: 0.30, dur: 0.15 },
      { freq: 880, time: 0.45, dur: 0.40 },
    ];

    sequence.forEach(({ freq, time, dur }) => {
      const osc = this.ctx!.createOscillator();
      const gain = this.ctx!.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + time);

      gain.gain.setValueAtTime(0.3, now + time);
      gain.gain.exponentialRampToValueAtTime(0.001, now + time + dur);

      osc.connect(gain);
      gain.connect(this.ctx!.destination);

      osc.start(now + time);
      osc.stop(now + time + dur);
    });
  }
}

export const audioEngine = new AudioEngine();
