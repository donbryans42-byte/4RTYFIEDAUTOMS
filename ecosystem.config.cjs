module.exports = {
  apps: [
    {
      name: "4RTYFIEDAUTOMS",
      script: "./bot-status.cjs",
      watch: false,
      instances: 1,
      autorestart: true,
      max_memory_restart: "200M",
      env: {
        TG_USER_ID: "YOUR_TELEGRAM_USER_ID",
        TG_TOKEN: "YOUR_BOT_TOKEN",
        SESSION_PATH: "./sessions"
      }
    }
  ]
};
