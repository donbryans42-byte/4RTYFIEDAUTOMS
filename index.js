const makeWASocket = require("@whiskeysockets/baileys").default;
const { useMultiFileAuthState } = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const pino = require("pino");

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("./auth");

    const sock = makeWASocket({
        logger: pino({ level: "silent" }),
        printQRInTerminal: true, // shows QR code in terminal
        auth: state,
    });

    // listen for connection updates
    sock.ev.on("connection.update", (update) => {
        const { connection, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });

        if (connection === "open") {
            console.log("✅ Bot connected successfully!");
        } else if (connection === "close") {
            console.log("⚠️ Connection closed, reconnecting...");
            startBot(); // restart
        }
    });

    // save creds
    sock.ev.on("creds.update", saveCreds);

    // listen for new messages
    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.message) return;

        const from = msg.key.remoteJid;
        const text = msg.message.conversation || msg.message.extendedTextMessage?.text;

        console.log("📩 New message from:", from, "->", text);

        // simple auto-reply
        if (text && text.toLowerCase() === "ping") {
            await sock.sendMessage(from, { text: "Pong! 🏓" });
        }
    });
}

startBot();
