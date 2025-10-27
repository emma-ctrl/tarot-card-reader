export interface TarotCard {
  name: string;
  arcana: "Major" | "Minor";
  suit?: "Wands" | "Cups" | "Swords" | "Pentacles";
  value?: string;
  meaning_up: string;
  meaning_rev: string;
  desc: string;
  image?: string;
}

export interface CardDrawOptions {
  count?: number;
  reversed?: boolean;
}
