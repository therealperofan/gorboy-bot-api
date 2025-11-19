// api/gorboy-bot.js
// GORBOY GUARD BOT v0.3 — commands + /scan + DYOR helper (no echo)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

/**
 * Send Telegram message
 */
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

/**
 * Try to detect $TICKER or address from text
 * - supports "$GORBOY"
 * - supports plain "GORBOY"
 * - supports base58-like address
 */
function extractTokenFromText(text) {
  if (!text) return null;

  const trimmed = text.trim();

  // 1) $TICKER (letters / numbers / _)
  const tickerMatch = trimmed.match(/\$([A-Za-z0-9_]{2,20})/);
  if (tickerMatch) {
    return { type: "ticker", value: tickerMatch[1].toUpperCase() };
  }

  // 2) Solana/Gorbagana-like address
  const addrMatch = trimmed.match(/[1-9A-HJ-NP-Za-km-z]{25,64}/);
  if (addrMatch) {
    return { type: "address", value: addrMatch[0] };
  }

  // 3) plain word → treat as ticker (e.g. "gorboy")
  const plainMatch = trimmed.match(/^[A-Za-z0-9_]{2,20}$/);
  if (plainMatch) {
    return { type: "ticker", value: plainMatch[0].toUpperCase() };
  }

  return null;
}

/**
 * Build DYOR links for ticker/address
 */
function buildDyorLinks(token) {
  const value = token.value;
  const encoded = encodeURIComponent(value);

  // Special cases for your assets
  if (token.type === "ticker" && value === "GORBOY") {
    return {
      title: "$GORBOY",
      trashscan: `https://trashscan.xyz/search?query=${encoded}`,
      ggt: `https://ggt.wtf/?ticker=${encoded}`,
      extra: "Internal: GORBOY Guard ecosystem asset.",
    };
  }

  if (token.type === "ticker" && (value === "GOR" || value === "GORBAGANA")) {
    return {
      title: "$GOR / Gorbagana",
      trashscan: `https://trashscan.xyz/search?query=${encoded}`,
      ggt: `https://ggt.wtf/?ticker=${encoded}`,
      extra: "Base chain token for Gorbagana network.",
    };
  }

  // Generic cases
  if (token.type === "ticker") {
    return {
      title: `$${value}`,
      trashscan: `https://trashscan.xyz/search?query=${encoded}`,
      ggt: `https://ggt.wtf/?ticker=${encoded}`,
      extra: null,
    };
  }

  // Address
  return {
    title: value,
    trashscan: `https://trashscan.xyz/token/${encoded}`,
    ggt: `https://ggt.wtf/scan?token=${encoded}`,
    extra: null,
  };
}

export default async function handler(req, res) {
  // Telegram may ping with GET — always ok
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
  const lower = text.toLowerCase();

  // ------------- COMMAND ROUTER -------------

  // /start
  if (lower.startsWith("/start")) {
    const intro =
      "⚡ GORBOY GUARD BOT ONLINE\n\n" +
      "What I can do right now:\n" +
      "• /help – show all commands\n" +
      "• /links – core GORBOY / GGT links\n" +
      "• /site – main GORBOY site\n" +
      "• /ggt – Guard Terminal (web)\n" +
      "• /disclaimer – DYOR reminder\n" +
      "• /scan <ticker|address> – quick DYOR snapshot\n" +
      "• Or just send $ticker / address directly\n\n" +
      "0$ budget · html/css/js · vercel\n" +
      "Meme.Build.Repeat.";

    await tgSend(chatId, intro, {
      reply_markup: {
        inline_keyboard: [
          [
            { text: "🌐 Website", url: "https://www.gorboy.wtf" },
            { text: "🛰 GGT Terminal", url: "https://ggt.wtf" },
          ],
        ],
      },
    });

    return res.status(200).json({ ok: true });
  }

  // /help
  if (lower.startsWith("/help")) {
    const reply =
      "🧾 GORBOY GUARD — COMMANDS\n\n" +
      "/start – intro & quick buttons\n" +
      "/help – this menu\n" +
      "/links – core ecosystem links\n" +
      "/site – main GORBOY website\n" +
      "/ggt – Guard Terminal (web)\n" +
      "/disclaimer – risk / DYOR reminder\n" +
      "/scan <ticker|address> – build DYOR snapshot\n\n" +
      "Shortcuts:\n" +
      "• Send `$GORBOY`, `$trashcoin`, `$ANYTHING`\n" +
      "• Or paste a token address.\n";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /links
  if (lower.startsWith("/links")) {
    const reply =
      "🔗 GORBOY / GGT LINKS\n\n" +
      "• Site: https://www.gorboy.wtf\n" +
      "• Guard Terminal: https://ggt.wtf\n\n" +
      "This bot is the Telegram edge of GORBOY GUARD TERMINAL.";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /site
  if (lower.startsWith("/site")) {
    const reply =
      "🌐 GORBOY WEBSITE\n" +
      "https://www.gorboy.wtf\n\n" +
      "Brand · Lore · Guard Terminal preview.";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /ggt
  if (lower.startsWith("/ggt")) {
    const reply =
      "🛰 GORBOY GUARD TERMINAL (web)\n" +
      "https://ggt.wtf\n\n" +
      "Paste a mint → Hit SCAN → Watch the field react.\n" +
      "This bot will later mirror the same intel stream.";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /disclaimer
  if (lower.startsWith("/disclaimer")) {
    const reply =
      "⚠️ GORBOY / GGT DISCLAIMER\n\n" +
      "• This bot is NOT financial advice.\n" +
      "• Always do your own research before buying anything.\n" +
      "• GORBOY is a brand, a meme, a lifestyle and a 0$ experimental build.\n" +
      "• It may succeed, it may fail – that's the game.\n\n" +
      "Use every tool as a signal, not as a guarantee.";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /scan <something>
  if (lower.startsWith("/scan")) {
    const arg = text.slice(5).trim(); // remove "/scan"
    const token = extractTokenFromText(arg);

    if (!token) {
      await tgSend(
        chatId,
        "Usage:\n/scan $ticker\n/scan TICKER\n/scan <token_address>\n\nExample:\n/scan $GORBOY\n/scan GNFqCqaU9R2j..."
      );
      return res.status(200).json({ ok: true });
    }

    const meta = buildDyorLinks(token);
    const title = meta.title;
    const trashscanUrl = meta.trashscan;
    const ggtUrl = meta.ggt;

    let extraLine = "";
    if (meta.extra) {
      extraLine = `\nNote: ${meta.extra}`;
    }

    const reply =
      "🔍 GORBOY SCAN REQUEST\n\n" +
      `Target: \`${title}\`\n` +
      `Type: *${token.type.toUpperCase()}*` +
      `${extraLine}\n\n` +
      "Links:\n" +
      `• Trashscan: ${trashscanUrl}\n` +
      `• GGT Terminal: ${ggtUrl}\n\n` +
      "This is a link bundle, not a verdict.\n" +
      "*Always* do your own research.";

    await tgSend(chatId, reply, { parse_mode: "Markdown" });
    return res.status(200).json({ ok: true });
  }

  // ------------- DYOR on raw message (no /scan) -------------

  const token = extractTokenFromText(text);

  if (token) {
    const meta = buildDyorLinks(token);
    const title = meta.title;
    const trashscanUrl = meta.trashscan;
    const ggtUrl = meta.ggt;

    let extraLine = "";
    if (meta.extra) {
      extraLine = `\nNote: ${meta.extra}`;
    }

    const reply =
      "🔍 GORBOY DYOR SNAPSHOT\n\n" +
      `Target: \`${title}\`\n` +
      `Type: *${token.type.toUpperCase()}*` +
      `${extraLine}\n\n` +
      "Links:\n" +
      `• Trashscan: ${trashscanUrl}\n` +
      `• GGT Terminal: ${ggtUrl}\n\n` +
      "Use /scan for a more explicit request.\n" +
      "*Always* do your own research.";

    await tgSend(chatId, reply, { parse_mode: "Markdown" });
    return res.status(200).json({ ok: true });
  }

  // ------------- DEFAULT: NO ECHO, JUST HINT -------------

  const hint =
    "I only react to commands and token hints.\n\n" +
    "Try:\n" +
    "• /help\n" +
    "• /scan $ticker\n" +
    "• /scan <token_address>\n" +
    "• Send `$GORBOY` or any other ticker.";

  await tgSend(chatId, hint);
  return res.status(200).json({ ok: true });
}
