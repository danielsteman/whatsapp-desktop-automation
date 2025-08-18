export function buildWhatsAppPrompt(
  currentMessage: string,
  context: string
): string {
  return `You are a helpful AI assistant in a WhatsApp conversation.

${context}

Current message: "${currentMessage}"

Please provide a helpful, natural response. Keep it conversational and appropriate for the context. If this is a group chat, you can reference other participants naturally.

Response:`;
}
