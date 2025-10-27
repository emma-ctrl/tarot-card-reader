// BAML Configuration for Supervisor compliance checking

client GPT4 {
  provider openai
  options {
    model "gpt-4"
    api_key env.OPENAI_API_KEY
  }
}

class CompliancePass {
  status "ON_TRACK"
  message string @description("Optional feedback message")
}

class ComplianceFail {
  status "OFF_TRACK"
  reason string @description("Why the response is off-track")
  redirect_message string @description("Message to redirect the user")
}

function CheckCompliance(conversation: string, userInput: string, currentPhase: string) -> (CompliancePass | ComplianceFail) {
  client GPT4
  prompt #"
    You are monitoring a tarot card reading conversation.

    Rules to enforce:
    1. User must answer the specific question asked (one-word preferred, max 30 seconds)
    2. No medical or legal advice requests
    3. No off-topic rambling or unrelated topics
    4. Keep conversation moving forward through question flow

    Current question phase: {{ currentPhase }}
    User's response: "{{ userInput }}"

    Conversation history:
    {{ conversation }}

    Is the user complying with the rules? If not, provide a gentle redirect message.
  "#
}
