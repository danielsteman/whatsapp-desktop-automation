import { existsSync } from "jsr:@std/fs@1.0.19";

export interface SessionData {
  sessionId: string;
  data: any;
  timestamp: number;
}

export class WhatsAppSessionManager {
  private sessionFile = "./whatsapp-session.json";
  private sessionData: SessionData | null = null;

  constructor() {
    this.loadSession();
  }

  private loadSession(): void {
    try {
      if (existsSync(this.sessionFile)) {
        const sessionContent = Deno.readTextFileSync(this.sessionFile);
        this.sessionData = JSON.parse(sessionContent);

        // Check if session is still valid (less than 7 days old)
        const sessionAge = Date.now() - this.sessionData!.timestamp;
        const maxAge = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds

        if (sessionAge > maxAge) {
          console.log("🕐 Session expired, will need new QR code");
          this.sessionData = null;
          this.deleteSession();
        } else {
          console.log("✅ Loaded existing WhatsApp session");
        }
      }
    } catch (error) {
      console.log("⚠️ Could not load session:", error.message);
      this.sessionData = null;
    }
  }

  saveSession(sessionId: string, data: any): void {
    try {
      this.sessionData = {
        sessionId,
        data,
        timestamp: Date.now(),
      };

      Deno.writeTextFileSync(
        this.sessionFile,
        JSON.stringify(this.sessionData, null, 2)
      );
      console.log("💾 WhatsApp session saved");
    } catch (error) {
      console.error("❌ Failed to save session:", error.message);
    }
  }

  getSession(): SessionData | null {
    return this.sessionData;
  }

  deleteSession(): void {
    try {
      if (existsSync(this.sessionFile)) {
        Deno.removeSync(this.sessionFile);
        console.log("🗑️ Session file deleted");
      }
      this.sessionData = null;
    } catch (error) {
      console.error("❌ Failed to delete session:", error.message);
    }
  }

  hasValidSession(): boolean {
    return this.sessionData !== null;
  }
}
