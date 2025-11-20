// api/gorboy-bot.js
// GORBOY GUARD BOT v0.5
// Commands + /scan + DYOR helper + keyword triggers + inline mode + status/patterns/mind

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
 * Answer inline query
 */
async function tgAnswerInline(inlineQueryId, results) {
  if (!BOT_TOKEN) return;
  try {
    await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/answerInlineQuery`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          inline_query_id: inlineQueryId,
          results,
          cache_time: 2,
        }),
      }
    );
  } catch (err) {
    console.error("TG inline error:", err);
  }
}

/**
 * Try to detect $TICKER or address from text
 */
function extractTokenFromText(text) {
  if (!text) return null;

  const trimmed = text.trim();

  // 1) $TICKER (letters / numbers / _)
  const tickerMatch = trimmed.match(/\$([A-Za-z0-9_]{2,20})/);
  if (tickerMatch) {
    return { type: "ticker", value: tickerMatch[1].toUpperCase() };
  }

  // 2) base58-like address (Solana/Gorbagana style)
  const addrMatch = trimmed.match(/[1-9A-HJ-NP-Za-km-z]{25,64}/);
  if (addrMatch) {
    return { type: "address", value: addrMatch[0] };
  }

  // 3) plain word → treat as ticker (e.g. "gorboy")
  // (нужно для /scan, но не для авто-DYOR по обычным сообщениям)
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

  // Address → ВАЖНО: ссылка под автоскан в GGT
  return {
    title: value,
    trashscan: `https://trashscan.xyz/token/${encoded}`,
    // под autoScanFromUrl (параметр mint)
    ggt: `https://ggt.wtf/?mint=${encoded}`,
    extra: null,
  };
}

/**
 * Simple GORBOY MIND reply generator (offline, deterministic)
 */
function buildMindReply(input) {
  const base = input.trim();
  if (!base) {
    return (
      "🧠 GORBOY MIND\n" +
      "Send `/mind <text>` and I’ll judge your idea like a lazy risk engine."
    );
  }

  const textLower = base.toLowerCase();
  let verdict = "";

  if (textLower.includes("safe") || textLower.includes("guarantee")) {
    verdict =
      "If you need a guarantee, you’re in the wrong casino. Size your risk or walk away.";
  } else if (textLower.includes("pump") || textLower.includes("moon")) {
    verdict =
      "If the only word you see is ‘pump’, you’re probably the liquidity.";
  } else if (textLower.includes("hold") || textLower.includes("diamond")) {
    verdict =
      "Diamond hands are cool until rent is due. Decide which bill you’re paying with this trade.";
  } else if (textLower.includes("gorboy") || textLower.includes("ggt")) {
    verdict =
      "GORBOY will not save you. It will just make the chaos look pretty.";
  } else {
    verdict =
      "Here is the alpha: there is no alpha. Use tools, manage risk, stop coping.";
  }

  return (
    "🧠 GORBOY MIND\n\n" +
    `Input: "${base}"\n\n` +
    `Output: ${verdict}`
  );
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

  // ------------- INLINE MODE -------------
  if (update.inline_query) {
    const iq = update.inline_query;
    const q = (iq.query || "").trim();
    const token = extractTokenFromText(q);

    let results = [];

    if (token) {
      const meta = buildDyorLinks(token);
      const title = meta.title;
      const trashscanUrl = meta.trashscan;
      const ggtUrl = meta.ggt;

      let extraLine = "";
      if (meta.extra) extraLine = `\nNote: ${meta.extra}`;

      const messageText =
        "🔍 *GORBOY INLINE DYOR*\n\n" +
        `Target: \`${title}\`\n` +
        `Type: *${token.type.toUpperCase()}*` +
        `${extraLine}\n\n` +
        "Links:\n" +
        `• Trashscan: ${trashscanUrl}\n` +
        `• GGT Terminal: ${ggtUrl}\n\n` +
        "_Inline result. Use bot chat for full commands._";

      results.push({
        type: "article",
        id: iq.id || "1",
        title: `Scan ${title}`,
        description: "Trashscan + GGT links bundle.",
        input_message_content: {
          message_text: messageText,
          parse_mode: "Markdown",
        },
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🧪 Trashscan", url: trashscanUrl },
              { text: "🛰 GGT Terminal", url: ggtUrl },
            ],
          ],
        },
      });
    } else {
      const messageText =
        "⚙ GORBOY INLINE MODE\n\n" +
        "Type `$ticker` or a token address in this inline field.\n" +
        "I’ll build a quick DYOR snapshot with links.";

      results.push({
        type: "article",
        id: iq.id || "1",
        title: "How to use inline",
        description: "Type $ticker or address to get DYOR bundle.",
        input_message_content: {
          message_text: messageText,
        },
      });
    }

    await tgAnswerInline(iq.id, results);
    return res.status(200).json({ ok: true });
  }

  // ------------- NORMAL MESSAGES -------------

  const msg = update.message || update.edited_message;

  if (!msg || !msg.text) {
    return res.status(200).json({ ok: true });
  }

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const lower = text.toLowerCase();
  const chatType = msg.chat.type || "private";
  const isGroupLike =
    chatType === "group" || chatType === "supergroup" || chatType === "channel";

  // ------------- COMMAND ROUTER -------------

  // /start (+ payload с deep-link)
  if (lower.startsWith("/start")) {
    // payload может прийти как "/start something"
    const parts = text.split(" ");
    let payload = parts.length > 1 ? parts.slice(1).join(" ").trim() : "";

    let deepToken = null;

    if (payload) {
      try {
        // если прилетело url-энкоднутое значение
        payload = decodeURIComponent(payload);
      } catch (e) {
        // ignore decode errors
      }

      // поддержка префикса "scan_XXXXXXXX"
      if (payload.toLowerCase().startsWith("scan_")) {
        payload = payload.slice(5);
      }

      deepToken = extractTokenFromText(payload);
    }

    let intro =
      "⚡ GORBOY GUARD BOT ONLINE\n\n" +
      "What I can do right now:\n" +
      "• /help – show all commands\n" +
      "• /links – core GORBOY / GGT links\n" +
      "• /site – main GORBOY site\n" +
      "• /ggt – Guard Terminal (web)\n" +
      "• /status – static system status\n" +
      "• /patterns – basic pattern alerts explainer\n" +
      "• /disclaimer – DYOR reminder\n" +
      "• /mind <text> – sarcastic GORBOY MIND\n" +
      "• /scan <ticker|address> – quick DYOR snapshot\n" +
      "• Or just send $ticker / address directly\n\n" +
      "0$ budget · html/css/js · vercel\n" +
      "Meme.Build.Repeat.";

    // если deep-link принёс токен → сразу отдаём мини-скан
    if (deepToken) {
      const meta = buildDyorLinks(deepToken);
      const title = meta.title;
      const trashscanUrl = meta.trashscan;
      const ggtUrl = meta.ggt;

      let extraLine = "";
      if (meta.extra) extraLine = `\nNote: ${meta.extra}`;

      intro +=
        "\n\n" +
        "🔍 DEEP-LINK SCAN\n" +
        `Target: ${title}\n` +
        `Type: ${deepToken.type.toUpperCase()}` +
        `${extraLine}\n\n` +
        "Links:\n" +
        `• Trashscan: ${trashscanUrl}\n` +
        `• GGT Terminal (auto-scan): ${ggtUrl}\n`;
    }

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
      "/status – system status snapshot\n" +
      "/patterns – pattern alerts TL;DR\n" +
      "/disclaimer – risk / DYOR reminder\n" +
      "/mind <text> – sarcastic reply\n" +
      "/scan <ticker|address> – build DYOR snapshot\n\n" +
      "Shortcuts:\n" +
      "• Send `$GORBOY`, `$trashcoin`, `$ANYTHING`\n" +
      "• Or paste a token address.\n" +
      "• Type `site`, `ggt`, `gorboy`, `links`, `help`, `scan`…";
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

  // /status
  if (lower.startsWith("/status")) {
    const reply =
      "📡 GORBOY GUARD STATUS (static)\n\n" +
      "CHAIN: Gorbagana (concept layer)\n" +
      "RPC: planned integration\n" +
      "GGT: web terminal online\n" +
      "BOT: command router online\n" +
      "RISK ENGINE: text-based placeholders\n" +
      "PATTERN ALERTS: description only (no live feed yet)\n\n" +
      "This is a cosmetic status. Real on-chain checks will be wired later.";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /patterns
  if (lower.startsWith("/patterns")) {
    const reply =
      "📈 PATTERN ALERTS — BASIC TL;DR\n\n" +
      "• FLAT TAIL\n" +
      "  Tail = small holders. If it’s flat — no organic retail.\n" +
      "  Often means: extremely early, synthetic, or manipulated.\n\n" +
      "• DOUBLE SHOULDER\n" +
      "  Two medium-weight clusters separated by a gap.\n" +
      "  Can signal segmented whales / coordinated groups.\n\n" +
      "• HEAVY TOP1\n" +
      "  One holder dominates. Even if the chart looks fine, the risk is social.\n\n" +
      "GGT will paint these as field patterns. Here you just get text hints.";
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

  // /mind <text>
  if (lower.startsWith("/mind")) {
    const arg = text.slice(5).trim();
    const reply = buildMindReply(arg);
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /scan <something>
  if (lower.startsWith("/scan")) {
    const arg = text.slice(5).trim();
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
    if (meta.extra) extraLine = `\nNote: ${meta.extra}`;

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

  //
  // ===== ДАЛЬШЕ — ТОЛЬКО ТО, ЧТО ТЫ ПРОСИЛ =====
  //

  // 1) DYOR на обычное сообщение — только если:
  //    • есть $TICKER  (например, $trashcoin)
  //    • или это адрес (base58)
  let token = extractTokenFromText(text);

  if (token && token.type === "ticker") {
    // для авто-DYOR требуем именно форму с $
    const dollarRegex = new RegExp("\\$" + token.value + "\\b", "i");
    if (!dollarRegex.test(text)) {
      token = null;
    }
  }

  if (token) {
    const meta = buildDyorLinks(token);
    const title = meta.title;
    const trashscanUrl = meta.trashscan;
    const ggtUrl = meta.ggt;

    let extraLine = "";
    if (meta.extra) extraLine = `\nNote: ${meta.extra}`;

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

  // 2) Реакция на GOR / GORBOY → выдаём команды
  const hasGorboy = /\bgorboy\b/i.test(text);
  const hasGor = /\bgor\b/i.test(text);

  if (hasGorboy || hasGor) {
    const reply =
      "GORBOY is a brand, a meme and a Guard Terminal.\n\n" +
      "🌐 Site: https://www.gorboy.wtf\n" +
      "🛰 GGT: https://ggt.wtf\n\n" +
      "Commands:\n" +
      "/help – full menu\n" +
      "/scan $ticker – quick DYOR\n" +
      "/mind <text> – sarcastic engine\n\n" +
      "0$ budget. html/css/js. Meme.Build.Repeat.";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // 3) Фоллбек:
  //    • в группах вообще молчим,
  //    • в личке можно дать мягкий хинт.
  if (isGroupLike) {
    return res.status(200).json({ ok: true });
  }

  const hint =
    "I only react to commands, `$tickers` and addresses.\n\n" +
    "Try:\n" +
    "• /help\n" +
    "• /scan $ticker\n" +
    "• /scan <token_address>\n" +
    "• Send `$GORBOY` or any other ticker.\n" +
    "• Say `GORBOY` to see commands.";

  await tgSend(chatId, hint);
  return res.status(200).json({ ok: true });
}
