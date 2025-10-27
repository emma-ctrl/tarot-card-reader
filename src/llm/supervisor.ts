import { OpenAI } from "openai";
import { ConversationState } from "../state/types";

export interface ComplianceCheck {
  status: "ON_TRACK" | "OFF_TRACK";
  reason?: string;
  redirect?: string;
}

export class SupervisorLLM {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async checkCompliance(
    state: ConversationState,
    userInput: string,
  ): Promise<ComplianceCheck> {
    const prompt = `
      You are monitoring a tarot reading conversation.

      RULES TO ENFORCE:
      1. User must answer the specific question (one-word preferred, max 30 seconds)
      2. No medical or legal advice requests
      3. No off-topic rambling or unrelated topics
      4. Keep conversation moving forward through question flow

      Current question phase: ${state.phase}
      User's response: "${userInput}"

      Is this response compliant? If not, provide a gentle redirect message.

      Respond in JSON format:
      {
        "status": "ON_TRACK" | "OFF_TRACK",
        "reason": "why it's off track (if applicable)",
        "redirect": "gentle message to redirect user (if applicable)"
      }
    `;

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content: "You are a conversation compliance monitor.",
          },
          { role: "user", content: prompt },
        ],
        response_format: { type: "json_object" },
        temperature: 0.3,
        max_tokens: 200,
      });

      const result = JSON.parse(response.choices[0].message.content || "{}");
      return result as ComplianceCheck;
    } catch (error) {
      // Graceful degradation: if supervisor fails, default to ON_TRACK
      console.error("[Supervisor] Check failed:", error);
      return { status: "ON_TRACK" };
    }
  }

  async enhanceReading(
    workerReading: string,
    profile: any,
    card: any,
  ): Promise<string> {
    const prompt = `
      Enhance this tarot reading with deeper insights and poetic language.
      Keep it mystical, warm, and personal.

      Original reading: "${workerReading}"

      User profile:
      - Element: ${profile.element}
      - Time: ${profile.timePreference}
      - Decision: ${profile.decisionStyle}
      - Style: ${profile.lifeStyle}
      - Focus: ${profile.focusArea}

      Card: ${card.name}

      Provide an enhanced 3-4 sentence reading that's more profound and mystical.
    `;

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4",
        messages: [
          {
            role: "system",
            content:
              "You are a master tarot reader with deep spiritual insight.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 250,
      });

      return response.choices[0].message.content || workerReading;
    } catch (error) {
      console.error("[Supervisor] Enhancement failed:", error);
      return workerReading; // Graceful fallback
    }
  }
}
