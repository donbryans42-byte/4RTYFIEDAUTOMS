// bot.js
const { default: makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys");
const pino = require("pino");
const qrcode = require("qrcode-terminal");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("auth_info");
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
        version,
        logger: pino({ level: "silent" }),
        printQRInTerminal: true,
        auth: state
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });
        if (connection === "open") {
            console.log("✅ Bot connected!");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // 🟢 Log incoming messages (including statuses)
    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const type = Object.keys(msg.message)[0];
        console.log(`
┏━━━━━━━━━━━━━『 4RTYFIEDAUTOMS 』━━━━━━━━━━━━━─
» From: ${from}
» Type: ${type}
» Message: ${msg.message.conversation || msg.message[type]?.caption || "N/A"}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━─ ⳹
        `);
    });
}

startBot();
