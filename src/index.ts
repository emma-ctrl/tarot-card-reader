import { loadConfig } from "./config";
import { AudioManager } from "./audio/audio-manager";
import { ConversationStateMachine, ConversationPhase } from "./state";

async function main() {
  const config = loadConfig();

  console.log("🔮 Tarot Card Reader - Starting up...");
  console.log(`Demo Mode: ${config.demoMode}`);
  console.log(`Debug: ${config.debug}`);

  // Initialize components
  const audioManager = new AudioManager(config.elevenlabsKey, config.demoMode);
  const stateMachine = new ConversationStateMachine();

  if (config.demoMode) {
    await audioManager.demonstrateFlow();
  }

  // Phase 3: State Machine Test - Guide user through personality questions
  try {
    await audioManager.speak("Welcome! Let's discover your tarot reading.");

    // Main conversation loop
    while (!stateMachine.isComplete()) {
      const currentState = stateMachine.getState();

      // Skip certain phases that don't need user input
      if (currentState.phase === ConversationPhase.CARD_PULL) {
        await audioManager.speak("Drawing your card now...");
        // Mock card for testing - will be replaced in Phase 5
        const mockCard = {
          name: "The Fool",
          arcana: "Major" as const,
          meaning_up: "New beginnings, optimism, trust in life",
          meaning_rev: "Recklessness, taken advantage of, inconsideration",
          desc: "The Fool is a card of new beginnings, opportunity and potential.",
        };
        stateMachine.setCard(mockCard);
        continue;
      }

      if (currentState.phase === ConversationPhase.READING) {
        const profile = currentState.profile;
        const card = currentState.card;
        await audioManager.speak(
          `Your card is ${card?.name}. As a ${profile.element} person who prefers ` +
            `${profile.timePreference} and follows their ${profile.decisionStyle}, ` +
            `with a ${profile.lifeStyle} lifestyle focusing on ${profile.focusArea}, ` +
            `this card suggests: ${card?.meaning_up}`,
        );
        stateMachine.completeReading();
        continue;
      }

      if (currentState.phase === ConversationPhase.CLOSING) {
        await audioManager.speak(
          "Thank you for this reading. May your path be illuminated!",
        );
        stateMachine.complete();
        continue;
      }

      // Ask the current question
      const question = stateMachine.getCurrentQuestion();
      await audioManager.speak(question);
      stateMachine.addToTranscript("assistant", question);

      // Get user response
      const userResponse = await audioManager.listen();
      console.log(`\n[User responded]: ${userResponse}`);
      stateMachine.addToTranscript("user", userResponse);

      // Process the response
      const isValid = stateMachine.processUserResponse(userResponse);

      if (!isValid) {
        await audioManager.speak(
          "Hmm, I didn't quite catch that. Let me ask again.",
        );
      }
    }

    console.log("\n✨ Phase 3 State Machine test complete!\n");
    console.log("Final profile:", stateMachine.getState().profile);
  } catch (error) {
    console.error("Error during conversation:", error);
  } finally {
    audioManager.close();
  }
}

main().catch(console.error);
