const {
    default: makeWASocket,
    useMultiFileAuthState,
    Browsers,
    delay
} = require("@whiskeysockets/baileys");
const P = require("pino");
const qrcode = require("qrcode-terminal");

// 📌 Utility: format time
function getTime() {
    return new Date().toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" });
}

// 📌 Fancy log like CypherX
function logStatus(sender, name, msgType, message, chatId) {
    console.log(`
┏━━━━━━━━━━━━━『 4RTYFIEDAUTOMS 』━━━━━━━━━━━━━─
» Sent Time: ${getTime()}
» Message Type: ${msgType}
» Sender: ${sender}
» Name: ${name || "N/A"}
» Chat ID: ${chatId}
» Message: ${message || "N/A"}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━─ ⳹
    `);
}

// 📌 Start the bot
async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState("session");

    const sock = makeWASocket({
        auth: state,
        printQRInTerminal: true,
        logger: P({ level: "silent" }),
        browser: Browsers.macOS("Desktop")
    });

    // 🔄 Save session
    sock.ev.on("creds.update", saveCreds);

    // ✅ Connection updates
    sock.ev.on("connection.update", (update) => {
        const { connection, qr } = update;
        if (qr) qrcode.generate(qr, { small: true });

        if (connection === "open") {
            console.log("✅ Bot connected and ready!");
        } else if (connection === "close") {
            console.log("❌ Connection closed. Reconnecting...");
            startBot();
        }
    });

    // 👀 View + react to statuses
    sock.ev.on("messages.upsert", async (m) => {
        const msg = m.messages[0];
        if (!msg.key?.remoteJid) return;

        if (msg.key.remoteJid === "status@broadcast") {
            try {
                const sender = msg.key.participant || msg.key.remoteJid;
                const msgType = Object.keys(msg.message)[0];
                const chatId = msg.key.remoteJid;
                const name = sock.contacts?.[sender]?.notify || "N/A";

                // extract text if available
                let message = "N/A";
                if (msg.message?.conversation) {
                    message = msg.message.conversation;
                } else if (msg.message?.extendedTextMessage?.text) {
                    message = msg.message.extendedTextMessage.text;
                }

                // 🎭 Log in CypherX style
                logStatus(sender, name, msgType, message, chatId);

                // ✅ React
                const reactions = ["👍", "❤️"];
                const reaction = reactions[Math.floor(Math.random() * reactions.length)];

                await sock.sendMessage(sender, {
                    react: { text: reaction, key: msg.key }
                });

                console.log(`✨ Reacted with ${reaction}\n`);

                await delay(500);
            } catch (err) {
                console.error("⚠️ Error handling status:", err);
            }
        }
    });
}

startBot();
