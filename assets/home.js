"use strict";

// ============================================
// SPORIX - PROFESYONEL MAÇ MERKEZİ
// SportScore API bağlantısı
// ============================================

let selectedDate = getTurkeyDate();
let allMatches = [];
let refreshTimer = null;
let currentRequest = 0;

// --------------------------------------------
// TARİH İŞLEMLERİ
// --------------------------------------------

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
    match.start_at ||
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

// --------------------------------------------
// GENEL YARDIMCILAR
// --------------------------------------------

function cleanUrl(value) {
  if (typeof value !== "string") return "";

  const url = value.trim();

  if (!/^https?:\/\//i.test(url)) return "";

  return url;
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);

  if (className) element.className = className;

  if (text !== undefined && text !== null) {
    element.textContent = String(text);
  }

  return element;
}

function getNested(object, paths) {
  for (const path of paths) {
    const value = path.split(".").reduce((current, key) => {
      return current?.[key];
    }, object);

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return null;
}

// --------------------------------------------
// TAKIM BİLGİLERİ
// --------------------------------------------

function getTeam(value, logoValue) {
  const team = typeof value === "string"
    ? { name: value }
    : value || {};

  return {
    name:
      team.name ||
      team.shortName ||
      team.short_name ||
      team.title ||
      team.displayName ||
      "Takım",

    logo: cleanUrl(
      logoValue ||
      team.logo ||
      team.image ||
      team.crest ||
      team.logoUrl ||
      team.logo_url ||
      team.photo ||
      ""
    )
  };
}

function getTeams(match) {
  const home = getTeam(
    getNested(match, [
      "home",
      "homeTeam",
      "home_team",
      "teams.home",
      "participants.home"
    ]),
    match.home_logo || match.homeLogo
  );

  const away = getTeam(
    getNested(match, [
      "away",
      "awayTeam",
      "away_team",
      "teams.away",
      "participants.away"
    ]),
    match.away_logo || match.awayLogo
  );

  return [home, away];
}

// --------------------------------------------
// LİG BİLGİLERİ
// --------------------------------------------

function getCompetition(match) {
  const value =
    match.competition ||
    match.league ||
    match.tournament ||
    {};

  if (typeof value === "string") {
    return {
      name: value,
      slug:
        match.competition_slug ||
        match.league_slug ||
        "",
      logo: cleanUrl(
        match.competition_logo ||
        match.league_logo ||
        ""
      )
    };
  }

  return {
    name:
      value.name ||
      value.title ||
      value.displayName ||
      match.competition_name ||
      match.league_name ||
      match.tournament_name ||
      "Diğer Ligler",

    slug:
      value.slug ||
      match.competition_slug ||
      match.league_slug ||
      match.tournament_slug ||
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

// --------------------------------------------
// SKOR BİLGİLERİ
// --------------------------------------------

function getScore(match) {
  const home =
    getNested(match, [
      "home_score",
      "homeScore",
      "scores.home",
      "score.home",
      "result.home",
      "score_home"
    ]);

  const away =
    getNested(match, [
      "away_score",
      "awayScore",
      "scores.away",
      "score.away",
      "result.away",
      "score_away"
    ]);

  return [home, away];
}

// --------------------------------------------
// MAÇ DURUMU
// --------------------------------------------

function getStatus(match) {
  const raw =
    match.status?.name ||
    match.status?.type ||
    match.status ||
    match.state ||
    match.status_text ||
    "";

  const value = String(raw).toLowerCase();

  if (
    value.includes("live") ||
    value.includes("in_play") ||
    value.includes("in play") ||
    value.includes("progress") ||
    value.includes("1st half") ||
    value.includes("2nd half") ||
    value === "1h" ||
    value === "2h"
  ) {
    return {
      text: "CANLI",
      live: true,
      finished: false
    };
  }

  if (
    value.includes("finish") ||
    value.includes("ended") ||
    value.includes("complete") ||
    value.includes("full time") ||
    value === "ft"
  ) {
    return {
      text: "BİTTİ",
      live: false,
      finished: true
    };
  }

  if (value.includes("postponed")) {
    return {
      text: "ERTELENDİ",
      live: false,
      finished: false
    };
  }

  if (value.includes("cancel")) {
    return {
      text: "İPTAL",
      live: false,
      finished: false
    };
  }

  return {
    text: "BAŞLAMADI",
    live: false,
    finished: false
  };
}

// --------------------------------------------
// TAKIM KARTI
// --------------------------------------------

function createTeamElement(team, side) {
  const row = createElement(
    "div",
    `match-team ${side || ""}`
  );

  if (team.logo) {
    const image = document.createElement("img");

    image.src = team.logo;
    image.alt = team.name;
    image.loading = "lazy";
    image.referrerPolicy = "no-referrer";

    image.onerror = () => image.remove();

    row.appendChild(image);
  }

  row.appendChild(
    createElement("span", "match-team-name", team.name)
  );

  return row;
}

// --------------------------------------------
// MAÇ KARTI
// --------------------------------------------

function createMatchCard(match) {
  const [home, away] = getTeams(match);
  const [homeScore, awayScore] = getScore(match);
  const status = getStatus(match);

  const card = createElement("article", "match-row");

  if (status.live) {
    card.classList.add("match-live");
  }

  // Ev sahibi
  card.appendChild(
    createTeamElement(home, "home")
  );

  // Skor ve durum
  const scoreBox = createElement("div", "match-score");

  const score = createElement("strong");

  if (status.live || status.finished) {
    score.textContent =
      `${homeScore ?? "-"} - ${awayScore ?? "-"}`;
  } else {
    score.textContent = matchTime(match);
  }

  scoreBox.appendChild(score);

  const statusText = createElement(
    "small",
    status.live ? "live-text" : "",
    status.live ? "● CANLI" : status.text
  );

  scoreBox.appendChild(statusText);

  card.appendChild(scoreBox);

  // Deplasman
  card.appendChild(
    createTeamElement(away, "away")
  );

  // Maç detay bağlantısı
  const slug =
    match.slug ||
    match.match_slug ||
    match.url_slug;

  if (slug && /^[a-z0-9-]+$/i.test(slug)) {
    const detail = createElement(
      "a",
      "match-detail-link",
      "Maç detayları"
    );

    detail.href =
      `/veri.html?view=match&slug=${encodeURIComponent(slug)}`;

    detail.setAttribute("aria-label", `${home.name} - ${away.name} maç detayları`);

    card.appendChild(detail);
  }

  return card;
}

// --------------------------------------------
// TARİH SEÇİCİ
// --------------------------------------------

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
      }).toLocaleUpperCase("tr-TR");

    const button = createElement(
      "button",
      "date-button"
    );

    button.type = "button";

    button.classList.toggle(
      "active",
      date === selectedDate
    );

    button.setAttribute(
      "aria-pressed",
      String(date === selectedDate)
    );

    button.append(
      createElement("span", "day-name", dayName),
      createElement(
        "strong",
        "day-number",
        parsed.toLocaleDateString("tr-TR", {
          day: "2-digit",
          timeZone: "Europe/Istanbul"
        })
      ),
      createElement(
        "span",
        "day-month",
        parsed.toLocaleDateString("tr-TR", {
          month: "short",
          timeZone: "Europe/Istanbul"
        })
      )
    );

    button.addEventListener("click", () => {
      selectedDate = date;
      renderDateStrip();
      renderMatches();
    });

    strip.appendChild(button);
  }

  if (label) {
    label.textContent = dateFromString(selectedDate).toLocaleDateString(
      "tr-TR",
      {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/Istanbul"
      }
    );
  }
}

// --------------------------------------------
// MAÇLARI LİGLERE GÖRE GRUPLAMA
// --------------------------------------------

function renderMatches() {
  const container = document.getElementById("matchList");

  if (!container) return;

  container.replaceChildren();

  const filtered = allMatches.filter(match => {
    return matchDay(match) === selectedDate;
  });

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
      "match-empty",
      "Bu tarihte gösterilebilecek maç bulunamadı."
    );

    container.appendChild(empty);
    return;
  }

  const sortedGroups = [...groups.values()].sort(
    (a, b) => a.competition.name.localeCompare(
      b.competition.name,
      "tr"
    )
  );

  sortedGroups.forEach(group => {
    const section = createElement(
      "section",
      "match-group"
    );

    const heading = createElement(
      "div",
      "match-group-title"
    );

    const title = createElement(
      "strong",
      "",
      group.competition.name
    );

    heading.appendChild(title);

    heading.appendChild(
      createElement(
        "span",
        "",
        `${group.matches.length} MAÇ`
      )
    );

    section.appendChild(heading);

    group.matches
      .sort((a, b) => {
        const first = parseDate(matchDate(a))?.getTime() || 0;
        const second = parseDate(matchDate(b))?.getTime() || 0;

        return first - second;
      })
      .forEach(match => {
        section.appendChild(createMatchCard(match));
      });

    container.appendChild(section);
  });
}

// --------------------------------------------
// API'DEN MAÇLARI YÜKLE
// --------------------------------------------

async function loadAllMatches() {
  const request = ++currentRequest;
  const container = document.getElementById("matchList");

  if (container && !allMatches.length) {
    container.replaceChildren(
      createElement(
        "div",
        "match-loading",
        "Maçlar yükleniyor..."
      )
    );
  }

  try {
    const response = await fetch(
      "/api/matches?limit=50",
      {
        method: "GET",
        cache: "no-store",
        headers: {
          "Accept": "application/json"
        }
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const result = await response.json();

    // Daha yeni istek başladıysa eski sonucu kullanma.
    if (request !== currentRequest) return;

    if (!result.success) {
      throw new Error(
        result.error || "SportScore API hatası"
      );
    }

    allMatches = Array.isArray(result.matches)
      ? result.matches
      : [];

    renderMatches();

  } catch (error) {
    console.error(
      "SPORIX maç yükleme hatası:",
      error
    );

    if (request !== currentRequest) return;

    if (container) {
      container.replaceChildren(
        createElement(
          "div",
          "match-error",
          "Maç verileri şu anda alınamıyor. Lütfen daha sonra tekrar deneyin."
        )
      );
    }
  }
}

// --------------------------------------------
// MOBİL MENÜ
// --------------------------------------------

function setupMobileMenu() {
  const menuToggle = document.getElementById(
    "mobileMenuButton"
  );

  const mainNav = document.getElementById(
    "mainNav"
  );

  if (!menuToggle || !mainNav) return;

  menuToggle.addEventListener("click", () => {
    const open = mainNav.classList.toggle("open");

    menuToggle.setAttribute(
      "aria-expanded",
      String(open)
    );

    menuToggle.textContent = open ? "✕" : "☰";
  });

  mainNav.querySelectorAll("a").forEach(link => {
    link.addEventListener("click", () => {
      mainNav.classList.remove("open");

      menuToggle.setAttribute(
        "aria-expanded",
        "false"
      );

      menuToggle.textContent = "☰";
    });
  });
}

// --------------------------------------------
// SAYFA BAŞLATMA
// --------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
  renderDateStrip();
  setupMobileMenu();

  const year = document.getElementById("currentYear");

  if (year) {
    year.textContent = new Date().getFullYear();
  }

  loadAllMatches();

  if (refreshTimer) {
    clearInterval(refreshTimer);
  }

  // Her 60 saniyede maç verilerini yenile.
  refreshTimer = setInterval(() => {
    loadAllMatches();
  }, 60000);
});
