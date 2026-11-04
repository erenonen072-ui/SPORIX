
"use strict";

const API_URL = "https://sportscore.com/api/v1/fixtures/";

function getTurkeyDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const values = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(dateString, amount) {
  const date = new Date(`${dateString}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + amount);
  return date.toISOString().slice(0, 10);
}

function getMatches(data, depth = 0) {
  if (Array.isArray(data)) {
    return data.filter(item => item && typeof item === "object");
  }

  if (!data || typeof data !== "object" || depth > 8) {
    return [];
  }

  for (const key of [
    "matches",
    "fixtures",
    "results",
    "events",
    "items",
    "data",
    "response"
  ]) {
    if (data[key] != null) {
      const result = getMatches(data[key], depth + 1);
      if (result.length) return result;
    }
  }

  return [];
}

function getCompetition(match) {
  return match.competition || match.league || match.tournament || {};
}

function getCompetitionName(match) {
  const competition = getCompetition(match);

  if (typeof competition === "string") return competition;

  return (
    match.competition_name ||
    match.league_name ||
    competition.name ||
    competition.title ||
    "Diğer Maçlar"
  );
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/ı/g, "i")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function getCompetitionSlug(match) {
  const competition = getCompetition(match);

  if (typeof competition === "object") {
    const slug =
      match.competition_slug ||
      match.league_slug ||
      competition.slug;

    if (slug) return String(slug).toLowerCase();
  }

  return slugify(getCompetitionName(match));
}

function getMatchDate(match) {
  return (
    match.start_time ||
    match.startTime ||
    match.time ||
    match.date ||
    ""
  );
}

function getMatchId(match) {
  return String(
    match.id ||
    match.fixture_id ||
    match.event_id ||
    match.slug ||
    [
      match.home,
      match.away,
      getMatchDate(match)
    ].join("-")
  );
}

function isTurkeyDate(match, targetDate) {
  const value = getMatchDate(match);
  if (!value) return false;

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return false;

  return getTurkeyDate(parsed) === targetDate;
}

function uniqueMatches(matches) {
  const map = new Map();

  for (const match of matches) {
    const key = getMatchId(match);

    if (!map.has(key)) {
      map.set(key, match);
    } else {
      map.set(key, {
        ...map.get(key),
        ...match
      });
    }
  }

  return [...map.values()];
}

function sortMatches(matches) {
  return matches.sort((a, b) => {
    return (
      new Date(getMatchDate(a)).getTime() -
      new Date(getMatchDate(b)).getTime()
    );
  });
}

async function fetchMatches(date, competition) {
  const url = new URL(API_URL);

  url.searchParams.set("sport", "football");
  url.searchParams.set("date", date);
  url.searchParams.set("limit", "200");

  if (competition) {
    url.searchParams.set("competition", competition);
  }

  const response = await fetch(url.toString(), {
    headers: {
      Accept: "application/json"
    }
  });

  if (!response.ok) {
    throw new Error(`SportScore HTTP ${response.status}`);
  }

  const data = await response.json();
  return getMatches(data);
}

async function fetchTurkeyDay(targetDate, competition) {
  const utcDates = [
    addDays(targetDate, -1),
    targetDate
  ];

  const results = await Promise.allSettled(
    utcDates.map(date => fetchMatches(date, competition))
  );

  const matches = [];

  for (const result of results) {
    if (result.status === "fulfilled") {
      matches.push(...result.value);
    }
  }

  return {
    matches: uniqueMatches(
      matches.filter(match => isTurkeyDate(match, targetDate))
    ),
    errors: results
      .filter(result => result.status === "rejected")
      .map(result => result.reason?.message || "API hatası")
  };
}

function buildLeagues(matches) {
  const map = new Map();

  for (const match of matches) {
    const name = getCompetitionName(match);
    const slug = getCompetitionSlug(match);

    if (!slug) continue;

    if (!map.has(slug)) {
      map.set(slug, {
        name,
        slug,
        count: 0,
        status: "ok"
      });
    }

    map.get(slug).count++;
  }

  return [...map.values()].sort((a, b) =>
    a.name.localeCompare(b.name, "tr")
  );
}

module.exports = async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "public, s-maxage=30, stale-while-revalidate=60"
  );

  try {
    const date = String(
      req.query.date || getTurkeyDate()
    );

    const selectedCompetition = String(
      req.query.competition || ""
    ).trim();

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: "Geçersiz tarih.",
        matches: [],
        leagues: []
      });
    }

    const result = await fetchTurkeyDay(
      date,
      selectedCompetition
    );

    const matches = sortMatches(result.matches);
    const leagues = buildLeagues(matches);

    return res.status(200).json({
      success: true,
      source: "SportScore",
      date,
      selectedCompetition: selectedCompetition || null,
      count: matches.length,
      matches,
      leagues,
      warnings: result.errors
    });

  } catch (error) {
    console.error("SPORIX API ERROR:", error);

    return res.status(500).json({
      success: false,
      error: error.message || "Maç verileri alınamadı.",
      matches: [],
      leagues: []
    });
  }
};
