const { Client } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({puppeteer: {executablePath: "chrome-mac/Chromium.app/Contents/MacOS/Chromium"}});

client.on('ready', () => {
    console.log('Client is ready!');
});

client.on('qr', qr => {
    qrcode.generate(qr, {small: true});
});
client.on('message_create', message => {
	console.log(message.body);
});

client.initialize();

