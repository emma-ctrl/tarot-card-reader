import axios from "axios";
import { UserProfile } from "../state/types";
import { TarotCard } from "../tarot/types";

interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export class WorkerLLM {
  private apiKey: string;
  private baseUrl = "https://api.cerebras.ai/v1";

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async *streamResponse(
    prompt: string,
    conversationHistory: Message[],
  ): AsyncGenerator<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/chat/completions`,
        {
          model: "llama3.1-8b",
          messages: [
            {
              role: "system",
              content: `You are a mystical tarot card reader. Be concise, warm, and engaging.
                        Keep responses brief and conversational. Guide users through quick questions.`,
            },
            ...conversationHistory,
            { role: "user", content: prompt },
          ],
          stream: true,
          max_tokens: 150,
          temperature: 0.8,
        },
        {
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            "Content-Type": "application/json",
          },
          responseType: "stream",
        },
      );

      // Parse SSE stream and yield tokens
      for await (const chunk of response.data) {
        const lines = chunk
          .toString()
          .split("\n")
          .filter((line: string) => line.trim());
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const json = line.slice(6);
            if (json === "[DONE]") return;

            try {
              const parsed = JSON.parse(json);
              const token = parsed.choices[0]?.delta?.content;
              if (token) yield token;
            } catch (e) {
              // Skip parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error("[Worker LLM] Error:", error);
      // Fallback: yield a simple response
      yield "I sense your energy...";
    }
  }

  async generateReading(
    profile: UserProfile,
    card: TarotCard,
  ): Promise<string> {
    const prompt = `
      Give a personalized tarot reading for someone who is:
      - Element: ${profile.element}
      - Time preference: ${profile.timePreference}
      - Decision style: ${profile.decisionStyle}
      - Life style: ${profile.lifeStyle}
      - Focus area: ${profile.focusArea}

      The card drawn is: ${card.name} (${card.arcana})
      Meaning: ${card.meaning_up}

      Deliver a warm, mystical, and personalized 2-3 sentence reading that weaves their personality traits into the card's meaning.
    `;

    let fullResponse = "";
    for await (const token of this.streamResponse(prompt, [])) {
      fullResponse += token;
    }
    return fullResponse.trim();
  }

  async generateConversationalResponse(
    userInput: string,
    context: string,
  ): Promise<string> {
    const prompt = `${context}\n\nUser said: "${userInput}"\n\nRespond briefly and naturally.`;

    let fullResponse = "";
    for await (const token of this.streamResponse(prompt, [])) {
      fullResponse += token;
    }
    return fullResponse.trim();
  }
}
