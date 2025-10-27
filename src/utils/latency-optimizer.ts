import { AudioManager } from '../audio/audio-manager';

export class LatencyOptimizer {
  private audioManager: AudioManager;
  private readonly FILLER_THRESHOLD_MS = 800;

  constructor(audioManager: AudioManager) {
    this.audioManager = audioManager;
  }

  async waitWithFiller<T>(
    operation: Promise<T>,
    context: string = 'thinking'
  ): Promise<T> {
    const startTime = Date.now();
    let fillerInjected = false;

    // Race between operation and filler timeout
    const fillerTimeout = new Promise<void>((resolve) => {
      setTimeout(async () => {
        if (!fillerInjected) {
          fillerInjected = true;
          await this.audioManager.injectFiller();
        }
        resolve();
      }, this.FILLER_THRESHOLD_MS);
    });

    const result = await Promise.race([
      operation.then(r => ({ result: r, done: true })),
      fillerTimeout.then(() => ({ result: null as T | null, done: false }))
    ]);

    if (!result.done) {
      // Filler was injected, wait for actual result
      const finalResult = await operation;
      const elapsed = Date.now() - startTime;
      console.log(`[LATENCY] ${context}: ${elapsed}ms (filler injected)`);
      return finalResult;
    }

    const elapsed = Date.now() - startTime;
    console.log(`[LATENCY] ${context}: ${elapsed}ms`);

    return result.result as T;
  }

  async preloadResources(): Promise<void> {
    console.log('[LATENCY] Preloading resources...');

    // Pre-establish connections to APIs
    // Note: In production, you'd want to make actual warmup calls
    // For now, we'll just simulate the preload
    await new Promise(resolve => setTimeout(resolve, 100));

    console.log('[LATENCY] Resources preloaded');
  }

  trackOperation<T>(operation: () => Promise<T>, operationName: string): Promise<T> {
    const startTime = Date.now();

    return operation().then(result => {
      const elapsed = Date.now() - startTime;
      console.log(`[LATENCY] ${operationName}: ${elapsed}ms`);
      return result;
    }).catch(error => {
      const elapsed = Date.now() - startTime;
      console.log(`[LATENCY] ${operationName}: ${elapsed}ms (failed)`);
      throw error;
    });
  }

  logLatency(operationName: string, startTime: number): void {
    const elapsed = Date.now() - startTime;
    const emoji = elapsed < 500 ? '⚡' : elapsed < 1000 ? '⏱️' : '🐌';
    console.log(`${emoji} [LATENCY] ${operationName}: ${elapsed}ms`);
  }
}
