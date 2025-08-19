import { DatabaseService } from "./database.ts";
import { GeminiService } from "./gemini.ts";
import { loadConfig } from "./config.ts";
import { WhatsAppService } from "./whatsapp-service.ts";
import process from "node:process";

// Load configuration
const config = await loadConfig();

// Initialize services
const db = new DatabaseService();
const gemini = new GeminiService(config.GEMINI_API_KEY, config.aiResponders);
const whatsappService = new WhatsAppService(db, gemini);

// Graceful shutdown
process.on("SIGINT", async () => {
  console.log("\nShutting down...");

  try {
    await whatsappService.shutdown();
    db.close();
    console.log("✅ Graceful shutdown completed");
  } catch (error) {
    console.error("❌ Error during shutdown:", error);
  }

  process.exit(0);
});

// Start the WhatsApp service
console.log("🚀 Starting WhatsApp automation service...");
await whatsappService.initialize();
