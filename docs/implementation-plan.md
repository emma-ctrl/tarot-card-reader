# Voice AI Tarot Card Reader - Implementation Plan

**Tech Stack:** TypeScript, Node.js, ElevenLabs (STT/TTS), Cerebras (GPT-OSS-120B), OpenAI (GPT-4/5)

---

## Overview

A Voice AI Tarot Card Reader using dual-model concurrent architecture for low-latency, guided tarot readings. The system conducts quickfire personality questions, pulls a random tarot card, and delivers personalized interpretations while maintaining strict conversation control through supervisor monitoring.

---

**Key Constraints:**
- Must maintain very low latency for natural conversation flow
- Must keep user responses short (ideally one-word answers, max 30 seconds)
- Must prevent off-topic conversations (medical/legal advice, rambling)
- Must follow strict question sequence without deviation

---

## Desired End State

A fully functional voice AI tarot reader that:
1. Accepts real-time voice input via ElevenLabs STT
2. Processes responses through dual LLMs (Worker: Cerebras GPT-OSS-120B, Supervisor: GPT-4/5)
3. Guides users through a structured 5-question flow
4. Pulls a random tarot card via API
5. Delivers personalized readings synthesized via ElevenLabs TTS
6. Can interrupt mid-sentence if user violates conversation rules
7. Maintains <500ms perceived latency through streaming and filler words

### Verification Criteria:
- End-to-end conversation completes in under 3 minutes
- User can hear their tarot reading with their personality traits woven in
- System successfully redirects off-topic conversations
- No audio glitches or interruption artifacts
- Works in both production and demo (text-based) modes

---

## Architecture Insights (From Reference Project)

**Dual-Model Concurrent Design:**
- **Worker Thread** (Cerebras GPT-OSS-120B): Handles fast real-time conversation streaming
- **Supervisor Thread** (GPT-4/5): Monitors for rule violations in background

**Core Innovation:** Supervisor can interrupt mid-sentence if it detects rule violations

**Key Patterns to Apply:**
1. **Polling During Streaming**: Check `supervisor_task.done()` (non-blocking) during response streaming
2. **Fire-and-Forget Pattern**: If supervisor finishes late, handle asynchronously in background
3. **Immutable Snapshots**: Pass `conversation.copy()` to parallel tasks (prevent race conditions)
4. **Structured Outputs via BAML**: Use union types (`CompliancePass | ComplianceFail`) for type-safe LLM responses
5. **Thread-Safe Coordination**: Use proper async primitives instead of manual locks
6. **Graceful Degradation**: If supervisor fails, default to "ON_TRACK" (fail safe)

**Technical Highlights:**
- Smart silence detection with volume thresholding
- Async wrapping of all blocking I/O (STT, TTS, LLM calls)
- Demo mode for text-based testing without audio hardware
- Cross-platform audio with subprocess management for TTS interruption
- Colored terminal output for system state visibility

---

## What We're NOT Doing

- Multi-card spreads (only single card readings)
- User accounts or conversation history persistence
- Custom card interpretation training
- Mobile app (CLI/terminal only for v1)
- Payment processing
- Multi-language support (English only)
- Advanced tarot expertise (keeping it fun and lighthearted)

---

## Implementation Approach

**Strategy:**
Build incrementally from core infrastructure outward, testing each layer before adding the next. Start with synchronous flows, then add concurrency, then optimize for latency.

**Technology Decisions:**
- **Language:** TypeScript (type safety for complex async flows)
- **Runtime:** Node.js with native async/await
- **STT/TTS:** ElevenLabs (unified provider for both, proven low latency)
- **Worker LLM:** Cerebras GPT-OSS-120B (3000 tokens/sec, 128k context, $0.25/$0.69 per M tokens)
- **Supervisor LLM:** OpenAI GPT-4/5 (better reasoning for rule enforcement)
- **Tarot API:** tarotapi.dev (free, JSON responses, Rider-Waite-Smith deck)
- **Structured Outputs:** BAML (type-safe LLM responses)

---

## Phase 1: Project Setup & Core Infrastructure

### Overview
Establish TypeScript project structure with all necessary dependencies, configuration files, and API client scaffolding.

### Changes Required:

#### 1. TypeScript Configuration
**Files:** `package.json`, `tsconfig.json`, `.env.example`

**package.json:**
```json
{
  "name": "tarot-card-reader",
  "version": "1.0.0",
  "description": "Voice AI Tarot Card Reader",
  "main": "dist/index.js",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "lint": "eslint src --ext .ts",
    "format": "prettier --write \"src/**/*.ts\"",
    "test": "jest",
    "demo": "tsx src/index.ts --demo"
  },
  "dependencies": {
    "@boundaryml/baml": "^0.x.x",
    "dotenv": "^16.x.x",
    "elevenlabs": "^0.x.x",
    "openai": "^4.x.x",
    "axios": "^1.x.x",
    "chalk": "^5.x.x",
    "node-record-lpcm16": "^1.x.x"
  },
  "devDependencies": {
    "@types/node": "^20.x.x",
    "typescript": "^5.x.x",
    "tsx": "^4.x.x",
    "eslint": "^8.x.x",
    "@typescript-eslint/parser": "^6.x.x",
    "@typescript-eslint/eslint-plugin": "^6.x.x",
    "prettier": "^3.x.x",
    "jest": "^29.x.x",
    "@types/jest": "^29.x.x",
    "ts-jest": "^29.x.x"
  }
}
```

**tsconfig.json:**
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "commonjs",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "moduleResolution": "node",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "**/*.test.ts"]
}
```

**.env.example:**
```bash
# ElevenLabs
ELEVENLABS_API_KEY=your_api_key_here

# Cerebras (Worker LLM)
CEREBRAS_API_KEY=your_api_key_here

# OpenAI (Supervisor LLM)
OPENAI_API_KEY=your_api_key_here

# Application Config
DEMO_MODE=false
LOG_LEVEL=info
SUPERVISOR_ENABLED=true
```

#### 2. Project Directory Structure
**Command:** `mkdir -p src/{audio,llm,tarot,state,types,utils}`

```
src/
├── index.ts                 # Main entry point
├── config.ts                # Configuration loader
├── audio/
│   ├── stt.ts              # Speech-to-text (ElevenLabs)
│   ├── tts.ts              # Text-to-speech (ElevenLabs)
│   └── audio-manager.ts    # Audio I/O coordination
├── llm/
│   ├── worker.ts           # Cerebras GPT-OSS-120B client
│   ├── supervisor.ts       # GPT-4/5 client
│   └── types.ts            # LLM response types
├── tarot/
│   ├── api-client.ts       # Tarot API wrapper
│   └── types.ts            # Card and reading types
├── state/
│   ├── conversation.ts     # Conversation state machine
│   └── types.ts            # State types and enums
├── types/
│   └── index.ts            # Shared types
└── utils/
    ├── logger.ts           # Colored logging utility
    └── async-helpers.ts    # Async coordination utilities
```

#### 3. BAML Configuration
**File:** `baml_src/main.baml`

```baml
// Supervisor compliance check types
class CompliancePass {
  status "ON_TRACK"
  message string?
}

class ComplianceFail {
  status "OFF_TRACK"
  reason string
  redirect_message string
}

function CheckCompliance(conversation: Conversation) -> CompliancePass | ComplianceFail {
  client GPT4
  prompt #"
    You are monitoring a tarot card reading conversation.

    Rules to enforce:
    1. User must answer the specific question asked (one-word preferred, max 30 seconds)
    2. No medical or legal advice requests
    3. No off-topic rambling
    4. Keep conversation moving forward through the question flow

    Conversation so far:
    {{ conversation }}

    Is the user complying with the rules? If not, provide a gentle redirect.
  "#
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles without errors: `npm run build`
- [ ] Linting passes: `npm run lint`
- [ ] All dependencies install cleanly: `npm install`
- [ ] Project structure created: `ls -R src/`
- [ ] Environment variables load correctly: `node -e "require('dotenv').config(); console.log(process.env.ELEVENLABS_API_KEY ? 'OK' : 'FAIL')"`

#### Manual Verification:
- [ ] `.env` file created with actual API keys
- [ ] All directories and files exist as specified
- [ ] README updated with setup instructions
- [ ] Can run `npm run dev` without crashes

---

## Phase 2: Audio Pipeline (STT/TTS)

### Overview
Implement real-time audio input/output using ElevenLabs streaming APIs with proper silence detection and latency optimization.

### Changes Required:

#### 1. Speech-to-Text Module
**File:** `src/audio/stt.ts`

```typescript
import { ElevenLabsClient } from 'elevenlabs';
import { EventEmitter } from 'events';

export class SpeechToText extends EventEmitter {
  private client: ElevenLabsClient;
  private stream: any;
  private isListening: boolean = false;
  private silenceTimeout: NodeJS.Timeout | null = null;
  private readonly SILENCE_THRESHOLD_MS = 1500;

  constructor(apiKey: string) {
    super();
    this.client = new ElevenLabsClient({ apiKey });
  }

  async startListening(): Promise<void> {
    this.isListening = true;
    // Implementation: Set up streaming STT with ElevenLabs
    // Emit 'transcript' events with partial and final results
    // Emit 'silence' event after SILENCE_THRESHOLD_MS of no speech
  }

  stopListening(): void {
    this.isListening = false;
    if (this.stream) {
      this.stream.destroy();
    }
    this.clearSilenceTimeout();
  }

  private clearSilenceTimeout(): void {
    if (this.silenceTimeout) {
      clearTimeout(this.silenceTimeout);
      this.silenceTimeout = null;
    }
  }

  private onSpeechDetected(): void {
    this.clearSilenceTimeout();
  }

  private onSpeechEnded(): void {
    this.silenceTimeout = setTimeout(() => {
      this.emit('silence');
    }, this.SILENCE_THRESHOLD_MS);
  }
}
```

#### 2. Text-to-Speech Module
**File:** `src/audio/tts.ts`

```typescript
import { ElevenLabsClient } from 'elevenlabs';

export class TextToSpeech {
  private client: ElevenLabsClient;
  private currentPlayback: any = null;
  private readonly VOICE_ID = 'your-voice-id'; // Choose mystical-sounding voice

  constructor(apiKey: string) {
    super();
    this.client = new ElevenLabsClient({ apiKey });
  }

  async speak(text: string, options: { interruptible: boolean }): Promise<void> {
    // Implementation: Stream audio from ElevenLabs TTS
    // Use Turbo v2 model for lowest latency
    // Enable interruption capability via audio process management
    const stream = await this.client.textToSpeech.stream({
      text,
      voiceId: this.VOICE_ID,
      modelId: 'eleven_turbo_v2',
      optimizeStreamingLatency: 4,
      outputFormat: 'pcm_44100'
    });

    // Play audio with ability to interrupt
    this.currentPlayback = this.playAudioStream(stream);
  }

  interrupt(): void {
    if (this.currentPlayback) {
      this.currentPlayback.kill();
      this.currentPlayback = null;
    }
  }

  async injectFillerWord(): Promise<void> {
    const fillers = ['Hmm...', 'I see...', 'Interesting...', 'Let me think...'];
    const filler = fillers[Math.floor(Math.random() * fillers.length)];
    await this.speak(filler, { interruptible: true });
  }
}
```

#### 3. Audio Manager
**File:** `src/audio/audio-manager.ts`

```typescript
import { SpeechToText } from './stt';
import { TextToSpeech } from './tts';
import { EventEmitter } from 'events';

export class AudioManager extends EventEmitter {
  private stt: SpeechToText;
  private tts: TextToSpeech;
  private demoMode: boolean;

  constructor(apiKey: string, demoMode: boolean = false) {
    super();
    this.demoMode = demoMode;

    if (!demoMode) {
      this.stt = new SpeechToText(apiKey);
      this.tts = new TextToSpeech(apiKey);

      this.stt.on('transcript', (text: string) => {
        this.emit('user-speech', text);
      });

      this.stt.on('silence', () => {
        this.emit('user-silence');
      });
    }
  }

  async listen(): Promise<string> {
    if (this.demoMode) {
      return this.promptTextInput();
    }

    return new Promise((resolve) => {
      this.stt.startListening();
      this.once('user-silence', () => {
        this.stt.stopListening();
        // resolve with accumulated transcript
      });
    });
  }

  async speak(text: string, interruptible: boolean = false): Promise<void> {
    if (this.demoMode) {
      console.log(`[ASSISTANT]: ${text}`);
      return;
    }

    await this.tts.speak(text, { interruptible });
  }

  interrupt(): void {
    if (!this.demoMode) {
      this.tts.interrupt();
    }
  }

  private promptTextInput(): Promise<string> {
    // For demo mode: read from stdin
    return new Promise((resolve) => {
      process.stdout.write('[YOU]: ');
      process.stdin.once('data', (data) => {
        resolve(data.toString().trim());
      });
    });
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run build`
- [ ] Unit tests pass for audio modules: `npm test src/audio`
- [ ] ElevenLabs API connection succeeds: `npm run test:integration -- audio`
- [ ] No linting errors: `npm run lint`

#### Manual Verification:
- [ ] Can record voice input and see transcript in real-time
- [ ] Silence detection triggers after ~1.5 seconds
- [ ] TTS output is clear and natural-sounding
- [ ] Audio interruption works (TTS stops immediately)
- [ ] Demo mode works with text I/O (no audio hardware required)
- [ ] Latency feels responsive (< 500ms perceived delay)

**Implementation Note:** After completing this phase and all automated verification passes, test the audio pipeline manually with your microphone and speakers before proceeding to Phase 3.

---

## Phase 3: Conversation State Machine

### Overview
Implement the question flow state machine that guides users through personality questions, tracks responses, and manages conversation progression.

### Changes Required:

#### 1. State Types and Enums
**File:** `src/state/types.ts`

```typescript
export enum ConversationPhase {
  GREETING = 'GREETING',
  QUESTION_ELEMENT = 'QUESTION_ELEMENT',
  QUESTION_TIME = 'QUESTION_TIME',
  QUESTION_DECISION = 'QUESTION_DECISION',
  QUESTION_STYLE = 'QUESTION_STYLE',
  QUESTION_AREA = 'QUESTION_AREA',
  CARD_PULL = 'CARD_PULL',
  READING = 'READING',
  CLOSING = 'CLOSING',
  COMPLETE = 'COMPLETE'
}

export interface UserProfile {
  element?: 'fire' | 'water' | 'earth' | 'air';
  timePreference?: 'morning' | 'night';
  decisionStyle?: 'heart' | 'head';
  lifeStyle?: 'chaos' | 'control';
  focusArea?: 'love' | 'friendship' | 'work' | 'hobbies' | 'family' | 'wildcard';
}

export interface ConversationState {
  phase: ConversationPhase;
  profile: UserProfile;
  card?: TarotCard;
  transcript: Array<{ role: 'user' | 'assistant'; content: string; timestamp: Date }>;
}

export interface StateTransition {
  from: ConversationPhase;
  to: ConversationPhase;
  trigger: 'user-response' | 'card-drawn' | 'reading-complete';
}
```

#### 2. Conversation State Machine
**File:** `src/state/conversation.ts`

```typescript
import { ConversationPhase, ConversationState, UserProfile } from './types';
import { EventEmitter } from 'events';

export class ConversationStateMachine extends EventEmitter {
  private state: ConversationState;

  constructor() {
    super();
    this.state = {
      phase: ConversationPhase.GREETING,
      profile: {},
      transcript: []
    };
  }

  getState(): ConversationState {
    return { ...this.state }; // Return immutable copy
  }

  getCurrentQuestion(): string {
    const questions = {
      [ConversationPhase.GREETING]: "Welcome! Let's read your cards. First, what's your vibe?",
      [ConversationPhase.QUESTION_ELEMENT]: "Are you fire, water, earth, or air?",
      [ConversationPhase.QUESTION_TIME]: "Morning person or night owl?",
      [ConversationPhase.QUESTION_DECISION]: "Heart or head?",
      [ConversationPhase.QUESTION_STYLE]: "Chaos or control?",
      [ConversationPhase.QUESTION_AREA]: "Pick an area: love, friendship, work, hobbies, family, or wildcard?",
      [ConversationPhase.CARD_PULL]: "Let me pull a card for you...",
    };

    return questions[this.state.phase] || '';
  }

  addToTranscript(role: 'user' | 'assistant', content: string): void {
    this.state.transcript.push({
      role,
      content,
      timestamp: new Date()
    });
  }

  processUserResponse(response: string): boolean {
    const normalized = response.toLowerCase().trim();

    switch (this.state.phase) {
      case ConversationPhase.GREETING:
        this.transition(ConversationPhase.QUESTION_ELEMENT);
        return true;

      case ConversationPhase.QUESTION_ELEMENT:
        if (['fire', 'water', 'earth', 'air'].includes(normalized)) {
          this.state.profile.element = normalized as any;
          this.transition(ConversationPhase.QUESTION_TIME);
          return true;
        }
        return false;

      case ConversationPhase.QUESTION_TIME:
        if (normalized.includes('morning')) {
          this.state.profile.timePreference = 'morning';
          this.transition(ConversationPhase.QUESTION_DECISION);
          return true;
        } else if (normalized.includes('night')) {
          this.state.profile.timePreference = 'night';
          this.transition(ConversationPhase.QUESTION_DECISION);
          return true;
        }
        return false;

      case ConversationPhase.QUESTION_DECISION:
        if (['heart', 'head'].includes(normalized)) {
          this.state.profile.decisionStyle = normalized as any;
          this.transition(ConversationPhase.QUESTION_STYLE);
          return true;
        }
        return false;

      case ConversationPhase.QUESTION_STYLE:
        if (['chaos', 'control'].includes(normalized)) {
          this.state.profile.lifeStyle = normalized as any;
          this.transition(ConversationPhase.QUESTION_AREA);
          return true;
        }
        return false;

      case ConversationPhase.QUESTION_AREA:
        const validAreas = ['love', 'friendship', 'work', 'hobbies', 'family', 'wildcard'];
        if (validAreas.includes(normalized)) {
          this.state.profile.focusArea = normalized as any;
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

  private transition(newPhase: ConversationPhase): void {
    const oldPhase = this.state.phase;
    this.state.phase = newPhase;
    this.emit('phase-change', { from: oldPhase, to: newPhase });
  }

  isComplete(): boolean {
    return this.state.phase === ConversationPhase.COMPLETE;
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run build`
- [ ] State machine unit tests pass: `npm test src/state`
- [ ] All phase transitions work correctly: `npm test -- state-transitions`
- [ ] Profile data captured accurately: `npm test -- profile-capture`
- [ ] No linting errors: `npm run lint`

#### Manual Verification:
- [ ] State machine progresses through all phases in order
- [ ] Invalid responses are rejected (e.g., "blue" for element question)
- [ ] Profile data is captured correctly for all questions
- [ ] Transcript maintains full conversation history
- [ ] Phase transitions emit events correctly

**Implementation Note:** Test the state machine with various valid and invalid inputs before proceeding to Phase 4.

---

## Phase 4: Dual-Model LLM Integration

### Overview
Implement concurrent Worker (Cerebras) and Supervisor (GPT-4/5) LLM clients with polling-based interruption capability.

### Changes Required:

#### 1. Worker LLM Client (Cerebras)
**File:** `src/llm/worker.ts`

```typescript
import axios from 'axios';

export class WorkerLLM {
  private apiKey: string;
  private baseUrl = 'https://api.cerebras.ai/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async *streamResponse(prompt: string, conversationHistory: any[]): AsyncGenerator<string> {
    const response = await axios.post(
      `${this.baseUrl}/chat/completions`,
      {
        model: 'gpt-oss-120b',
        messages: [
          {
            role: 'system',
            content: `You are a mystical tarot card reader. Be concise, warm, and engaging.
                      Keep responses brief and conversational. Guide users through quick questions.`
          },
          ...conversationHistory,
          { role: 'user', content: prompt }
        ],
        stream: true,
        max_tokens: 150,
        temperature: 0.8
      },
      {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        responseType: 'stream'
      }
    );

    // Parse SSE stream and yield tokens
    for await (const chunk of response.data) {
      const lines = chunk.toString().split('\n').filter(line => line.trim());
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const json = line.slice(6);
          if (json === '[DONE]') return;

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
  }

  async generateReading(profile: UserProfile, card: TarotCard): Promise<string> {
    const prompt = `
      Give a personalized tarot reading for someone who is:
      - Element: ${profile.element}
      - Time: ${profile.timePreference}
      - Decision style: ${profile.decisionStyle}
      - Life style: ${profile.lifeStyle}
      - Focus area: ${profile.focusArea}

      The card drawn is: ${card.name} (${card.arcana})
      Meaning: ${card.meaning}

      Deliver a warm, mystical, and personalized 2-3 sentence reading.
    `;

    let fullResponse = '';
    for await (const token of this.streamResponse(prompt, [])) {
      fullResponse += token;
    }
    return fullResponse;
  }
}
```

#### 2. Supervisor LLM Client (GPT-4/5)
**File:** `src/llm/supervisor.ts`

```typescript
import { OpenAI } from 'openai';
import { ConversationState } from '../state/types';

export interface ComplianceCheck {
  status: 'ON_TRACK' | 'OFF_TRACK';
  reason?: string;
  redirect?: string;
}

export class SupervisorLLM {
  private client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({ apiKey });
  }

  async checkCompliance(state: ConversationState, userInput: string): Promise<ComplianceCheck> {
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
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a conversation compliance monitor.' },
          { role: 'user', content: prompt }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3,
        max_tokens: 200
      });

      const result = JSON.parse(response.choices[0].message.content || '{}');
      return result as ComplianceCheck;
    } catch (error) {
      // Graceful degradation: if supervisor fails, default to ON_TRACK
      console.error('Supervisor check failed:', error);
      return { status: 'ON_TRACK' };
    }
  }
}
```

#### 3. Concurrent LLM Coordinator
**File:** `src/llm/coordinator.ts`

```typescript
import { WorkerLLM } from './worker';
import { SupervisorLLM, ComplianceCheck } from './supervisor';
import { ConversationState } from '../state/types';

export class LLMCoordinator {
  private worker: WorkerLLM;
  private supervisor: SupervisorLLM;

  constructor(cerebrasKey: string, openaiKey: string) {
    this.worker = new WorkerLLM(cerebrasKey);
    this.supervisor = new SupervisorLLM(openaiKey);
  }

  async *streamResponseWithSupervision(
    prompt: string,
    state: ConversationState,
    userInput: string
  ): AsyncGenerator<{ token?: string; interrupt?: ComplianceCheck }> {
    // Fire-and-forget supervisor check with immutable snapshot
    const stateCopy = { ...state };
    const supervisorPromise = this.supervisor.checkCompliance(stateCopy, userInput);
    let supervisorDone = false;
    let complianceResult: ComplianceCheck | null = null;

    // Handle supervisor completion asynchronously
    supervisorPromise.then(result => {
      supervisorDone = true;
      complianceResult = result;
    }).catch(err => {
      console.error('Supervisor error:', err);
      supervisorDone = true;
      complianceResult = { status: 'ON_TRACK' }; // Graceful degradation
    });

    // Stream worker response while polling supervisor
    for await (const token of this.worker.streamResponse(prompt, state.transcript)) {
      // Poll supervisor (non-blocking)
      if (supervisorDone && complianceResult?.status === 'OFF_TRACK') {
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

    if (complianceResult?.status === 'OFF_TRACK') {
      yield { interrupt: complianceResult };
    }
  }

  async generateReading(profile: UserProfile, card: TarotCard): Promise<string> {
    return this.worker.generateReading(profile, card);
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run build`
- [ ] Worker LLM connects to Cerebras: `npm test -- worker-connection`
- [ ] Supervisor LLM connects to OpenAI: `npm test -- supervisor-connection`
- [ ] Streaming works correctly: `npm test -- streaming`
- [ ] Concurrent execution works: `npm test -- concurrent-llm`
- [ ] No linting errors: `npm run lint`

#### Manual Verification:
- [ ] Worker LLM generates natural, concise responses
- [ ] Supervisor correctly identifies off-topic inputs
- [ ] Interruption works mid-sentence when triggered
- [ ] Graceful degradation works (supervisor failure doesn't crash)
- [ ] Response quality is good for tarot readings
- [ ] Latency is acceptable (worker starts streaming quickly)

**Implementation Note:** Test with both compliant and non-compliant inputs to verify supervisor interruption. Ensure API keys have sufficient credits.

---

## Phase 5: Tarot Card Integration

### Overview
Integrate with tarotapi.dev to fetch random cards and structure card data for reading generation.

### Changes Required:

#### 1. Tarot Card Types
**File:** `src/tarot/types.ts`

```typescript
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

export interface CardDrawOptions {
  count?: number;
  reversed?: boolean;
}
```

#### 2. Tarot API Client
**File:** `src/tarot/api-client.ts`

```typescript
import axios from 'axios';
import { TarotCard, CardDrawOptions } from './types';

export class TarotAPIClient {
  private baseUrl = 'https://tarotapi.dev/api/v1';

  async drawRandomCard(options: CardDrawOptions = {}): Promise<TarotCard> {
    const count = options.count || 1;
    const response = await axios.get(`${this.baseUrl}/cards/random`, {
      params: { n: count }
    });

    const card = response.data.cards[0];

    // Randomly determine if card is reversed (optional feature)
    const isReversed = options.reversed !== undefined
      ? options.reversed
      : Math.random() < 0.3; // 30% chance of reversal

    return {
      name: card.name,
      arcana: card.arcana,
      suit: card.suit,
      value: card.value,
      meaning_up: card.meaning_up,
      meaning_rev: card.meaning_rev,
      desc: card.desc,
      image: card.image
    };
  }

  async getAllCards(): Promise<TarotCard[]> {
    const response = await axios.get(`${this.baseUrl}/cards`);
    return response.data.cards;
  }

  formatCardForDisplay(card: TarotCard, reversed: boolean = false): string {
    return `
╔══════════════════════════════════════╗
║  ${card.name.toUpperCase().padEnd(36)}  ║
╠══════════════════════════════════════╣
║  Arcana: ${card.arcana.padEnd(28)}  ║
${card.suit ? `║  Suit: ${card.suit.padEnd(30)}  ║` : ''}
╠══════════════════════════════════════╣
║  Meaning (${reversed ? 'Reversed' : 'Upright'}):              ║
║  ${(reversed ? card.meaning_rev : card.meaning_up).padEnd(36)}  ║
╚══════════════════════════════════════╝
    `.trim();
  }
}
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run build`
- [ ] API client connects successfully: `npm test -- tarot-api-connection`
- [ ] Random card draw works: `npm test -- draw-card`
- [ ] Card data structure is correct: `npm test -- card-schema`
- [ ] No linting errors: `npm run lint`

#### Manual Verification:
- [ ] Can draw random cards from API
- [ ] Card data includes all necessary fields (name, meaning, etc.)
- [ ] Card formatting looks good in terminal
- [ ] API response time is acceptable (< 1 second)
- [ ] Handles API failures gracefully

**Implementation Note:** Test drawing multiple cards to ensure randomness. Check API rate limits if applicable.

---

## Phase 6: Interruption & Latency Optimization

### Overview
Implement mid-sentence interruption capability, filler word injection, and comprehensive latency optimizations.

### Changes Required:

#### 1. Interruption Manager
**File:** `src/utils/interruption-manager.ts`

```typescript
import { TextToSpeech } from '../audio/tts';
import { ComplianceCheck } from '../llm/supervisor';

export class InterruptionManager {
  private tts: TextToSpeech;
  private accumulatedText: string = '';
  private isInterrupted: boolean = false;

  constructor(tts: TextToSpeech) {
    this.tts = tts;
  }

  async handleStreamToken(token: string): Promise<void> {
    if (this.isInterrupted) return;

    this.accumulatedText += token;

    // Stream audio as we accumulate text (sentence-by-sentence)
    if (this.shouldFlushBuffer(token)) {
      await this.tts.speak(this.accumulatedText, { interruptible: true });
      this.accumulatedText = '';
    }
  }

  async interrupt(compliance: ComplianceCheck): Promise<void> {
    this.isInterrupted = true;

    // Stop current TTS playback
    this.tts.interrupt();

    // Speak redirect message
    if (compliance.redirect) {
      await this.tts.speak(compliance.redirect, { interruptible: false });
    }
  }

  private shouldFlushBuffer(token: string): boolean {
    // Flush on sentence boundaries for natural speech
    return ['.', '!', '?', '\n'].some(char => token.includes(char));
  }

  reset(): void {
    this.accumulatedText = '';
    this.isInterrupted = false;
  }
}
```

#### 2. Latency Optimizer
**File:** `src/utils/latency-optimizer.ts`

```typescript
import { TextToSpeech } from '../audio/tts';

export class LatencyOptimizer {
  private tts: TextToSpeech;
  private readonly FILLER_THRESHOLD_MS = 800;

  constructor(tts: TextToSpeech) {
    this.tts = tts;
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
          await this.tts.injectFillerWord();
        }
        resolve();
      }, this.FILLER_THRESHOLD_MS);
    });

    const result = await Promise.race([
      operation.then(r => ({ result: r, done: true })),
      fillerTimeout.then(() => ({ result: null, done: false }))
    ]);

    if (!result.done) {
      // Filler was injected, wait for actual result
      return operation;
    }

    const elapsed = Date.now() - startTime;
    console.log(`[LATENCY] ${context}: ${elapsed}ms`);

    return result.result as T;
  }

  async preloadResources(): Promise<void> {
    // Pre-establish connections to APIs
    await Promise.all([
      this.warmupTTS(),
      this.warmupSTT(),
      this.warmupLLM()
    ]);
  }

  private async warmupTTS(): Promise<void> {
    // Send a tiny warmup request to establish connection
    await this.tts.speak('', { interruptible: false });
  }

  // Additional warmup methods...
}
```

#### 3. Main Orchestrator with Optimizations
**File:** `src/index.ts`

```typescript
import { AudioManager } from './audio/audio-manager';
import { ConversationStateMachine } from './state/conversation';
import { LLMCoordinator } from './llm/coordinator';
import { TarotAPIClient } from './tarot/api-client';
import { InterruptionManager } from './utils/interruption-manager';
import { LatencyOptimizer } from './utils/latency-optimizer';
import { loadConfig } from './config';
import chalk from 'chalk';

async function main() {
  const config = loadConfig();

  console.log(chalk.magenta.bold('\n✨ Welcome to the Tarot Card Reader ✨\n'));

  // Initialize components
  const audioManager = new AudioManager(config.elevenlabsKey, config.demoMode);
  const stateMachine = new ConversationStateMachine();
  const llmCoordinator = new LLMCoordinator(config.cerebrasKey, config.openaiKey);
  const tarotClient = new TarotAPIClient();
  const interruptionManager = new InterruptionManager(audioManager.tts);
  const latencyOptimizer = new LatencyOptimizer(audioManager.tts);

  // Preload resources
  console.log(chalk.gray('Preparing the cards...'));
  await latencyOptimizer.preloadResources();

  // Main conversation loop
  while (!stateMachine.isComplete()) {
    const question = stateMachine.getCurrentQuestion();

    // Speak question
    await audioManager.speak(question);
    stateMachine.addToTranscript('assistant', question);

    // Listen for user response
    const userInput = await audioManager.listen();
    stateMachine.addToTranscript('user', userInput);
    console.log(chalk.cyan(`[USER]: ${userInput}`));

    // Process response with dual-LLM supervision
    let interrupted = false;
    interruptionManager.reset();

    for await (const chunk of llmCoordinator.streamResponseWithSupervision(
      question,
      stateMachine.getState(),
      userInput
    )) {
      if (chunk.interrupt) {
        await interruptionManager.interrupt(chunk.interrupt);
        interrupted = true;
        break;
      }

      if (chunk.token) {
        await interruptionManager.handleStreamToken(chunk.token);
      }
    }

    if (interrupted) {
      console.log(chalk.yellow('[SUPERVISOR]: Conversation redirected'));
      continue; // Re-ask the question
    }

    // Update state machine with valid response
    const isValid = stateMachine.processUserResponse(userInput);

    if (!isValid) {
      await audioManager.speak("Hmm, I didn't quite catch that. Let me ask again.");
      continue;
    }

    // Special handling for card pull phase
    if (stateMachine.getState().phase === ConversationPhase.CARD_PULL) {
      await audioManager.speak("Drawing your card now...");

      const card = await latencyOptimizer.waitWithFiller(
        tarotClient.drawRandomCard(),
        'card-draw'
      );

      console.log(chalk.magenta('\n' + tarotClient.formatCardForDisplay(card) + '\n'));

      stateMachine.setCard(card);

      // Generate personalized reading
      const reading = await latencyOptimizer.waitWithFiller(
        llmCoordinator.generateReading(stateMachine.getState().profile, card),
        'reading-generation'
      );

      await audioManager.speak(reading);
      stateMachine.addToTranscript('assistant', reading);

      // Closing
      await audioManager.speak("Thank you for letting me read your cards. May your path be clear!");
      stateMachine.transition(ConversationPhase.COMPLETE);
    }
  }

  console.log(chalk.magenta.bold('\n✨ Reading complete. Until next time! ✨\n'));
}

main().catch(console.error);
```

### Success Criteria:

#### Automated Verification:
- [ ] TypeScript compiles: `npm run build`
- [ ] All unit tests pass: `npm test`
- [ ] Integration tests pass: `npm test:integration`
- [ ] No linting errors: `npm run lint`
- [ ] Build produces clean dist: `npm run build && ls dist/`

#### Manual Verification:
- [ ] Interruption works mid-sentence (test with off-topic input)
- [ ] Filler words inject naturally during long operations
- [ ] Perceived latency is < 500ms for most interactions
- [ ] Complete conversation flows smoothly end-to-end
- [ ] Card display looks good in terminal
- [ ] Reading incorporates user personality traits accurately
- [ ] Supervisor successfully catches medical/legal questions
- [ ] Graceful handling of API failures

**Implementation Note:** Test the complete flow multiple times with various personality combinations and intentionally trigger interruptions to validate supervisor behavior.

---

## Phase 7: Demo Mode & Testing

### Overview
Implement text-based demo mode for testing without audio hardware, add comprehensive logging, and create test suites.

### Changes Required:

#### 1. Enhanced Logger
**File:** `src/utils/logger.ts`

```typescript
import chalk from 'chalk';

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = LogLevel.INFO) {
    this.level = level;
  }

  debug(message: string, data?: any): void {
    if (this.level <= LogLevel.DEBUG) {
      console.log(chalk.gray(`[DEBUG] ${message}`), data || '');
    }
  }

  info(message: string, data?: any): void {
    if (this.level <= LogLevel.INFO) {
      console.log(chalk.blue(`[INFO] ${message}`), data || '');
    }
  }

  warn(message: string, data?: any): void {
    if (this.level <= LogLevel.WARN) {
      console.log(chalk.yellow(`[WARN] ${message}`), data || '');
    }
  }

  error(message: string, error?: any): void {
    if (this.level <= LogLevel.ERROR) {
      console.log(chalk.red(`[ERROR] ${message}`), error || '');
    }
  }

  phase(phase: string): void {
    console.log(chalk.magenta.bold(`\n▶ ${phase}\n`));
  }

  user(message: string): void {
    console.log(chalk.cyan(`[USER]: ${message}`));
  }

  assistant(message: string): void {
    console.log(chalk.green(`[ASSISTANT]: ${message}`));
  }

  supervisor(message: string): void {
    console.log(chalk.yellow(`[SUPERVISOR]: ${message}`));
  }

  latency(operation: string, ms: number): void {
    const color = ms < 500 ? chalk.green : ms < 1000 ? chalk.yellow : chalk.red;
    console.log(color(`[LATENCY] ${operation}: ${ms}ms`));
  }
}

export const logger = new Logger(
  process.env.LOG_LEVEL === 'debug' ? LogLevel.DEBUG : LogLevel.INFO
);
```

#### 2. Demo Mode Enhancements
**File:** `src/audio/audio-manager.ts` (update)

```typescript
// Add to AudioManager class:

private async promptTextInput(): Promise<string> {
  return new Promise((resolve) => {
    const readline = require('readline').createInterface({
      input: process.stdin,
      output: process.stdout
    });

    readline.question(chalk.cyan('[YOU]: '), (answer: string) => {
      readline.close();
      resolve(answer.trim());
    });
  });
}

async demonstrateFlow(): Promise<void> {
  console.log(chalk.magenta('\n═══════════════════════════════════════'));
  console.log(chalk.magenta('   DEMO MODE - Text-Based Interaction  '));
  console.log(chalk.magenta('═══════════════════════════════════════\n'));
  console.log(chalk.gray('Type your responses instead of speaking.\n'));
}
```

#### 3. Test Suites
**File:** `src/__tests__/integration.test.ts`

```typescript
import { ConversationStateMachine } from '../state/conversation';
import { TarotAPIClient } from '../tarot/api-client';

describe('Integration Tests', () => {
  test('Complete conversation flow', async () => {
    const stateMachine = new ConversationStateMachine();

    // Simulate full flow
    stateMachine.processUserResponse('fire');
    expect(stateMachine.getState().profile.element).toBe('fire');

    stateMachine.processUserResponse('morning');
    expect(stateMachine.getState().profile.timePreference).toBe('morning');

    // ... continue for all questions
  });

  test('Tarot API integration', async () => {
    const client = new TarotAPIClient();
    const card = await client.drawRandomCard();

    expect(card.name).toBeDefined();
    expect(card.meaning_up).toBeDefined();
  });

  test('Invalid responses rejected', () => {
    const stateMachine = new ConversationStateMachine();
    const result = stateMachine.processUserResponse('invalid-element');
    expect(result).toBe(false);
  });
});
```

#### 4. CLI Argument Parsing
**File:** `src/config.ts` (update)

```typescript
export function loadConfig() {
  const args = process.argv.slice(2);
  const demoMode = args.includes('--demo') || process.env.DEMO_MODE === 'true';
  const debug = args.includes('--debug') || process.env.LOG_LEVEL === 'debug';

  return {
    elevenlabsKey: process.env.ELEVENLABS_API_KEY || '',
    cerebrasKey: process.env.CEREBRAS_API_KEY || '',
    openaiKey: process.env.OPENAI_API_KEY || '',
    supervisorEnabled: process.env.SUPERVISOR_ENABLED !== 'false',
    demoMode,
    debug
  };
}
```

### Success Criteria:

#### Automated Verification:
- [ ] All unit tests pass: `npm test`
- [ ] Integration tests pass: `npm test:integration`
- [ ] TypeScript compiles: `npm run build`
- [ ] Linting passes: `npm run lint`
- [ ] Demo mode runs: `npm run demo`
- [ ] Coverage > 70%: `npm run test:coverage`

#### Manual Verification:
- [ ] Demo mode allows text-based testing without audio
- [ ] Complete conversation flow works end-to-end
- [ ] Logging provides clear visibility into system state
- [ ] Error messages are helpful and actionable
- [ ] Can run with `--debug` flag for verbose logging
- [ ] Performance is acceptable (complete reading in < 3 minutes)
- [ ] All edge cases handled gracefully (API failures, bad input, etc.)

**Implementation Note:** Test both production mode (with audio) and demo mode (text-based) thoroughly. Create a demo script that shows off all features.

---

## Testing Strategy

### Unit Tests:
- **State Machine:** All phase transitions, profile capture, invalid inputs
- **Audio Manager:** Silence detection, interruption handling, demo mode
- **LLM Clients:** API connectivity, streaming, error handling
- **Tarot Client:** Card fetching, formatting, error handling
- **Utilities:** Latency optimization, interruption management

### Integration Tests:
- **End-to-End Flow:** Complete conversation from greeting to reading
- **Dual-LLM Coordination:** Worker + supervisor concurrent execution
- **Interruption Scenarios:** Off-topic, medical, legal, rambling inputs
- **API Integration:** All external API calls (ElevenLabs, Cerebras, OpenAI, Tarot)

### Manual Testing Steps:
1. **Happy Path:** Run complete flow with valid inputs, verify reading quality
2. **Interruption Test:** Intentionally ask medical advice, verify redirect
3. **Invalid Inputs:** Provide wrong answers, verify re-prompting
4. **Latency Test:** Measure end-to-end timing, verify < 3 minute total
5. **Edge Cases:** Test API failures, empty responses, network issues
6. **Demo Mode:** Verify text-based interaction works without audio
7. **Voice Quality:** Test with real microphone/speakers, verify clarity
8. **Multiple Runs:** Execute 5+ complete readings to ensure consistency

---

## Performance Considerations

### Latency Targets:
- **STT Processing:** < 300ms from speech end to transcript
- **Worker LLM TTFB:** < 200ms (first token)
- **TTS Streaming:** < 500ms from text to first audio byte
- **Supervisor Check:** < 1000ms (async, doesn't block)
- **Tarot API:** < 500ms card fetch
- **Total Perceived Latency:** < 500ms between user speech end and AI response start

### Optimization Strategies:
1. **Streaming Everything:** STT, LLM, TTS all stream for progressive output
2. **Filler Word Injection:** Mask latency > 800ms with conversational fillers
3. **Preload Resources:** Establish API connections at startup
4. **Concurrent Execution:** Run supervisor in parallel with worker
5. **Sentence-Level Buffering:** Flush TTS on sentence boundaries for natural speech
6. **Model Selection:** Use Cerebras (3000 tok/s) and ElevenLabs Turbo v2
7. **Connection Pooling:** Reuse HTTP connections for API calls

### Resource Management:
- **Memory:** Keep conversation transcript bounded (< 1000 messages)
- **Connections:** Close audio streams properly to prevent leaks
- **Error Recovery:** Implement retries with exponential backoff for API calls
- **Rate Limiting:** Respect API rate limits (implement token bucket if needed)

---

## Migration Notes

Not applicable (greenfield project)

---

## References

- **Tarot API:** https://tarotapi.dev/docs
- **ElevenLabs Docs:** https://elevenlabs.io/docs
- **Cerebras Inference:** https://inference-docs.cerebras.ai/
- **OpenAI API:** https://platform.openai.com/docs
- **BAML Documentation:** https://docs.boundaryml.com/
- **Reference Architecture:** Dual-model concurrent design with supervisor interruption pattern

---

## Project Timeline Estimate

**Total Estimated Time:** 4-6 days (full-time development)

- Phase 1: Project Setup → 4 hours
- Phase 2: Audio Pipeline → 8 hours
- Phase 3: State Machine → 6 hours
- Phase 4: Dual-LLM Integration → 10 hours
- Phase 5: Tarot Integration → 4 hours
- Phase 6: Optimization → 8 hours
- Phase 7: Testing & Polish → 8 hours

---

## Next Steps

1. **Review this plan** - Confirm all phases make sense and requirements are captured
2. **Set up API accounts** - Get keys for ElevenLabs, Cerebras, OpenAI
3. **Create `.env` file** - Add all API keys
4. **Start Phase 1** - Run through automated and manual verification
5. **Proceed sequentially** - Complete each phase fully before moving to next
6. **Test frequently** - Run automated tests after each change
7. **Document learnings** - Update this plan with discoveries and adjustments

---

**Status:** ✅ Plan Complete - Ready for Implementation
