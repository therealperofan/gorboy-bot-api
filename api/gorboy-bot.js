// api/gorboy-bot.js
// GORBOY GUARD BOT v0.1 — Command router + $ticker / address intel links

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

async function tgSend(chatId, text, extra = {}) {
  if (!BOT_TOKEN) {
    console.error("Missing TELEGRAM_BOT_TOKEN");
    return;
  }

  const payload = {
    chat_id: chatId,
    text,
    ...extra,
  };

  try {
    await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    console.error("TG send error:", err);
  }
}

// простая детекция $TICKER или адреса
function extractTokenFromText(text) {
  if (!text) return null;

  // 1) ищем что-то вроде $GORBOY или $trashcoin
  const tickerMatch = text.match(/\$([A-Za-z0-9_]{2,20})/);
  if (tickerMatch) {
    return { type: "ticker", value: tickerMatch[1].toUpperCase() };
  }

  // 2) простая проверка на солано-подобный адрес (base58, длина ~32–64)
  const addrMatch = text.match(/[1-9A-HJ-NP-Za-km-z]{25,64}/);
  if (addrMatch) {
    return { type: "address", value: addrMatch[0] };
  }

  return null;
}

export default async function handler(req, res) {
  // Telegram иногда делает GET — просто подтверждаем
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, method: "GET" });
  }

  if (!BOT_TOKEN) {
    console.error("Missing TELEGRAM_BOT_TOKEN");
    // НИКОГДА не даём 401, только 200
    return res.status(200).json({ ok: false, error: "no token" });
  }

  const update = req.body || {};
  const msg = update.message || update.edited_message;

  if (!msg || !msg.text) {
    return res.status(200).json({ ok: true });
  }

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const lower = text.toLowerCase();

  // ---------- ROUTER ----------

  // /start
  if (lower.startsWith("/start")) {
    const reply =
      "⚡ GORBOY GUARD BOT ONLINE\n\n" +
      "Что я сейчас умею:\n" +
      "• /help — показать команды\n" +
      "• /site — открыть gorboy.wtf\n" +
      "• /ggt — открыть GORBOY GUARD TERMINAL\n" +
      "• /game — Flappy GORBOY мини-игра\n" +
      "• Напиши $ticker или адрес — дам DYOR-ссылки (Trashscan + GGT)\n\n" +
      "0$ budget · html/css/js · vercel\n" +
      "Meme.Build.Repeat.";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /help
  if (lower.startsWith("/help")) {
    const reply =
      "🧾 GORBOY GUARD — COMMANDS\n\n" +
      "/start — перезапуск интро\n" +
      "/help — это меню\n" +
      "/site — основной сайт GORBOY\n" +
      "/ggt — Guard Terminal (web)\n" +
      "/game — Flappy GORBOY мини-апп\n\n" +
      "DYOR:\n" +
      "• Напиши `$GORBOY` или `$trashcoin`\n" +
      "• Или просто скинь контрактный адрес\n" +
      "→ получишь быстрый набор ссылок.";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /site
  if (lower.startsWith("/site")) {
    const reply = "🌐 GORBOY SITE:\nhttps://www.gorboy.wtf";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /ggt
  if (lower.startsWith("/ggt")) {
    const reply =
      "🛰 GORBOY GUARD TERMINAL (web demo):\n" +
      "https://ggt.wtf\n\n" +
      "Paste mint → Hit SCAN → Watch the field react.";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /game
  if (lower.startsWith("/game")) {
    const reply =
      "🎮 FLAPPY GORBOY MINI-APP:\n" +
      "https://flappy-gorboy-mini-app.vercel.app\n\n" +
      "Tap to start. Don’t crash into trash.";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // ---------- DYOR: $ticker / address ----------

  const token = extractTokenFromText(text);

  if (token) {
    const value = token.value;
    const encoded = encodeURIComponent(value);

    // ссылки-заглушки — подправим под реальные паттерны URL,
    // когда финализируешь Trashscan/GGT роуты
    let title = "";
    let trashscanUrl = "";
    let ggtUrl = "";

    if (token.type === "ticker") {
      title = `$${value}`;
      trashscanUrl = `https://trashscan.xyz/search?query=${encoded}`;
      ggtUrl = `https://ggt.wtf/?ticker=${encoded}`;
    } else {
      title = value;
      trashscanUrl = `https://trashscan.xyz/token/${encoded}`;
      ggtUrl = `https://ggt.wtf/scan?token=${encoded}`;
    }

    const reply =
      "🔍 GORBOY DYOR SNAPSHOT\n\n" +
      `Target: \`${title}\`\n` +
      `Type: ${token.type.toUpperCase()}\n\n` +
      "Links:\n" +
      `• Trashscan: ${trashscanUrl}\n` +
      `• GGT Terminal: ${ggtUrl}\n\n` +
      "⚠️ This is just a shortcut.\n" +
      "Always do your own research.";

    await tgSend(chatId, reply, { parse_mode: "Markdown" });
    return res.status(200).json({ ok: true });
  }

  // ---------- DEFAULT: ECHO ----------

  const fallback =
    "💀 GORBOY ECHO:\n" +
    text +
    "\n\n" +
    "Tip: отправь `$ticker`, адрес или /help.";

  await tgSend(chatId, fallback);
  return res.status(200).json({ ok: true });
}
