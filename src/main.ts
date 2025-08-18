import { Client } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";
import { DatabaseService, Message } from "./database.ts";

const db = new DatabaseService();
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

    // Store the message
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
