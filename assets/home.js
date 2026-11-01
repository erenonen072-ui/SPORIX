
"use strict";

let selectedDate = getTurkeyDate();
let allMatches = [];
let refreshTimer = null;
let currentRequest = 0;

function getTurkeyDate(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(date);

  const get = type => parts.find(p => p.type === type).value;

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function dateFromString(value) {
  return new Date(`${value}T12:00:00+03:00`);
}

function addDays(value, amount) {
  const date = dateFromString(value);
  date.setDate(date.getDate() + amount);
  return getTurkeyDate(date);
}

function parseDate(value) {
  if (!value) return null;

  const date = typeof value === "number"
    ? new Date(value < 10000000000 ? value * 1000 : value)
    : new Date(value);

  return Number.isNaN(date.getTime()) ? null : date;
}

function matchDate(match) {
  return (
    match.time ||
    match.startTime ||
    match.start_time ||
    match.datetime ||
    match.date ||
    match.timestamp ||
    match.kickoff ||
    null
  );
}

function matchDay(match) {
  const date = parseDate(matchDate(match));
  return date ? getTurkeyDate(date) : "";
}

function matchTime(match) {
  const date = parseDate(matchDate(match));

  return date
    ? date.toLocaleTimeString("tr-TR", {
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "Europe/Istanbul"
      })
    : "--:--";
}

function cleanUrl(value) {
  if (typeof value !== "string") return "";

  const url = value.trim();
  return /^https?:\/\//i.test(url) ? url : "";
}

function getTeam(value, logoValue) {
  const team = typeof value === "string"
    ? { name: value }
    : value || {};

  return {
    name: team.name || team.shortName || team.title || "Takım",
    logo: cleanUrl(
      logoValue ||
      team.logo ||
      team.image ||
      team.crest ||
      team.logoUrl ||
      ""
    )
  };
}

function getTeams(match) {
  const home = getTeam(
    match.home || match.homeTeam || match.home_team,
    match.home_logo || match.homeLogo
  );

  const away = getTeam(
    match.away || match.awayTeam || match.away_team,
    match.away_logo || match.awayLogo
  );

  return [home, away];
}

function getCompetition(match) {
  const value = match.competition || match.league || {};

  if (typeof value === "string") {
    return {
      name: value,
      slug: match.competition_slug || match.league_slug || "",
      logo: cleanUrl(match.competition_logo || match.league_logo || "")
    };
  }

  return {
    name:
      value.name ||
      value.title ||
      match.competition_name ||
      match.league_name ||
      "Diğer Ligler",
    slug:
      value.slug ||
      match.competition_slug ||
      match.league_slug ||
      "",
    logo: cleanUrl(
      match.competition_logo ||
      match.league_logo ||
      value.logo ||
      value.image ||
      ""
    )
  };
}

function getScore(match) {
  const home =
    match.home_score ??
    match.homeScore ??
    match.scores?.home ??
    match.score?.home ??
    null;

  const away =
    match.away_score ??
    match.awayScore ??
    match.scores?.away ??
    match.score?.away ??
    null;

  return [home, away];
}

function getStatus(match) {
  const raw = match.status?.name || match.status?.type || match.status || match.state || "";
  const value = String(raw).toLowerCase();

  if (
    value.includes("live") ||
    value.includes("in_play") ||
    value.includes("progress") ||
    value === "1h" ||
    value === "2h"
  ) {
    return { text: "CANLI", live: true, finished: false };
  }

  if (
    value.includes("finish") ||
    value.includes("ended") ||
    value.includes("complete")
  ) {
    return { text: "BİTTİ", live: false, finished: true };
  }

  if (value.includes("postponed")) {
    return { text: "ERTELENDİ", live: false, finished: false };
  }

  if (value.includes("cancel")) {
    return { text: "İPTAL", live: false, finished: false };
  }

  return { text: "BAŞLAMADI", live: false, finished: false };
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createTeam(team) {
  const row = createElement("div", "match-team");

  if (team.logo) {
    const image = document.createElement("img");
    image.src = team.logo;
    image.alt = team.name;
    image.loading = "lazy";
    image.onerror = () => image.remove();
    row.appendChild(image);
  }

  row.appendChild(createElement("span", "", team.name));
  return row;
}

function createMatchCard(match) {
  const [home, away] = getTeams(match);
  const [homeScore, awayScore] = getScore(match);
  const status = getStatus(match);

  const card = createElement("article", "match-card");

  if (status.live) card.classList.add("match-live");

  const top = createElement("div", "match-status");
  if (status.live) top.classList.add("live");

  top.append(
    createElement("span", "", status.text),
    createElement("span", "match-date", matchTime(match))
  );

  const teams = createElement("div", "match-teams");
  teams.append(createTeam(home), createTeam(away));

  const score = createElement("div", "match-score");

  score.append(
    createElement("span", "", status.live || status.finished ? homeScore ?? "-" : "–"),
    createElement("span", "", status.live || status.finished ? awayScore ?? "-" : "–")
  );

  card.append(top, teams, score);

  const slug = match.slug || match.match_slug || match.url_slug;

  if (slug && /^[a-z0-9-]+$/i.test(slug)) {
    const detail = createElement("a", "match-detail-link", "Maç detayları");
    detail.href = `/veri.html?view=match&slug=${encodeURIComponent(slug)}`;
    card.appendChild(detail);
  }

  return card;
}

function renderDateStrip() {
  const strip = document.getElementById("dateStrip");
  const label = document.getElementById("selectedDateLabel");

  if (!strip) return;

  strip.replaceChildren();

  const today = getTurkeyDate();

  for (let offset = -1; offset <= 6; offset++) {
    const date = addDays(today, offset);
    const parsed = dateFromString(date);

    const dayName =
      offset === -1 ? "DÜN" :
      offset === 0 ? "BUGÜN" :
      offset === 1 ? "YARIN" :
      parsed.toLocaleDateString("tr-TR", {
        weekday: "short",
        timeZone: "Europe/Istanbul"
      });

    const button = createElement("button", "date-button");
    button.type = "button";
    button.classList.toggle("active", date === selectedDate);
    button.setAttribute("aria-pressed", String(date === selectedDate));

    button.append(
      createElement("span", "day-name", dayName),
      createElement("span", "day-number", parsed.toLocaleDateString("tr-TR", {
        day: "2-digit",
        timeZone: "Europe/Istanbul"
      })),
      createElement("span", "day-month", parsed.toLocaleDateString("tr-TR", {
        month: "short",
        timeZone: "Europe/Istanbul"
      }))
    );

    button.addEventListener("click", () => {
      selectedDate = date;
      renderDateStrip();
      renderMatches();
    });

    strip.appendChild(button);
  }

  if (label) {
    label.textContent = dateFromString(selectedDate).toLocaleDateString("tr-TR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "Europe/Istanbul"
    });
  }
}

function renderMatches() {
  const container = document.getElementById("leagueSections");
  if (!container) return;

  container.replaceChildren();

  const filtered = allMatches.filter(match => matchDay(match) === selectedDate);

  const groups = new Map();

  filtered.forEach(match => {
    const competition = getCompetition(match);
    const key = competition.slug || competition.name;

    if (!groups.has(key)) {
      groups.set(key, {
        competition,
        matches: []
      });
    }

    groups.get(key).matches.push(match);
  });

  if (!groups.size) {
    const empty = createElement(
      "div",
      "empty-state",
      "Bu tarihte API tarafından döndürülen maç bulunamadı."
    );
    container.appendChild(empty);
    return;
  }

  const sortedGroups = [...groups.values()].sort((a, b) =>
    a.competition.name.localeCompare(b.competition.name, "tr")
  );

  sortedGroups.forEach(group => {
    const section = createElement("section", "league-section");
    const heading = createElement("div", "league-heading");
    const identity = createElement("div", "league-identity");

    if (group.competition.logo) {
      const logo = document.createElement("img");
      logo.className = "league-logo";
      logo.src = group.competition.logo;
      logo.alt = group.competition.name;
      logo.loading = "lazy";
      logo.onerror = () => logo.remove();
      identity.appendChild(logo);
    }

    identity.appendChild(createElement("h2", "", group.competition.name));
    heading.appendChild(identity);

    const matchesBox = createElement("div", "league-matches");

    group.matches
      .sort((a, b) => {
        return (parseDate(matchDate(a))?.getTime() || 0) -
               (parseDate(matchDate(b))?.getTime() || 0);
      })
      .forEach(match => matchesBox.appendChild(createMatchCard(match)));

    section.append(heading, matchesBox);
    container.appendChild(section);
  });
}

async function loadAllMatches() {
  const request = ++currentRequest;
  const container = document.getElementById("leagueSections");

  if (container && !allMatches.length) {
    container.replaceChildren(
      createElement("div", "loading", "Maçlar yükleniyor...")
    );
  }

  try {
    const response = await fetch("/api/matches?limit=50", {
      cache: "no-store"
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const result = await response.json();

    if (request !== currentRequest) return;
    if (!result.success) throw new Error(result.error || "API hatası");

    allMatches = Array.isArray(result.matches) ? result.matches : [];
    renderMatches();
  } catch (error) {
    console.error("SPORIX maç yükleme:", error);

    if (container) {
      container.replaceChildren(
        createElement("div", "empty-state", "Maç verileri şu anda alınamıyor. Lütfen daha sonra tekrar deneyin.")
      );
    }
  }
}

document.addEventListener("DOMContentLoaded", () => {
  renderDateStrip();
  loadAllMatches();

  const menuToggle = document.getElementById("menuToggle");
  const mainNav = document.getElementById("mainNav");

  menuToggle?.addEventListener("click", () => {
    if (!mainNav) return;

    const open = mainNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });

  const year = document.getElementById("year");
  if (year) year.textContent = new Date().getFullYear();

  if (refreshTimer) clearInterval(refreshTimer);

  refreshTimer = setInterval(loadAllMatches, 60000);
});
