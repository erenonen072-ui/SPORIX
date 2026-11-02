
(() => {
  "use strict";

  const API_URL = "/api/matches?limit=100";
  const REFRESH_MS = 60000;

  const $ = id => document.getElementById(id);
  const matchList = $("matchList");
  const dateStrip = $("dateStrip");
  const dateLabel = $("selectedDateLabel");
  const matchCount = $("matchCount");
  const statusFilter = $("statusFilter");

  let allMatches = [];
  let selectedDate = dateKey(new Date());
  let selectedLeague = "";
  let loading = false;

  function dateKey(date) {
    const parts = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Istanbul",
      year: "numeric", month: "2-digit", day: "2-digit"
    }).formatToParts(date);
    const get = type => parts.find(p => p.type === type).value;
    return `${get("year")}-${get("month")}-${get("day")}`;
  }

  function parseDate(value) {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function formatTime(value) {
    const date = parseDate(value);
    if (!date) return "--:--";
    return new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul", hour: "2-digit", minute: "2-digit"
    }).format(date);
  }

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
    })[char]);
  }

  function cleanURL(value) {
    if (!value) return "";
    let text = String(value).trim();
    const markdown = text.match(/\]\((https?:\/\/[^)]+)\)/);
    if (markdown) text = markdown[1];
    const direct = text.match(/https?:\/\/[^\s)]+/);
    return direct ? direct[0] : "";
  }

  function getName(team) {
    if (typeof team === "string") return team;
    return team?.name || team?.title || team?.short_name || "Takım";
  }

  function getLogo(match, side) {
    const team = match?.[side];
    const candidates = [
      match?.[`${side}_logo`],
      typeof team === "object" ? team.logo : "",
      typeof team === "object" ? team.image : ""
    ];
    return cleanURL(candidates.find(Boolean));
  }

  function getLeague(match) {
    const league = match?.competition || match?.league || match?.tournament;
    return typeof league === "string"
      ? league
      : league?.name || league?.title || "Diğer Maçlar";
  }

  function getLeagueLogo(match) {
    return cleanURL(match?.competition_logo || match?.league_logo);
  }

  function getSlug(match) {
    if (match?.slug) return match.slug;
    const url = cleanURL(match?.url);
    if (url) {
      try {
        const parts = new URL(url).pathname.split("/").filter(Boolean);
        return parts.at(-1) || "";
      } catch (_) {}
    }
    return "";
  }

  function getStatus(match) {
    const status = String(match?.status || "").toLowerCase();
    const text = String(match?.status_text || "").toLowerCase();

    if (["live", "inplay", "in_progress", "1h", "2h", "ht"].includes(status) ||
        text.includes("canlı") || text.includes("live")) return "live";

    if (["finished", "complete", "completed", "ft"].includes(status) ||
        text.includes("bitti") || text.includes("finished")) return "finished";

    if (["upcoming", "scheduled", "not_started", "ns", "delayed"].includes(status))
      return "upcoming";

    return status.includes("finish") ? "finished" : "upcoming";
  }

  function getScore(match) {
    const home = match?.home_score ?? match?.scores?.home ?? match?.score?.home;
    const away = match?.away_score ?? match?.scores?.away ?? match?.score?.away;
    if (home === null || home === undefined || away === null || away === undefined) return "";
    return `${home} - ${away}`;
  }

  function matchDate(match) {
    return parseDate(match?.time || match?.date || match?.start_time);
  }

  function isSelectedDate(match) {
    const date = matchDate(match);
    return date && dateKey(date) === selectedDate;
  }

  function matchLink(match) {
    const slug = getSlug(match);
    return slug ? `/veri.html?view=match&slug=${encodeURIComponent(slug)}` : "/maclar/";
  }

  function renderDates() {
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
        timeZone: "Europe/Istanbul", weekday: "short"
      }).format(date);
      const number = new Intl.DateTimeFormat("tr-TR", {
        timeZone: "Europe/Istanbul", day: "2-digit", month: "2-digit"
      }).format(date);

      return `<button class="date-button ${key === selectedDate ? "active" : ""}" data-date="${key}">
        <span>${key === dateKey(today) ? "BUGÜN" : escapeHTML(day.toLocaleUpperCase("tr-TR"))}</span>
        <strong>${escapeHTML(number)}</strong>
      </button>`;
    }).join("");

    dateStrip.querySelectorAll("[data-date]").forEach(button => {
      button.addEventListener("click", () => {
        selectedDate = button.dataset.date;
        renderDates();
        renderMatches();
      });
    });
  }

  function renderMatch(match) {
    const status = getStatus(match);
    const score = getScore(match);
    const home = getName(match.home);
    const away = getName(match.away);
    const homeLogo = getLogo(match, "home");
    const awayLogo = getLogo(match, "away");
    const time = formatTime(match.time || match.date || match.start_time);
    const statusText = status === "live" ? "CANLI" :
      status === "finished" ? "BİTTİ" : time;

    return `<a class="match-row-link" href="${escapeHTML(matchLink(match))}">
      <article class="match-row">
        <div class="match-time">
          <span class="${status === "live" ? "live-text" : ""}">${escapeHTML(statusText)}</span>
        </div>
        <div class="teams">
          <div class="team">
            ${homeLogo ? `<img src="${escapeHTML(homeLogo)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ""}
            <span class="team-name">${escapeHTML(home)}</span>
          </div>
          <div class="team">
            ${awayLogo ? `<img src="${escapeHTML(awayLogo)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ""}
            <span class="team-name">${escapeHTML(away)}</span>
          </div>
        </div>
        <div class="score-box">
          <span class="score">${escapeHTML(score || "–")}</span>
          <span class="status ${status === "live" ? "live" : ""}">${escapeHTML(statusText)}</span>
        </div>
      </article>
    </a>`;
  }

  function renderMatches() {
    const statusValue = statusFilter.value;
    let matches = allMatches.filter(isSelectedDate);

    if (selectedLeague) {
      matches = matches.filter(match =>
        getLeague(match).toLocaleLowerCase("tr").includes(selectedLeague.toLocaleLowerCase("tr"))
      );
    }

    if (statusValue !== "all") {
      matches = matches.filter(match => getStatus(match) === statusValue);
    }

    matches.sort((a, b) => {
      const da = matchDate(a)?.getTime() || 0;
      const db = matchDate(b)?.getTime() || 0;
      if (getStatus(a) === "live") return -1;
      if (getStatus(b) === "live") return 1;
      return da - db;
    });

    dateLabel.textContent = new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul", dateStyle: "full"
    }).format(new Date(`${selectedDate}T12:00:00+03:00`));

    matchCount.textContent = `${matches.length} maç`;

    const live = allMatches.filter(m => getStatus(m) === "live").length;
    const finished = allMatches.filter(m => getStatus(m) === "finished").length;
    const upcoming = allMatches.filter(m => getStatus(m) === "upcoming").length;

    if ($("liveCount")) $("liveCount").textContent = live;
    if ($("finishedCount")) $("finishedCount").textContent = finished;
    if ($("upcomingCount")) $("upcomingCount").textContent = upcoming;

    if (!matches.length) {
      matchList.innerHTML = `<div class="empty-state">
        <strong>Bu tarihte gösterilecek maç bulunamadı.</strong>
        <span>Başka bir gün veya lig seçebilirsin.</span>
      </div>`;
      return;
    }

    const groups = new Map();
    matches.forEach(match => {
      const league = getLeague(match);
      if (!groups.has(league)) groups.set(league, []);
      groups.get(league).push(match);
    });

    matchList.innerHTML = [...groups.entries()].map(([league, items]) => {
      const logo = getLeagueLogo(items[0]);
      return `<section class="league-group">
        <div class="league-title">
          ${logo ? `<img src="${escapeHTML(logo)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ""}
          <span>${escapeHTML(league)}</span>
          <small>${items.length} MAÇ</small>
        </div>
        ${items.map(renderMatch).join("")}
      </section>`;
    }).join("");
  }

  function updateLeagueButtons() {
    document.querySelectorAll("[data-league]").forEach(button => {
      button.classList.toggle("active", button.dataset.league === selectedLeague);
      button.addEventListener("click", () => {
        selectedLeague = button.dataset.league;
        updateLeagueButtons();
        renderMatches();
      });
    });
  }

  async function loadMatches() {
    if (loading) return;
    loading = true;

    try {
      const response = await fetch(API_URL, { cache: "no-store" });
      if (!response.ok) throw new Error(`Sunucu yanıtı: ${response.status}`);

      const result = await response.json();
      const matches = Array.isArray(result) ? result : result.matches;

      if (!Array.isArray(matches)) throw new Error("API maç listesi döndürmedi.");

      allMatches = matches;
      renderMatches();
    } catch (error) {
      console.error("SPORIX maç verisi:", error);
      matchList.innerHTML = `<div class="error-state">
        <strong>Maç verileri şu anda alınamıyor.</strong>
        <span>Biraz sonra tekrar deneyebilirsin.</span>
      </div>`;
    } finally {
      loading = false;
    }
  }

  if ($("todayText")) {
    $("todayText").textContent = new Intl.DateTimeFormat("tr-TR", {
      timeZone: "Europe/Istanbul", dateStyle: "full"
    }).format(new Date());
  }
  if ($("year")) $("year").textContent = new Date().getFullYear();

  if ($("menuToggle")) {
    $("menuToggle").addEventListener("click", () => $("mainNav").classList.toggle("open"));
  }

  statusFilter.addEventListener("change", renderMatches);
  renderDates();
  updateLeagueButtons();
  loadMatches();
  setInterval(loadMatches, REFRESH_MS);
})();
