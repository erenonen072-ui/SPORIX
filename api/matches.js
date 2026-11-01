
"use strict";

const LEAGUES = {
  "super-lig": "turkish-super-league",
  "premier-league": "english-premier-league",
  "la-liga": "spanish-la-liga",
  "serie-a": "italian-serie-a",
  "bundesliga": "bundesliga",
  "champions-league": "uefa-champions-league"
};

function getTurkeyDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

export default async function handler(req, res) {
  const league = String(req.query.league || "");
  const requestedCompetition = String(req.query.competition || "");
  const date = String(req.query.date || getTurkeyDate());

  // Eski lig kodları veya API'den gelen gerçek competition slug
  const competition =
    requestedCompetition || LEAGUES[league];

  if (!competition) {
    return res.status(400).json({
      success: false,
      error: "Geçerli bir lig veya competition slug gönder."
    });
  }

  // Güvenli slug kontrolü
  if (!/^[a-zA-Z0-9-]{2,100}$/.test(competition)) {
    return res.status(400).json({
      success: false,
      error: "Geçersiz competition slug."
    });
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({
      success: false,
      error: "Tarih YYYY-MM-DD biçiminde olmalı."
    });
  }

  try {
    const url = new URL(
      "https://sportscore.com/api/v1/fixtures/"
    );

    url.searchParams.set("sport", "football");
    url.searchParams.set("date", date);
    url.searchParams.set("competition", competition);
    url.searchParams.set("limit", "200");

    const headers = {
      Accept: "application/json"
    };

    const apiKey = process.env.SPORTSCORE_API_KEY;

    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }

    const response = await fetch(url, { headers });
    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "SportScore maç isteği başarısız.",
        details: data
      });
    }

    const matches =
      data.matches ||
      data.fixtures ||
      data.results ||
      data.data?.matches ||
      data.data?.fixtures ||
      data.data?.results ||
      [];

    return res.status(200).json({
      success: true,
      sport: "football",
      league: league || null,
      competition,
      date,
      count: Array.isArray(matches) ? matches.length : 0,
      matches: Array.isArray(matches) ? matches : [],
      updated: data.updated || new Date().toISOString()
    });

  } catch (error) {
    console.error("SPORIX API hatası:", error);

    return res.status(502).json({
      success: false,
      error: "Maç verileri alınamadı.",
      message: error.message
    });
  }
}
