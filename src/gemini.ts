// @ts-ignore
import { GoogleGenerativeAI } from "npm:@google/generative-ai@0.24.1";
import { Message } from "./database.ts";
import { buildWhatsAppPrompt } from "./prompts/index.ts";

export class GeminiService {
  private genAI: GoogleGenerativeAI;
  private model: any;
  private aiResponders: string[];

  constructor(apiKey: string, aiResponders: string[]) {
    this.genAI = new GoogleGenerativeAI(apiKey);
    this.model = this.genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    this.aiResponders = aiResponders;
  }

  async generateResponse(
    currentMessage: string,
    conversationHistory: Message[],
    isGroup: boolean,
    groupName?: string
  ): Promise<string> {
    try {
      // Build conversation context
      const context = this.buildConversationContext(
        conversationHistory,
        isGroup,
        groupName
      );

      // Generate prompt template
      const prompt = buildWhatsAppPrompt(currentMessage, context);

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Error generating Gemini response:", error);
      return "Sorry, I'm having trouble thinking of a response right now. 🤔";
    }
  }

  private buildConversationContext(
    history: Message[],
    isGroup: boolean,
    groupName?: string
  ): string {
    if (history.length === 0) {
      return "This is a new conversation.";
    }

    const contextLines: string[] = [];

    if (isGroup && groupName) {
      contextLines.push(`This is a group chat called "${groupName}".`);
    }

    contextLines.push("Recent conversation context:");

    // Add last 10 messages for context
    const recentMessages = history.slice(0, 10);
    for (const msg of recentMessages.reverse()) {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      const prefix = msg.isGroup ? `[${msg.groupName}] ` : "";
      contextLines.push(`${time} ${prefix}${msg.authorName}: ${msg.body}`);
    }

    return contextLines.join("\n");
  }

  async shouldRespond(message: string, authorName: string): Promise<boolean> {
    // Check if the author is in our AI responders list
    const shouldRespond = this.aiResponders.some(
      (responder) => authorName === responder || authorName.includes(responder)
    );

    return shouldRespond;
  }
}
