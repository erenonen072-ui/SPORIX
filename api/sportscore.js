"use strict";

const WIDGET_URL = "https://sportscore.com/api/widget/";
const API_URL = "https://sportscore.com/api/v1/";

const ENDPOINTS = {
  matches: { base: WIDGET_URL, path: "matches/" },
  match: { base: WIDGET_URL, path: "match/" },
  team: { base: WIDGET_URL, path: "team/" },
  standings: { base: WIDGET_URL, path: "standings/" },
  topscorers: { base: WIDGET_URL, path: "topscorers/" },
  player: { base: WIDGET_URL, path: "player/" },
  bracket: { base: WIDGET_URL, path: "bracket/" },
  tracker: { base: WIDGET_URL, path: "tracker/" },
  fixtures: { base: API_URL, path: "fixtures/" },
  search: { base: API_URL, path: "search/" }
};

function send(res, status, body) {
  return res.status(status).json(body);
}

function validSlug(value) {
  return /^[a-z0-9-]{2,120}$/i.test(value || "");
}

function getLimit(value, fallback, max) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(1, parsed));
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "");
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return send(res, 405, {
      success: false,
      error: "Sadece GET isteği destekleniyor."
    });
  }

  const action = String(req.query.action || "").toLowerCase();
  const config = ENDPOINTS[action];

  if (!config) {
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

  if (action === "matches") {
    params.set("limit", String(getLimit(req.query.limit, 20, 50)));
  }

  if (action === "search") {
    const q = String(req.query.q || "").trim();

    if (q.length < 2 || q.length > 100) {
      return send(res, 400, {
        success: false,
        error: "Arama için en az 2 karakter girilmelidir."
      });
    }

    params.set("q", q);
    params.set("limit", String(getLimit(req.query.limit, 20, 20)));
  }

  if (action === "fixtures") {
    const date = String(req.query.date || "").trim();
    const status = String(req.query.status || "").toLowerCase();
    const competition = String(req.query.competition || "").trim();
    const team = String(req.query.team || "").trim();

    if (date && !validDate(date)) {
      return send(res, 400, {
        success: false,
        error: "Tarih YYYY-MM-DD biçiminde olmalıdır."
      });
    }

    if (status && !["live", "finished", "upcoming"].includes(status)) {
      return send(res, 400, {
        success: false,
        error: "Geçersiz maç durumu."
      });
    }

    if (competition && !validSlug(competition)) {
      return send(res, 400, {
        success: false,
        error: "Geçersiz lig slug değeri."
      });
    }

    if (team && !validSlug(team)) {
      return send(res, 400, {
        success: false,
        error: "Geçersiz takım slug değeri."
      });
    }

    if (date) params.set("date", date);
    if (status) params.set("status", status);
    if (competition) params.set("competition", competition);
    if (team) params.set("team", team);

    params.set("limit", String(getLimit(req.query.limit, 100, 200)));
  }

  if (["team", "topscorers"].includes(action)) {
    params.set("limit", String(getLimit(req.query.limit, 20, 50)));
  }

  if (action === "topscorers") {
    params.set("stat", req.query.stat === "assists" ? "assists" : "goals");
  }

  const url = `${config.base}${config.path}?${params.toString()}`;

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
      error: error.name === "TimeoutError"
        ? "SportScore isteği zaman aşımına uğradı."
        : "SportScore sunucusuna ulaşılamıyor."
    });
  }
}
