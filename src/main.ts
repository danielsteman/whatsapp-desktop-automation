import { Client } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { DatabaseService, Message } from "./database.ts";
import { GeminiService } from "./gemini.ts";
import { loadConfig } from "./config.ts";

// Load configuration
const config = await loadConfig();

const db = new DatabaseService();
const gemini = new GeminiService(config.GEMINI_API_KEY);
const client = new Client({
  puppeteer: {
    executablePath: "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
  },
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("qr", (qr: string) => {
  qrcode.generate(qr, { small: true });
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
    if (
      message.body &&
      message.body.trim().length > 0 &&
      message.type !== "protocol" &&
      message.type !== "revoke" &&
      message.type !== "e2e_notification"
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
      };

      await db.storeMessage(messageData);
      console.log(`✅ Message stored in database`);

      // Check if we should generate an AI response
      if (await gemini.shouldRespond(message.body, name)) {
        try {
          console.log("🤖 Generating AI response...");

          // Get conversation context
          const context = await db.getMessagesForContext(
            chat.id._serialized,
            20
          );

          // Generate AI response
          const aiResponse = await gemini.generateResponse(
            message.body,
            context,
            chat.isGroup,
            chat.isGroup ? chat.name : undefined
          );

          // Send the response
          await message.reply(aiResponse);
          console.log(`🤖 AI response sent: "${aiResponse}"`);
        } catch (error) {
          console.error("Error generating/sending AI response:", error);
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
