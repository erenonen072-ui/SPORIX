
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

function getMatches(data) {
  if (Array.isArray(data)) return data;

  return (
    data?.matches ||
    data?.fixtures ||
    data?.results ||
    data?.data?.matches ||
    data?.data?.fixtures ||
    data?.data?.results ||
    []
  );
}

export default async function handler(req, res) {
  const { league, competition, date, status } = req.query;

  // Önce eski lig kodlarını, sonra doğrudan gönderilen slug'ı kullan.
  const selectedCompetition =
    competition ||
    LEAGUES[league] ||
    league;

  if (
    !selectedCompetition ||
    !/^[a-z0-9-]+$/i.test(selectedCompetition)
  ) {
    return res.status(400).json({
      success: false,
      error: "Geçerli bir lig seçmelisin."
    });
  }

  if (
    status &&
    !["live", "finished", "upcoming"].includes(status)
  ) {
    return res.status(400).json({
      success: false,
      error: "Geçersiz maç filtresi."
    });
  }

  try {
    const selectedDate = date || getTurkeyDate();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(selectedDate)) {
      return res.status(400).json({
        success: false,
        error: "Tarih YYYY-MM-DD formatında olmalı."
      });
    }

    const url = new URL(
      "https://sportscore.com/api/v1/fixtures/"
    );

    url.searchParams.set("sport", "football");
    url.searchParams.set("date", selectedDate);
    url.searchParams.set("competition", selectedCompetition);
    url.searchParams.set("limit", "200");

    if (status) {
      url.searchParams.set("status", status);
    }

    const headers = {
      Accept: "application/json"
    };

    const apiKey = process.env.SPORTSCORE_API_KEY;

    if (apiKey) {
      headers["X-Api-Key"] = apiKey;
    }

    const response = await fetch(url, {
      method: "GET",
      headers,
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        error: "SportScore API isteği başarısız.",
        details: data
      });
    }

    const matches = getMatches(data);

    if (!Array.isArray(matches)) {
      throw new Error("API geçerli bir maç listesi döndürmedi.");
    }

    return res.status(200).json({
      success: true,
      sport: "football",
      league: league || selectedCompetition,
      competition: selectedCompetition,
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
