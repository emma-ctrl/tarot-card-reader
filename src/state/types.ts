import { TarotCard } from "../tarot/types";

export enum ConversationPhase {
  GREETING = "GREETING",
  QUESTION_ELEMENT = "QUESTION_ELEMENT",
  QUESTION_TIME = "QUESTION_TIME",
  QUESTION_DECISION = "QUESTION_DECISION",
  QUESTION_STYLE = "QUESTION_STYLE",
  QUESTION_AREA = "QUESTION_AREA",
  CARD_PULL = "CARD_PULL",
  READING = "READING",
  CLOSING = "CLOSING",
  COMPLETE = "COMPLETE",
}

export interface UserProfile {
  element?: "fire" | "water" | "earth" | "air";
  timePreference?: "morning" | "night";
  decisionStyle?: "heart" | "head";
  lifeStyle?: "chaos" | "control";
  focusArea?:
    | "love"
    | "friendship"
    | "work"
    | "hobbies"
    | "family"
    | "wildcard";
}

export interface ConversationState {
  phase: ConversationPhase;
  profile: UserProfile;
  card?: TarotCard;
  transcript: Array<{
    role: "user" | "assistant";
    content: string;
    timestamp: Date;
  }>;
}

export interface StateTransition {
  from: ConversationPhase;
  to: ConversationPhase;
  trigger: "user-response" | "card-drawn" | "reading-complete";
}
