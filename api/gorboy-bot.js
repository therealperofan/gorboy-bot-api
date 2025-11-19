// api/gorboy-bot.js
// Minimal Telegram bot for Vercel with GUARANTEED 200 OK

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, method: "GET" });
  }

  if (!BOT_TOKEN) {
    console.error("Missing TELEGRAM_BOT_TOKEN");
    return res.status(200).json({ ok: false, error: "no token" });
  }

  const update = req.body || {};
  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) {
    return res.status(200).json({ ok: true });
  }

  const chatId = msg.chat.id;
  const text = msg.text.trim();

  let reply = "";

  if (text.startsWith("/start")) {
    reply =
      "⚡ GORBOY BOT ACTIVE\n\n" +
      "Send me any message and I will echo it.\n" +
      "GGT + RPC integration will be added next.";
  } else {
    reply = `💀 GORBOY ECHO:\n${text}`;
  }

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: reply }),
    });
  } catch (err) {
    console.error("TG send error:", err);
  }

  return res.status(200).json({ ok: true });
}
