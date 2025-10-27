import { ConversationPhase, ConversationState, UserProfile } from "./types";
import { TarotCard } from "../tarot/types";
import { EventEmitter } from "events";

export class ConversationStateMachine extends EventEmitter {
  private state: ConversationState;

  constructor() {
    super();
    this.state = {
      phase: ConversationPhase.GREETING,
      profile: {},
      transcript: [],
    };
  }

  getState(): ConversationState {
    return { ...this.state, profile: { ...this.state.profile } }; // Return immutable copy
  }

  getCurrentQuestion(): string {
    const questions: Record<ConversationPhase, string> = {
      [ConversationPhase.GREETING]:
        "Welcome! Let's read your cards. First, what's your vibe?",
      [ConversationPhase.QUESTION_ELEMENT]:
        "Are you fire, water, earth, or air?",
      [ConversationPhase.QUESTION_TIME]: "Morning person or night owl?",
      [ConversationPhase.QUESTION_DECISION]: "Heart or head?",
      [ConversationPhase.QUESTION_STYLE]: "Chaos or control?",
      [ConversationPhase.QUESTION_AREA]:
        "Pick an area: love, friendship, work, hobbies, family, or wildcard?",
      [ConversationPhase.CARD_PULL]: "Let me pull a card for you...",
      [ConversationPhase.READING]: "",
      [ConversationPhase.CLOSING]: "Thank you for letting me read your cards!",
      [ConversationPhase.COMPLETE]: "",
    };

    return questions[this.state.phase] || "";
  }

  addToTranscript(role: "user" | "assistant", content: string): void {
    this.state.transcript.push({
      role,
      content,
      timestamp: new Date(),
    });
  }

  processUserResponse(response: string): boolean {
    const normalized = response.toLowerCase().trim();

    switch (this.state.phase) {
      case ConversationPhase.GREETING:
        this.transition(ConversationPhase.QUESTION_ELEMENT);
        return true;

      case ConversationPhase.QUESTION_ELEMENT:
        if (["fire", "water", "earth", "air"].includes(normalized)) {
          this.state.profile.element = normalized as
            | "fire"
            | "water"
            | "earth"
            | "air";
          this.transition(ConversationPhase.QUESTION_TIME);
          return true;
        }
        return false;

      case ConversationPhase.QUESTION_TIME:
        if (normalized.includes("morning")) {
          this.state.profile.timePreference = "morning";
          this.transition(ConversationPhase.QUESTION_DECISION);
          return true;
        } else if (normalized.includes("night")) {
          this.state.profile.timePreference = "night";
          this.transition(ConversationPhase.QUESTION_DECISION);
          return true;
        }
        return false;

      case ConversationPhase.QUESTION_DECISION:
        if (["heart", "head"].includes(normalized)) {
          this.state.profile.decisionStyle = normalized as "heart" | "head";
          this.transition(ConversationPhase.QUESTION_STYLE);
          return true;
        }
        return false;

      case ConversationPhase.QUESTION_STYLE:
        if (["chaos", "control"].includes(normalized)) {
          this.state.profile.lifeStyle = normalized as "chaos" | "control";
          this.transition(ConversationPhase.QUESTION_AREA);
          return true;
        }
        return false;

      case ConversationPhase.QUESTION_AREA:
        const validAreas = [
          "love",
          "friendship",
          "work",
          "hobbies",
          "family",
          "wildcard",
        ];
        if (validAreas.includes(normalized)) {
          this.state.profile.focusArea = normalized as UserProfile["focusArea"];
          this.transition(ConversationPhase.CARD_PULL);
          return true;
        }
        return false;

      default:
        return false;
    }
  }

  setCard(card: TarotCard): void {
    this.state.card = card;
    this.transition(ConversationPhase.READING);
  }

  completeReading(): void {
    this.transition(ConversationPhase.CLOSING);
  }

  complete(): void {
    this.transition(ConversationPhase.COMPLETE);
  }

  private transition(newPhase: ConversationPhase): void {
    const oldPhase = this.state.phase;
    this.state.phase = newPhase;
    this.emit("phase-change", { from: oldPhase, to: newPhase });
  }

  isComplete(): boolean {
    return this.state.phase === ConversationPhase.COMPLETE;
  }
}
