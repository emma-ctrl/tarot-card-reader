import { ElevenLabsClient } from "elevenlabs";
import { EventEmitter } from "events";

export class SpeechToText extends EventEmitter {
  private client: ElevenLabsClient;
  private stream: any;
  private isListening: boolean = false;
  private silenceTimeout: NodeJS.Timeout | null = null;
  private readonly SILENCE_THRESHOLD_MS = 1500;
  private accumulatedTranscript: string = "";

  constructor(apiKey: string) {
    super();
    this.client = new ElevenLabsClient({ apiKey });
  }

  async startListening(): Promise<void> {
    this.isListening = true;
    this.accumulatedTranscript = "";

    // Implementation: Set up streaming STT with ElevenLabs
    // Emit 'transcript' events with partial and final results
    // Emit 'silence' event after SILENCE_THRESHOLD_MS of no speech

    // Note: This is a placeholder for the actual ElevenLabs STT implementation
    // The actual implementation would use ElevenLabs' streaming STT API
    console.log("[STT] Listening started...");

    // Start silence detection
    this.resetSilenceTimeout();
  }

  stopListening(): void {
    this.isListening = false;
    if (this.stream) {
      this.stream.destroy();
    }
    this.clearSilenceTimeout();
    console.log("[STT] Listening stopped.");
  }

  private clearSilenceTimeout(): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  private resetSilenceTimeout(): void {
    this.clearSilenceTimeout();
    this.silenceTimeout = setTimeout(() => {
      this.emit("silence");
    }, this.SILENCE_THRESHOLD_MS);
  }

  private onSpeechDetected(): void {
    this.clearSilenceTimeout();
  }

  private onSpeechEnded(): void {
    this.resetSilenceTimeout();
  }

  // Method to simulate transcript for testing
  simulateTranscript(text: string): void {
    this.accumulatedTranscript += text;
    this.emit("transcript", this.accumulatedTranscript);
  }

  getAccumulatedTranscript(): string {
    return this.accumulatedTranscript;
  }
}
