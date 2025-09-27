module.exports = {
  apps: [
    {
      name: "TelegramBot",
      script: "./telegram.cjs",
      watch: false,
      restart_delay: 5000
    },
    {
      name: "BotStatus",
      script: "./bot-status.cjs",
      watch: false,
      restart_delay: 5000
    }
  ]
};
