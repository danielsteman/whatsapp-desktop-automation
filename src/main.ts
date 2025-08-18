import { Client } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { DatabaseService, Message } from "./database.ts";
import { GeminiService } from "./gemini.ts";
import { loadConfig } from "./config.ts";
import { WhatsAppSessionManager } from "./whatsapp-session.ts";

// Load configuration
const config = await loadConfig();

const db = new DatabaseService();
const gemini = new GeminiService(config.GEMINI_API_KEY, config.aiResponders);
const sessionManager = new WhatsAppSessionManager();

// Check if we have a valid session
const savedSession = sessionManager.getSession();
if (savedSession) {
  console.log("🔄 Attempting to use saved session...");
} else {
  console.log("📱 No saved session found, will need QR code");
}

const client = new Client({
  puppeteer: {
    executablePath: "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
    // Add user data directory for session persistence
    userDataDir: "./chrome-user-data",
  },
  // Add session persistence options
  restartOnAuthFail: true,
  takeoverOnConflict: true,
});

client.on("ready", () => {
  console.log("Client is ready!");

  // Session is automatically persisted by Chrome user data directory
  console.log("✅ WhatsApp session automatically persisted");
});

client.on("qr", (qr: string) => {
  console.log("📱 New QR code generated - please scan");
  qrcode.generate(qr, { small: true });
});

client.on("authenticated", (session: any) => {
  console.log("🔐 WhatsApp authenticated successfully");
  // Session will be saved when client is ready
});

client.on("auth_failure", (msg: string) => {
  console.log("❌ WhatsApp authentication failed:", msg);
  sessionManager.deleteSession();
});

client.on("message_create", async (message: any) => {
  try {
    const contact = await message.getContact();
    let name =
      contact.pushname || contact.name || contact.number || contact.id.user;
    if (message.fromMe && client.info) {
      const myNumber = client.info.wid && client.info.wid.user;
      name = client.info.pushname || name || myNumber;
    }

    // Check if message is in a group chat
    const chat = await message.getChat();
    if (chat.isGroup) {
      const groupName = chat.name;
      const authorName = name;
      console.log(`[GROUP: ${groupName}] [${authorName}] ${message.body}`);

      // Store group chat info
      await db.storeChat(chat.id._serialized, groupName, true);
    } else {
      console.log(`[${name}] ${message.body}`);

      // Store individual chat info
      await db.storeChat(chat.id._serialized, name, false);
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

      await db.storeMessage(messageData);
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
          await gemini.shouldRespond(message.id._serialized, message.body, name)
        ) {
          console.log(`✅ Decided to respond to message from "${name}"`);

          try {
            console.log("🤖 Generating AI response...");

            // Get conversation context
            console.log(
              `📚 Retrieving conversation context for chat: ${chat.id._serialized}`
            );
            const context = await db.getMessagesForContext(
              chat.id._serialized,
              20
            );
            console.log(`📚 Retrieved ${context.length} messages for context`);

            // Generate AI response
            console.log("🧠 Calling Gemini API...");
            const aiResponse = await gemini.generateResponse(
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
            gemini.markMessageAsResponded(message.id._serialized);
            console.log(`🔒 Message marked as responded to prevent loops`);
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
});

// Graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  db.close();
  process.exit(0);
});

client.initialize();
