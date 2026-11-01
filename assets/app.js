
"use strict";

// ========================================
// SPORIX - MAÇ SİSTEMİ
// ========================================

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
let requestController = null;
let requestNumber = 0;

const STATUS_TEXT = {
  live: "CANLI",
  finished: "MAÇ SONU",
  upcoming: "BAŞLAMADI",
  postponed: "ERTELENDİ",
  cancelled: "İPTAL",
  suspended: "DURDURULDU"
};

// ========================================
// GÜVENLİ METİN İŞLEMLERİ
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

function cleanImageURL(value) {
  if (!value || typeof value !== "string") return "";

  let url = value.trim();

  const markdown = url.match(/^\[.*?\]\((https?:\/\/.*?)\)$/);

  if (markdown) {
    url = markdown[1];
  }

  return /^https?:\/\//i.test(url) ? url : "";
}

function getText(value) {
  if (typeof value === "string" || typeof value === "number") {
    return String(value);
  }

  if (value && typeof value === "object") {
    return String(
      value.name ||
      value.title ||
      value.label ||
      value.short_name ||
      ""
    );
  }

  return "";
}

// ========================================
// API VERİLERİ
// ========================================

function getMatchList(data) {
  if (Array.isArray(data)) return data;

  const lists = [
    data?.matches,
    data?.fixtures,
    data?.results,
    data?.data?.matches,
    data?.data?.fixtures,
    data?.data?.results,
    data?.data
  ];

  return lists.find(Array.isArray) || [];
}

function getHomeTeam(match) {
  return match.home ||
    match.home_team ||
    match.homeTeam ||
    match.teams?.home ||
    {};
}

function getAwayTeam(match) {
  return match.away ||
    match.away_team ||
    match.awayTeam ||
    match.teams?.away ||
    {};
}

function getTeamName(team, fallback) {
  if (typeof team === "string") return team;

  return (
    team?.name ||
    team?.title ||
    team?.short_name ||
    team?.display_name ||
    team?.team_name ||
    fallback
  );
}

function getTeamLogo(team, match, side) {
  const direct = side === "home"
    ? match.home_logo || match.homeLogo
    : match.away_logo || match.awayLogo;

  if (direct) return cleanImageURL(direct);

  if (typeof team === "object") {
    return cleanImageURL(
      team?.logo ||
      team?.image ||
      team?.crest ||
      team?.badge ||
      team?.photo ||
      ""
    );
  }

  return "";
}

// ========================================
// SKOR
// ========================================

function normalizeScore(value) {
  if (value === null || value === undefined) return "-";

  if (typeof value === "object") {
    value =
      value.current ??
      value.total ??
      value.score ??
      value.goals ??
      value.value;
  }

  if (value === null || value === undefined || value === "") {
    return "-";
  }

  return String(value);
}

function getScore(match, side) {
  const team = side === "home"
    ? getHomeTeam(match)
    : getAwayTeam(match);

  const direct = side === "home"
    ? match.home_score ?? match.homeScore
    : match.away_score ?? match.awayScore;

  if (direct !== undefined && direct !== null) {
    return normalizeScore(direct);
  }

  if (typeof team === "object") {
    const teamScore = team.score ?? team.goals;

    if (teamScore !== undefined && teamScore !== null) {
      return normalizeScore(teamScore);
    }
  }

  const scores = match.score || match.scores || {};

  const score = side === "home"
    ? scores.home ?? scores.home_score
    : scores.away ?? scores.away_score;

  return normalizeScore(score);
}

// ========================================
// MAÇ DURUMU
// ========================================

function getRawStatus(match) {
  const status = match.status ||
    match.state ||
    match.status_text ||
    match.statusText ||
    match.fixture_status ||
    "";

  if (typeof status === "object") {
    return String(
      status.name ||
      status.description ||
      status.short ||
      status.type ||
      ""
    ).toLowerCase();
  }

  return String(status).toLowerCase();
}

function getStatus(match) {
  const raw = getRawStatus(match);

  if (/postponed|delayed|ertelendi/.test(raw)) {
    return "postponed";
  }

  if (/cancelled|canceled|iptal/.test(raw)) {
    return "cancelled";
  }

  if (/suspended|abandoned|interrupted|durduruldu/.test(raw)) {
    return "suspended";
  }

  if (
    /live|in.play|playing|1st half|2nd half|half time|halftime|extra time|penalty|canlı/.test(raw)
  ) {
    return "live";
  }

  if (
    /finished|complete|ended|full time|after.penalty|bitti|maç sonu/.test(raw)
  ) {
    return "finished";
  }

  if (
    /upcoming|scheduled|not.started|fixture|başlamadı|not started/.test(raw)
  ) {
    return "upcoming";
  }

  // Bilinmeyen durumlarda canlı veya bitmiş olduğunu varsayma.
  return "upcoming";
}

// ========================================
// TARİH VE SAAT
// ========================================

function getStartValue(match) {
  return (
    match.start_time ||
    match.startTime ||
    match.kickoff ||
    match.kickoff_at ||
    match.starting_at ||
    match.date ||
    match.time ||
    null
  );
}

function getStartTime(match) {
  const value = getStartValue(match);

  if (!value) return null;

  // Unix timestamp desteği
  if (typeof value === "number" || /^\d{10,13}$/.test(String(value))) {
    const number = Number(value);

    const timestamp = number < 100000000000
      ? number * 1000
      : number;

    return Number.isFinite(timestamp) ? timestamp : null;
  }

  // Sadece saat bilgisi verilmişse tarih hesaplamaya çalışma.
  if (/^\d{1,2}:\d{2}$/.test(String(value))) {
    return null;
  }

  const timestamp = new Date(value).getTime();

  return Number.isNaN(timestamp) ? null : timestamp;
}

function getTurkeyTime(match) {
  const value = getStartValue(match);

  if (!value) return "Saat bilgisi yok";

  // API doğrudan 18:30 gibi saat gönderiyorsa koru.
  if (/^\d{1,2}:\d{2}$/.test(String(value))) {
    return String(value);
  }

  const timestamp = getStartTime(match);

  if (!timestamp) return "Saat bilgisi yok";

  return new Date(timestamp).toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul"
  });
}

function getMatchDate(match) {
  const timestamp = getStartTime(match);

  if (!timestamp) return "";

  return new Date(timestamp).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Istanbul"
  });
}

function getCompetitionName(match) {
  const competition =
    match.competition ||
    match.league ||
    match.tournament;

  if (typeof competition === "string") {
    return competition;
  }

  return (
    competition?.name ||
    competition?.title ||
    competition?.display_name ||
    ""
  );
}

// ========================================
// CANLI MAÇ SÜRESİ
// ========================================

function formatLiveTime(match) {
  if (getStatus(match) !== "live") return "";

  const rawMinute =
    match.minute ??
    match.elapsed ??
    match.time_elapsed ??
    match.elapsed_minute;

  const rawSecond =
    match.second ??
    match.seconds ??
    match.elapsed_seconds;

  const minute = Number(rawMinute);
  const second = Number(rawSecond);

  // API dakika ve saniye gönderiyorsa kullan.
  if (
    rawMinute !== undefined &&
    rawMinute !== null &&
    rawMinute !== "" &&
    Number.isFinite(minute) &&
    minute >= 0
  ) {
    if (
      rawSecond !== undefined &&
      rawSecond !== null &&
      rawSecond !== "" &&
      Number.isFinite(second) &&
      second >= 0 &&
      second < 60
    ) {
      return `${minute}' ${String(second).padStart(2, "0")}"`;
    }

    return `${minute}'`;
  }

  // API yalnızca toplam geçen saniyeyi gönderiyorsa kullan.
  if (
    rawSecond !== undefined &&
    rawSecond !== null &&
    rawMinute === undefined
  ) {
    const totalSeconds = Number(rawSecond);

    if (Number.isFinite(totalSeconds) && totalSeconds >= 0) {
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      return `${minutes}' ${String(seconds).padStart(2, "0")}"`;
    }
  }

  // Gerçek süre bilgisi yoksa yanlış süre üretme.
  return "CANLI";
}

function getStatusLabel(match, status) {
  if (status === "live") {
    return formatLiveTime(match);
  }

  if (status === "finished") {
    return "MAÇ SONU";
  }

  if (status === "postponed") {
    return "ERTELENDİ";
  }

  if (status === "cancelled") {
    return "İPTAL";
  }

  if (status === "suspended") {
    return "DURDURULDU";
  }

  return getTurkeyTime(match);
}

// ========================================
// MAÇ KARTI
// ========================================

function renderMatch(match, index) {
  const home = getHomeTeam(match);
  const away = getAwayTeam(match);

  const homeName = getTeamName(home, "Ev sahibi");
  const awayName = getTeamName(away, "Deplasman");

  const homeLogo = getTeamLogo(home, match, "home");
  const awayLogo = getTeamLogo(away, match, "away");

  const status = getStatus(match);

  const homeScore = getScore(match, "home");
  const awayScore = getScore(match, "away");

  const isUpcoming = status === "upcoming" ||
    status === "postponed" ||
    status === "cancelled";

  const scoreHTML = isUpcoming
    ? `<span class="match-time">${escapeHTML(getTurkeyTime(match))}</span>`
    : `<strong class="match-score">${escapeHTML(homeScore)} - ${escapeHTML(awayScore)}</strong>`;

  const homeImage = homeLogo
    ? `<img src="${escapeHTML(homeLogo)}" alt="${escapeHTML(homeName)}" loading="lazy" onerror="this.style.display='none'">`
    : '<span class="team-placeholder">⚽</span>';

  const awayImage = awayLogo
    ? `<img src="${escapeHTML(awayLogo)}" alt="${escapeHTML(awayName)}" loading="lazy" onerror="this.style.display='none'">`
    : '<span class="team-placeholder">⚽</span>';

  return `
    <article class="match-card" data-status="${status}" data-match-index="${index}">

      <div class="match-card-top">

        <span class="match-status ${status}">
          ${status === "live" ? "<i></i>" : ""}
          ${escapeHTML(STATUS_TEXT[status] || "MAÇ")}
        </span>

        <span class="match-competition">
          ${escapeHTML(getCompetitionName(match) || "Futbol")}
        </span>

      </div>

      <div class="match-card-body">

        <div class="match-team">
          ${homeImage}
          <span>${escapeHTML(homeName)}</span>
        </div>

        <div class="match-result">

          ${scoreHTML}

          <small class="live-clock">
            ${escapeHTML(getStatusLabel(match, status))}
          </small>

        </div>

        <div class="match-team away">
          ${awayImage}
          <span>${escapeHTML(awayName)}</span>
        </div>

      </div>

      <div class="match-card-bottom">
        <span>${escapeHTML(getMatchDate(match))}</span>
      </div>

    </article>
  `;
}

// ========================================
// CANLI SAYAÇ GÜNCELLEME
// ========================================

function updateLiveClocks() {
  if (!elements.matches) return;

  elements.matches
    .querySelectorAll(".match-card[data-status='live']")
    .forEach(card => {
      const index = Number(card.dataset.matchIndex);
      const match = getFilteredMatches()[index];

      if (!match) return;

      const clock = card.querySelector(".live-clock");

      if (clock) {
        clock.textContent = formatLiveTime(match);
      }
    });
}

// ========================================
// FİLTRELEME
// ========================================

function getFilteredMatches() {
  if (activeFilter === "all") {
    return allMatches;
  }

  return allMatches.filter(match => {
    return getStatus(match) === activeFilter;
  });
}

function updateFilterButtons() {
  elements.tabs.forEach(button => {
    const selected = (button.dataset.filter || "all") === activeFilter;

    button.classList.toggle("selected", selected);
    button.setAttribute("aria-pressed", String(selected));
  });
}

function renderMatches() {
  if (!elements.matches) return;

  const filtered = getFilteredMatches();

  if (!filtered.length) {
    elements.matches.innerHTML = `
      <div class="empty-state">

        <div class="empty-icon">⚽</div>

        <h3>Bu kategoride maç bulunamadı</h3>

        <p>
          Seçili ligde bu filtreye uygun karşılaşma bulunmuyor.
        </p>

      </div>
    `;

    return;
  }

  elements.matches.innerHTML = `
    <div class="matches-list">
      ${filtered.map((match, index) => renderMatch(match, index)).join("")}
    </div>
  `;

  updateLiveClocks();
}

// ========================================
// HATA MESAJI
// ========================================

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
    ?.addEventListener("click", () => loadMatches(true));
}

// ========================================
// TÜRKİYE TARİHİ
// ========================================

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

// ========================================
// MAÇLARI API'DEN YÜKLE
// ========================================

async function loadMatches(force = false) {
  if (!elements.league || !elements.matches) return;

  if (loading && !force) return;

  // Yeni istek eski isteği geçersiz kılar.
  if (requestController) {
    requestController.abort();
  }

  const currentRequest = ++requestNumber;
  const controller = new AbortController();

  requestController = controller;
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
        Accept: "application/json"
      },
      cache: "no-store",
      signal: controller.signal
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        data.error ||
        data.message ||
        `Sunucu hatası: ${response.status}`
      );
    }

    if (currentRequest !== requestNumber) return;

    if (data.success === false) {
      throw new Error(data.error || "API isteği başarısız.");
    }

    allMatches = getMatchList(data);

    // Maçları başlangıç saatine göre sırala.
    allMatches.sort((a, b) => {
      const dateA = getStartTime(a);
      const dateB = getStartTime(b);

      if (dateA === null && dateB === null) return 0;
      if (dateA === null) return 1;
      if (dateB === null) return -1;

      return dateA - dateB;
    });

    updateDate();
    updateFilterButtons();
    renderMatches();

  } catch (error) {
    if (error.name === "AbortError") return;

    if (currentRequest !== requestNumber) return;

    console.error("SPORIX API hatası:", error);

    showError(error.message || "Bağlantı kurulamadı.");

  } finally {
    if (currentRequest === requestNumber) {
      loading = false;
      requestController = null;

      if (elements.refresh) {
        elements.refresh.disabled = false;
        elements.refresh.textContent = "↻ Yenile";
      }
    }
  }
}

// ========================================
// LİG SEÇİMİ
// ========================================

elements.league?.addEventListener("change", () => {
  loadMatches(true);
});

// ========================================
// MAÇ FİLTRELERİ
// ========================================

elements.tabs.forEach(button => {
  button.addEventListener("click", () => {
    activeFilter = button.dataset.filter || "all";

    updateFilterButtons();
    renderMatches();
  });
});

updateFilterButtons();

// ========================================
// YENİLE BUTONU
// ========================================

elements.refresh?.addEventListener("click", () => {
  loadMatches(true);
});

// ========================================
// MOBİL MENÜ
// ========================================

function closeMenu() {
  elements.nav?.classList.remove("active", "open");

  elements.menuBtn?.setAttribute("aria-expanded", "false");
}

elements.menuBtn?.addEventListener("click", () => {
  if (!elements.nav) return;

  const isOpen = !elements.nav.classList.contains("active");

  elements.nav.classList.toggle("active", isOpen);
  elements.nav.classList.toggle("open", isOpen);

  elements.menuBtn.setAttribute(
    "aria-expanded",
    String(isOpen)
  );
});

elements.nav?.querySelectorAll("a").forEach(link => {
  link.addEventListener("click", closeMenu);
});

// ========================================
// CANLI SAYAÇ
// ========================================

setInterval(() => {
  updateLiveClocks();
}, 1000);

// ========================================
// OTOMATİK YENİLEME
// ========================================

setInterval(() => {
  if (
    !document.hidden &&
    elements.league &&
    !loading
  ) {
    loadMatches();
  }
}, 30000);

// ========================================
// SAYFA BAŞLANGICI
// ========================================

updateDate();

if (elements.league && elements.matches) {
  loadMatches();
}
