// bot-status.cjs
const fs = require("fs");
const path = require("path");
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers } = require("@whiskeysockets/baileys");
const P = require("pino");
const chalk = require("chalk");
const gradient = require("gradient-string");
const FormData = require("form-data");
const fetch = require("node-fetch");
const qrcode = require("qrcode");

// ====== CONFIG ======
const TG_USER_ID = process.env.TG_USER_ID;
const TG_TOKEN = process.env.TG_TOKEN;

if (!TG_USER_ID || !TG_TOKEN) {
  console.error("❌ TG_USER_ID or TG_TOKEN not set. Run via telegram.js");
  process.exit(1);
}

const SESSION_DIR = path.join(__dirname, "sessions", TG_USER_ID);
if (!fs.existsSync(SESSION_DIR)) fs.mkdirSync(SESSION_DIR, { recursive: true });

const OWNER = "254707993799@s.whatsapp.net"; // change per user
const CONTACTS_FILE = path.join(__dirname, `contacts-${TG_USER_ID}.json`);
const CONTACT_SAVE_INTERVAL = 1000;

// ====== runtime state ======
let autoReact = true;
let stats = { startTime: Date.now(), statusesReacted: 0 };
let knownContacts = {};
let pendingSaveTimer = null;
let qrShown = false;

// ====== helpers ======
function nowTime() {
  return new Date().toLocaleTimeString("en-KE", { timeZone: "Africa/Nairobi" });
}
function uptimeString() {
  const s = Math.floor((Date.now() - stats.startTime) / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return `${h}h ${m}m ${sec}s`;
}
function mjidToNumber(jid) {
  return typeof jid === "string" ? jid.split("@")[0] : jid;
}
function loadContactsFile() {
  try {
    if (fs.existsSync(CONTACTS_FILE)) {
      knownContacts = JSON.parse(fs.readFileSync(CONTACTS_FILE, "utf8") || "{}");
    }
  } catch (e) {
    console.warn("⚠️ Could not load contacts file:", e.message || e);
    knownContacts = {};
  }
}
function saveContactsFileDebounced() {
  if (pendingSaveTimer) clearTimeout(pendingSaveTimer);
  pendingSaveTimer = setTimeout(() => {
    try {
      fs.writeFileSync(CONTACTS_FILE, JSON.stringify(knownContacts, null, 2), "utf8");
    } catch (e) {
      console.warn("⚠️ Could not write contacts file:", e.message || e);
    }
    pendingSaveTimer = null;
  }, CONTACT_SAVE_INTERVAL);
}
function getTextFromMessage(msg) {
  try {
    if (msg.message?.conversation) return msg.message.conversation;
    if (msg.message?.extendedTextMessage?.text) return msg.message.extendedTextMessage.text;
    if (msg.message?.imageMessage?.caption) return msg.message.imageMessage.caption;
    if (msg.message?.videoMessage?.caption) return msg.message.videoMessage.caption;
    return "";
  } catch {
    return "";
  }
}

// rainbow logging
const colorFns = [chalk.red, chalk.yellow, chalk.green, chalk.cyan, chalk.blue, chalk.magenta];
function rainbowLog(text) {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const fn = colorFns[i % colorFns.length];
    result += typeof fn === "function" ? fn(text[i]) : text[i];
  }
  console.log(result);
}
function printBanner() {
  const banner = `
██████╗ ██████╗ ███████╗██████╗ ██╗████████╗
██╔════╝██╔═══██╗██╔════╝██╔══██╗██║╚══██╔══╝
██║     ██║   ██║█████╗  ██████╔╝██║   ██║
██║     ██║   ██║██╔══╝  ██╔═══╝ ██║   ██║
╚██████╗╚██████╔╝███████╗██║     ██║
 ╚═════╝ ╚═════╝ ╚══════╝╚═╝     ╚═╝`;
  rainbowLog(banner);
}
function prettyLogStatus(name, number, msgType, message, chatId) {
  const header = `┏━━━━━━━━━━━━━『 4RTYFIEDAUTOMS 』━━━━━━━━━━━━━─
 » Sent Time: ${nowTime()}
 » Message Type: ${msgType}
 » Sender Name: ${name}
 » Sender Number: ${number}
 » Chat ID: ${chatId}
 » Message: ${message}
┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━─ ⳹`;
  console.log(gradient.rainbow(header));
}

// send QR to Telegram as image
async function sendQrToTelegram(qr) {
  try {
    const pngBuffer = await qrcode.toBuffer(qr, { type: "png", width: 300 });
    const form = new FormData();
    form.append("chat_id", TG_USER_ID);
    form.append("photo", pngBuffer, { filename: "qr.png" });
    await fetch(`https://api.telegram.org/bot${TG_TOKEN}/sendPhoto`, {
      method: "POST",
      body: form,
    });
  } catch (err) {
    console.error("Failed to send QR to Telegram:", err);
  }
}

// ====== load contacts ======
loadContactsFile();

// ====== main bot ======
async function startBot() {
  printBanner();
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const sock = makeWASocket({
    auth: state,
    logger: P({ level: "silent" }),
    browser: Browsers.macOS("Desktop"),
    printQRInTerminal: false,
  });
  sock.ev.on("creds.update", saveCreds);

  // contacts update
  sock.ev.on("contacts.update", (updates) => {
    try {
      updates?.forEach((u) => {
        if (!u?.id) return;
        knownContacts[u.id] = u.notify || u.name || mjidToNumber(u.id);
      });
      saveContactsFileDebounced();
    } catch {}
  });

  // connection update
  sock.ev.on("connection.update", (update) => {
    const { connection, qr, lastDisconnect } = update;
    if (qr && !qrShown) {
      rainbowLog("📱 Scan this QR to link (owner or new user):");
      sendQrToTelegram(qr); // send QR as image
      qrShown = true;
    }
    if (connection === "open") {
      qrShown = false;
      rainbowLog("✅ Bot connected and ready!");
    } else if (connection === "close") {
      let delayMs = 1500;
      if (lastDisconnect?.error) {
        const code = lastDisconnect.error?.output?.statusCode || null;
        rainbowLog("⚠️ Disconnected. Reason: " + (lastDisconnect.error?.message || lastDisconnect.error));
        if (code === 515) delayMs = 5000;
      }
      setTimeout(startBot, delayMs);
    }
  });

  // messages handler
  sock.ev.on("messages.upsert", async (m) => {
    if (!m?.messages) return;
    const msg = m.messages[0];
    if (!msg) return;
    const remoteJid = msg.key?.remoteJid || "";
    const participant = msg.key?.participant;
    const senderJid = participant || msg.key?.remoteJid;
    const text = (getTextFromMessage(msg) || "").trim();

    // update contacts
    try {
      const fromSockName =
        sock.contacts?.[senderJid]?.notify ||
        sock.contacts?.[senderJid]?.name ||
        sock.contacts?.[senderJid]?.verifiedName ||
        null;
      const nameToSave = fromSockName || knownContacts[senderJid] || mjidToNumber(senderJid);
      if (!knownContacts[senderJid] || knownContacts[senderJid] !== nameToSave) {
        knownContacts[senderJid] = nameToSave;
        saveContactsFileDebounced();
      }
    } catch {}

    // ===== WhatsApp commands (non-status) =====
    if (remoteJid !== "status@broadcast" && text.startsWith("/")) {
      const cmd = text.toLowerCase();

      if (cmd === "/ping") {
        await sock.sendMessage(remoteJid, { text: "pong ✅" }, { quoted: msg });
      } else if (cmd === "/help") {
        const helpText = `*4RTYFIEDAUTOMS Commands*
/ping – check if bot is alive
/autoReact on|off – enable/disable status reactions
/status – show bot uptime & stats`;
        await sock.sendMessage(remoteJid, { text: helpText }, { quoted: msg });
      } else if (cmd.startsWith("/autoreact")) {
        const arg = cmd.split(" ")[1];
        if (arg === "on") {
          autoReact = true;
          await sock.sendMessage(remoteJid, { text: "✅ Auto-react is ON" }, { quoted: msg });
        } else if (arg === "off") {
          autoReact = false;
          await sock.sendMessage(remoteJid, { text: "🛑 Auto-react is OFF" }, { quoted: msg });
        } else {
          await sock.sendMessage(remoteJid, { text: "Usage: /autoReact on|off" }, { quoted: msg });
        }
      } else if (cmd === "/status") {
        const statusMsg = `*Bot Uptime:* ${uptimeString()}
*Statuses Reacted:* ${stats.statusesReacted}`;
        await sock.sendMessage(remoteJid, { text: statusMsg }, { quoted: msg });
      }
      return;
    }

    // ===== status handling =====
    if (remoteJid === "status@broadcast") {
      try {
        const msgType = Object.keys(msg.message || {})[0] || "unknown";
        const displayName = knownContacts[senderJid] || mjidToNumber(senderJid);
        const number = mjidToNumber(senderJid);
        const caption = text || "N/A";
        prettyLogStatus(displayName, number, msgType, caption, remoteJid);
        if (autoReact) {
          try {
            await sock.sendMessage(senderJid, { react: { text: "®️", key: msg.key } });
            stats.statusesReacted++;
            rainbowLog(`✨ Reacted with ®️ to ${displayName}`);
          } catch {}
        }
      } catch {}
      return;
    }
  });

  return sock;
}

startBot().catch((err) => console.error("Fatal start error:", err));
