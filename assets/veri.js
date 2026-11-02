
(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") || "match";
  const slug = params.get("slug") || "";

  const $ = id => document.getElementById(id);

  const first = (...values) => values.find(value =>
    value !== undefined && value !== null && value !== ""
  );

  const array = (...values) => values.find(Array.isArray) || [];

  const text = (value, fallback = "-") => {
    if (value === undefined || value === null || value === "") return fallback;
    if (typeof value === "object") return fallback;
    return String(value);
  };

  function setText(id, value, fallback = "-") {
    const element = $(id);
    if (element) element.textContent = text(value, fallback);
  }

  function setImage(id, url, alt = "") {
    const element = $(id);
    if (!element) return;

    if (url && typeof url === "string") {
      element.src = url;
      element.alt = alt;
      element.classList.remove("hidden");

      element.onerror = () => {
        element.removeAttribute("src");
        element.classList.add("hidden");
      };
    } else {
      element.removeAttribute("src");
      element.classList.add("hidden");
    }
  }

  function showError(message) {
    $("loading").classList.add("hidden");
    $("matchPage").classList.add("hidden");
    $("teamPage").classList.add("hidden");
    $("error").classList.remove("hidden");
    $("errorText").textContent = message;
  }

  function showLoading() {
    $("loading").classList.remove("hidden");
    $("error").classList.add("hidden");
    $("matchPage").classList.add("hidden");
    $("teamPage").classList.add("hidden");
  }

  function showPage(page) {
    $("loading").classList.add("hidden");
    $("error").classList.add("hidden");
    $("matchPage").classList.toggle("hidden", page !== "match");
    $("teamPage").classList.toggle("hidden", page !== "team");
  }

  function unwrap(payload) {
    if (!payload || typeof payload !== "object") return {};

    if (payload.data && typeof payload.data === "object") {
      return payload.data;
    }

    if (payload.result && typeof payload.result === "object") {
      return payload.result;
    }

    return payload;
  }

  async function request(url) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Sunucu yanıtı: ${response.status}`);
    }

    const payload = await response.json();

    if (payload.success === false || payload.error) {
      throw new Error(
        payload.error || payload.message || "Veri alınamadı."
      );
    }

    return unwrap(payload);
  }

  function formatDate(value) {
    if (!value) return "Tarih bilgisi yok";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

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

  function getMatchSlug(match) {
    const parts = String(match.url || "")
      .split("/")
      .filter(Boolean);

    return first(
      match.slug,
      match.match_slug,
      match.url_slug,
      parts.length >= 2 ? parts[parts.length - 2] : ""
    );
  }

  function getTeamSlug(team, match, side) {
    const isHome = side === "home";

    return first(
      team.slug,
      team.team_slug,
      match[`${side}_slug`],
      match[`${side}_team_slug`],
      slugify(team.name || team.team_name)
    );
  }

  function getTeams(detail) {
    const match = detail.match || detail;

    let home = first(
      match.home_team,
      match.homeTeam,
      match.home,
      {}
    );

    let away = first(
      match.away_team,
      match.awayTeam,
      match.away,
      {}
    );

    if (typeof home === "string") home = { name: home };
    if (typeof away === "string") away = { name: away };

    return { match, home, away };
  }

  // =====================================
  // MAÇ DETAY SAYFASI
  // =====================================

  function renderMatchHeader(detail) {
    const { match, home, away } = getTeams(detail);

    const homeName = first(
      home.name,
      home.team_name,
      match.home_name,
      typeof match.home === "string" ? match.home : null
    );

    const awayName = first(
      away.name,
      away.team_name,
      match.away_name,
      typeof match.away === "string" ? match.away : null
    );

    const homeLogo = first(
      home.logo,
      home.image,
      home.team_logo,
      match.home_logo
    );

    const awayLogo = first(
      away.logo,
      away.image,
      away.team_logo,
      match.away_logo
    );

    const homeScore = first(
      match.home_score,
      match.homeScore,
      home.score,
      "-"
    );

    const awayScore = first(
      match.away_score,
      match.awayScore,
      away.score,
      "-"
    );

    const competition = first(
      match.competition,
      match.league_name,
      match.league,
      detail.competition
    );

    const competitionName = typeof competition === "object"
      ? first(competition.name, competition.title)
      : competition;

    const competitionLogo = typeof competition === "object"
      ? first(competition.logo, competition.image)
      : first(match.competition_logo, match.league_logo);

    const status = text(
      first(match.status_text, match.status, match.match_status),
      "Maç bilgisi"
    ).replaceAll("_", " ");

    const date = first(
      match.time,
      match.date,
      match.match_time,
      match.start_time
    );

    const venue = first(
      match.venue,
      match.stadium,
      match.venue_name
    );

    const referee = first(
      match.referee,
      match.referee_name
    );

    setText("homeName", homeName, "Ev sahibi");
    setText("awayName", awayName, "Deplasman");
    setText("score", `${homeScore} : ${awayScore}`);
    setText("competitionName", competitionName, "Karşılaşma");
    setText("matchStatus", status);
    setText("matchDate", formatDate(date));
    setText("matchVenue", venue, "");
    setText("matchReferee", referee ? `Hakem: ${referee}` : "", "");

    setImage("homeLogo", homeLogo, homeName);
    setImage("awayLogo", awayLogo, awayName);
    setImage("competitionLogo", competitionLogo, competitionName);

    const statusValue = String(first(
      match.status,
      match.status_text,
      match.match_status,
      ""
    )).toLowerCase();

    const live = [
      "live", "playing", "in_play", "inplay",
      "1h", "2h", "ht", "extra_time"
    ].some(value => statusValue.includes(value));

    $("statusDot").classList.toggle("live", live);

    const minute = first(
      match.minute ? `${match.minute}'` : null,
      match.time_text,
      match.elapsed ? `${match.elapsed}'` : null,
      match.time_status
    );

    setText("matchTime", minute, live ? "Canlı" : "Karşılaşma");

    const half = first(
      match.half_score,
      match.halftime_score,
      match.ht_score
    );

    let halfText = "";

    if (half && typeof half === "object") {
      halfText = `İlk yarı: ${first(half.home, half.home_score, "-")} - ${first(half.away, half.away_score, "-")}`;
    } else if (half) {
      halfText = `İlk yarı: ${half}`;
    }

    setText("halfScore", halfText, "");

    setText("infoCompetition", competitionName);
    setText("infoDate", formatDate(date));
    setText("infoStatus", status);
    setText("infoVenue", venue);
    setText("infoReferee", referee);

    setText("homeLineupTitle", homeName, "Ev sahibi");
    setText("awayLineupTitle", awayName, "Deplasman");

    const homeSlug = getTeamSlug(home, match, "home");
    const awaySlug = getTeamSlug(away, match, "away");

    const homeLink = $("homeTeamLink");
    const awayLink = $("awayTeamLink");

    if (homeSlug) {
      homeLink.href = `/veri.html?view=team&slug=${encodeURIComponent(homeSlug)}`;
    }

    if (awaySlug) {
      awayLink.href = `/veri.html?view=team&slug=${encodeURIComponent(awaySlug)}`;
    }

    document.title = `${homeName || "Maç"} - ${awayName || "Detay"} | SPORIX`;
    setText("breadcrumbCurrent", "Maç Detayı");

    const summary = first(
      match.description,
      match.summary,
      match.match_summary,
      detail.summary
    );

    setText(
      "summaryContent",
      summary,
      "Bu karşılaşma için ayrıca bir maç özeti sağlanmamış. Olaylar, kadrolar ve istatistikler mevcut API verilerine göre gösterilir."
    );
  }

  function renderEvents(detail) {
    const match = detail.match || detail;

    const events = array(
      detail.incidents,
      detail.events,
      match.incidents,
      match.events,
      detail.match_events
    );

    const container = $("eventsList");
    container.replaceChildren();

    if (!events.length) {
      container.innerHTML =
        '<div class="empty-state">Bu maç için olay bilgisi bulunamadı.</div>';
      return;
    }

    const sorted = [...events].sort((a, b) => {
      const minuteA = Number(first(a.minute, a.time, a.elapsed, 0));
      const minuteB = Number(first(b.minute, b.time, b.elapsed, 0));
      return minuteA - minuteB;
    });

    sorted.forEach(event => {
      const type = String(first(
        event.type,
        event.incident_type,
        event.kind,
        event.event_type,
        ""
      )).toLowerCase();

      const player = first(
        event.player_name,
        event.player,
        event.name,
        event.player1
      );

      const assist = first(
        event.assist,
        event.assist_name,
        event.assist_player
      );

      const minute = first(
        event.minute ? `${event.minute}'` : null,
        event.time ? `${event.time}'` : null,
        event.elapsed ? `${event.elapsed}'` : null,
        "-"
      );

      let icon = "⚽";
      let label = "Gol";

      if (type.includes("yellow")) {
        icon = "🟨";
        label = "Sarı kart";
      } else if (type.includes("red")) {
        icon = "🟥";
        label = "Kırmızı kart";
      } else if (type.includes("sub")) {
        icon = "🔄";
        label = "Oyuncu değişikliği";
      } else if (type.includes("penalty")) {
        icon = "⚽";
        label = "Penaltı";
      } else if (type.includes("own")) {
        icon = "⚽";
        label = "Kendi kalesine gol";
      } else if (type.includes("var")) {
        icon = "📺";
        label = "VAR";
      } else if (type.includes("goal")) {
        icon = "⚽";
        label = "Gol";
      } else {
        label = first(event.type_name, event.description, "Maç olayı");
      }

      const row = document.createElement("div");
      row.className = "event-row";

      const minuteElement = document.createElement("div");
      minuteElement.className = "event-minute";
      minuteElement.textContent = minute;

      const description = document.createElement("div");
      description.className = "event-description";
      description.textContent = `${label}${player ? ` · ${typeof player === "object" ? first(player.name, player.player_name, "") : player}` : ""}`;

      if (assist) {
        const small = document.createElement("small");
        small.textContent = `Asist: ${typeof assist === "object" ? first(assist.name, assist.player_name, "") : assist}`;
        description.appendChild(small);
      }

      const eventIcon = document.createElement("div");
      eventIcon.className = "event-side";
      eventIcon.textContent = icon;

      row.append(minuteElement, description, eventIcon);
      container.appendChild(row);
    });
  }

  function normalizePlayer(player) {
    if (typeof player === "string") return { name: player };
    return player || {};
  }

  function renderPlayerList(containerId, players) {
    const container = $(containerId);
    container.replaceChildren();

    if (!Array.isArray(players) || !players.length) {
      container.innerHTML =
        '<div class="empty-state">Kadro bilgisi bulunamadı.</div>';
      return;
    }

    players.forEach(item => {
      const player = normalizePlayer(item);

      const name = first(
        player.name,
        player.player_name,
        player.athlete_name,
        player.title
      );

      const number = first(
        player.number,
        player.shirt_number,
        player.jersey_number,
        player.no
      );

      const row = document.createElement("div");
      row.className = "player-row";

      const numberElement = document.createElement("span");
      numberElement.className = "player-number";
      numberElement.textContent = text(number, "•");

      const nameElement = document.createElement("span");
      nameElement.className = "player-name";
      nameElement.textContent = text(name, "Oyuncu bilgisi");

      row.append(numberElement, nameElement);
      container.appendChild(row);
    });
  }

  function renderLineups(detail) {
    const match = detail.match || detail;

    const lineups = first(
      detail.lineups,
      detail.lineup,
      match.lineups,
      {}
    );

    const homeXI = array(
      lineups.home_xi,
      lineups.home_lineup,
      lineups.home?.starting,
      lineups.home?.players,
      detail.home_xi
    );

    const awayXI = array(
      lineups.away_xi,
      lineups.away_lineup,
      lineups.away?.starting,
      lineups.away?.players,
      detail.away_xi
    );

    const homeSubs = array(
      lineups.home_subs,
      lineups.home_substitutes,
      lineups.home?.substitutes,
      detail.home_subs
    );

    const awaySubs = array(
      lineups.away_subs,
      lineups.away_substitutes,
      lineups.away?.substitutes,
      detail.away_subs
    );

    renderPlayerList("homeLineup", homeXI);
    renderPlayerList("awayLineup", awayXI);
    renderPlayerList("homeSubs", homeSubs);
    renderPlayerList("awaySubs", awaySubs);
  }

  function normalizeStats(detail) {
    const match = detail.match || detail;

    const stats = first(
      detail.stats,
      detail.statistics,
      match.stats,
      match.statistics
    );

    if (Array.isArray(stats)) return stats;

    if (stats && typeof stats === "object") {
      return Object.entries(stats).map(([key, value]) => {
        if (value && typeof value === "object") {
          return {
            name: first(value.name, value.type, key),
            home: first(value.home, value.home_value, value.home_team),
            away: first(value.away, value.away_value, value.away_team)
          };
        }

        return { name: key, home: value, away: "" };
      });
    }

    return [];
  }

  function renderStats(detail) {
    const container = $("statisticsList");
    container.replaceChildren();

    const stats = normalizeStats(detail);

    if (!stats.length) {
      container.innerHTML =
        '<div class="empty-state">Bu maç için istatistik verisi henüz sağlanmamış.</div>';
      return;
    }

    stats.forEach(stat => {
      const name = first(stat.name, stat.type, stat.title, stat.label);

      const home = first(
        stat.home,
        stat.home_value,
        stat.home_team,
        stat.value_home,
        0
      );

      const away = first(
        stat.away,
        stat.away_value,
        stat.away_team,
        stat.value_away,
        0
      );

      const homeNumber = Number(String(home).replace("%", "").replace(",", "."));
      const awayNumber = Number(String(away).replace("%", "").replace(",", "."));

      let homeWidth = 50;
      let awayWidth = 50;

      if (
        Number.isFinite(homeNumber) &&
        Number.isFinite(awayNumber) &&
        homeNumber + awayNumber > 0
      ) {
        homeWidth = homeNumber / (homeNumber + awayNumber) * 100;
        awayWidth = 100 - homeWidth;
      }

      const row = document.createElement("div");
      row.className = "stat-row";

      const label = document.createElement("div");
      label.className = "stat-label";
      label.textContent = text(name, "İstatistik");

      const values = document.createElement("div");
      values.className = "stat-values";

      const homeValue = document.createElement("span");
      homeValue.textContent = text(home);

      const bars = document.createElement("div");
      bars.className = "stat-bars";

      const homeBar = document.createElement("div");
      homeBar.className = "stat-home";
      homeBar.style.width = `${homeWidth}%`;

      const awayBar = document.createElement("div");
      awayBar.className = "stat-away";
      awayBar.style.width = `${awayWidth}%`;

      bars.append(homeBar, awayBar);

      const awayValue = document.createElement("span");
      awayValue.textContent = text(away);

      values.append(homeValue, bars, awayValue);
      row.append(label, values);
      container.appendChild(row);
    });
  }

  async function loadMatch() {
    if (!slug) {
      showError("Maç bağlantısında slug bilgisi bulunamadı.");
      return;
    }

    showLoading();

    try {
      const detail = await request(
        `/api/sportscore?action=match&slug=${encodeURIComponent(slug)}`
      );

      if (!detail || typeof detail !== "object") {
        throw new Error("Maç verisi bulunamadı.");
      }

      renderMatchHeader(detail);
      renderEvents(detail);
      renderLineups(detail);
      renderStats(detail);

      showPage("match");
    } catch (error) {
      console.error("SPORIX maç detayı:", error);
      showError(error.message || "Maç bilgileri alınamadı.");
    }
  }

  // =====================================
  // TAKIM DETAY SAYFASI
  // =====================================

  function renderTeamMatches(matches) {
    const container = $("teamMatches");
    container.replaceChildren();

    if (!matches.length) {
      container.innerHTML =
        '<div class="empty-state">Bu takım için maç kaydı bulunamadı.</div>';
      return;
    }

    matches.forEach(match => {
      const homeObject = match.home_team || {};
      const awayObject = match.away_team || {};

      const home = first(
        match.home,
        match.home_name,
        homeObject.name,
        match.home_team_name,
        "Ev sahibi"
      );

      const away = first(
        match.away,
        match.away_name,
        awayObject.name,
        match.away_team_name,
        "Deplasman"
      );

      const homeLogo = first(
        match.home_logo,
        homeObject.logo,
        match.home_team_logo
      );

      const awayLogo = first(
        match.away_logo,
        awayObject.logo,
        match.away_team_logo
      );

      const homeScore = first(match.home_score, match.homeScore, "-");
      const awayScore = first(match.away_score, match.awayScore, "-");

      const status = first(
        match.status_text,
        match.status,
        formatDate(first(match.time, match.date, match.match_time))
      );

      const matchSlug = getMatchSlug(match);

      const link = document.createElement("a");
      link.className = "team-match";

      if (matchSlug) {
        link.href = `/veri.html?view=match&slug=${encodeURIComponent(matchSlug)}`;
      } else {
        link.href = "#";
        link.addEventListener("click", event => event.preventDefault());
        link.title = "Bu maç için detay bağlantısı sağlanmamış.";
      }

      const homeSide = document.createElement("div");
      homeSide.className = "team-match-side";

      const homeImage = document.createElement("img");
      homeImage.alt = "";
      if (homeLogo) {
        homeImage.src = homeLogo;
      } else {
        homeImage.style.display = "none";
      }

      const homeText = document.createElement("span");
      homeText.textContent = text(home, "Ev sahibi");

      homeSide.append(homeImage, homeText);

      const score = document.createElement("div");
      score.className = "team-match-score";
      score.textContent = `${homeScore} - ${awayScore}`;

      const scoreStatus = document.createElement("small");
      scoreStatus.textContent = text(status);
      score.appendChild(scoreStatus);

      const awaySide = document.createElement("div");
      awaySide.className = "team-match-side away";

      const awayText = document.createElement("span");
      awayText.textContent = text(away, "Deplasman");

      const awayImage = document.createElement("img");
      awayImage.alt = "";
      if (awayLogo) {
        awayImage.src = awayLogo;
      } else {
        awayImage.style.display = "none";
      }

      awaySide.append(awayText, awayImage);

      link.append(homeSide, score, awaySide);
      container.appendChild(link);
    });
  }

  function renderTeamPage(data) {
    const team = first(data.team, data.club, data, {});

    const name = first(
      team.name,
      team.team_name,
      team.title
    );

    const logo = first(
      team.logo,
      team.team_logo,
      team.image
    );

    const league = first(
      team.league_name,
      team.competition_name,
      typeof team.league === "string" ? team.league : team.league?.name,
      data.league_name
    );

    const coach = first(
      team.coach,
      team.coach_name,
      team.manager_name,
      team.manager
    );

    const stadium = first(
      team.stadium,
      team.venue,
      team.stadium_name
    );

    setText("teamName", name, "Takım");
    setText("teamLeague", league, "Lig bilgisi bulunamadı");
    setText("teamInfoName", name);
    setText("teamInfoLeague", league);
    setText("teamCoach", coach);
    setText("teamStadium", stadium);
    setText("breadcrumbCurrent", "Takım Profili");

    setImage("teamLogo", logo, name);

    const matches = array(
      data.matches,
      data.fixtures,
      data.match_list,
      team.matches,
      team.fixtures
    );

    renderTeamMatches(matches);

    document.title = `${name || "Takım"} | SPORIX`;
  }

  async function loadTeam() {
    if (!slug) {
      showError("Takım bağlantısında slug bilgisi bulunamadı.");
      return;
    }

    showLoading();

    try {
      const data = await request(
        `/api/sportscore?action=team&slug=${encodeURIComponent(slug)}&limit=20`
      );

      if (!data || typeof data !== "object") {
        throw new Error("Takım verisi bulunamadı.");
      }

      renderTeamPage(data);
      showPage("team");
    } catch (error) {
      console.error("SPORIX takım detayı:", error);
      showError(error.message || "Takım bilgileri alınamadı.");
    }
  }

  // =====================================
  // SAYFA KONTROLLERİ
  // =====================================

  function setupTabs() {
    document.querySelectorAll(".tabbar .tab").forEach(tab => {
      tab.addEventListener("click", () => {
        document.querySelectorAll(".tabbar .tab").forEach(item => {
          item.classList.remove("active");
        });

        tab.classList.add("active");
      });
    });
  }

  $("retryButton").addEventListener("click", () => {
    if (view === "team") {
      loadTeam();
    } else {
      loadMatch();
    }
  });

  setupTabs();

  if (view === "team") {
    loadTeam();
  } else if (view === "match") {
    loadMatch();
  } else {
    showError("Geçersiz sayfa türü.");
  }
})();
