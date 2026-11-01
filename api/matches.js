
"use strict";

const WIDGET_URL = "https://sportscore.com/api/widget/matches/";
const FIXTURES_URL = "https://sportscore.com/api/v1/fixtures/";

function send(res, status, body) {
  return res.status(status).json(body);
}

function validDate(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") &&
    !Number.isNaN(Date.parse(`${value}T00:00:00Z`));
}

function extractMatches(data) {
  if (Array.isArray(data?.matches)) return data.matches;
  if (Array.isArray(data?.data?.matches)) return data.data.matches;
  if (Array.isArray(data?.fixtures)) return data.fixtures;
  if (Array.isArray(data?.data?.fixtures)) return data.data.fixtures;
  if (Array.isArray(data?.data)) return data.data;
  return [];
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return send(res, 405, {
      success: false,
      error: "Sadece GET isteği destekleniyor."
    });
  }

  const date = String(req.query.date || "").trim();
  const competition = String(req.query.competition || "").trim();
  const status = String(req.query.status || "").trim();

  const isFixturesRequest = Boolean(date || competition || status);

  if (date && !validDate(date)) {
    return send(res, 400, {
      success: false,
      error: "Tarih YYYY-MM-DD formatında olmalıdır."
    });
  }

  if (competition && !/^[a-z0-9-]{2,120}$/i.test(competition)) {
    return send(res, 400, {
      success: false,
      error: "Geçersiz lig slug değeri."
    });
  }

  if (status && !["live", "finished", "upcoming"].includes(status)) {
    return send(res, 400, {
      success: false,
      error: "Geçersiz maç durumu."
    });
  }

  const requestedLimit = Number.parseInt(req.query.limit, 10) || 50;
  const limit = Math.min(
    isFixturesRequest ? 200 : 50,
    Math.max(1, requestedLimit)
  );

  const url = new URL(
    isFixturesRequest ? FIXTURES_URL : WIDGET_URL
  );

  url.searchParams.set("sport", "football");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("src", "sporix.vercel.app");

  if (isFixturesRequest) {
    if (date) url.searchParams.set("date", date);
    if (competition) {
      url.searchParams.set("competition", competition);
    }
    if (status) url.searchParams.set("status", status);
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        Accept: "application/json"
      },
      signal: AbortSignal.timeout(15000)
    });

    const text = await response.text();

    let data;

    try {
      data = JSON.parse(text);
    } catch {
      return send(res, 502, {
        success: false,
        error: "SportScore geçerli JSON döndürmedi."
      });
    }

    if (!response.ok) {
      return send(res, response.status, {
        success: false,
        error: "SportScore maç verilerini alamadı.",
        details: data
      });
    }

    const matches = extractMatches(data);

    res.setHeader(
      "Cache-Control",
      "s-maxage=45, stale-while-revalidate=30"
    );

    return send(res, 200, {
      success: true,
      sport: "football",
      source: isFixturesRequest ? "fixtures" : "widget",
      count: matches.length,
      matches,
      updated: new Date().toISOString()
    });

  } catch (error) {
    console.error("SPORIX matches:", error);

    return send(res, 502, {
      success: false,
      error: error.name === "TimeoutError"
        ? "Maç verisi isteği zaman aşımına uğradı."
        : "SportScore sunucusuna ulaşılamadı."
    });
  }
}
