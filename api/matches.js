
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
  const { league, date, status } = req.query;

  if (!league) {
    return res.status(400).json({
      success: false,
      error: "Lütfen lig seç."
    });
  }

  const competition = LEAGUES[league];

  if (!competition) {
    return res.status(400).json({
      success: false,
      error: "Desteklenmeyen lig.",
      league
    });
  }

  try {
    const selectedDate = date || getTurkeyDate();

    const url = new URL(
      "https://sportscore.com/api/v1/fixtures/"
    );

    url.searchParams.set("sport", "football");
    url.searchParams.set("date", selectedDate);
    url.searchParams.set("competition", competition);
    url.searchParams.set("limit", "200");

    if (status && ["live", "finished", "upcoming"].includes(status)) {
      url.searchParams.set("status", status);
    }

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
        error: "SportScore API isteği başarısız.",
        details: data
      });
    }

    const matches = Array.isArray(data.matches)
      ? data.matches
      : [];

    return res.status(200).json({
      success: true,
      sport: "football",
      league,
      competition,
      date: selectedDate,
      count: matches.length,
      matches,
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
