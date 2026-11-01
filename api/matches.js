
"use strict";

const API = "https://sportscore.com/api/v1";

function normalize(value) {
  return String(value || "")
    .toLocaleLowerCase("tr-TR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function collectObjects(value, result = []) {
  if (!value || typeof value !== "object") return result;

  if (Array.isArray(value)) {
    value.forEach(item => collectObjects(item, result));
    return result;
  }

  result.push(value);

  Object.values(value).forEach(item => {
    if (item && typeof item === "object") {
      collectObjects(item, result);
    }
  });

  return result;
}

async function fetchJSON(url) {
  const headers = { Accept: "application/json" };

  const key = process.env.SPORTSCORE_API_KEY;
  if (key) headers["X-Api-Key"] = key;

  const response = await fetch(url, { headers });
  const data = await response.json();

  if (!response.ok) {
    throw new Error(
      data?.error || `SportScore hatası: ${response.status}`
    );
  }

  return data;
}

async function findCompetitionSlug(query) {
  const url = new URL(`${API}/search/`);

  url.searchParams.set("q", query);
  url.searchParams.set("sport", "football");
  url.searchParams.set("limit", "20");

  const data = await fetchJSON(url);
  const objects = collectObjects(data);

  const candidates = objects
    .map(item => {
      const name =
        item.name ||
        item.title ||
        item.display_name ||
        item.competition_name ||
        item.league_name ||
        "";

      const slug =
        item.slug ||
        item.competition_slug ||
        item.league_slug ||
        "";

      return {
        name: String(name),
        slug: String(slug),
        normalized: normalize(name)
      };
    })
    .filter(item => item.name && item.slug);

  const target = normalize(query);

  const exact = candidates.find(item =>
    item.normalized === target
  );

  if (exact) return exact;

  const similar = candidates.find(item =>
    item.normalized.includes(target) ||
    target.includes(item.normalized)
  );

  return similar || null;
}

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
  const league = String(req.query.league || "").trim();
  const date = req.query.date || getTurkeyDate();

  if (!league) {
    return res.status(400).json({
      success: false,
      error: "Lütfen lig seç."
    });
  }

  try {
    const competition = await findCompetitionSlug(league);

    if (!competition) {
      return res.status(404).json({
        success: false,
        error: "Bu lig SportScore aramasında bulunamadı.",
        searched: league
      });
    }

    const url = new URL(`${API}/fixtures/`);

    url.searchParams.set("sport", "football");
    url.searchParams.set("date", date);
    url.searchParams.set("competition", competition.slug);
    url.searchParams.set("limit", "200");

    const data = await fetchJSON(url);

    const matches = Array.isArray(data.matches)
      ? data.matches
      : Array.isArray(data.fixtures)
        ? data.fixtures
        : Array.isArray(data.results)
          ? data.results
          : [];

    return res.status(200).json({
      success: true,
      league: competition.name,
      competition: competition.slug,
      date,
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
