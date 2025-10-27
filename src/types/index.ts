// Shared types across the application

export interface TarotCard {
  name: string;
  arcana: 'Major' | 'Minor';
  suit?: 'Wands' | 'Cups' | 'Swords' | 'Pentacles';
  value?: string;
  meaning_up: string;
  meaning_rev: string;
  desc: string;
  image?: string;
}

export interface UserProfile {
  element?: 'fire' | 'water' | 'earth' | 'air';
  timePreference?: 'morning' | 'night';
  decisionStyle?: 'heart' | 'head';
  lifeStyle?: 'chaos' | 'control';
  focusArea?: 'love' | 'friendship' | 'work' | 'hobbies' | 'family' | 'wildcard';
}
