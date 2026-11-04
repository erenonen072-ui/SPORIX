"use strict";
const API_URL = "https://sportscore.com/api/v1/fixtures/";
const TURKISH_LEAGUES = [
  { name: "Süper Lig", slug: "turkish-super-league" },
  { name: "1. Lig", slug: "turkish-first-league" },
  { name: "2. Lig", slug: "turkish-second-league" },
  { name: "3. Lig", slug: "turkish-third-league" },
  { name: "Türkiye Kupası", slug: "turkish-cup" },
  { name: "Süper Kupa", slug: "turkish-super-cup" }
];
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
function getMatches(data, depth = 0) {
  if (Array.isArray(data)) {
    return data.filter(
      item => item && typeof item === "object"
    );
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
    if (data[key] !== undefined && data[key] !== null) {
      const result = getMatches(data[key], depth + 1);
      if (result.length) return result;
    }
  }
  return [];
}
function makeUrl(date, competition) {
  const url = new URL(API_URL);
  url.searchParams.set("sport", "football");
  url.searchParams.set("date", date);
  url.searchParams.set("limit", "200");
  if (competition) {
    url.searchParams.set("competition", competition);
  }
  return url.toString();
}
async function fetchMatches(date, competition) {
  const response = await fetch(
    makeUrl(date, competition),
    {
      headers: {
        Accept: "application/json"
      }
    }
  );
  const body = await response.text();
  if (!response.ok) {
    throw new Error(
      `SportScore HTTP ${response.status}`
    );
  }
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error(
      "SportScore geçersiz JSON döndürdü."
    );
  }
  return {
    matches: getMatches(data),
    raw: data
  };
}
function getCompetitionName(match) {
  const competition =
    match.competition ||
    match.league ||
    match.tournament ||
    {};
  if (typeof competition === "string") {
    return competition;
  }
  return (
    match.competition_name ||
    competition.name ||
    competition.title ||
    match.league_name ||
    "Diğer Maçlar"
  );
}
function getCompetitionSlug(match) {
  const competition =
    match.competition ||
    match.league ||
    match.tournament ||
    {};
  if (typeof competition === "string") {
    return competition.toLowerCase().replace(/\s+/g, "-");
  }
  return (
    match.competition_slug ||
    match.league_slug ||
    competition.slug ||
    ""
  ).toLowerCase();
}
function getMatchId(match) {
  return String(
    match.id ||
    match.fixture_id ||
    match.event_id ||
    match.slug ||
    match.url ||
    [
      match.home,
      match.away,
      match.start_time || match.time || match.date
    ].join("-")
  );
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
    const dateA = new Date(
      a.start_time ||
      a.startTime ||
      a.time ||
      a.date ||
      0
    ).getTime();
    const dateB = new Date(
      b.start_time ||
      b.startTime ||
      b.time ||
      b.date ||
      0
    ).getTime();
    return dateA - dateB;
  });
}
module.exports = async (req, res) => {
  res.setHeader(
    "Cache-Control",
    "no-store, no-cache, must-revalidate"
  );
  try {
    const date = String(
      req.query.date || getTurkeyDate()
    );
    const selectedCompetition = String(
      req.query.competition || ""
    );
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return res.status(400).json({
        success: false,
        error: "Geçersiz tarih.",
        matches: [],
        leagues: []
      });
    }
    // =====================================
    // BELİRLİ BİR LİG SEÇİLDİYSE
    // =====================================
    if (selectedCompetition) {
      const selectedLeague = TURKISH_LEAGUES.find(
        league => league.slug === selectedCompetition
      );
      const result = await fetchMatches(
        date,
        selectedCompetition
      );
      const matches = result.matches.map(match => ({
        ...match,
        ...(selectedLeague
          ? {
              competition_name: selectedLeague.name,
              competition_slug: selectedLeague.slug
            }
          : {})
      }));
      return res.status(200).json({
        success: true,
        source: "SportScore",
        date,
        selectedCompetition,
        count: matches.length,
        matches: sortMatches(uniqueMatches(matches)),
        leagues: [{
          name: selectedLeague
            ? selectedLeague.name
            : selectedCompetition,
          slug: selectedCompetition,
          status: matches.length ? "ok" : "empty",
          count: matches.length
        }]
      });
    }
    // =====================================
    // TÜM MAÇLAR
    // YABANCI + TÜRK LİGLERİ
    // =====================================
    const requests = await Promise.allSettled([
      // Genel sorgu: yabancı ligler ve diğer maçlar
      fetchMatches(date),
      // Altı Türk organizasyonu
      ...TURKISH_LEAGUES.map(league =>
        fetchMatches(date, league.slug)
      )
    ]);
    const allMatches = [];
    const leagues = [];
    // =====================================
    // GENEL MAÇLARI EKLE
    // =====================================
    const generalResult = requests[0];
    if (generalResult.status === "fulfilled") {
      allMatches.push(
        ...generalResult.value.matches
      );
      leagues.push({
        name: "Uluslararası Ligler",
        slug: "international",
        status: "ok",
        count: generalResult.value.matches.length
      });
    } else {
      leagues.push({
        name: "Uluslararası Ligler",
        slug: "international",
        status: "error",
        count: 0,
        error: generalResult.reason?.message
      });
    }
    // =====================================
    // TÜRK LİGLERİNİ EKLE
    // =====================================
    TURKISH_LEAGUES.forEach((league, index) => {
      const result = requests[index + 1];
      if (result.status === "rejected") {
        leagues.push({
          name: league.name,
          slug: league.slug,
          status: "error",
          count: 0,
          error: result.reason?.message
        });
        return;
      }
      const matches = result.value.matches.map(match => ({
        ...match,
        competition_name: league.name,
        competition_slug: league.slug
      }));
      allMatches.push(...matches);
      leagues.push({
        name: league.name,
        slug: league.slug,
        status: matches.length ? "ok" : "empty",
        count: matches.length
      });
    });
    // =====================================
    // TEKRARLARI TEMİZLE VE SIRALA
    // =====================================
    const matches = sortMatches(
      uniqueMatches(allMatches)
    );
    return res.status(200).json({
      success: true,
      source: "SportScore",
      date,
      count: matches.length,
      matches,
      leagues
    });
  } catch (error) {
    console.error("SPORIX API ERROR:", error);
    return res.status(500).json({
      success: false,
      error: error.message,
      matches: [],
      leagues: []
    });
  }
};
