
(() => {
  "use strict";

  // ==========================================
  // SPORIX AYARLARI
  // ==========================================

  const API_URL = "/api/matches";
  const STANDINGS_API_URL = "/api/standings";
  const REFRESH_MS = 60000;
  const FAVORITES_KEY = "sporix_favorite_matches";

  const $ = id => document.getElementById(id);

  const matchList = $("matchList");
  const dateStrip = $("dateStrip");
  const dateLabel = $("selectedDateLabel");
  const matchCount = $("matchCount");
  const statusFilter = $("statusFilter");
  const searchInput = $("homeMatchSearch");
  const clearSearchButton = $("clearMatchSearch");
  const favoriteButton = $("favoriteMatchesButton");
  const favoriteCount = $("favoriteMatchCount");
  const standingsLeague = $("standingsLeague");
  const standingsTable = $("standingsTable");

  let allMatches = [];
  let selectedDate = dateKey(new Date());
  let selectedLeague = "";
  let loading = false;
  let standingsRequestId = 0;
  let searchQuery = "";
  let favoriteMode = false;
  let favorites = loadFavorites();

  // ==========================================
  // FAVORİ VERİLERİ
  // ==========================================

  function loadFavorites() {
    try {
      const saved = JSON.parse(
        localStorage.getItem(FAVORITES_KEY) || "[]"
      );

      return Array.isArray(saved)
        ? saved.filter(item => typeof item === "string")
        : [];
    } catch (error) {
      console.warn("SPORIX favoriler okunamadı:", error);
      return [];
    }
  }

  function saveFavorites() {
    try {
      localStorage.setItem(
        FAVORITES_KEY,
        JSON.stringify(favorites)
      );
    } catch (error) {
      console.error("SPORIX favoriler kaydedilemedi:", error);
    }

    updateFavoriteCount();
  }

  function getMatchId(match) {
    const id =
      match?.id ??
      match?.match_id ??
      match?.fixture_id ??
      match?.event_id ??
      match?.game_id;

    if (id !== undefined && id !== null && String(id).trim()) {
      return String(id);
    }

    const home = getName(getTeam(match, "home"));
    const away = getName(getTeam(match, "away"));
    const date = matchDate(match);

    return [
      normalizeSearch(home),
      normalizeSearch(away),
      normalizeSearch(getLeague(match)),
      date ? date.toISOString() : ""
    ].join("|");
  }

  function isFavorite(match) {
    return favorites.includes(getMatchId(match));
  }

  function toggleFavorite(match) {
    const id = getMatchId(match);

    if (favorites.includes(id)) {
      favorites = favorites.filter(item => item !== id);
    } else {
      favorites.push(id);
    }

    saveFavorites();
    renderMatches();
  }

  function updateFavoriteCount() {
    if (favoriteCount) {
      favoriteCount.textContent = favorites.length;
    }

    if (favoriteButton) {
      favoriteButton.classList.toggle("active", favoriteMode);

      favoriteButton.setAttribute(
        "aria-pressed",
        String(favoriteMode)
      );
    }
  }

  // ==========================================
  // TÜRKİYE LİGLERİ
  // ==========================================

  const TURKISH_LEAGUES = [
    {
      name: "Süper Lig",
      aliases: [
        "turkish super league",
        "turkish-super-league",
        "super league"
      ]
    },
    {
      name: "1. Lig",
      aliases: [
        "turkish first league",
        "turkish-first-league",
        "1st league",
        "first league"
      ]
    },
    {
      name: "2. Lig",
      aliases: [
        "turkish second league",
        "turkish-second-league",
        "2nd league",
        "second league"
      ]
    },
    {
      name: "3. Lig",
      aliases: [
        "turkish third league",
        "turkish-third-league",
        "3rd league",
        "third league"
      ]
    },
    {
      name: "Türkiye Kupası",
      aliases: [
        "turkish cup",
        "turkiye cup",
        "turkish-cup"
      ]
    },
    {
      name: "Süper Kupa",
      aliases: [
        "turkish super cup",
        "turkish-super-cup",
        "super cup"
      ]
    }
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

    return direct
      ? direct[0].replace(/[),]+$/, "")
      : "";
  }

  // ==========================================
  // ARAMA
  // ==========================================

  function normalizeSearch(value) {
    return String(value || "")
      .toLocaleLowerCase("tr-TR")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/ı/g, "i")
      .replace(/\s+/g, " ")
      .trim();
  }

  function matchesSearch(match) {
    if (!searchQuery) return true;

    const home = getName(getTeam(match, "home"));
    const away = getName(getTeam(match, "away"));
    const league = getLeague(match);

    const searchable = normalizeSearch([
      home,
      away,
      `${home} ${away}`,
      `${away} ${home}`,
      league,
      match?.status_text || ""
    ].join(" "));

    return searchable.includes(searchQuery);
  }

  function setupSearch() {
    if (searchInput) {
      searchInput.addEventListener("input", () => {
        searchQuery = normalizeSearch(searchInput.value);
        renderMatches();
      });
    }

    if (clearSearchButton) {
      clearSearchButton.addEventListener("click", () => {
        if (searchInput) {
          searchInput.value = "";
          searchInput.focus();
        }

        searchQuery = "";
        renderMatches();
      });
    }

    if (favoriteButton) {
      favoriteButton.addEventListener("click", () => {
        favoriteMode = !favoriteMode;
        updateFavoriteCount();
        renderMatches();
      });
    }

    updateFavoriteCount();
  }

  // ==========================================
  // SLUG VE URL İŞLEMLERİ
  // ==========================================

  function slugify(value) {
    return String(value || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/ı/g, "i")
      .replace(/ğ/g, "g")
      .replace(/ü/g, "u")
      .replace(/ş/g, "s")
      .replace(/ö/g, "o")
      .replace(/ç/g, "c")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function extractSlug(value, type = "match") {
    if (!value) return "";

    try {
      const url = new URL(
        String(value),
        window.location.origin
      );

      const parts = url.pathname
        .split("/")
        .filter(Boolean);

      const routeIndex = parts.indexOf(type);

      if (
        routeIndex !== -1 &&
        parts[routeIndex + 1]
      ) {
        return decodeURIComponent(parts[routeIndex + 1]);
      }

      return "";
    } catch (error) {
      return "";
    }
  }

  function getMatchSlug(match) {
    if (!match || typeof match !== "object") {
      return "";
    }

    const urls = [
      match.match_url,
      match.details_url,
      match.detail_url,
      match.match_link,
      match.link,
      match.url,
      match.source_url
    ];

    for (const url of urls) {
      const slug = extractSlug(url, "match");
      if (slug) return slug;
    }

    const candidates = [
      match.match_slug,
      match.url_slug,
      match.slug,
      match.event_slug,
      match.fixture_slug
    ];

    for (const value of candidates) {
      if (
        typeof value === "string" &&
        value.trim() &&
        !/^\d+$/.test(value.trim())
      ) {
        return value.trim();
      }
    }

    const nestedUrls = [
      match.match?.url,
      match.match?.match_url,
      match.event?.url,
      match.event?.match_url
    ];

    for (const url of nestedUrls) {
      const slug = extractSlug(url, "match");
      if (slug) return slug;
    }

    return "";
  }

  function getTeam(match, side) {
    return (
      match?.[side] ||
      match?.[`${side}_team`] ||
      match?.teams?.[side] ||
      {}
    );
  }

  function getTeamSlug(match, side) {
    const team = getTeam(match, side);

    const directSlug = side === "home"
      ? match?.home_team_slug || match?.home_slug
      : match?.away_team_slug || match?.away_slug;

    const teamUrl =
      team?.url ||
      team?.team_url ||
      team?.profile_url ||
      match?.[`${side}_team_url`];

    return (
      team?.slug ||
      team?.team_slug ||
      team?.url_slug ||
      directSlug ||
      extractSlug(teamUrl, "team") ||
      slugify(getName(team))
    );
  }

  function matchDetailURL(slug) {
    return `/veri.html?view=match&slug=${encodeURIComponent(slug)}`;
  }

  function teamDetailURL(slug) {
    return `/veri.html?view=team&slug=${encodeURIComponent(slug)}`;
  }

  // ==========================================
  // TAKIM BİLGİLERİ
  // ==========================================

  function getName(team) {
    if (typeof team === "string") {
      return team;
    }

    return (
      team?.name ||
      team?.title ||
      team?.short_name ||
      "Takım"
    );
  }

  function getLogo(match, side) {
    const team = getTeam(match, side);

    const candidates = [
      match?.[`${side}_logo`],
      typeof team === "object" ? team?.logo : "",
      typeof team === "object" ? team?.image : "",
      typeof team === "object" ? team?.crest : ""
    ];

    return cleanURL(candidates.find(Boolean));
  }

  // ==========================================
  // LİG ADI
  // ==========================================

  function normalizeLeague(value) {
    return String(value || "")
      .toLocaleLowerCase("tr-TR")
      .replace(/[ıİ]/g, "i")
      .replace(/\s+/g, " ")
      .trim();
  }

  function getLeague(match) {
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
      return (
        leagueName.includes(selected) ||
        normalizeLeague(slugify(getLeague(match))) ===
          normalizeLeague(slugify(selectedLeague))
      );
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
      match?.status?.name ||
      match?.status ||
      ""
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

      const value = String(button.dataset.league || "").trim();

      selectedLeague =
        !value ||
        normalizeSearch(value) === "tum ligler" ||
        normalizeSearch(value) === "all"
          ? ""
          : value;

      updateLeagueButtons();

      // Lig seçildiğinde API'den yeni maçları getir.
      loadMatches();
    });

    updateLeagueButtons();
  }

  function updateLeagueButtons() {
    document.querySelectorAll(
      "#leagueSidebar [data-league]"
    ).forEach(button => {
      const value = String(button.dataset.league || "").trim();

      const isAll =
        !value ||
        normalizeSearch(value) === "tum ligler" ||
        normalizeSearch(value) === "all";

      button.classList.toggle(
        "active",
        selectedLeague
          ? value === selectedLeague
          : isAll
      );
    });
  }

  // ==========================================
  // MAÇ KARTI
  // ==========================================

  function renderMatch(match) {
    const status = getStatus(match);
    const score = getScore(match);

    const home = getName(getTeam(match, "home"));
    const away = getName(getTeam(match, "away"));

    const homeLogo = getLogo(match, "home");
    const awayLogo = getLogo(match, "away");

    const matchSlug = getMatchSlug(match);
    const homeSlug = getTeamSlug(match, "home");
    const awaySlug = getTeamSlug(match, "away");

    const matchIndex = allMatches.indexOf(match);
    const favorite = isFavorite(match);
    const id = getMatchId(match);

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
      <article
        class="match-row"
        data-match-card
        data-match-index="${matchIndex}"
        data-match-slug="${escapeHTML(matchSlug)}"
        tabindex="0"
        role="link"
        aria-label="${escapeHTML(home)} - ${escapeHTML(away)} maç detayını aç"
      >
        <div class="match-card-top">
          <span class="match-league-name">
            ${escapeHTML(getLeague(match))}
          </span>

          <span class="match-start-time">
            ${status === "upcoming" ? escapeHTML(clock) : ""}
          </span>

          <button
            type="button"
            class="favorite-match-button ${favorite ? "is-favorite" : ""}"
            data-favorite-key="${escapeHTML(id)}"
            aria-label="${favorite ? "Favorilerden çıkar" : "Favorilere ekle"}"
            aria-pressed="${favorite}"
            title="${favorite ? "Favorilerden çıkar" : "Favorilere ekle"}"
          >${favorite ? "★" : "☆"}</button>
        </div>

        <div class="match-card-content">
          <a
            class="match-side home-side"
            href="${teamDetailURL(homeSlug)}"
            data-team-link
            aria-label="${escapeHTML(home)} takım profilini aç"
          >
            ${
              homeLogo
                ? `<img
                    src="${escapeHTML(homeLogo)}"
                    alt="${escapeHTML(home)}"
                    loading="lazy"
                    onerror="this.style.display='none'"
                  >`
                : ""
            }

            <span class="team-name">
              ${escapeHTML(home)}
            </span>
          </a>

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

          <a
            class="match-side away-side"
            href="${teamDetailURL(awaySlug)}"
            data-team-link
            aria-label="${escapeHTML(away)} takım profilini aç"
          >
            <span class="team-name">
              ${escapeHTML(away)}
            </span>

            ${
              awayLogo
                ? `<img
                    src="${escapeHTML(awayLogo)}"
                    alt="${escapeHTML(away)}"
                    loading="lazy"
                    onerror="this.style.display='none'"
                  >`
                : ""
            }
          </a>
        </div>
      </article>
    `;
  }

  // ==========================================
  // MAÇ KARTI TIKLAMA SİSTEMİ
  // ==========================================

  if (matchList) {
    matchList.addEventListener("click", event => {
      const favoriteControl = event.target.closest(
        "[data-favorite-key]"
      );

      if (favoriteControl) {
        event.preventDefault();
        event.stopPropagation();

        const index = Number(
          favoriteControl.closest("[data-match-card]")
            ?.dataset.matchIndex
        );

        const match = allMatches[index];

        if (match) {
          toggleFavorite(match);
        }

        return;
      }

      const teamLink = event.target.closest("[data-team-link]");
      if (teamLink) return;

      const card = event.target.closest("[data-match-card]");
      if (!card) return;

      const index = Number(card.dataset.matchIndex);
      const match = allMatches[index];

      if (!match) {
        console.error("SPORIX: Maç verisi bulunamadı.", card);
        return;
      }

      const slug = getMatchSlug(match);

      if (!slug) {
        console.error(
          "SPORIX - Detay bağlantısı bulunamayan maç:",
          match
        );

        alert(
          "Bu maç için API'den gerçek detay bağlantısı alınamadı. Konsolu kontrol et."
        );

        return;
      }

      window.location.href = matchDetailURL(slug);
    });

    matchList.addEventListener("keydown", event => {
      if (event.key !== "Enter" && event.key !== " ") {
        return;
      }

      const card = event.target.closest("[data-match-card]");
      if (!card) return;

      if (event.target.closest(
        "[data-team-link], [data-favorite-key]"
      )) {
        return;
      }

      event.preventDefault();

      const index = Number(card.dataset.matchIndex);
      const match = allMatches[index];

      if (!match) return;

      const slug = getMatchSlug(match);

      if (slug) {
        window.location.href = matchDetailURL(slug);
      }
    });
  }

  // ==========================================
  // LİG GRUPLARINI OLUŞTUR
  // ==========================================

  function renderLeagueGroups(matches) {
    const groups = new Map();

    matches.forEach(match => {
      const league = getLeague(match);

      if (!groups.has(league)) {
        groups.set(league, []);
      }

      groups.get(league).push(match);
    });

    return [...groups.entries()]
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

    matches = matches.filter(matchesSearch);

    if (favoriteMode) {
      matches = matches.filter(isFavorite);
    }

    matches.sort((a, b) => {
      const aFavorite = isFavorite(a);
      const bFavorite = isFavorite(b);

      if (aFavorite && !bFavorite) return -1;
      if (!aFavorite && bFavorite) return 1;

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
      dateLabel.textContent = formatFullDate(selectedDate);
    }

    if (matchCount) {
      matchCount.textContent = `${matches.length} maç`;
    }

    updateMatchStatistics();
    updateFavoriteCount();

    if (!matches.length) {
      const message = favoriteMode
        ? "Bu filtrelerde favori maç bulunamadı."
        : searchQuery
          ? "Aradığın maç bulunamadı."
          : selectedLeague
            ? "Bu ligde seçilen tarihte maç bulunamadı."
            : "Bu tarihte gösterilecek maç bulunamadı.";

      matchList.innerHTML = `
        <div class="match-empty-search">
          <strong>${escapeHTML(message)}</strong>
          <p>Başka bir takım, tarih veya lig deneyebilirsin.</p>
        </div>
      `;

      return;
    }

    const favoriteMatches = matches.filter(isFavorite);

    const otherMatches = matches.filter(
      match => !isFavorite(match)
    );

    let html = "";

    if (favoriteMatches.length) {
      html += `
        <div class="favorite-section-heading">
          ⭐ FAVORİ MAÇLARIN
          <span>(${favoriteMatches.length})</span>
        </div>
      `;

      html += renderLeagueGroups(favoriteMatches);
    }

    if (otherMatches.length) {
      if (favoriteMatches.length) {
        html += `
          <div class="favorite-section-heading">
            TÜM DİĞER MAÇLAR
          </div>
        `;
      }

      html += renderLeagueGroups(otherMatches);
    }

    matchList.innerHTML = html;
  }

  function matchesSearch(match) {
    return matchesSearchQuery(match);
  }

  function matchesSearchQuery(match) {
    if (!searchQuery) return true;

    const home = getName(getTeam(match, "home"));
    const away = getName(getTeam(match, "away"));
    const league = getLeague(match);

    const searchable = normalizeSearch([
      home,
      away,
      `${home} ${away}`,
      `${away} ${home}`,
      league,
      match?.status_text || ""
    ].join(" "));

    return searchable.includes(searchQuery);
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

      // Seçilen ligi API'ye gönder.
      if (selectedLeague) {
        url.searchParams.set(
          "competition",
          selectedLeague
        );
      }

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
        : result.matches ||
          result.data?.matches ||
          result.data ||
          [];

      if (!Array.isArray(matches)) {
        throw new Error("API maç listesi döndürmedi.");
      }

      allMatches = matches;

      console.log("SPORIX ana sayfa API:", {
        tarih: selectedDate,
        seçilenLig: selectedLeague || "Tüm Ligler",
        maçSayısı: allMatches.length,
        ligler: [...new Set(allMatches.map(getLeague))],
        maçlar: allMatches
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
        data?.data?.standings ||
        data?.data?.table ||
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
    if (!standingsTable || !standingsLeague) {
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
      const url = new URL(
        STANDINGS_API_URL,
        window.location.origin
      );

      url.searchParams.set("league", league);

      const response = await fetch(url, {
        cache: "no-store"
      });

      const responseText = await response.text();

      if (!response.ok) {
        console.error(
          "SPORIX standings API yanıtı:",
          response.status,
          responseText
        );

        throw new Error(
          `Puan durumu API yanıtı: ${response.status}`
        );
      }

      let data;

      try {
        data = JSON.parse(responseText);
      } catch {
        throw new Error(
          "Puan durumu API geçerli JSON döndürmedi."
        );
      }

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
      $("year").textContent = new Date().getFullYear();
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

    setupSearch();
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
