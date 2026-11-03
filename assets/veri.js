
(() => {
  "use strict";

  const params = new URLSearchParams(location.search);
  const view = params.get("view") || "match";
  const slug = params.get("slug") || "";

  const $ = id => document.getElementById(id);

  const first = (...values) => values.find(v =>
    v !== undefined && v !== null && v !== ""
  );

  const array = (...values) => values.find(Array.isArray) || [];

  const value = (v, fallback = "-") =>
    v === undefined || v === null || v === "" || typeof v === "object"
      ? fallback
      : String(v);

  function setText(id, val, fallback = "-") {
    const el = $(id);
    if (el) el.textContent = value(val, fallback);
  }

  function cleanImageUrl(input) {
    if (typeof input !== "string") return "";

    let url = input.trim();

    const markdown = url.match(/\]\((https?:\/\/[^)]+)\)/);
    if (markdown) url = markdown[1];

    const bracket = url.match(/^\[(https?:\/\/[^\]]+)\]$/);
    if (bracket) url = bracket[1];

    if (!/^https?:\/\//i.test(url)) return "";

    try {
      const parsed = new URL(url);
      return ["http:", "https:"].includes(parsed.protocol) ? url : "";
    } catch {
      return "";
    }
  }

  function setImage(id, url, alt = "") {
    const el = $(id);
    if (!el) return;

    const safeUrl = cleanImageUrl(url);

    if (!safeUrl) {
      el.removeAttribute("src");
      el.classList.add("hidden");
      return;
    }

    el.src = safeUrl;
    el.alt = alt;
    el.classList.remove("hidden");

    el.onerror = () => {
      el.removeAttribute("src");
      el.classList.add("hidden");
    };
  }

  function showLoading() {
    $("loading")?.classList.remove("hidden");
    $("error")?.classList.add("hidden");

    ["matchPage", "teamPage", "playerPage"].forEach(id =>
      $(id)?.classList.add("hidden")
    );
  }

  function showError(message) {
    $("loading")?.classList.add("hidden");

    ["matchPage", "teamPage", "playerPage"].forEach(id =>
      $(id)?.classList.add("hidden")
    );

    $("error")?.classList.remove("hidden");
    setText("errorText", message, "Bilgiler yüklenemedi.");
  }

  function showPage(page) {
    $("loading")?.classList.add("hidden");
    $("error")?.classList.add("hidden");

    ["matchPage", "teamPage", "playerPage"].forEach(id => {
      $(id)?.classList.toggle("hidden", id !== `${page}Page`);
    });
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

  function formatDate(input) {
    if (!input) return "Tarih bilgisi yok";

    const date = new Date(input);

    if (Number.isNaN(date.getTime())) return String(input);

    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function slugify(input) {
    return String(input || "")
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

  function getPlayerSlug(player) {
    return first(
      player.slug,
      player.player_slug,
      player.url_slug,
      player.url?.split("/").filter(Boolean).pop(),
      player.player_url?.split("/").filter(Boolean).pop(),
      ""
    );
  }

  function getPlayerName(player) {
    if (typeof player === "string") return player;

    return first(
      player.name,
      player.player_name,
      player.athlete_name,
      player.title,
      "Oyuncu"
    );
  }

  function playerLink(player) {
    const playerSlug = getPlayerSlug(player);

    if (!playerSlug || !/^[a-z0-9-]+$/i.test(playerSlug)) {
      return "";
    }

    return `/veri.html?view=player&slug=${encodeURIComponent(playerSlug)}`;
  }

  function getMatchSlug(match) {
    const parts = String(
      match.url || match.match_url || match.link || ""
    ).split("/").filter(Boolean);

    const index = parts.indexOf("match");

    if (index !== -1 && parts[index + 1]) {
      return parts[index + 1];
    }

    return first(match.slug, match.match_slug, match.url_slug, "");
  }

  function getTeamSlug(team, match, side) {
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

    let home = first(match.home_team, match.homeTeam, match.home, {});
    let away = first(match.away_team, match.awayTeam, match.away, {});

    if (typeof home === "string") home = { name: home };
    if (typeof away === "string") away = { name: away };

    return { match, home, away };
  }

  // =====================================
  // MAÇ BAŞLIĞI
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

    const status = value(
      first(match.status_text, match.status, match.match_status),
      "Maç bilgisi"
    ).replaceAll("_", " ");

    const date = first(
      match.time,
      match.date,
      match.match_time,
      match.start_time
    );

    const venue = first(match.venue, match.stadium, match.venue_name);
    const referee = first(match.referee, match.referee_name);

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

    const statusValue = String(
      first(match.status, match.status_text, match.match_status, "")
    ).toLowerCase();

    const live = [
      "live", "playing", "in_play", "inplay",
      "1h", "2h", "ht", "extra_time"
    ].some(item => statusValue.includes(item));

    $("statusDot")?.classList.toggle("live", live);

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

    if (homeSlug && $("homeTeamLink")) {
      $("homeTeamLink").href =
        `/veri.html?view=team&slug=${encodeURIComponent(homeSlug)}`;
    }

    if (awaySlug && $("awayTeamLink")) {
      $("awayTeamLink").href =
        `/veri.html?view=team&slug=${encodeURIComponent(awaySlug)}`;
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
      "Bu karşılaşma için ayrıca bir maç özeti sağlanmamış."
    );
  }

  // =====================================
  // MAÇ OLAYLARI
  // =====================================

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
    if (!container) return;

    container.replaceChildren();

    if (!events.length) {
      container.innerHTML =
        '<div class="empty-state">Bu maç için olay bilgisi bulunamadı.</div>';
      return;
    }

    [...events].sort((a, b) =>
      Number(first(a.minute, a.time, a.elapsed, 0)) -
      Number(first(b.minute, b.time, b.elapsed, 0))
    ).forEach(event => {
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
        label = "Penaltı";
      } else if (type.includes("own")) {
        label = "Kendi kalesine gol";
      } else if (type.includes("var")) {
        icon = "📺";
        label = "VAR";
      } else if (type.includes("goal")) {
        label = "Gol";
      } else {
        label = first(event.type_name, event.description, "Maç olayı");
      }

      const row = document.createElement("div");
      row.className = "event-row";

      const minuteEl = document.createElement("div");
      minuteEl.className = "event-minute";
      minuteEl.textContent = minute;

      const description = document.createElement("div");
      description.className = "event-description";

      const playerName = typeof player === "object"
        ? first(player.name, player.player_name, "")
        : player;

      description.textContent =
        `${label}${playerName ? ` · ${playerName}` : ""}`;

      if (assist) {
        const small = document.createElement("small");

        small.textContent = `Asist: ${
          typeof assist === "object"
            ? first(assist.name, assist.player_name, "")
            : assist
        }`;

        description.appendChild(small);
      }

      const eventIcon = document.createElement("div");
      eventIcon.className = "event-side";
      eventIcon.textContent = icon;

      row.append(minuteEl, description, eventIcon);
      container.appendChild(row);
    });
  }

  // =====================================
  // KADROLAR - SADECE OYUNCU İSİMLERİ
  // =====================================

  function normalizePlayer(player) {
    return typeof player === "string" ? { name: player } : (player || {});
  }

  function renderPlayerList(containerId, players) {
    const container = $(containerId);
    if (!container) return;

    container.replaceChildren();

    if (!Array.isArray(players) || !players.length) {
      container.innerHTML =
        '<div class="empty-state">Kadro bilgisi bulunamadı.</div>';
      return;
    }

    players.forEach(item => {
      const player = normalizePlayer(item);
      const name = getPlayerName(player);

      const row = document.createElement("div");
      row.className = "player-row";

      const nameEl = document.createElement("span");
      nameEl.className = "player-name";
      nameEl.textContent = name;

      row.appendChild(nameEl);
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

  // =====================================
  // İSTATİSTİKLER
  // =====================================

  function normalizeStats(detail) {
    const match = detail.match || detail;

    const candidates = [
      detail.statistics,
      detail.stats,
      detail.match_statistics,
      detail.matchStats,
      match.statistics,
      match.stats,
      match.match_statistics
    ];

    for (const candidate of candidates) {
      if (Array.isArray(candidate)) {
        return candidate.map(item => ({
          name: first(
            item.name,
            item.type,
            item.title,
            item.label,
            "İstatistik"
          ),
          home: first(
            item.home,
            item.home_value,
            item.home_team,
            item.value_home
          ),
          away: first(
            item.away,
            item.away_value,
            item.away_team,
            item.value_away
          )
        })).filter(item =>
          item.home !== undefined || item.away !== undefined
        );
      }

      if (candidate && typeof candidate === "object") {
        const homeStats = candidate.home || candidate.home_stats;
        const awayStats = candidate.away || candidate.away_stats;

        if (Array.isArray(homeStats) && Array.isArray(awayStats)) {
          return homeStats.map((item, index) => ({
            name: first(item.name, item.type, item.title, "İstatistik"),
            home: first(item.value, item.total, item.count),
            away: first(
              awayStats[index]?.value,
              awayStats[index]?.total,
              awayStats[index]?.count
            )
          })).filter(item =>
            item.home !== undefined || item.away !== undefined
          );
        }
      }
    }

    return [];
  }

  function renderStats(detail) {
    const container = $("statisticsList");
    if (!container) return;

    container.replaceChildren();

    const stats = normalizeStats(detail);

    if (!stats.length) {
      container.innerHTML =
        '<div class="empty-state">Bu maç için istatistik verisi henüz sağlanmamış.</div>';
      return;
    }

    stats.forEach(stat => {
      const home = first(stat.home, stat.home_value, "-");
      const away = first(stat.away, stat.away_value, "-");

      const parse = val => {
        const n = Number(String(val).replace("%", "").replace(",", "."));
        return Number.isFinite(n) && n >= 0 ? n : null;
      };

      const h = parse(home);
      const a = parse(away);

      let hw = 50;
      let aw = 50;

      if (h !== null && a !== null && h + a > 0) {
        hw = h / (h + a) * 100;
        aw = 100 - hw;
      }

      const row = document.createElement("div");
      row.className = "stat-row";

      const label = document.createElement("div");
      label.className = "stat-label";
      label.textContent = value(stat.name, "İstatistik");

      const values = document.createElement("div");
      values.className = "stat-values";

      const homeEl = document.createElement("span");
      homeEl.textContent = value(home);

      const bars = document.createElement("div");
      bars.className = "stat-bars";

      const homeBar = document.createElement("div");
      homeBar.className = "stat-home";
      homeBar.style.width = `${hw}%`;

      const awayBar = document.createElement("div");
      awayBar.className = "stat-away";
      awayBar.style.width = `${aw}%`;

      const awayEl = document.createElement("span");
      awayEl.textContent = value(away);

      bars.append(homeBar, awayBar);
      values.append(homeEl, bars, awayEl);
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
  // TAKIM MAÇLARI
  // =====================================

  function renderTeamMatches(matches) {
    const container = $("teamMatches");
    if (!container) return;

    container.replaceChildren();

    if (!matches.length) {
      container.innerHTML =
        '<div class="empty-state">Bu takım için maç kaydı bulunamadı.</div>';
      return;
    }

    matches.forEach(match => {
      const homeObj = match.home_team || {};
      const awayObj = match.away_team || {};

      const home = first(
        match.home,
        match.home_name,
        homeObj.name,
        match.home_team_name,
        "Ev sahibi"
      );

      const away = first(
        match.away,
        match.away_name,
        awayObj.name,
        match.away_team_name,
        "Deplasman"
      );

      const homeLogo = first(
        match.home_logo,
        homeObj.logo,
        match.home_team_logo
      );

      const awayLogo = first(
        match.away_logo,
        awayObj.logo,
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
        link.href =
          `/veri.html?view=match&slug=${encodeURIComponent(matchSlug)}`;
      } else {
        link.href = "#";
        link.addEventListener("click", event => event.preventDefault());
      }

      const homeSide = document.createElement("div");
      homeSide.className = "team-match-side";

      const homeImage = document.createElement("img");
      homeImage.alt = "";

      const safeHome = cleanImageUrl(homeLogo);

      if (safeHome) homeImage.src = safeHome;
      else homeImage.hidden = true;

      const homeText = document.createElement("span");
      homeText.textContent = value(home, "Ev sahibi");

      homeSide.append(homeImage, homeText);

      const score = document.createElement("div");
      score.className = "team-match-score";
      score.textContent = `${homeScore} - ${awayScore}`;

      const scoreStatus = document.createElement("small");
      scoreStatus.textContent = value(status);

      score.appendChild(scoreStatus);

      const awaySide = document.createElement("div");
      awaySide.className = "team-match-side away";

      const awayText = document.createElement("span");
      awayText.textContent = value(away, "Deplasman");

      const awayImage = document.createElement("img");
      awayImage.alt = "";

      const safeAway = cleanImageUrl(awayLogo);

      if (safeAway) awayImage.src = safeAway;
      else awayImage.hidden = true;

      awaySide.append(awayText, awayImage);

      link.append(homeSide, score, awaySide);
      container.appendChild(link);
    });
  }

  // =====================================
  // TAKIM KADROSU
  // SADECE İSİMLER GÖSTERİLİR
  // =====================================

  function findSquad(data, team) {
    return array(
      data.squad,
      data.players,
      data.roster,
      data.squad_players,
      data.team_players,
      team.squad,
      team.players,
      team.roster,
      team.squad_players
    );
  }

  function renderSquad(players) {
    const container = $("teamSquad");
    if (!container) return;

    container.replaceChildren();

    if (!players.length) {
      container.innerHTML =
        '<div class="empty-state">Bu takım için kadro bilgisi bulunamadı.</div>';

      setText("squadCount", "Kadro verisi yok");
      return;
    }

    setText("squadCount", `${players.length} oyuncu`);

    players.forEach(item => {
      const player = normalizePlayer(item);
      const name = getPlayerName(player);

      const row = document.createElement("div");
      row.className = "squad-name";

      const nameEl = document.createElement("span");
      nameEl.textContent = name;

      row.appendChild(nameEl);
      container.appendChild(row);
    });
  }

  function renderTeamPage(data) {
    const team = first(data.team, data.club, data, {});

    const name = first(team.name, team.team_name, team.title);
    const logo = first(team.logo, team.team_logo, team.image);

    const league = first(
      team.league_name,
      team.competition_name,
      typeof team.league === "string" ? team.league : team.league?.name,
      data.league_name
    );

    const coach = first(
      team.coach?.name,
      team.coach_name,
      team.manager_name,
      typeof team.manager === "string" ? team.manager : team.manager?.name
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
    setText("teamCoach", coach, "Bilgi sağlanmadı");
    setText("teamStadium", stadium, "Bilgi sağlanmadı");

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
    renderSquad(findSquad(data, team));

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
  // OYUNCU PROFİLİ
  // =====================================

  function getPlayerObject(data) {
    return first(
      data.player,
      data.athlete,
      data.profile,
      data
    );
  }

  function renderPlayerPage(data) {
    const player = getPlayerObject(data);

    const name = first(
      player.name,
      player.player_name,
      player.full_name,
      player.title
    );

    if (!name) {
      throw new Error("Oyuncu profili API yanıtında bulunamadı.");
    }

    const photo = first(
      player.logo,
      player.image,
      player.photo,
      player.picture,
      player.player_logo
    );

    const team = first(
      player.team?.name,
      player.team_name,
      typeof player.team === "string" ? player.team : null,
      player.club?.name
    );

    const position = first(
      player.position,
      player.position_name,
      player.role
    );

    const number = first(
      player.number,
      player.shirt_number,
      player.jersey_number
    );

    const nationality = first(
      player.nationality,
      player.country,
      player.country_name
    );

    const age = first(player.age);
    const birth = first(
      player.birth_date,
      player.date_of_birth,
      player.birthday
    );

    const height = first(player.height);

    setText("playerName", name);
    setText("playerTeam", team, "Takım bilgisi bulunamadı");
    setText("playerPosition", position, "Pozisyon bilgisi yok");

    setText(
      "playerNumber",
      number !== undefined ? `#${number}` : "Forma numarası yok"
    );

    setText("playerNationality", nationality);
    setText("playerAge", age);
    setText("playerBirth", birth ? formatDate(birth) : "-");
    setText("playerHeight", height);
    setText("playerPositionInfo", position);
    setText("playerTeamInfo", team);

    setImage("playerPhoto", photo, name);

    const photoEl = $("playerPhoto");
    const fallback = $("playerPhotoFallback");

    if (photoEl && fallback) {
      fallback.classList.toggle("hidden", Boolean(cleanImageUrl(photo)));

      photoEl.addEventListener("load", () => {
        fallback.classList.add("hidden");
      }, { once: true });

      photoEl.addEventListener("error", () => {
        fallback.classList.remove("hidden");
      }, { once: true });
    }

    const teamSlug = first(
      player.team?.slug,
      player.team_slug,
      player.club?.slug
    );

    const teamLink = $("playerTeamLink");

    if (teamLink && teamSlug) {
      teamLink.href =
        `/veri.html?view=team&slug=${encodeURIComponent(teamSlug)}`;

      teamLink.classList.remove("hidden");
    } else {
      teamLink?.classList.add("hidden");
    }

    setText("breadcrumbCurrent", "Oyuncu Profili");

    document.title = `${name} | SPORIX`;
  }

  async function loadPlayer() {
    if (!slug) {
      showError("Oyuncu bağlantısında slug bilgisi bulunamadı.");
      return;
    }

    showLoading();

    try {
      const data = await request(
        `/api/sportscore?action=player&slug=${encodeURIComponent(slug)}`
      );

      if (!data || typeof data !== "object") {
        throw new Error("Oyuncu verisi bulunamadı.");
      }

      renderPlayerPage(data);
      showPage("player");
    } catch (error) {
      console.error("SPORIX oyuncu profili:", error);
      showError(error.message || "Oyuncu bilgileri alınamadı.");
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

  $("retryButton")?.addEventListener("click", () => {
    if (view === "team") loadTeam();
    else if (view === "player") loadPlayer();
    else loadMatch();
  });

  setupTabs();

  if (view === "team") {
    loadTeam();
  } else if (view === "player") {
    loadPlayer();
  } else if (view === "match") {
    loadMatch();
  } else {
    showError("Geçersiz sayfa türü.");
  }
})();
