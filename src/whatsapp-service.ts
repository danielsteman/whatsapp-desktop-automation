import { Client, LocalAuth } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { DatabaseService, Message } from "./database.ts";
import { GeminiService } from "./gemini.ts";

export class WhatsAppService {
  private client: Client;
  private db: DatabaseService;
  private gemini: GeminiService;

  constructor(db: DatabaseService, gemini: GeminiService) {
    this.db = db;
    this.gemini = gemini;

    // Initialize the WhatsApp client
    this.client = new Client({
      puppeteer: {
        executablePath: "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      },
      authStrategy: new LocalAuth(),
      restartOnAuthFail: true,
      takeoverOnConflict: true,
    });

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    this.client.on("ready", () => {
      console.log("Client is ready!");
      // Session is automatically persisted by Chrome user data directory
      console.log("✅ WhatsApp session automatically persisted");
    });

    this.client.on("qr", (qr: string) => {
      console.log("📱 New QR code generated - please scan");
      qrcode.generate(qr, { small: true });
    });

    this.client.on("authenticated", (session: any) => {
      console.log("🔐 WhatsApp authenticated successfully");
      // Session will be saved when client is ready
    });

    this.client.on("auth_failure", (msg: string) => {
      console.log("❌ WhatsApp authentication failed:", msg);
      // Session will be handled automatically by LocalAuth
    });

    this.client.on("message_create", async (message: any) => {
      await this.handleMessage(message);
    });
  }

  private async handleMessage(message: any): Promise<void> {
    try {
      const contact = await message.getContact();
      let name =
        contact.pushname || contact.name || contact.number || contact.id.user;
      if (message.fromMe && this.client.info) {
        const myNumber = this.client.info.wid && this.client.info.wid.user;
        name = this.client.info.pushname || name || myNumber;
      }

      // Check if message is in a group chat
      const chat = await message.getChat();
      if (chat.isGroup) {
        const groupName = chat.name;
        const authorName = name;
        console.log(`[GROUP: ${groupName}] [${authorName}] ${message.body}`);

        // Store group chat info
        await this.db.storeChat(chat.id._serialized, groupName, true);
      } else {
        console.log(`[${name}] ${message.body}`);

        // Store individual chat info
        await this.db.storeChat(chat.id._serialized, name, false);
      }

      // Only store messages with actual content and ignore status updates
      // Also ignore AI-generated responses to prevent loops
      if (
        message.body &&
        message.body.trim().length > 0 &&
        message.type !== "protocol" &&
        message.type !== "revoke" &&
        message.type !== "e2e_notification" &&
        !message.body.includes("🤖") &&
        !message.body.includes("AI") &&
        !message.body.includes("Sorry, I'm having trouble")
      ) {
        // Skip all messages from me that are replies (these are AI-generated responses)
        if (message.fromMe && message.hasQuotedMsg) {
          console.log(`⏭️ Skipping AI-generated reply: "${message.body}"`);
          return;
        }

        const messageData: Message = {
          id: message.id._serialized,
          chatId: chat.id._serialized,
          authorId: contact.id._serialized,
          authorName: name,
          body: message.body,
          timestamp: message.timestamp * 1000, // Convert to milliseconds
          isGroup: chat.isGroup,
          groupName: chat.isGroup ? chat.name : undefined,
          messageType: message.type || "text",
          isAiGenerated: false, // Human messages are not AI-generated
        };

        await this.db.storeMessage(messageData);
        console.log(`✅ Message stored in database`);

        // Check if we should generate an AI response
        // Don't respond to AI-generated messages (prevents infinite loops)
        if (messageData.isAiGenerated) {
          console.log(`⏭️ Skipping AI response check for AI-generated message`);
        } else {
          console.log(
            `🔍 Checking if should respond to message from "${name}": "${message.body}"`
          );

          if (
            await this.gemini.shouldRespond(
              message.id._serialized,
              message.body,
              name
            )
          ) {
            console.log(`✅ Decided to respond to message from "${name}"`);

            try {
              await this.generateAndSendAIResponse(message, chat);
            } catch (error) {
              console.error("❌ Error in AI response flow:", error);
            }
          } else {
            console.log(`⏭️ Decided NOT to respond to message from "${name}"`);
          }
        }
      } else {
        console.log(
          `⏭️ Skipping message without content (type: ${message.type})`
        );
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  }

  private async generateAndSendAIResponse(
    message: any,
    chat: any
  ): Promise<void> {
    console.log("🤖 Generating AI response...");

    // Get conversation context
    console.log(
      `📚 Retrieving conversation context for chat: ${chat.id._serialized}`
    );
    const context = await this.db.getMessagesForContext(
      chat.id._serialized,
      20
    );
    console.log(`📚 Retrieved ${context.length} messages for context`);

    // Generate AI response
    console.log("🧠 Calling Gemini API...");
    const aiResponse = await this.gemini.generateResponse(
      message.body,
      context,
      chat.isGroup,
      chat.isGroup ? chat.name : undefined
    );
    console.log(`🧠 Gemini response received: "${aiResponse}"`);

    // Send the response
    console.log("📤 Sending AI response to WhatsApp...");
    await message.reply(aiResponse);
    console.log(`✅ AI response successfully sent: "${aiResponse}"`);

    // Mark this message as responded to prevent infinite loops
    this.gemini.markMessageAsResponded(message.id._serialized);
    console.log(`🔒 Message marked as responded to prevent loops`);
  }

  public async initialize(): Promise<void> {
    console.log("🚀 Initializing WhatsApp client...");
    await this.client.initialize();
  }

  public async shutdown(): Promise<void> {
    console.log("\nShutting down WhatsApp client...");
    await this.client.destroy();
  }
}
