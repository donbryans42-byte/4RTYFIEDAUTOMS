import TelegramBot from "node-telegram-bot-api";

const TELEGRAM_TOKEN = "8425365639:AAGmwFUZac6Kp_E3pkt0lOn3k44T4b6SoMQ";
const telegramBot = new TelegramBot(TELEGRAM_TOKEN, { polling: true });

console.log("✅ Telegram bot running");

// Test command
telegramBot.onText(/\/test/, (msg) => {
    telegramBot.sendMessage(msg.chat.id, "✅ Command received!");
});
