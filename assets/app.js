
"use strict";

const API_URL = "/api/matches";

const elements = {
  league: document.getElementById("leagueSelect"),
  matches: document.getElementById("matches"),
  date: document.getElementById("matchDate"),
  refresh: document.getElementById("refreshMatches"),
  tabs: document.querySelectorAll("[data-filter]"),
  menuBtn: document.getElementById("menuBtn"),
  nav: document.getElementById("mainNav")
};

let allMatches = [];
let activeFilter = "all";
let loading = false;

const STATUS_TEXT = {
  live: "CANLI",
  finished: "BİTTİ",
  upcoming: "BAŞLAMADI"
};

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

function cleanImageURL(value) {
  if (!value) return "";

  let url = String(value).trim();

  const markdown = url.match(/^\[.*?\]\((https?:\/\/.*?)\)$/);

  if (markdown) {
    url = markdown[1];
  }

  return /^https?:\/\//i.test(url) ? url : "";
}

function getMatchList(data) {
  if (Array.isArray(data)) return data;

  const lists = [
    data?.matches,
    data?.fixtures,
    data?.results,
    data?.data?.matches,
    data?.data?.fixtures,
    data?.data?.results
  ];

  return lists.find(Array.isArray) || [];
}

function getTeamName(team, fallback) {
  if (typeof team === "string") return team;

  return (
    team?.name ||
    team?.title ||
    team?.short_name ||
    team?.display_name ||
    fallback
  );
}

function getTeamLogo(team, match, side) {
  const direct = side === "home"
    ? match.home_logo || match.homeLogo
    : match.away_logo || match.awayLogo;

  if (direct) return cleanImageURL(direct);

  return typeof team === "object"
    ? cleanImageURL(team?.logo || team?.image || team?.crest || "")
    : "";
}

function getScore(match, side) {
  const team = side === "home" ? match.home : match.away;

  const direct = side === "home"
    ? match.home_score ?? match.homeScore
    : match.away_score ?? match.awayScore;

  if (direct !== undefined && direct !== null) {
    return direct;
  }

  if (typeof team === "object") {
    return team?.score ?? team?.goals ?? "-";
  }

  const scores = match.score || match.scores || {};

  return side === "home"
    ? scores.home ?? scores.home_score ?? "-"
    : scores.away ?? scores.away_score ?? "-";
}

function getStatus(match) {
  const raw = String(
    match.status ||
    match.state ||
    match.status_text ||
    match.statusText ||
    ""
  ).toLowerCase();

  if (
    /live|in.play|playing|1st half|2nd half|half time|halftime|extra time|penalty|canlı/.test(raw)
  ) {
    return "live";
  }

  if (
    /finished|complete|ended|full time|ft|after.penalty|bitti|maç sonu/.test(raw)
  ) {
    return "finished";
  }

  if (
    /upcoming|scheduled|not.started|ns|fixture|başlamadı|ertelendi/.test(raw)
  ) {
    return "upcoming";
  }

  const time = match.time || match.date || match.start_time || match.startTime;

  if (time) {
    const timestamp = new Date(time).getTime();

    if (!Number.isNaN(timestamp)) {
      return timestamp > Date.now() ? "upcoming" : "finished";
    }
  }

  return "upcoming";
}

function getTurkeyTime(match) {
  const value = match.time || match.date || match.start_time || match.startTime;

  if (!value) return "Saat bilgisi yok";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Saat bilgisi yok";
  }

  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul"
  });
}

function getStatusLabel(match, status) {
  if (status === "live") {
    return (
      match.minute ||
      match.elapsed ||
      match.status_text ||
      "CANLI"
    );
  }

  if (status === "finished") {
    return "MAÇ SONU";
  }

  return getTurkeyTime(match);
}

function getMatchDate(match) {
  const value = match.time || match.date || match.start_time || match.startTime;

  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul"
  });
}

function getCompetitionName(match) {
  const competition = match.competition || match.league || match.tournament;

  if (typeof competition === "string") {
    return competition;
  }

  return competition?.name || competition?.title || "";
}

function renderMatch(match) {
  const home = match.home || match.home_team || match.homeTeam || {};
  const away = match.away || match.away_team || match.awayTeam || {};

  const homeName = getTeamName(home, "Ev sahibi");
  const awayName = getTeamName(away, "Deplasman");

  const homeLogo = getTeamLogo(home, match, "home");
  const awayLogo = getTeamLogo(away, match, "away");

  const status = getStatus(match);

  const homeScore = getScore(match, "home");
  const awayScore = getScore(match, "away");

  const scoreHTML = status === "upcoming"
    ? `<span class="match-time">${escapeHTML(getTurkeyTime(match))}</span>`
    : `<strong class="match-score">${escapeHTML(homeScore)} - ${escapeHTML(awayScore)}</strong>`;

  return `
    <article class="match-card" data-status="${status}">

      <div class="match-card-top">
        <span class="match-status ${status}">
          ${status === "live" ? "<i></i>" : ""}
          ${escapeHTML(STATUS_TEXT[status])}
        </span>

        <span class="match-competition">
          ${escapeHTML(getCompetitionName(match))}
        </span>
      </div>

      <div class="match-card-body">

        <div class="match-team">
          ${
            homeLogo
              ? `<img src="${escapeHTML(homeLogo)}" alt="${escapeHTML(homeName)}" loading="lazy" onerror="this.style.display='none'">`
              : '<span class="team-placeholder">⚽</span>'
          }
          <span>${escapeHTML(homeName)}</span>
        </div>

        <div class="match-result">
          ${scoreHTML}
          <small>${escapeHTML(getStatusLabel(match, status))}</small>
        </div>

        <div class="match-team away">
          ${
            awayLogo
              ? `<img src="${escapeHTML(awayLogo)}" alt="${escapeHTML(awayName)}" loading="lazy" onerror="this.style.display='none'">`
              : '<span class="team-placeholder">⚽</span>'
          }
          <span>${escapeHTML(awayName)}</span>
        </div>

      </div>

      <div class="match-card-bottom">
        <span>${escapeHTML(getMatchDate(match))}</span>
      </div>

    </article>
  `;
}

function renderMatches() {
  if (!elements.matches) return;

  const filtered = activeFilter === "all"
    ? allMatches
    : allMatches.filter(match => getStatus(match) === activeFilter);

  if (!filtered.length) {
    elements.matches.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚽</div>
        <h3>Bu kategoride maç bulunamadı</h3>
        <p>Seçili ligde bu filtreye uygun karşılaşma yok.</p>
      </div>
    `;
    return;
  }

  elements.matches.innerHTML = `
    <div class="matches-list">
      ${filtered.map(renderMatch).join("")}
    </div>
  `;
}

function showError(message) {
  if (!elements.matches) return;

  elements.matches.innerHTML = `
    <div class="error-state">
      <div class="empty-icon">!</div>
      <h3>Maçlar yüklenemedi</h3>
      <p>${escapeHTML(message)}</p>
      <button type="button" class="retry-btn" id="retryMatches">
        Tekrar dene
      </button>
    </div>
  `;

  document
    .getElementById("retryMatches")
    ?.addEventListener("click", loadMatches);
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

function updateDate() {
  if (!elements.date) return;

  elements.date.textContent = new Date().toLocaleDateString("tr-TR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul"
  });
}

async function loadMatches() {
  if (loading || !elements.league || !elements.matches) return;

  loading = true;

  const leagueSlug = elements.league.value;

  elements.matches.innerHTML = `
    <div class="loading">
      <span class="loading-spinner"></span>
      Maçlar yükleniyor...
    </div>
  `;

  if (elements.refresh) {
    elements.refresh.disabled = true;
    elements.refresh.textContent = "Yükleniyor...";
  }

  try {
    const url = new URL(API_URL, window.location.origin);

    url.searchParams.set("league", leagueSlug);
    url.searchParams.set("date", getTurkeyDate());

    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Accept": "application/json"
      },
      cache: "no-store"
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error || `Sunucu hatası: ${response.status}`
      );
    }

    allMatches = getMatchList(data);

    allMatches.sort((a, b) => {
      const dateA = new Date(a.time || a.date || 0).getTime();
      const dateB = new Date(b.time || b.date || 0).getTime();

      return dateA - dateB;
    });

    updateDate();
    renderMatches();

  } catch (error) {
    console.error("SPORIX API hatası:", error);

    showError(error.message || "Bağlantı kurulamadı.");

  } finally {
    loading = false;

    if (elements.refresh) {
      elements.refresh.disabled = false;
      elements.refresh.textContent = "↻ Yenile";
    }
  }
}

// Lig seçimi.
elements.league?.addEventListener("change", loadMatches);

// Maç filtreleri.
elements.tabs.forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter || "all";

    elements.tabs.forEach(tab => {
      tab.classList.toggle("selected", tab === button);
    });

    renderMatches();
  });
});

// Yenile.
elements.refresh?.addEventListener("click", loadMatches);

// Mobil menü.
elements.menuBtn?.addEventListener("click", () => {
  elements.nav?.classList.toggle("active");

  const isOpen = elements.nav?.classList.contains("active");

  elements.menuBtn.setAttribute(
    "aria-expanded",
    String(Boolean(isOpen))
  );
});

// Menü bağlantılarına tıklanınca menüyü kapat.
elements.nav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    elements.nav.classList.remove("active");

    elements.menuBtn?.setAttribute(
      "aria-expanded",
      "false"
    );
  });
});

// İlk yükleme.
updateDate();
loadMatches();
