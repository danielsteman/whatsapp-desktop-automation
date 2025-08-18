const { Client } = require("whatsapp-web.js");
const qrcode = require("qrcode-terminal");

const client = new Client({
  puppeteer: {
    executablePath: "chrome-mac/Chromium.app/Contents/MacOS/Chromium",
  },
});

client.on("ready", () => {
  console.log("Client is ready!");
});

client.on("qr", (qr) => {
  qrcode.generate(qr, { small: true });
});

client.on("message_create", async (message) => {
  const contact = await message.getContact();
  let name =
    contact.pushname || contact.name || contact.number || contact.id.user;
  if (message.fromMe && client.info) {
    const myNumber = client.info.wid && client.info.wid.user;
    name = client.info.pushname || name || myNumber;
  }
  console.log(`[${name}] ${message.body}`);
});

client.initialize();
