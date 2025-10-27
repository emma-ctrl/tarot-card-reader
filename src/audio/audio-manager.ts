import { SpeechToText } from "./stt";
import { TextToSpeech } from "./tts";
import { EventEmitter } from "events";
import * as readline from "readline";

export class AudioManager extends EventEmitter {
  private stt: SpeechToText | null = null;
  private tts: TextToSpeech | null = null;
  private demoMode: boolean;
  private rl: readline.Interface | null = null;

  constructor(apiKey: string, demoMode: boolean = false) {
    super();
    this.demoMode = demoMode;

    if (!demoMode) {
      this.stt = new SpeechToText(apiKey);
      this.tts = new TextToSpeech(apiKey);

      this.stt.on("transcript", (text: string) => {
        this.emit("user-speech", text);
      });

      this.stt.on("silence", () => {
        this.emit("user-silence");
      });
    } else {
      // Initialize readline for demo mode
      this.rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
      });
    }
  }

  async listen(): Promise<string> {
    if (this.demoMode) {
      return this.promptTextInput();
    }

    return new Promise((resolve) => {
      if (!this.stt) {
        resolve("");
        return;
      }

      let transcript = "";

      this.stt.on("transcript", (text: string) => {
        transcript = text;
      });

      this.stt.startListening();

      this.once("user-silence", () => {
        if (this.stt) {
          this.stt.stopListening();
        }
        resolve(transcript);
      });
    });
  }

  async speak(text: string, interruptible: boolean = false): Promise<void> {
    if (this.demoMode) {
      console.log(`\n[ASSISTANT]: ${text}\n`);
      return;
    }

    if (this.tts) {
      await this.tts.speak(text, { interruptible });
    }
  }

  interrupt(): void {
    if (!this.demoMode && this.tts) {
      this.tts.interrupt();
    }
  }

  async injectFiller(): Promise<void> {
    if (!this.demoMode && this.tts) {
      await this.tts.injectFillerWord();
    } else if (this.demoMode) {
      const fillers = [
        "Hmm...",
        "I see...",
        "Interesting...",
        "Let me think...",
      ];
      const filler = fillers[Math.floor(Math.random() * fillers.length)];
      console.log(`\n[ASSISTANT]: ${filler}\n`);
    }
  }

  private promptTextInput(): Promise<string> {
    // For demo mode: read from stdin
    return new Promise((resolve) => {
      if (!this.rl) {
        resolve("");
        return;
      }

      this.rl.question("[YOU]: ", (answer: string) => {
        resolve(answer.trim());
      });
    });
  }

  async demonstrateFlow(): Promise<void> {
    console.log("\n═══════════════════════════════════════");
    console.log("   DEMO MODE - Text-Based Interaction  ");
    console.log("═══════════════════════════════════════\n");
    console.log("Type your responses instead of speaking.\n");
  }

  close(): void {
    if (this.rl) {
      this.rl.close();
    }
    if (this.stt) {
      this.stt.stopListening();
    }
  }
}
