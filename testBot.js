import { Telegraf } from "telegraf";

const bot = new Telegraf("8425365639:AAGmwFUZac6Kp_E3pkt0lOn3k44T4b6SoMQ");

bot.start((ctx) => ctx.reply("✅ Bot is alive!"));

bot.launch()
  .then(() => console.log("🚀 Bot started successfully"))
  .catch((err) => console.error("❌ Launch failed:", err));
