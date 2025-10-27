import { ElevenLabsClient } from "elevenlabs";
import { spawn, ChildProcess } from "child_process";

export interface SpeakOptions {
  interruptible: boolean;
}

export class TextToSpeech {
  private client: ElevenLabsClient;
  private currentPlayback: ChildProcess | null = null;
  private readonly VOICE_ID = "pNInz6obpgDQGcFmaJgB"; // Adam voice (warm, clear)

  constructor(apiKey: string) {
    this.client = new ElevenLabsClient({ apiKey });
  }

  async speak(text: string, options: SpeakOptions): Promise<void> {
    // Implementation: Stream audio from ElevenLabs TTS
    // Use Turbo v2 model for lowest latency
    // Enable interruption capability via audio process management

    try {
      const audio = await this.client.generate({
        voice: this.VOICE_ID,
        text,
        model_id: "eleven_turbo_v2",
      });

      // Play audio with ability to interrupt
      await this.playAudioStream(audio, options.interruptible);
    } catch (error) {
      console.error("[TTS] Error:", error);
      // Graceful fallback: just print the text
      console.log(`[TTS FALLBACK]: ${text}`);
    }
  }

  interrupt(): void {
    if (this.currentPlayback) {
      this.currentPlayback.kill("SIGTERM");
      this.currentPlayback = null;
      console.log("[TTS] Playback interrupted.");
    }
  }

  async injectFillerWord(): Promise<void> {
    const fillers = ["Hmm...", "I see...", "Interesting...", "Let me think..."];
    const filler = fillers[Math.floor(Math.random() * fillers.length)];
    await this.speak(filler, { interruptible: true });
  }

  private async playAudioStream(
    audio: any,
    interruptible: boolean,
  ): Promise<void> {
    return new Promise(async (resolve, reject) => {
      // Use afplay on macOS, aplay on Linux, or other platform-specific player
      const platform = process.platform;
      let player: string;
      let args: string[];

      if (platform === "darwin") {
        // macOS - afplay can play mp3 directly
        player = "afplay";
        args = ["-"];
      } else if (platform === "linux") {
        // Linux
        player = "mpg123";
        args = ["-"];
      } else {
        // Windows or other - fallback to just logging
        console.log("[TTS] Audio playback not supported on this platform");
        resolve();
        return;
      }

      try {
        this.currentPlayback = spawn(player, args);

        // Write audio buffer to stdin
        if (this.currentPlayback.stdin) {
          // Handle the audio as a stream or buffer
          if (audio.pipe) {
            audio.pipe(this.currentPlayback.stdin);
          } else {
            // If it's a buffer/array, write it directly
            for await (const chunk of audio) {
              if (this.currentPlayback && this.currentPlayback.stdin) {
                this.currentPlayback.stdin.write(chunk);
              }
            }
            if (this.currentPlayback && this.currentPlayback.stdin) {
              this.currentPlayback.stdin.end();
            }
          }
        }

        this.currentPlayback.on("close", (code) => {
          this.currentPlayback = null;
          if (code === 0 || code === null) {
            resolve();
          } else {
            reject(new Error(`Audio player exited with code ${code}`));
          }
        });

        this.currentPlayback.on("error", (error) => {
          this.currentPlayback = null;
          reject(error);
        });
      } catch (error) {
        reject(error);
      }
    });
  }
}
