
"use strict";

const BASE_URL = "https://sportscore.com/api/widget/";

const ENDPOINTS = {
  matches: "matches/",
  match: "match/",
  team: "team/",
  standings: "standings/",
  topscorers: "topscorers/",
  player: "player/",
  bracket: "bracket/",
  tracker: "tracker/"
};

function send(res, status, body) {
  return res.status(status).json(body);
}

function validSlug(value) {
  return /^[a-z0-9-]{2,120}$/i.test(value || "");
}

function getLimit(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(1, parsed));
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return send(res, 405, {
      success: false,
      error: "Sadece GET isteği destekleniyor."
    });
  }

  const action = String(req.query.action || "").toLowerCase();
  const endpoint = ENDPOINTS[action];

  if (!endpoint) {
    return send(res, 400, {
      success: false,
      error: "Geçersiz API işlemi."
    });
  }

  const params = new URLSearchParams();

  params.set("sport", "football");
  params.set("src", "sporix.vercel.app");

  const slug = String(req.query.slug || "").trim();
  const id = String(req.query.id || "").trim();

  const slugActions = [
    "match",
    "team",
    "standings",
    "topscorers",
    "player",
    "bracket"
  ];

  if (slugActions.includes(action)) {
    if (!validSlug(slug)) {
      return send(res, 400, {
        success: false,
        error: "Geçerli bir slug gönderilmelidir."
      });
    }

    params.set("slug", slug);
  }

  if (action === "tracker") {
    if (!/^\d+$/.test(id)) {
      return send(res, 400, {
        success: false,
        error: "Geçerli bir maç ID'si gönderilmelidir."
      });
    }

    params.set("id", id);
  }

  if (["matches", "team", "topscorers"].includes(action)) {
    const max = action === "team" ? 30 : 50;
    const limit = getLimit(req.query.limit, 20, max);

    params.set("limit", String(limit));
  }

  if (action === "topscorers") {
    params.set(
      "stat",
      req.query.stat === "assists" ? "assists" : "goals"
    );
  }

  const url = `${BASE_URL}${endpoint}?${params.toString()}`;

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(15000)
    });

    const responseText = await response.text();

    let data;

    try {
      data = JSON.parse(responseText);
    } catch {
      return send(res, 502, {
        success: false,
        error: "SportScore geçerli JSON yanıtı vermedi."
      });
    }

    if (!response.ok) {
      return send(res, response.status, {
        success: false,
        error: "SportScore isteği başarısız.",
        details: data
      });
    }

    res.setHeader(
      "Cache-Control",
      "s-maxage=45, stale-while-revalidate=30"
    );

    return send(res, 200, {
      success: true,
      action,
      data,
      updated: new Date().toISOString()
    });

  } catch (error) {
    console.error("SPORIX SportScore:", error);

    return send(res, 502, {
      success: false,
      error:
        error.name === "TimeoutError"
          ? "SportScore isteği zaman aşımına uğradı."
          : "SportScore sunucusuna şu anda ulaşılamıyor."
    });
  }
}
