
"use strict";

const LEAGUES = {
  "premier-league": "english-premier-league",
  "la-liga": "spanish-la-liga",
  "serie-a": "italian-serie-a",
  "bundesliga": "bundesliga",
  "champions-league": "uefa-champions-league"
};

const TEAM_COMPETITIONS = {
  "super-lig": "Turkish Super League"
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

function filterMatches(matches, competition, date, status) {
  let result = Array.isArray(matches) ? matches : [];

  if (competition) {
    result = result.filter(match => {
      const name = typeof match.competition === "string"
        ? match.competition
        : match.competition?.name || "";

      return name.toLowerCase() === competition.toLowerCase();
    });
  }

  if (date) {
    result = result.filter(match => {
      const matchDate = match.time || match.date || "";
      return String(matchDate).slice(0, 10) === date;
    });
  }

  if (status && ["live", "finished", "upcoming"].includes(status)) {
    result = result.filter(match => match.status === status);
  }

  return result;
}

export default async function handler(req, res) {
  const { league, date, status } = req.query;

  if (!league) {
    return res.status(400).json({
      error: "Lütfen bir lig seç."
    });
  }

  try {
    const selectedDate = date || getTurkeyDate();

    const url = new URL(
      "https://sportscore.com/api/v1/fixtures/"
    );

    url.searchParams.set("sport", "football");
    url.searchParams.set("date", selectedDate);
    url.searchParams.set("limit", "200");
    url.searchParams.set("src", "sporix");

    let competitionName = null;

    if (TEAM_COMPETITIONS[league]) {
      // Süper Lig: tüm takımların günlük maçlarını getir.
      competitionName = TEAM_COMPETITIONS[league];
    } else {
      const competitionSlug = LEAGUES[league];

      if (!competitionSlug) {
        return res.status(400).json({
          error: "Bu lig henüz desteklenmiyor.",
          league
        });
      }

      url.searchParams.set("competition", competitionSlug);
    }

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
        error: "SportScore API bağlantısı başarısız.",
        details: data
      });
    }

    const matches = filterMatches(
      data.matches,
      competitionName,
      null,
      status
    );

    return res.status(200).json({
      success: true,
      sport: "football",
      league,
      date: selectedDate,
      count: matches.length,
      matches,
      updated: data.updated || new Date().toISOString()
    });

  } catch (error) {
    console.error("SPORIX API:", error);

    return res.status(502).json({
      success: false,
      error: "Maç verileri alınamadı.",
      message: error.message
    });
  }
}
