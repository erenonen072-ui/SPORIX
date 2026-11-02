
(() => {
  "use strict";

  const params = new URLSearchParams(window.location.search);
  const view = params.get("view") || "match";
  const slug = params.get("slug") || "";

  const $ = id => document.getElementById(id);

  const state = {
    match: null,
    detail: null
  };

  function showError(message) {
    $("loading").classList.add("hidden");
    $("matchPage").classList.add("hidden");
    $("error").classList.remove("hidden");
    $("errorText").textContent = message;
  }

  function showPage() {
    $("loading").classList.add("hidden");
    $("error").classList.add("hidden");
    $("matchPage").classList.remove("hidden");
  }

  function safeText(value, fallback = "") {
    if (value === null || value === undefined || value === "") return fallback;
    if (typeof value === "object") return fallback;
    return String(value);
  }

  function first(...values) {
    return values.find(value =>
      value !== undefined && value !== null && value !== ""
    );
  }

  function unwrap(payload) {
    let result = payload;

    for (let i = 0; i < 4; i++) {
      if (!result || typeof result !== "object" || Array.isArray(result)) break;

      const next = first(
        result.data,
        result.result,
        result.response,
        result.match
      );

      if (!next || next === result) break;
      result = next;
    }

    return result;
  }

  function formatDate(value) {
    if (!value) return "Tarih bilgisi yok";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function image(id, url, fallback = "") {
    const element = $(id);

    if (!element) return;

    if (url && typeof url === "string") {
      element.src = url;
      element.classList.remove("hidden");
      element.onerror = () => {
        element.removeAttribute("src");
        element.classList.add("hidden");
      };
    } else {
      element.removeAttribute("src");
      if (fallback) element.alt = fallback;
      element.classList.add("hidden");
    }
  }

  function setText(id, value, fallback = "-") {
    const element = $(id);
    if (element) element.textContent = safeText(value, fallback);
  }

  function cleanStatus(match) {
    const status = safeText(
      first(match.status_text, match.status, match.match_status),
      "Maç bilgisi"
    );

    return status.replaceAll("_", " ");
  }

  function isLive(match) {
    const status = safeText(
      first(match.status, match.status_text, match.match_status)
    ).toLowerCase();

    return [
      "live", "playing", "in_play", "inplay",
      "1h", "2h", "ht", "extra_time"
    ].some(item => status.includes(item));
  }

  function getTeams(detail) {
    const match = detail.match || detail;
    const home = first(match.home_team, match.homeTeam, match.home, {});
    const away = first(match.away_team, match.awayTeam, match.away, {});

    return {
      match,
      home: typeof home === "string" ? { name: home } : home,
      away: typeof away === "string" ? { name: away } : away
    };
  }

  function renderHeader(detail) {
    const { match, home, away } = getTeams(detail);

    const homeName = first(home.name, home.team_name, match.home_name, match.home);
    const awayName = first(away.name, away.team_name, match.away_name, match.away);

    const homeLogo = first(home.logo, home.image, home.team_logo, match.home_logo);
    const awayLogo = first(away.logo, away.image, away.team_logo, match.away_logo);

    const homeScore = first(match.home_score, match.homeScore, home.score, "-");
    const awayScore = first(match.away_score, match.awayScore, away.score, "-");

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

    const status = cleanStatus(match);
    const live = isLive(match);

    setText("homeName", homeName, "Ev sahibi");
    setText("awayName", awayName, "Deplasman");
    setText("score", `${homeScore} : ${awayScore}`);
    setText("competitionName", competitionName, "Karşılaşma");
    setText("matchStatus", status);

    image("homeLogo", homeLogo, homeName);
    image("awayLogo", awayLogo, awayName);
    image("competitionLogo", competitionLogo);

    $("statusDot").classList.toggle("live", live);

    setText("matchTime", first(
      match.minute ? `${match.minute}'` : null,
      match.time_text,
      match.elapsed ? `${match.elapsed}'` : null,
      match.time_status
    ), live ? "Canlı" : "Karşılaşma");

    const half = first(
      match.half_score,
      match.halftime_score,
      match.ht_score
    );

    setText(
      "halfScore",
      half ? `İlk yarı: ${typeof half === "object"
        ? `${first(half.home, half.home_score, "-")} - ${first(half.away, half.away_score, "-")}`
        : half}` : "",
      ""
    );

    const date = first(match.time, match.date, match.match_time, match.start_time);
    setText("matchDate", formatDate(date));

    const venue = first(match.venue, match.stadium, match.venue_name);
    const referee = first(match.referee, match.referee_name);

    setText("matchVenue", venue, "");
    setText("matchReferee", referee ? `Hakem: ${referee}` : "", "");

    setText("infoCompetition", competitionName);
    setText("infoDate", formatDate(date));
    setText("infoStatus", status);
    setText("infoVenue", venue);
    setText("infoReferee", referee);

    setText("homeLineupTitle", homeName, "Ev sahibi");
    setText("awayLineupTitle", awayName, "Deplasman");

    document.title = `${homeName || "Maç"} - ${awayName || "Detay"} | SPORIX`;

    const summary = first(
      match.description,
      match.summary,
      match.match_summary,
      detail.summary
    );

    $("summaryContent").textContent =
      typeof summary === "string" && summary.trim()
        ? summary
        : "Bu karşılaşma için ayrıca bir maç özeti sağlanmamış. Aşağıdaki olaylar, kadrolar ve istatistikler mevcut API verilerine göre gösterilir.";
  }

  function getArray(...values) {
    return values.find(Array.isArray) || [];
  }

  function renderEvents(detail) {
    const match = detail.match || detail;
    const events = getArray(
      detail.incidents,
      detail.events,
      match.incidents,
      match.events,
      detail.match_events
    );

    const container = $("eventsList");
    container.innerHTML = "";

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
      const type = safeText(
        first(event.type, event.incident_type, event.kind, event.event_type),
        "Olay"
      ).toLowerCase();

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
        label = safeText(first(event.type_name, event.description), "Maç olayı");
      }

      const row = document.createElement("div");
      row.className = "event-row";

      const minuteElement = document.createElement("div");
      minuteElement.className = "event-minute";
      minuteElement.textContent = minute;

      const description = document.createElement("div");
      description.className = "event-description";
      description.textContent = `${label}${player ? ` · ${player}` : ""}`;

      if (assist) {
        const small = document.createElement("small");
        small.textContent = `Asist: ${assist}`;
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
    if (typeof player === "string") {
      return { name: player };
    }

    return player || {};
  }

  function renderPlayerList(containerId, players) {
    const container = $(containerId);
    container.innerHTML = "";

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
      numberElement.textContent = safeText(number, "•");

      const nameElement = document.createElement("span");
      nameElement.className = "player-name";
      nameElement.textContent = safeText(name, "Oyuncu bilgisi");

      row.append(numberElement, nameElement);
      container.appendChild(row);
    });
  }

  function renderLineups(detail) {
    const lineups = first(
      detail.lineups,
      detail.lineup,
      detail.match?.lineups,
      {}
    );

    const homeXI = getArray(
      lineups.home_xi,
      lineups.home_lineup,
      lineups.home?.starting,
      lineups.home?.players,
      detail.home_xi
    );

    const awayXI = getArray(
      lineups.away_xi,
      lineups.away_lineup,
      lineups.away?.starting,
      lineups.away?.players,
      detail.away_xi
    );

    const homeSubs = getArray(
      lineups.home_subs,
      lineups.home_substitutes,
      lineups.home?.substitutes,
      detail.home_subs
    );

    const awaySubs = getArray(
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
    const stats = first(
      detail.stats,
      detail.statistics,
      detail.match?.stats,
      detail.match?.statistics
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
    container.innerHTML = "";

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

      const numericHome = Number(String(home).replace("%", "").replace(",", "."));
      const numericAway = Number(String(away).replace("%", "").replace(",", "."));

      let homeWidth = 50;
      let awayWidth = 50;

      if (
        Number.isFinite(numericHome) &&
        Number.isFinite(numericAway) &&
        numericHome + numericAway > 0
      ) {
        homeWidth = numericHome / (numericHome + numericAway) * 100;
        awayWidth = 100 - homeWidth;
      }

      const row = document.createElement("div");
      row.className = "stat-row";

      const label = document.createElement("div");
      label.className = "stat-label";
      label.textContent = safeText(name, "İstatistik");

      const values = document.createElement("div");
      values.className = "stat-values";

      const homeValue = document.createElement("span");
      homeValue.textContent = safeText(home, "-");

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
      awayValue.textContent = safeText(away, "-");

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

    $("loading").classList.remove("hidden");
    $("error").classList.add("hidden");
    $("matchPage").classList.add("hidden");

    try {
      const url = `/api/sportscore?action=match&slug=${encodeURIComponent(slug)}`;

      const response = await fetch(url, {
        headers: { Accept: "application/json" }
      });

      if (!response.ok) {
        throw new Error(`Sunucu yanıtı: ${response.status}`);
      }

      const payload = await response.json();

      if (payload.success === false || payload.error) {
        throw new Error(payload.error || payload.message || "Maç verisi bulunamadı.");
      }

      const detail = unwrap(payload);

      if (!detail || typeof detail !== "object") {
        throw new Error("Maç verisi beklenen formatta değil.");
      }

      state.detail = detail;

      renderHeader(detail);
      renderEvents(detail);
      renderLineups(detail);
      renderStats(detail);

      showPage();
    } catch (error) {
      console.error("SPORIX maç detayı:", error);
      showError(error.message || "Maç bilgileri alınamadı.");
    }
  }

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

  $("retryButton").addEventListener("click", loadMatch);

  setupTabs();

  if (view !== "match") {
    showError("Bu sayfa şu anda maç detay görünümü için hazırlanmıştır.");
  } else {
    loadMatch();
  }
})();
