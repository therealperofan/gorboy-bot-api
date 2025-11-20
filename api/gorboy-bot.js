// api/gorboy-bot.js
// GORBOY GUARD BOT v0.7 (clean, no RPC command)
// Commands + /scan + DYOR helper + keyword triggers + inline mode
// + anti-spam + /about + GOR meme Easter eggs + deep-link + autoScan (?mint)

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// anti-spam: 5 seconds cooldown per-user
const COOLDOWN_MS = 5000;
const lastUserReplyAt = new Map();

/**
 * Anti-spam check
 */
function isOnCooldown(chatId, fromId) {
  if (!fromId) return false;
  const key = `${chatId}:${fromId}`;
  const now = Date.now();
  const last = lastUserReplyAt.get(key) || 0;
  if (now - last < COOLDOWN_MS) {
    return true;
  }
  lastUserReplyAt.set(key, now);
  return false;
}

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
 * Detect $TICKER or address
 */
function extractTokenFromText(text) {
  if (!text) return null;

  const trimmed = text.trim();

  // 1) $TICKER
  const tickerMatch = trimmed.match(/\$([A-Za-z0-9_]{2,20})/);
  if (tickerMatch) {
    return { type: "ticker", value: tickerMatch[1].toUpperCase() };
  }

  // 2) base58-like
  const addrMatch = trimmed.match(/[1-9A-HJ-NP-Za-km-z]{25,64}/);
  if (addrMatch) {
    return { type: "address", value: addrMatch[0] };
  }

  // 3) plain ticker (only for /scan)
  const plainMatch = trimmed.match(/^[A-Za-z0-9_]{2,20}$/);
  if (plainMatch) {
    return { type: "ticker", value: plainMatch[0].toUpperCase() };
  }

  return null;
}

/**
 * Build DYOR links
 */
function buildDyorLinks(token) {
  const val = token.value;
  const enc = encodeURIComponent(val);

  if (token.type === "ticker" && val === "GORBOY") {
    return {
      title: "$GORBOY",
      trashscan: `https://trashscan.xyz/search?query=${enc}`,
      ggt: `https://ggt.wtf/?ticker=${enc}`,
      extra: "Internal: GORBOY Guard ecosystem asset.",
    };
  }

  if (token.type === "ticker" && (val === "GOR" || val === "GORBAGANA")) {
    return {
      title: "$GOR / Gorbagana",
      trashscan: `https://trashscan.xyz/search?query=${enc}`,
      ggt: `https://ggt.wtf/?ticker=${enc}`,
      extra: "Base chain token for Gorbagana network.",
    };
  }

  if (token.type === "ticker") {
    return {
      title: `$${val}`,
      trashscan: `https://trashscan.xyz/search?query=${enc}`,
      ggt: `https://ggt.wtf/?ticker=${enc}`,
      extra: null,
    };
  }

  // address → autoScan-compatible
  return {
    title: val,
    trashscan: `https://trashscan.xyz/token/${enc}`,
    ggt: `https://ggt.wtf/?mint=${enc}`,
    extra: null,
  };
}

/**
 * GOR meme Easter eggs
 */
function getEasterEggLine(token) {
  if (!token || token.type !== "ticker") return "";

  const v = token.value.toUpperCase();

  if (v === "TRASHCOIN") {
    return "\n🗑️ TRASHCOIN: the real OG Bitcoin on GOR. Cope accordingly.";
  }

  if (v === "TRASHBIN") {
    return "\n🗑️ TRASHBIN: if TRASHCOIN is BTC, TRASHBIN is Mt.Gox.";
  }

  if (v === "GOR") {
    return "\n🦍 GOR: not a token, a religion. A very small one, but still.";
  }

  if (v === "GORBOY") {
    return "\n👾 GORBOY: built on pure chaos energy. No roadmap, only builds.";
  }

  return "";
}

/**
 * GORBOY MIND
 */
function buildMindReply(input) {
  const base = input.trim();
  if (!base) {
    return (
      "🧠 GORBOY MIND\nSend `/mind <text>` and I’ll judge your idea like a lazy risk engine."
    );
  }

  const t = base.toLowerCase();
  let verdict = "";

  if (t.includes("safe") || t.includes("guarantee")) {
    verdict =
      "If you need a guarantee, you’re in the wrong casino. Size your risk or walk away.";
  } else if (t.includes("pump") || t.includes("moon")) {
    verdict = "If the only word you see is ‘pump’, you’re probably the liquidity.";
  } else if (t.includes("hold") || t.includes("diamond")) {
    verdict =
      "Diamond hands are cool until rent is due. Decide which bill you’re paying with this trade.";
  } else if (t.includes("gorboy") || t.includes("ggt")) {
    verdict = "GORBOY will not save you. It will just make the chaos look pretty.";
  } else {
    verdict =
      "Here is the alpha: there is no alpha. Use tools, manage risk, stop coping.";
  }

  return `🧠 GORBOY MIND\n\nInput: "${base}"\n\nOutput: ${verdict}`;
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({ ok: true, method: "GET" });
  }

  if (!BOT_TOKEN) {
    console.error("Missing TELEGRAM_BOT_TOKEN");
    return res.status(200).json({ ok: false, error: "no token" });
  }

  const update = req.body || {};

  // -------- INLINE MODE --------
  if (update.inline_query) {
    const iq = update.inline_query;
    const q = (iq.query || "").trim();
    const token = extractTokenFromText(q);

    let results = [];

    if (token) {
      const meta = buildDyorLinks(token);
      const title = meta.title;
      const trash = meta.trashscan;
      const ggt = meta.ggt;
      const egg = getEasterEggLine(token);

      let extraLine = meta.extra ? `\nNote: ${meta.extra}` : "";

      const messageText =
        "🔍 *GORBOY INLINE DYOR*\n\n" +
        `Target: \`${title}\`\nType: *${token.type.toUpperCase()}*` +
        `${extraLine}${egg}\n\nLinks:\n• Trashscan: ${trash}\n• GGT: ${ggt}\n\n_Inline mode_`;

      results.push({
        type: "article",
        id: "1",
        title: `Scan ${title}`,
        description: "Trashscan + GGT links",
        input_message_content: {
          message_text: messageText,
          parse_mode: "Markdown",
        },
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🧪 Trashscan", url: trash },
              { text: "🛰 GGT", url: ggt },
            ],
          ],
        },
      });
    } else {
      results.push({
        type: "article",
        id: "1",
        title: "How to use inline",
        description: "Type $ticker or address",
        input_message_content: {
          message_text:
            "⚙ Inline DYOR\n\nType `$ticker` or token address to get quick links.",
        },
      });
    }

    await tgAnswerInline(iq.id, results);
    return res.status(200).json({ ok: true });
  }

  // -------- NORMAL MESSAGES --------

  const msg = update.message || update.edited_message;
  if (!msg || !msg.text) return res.status(200).json({ ok: true });

  const chatId = msg.chat.id;
  const text = msg.text.trim();
  const lower = text.toLowerCase();
  const chatType = msg.chat.type;
  const isGroup =
    chatType === "group" || chatType === "supergroup" || chatType === "channel";
  const fromId = msg.from?.id;

  // -------- COMMANDS --------

  // /start + deep-link
  if (lower.startsWith("/start")) {
    const parts = text.split(" ");
    let payload = parts.length > 1 ? parts.slice(1).join(" ").trim() : "";
    let deepToken = null;

    if (payload) {
      try {
        payload = decodeURIComponent(payload);
      } catch {}
      if (payload.toLowerCase().startsWith("scan_")) {
        payload = payload.slice(5);
      }
      deepToken = extractTokenFromText(payload);
    }

    let intro =
      "⚡ GORBOY GUARD BOT ONLINE\n\n" +
      "Commands:\n" +
      "• /help – all commands\n" +
      "• /about – what is GORBOY / GGT\n" +
      "• /links – ecosystem links\n" +
      "• /site – website\n" +
      "• /ggt – Guard Terminal (web)\n" +
      "• /status – static system snapshot\n" +
      "• /patterns – field pattern TL;DR\n" +
      "• /disclaimer – DYOR reminder\n" +
      "• /mind <text> – sarcastic engine\n" +
      "• /scan <ticker|address> – quick DYOR\n\n" +
      "0$ budget · html/css/js · vercel\nMeme.Build.Repeat.";

    if (deepToken) {
      const meta = buildDyorLinks(deepToken);
      const title = meta.title;
      const trash = meta.trashscan;
      const ggt = meta.ggt;
      const egg = getEasterEggLine(deepToken);
      let extraLine = meta.extra ? `\nNote: ${meta.extra}` : "";
      intro +=
        "\n\n🔍 DEEP-LINK SCAN\n" +
        `Target: ${title}\nType: ${deepToken.type.toUpperCase()}` +
        `${extraLine}${egg}\n\n` +
        `Links:\n• Trashscan: ${trash}\n• GGT: ${ggt}`;
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
      "/start – intro\n/help – menu\n/about – what this is\n/links – ecosystem\n/site – website\n/ggt – web terminal\n/status – static snapshot\n/patterns – pattern TL;DR\n/disclaimer – DYOR\n/mind <text> – sarcastic engine\n/scan <ticker|address> – DYOR\n\nShortcuts:\nSend `$ticker` or address.\nSay `GORBOY` to show menu.";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /about
  if (lower.startsWith("/about")) {
    const reply =
      "📜 ABOUT GORBOY / GGT / BOT\n\n" +
      "• GORBOY — brand, meme, lifestyle.\n" +
      "• GGT — intel & field terminal.\n" +
      "• Bot — Telegram edge of GGT: scans, links, mind.\n\n" +
      "🌐 https://www.gorboy.wtf\n🛰 https://ggt.wtf\n\n" +
      "0$ budget. Meme.Build.Repeat.";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /links
  if (lower.startsWith("/links")) {
    await tgSend(
      chatId,
      "🔗 LINKS\n\n• Site: https://www.gorboy.wtf\n• GGT: https://ggt.wtf\n\nGorboy Guard lives."
    );
    return res.status(200).json({ ok: true });
  }

  // /site
  if (lower.startsWith("/site")) {
    await tgSend(
      chatId,
      "🌐 GORBOY WEBSITE\nhttps://www.gorboy.wtf\n\nBrand · Lore · Terminal preview."
    );
    return res.status(200).json({ ok: true });
  }

  // /ggt
  if (lower.startsWith("/ggt")) {
    await tgSend(
      chatId,
      "🛰 GORBOY GUARD TERMINAL\nhttps://ggt.wtf\n\nPaste a mint → Hit SCAN."
    );
    return res.status(200).json({ ok: true });
  }

  // /status
  if (lower.startsWith("/status")) {
    const reply =
      "📡 GORBOY GUARD STATUS\n\n" +
      "CHAIN: Gorbagana (concept layer)\n" +
      "RPC: pending public endpoint\n" +
      "GGT: web terminal online\n" +
      "BOT: command router online\n" +
      "RISK ENGINE: placeholder\n" +
      "PATTERNS: text-only\n";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /patterns
  if (lower.startsWith("/patterns")) {
    const reply =
      "📈 PATTERN ALERTS — TL;DR\n\n" +
      "• FLAT TAIL — no organic retail.\n" +
      "• DOUBLE SHOULDER — segmented whales.\n" +
      "• HEAVY TOP1 — social risk.\n\n" +
      "GGT will visualize these. Bot = text only.";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /disclaimer
  if (lower.startsWith("/disclaimer")) {
    const reply =
      "⚠️ DISCLAIMER\n\n" +
      "• Not financial advice\n" +
      "• Always DYOR\n" +
      "• GORBOY = meme · brand · 0$ build\n" +
      "• May succeed or fail\n\nUse tools as signals, not guarantees.";
    await tgSend(chatId, reply);
    return res.status(200).json({ ok: true });
  }

  // /mind
  if (lower.startsWith("/mind")) {
    const arg = text.slice(5).trim();
    if (!isOnCooldown(chatId, fromId)) {
      await tgSend(chatId, buildMindReply(arg));
    }
    return res.status(200).json({ ok: true });
  }

  // /scan
  if (lower.startsWith("/scan")) {
    const arg = text.slice(5).trim();
    const token = extractTokenFromText(arg);

    if (!token) {
      await tgSend(
        chatId,
        "Usage:\n/scan $ticker\n/scan TICKER\n/scan <address>"
      );
      return res.status(200).json({ ok: true });
    }

    if (!isOnCooldown(chatId, fromId)) {
      const meta = buildDyorLinks(token);
      const title = meta.title;
      const trash = meta.trashscan;
      const ggt = meta.ggt;
      const egg = getEasterEggLine(token);
      let extraLine = meta.extra ? `\nNote: ${meta.extra}` : "";

      const reply =
        "🔍 GORBOY SCAN\n\n" +
        `Target: \`${title}\`\nType: *${token.type.toUpperCase()}*` +
        `${extraLine}${egg}\n\nLinks:\n• Trashscan: ${trash}\n• GGT: ${ggt}\n\nAlways DYOR.`;

      await tgSend(chatId, reply, { parse_mode: "Markdown" });
    }
    return res.status(200).json({ ok: true });
  }

  // -------- RAW MESSAGE AUTO-DYOR --------

  let token = extractTokenFromText(text);

  if (token && token.type === "ticker") {
    const pattern = new RegExp("\\$" + token.value + "\\b", "i");
    if (!pattern.test(text)) token = null;
  }

  if (token) {
    if (!isOnCooldown(chatId, fromId)) {
      const meta = buildDyorLinks(token);
      const title = meta.title;
      const trash = meta.trashscan;
      const ggt = meta.ggt;
      const egg = getEasterEggLine(token);
      let extraLine = meta.extra ? `\nNote: ${meta.extra}` : "";

      const reply =
        "🔍 GORBOY DYOR\n\n" +
        `Target: \`${title}\`\nType: *${token.type.toUpperCase()}*` +
        `${extraLine}${egg}\n\nLinks:\n• Trashscan: ${trash}\n• GGT: ${ggt}`;
      await tgSend(chatId, reply, { parse_mode: "Markdown" });
    }
    return res.status(200).json({ ok: true });
  }

  // -------- TRIGGERS: GOR / GORBOY --------

  const hasGorboy = /\bgorboy\b/i.test(text);
  const hasGor = /\bgor\b/i.test(text);

  if (hasGorboy || hasGor) {
    if (!isOnCooldown(chatId, fromId)) {
      const reply =
        "GORBOY is a brand, a meme and a Guard Terminal.\n\n" +
        "🌐 https://www.gorboy.wtf\n🛰 https://ggt.wtf\n\n" +
        "Commands:\n/about\n/help\n/scan $ticker\n/mind <text>\n\n0$ budget. Meme.Build.Repeat.";
      await tgSend(chatId, reply);
    }
    return res.status(200).json({ ok: true });
  }

  // -------- DEFAULT (silent in groups) --------

  if (chatType === "group" || chatType === "supergroup") {
    return res.status(200).json({ ok: true });
  }

  if (!isOnCooldown(chatId, fromId)) {
    await tgSend(
      chatId,
      "I react to commands, `$tickers` and addresses.\nTry /help."
    );
  }

  return res.status(200).json({ ok: true });
}
