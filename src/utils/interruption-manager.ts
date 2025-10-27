import { TextToSpeech } from '../audio/tts';
import { ComplianceCheck } from '../llm/supervisor';

export class InterruptionManager {
  private tts: TextToSpeech | null;
  private accumulatedText: string = '';
  private isInterrupted: boolean = false;
  private demoMode: boolean;

  constructor(tts: TextToSpeech | null, demoMode: boolean = false) {
    this.tts = tts;
    this.demoMode = demoMode;
  }

  async handleStreamToken(token: string): Promise<void> {
    if (this.isInterrupted) return;

    this.accumulatedText += token;

    // Stream audio as we accumulate text (sentence-by-sentence)
    if (this.shouldFlushBuffer(token)) {
      if (this.demoMode) {
        console.log(`[STREAMING]: ${this.accumulatedText}`);
      } else if (this.tts) {
        await this.tts.speak(this.accumulatedText, { interruptible: true });
      }
      this.accumulatedText = '';
    }
  }

  async interrupt(compliance: ComplianceCheck): Promise<void> {
    this.isInterrupted = true;

    // Stop current TTS playback
    if (!this.demoMode && this.tts) {
      this.tts.interrupt();
    }

    // Speak redirect message
    if (compliance.redirect) {
      if (this.demoMode) {
        console.log(`\n[INTERRUPT]: ${compliance.redirect}\n`);
      } else if (this.tts) {
        await this.tts.speak(compliance.redirect, { interruptible: false });
      }
    }
  }

  private shouldFlushBuffer(token: string): boolean {
    // Flush on sentence boundaries for natural speech
    return ['.', '!', '?', '\n'].some(char => token.includes(char));
  }

  reset(): void {
    this.accumulatedText = '';
    this.isInterrupted = false;
  }

  getAccumulatedText(): string {
    return this.accumulatedText;
  }

  flushRemaining(): string {
    const remaining = this.accumulatedText;
    this.accumulatedText = '';
    return remaining;
  }
}
