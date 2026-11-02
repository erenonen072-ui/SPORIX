
(() => {
  "use strict";

  // ==========================================
  // SPORIX AYARLARI
  // ==========================================

  const API_URL = "/api/matches";
  const STANDINGS_API_URL = "/api/standings";
  const REFRESH_MS = 60000;

  const $ = id => document.getElementById(id);

  const matchList = $("matchList");
  const dateStrip = $("dateStrip");
  const dateLabel = $("selectedDateLabel");
  const matchCount = $("matchCount");
  const statusFilter = $("statusFilter");
  const standingsLeague = $("standingsLeague");
  const standingsTable = $("standingsTable");

  let allMatches = [];
  let selectedDate = dateKey(new Date());
  let selectedLeague = "";
  let loading = false;
  let standingsLoading = false;
  let standingsRequestId = 0;

  // ==========================================
  // TÜRKİYE LİGLERİ
  // ==========================================

  const TURKISH_LEAGUES = [
    { name: "Süper Lig", aliases: ["turkish super league"] },
    { name: "1. Lig", aliases: ["turkish first league", "1st league"] },
    { name: "2. Lig", aliases: ["turkish second league", "2nd league"] },
    { name: "3. Lig", aliases: ["turkish third league", "3rd league"] },
    { name: "Türkiye Kupası", aliases: ["turkish cup", "turkiye cup"] },
    { name: "Süper Kupa", aliases: ["turkish super cup", "super cup"] }
  ];

  // ==========================================
  // TARİH
  // ==========================================

  function dateKey(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    }).formatToParts(date);

    const get = type =>
      parts.find(part => part.type === type).value;

    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  function parseDate(value) {
    if (!value) return null;

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? null
      : date;
  }

  function formatTime(value) {
    const date = parseDate(value);

    if (!date) return "--:--";

    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function formatFullDate(value) {
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul",
      dateStyle: "full"
    }).format(
      new Date(`${value}T12:00:00+03:00`)
    );
  }

  // ==========================================
  // GÜVENLİ HTML
  // ==========================================

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    })[char]);
  }

  function cleanURL(value) {
    if (!value) return "";

    const text = String(value).trim();
    const direct = text.match(/https?:\/\/[^\s)]+/);

    return direct ? direct[0] : "";
  }

  // ==========================================
  // TAKIM BİLGİLERİ
  // ==========================================

  function getName(team) {
    if (typeof team === "string") return team;

    return team?.name ||
      team?.title ||
      team?.short_name ||
      "Takım";
  }

  function getLogo(match, side) {
    const team = match?.[side];

    const candidates = [
      match?.[`${side}_logo`],
      typeof team === "object" ? team?.logo : "",
      typeof team === "object" ? team?.image : ""
    ];

    return cleanURL(candidates.find(Boolean));
  }

  // ==========================================
  // LİG ADI - DÜZELTİLDİ
  // ==========================================

  function normalizeLeague(value) {
    return String(value || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/[ıİ]/g, "i")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getLeague(match) {
    // API'nin Türkçe lig adı varsa öncelikle onu kullan.
    if (match?.competition_name) {
      return match.competition_name;
    }

    const league =
      match?.competition ||
      match?.league ||
      match?.tournament;

    return typeof league === "string"
      ? league
      : league?.name ||
        league?.title ||
        "Diğer Maçlar";
  }

  function getLeagueLogo(match) {
    return cleanURL(
      match?.competition_logo ||
      match?.league_logo
    );
  }

  function getSlug(match) {
    if (match?.slug) return match.slug;

    const url = cleanURL(match?.url);

    if (url) {
      try {
        return new URL(url)
          .pathname
          .split("/")
          .filter(Boolean)
          .at(-1) || "";
      } catch (_) {}
    }

    return "";
  }

  // ==========================================
  // LİG EŞLEŞTİRME
  // ==========================================

  function matchesSelectedLeague(match) {
    if (!selectedLeague) return true;

    const selected = normalizeLeague(selectedLeague);

    const leagueName = normalizeLeague(getLeague(match));

    if (leagueName === selected) return true;

    const league = TURKISH_LEAGUES.find(
      item => normalizeLeague(item.name) === selected
    );

    if (!league) {
      return leagueName.includes(selected);
    }

    return league.aliases.some(alias =>
      leagueName.includes(normalizeLeague(alias))
    );
  }

  // ==========================================
  // MAÇ DURUMU
  // ==========================================

  function getStatus(match) {
    const status = String(
      match?.status || ""
    ).toLowerCase();

    const text = String(
      match?.status_text || ""
    ).toLowerCase();

    if (
      ["live", "inplay", "in_progress", "1h", "2h", "ht"].includes(status) ||
      text.includes("canlı") ||
      text.includes("live")
    ) {
      return "live";
    }

    if (
      ["finished", "complete", "completed", "ft"].includes(status) ||
      text.includes("bitti") ||
      text.includes("finished")
    ) {
      return "finished";
    }

    if (
      ["upcoming", "scheduled", "not_started", "ns", "delayed"].includes(status)
    ) {
      return "upcoming";
    }

    return status.includes("finish")
      ? "finished"
      : "upcoming";
  }

  function getScore(match) {
    const home =
      match?.home_score ??
      match?.scores?.home ??
      match?.score?.home;

    const away =
      match?.away_score ??
      match?.scores?.away ??
      match?.score?.away;

    if (
      home === null ||
      home === undefined ||
      away === null ||
      away === undefined
    ) {
      return "";
    }

    return `${home} - ${away}`;
  }

  function matchDate(match) {
    return parseDate(
      match?.time ||
      match?.date ||
      match?.start_time
    );
  }

  function isSelectedDate(match) {
    const date = matchDate(match);

    return date && dateKey(date) === selectedDate;
  }

  function matchLink(match) {
    const slug = getSlug(match);

    return slug
      ? `/veri.html?view=match&slug=${encodeURIComponent(slug)}`
      : "/maclar/";
  }

  // ==========================================
  // TARİH SEÇİMİ
  // ==========================================

  function renderDates() {
    if (!dateStrip) return;

    const today = new Date();
    const dates = [];

    for (let offset = -2; offset <= 5; offset++) {
      const date = new Date(today);

      date.setDate(today.getDate() + offset);

      dates.push(date);
    }

    dateStrip.innerHTML = dates.map(date => {
      const key = dateKey(date);

      const day = new Intl.DateTimeFormat("tr-TR", {
        timeZone: "Europe/Istanbul",
        weekday: "short"
      }).format(date);

      const number = new Intl.DateTimeFormat("tr-TR", {
        timeZone: "Europe/Istanbul",
        day: "2-digit",
        month: "2-digit"
      }).format(date);

      return `
        <button
          class="date-button ${key === selectedDate ? "active" : ""}"
          data-date="${key}"
          type="button"
        >
          <span>
            ${key === dateKey(today)
              ? "BUGÜN"
              : escapeHTML(day.toLocaleUpperCase("tr-TR"))}
          </span>

          <strong>${escapeHTML(number)}</strong>
        </button>
      `;
    }).join("");
  }

  if (dateStrip) {
    dateStrip.addEventListener("click", event => {
      const button = event.target.closest("[data-date]");

      if (!button) return;

      selectedDate = button.dataset.date;

      renderDates();
      loadMatches();
    });
  }

  // ==========================================
  // LİG SEÇİMİ
  // ==========================================

  function setupLeagueButtons() {
    const container = $("leagueSidebar");

    if (!container) return;

    if (!container.querySelector('[data-league=""]')) {
      const button = document.createElement("button");

      button.type = "button";
      button.className = "league-link";
      button.dataset.league = "";
      button.textContent = "Tüm Ligler";

      container.prepend(button);
    }

    container.addEventListener("click", event => {
      const button = event.target.closest("[data-league]");

      if (!button) return;

      selectedLeague = button.dataset.league;

      updateLeagueButtons();
      renderMatches();
    });

    updateLeagueButtons();
  }

  function updateLeagueButtons() {
    document.querySelectorAll(
      "#leagueSidebar [data-league]"
    ).forEach(button => {
      button.classList.toggle(
        "active",
        button.dataset.league === selectedLeague
      );
    });
  }

  // ==========================================
  // MAÇ KARTI
  // ==========================================

  function renderMatch(match) {
    const status = getStatus(match);
    const score = getScore(match);

    const home = getName(match.home);
    const away = getName(match.away);

    const homeLogo = getLogo(match, "home");
    const awayLogo = getLogo(match, "away");

    const clock = status === "live"
      ? "CANLI"
      : status === "finished"
        ? "BİTTİ"
        : formatTime(
            match.time ||
            match.date ||
            match.start_time
          );

    return `
      <a
        class="match-row-link"
        href="${escapeHTML(matchLink(match))}"
      >
        <article class="match-row">

          <div class="match-card-top">
            <span class="match-league-name">
              ${escapeHTML(getLeague(match))}
            </span>

            <span class="match-start-time">
              ${
                status === "upcoming"
                  ? escapeHTML(clock)
                  : ""
              }
            </span>
          </div>

          <div class="match-card-content">

            <div class="match-side home-side">
              ${
                homeLogo
                  ? `<img
                      src="${escapeHTML(homeLogo)}"
                      alt=""
                      loading="lazy"
                      onerror="this.style.display='none'"
                    >`
                  : ""
              }

              <span class="team-name">
                ${escapeHTML(home)}
              </span>
            </div>

            <div class="match-center">
              <strong class="score">
                ${escapeHTML(score || "–")}
              </strong>

              <span class="status ${
                status === "live"
                  ? "live"
                  : status === "finished"
                    ? "finished"
                    : ""
              }">
                ${
                  status === "live"
                    ? "CANLI"
                    : status === "finished"
                      ? "BİTTİ"
                      : "VS"
                }
              </span>
            </div>

            <div class="match-side away-side">
              <span class="team-name">
                ${escapeHTML(away)}
              </span>

              ${
                awayLogo
                  ? `<img
                      src="${escapeHTML(awayLogo)}"
                      alt=""
                      loading="lazy"
                      onerror="this.style.display='none'"
                    >`
                  : ""
              }
            </div>

          </div>

        </article>
      </a>
    `;
  }

  // ==========================================
  // MAÇLARI GÖSTER
  // ==========================================

  function renderMatches() {
    if (!matchList || !statusFilter) return;

    const statusValue = statusFilter.value;

    let matches = allMatches.filter(isSelectedDate);

    if (selectedLeague) {
      matches = matches.filter(matchesSelectedLeague);
    }

    if (statusValue !== "all") {
      matches = matches.filter(
        match => getStatus(match) === statusValue
      );
    }

    matches.sort((a, b) => {
      const aLive = getStatus(a) === "live";
      const bLive = getStatus(b) === "live";

      if (aLive && !bLive) return -1;
      if (!aLive && bLive) return 1;

      return (
        (matchDate(a)?.getTime() || 0) -
        (matchDate(b)?.getTime() || 0)
      );
    });

    if (dateLabel) {
      dateLabel.textContent =
        formatFullDate(selectedDate);
    }

    if (matchCount) {
      matchCount.textContent =
        `${matches.length} maç`;
    }

    updateMatchStatistics();

    if (!matches.length) {
      matchList.innerHTML = `
        <div class="empty-state">
          <strong>Bu tarihte gösterilecek maç bulunamadı.</strong>
          <span>Başka bir gün veya lig seçebilirsin.</span>
        </div>
      `;

      return;
    }

    const groups = new Map();

    matches.forEach(match => {
      const league = getLeague(match);

      if (!groups.has(league)) {
        groups.set(league, []);
      }

      groups.get(league).push(match);
    });

    matchList.innerHTML = [...groups.entries()]
      .map(([league, items]) => {
        const logo = getLeagueLogo(items[0]);

        return `
          <section class="league-group">

            <div class="league-title">
              ${
                logo
                  ? `<img
                      src="${escapeHTML(logo)}"
                      alt=""
                      loading="lazy"
                      onerror="this.style.display='none'"
                    >`
                  : ""
              }

              <span>${escapeHTML(league)}</span>

              <small>${items.length} MAÇ</small>
            </div>

            ${items.map(renderMatch).join("")}

          </section>
        `;
      })
      .join("");
  }

  // ==========================================
  // MAÇ İSTATİSTİKLERİ
  // ==========================================

  function updateMatchStatistics() {
    const live = allMatches.filter(
      match => getStatus(match) === "live"
    ).length;

    const finished = allMatches.filter(
      match => getStatus(match) === "finished"
    ).length;

    const upcoming = allMatches.filter(
      match => getStatus(match) === "upcoming"
    ).length;

    if ($("liveCount")) {
      $("liveCount").textContent = live;
    }

    if ($("finishedCount")) {
      $("finishedCount").textContent = finished;
    }

    if ($("upcomingCount")) {
      $("upcomingCount").textContent = upcoming;
    }
  }

  // ==========================================
  // MAÇ API
  // ==========================================

  async function loadMatches() {
    if (loading) return;

    loading = true;

    try {
      const url = new URL(API_URL, location.origin);

      url.searchParams.set("date", selectedDate);
      url.searchParams.set("limit", "200");

      // Tüm liglerin maçları tek seferde alınır.
      const response = await fetch(url, {
        cache: "no-store"
      });

      if (!response.ok) {
        throw new Error(
          `Sunucu yanıtı: ${response.status}`
        );
      }

      const result = await response.json();

      const matches = Array.isArray(result)
        ? result
        : result.matches;

      if (!Array.isArray(matches)) {
        throw new Error(
          "API maç listesi döndürmedi."
        );
      }

      allMatches = matches;

      console.log("SPORIX ana sayfa API:", {
        tarih: selectedDate,
        macSayisi: allMatches.length,
        ligler: [...new Set(allMatches.map(getLeague))],
        maclar: allMatches
      });

      renderMatches();

    } catch (error) {
      console.error("SPORIX maç API:", error);

      if (matchList) {
        matchList.innerHTML = `
          <div class="error-state">
            <strong>Maç verileri alınamadı.</strong>
            <span>${escapeHTML(error.message)}</span>
          </div>
        `;
      }

    } finally {
      loading = false;
    }
  }

  // ==========================================
  // PUAN DURUMU HATA
  // ==========================================

  function renderStandingsError(message) {
    if (!standingsTable) return;

    standingsTable.innerHTML = `
      <tr>
        <td colspan="10">
          ${escapeHTML(message)}
        </td>
      </tr>
    `;
  }

  // ==========================================
  // PUAN DURUMU
  // ==========================================

  function renderStandings(data) {
    if (!standingsTable) return;

    const rows = Array.isArray(data)
      ? data
      : data?.standings ||
        data?.table ||
        data?.data ||
        [];

    if (!Array.isArray(rows) || rows.length === 0) {
      renderStandingsError(
        "Bu lig için puan durumu bulunamadı."
      );

      return;
    }

    standingsTable.innerHTML = rows.map((item, index) => {
      const team = item.team || item.participant || {};

      const name =
        item.team_name ||
        item.name ||
        team.name ||
        "Takım";

      const played =
        item.played ??
        item.matches_played ??
        item.games ??
        "-";

      const won =
        item.won ??
        item.wins ??
        "-";

      const drawn =
        item.drawn ??
        item.draws ??
        "-";

      const lost =
        item.lost ??
        item.losses ??
        "-";

      const goalsFor =
        item.goals_for ??
        item.gf ??
        "-";

      const goalsAgainst =
        item.goals_against ??
        item.ga ??
        "-";

      const points =
        item.points ??
        item.pts ??
        "-";

      const position =
        item.position ??
        item.rank ??
        index + 1;

      return `
        <tr>
          <td>${escapeHTML(position)}</td>
          <td>${escapeHTML(name)}</td>
          <td>${escapeHTML(played)}</td>
          <td>${escapeHTML(won)}</td>
          <td>${escapeHTML(drawn)}</td>
          <td>${escapeHTML(lost)}</td>
          <td>
            ${escapeHTML(goalsFor)}:${escapeHTML(goalsAgainst)}
          </td>
          <td>
            <strong>${escapeHTML(points)}</strong>
          </td>
        </tr>
      `;
    }).join("");
  }

  async function loadStandings() {
    if (
      !standingsTable ||
      !standingsLeague
    ) {
      return;
    }

    const thisRequest = ++standingsRequestId;

    const league = standingsLeague.value;

    standingsTable.innerHTML = `
      <tr>
        <td colspan="10">
          Puan durumu yükleniyor...
        </td>
      </tr>
    `;

    try {
      const response = await fetch(
        `${STANDINGS_API_URL}?league=${encodeURIComponent(league)}`,
        { cache: "no-store" }
      );

      if (!response.ok) {
        throw new Error(
          `Puan durumu API yanıtı: ${response.status}`
        );
      }

      const data = await response.json();

      if (thisRequest !== standingsRequestId) return;

      renderStandings(data);

    } catch (error) {
      if (thisRequest !== standingsRequestId) return;

      console.error("SPORIX standings API:", error);

      renderStandingsError(
        "Puan durumu alınamadı. API bağlantısını kontrol et."
      );
    }
  }

  // ==========================================
  // MOBİL MENÜ
  // ==========================================

  function setupMobileMenu() {
    const menuToggle = $("menuToggle");
    const mainNav = $("mainNav");

    if (!menuToggle || !mainNav) return;

    menuToggle.addEventListener("click", () => {
      const opened = mainNav.classList.toggle("open");

      menuToggle.setAttribute(
        "aria-expanded",
        String(opened)
      );
    });
  }

  // ==========================================
  // SPOR MENÜSÜ
  // ==========================================

  function setupSportsMenu() {
    const dropdown = document.querySelector(
      ".sports-dropdown"
    );

    if (!dropdown) return;

    dropdown.addEventListener("click", event => {
      const link = event.target.closest("a");

      if (link) {
        dropdown.open = false;
      }
    });
  }

  // ==========================================
  // SAYFA BAŞLANGICI
  // ==========================================

  function initialize() {
    if ($("year")) {
      $("year").textContent =
        new Date().getFullYear();
    }

    if ($("todayText")) {
      $("todayText").textContent =
        formatFullDate(dateKey(new Date()));
    }

    if (statusFilter) {
      statusFilter.addEventListener(
        "change",
        renderMatches
      );
    }

    if (standingsLeague) {
      standingsLeague.addEventListener(
        "change",
        loadStandings
      );
    }

    setupMobileMenu();
    setupSportsMenu();
    setupLeagueButtons();

    renderDates();
    loadMatches();
    loadStandings();

    setInterval(() => {
      if (!document.hidden) {
        loadMatches();
      }
    }, REFRESH_MS);
  }

  initialize();

})();
