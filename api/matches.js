
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

function extractMatches(data) {
  const candidates = [
    data?.matches,
    data?.fixtures,
    data?.results?.matches,
    data?.results?.fixtures,
    data?.data?.matches,
    data?.data?.fixtures,
    data?.data?.results
  ];

  return candidates.find(Array.isArray) || [];
}

export default async function handler(req, res) {
  if (req.method !== "GET") {
    return res.status(405).json({
      success: false,
      error: "Sadece GET isteği destekleniyor."
    });
  }

  const league = String(req.query.league || "");
  const requestedCompetition = String(req.query.competition || "");
  const date = String(req.query.date || getTurkeyDate());

  const competition =
    requestedCompetition || LEAGUES[league];

  if (!competition) {
    return res.status(400).json({
      success: false,
      error: "Geçerli bir lig veya competition slug gönder."
    });
  }

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

    if (!apiKey) {
      return res.status(500).json({
        success: false,
        error: "SPORTSCORE_API_KEY ortam değişkeni tanımlanmamış."
      });
    }

    headers["X-Api-Key"] = apiKey;

    const response = await fetch(url, { headers });

    const data = await response.json();

    if (!response.ok) {
      console.error("SportScore API:", response.status, data);

      return res.status(response.status).json({
        success: false,
        error: "SportScore maç isteği başarısız."
      });
    }

    const matches = extractMatches(data);

    return res.status(200).json({
      success: true,
      sport: "football",
      league: league || null,
      competition,
      date,
      count: matches.length,
      matches,
      updated: data.updated || new Date().toISOString()
    });

  } catch (error) {
    console.error("SPORIX API hatası:", error);

    return res.status(502).json({
      success: false,
      error: "Maç verileri alınamadı."
    });
  }
}
