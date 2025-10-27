import { WorkerLLM } from "./worker";
import { SupervisorLLM, ComplianceCheck } from "./supervisor";
import { ConversationState, UserProfile } from "../state/types";
import { TarotCard } from "../tarot/types";

export interface StreamChunk {
  token?: string;
  interrupt?: ComplianceCheck;
}

export class LLMCoordinator {
  private worker: WorkerLLM;
  private supervisor: SupervisorLLM;
  private supervisorEnabled: boolean;

  constructor(
    cerebrasKey: string,
    openaiKey: string,
    supervisorEnabled: boolean = true,
  ) {
    this.worker = new WorkerLLM(cerebrasKey);
    this.supervisor = new SupervisorLLM(openaiKey);
    this.supervisorEnabled = supervisorEnabled;
  }

  async *streamResponseWithSupervision(
    prompt: string,
    state: ConversationState,
    userInput: string,
  ): AsyncGenerator<StreamChunk> {
    if (!this.supervisorEnabled) {
      // If supervisor is disabled, just stream worker response
      for await (const token of this.worker.streamResponse(
        prompt,
        state.transcript as any,
      )) {
        yield { token };
      }
      return;
    }

    // Fire-and-forget supervisor check with immutable snapshot
    const stateCopy = JSON.parse(JSON.stringify(state)); // Deep copy
    const supervisorPromise = this.supervisor.checkCompliance(
      stateCopy,
      userInput,
    );

    let supervisorDone = false;
    let complianceResult: ComplianceCheck = { status: "ON_TRACK" };

    // Handle supervisor completion asynchronously
    supervisorPromise
      .then((result: ComplianceCheck) => {
        supervisorDone = true;
        complianceResult = result;
      })
      .catch((err) => {
        console.error("[Coordinator] Supervisor error:", err);
        supervisorDone = true;
        complianceResult = { status: "ON_TRACK" }; // Graceful degradation
      });

    // Stream worker response while polling supervisor
    for await (const token of this.worker.streamResponse(
      prompt,
      state.transcript as any,
    )) {
      // Poll supervisor (non-blocking)
      if (supervisorDone && complianceResult.status === "OFF_TRACK") {
        // Interrupt mid-sentence!
        yield { interrupt: complianceResult };
        return;
      }

      yield { token };
    }

    // If supervisor finished late, check result after streaming completes
    if (!supervisorDone) {
      complianceResult = await supervisorPromise;
    }

    if (complianceResult.status === "OFF_TRACK") {
      yield { interrupt: complianceResult };
    }
  }

  async generateReading(
    profile: UserProfile,
    card: TarotCard,
    useSupervisionEnhancement: boolean = true,
  ): Promise<string> {
    console.log("[Coordinator] Generating reading with worker LLM...");
    const workerReading = await this.worker.generateReading(profile, card);

    if (!this.supervisorEnabled || !useSupervisionEnhancement) {
      return workerReading;
    }

    console.log("[Coordinator] Enhancing reading with supervisor LLM...");
    try {
      const enhancedReading = await this.supervisor.enhanceReading(
        workerReading,
        profile,
        card,
      );
      return enhancedReading;
    } catch (error) {
      console.error(
        "[Coordinator] Enhancement failed, using worker reading:",
        error,
      );
      return workerReading;
    }
  }

  async generateConversationalResponse(
    userInput: string,
    context: string,
  ): Promise<string> {
    return this.worker.generateConversationalResponse(userInput, context);
  }
}
