import axios from "axios";
import { TarotCard, CardDrawOptions } from "./types";

export class TarotAPIClient {
  private baseUrl = "https://tarotapi.dev/api/v1";

  async drawRandomCard(options: CardDrawOptions = {}): Promise<TarotCard> {
    const count = options.count || 1;

    try {
      const response = await axios.get(`${this.baseUrl}/cards/random`, {
        params: { n: count },
      });

      const cardData = response.data.cards[0];

      // Randomly determine if card is reversed (optional feature)
      const isReversed =
        options.reversed !== undefined ? options.reversed : Math.random() < 0.3; // 30% chance of reversal

      const card: TarotCard = {
        name: cardData.name,
        arcana: cardData.type === "major" ? "Major" : "Minor",
        suit: cardData.suit,
        value: cardData.value,
        meaning_up: cardData.meaning_up,
        meaning_rev: cardData.meaning_rev,
        desc: cardData.desc,
        image: cardData.image,
      };

      return card;
    } catch (error) {
      console.error("[Tarot API] Error fetching card:", error);

      // Fallback to a default card if API fails
      return {
        name: "The Fool",
        arcana: "Major",
        meaning_up: "New beginnings, optimism, trust in life",
        meaning_rev: "Recklessness, taken advantage of, inconsideration",
        desc: "The Fool is a card of new beginnings, opportunity and potential.",
      };
    }
  }

  async getAllCards(): Promise<TarotCard[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/cards`);

      return response.data.cards.map((cardData: any) => ({
        name: cardData.name,
        arcana: cardData.type === "major" ? "Major" : "Minor",
        suit: cardData.suit,
        value: cardData.value,
        meaning_up: cardData.meaning_up,
        meaning_rev: cardData.meaning_rev,
        desc: cardData.desc,
        image: cardData.image,
      }));
    } catch (error) {
      console.error("[Tarot API] Error fetching all cards:", error);
      return [];
    }
  }

  formatCardForDisplay(card: TarotCard, reversed: boolean = false): string {
    const cardName = reversed ? `${card.name} (Reversed)` : card.name;
    const meaning = reversed ? card.meaning_rev : card.meaning_up;

    const lines = [
      "╔══════════════════════════════════════╗",
      `║  ${cardName.padEnd(36)}  ║`,
      "╠══════════════════════════════════════╣",
      `║  Arcana: ${card.arcana.padEnd(28)}  ║`,
    ];

    if (card.suit) {
      lines.push(`║  Suit: ${card.suit.padEnd(30)}  ║`);
    }

    if (card.value) {
      lines.push(`║  Value: ${card.value.padEnd(29)}  ║`);
    }

    lines.push("╠══════════════════════════════════════╣");
    lines.push(`║  Meaning:                            ║`);

    // Word wrap the meaning to fit in the box (34 chars per line)
    const words = meaning.split(" ");
    let currentLine = "";

    for (const word of words) {
      if ((currentLine + word).length > 34) {
        lines.push(`║  ${currentLine.padEnd(36)}  ║`);
        currentLine = word + " ";
      } else {
        currentLine += word + " ";
      }
    }

    if (currentLine.trim()) {
      lines.push(`║  ${currentLine.trim().padEnd(36)}  ║`);
    }

    lines.push("╚══════════════════════════════════════╝");

    return lines.join("\n");
  }

  getCardSummary(card: TarotCard): string {
    let summary = `${card.name} (${card.arcana} Arcana)`;

    if (card.suit) {
      summary += ` - ${card.suit}`;
    }

    if (card.value) {
      summary += ` ${card.value}`;
    }

    return summary;
  }
}
