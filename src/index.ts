import { loadConfig } from "./config";
import { AudioManager } from "./audio/audio-manager";
import { ConversationStateMachine, ConversationPhase } from "./state";
import { LLMCoordinator } from "./llm";
import { TarotAPIClient } from "./tarot";
import { LatencyOptimizer } from "./utils";

async function main() {
  const config = loadConfig();

  console.log("🔮 Tarot Card Reader - Starting up...");
  console.log(`Demo Mode: ${config.demoMode}`);
  console.log(`Debug: ${config.debug}`);
  console.log(
    `Supervisor: ${config.supervisorEnabled ? "Enabled" : "Disabled"}`,
  );

  // Initialize components
  const audioManager = new AudioManager(config.elevenlabsKey, config.demoMode);
  const stateMachine = new ConversationStateMachine();
  const llmCoordinator = new LLMCoordinator(
    config.cerebrasKey,
    config.openaiKey,
    config.supervisorEnabled,
  );
  const tarotClient = new TarotAPIClient();
  const latencyOptimizer = new LatencyOptimizer(audioManager);

  // Preload resources for better performance
  await latencyOptimizer.preloadResources();

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

        // Draw a real card from the Tarot API with latency optimization
        console.log("\n[Connecting to Tarot API...]");
        const card = await latencyOptimizer.waitWithFiller(
          tarotClient.drawRandomCard(),
          "card-draw",
        );

        // Display the card beautifully
        console.log("\n" + tarotClient.formatCardForDisplay(card));
        console.log(`\n📋 ${tarotClient.getCardSummary(card)}\n`);

        stateMachine.setCard(card);
        continue;
      }

      if (currentState.phase === ConversationPhase.READING) {
        const profile = currentState.profile;
        const card = currentState.card;

        if (card) {
          // Generate AI-powered reading using LLM Coordinator with latency optimization
          console.log("\n[Generating personalized reading...]");
          const reading = await latencyOptimizer.waitWithFiller(
            llmCoordinator.generateReading(profile, card, true),
            "reading-generation",
          );

          await audioManager.speak(reading);
          stateMachine.addToTranscript("assistant", reading);
        }

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

    console.log(
      "\n✨ Phase 6 Interruption & Latency Optimization test complete!\n",
    );
    console.log("Final profile:", stateMachine.getState().profile);
    console.log("\nReading delivered with optimized latency and filler words!");
  } catch (error) {
    console.error("Error during conversation:", error);
  } finally {
    audioManager.close();
  }
}

main().catch(console.error);
