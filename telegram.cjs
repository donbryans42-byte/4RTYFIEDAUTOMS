const TelegramBot = require("node-telegram-bot-api");
const path = require("path");
const { spawn } = require("child_process");
const fs = require("fs");

// Put your bot token here
const TOKEN = "8425365639:AAGmwFUZac6Kp_E3pkt0lOn3k44T4b6SoMQ";
const bot = new TelegramBot(TOKEN, { polling: true });

// Make sure the bot file name matches exactly
const BOT_PATH = path.join(__dirname, "bot-status.cjs");

const sessions = new Map();

function startSession(tgUserId) {
  if (sessions.has(tgUserId)) {
    bot.sendMessage(tgUserId, "⚠️ WhatsApp session already running.");
    return;
  }

  const sessionFolder = path.join(__dirname, "sessions", tgUserId);
  if (!fs.existsSync(sessionFolder)) fs.mkdirSync(sessionFolder, { recursive: true });

  const env = { ...process.env, TG_USER_ID: tgUserId, TG_TOKEN: TOKEN };
  const child = spawn("node", [BOT_PATH], { env, stdio: ["pipe", "pipe", "pipe"] });

  child.stdout.on("data", async (data) => {
    const text = data.toString();

    // Detect QR code output from bot-status.cjs
    if (text.includes("Scan this QR")) {
      const qrMatch = text.match(/qr:\s*(.*)/i);
      if (qrMatch && qrMatch[1]) {
        try {
          const qr = qrMatch[1].trim();
          // send QR as text to Telegram
          await bot.sendMessage(
            tgUserId,
            `📱 Scan this QR to login:\n${qr}`,
            { parse_mode: "Markdown" }
          );
        } catch (err) {
          console.error("Failed to send QR to Telegram:", err);
        }
      }
    }

    console.log(`[${tgUserId}] ${text.trim()}`);
  });

  child.stderr.on("data", (data) =>
    console.error(`[${tgUserId} ERROR] ${data.toString()}`)
  );

  child.on("exit", (code) => {
    console.log(`[${tgUserId}] Bot exited with code ${code}`);
    sessions.delete(tgUserId);
  });

  sessions.set(tgUserId, child);
  bot.sendMessage(tgUserId, "🚀 WhatsApp session is starting...");
}

// Telegram commands
bot.onText(/\/start/, (msg) => startSession(msg.chat.id.toString()));
bot.onText(/\/stop/, (msg) => {
  const tgUserId = msg.chat.id.toString();
  const session = sessions.get(tgUserId);
  if (session) {
    session.kill();
    sessions.delete(tgUserId);
    bot.sendMessage(tgUserId, "🛑 WhatsApp session stopped.");
  } else bot.sendMessage(tgUserId, "❌ No active session found.");
});
bot.onText(/\/status/, (msg) =>
  bot.sendMessage(
    msg.chat.id.toString(),
    sessions.has(msg.chat.id.toString()) ? "✅ WhatsApp session running." : "❌ No active session."
  )
);

console.log("🤖 Telegram controller running...");
