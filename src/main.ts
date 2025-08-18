import { Client } from "whatsapp-web.js";
import qrcode from "qrcode-terminal";

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
  } else {
    console.log(`[${name}] ${message.body}`);
  }
});

client.initialize();
