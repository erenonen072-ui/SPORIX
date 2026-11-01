(() => {
  "use strict";

  const API_URL = "/api/matches?limit=50";
  const REFRESH_INTERVAL = 60000;

  const matchList = document.getElementById("matchList");
  const dateStrip = document.getElementById("dateStrip");
  const dateLabel = document.getElementById("selectedDateLabel");
  const leagueFilter = document.getElementById("leagueFilter");
  const statusFilter = document.getElementById("statusFilter");
  const matchCount = document.getElementById("matchCount");

  if (!matchList || !dateStrip) return;

  let allMatches = [];
  let selectedDate = turkeyDateKey(new Date());
  let selectedLeague = "all";
  let selectedStatus = "all";
  let isLoading = false;

  const escapeHTML = value => String(value ?? "").replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;"
  })[char]);

  function turkeyDateKey(date) {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function parseDate(value) {
    if (!value) return null;

    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function getMatchDate(match) {
    return parseDate(
      match.time ||
      match.startTime ||
      match.start_time ||
      match.datetime ||
      match.date ||
      match.timestamp ||
      match.kickoff ||
      match.start_at
    );
  }

  function getTurkeyTime(date) {
    if (!date) return "--:--";

    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(date);
  }

  function getTurkeyDate(date) {
    if (!date) return "";

    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).format(date);
  }

  function getTeamName(match, side) {
    const isHome = side === "home";

    const value = isHome
      ? match.home || match.home_team || match.homeTeam
      : match.away || match.away_team || match.awayTeam;

    if (typeof value === "string") return value;

    return value?.name || value?.title || (isHome ? "Ev Sahibi" : "Deplasman");
  }

  function extractURL(value) {
    if (!value) return "";

    let url = String(value).trim();

    // API bazen URL'yi Markdown bağlantısı olarak döndürebilir.
    const markdown = url.match(/\]\((https?:\/\/[^)]+)\)/);
    if (markdown) url = markdown[1];

    const plain = url.match(/https?:\/\/[^\s)\]]+/);
    if (plain) url = plain[0];

    return url.replace(/[)\]]+$/, "");
  }

  function getTeamLogo(match, side) {
    const isHome = side === "home";

    const value = isHome
      ? match.home_logo || match.homeTeam?.logo || match.home?.logo
      : match.away_logo || match.awayTeam?.logo || match.away?.logo;

    return extractURL(value);
  }

  function getLeagueName(match) {
    const value =
      match.competition ||
      match.league ||
      match.tournament ||
      match.competition_name ||
      "Diğer Karşılaşmalar";

    if (typeof value === "string") return value;

    return value?.name || value?.title || "Diğer Karşılaşmalar";
  }

  function getLeagueLogo(match) {
    return extractURL(
      match.competition_logo ||
      match.league_logo ||
      match.tournament_logo ||
      match.competition?.logo ||
      match.league?.logo
    );
  }

  function getScore(match, side) {
    const isHome = side === "home";

    const value = isHome
      ? match.home_score ?? match.homeScore ?? match.score?.home
      : match.away_score ?? match.awayScore ?? match.score?.away;

    if (value === null || value === undefined || value === "") return null;

    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function getStatus(match) {
    const rawStatus = String(
      match.status?.name ||
      match.status ||
      match.state ||
      ""
    ).toLowerCase();

    const textStatus = String(
      match.status_text ||
      match.statusText ||
      match.status?.short ||
      ""
    ).toLowerCase();

    const combined = `${rawStatus} ${textStatus}`;

    if (
      /finished|complete|completed|ended|ft|full.?time|bitti|sona erdi/.test(combined)
    ) {
      return "finished";
    }

    if (
      /postponed|delayed|ertelendi|gecik/.test(combined)
    ) {
      return "delayed";
    }

    if (
      /cancelled|canceled|abandoned|iptal/.test(combined)
    ) {
      return "cancelled";
    }

    if (
      /live|in.?progress|playing|1st|2nd|half|ht|extra.?time|penalty|canlı|devre/.test(combined)
    ) {
      return "live";
    }

    if (
      /upcoming|scheduled|not.?started|ns|başlamadı|başlayacak/.test(combined)
    ) {
      return "upcoming";
    }

    return "upcoming";
  }

  function getStatusText(match, status) {
    const original = String(
      match.status_text ||
      match.statusText ||
      ""
    ).trim();

    if (status === "live") return "CANLI";
    if (status === "finished") return "MS";
    if (status === "delayed") return original || "ERTELENDİ";
    if (status === "cancelled") return "İPTAL";
    return original || "BAŞLAMADI";
  }

  function getMatchSlug(match) {
    if (
      match.slug ||
      match.match_slug ||
      match.url_slug
    ) {
      return match.slug || match.match_slug || match.url_slug;
    }

    const url = match.url || match.match_url || "";

    if (url) {
      const parts = String(url).split("/").filter(Boolean);
      return parts[parts.length - 1] || "";
    }

    return "";
  }

  function getMatchLink(match) {
    const slug = getMatchSlug(match);

    if (slug) {
      return `/veri.html?view=match&slug=${encodeURIComponent(slug)}`;
    }

    return "/maclar/";
  }

  function getLiveMinute(match) {
    const candidates = [
      match.minute,
      match.elapsed,
      match.elapsed_time,
      match.time_elapsed,
      match.status?.elapsed,
      match.period?.elapsed
    ];

    for (const value of candidates) {
      if (value === null || value === undefined || value === "") continue;

      if (typeof value === "number" || /^\d+$/.test(String(value))) {
        return `${value}'`;
      }

      if (typeof value === "string" && value.trim()) {
        return value;
      }
    }

    return "";
  }

  function getExtraTime(match) {
    const candidates = [
      match.added_time,
      match.injury_time,
      match.extra_time_minute,
      match.stoppage_time,
      match.status?.added_time
    ];

    for (const value of candidates) {
      if (value !== null && value !== undefined && value !== "") {
        return String(value);
      }
    }

    return "";
  }

  function getLiveClock(match) {
    const minute = getLiveMinute(match);
    const seconds = match.seconds ?? match.second ?? match.elapsed_seconds;
    const extra = getExtraTime(match);

    if (seconds !== undefined && seconds !== null && minute) {
      const minuteNumber = parseInt(minute, 10);

      if (Number.isFinite(minuteNumber)) {
        return `${minuteNumber}:${String(seconds).padStart(2, "0")}`;
      }
    }

    if (minute && extra) return `${minute} +${extra}`;
    return minute;
  }

  function renderDateStrip() {
    const today = new Date();
    const dates = [];

    for (let offset = -2; offset <= 5; offset++) {
      const date = new Date(today);
      date.setDate(today.getDate() + offset);

      const key = turkeyDateKey(date);

      let dayName = new Intl.DateTimeFormat("tr-TR", {
        timeZone: "Europe/Istanbul",
        weekday: "short"
      }).format(date);

      if (offset === 0) dayName = "Bugün";
      if (offset === -1) dayName = "Dün";
      if (offset === 1) dayName = "Yarın";

      const dayNumber = new Intl.DateTimeFormat("tr-TR", {
        timeZone: "Europe/Istanbul",
        day: "2-digit",
        month: "short"
      }).format(date);

      dates.push(`
        <button
          type="button"
          class="date-button ${key === selectedDate ? "active" : ""}"
          data-date="${key}"
        >
          <span>${escapeHTML(dayName)}</span>
          <strong>${escapeHTML(dayNumber)}</strong>
        </button>
      `);
    }

    dateStrip.innerHTML = dates.join("");

    dateStrip.querySelectorAll(".date-button").forEach(button => {
      button.addEventListener("click", () => {
        selectedDate = button.dataset.date;
        renderDateStrip();
        renderMatches();
      });
    });

    if (dateLabel) {
      const selected = new Date(`${selectedDate}T12:00:00`);

      dateLabel.textContent = new Intl.DateTimeFormat("tr-TR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        weekday: "long"
      }).format(selected);
    }
  }

  function updateLeagueOptions() {
    if (!leagueFilter) return;

    const leagues = [...new Set(
      allMatches.map(getLeagueName).filter(Boolean)
    )].sort((a, b) => a.localeCompare(b, "tr"));

    const previous = selectedLeague;

    leagueFilter.innerHTML = `
      <option value="all">Tüm Ligler</option>
      ${leagues.map(name => `
        <option value="${escapeHTML(name)}">${escapeHTML(name)}</option>
      `).join("")}
    `;

    if (previous !== "all" && leagues.includes(previous)) {
      leagueFilter.value = previous;
    } else {
      selectedLeague = "all";
      leagueFilter.value = "all";
    }
  }

  function createTeamHTML(match, side) {
    const name = getTeamName(match, side);
    const logo = getTeamLogo(match, side);

    const image = logo
      ? `<img src="${escapeHTML(logo)}" alt="" loading="lazy" referrerpolicy="no-referrer" onerror="this.style.display='none'">`
      : `<span class="team-placeholder">${escapeHTML(name.slice(0, 1).toUpperCase())}</span>`;

    return `
      <div class="team-line">
        ${image}
        <span title="${escapeHTML(name)}">${escapeHTML(name)}</span>
      </div>
    `;
  }

  function createMatchHTML(match) {
    const status = getStatus(match);
    const date = getMatchDate(match);

    const homeScore = getScore(match, "home");
    const awayScore = getScore(match, "away");

    const hasScore = homeScore !== null && awayScore !== null;
    const statusText = getStatusText(match, status);
    const liveClock = getLiveClock(match);

    let timeHTML = "";

    if (status === "live") {
      timeHTML = `
        <span class="live-label">● CANLI</span>
        <span class="minute-label">${escapeHTML(liveClock || statusText)}</span>
      `;
    } else if (status === "finished") {
      timeHTML = `<span>MAÇ SONU</span>`;
    } else if (status === "delayed" || status === "cancelled") {
      timeHTML = `<span>${escapeHTML(statusText)}</span>`;
    } else {
      timeHTML = `<span>${escapeHTML(getTurkeyTime(date))}</span>`;
    }

    let scoreHTML = "";

    if (hasScore) {
      scoreHTML = `
        <div class="match-score ${status}">
          <span>${homeScore}</span>
          <span class="score-separator">:</span>
          <span>${awayScore}</span>
        </div>
      `;
    } else {
      scoreHTML = `
        <div class="match-score pending">
          ${status === "delayed" ? "ERT." : status === "cancelled" ? "İPTAL" : getTurkeyTime(date)}
        </div>
      `;
    }

    return `
      <a class="match-row match-detail-link" href="${escapeHTML(getMatchLink(match))}">
        <div class="match-time">${timeHTML}</div>

        <div class="match-teams">
          ${createTeamHTML(match, "home")}
          ${createTeamHTML(match, "away")}
        </div>

        ${scoreHTML}
      </a>
    `;
  }

  function renderMatches() {
    let matches = allMatches.filter(match => {
      const date = getMatchDate(match);
      return date && getTurkeyDate(date) === selectedDate;
    });

    if (selectedLeague !== "all") {
      matches = matches.filter(match => getLeagueName(match) === selectedLeague);
    }

    if (selectedStatus !== "all") {
      matches = matches.filter(match => {
        const status = getStatus(match);

        if (selectedStatus === "upcoming") {
          return status === "upcoming" || status === "delayed";
        }

        return status === selectedStatus;
      });
    }

    // Canlı maçlar, sonra başlamayanlar, en son bitenler.
    const order = {
      live: 0,
      upcoming: 1,
      delayed: 2,
      finished: 3,
      cancelled: 4
    };

    matches.sort((a, b) => {
      const statusDifference = order[getStatus(a)] - order[getStatus(b)];
      if (statusDifference !== 0) return statusDifference;

      return (getMatchDate(a)?.getTime() || 0) -
             (getMatchDate(b)?.getTime() || 0);
    });

    if (matchCount) {
      matchCount.textContent = `${matches.length} karşılaşma`;
    }

    if (!matches.length) {
      matchList.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">⚽</div>
          <strong>Bu tarihte maç bulunamadı</strong>
          <span>Başka bir tarih veya lig seçerek tekrar deneyebilirsin.</span>
        </div>
      `;
      return;
    }

    const groups = new Map();

    matches.forEach(match => {
      const league = getLeagueName(match);

      if (!groups.has(league)) groups.set(league, []);
      groups.get(league).push(match);
    });

    matchList.innerHTML = [...groups.entries()].map(([league, leagueMatches]) => {
      const logo = getLeagueLogo(leagueMatches[0]);

      return `
        <section class="league-group">
          <div class="league-heading">
            ${logo
              ? `<img src="${escapeHTML(logo)}" alt="" loading="lazy" onerror="this.style.display='none'">`
              : ""
            }
            <strong>${escapeHTML(league)}</strong>
            <small>${leagueMatches.length} maç</small>
          </div>

          ${leagueMatches.map(createMatchHTML).join("")}
        </section>
      `;
    }).join("");
  }

  async function loadMatches() {
    if (isLoading) return;

    isLoading = true;

    try {
      const response = await fetch(API_URL, {
        method: "GET",
        cache: "no-store",
        headers: { "Accept": "application/json" }
      });

      if (!response.ok) {
        throw new Error(`API yanıtı: ${response.status}`);
      }

      const result = await response.json();

      if (!result || !Array.isArray(result.matches)) {
        throw new Error("API maç listesi döndürmedi.");
      }

      allMatches = result.matches;

      updateLeagueOptions();
      renderDateStrip();
      renderMatches();

    } catch (error) {
      console.error("SPORIX maç verisi hatası:", error);

      if (!allMatches.length) {
        matchList.innerHTML = `
          <div class="error-state">
            <div class="empty-icon">!</div>
            <strong>Maç verileri şu anda alınamadı</strong>
            <span>Bağlantını kontrol edip sayfayı yenileyebilirsin.</span>
          </div>
        `;
      }
    } finally {
      isLoading = false;
    }
  }

  if (leagueFilter) {
    leagueFilter.addEventListener("change", event => {
      selectedLeague = event.target.value;
      renderMatches();
    });
  }

  if (statusFilter) {
    statusFilter.addEventListener("change", event => {
      selectedStatus = event.target.value;
      renderMatches();
    });
  }

  renderDateStrip();
  loadMatches();

  // API'deki maç bilgilerini dakikada bir yenile.
  window.setInterval(loadMatches, REFRESH_INTERVAL);
})();
