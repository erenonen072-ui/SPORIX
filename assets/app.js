
"use strict";

// ========================================
// SPORIX - ANA SAYFA
// ========================================

const API = "/api/matches";
const SEARCH_API = "/api/search";

const $ = id => document.getElementById(id);

const leagueSelect = $("leagueSelect");
const matchesBox = $("matches");
const dateLabel = $("matchDate");
const refreshButton = $("refreshMatches");
const searchInput = $("competitionSearch");
const searchResults = $("competitionResults");

let currentCompetition =
  leagueSelect?.value || "turkish-super-league";

let currentCompetitionName =
  leagueSelect?.selectedOptions?.[0]?.textContent ||
  "Süper Lig";

let currentFilter = "all";
let allMatches = [];
let matchController = null;
let searchController = null;
let searchTimer = null;
let requestId = 0;
let loading = false;

const TURKISH_LEAGUES = [
  { name: "Süper Lig", slug: "turkish-super-league" },
  { name: "1. Lig", slug: "turkish-first-league" },
  { name: "2. Lig", slug: "turkish-second-league" },
  { name: "3. Lig", slug: "turkish-third-league" },
  { name: "Türkiye Kupası", slug: "turkish-cup" },
  { name: "Süper Kupa", slug: "turkish-super-cup" }
];

// ========================================
// GÜVENLİ METİN
// ========================================

function escapeHTML(value) {
  return String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);
}

// ========================================
// TÜRKİYE TARİHİ
// ========================================

function turkeyDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Istanbul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).formatToParts(new Date());

  const date = Object.fromEntries(
    parts.map(part => [part.type, part.value])
  );

  return `${date.year}-${date.month}-${date.day}`;
}

function updateDate() {
  if (!dateLabel) return;

  dateLabel.textContent = new Date().toLocaleDateString(
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

// ========================================
// API MAÇ VERİLERİ
// ========================================

function getMatches(data) {
  if (Array.isArray(data?.matches)) return data.matches;
  if (Array.isArray(data?.fixtures)) return data.fixtures;
  if (Array.isArray(data?.results)) return data.results;
  if (Array.isArray(data?.data?.matches)) return data.data.matches;

  return [];
}

// ========================================
// TAKIM BİLGİLERİ
// ========================================

function getTeam(match, side) {
  if (side === "home") {
    return match.home ||
      match.home_team ||
      match.homeTeam ||
      match.teams?.home ||
      {};
  }

  return match.away ||
    match.away_team ||
    match.awayTeam ||
    match.teams?.away ||
    {};
}

function teamName(team, fallback) {
  if (typeof team === "string") return team;

  return team?.name ||
    team?.title ||
    team?.short_name ||
    team?.display_name ||
    fallback;
}

function teamLogo(match, team, side) {
  const direct = side === "home"
    ? match.home_logo || match.homeLogo
    : match.away_logo || match.awayLogo;

  const value = direct ||
    team?.logo ||
    team?.image ||
    team?.crest ||
    "";

  return typeof value === "string" &&
    /^https?:\/\//i.test(value)
      ? value
      : "";
}

// ========================================
// SKOR
// ========================================

function score(match, side, team) {
  const direct = side === "home"
    ? match.home_score ?? match.homeScore
    : match.away_score ?? match.awayScore;

  const value = direct ??
    team?.score ??
    team?.goals ??
    (side === "home"
      ? match.score?.home ?? match.scores?.home
      : match.score?.away ?? match.scores?.away);

  if (value === null || value === undefined || value === "") {
    return "-";
  }

  if (typeof value === "object") {
    return String(
      value.current ??
      value.total ??
      value.score ??
      "-"
    );
  }

  return String(value);
}

// ========================================
// MAÇ DURUMU
// ========================================

function statusOf(match) {
  const raw = match.status?.name ||
    match.status?.description ||
    match.status ||
    match.state ||
    match.status_text ||
    "";

  const status = String(raw).toLowerCase();

  if (/postponed|delayed|ertelendi/.test(status)) {
    return "postponed";
  }

  if (/cancelled|canceled|iptal/.test(status)) {
    return "cancelled";
  }

  if (/suspended|abandoned|interrupted/.test(status)) {
    return "suspended";
  }

  if (/live|in.play|playing|1st half|2nd half|half time|halftime|extra time|penalty|canlı/.test(status)) {
    return "live";
  }

  if (/finished|complete|ended|full time|after.penalty|bitti|maç sonu/.test(status)) {
    return "finished";
  }

  return "upcoming";
}

// ========================================
// MAÇ SAATİ
// ========================================

function startValue(match) {
  return match.start_time ||
    match.startTime ||
    match.kickoff ||
    match.kickoff_at ||
    match.starting_at ||
    match.date ||
    match.time ||
    null;
}

function matchTime(match) {
  const value = startValue(match);

  if (!value) return "";

  if (/^\d{1,2}:\d{2}$/.test(String(value))) {
    return String(value);
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul"
  });
}

// ========================================
// LİG ADI
// ========================================

function competitionName(match) {
  return match.competition_name ||
    match.competition?.name ||
    match.league?.name ||
    match.tournament?.name ||
    currentCompetitionName;
}

// ========================================
// MAÇ KARTI
// ========================================

function renderMatch(match) {
  const home = getTeam(match, "home");
  const away = getTeam(match, "away");

  const homeName = teamName(home, "Ev sahibi");
  const awayName = teamName(away, "Deplasman");

  const homeLogo = teamLogo(match, home, "home");
  const awayLogo = teamLogo(match, away, "away");

  const status = statusOf(match);

  const homeScore = score(match, "home", home);
  const awayScore = score(match, "away", away);

  const isUpcoming = [
    "upcoming",
    "postponed",
    "cancelled"
  ].includes(status);

  const statusLabels = {
    live: "CANLI",
    finished: "MAÇ SONU",
    upcoming: "BAŞLAMADI",
    postponed: "ERTELENDİ",
    cancelled: "İPTAL",
    suspended: "DURDURULDU"
  };

  const homeImage = homeLogo
    ? `<img src="${escapeHTML(homeLogo)}" alt="${escapeHTML(homeName)}" loading="lazy">`
    : `<span class="team-placeholder">⚽</span>`;

  const awayImage = awayLogo
    ? `<img src="${escapeHTML(awayLogo)}" alt="${escapeHTML(awayName)}" loading="lazy">`
    : `<span class="team-placeholder">⚽</span>`;

  return `
    <article class="match-card" data-status="${status}">

      <div class="match-card-top">

        <span class="match-status ${status}">
          ${status === "live" ? "<i></i>" : ""}
          ${statusLabels[status]}
        </span>

        <span class="match-competition">
          ${escapeHTML(competitionName(match))}
        </span>

      </div>

      <div class="match-card-body">

        <div class="match-team">
          ${homeImage}
          <span>${escapeHTML(homeName)}</span>
        </div>

        <div class="match-result">

          ${
            isUpcoming
              ? `<span class="match-time">${escapeHTML(matchTime(match) || "-")}</span>`
              : `<strong class="match-score">${escapeHTML(homeScore)} - ${escapeHTML(awayScore)}</strong>`
          }

          <small class="live-clock">
            ${statusLabels[status]}
          </small>

        </div>

        <div class="match-team away">
          ${awayImage}
          <span>${escapeHTML(awayName)}</span>
        </div>

      </div>

    </article>
  `;
}

// ========================================
// MAÇ FİLTRELEME
// ========================================

function filteredMatches() {
  if (currentFilter === "all") {
    return allMatches;
  }

  return allMatches.filter(
    match => statusOf(match) === currentFilter
  );
}

// ========================================
// MAÇLARI EKRANA YAZ
// ========================================

function renderMatches() {
  if (!matchesBox) return;

  const list = filteredMatches();

  if (!list.length) {
    matchesBox.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">⚽</div>
        <h3>Maç bulunamadı</h3>
        <p>
          ${escapeHTML(currentCompetitionName)}
          için bugün maç bulunamadı.
        </p>
      </div>
    `;

    return;
  }

  matchesBox.innerHTML = list.map(renderMatch).join("");
}

// ========================================
// HATA MESAJI
// ========================================

function showError(message) {
  if (!matchesBox) return;

  matchesBox.innerHTML = `
    <div class="error-state">

      <h3>Maçlar yüklenemedi</h3>

      <p>${escapeHTML(message)}</p>

      <button
        class="retry-btn"
        id="retryMatches"
        type="button"
      >
        Tekrar dene
      </button>

    </div>
  `;

  $("retryMatches")?.addEventListener(
    "click",
    () => loadMatches(true)
  );
}

// ========================================
// MAÇLARI YÜKLE
// ========================================

async function loadMatches(force = false) {
  if (!matchesBox || (loading && !force)) return;

  matchController?.abort();

  const controller = new AbortController();

  matchController = controller;

  const thisRequest = ++requestId;

  loading = true;

  matchesBox.innerHTML = `
    <div class="loading-state">
      Maçlar yükleniyor...
    </div>
  `;

  if (refreshButton) {
    refreshButton.disabled = true;
  }

  try {
    const url = new URL(API, location.origin);

    url.searchParams.set(
      "competition",
      currentCompetition
    );

    url.searchParams.set(
      "date",
      turkeyDate()
    );

    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(
        data.error || "Maç verileri alınamadı."
      );
    }

    if (thisRequest !== requestId) return;

    // API seçilen lige ait maçları döndürüyor.
    // İkinci bir filtre uygulamadan sonuçları alıyoruz.

    const selectedLeague = TURKISH_LEAGUES.find(
      league => league.slug === currentCompetition
    );

    allMatches = getMatches(data);

    console.log("SPORIX maç kontrolü:", {
      secilenLig: currentCompetition,
      API_ligi: data.selectedCompetition,
      gelenMacSayisi: allMatches.length,
      maclar: allMatches
    });

    // Maçları saate göre sırala.

    allMatches.sort((a, b) => {
      const aTime = new Date(
        startValue(a) || 0
      ).getTime();

      const bTime = new Date(
        startValue(b) || 0
      ).getTime();

      return aTime - bTime;
    });

    if (selectedLeague) {
      currentCompetitionName = selectedLeague.name;
    }

    updateDate();

    renderMatches();

  } catch (error) {
    if (error.name === "AbortError") return;

    if (thisRequest !== requestId) return;

    console.error(
      "SPORIX maç hatası:",
      error
    );

    showError(error.message);

  } finally {
    if (thisRequest === requestId) {
      loading = false;
      matchController = null;

      if (refreshButton) {
        refreshButton.disabled = false;
      }
    }
  }
}

// ========================================
// LİG SEÇİMİ
// ========================================

function selectCompetition(slug, name) {
  if (!/^[a-z0-9-]+$/i.test(slug)) return;

  currentCompetition = slug;

  currentCompetitionName = name || slug;

  currentFilter = "all";

  if (leagueSelect) {
    let option = [...leagueSelect.options].find(
      item => item.value === slug
    );

    if (!option) {
      option = document.createElement("option");
      option.value = slug;
      option.textContent = currentCompetitionName;
      leagueSelect.appendChild(option);
    }

    leagueSelect.value = slug;
  }

  document.querySelectorAll("[data-filter]").forEach(button => {
    button.classList.toggle(
      "selected",
      button.dataset.filter === "all"
    );
  });

  if (searchResults) {
    searchResults.hidden = true;
  }

  loadMatches(true);
}

leagueSelect?.addEventListener("change", () => {
  const option = leagueSelect.options[
    leagueSelect.selectedIndex
  ];

  selectCompetition(
    leagueSelect.value,
    option?.textContent || ""
  );
});

refreshButton?.addEventListener(
  "click",
  () => loadMatches(true)
);

// ========================================
// MAÇ DURUMU FİLTRELERİ
// ========================================

document.querySelectorAll("[data-filter]").forEach(button => {
  button.addEventListener("click", () => {
    currentFilter = button.dataset.filter || "all";

    document.querySelectorAll("[data-filter]").forEach(item => {
      item.classList.toggle(
        "selected",
        item === button
      );
    });

    renderMatches();
  });
});

// ========================================
// DÜNYA LİGLERİ ARAMA
// ========================================

function showSearchMessage(message) {
  if (!searchResults) return;

  searchResults.hidden = false;

  searchResults.innerHTML = `
    <div class="competition-message">
      ${escapeHTML(message)}
    </div>
  `;
}

async function searchCompetitions(query) {
  searchController?.abort();

  const controller = new AbortController();

  searchController = controller;

  showSearchMessage("Ligler aranıyor...");

  try {
    const url = new URL(
      SEARCH_API,
      location.origin
    );

    url.searchParams.set("q", query);

    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal
    });

    const data = await response.json();

    if (!response.ok || data.success === false) {
      throw new Error(
        data.error || "Arama yapılamadı."
      );
    }

    const competitions =
      data.results?.competitions || [];

    const unique = new Map();

    competitions.forEach(item => {
      if (
        item?.slug &&
        /^[a-z0-9-]+$/i.test(item.slug)
      ) {
        unique.set(item.slug, item);
      }
    });

    if (!unique.size) {
      showSearchMessage(
        "Eşleşen lig bulunamadı. Başka bir kelime dene."
      );

      return;
    }

    searchResults.innerHTML = [
      ...unique.values()
    ].map(item => {
      const logo =
        typeof item.logo === "string" &&
        /^https?:\/\//i.test(item.logo)
          ? `<img src="${escapeHTML(item.logo)}" alt="" loading="lazy">`
          : `<span class="competition-placeholder">🏆</span>`;

      return `
        <button
          class="competition-result"
          type="button"
          data-slug="${escapeHTML(item.slug)}"
          data-name="${escapeHTML(item.name || item.slug)}"
        >

          ${logo}

          <span class="competition-result-name">
            ${escapeHTML(item.name || item.slug)}
          </span>

          <b>Seç →</b>

        </button>
      `;
    }).join("");

    searchResults.hidden = false;

  } catch (error) {
    if (error.name === "AbortError") return;

    showSearchMessage(
      error.message || "Arama hatası."
    );
  }
}

searchInput?.addEventListener("input", () => {
  clearTimeout(searchTimer);

  const query = searchInput.value.trim();

  if (query.length < 2) {
    searchController?.abort();

    searchResults.hidden = true;
    searchResults.innerHTML = "";

    return;
  }

  searchTimer = setTimeout(
    () => searchCompetitions(query),
    400
  );
});

searchResults?.addEventListener("click", event => {
  const button = event.target.closest("[data-slug]");

  if (!button) return;

  selectCompetition(
    button.dataset.slug,
    button.dataset.name
  );

  searchInput.value = "";
});

// ========================================
// MOBİL MENÜ
// ========================================

const menuToggle = $("menuToggle");
const mainNav = $("mainNav");

menuToggle?.addEventListener("click", () => {
  const opened = mainNav.classList.toggle("open");

  menuToggle.setAttribute(
    "aria-expanded",
    String(opened)
  );
});

mainNav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", () => {
    mainNav.classList.remove("open");

    menuToggle?.setAttribute(
      "aria-expanded",
      "false"
    );
  });
});

// ========================================
// BAŞLANGIÇ
// ========================================

updateDate();

loadMatches();

// 30 saniyede bir otomatik yenileme.

setInterval(() => {
  if (!document.hidden && !loading) {
    loadMatches();
  }
}, 30000);
