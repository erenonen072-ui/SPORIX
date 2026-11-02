// =============================================
// SPORIX - ALT SAYFALAR
// Maçlar | Puan Durumu | Takım Fikstürü
// =============================================

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  const results = document.getElementById("pageResults");

  // Yıl
  const yearElement = document.getElementById("currentYear");

  if (yearElement) {
    yearElement.textContent = new Date().getFullYear();
  }

  // Mobil menü
  const menuButton = document.getElementById("menuToggle");
  const navigation = document.querySelector(".main-nav");

  if (menuButton && navigation) {
    menuButton.addEventListener("click", () => {
      navigation.classList.toggle("active");
    });
  }

  // Sayfa türüne göre başlat
  if (page === "matches") {
    loadMatches();

    const refreshButton = document.getElementById("refreshMatches");

    if (refreshButton) {
      refreshButton.addEventListener("click", loadMatches);
    }
  }

  if (page === "standings") {
    const loadButton = document.getElementById("loadStandings");

    if (loadButton) {
      loadButton.addEventListener("click", loadStandings);
    }

    loadStandings();
  }

  if (page === "fixtures") {
    const fixtureForm = document.getElementById("fixtureForm");

    if (fixtureForm) {
      fixtureForm.addEventListener("submit", event => {
        event.preventDefault();
        loadFixtures();
      });
    }
  }

  // =============================================
  // API İSTEKLERİ
  // =============================================

  async function requestJSON(url) {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: {
        Accept: "application/json"
      }
    });

    if (!response.ok) {
      throw new Error(`API hatası: ${response.status}`);
    }

    const json = await response.json();

    if (json.success === false) {
      throw new Error(json.message || "Veriler alınamadı.");
    }

    return json;
  }

  function unwrap(data) {
    let current = data;

    for (let i = 0; i < 5; i++) {
      if (!current || typeof current !== "object") break;

      if (current.data !== undefined) {
        current = current.data;
        continue;
      }

      if (current.result !== undefined) {
        current = current.result;
        continue;
      }

      break;
    }

    return current;
  }

  function findArray(data, preferredKeys = []) {
    const current = unwrap(data);

    if (Array.isArray(current)) {
      return current;
    }

    if (!current || typeof current !== "object") {
      return [];
    }

    for (const key of preferredKeys) {
      if (Array.isArray(current[key])) {
        return current[key];
      }
    }

    for (const value of Object.values(current)) {
      if (Array.isArray(value)) {
        return value;
      }
    }

    return [];
  }

  // =============================================
  // TÜRKÇE TAKIM İSİMLERİ
  // =============================================

  const TURKISH_TEAM_NAMES = {
    // Almanya
    "Bayern Munich": "Bayern Münih",
    "Bayern München": "Bayern Münih",
    "Borussia Dortmund": "Borussia Dortmund",
    "Bayer Leverkusen": "Bayer Leverkusen",
    "RB Leipzig": "RB Leipzig",
    "Eintracht Frankfurt": "Eintracht Frankfurt",
    "VfB Stuttgart": "VfB Stuttgart",
    "Wolfsburg": "Wolfsburg",

    // İspanya
    "Barcelona": "Barselona",
    "FC Barcelona": "Barselona",
    "Atletico Madrid": "Atletico Madrid",
    "Atlético Madrid": "Atletico Madrid",
    "Atlético de Madrid": "Atletico Madrid",
    "Real Madrid": "Real Madrid",
    "Sevilla": "Sevilla",
    "Valencia": "Valencia",
    "Real Sociedad": "Real Sociedad",
    "Athletic Bilbao": "Athletic Bilbao",
    "Villarreal": "Villarreal",
    "Girona": "Girona",

    // İngiltere
    "Manchester United": "Manchester United",
    "Manchester City": "Manchester City",
    "Liverpool": "Liverpool",
    "Chelsea": "Chelsea",
    "Arsenal": "Arsenal",
    "Tottenham Hotspur": "Tottenham",
    "Tottenham": "Tottenham",
    "Newcastle United": "Newcastle United",
    "West Ham United": "West Ham United",
    "Aston Villa": "Aston Villa",
    "Everton": "Everton",
    "Brighton": "Brighton",
    "Crystal Palace": "Crystal Palace",
    "Nottingham Forest": "Nottingham Forest",

    // İtalya
    "Inter Milan": "Inter",
    "Internazionale": "Inter",
    "Inter": "Inter",
    "AC Milan": "Milan",
    "Milan": "Milan",
    "Juventus": "Juventus",
    "Napoli": "Napoli",
    "AS Roma": "Roma",
    "Roma": "Roma",
    "Lazio": "Lazio",
    "Atalanta": "Atalanta",
    "Fiorentina": "Fiorentina",
    "Bologna": "Bologna",
    "Torino": "Torino",

    // Fransa
    "Paris Saint-Germain": "Paris Saint-Germain",
    "PSG": "Paris Saint-Germain",
    "Olympique Marseille": "Marsilya",
    "Olympique de Marseille": "Marsilya",
    "Marseille": "Marsilya",
    "Olympique Lyon": "Lyon",
    "Olympique Lyonnais": "Lyon",
    "Lyon": "Lyon",
    "Monaco": "Monaco",
    "Lille": "Lille",
    "Nice": "Nice",

    // Hollanda
    "Ajax": "Ajax",
    "PSV Eindhoven": "PSV Eindhoven",
    "Feyenoord": "Feyenoord",

    // Türkiye
    "Galatasaray": "Galatasaray",
    "Fenerbahce": "Fenerbahçe",
    "Fenerbahçe": "Fenerbahçe",
    "Besiktas": "Beşiktaş",
    "Beşiktaş": "Beşiktaş",
    "Trabzonspor": "Trabzonspor",
    "Basaksehir": "Başakşehir",
    "Başakşehir": "Başakşehir",
    "Istanbul Basaksehir": "Başakşehir",
    "Samsunspor": "Samsunspor",
    "Goztepe": "Göztepe",
    "Göztepe": "Göztepe",
    "Eyupspor": "Eyüpspor",
    "Eyüpspor": "Eyüpspor",
    "Konyaspor": "Konyaspor",
    "Antalyaspor": "Antalyaspor",
    "Alanyaspor": "Alanyaspor",
    "Rizespor": "Çaykur Rizespor",
    "Caykur Rizespor": "Çaykur Rizespor",
    "Kayserispor": "Kayserispor",
    "Gaziantep FK": "Gaziantep FK",
    "Kasimpasa": "Kasımpaşa",
    "Kasımpaşa": "Kasımpaşa",
    "Hatayspor": "Hatayspor",
    "Sivasspor": "Sivasspor"
  };

  function teamName(value) {
    let name = "";

    if (typeof value === "string") {
      name = value;
    } else if (value && typeof value === "object") {
      name =
        value.name ||
        value.shortName ||
        value.short_name ||
        value.title ||
        "";
    }

    name = String(name).trim();

    if (!name) {
      return "Takım";
    }

    return TURKISH_TEAM_NAMES[name] || name;
  }

  // =============================================
  // LOGO
  // =============================================

  function safeLogo(url) {
    if (!url || typeof url !== "string") {
      return "";
    }

    if (!/^https?:\/\//i.test(url) && !url.startsWith("/")) {
      return "";
    }

    return url;
  }

  function teamLogo(team) {
    if (!team || typeof team !== "object") {
      return "";
    }

    return safeLogo(
      team.logo ||
      team.image ||
      team.image_url ||
      team.logo_url ||
      team.crest ||
      team.team_logo ||
      ""
    );
  }

  function logoHTML(team) {
    const logo = teamLogo(team);

    if (!logo) {
      return `<span class="sp-team-placeholder">⚽</span>`;
    }

    return `
      <img
        class="sp-team-logo"
        src="${escapeHTML(logo)}"
        alt="${escapeHTML(teamName(team))}"
        loading="lazy"
        onerror="this.style.display='none'"
      >
    `;
  }

  // =============================================
  // TARİH
  // =============================================

  function matchDate(match) {
    return (
      match.date ||
      match.match_date ||
      match.start_time ||
      match.datetime ||
      match.timestamp ||
      ""
    );
  }

  function formattedDate(value) {
    if (!value) {
      return "Tarih belirtilmedi";
    }

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return String(value);
    }

    return new Intl.DateTimeFormat("tr-TR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul"
    }).format(date);
  }

  // =============================================
  // MAÇ DURUMU
  // =============================================

  function matchStatus(match) {
    const status = String(
      match.status ||
      match.match_status ||
      match.state ||
      ""
    ).toLowerCase();

    const statusText = String(
      match.status_text ||
      match.statusText ||
      ""
    ).toLowerCase();

    if (
      status.includes("live") ||
      status.includes("playing") ||
      status.includes("in_progress") ||
      statusText.includes("live")
    ) {
      return "CANLI";
    }

    if (
      status.includes("finished") ||
      status.includes("complete") ||
      status.includes("ended") ||
      statusText.includes("finished")
    ) {
      return "BİTTİ";
    }

    if (
      status.includes("postponed") ||
      statusText.includes("postponed")
    ) {
      return "ERTELENDİ";
    }

    if (
      status.includes("cancelled") ||
      status.includes("canceled")
    ) {
      return "İPTAL";
    }

    return "BAŞLAMADI";
  }

  // =============================================
  // GÜVENLİ HTML
  // =============================================

  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => {
      const entities = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };

      return entities[char];
    });
  }

  // =============================================
  // MAÇ KARTI
  // =============================================

  function renderMatch(match) {
    const home = match.home || match.home_team || match.homeTeam || {};
    const away = match.away || match.away_team || match.awayTeam || {};

    const homeName = teamName(home);
    const awayName = teamName(away);

    const homeScore =
      match.home_score ??
      match.homeScore ??
      match.score?.home ??
      "-";

    const awayScore =
      match.away_score ??
      match.awayScore ??
      match.score?.away ??
      "-";

    const status = matchStatus(match);
    const date = formattedDate(matchDate(match));

    const slug =
      match.slug ||
      match.match_slug ||
      match.id ||
      "";

    const liveClass = status === "CANLI" ? "is-live" : "";

    return `
      <article class="sp-match-card ${liveClass}">

        <div class="sp-match-top">
          <span class="sp-match-date">
            ${escapeHTML(date)}
          </span>

          <span class="sp-match-status ${status === "CANLI" ? "live" : ""}">
            ${escapeHTML(status)}
          </span>
        </div>

        <div class="sp-match-content">

          <div class="sp-match-team">
            ${logoHTML(home)}

            <span class="sp-team-name">
              ${escapeHTML(homeName)}
            </span>
          </div>

          <div class="sp-match-score">
            <strong>${escapeHTML(homeScore)}</strong>
            <span>-</span>
            <strong>${escapeHTML(awayScore)}</strong>
          </div>

          <div class="sp-match-team away">
            ${logoHTML(away)}

            <span class="sp-team-name">
              ${escapeHTML(awayName)}
            </span>
          </div>

        </div>

        <div class="sp-match-bottom">
          ${
            slug
              ? `<a href="/veri.html?view=match&slug=${encodeURIComponent(slug)}">
                   Maç detayları →
                 </a>`
              : ""
          }
        </div>

      </article>
    `;
  }

  // =============================================
  // MAÇ LİSTESİ
  // =============================================

  function renderMatchList(matches) {
    if (!results) return;

    if (!matches.length) {
      results.innerHTML = `
        <div class="sp-empty">
          <span>⚽</span>
          <h3>Maç bulunamadı</h3>
          <p>Şu anda gösterilecek maç verisi yok.</p>
        </div>
      `;

      return;
    }

    results.innerHTML = matches
      .map(renderMatch)
      .join("");
  }

  // =============================================
  // MAÇLARI YÜKLE
  // =============================================

  async function loadMatches() {
    if (!results) return;

    results.innerHTML = `
      <div class="sp-loading">
        Maçlar yükleniyor...
      </div>
    `;

    try {
      const data = await requestJSON("/api/matches?limit=50");

      const matches = findArray(data, [
        "matches",
        "fixtures",
        "events",
        "results"
      ]);

      renderMatchList(matches);

    } catch (error) {
      console.error("SPORIX maç hatası:", error);

      results.innerHTML = `
        <div class="sp-error">
          <h3>Maçlar yüklenemedi</h3>
          <p>${escapeHTML(error.message)}</p>
          <button onclick="location.reload()">Tekrar dene</button>
        </div>
      `;
    }
  }

  // =============================================
  // PUAN DURUMU TABLOSU
  // =============================================

  function renderStandings(rows) {
    if (!results) return;

    if (!rows.length) {
      results.innerHTML = `
        <div class="sp-empty">
          <h3>Puan durumu bulunamadı</h3>
          <p>Seçilen lig için henüz veri alınamadı.</p>
        </div>
      `;

      return;
    }

    const tableRows = rows.map((row, index) => {
      const team = row.team || row.club || row;

      const position =
        row.pos ??
        row.position ??
        row.rank ??
        index + 1;

      const played =
        row.p ??
        row.played ??
        row.matches ??
        0;

      const wins =
        row.w ??
        row.wins ??
        0;

      const draws =
        row.d ??
        row.draws ??
        0;

      const losses =
        row.l ??
        row.losses ??
        0;

      const goalsFor =
        row.gf ??
        row.goals_for ??
        0;

      const goalsAgainst =
        row.ga ??
        row.goals_against ??
        0;

      const goalDifference =
        row.gd ??
        row.goal_difference ??
        (Number(goalsFor) - Number(goalsAgainst));

      const points =
        row.pts ??
        row.points ??
        0;

      return `
        <tr>
          <td class="sp-position">${escapeHTML(position)}</td>

          <td class="sp-standing-team">
            ${logoHTML(team)}
            <strong>${escapeHTML(teamName(team))}</strong>
          </td>

          <td>${escapeHTML(played)}</td>
          <td>${escapeHTML(wins)}</td>
          <td>${escapeHTML(draws)}</td>
          <td>${escapeHTML(losses)}</td>
          <td>${escapeHTML(goalsFor)}</td>
          <td>${escapeHTML(goalsAgainst)}</td>
          <td>${escapeHTML(goalDifference)}</td>
          <td class="sp-points">
            <strong>${escapeHTML(points)}</strong>
          </td>
        </tr>
      `;
    }).join("");

    results.innerHTML = `
      <div class="sp-table-wrapper">
        <table class="sp-standings-table">

          <thead>
            <tr>
              <th>#</th>
              <th>Takım</th>
              <th>O</th>
              <th>G</th>
              <th>B</th>
              <th>M</th>
              <th>AG</th>
              <th>YG</th>
              <th>AV</th>
              <th>P</th>
            </tr>
          </thead>

          <tbody>
            ${tableRows}
          </tbody>

        </table>
      </div>
    `;
  }

  // =============================================
  // PUAN DURUMUNU YÜKLE
  // =============================================

  async function loadStandings() {
    if (!results) return;

    const select = document.getElementById("competitionSelect");

    const league = select ? select.value : "turkish-super-league";

    if (!league) {
      results.innerHTML = `
        <div class="sp-empty">
          Lütfen bir lig seç.
        </div>
      `;

      return;
    }

    results.innerHTML = `
      <div class="sp-loading">
        Puan durumu yükleniyor...
      </div>
    `;

    try {
      const data = await requestJSON(
        `/api/standings?league=${encodeURIComponent(league)}`
      );

      const rows = findArray(data, [
        "standings",
        "table",
        "teams",
        "rows",
        "results"
      ]);

      renderStandings(rows);

    } catch (error) {
      console.error("SPORIX puan durumu hatası:", error);

      results.innerHTML = `
        <div class="sp-error">
          <h3>Puan durumu yüklenemedi</h3>
          <p>${escapeHTML(error.message)}</p>
        </div>
      `;
    }
  }

  // =============================================
  // TAKIM FİKSTÜRÜ
  // =============================================

  async function loadFixtures() {
    if (!results) return;

    const input = document.getElementById("teamSlug");

    const slug = input ? input.value.trim() : "";

    if (!slug) {
      results.innerHTML = `
        <div class="sp-error">
          Lütfen takım bağlantısını veya takım kodunu gir.
        </div>
      `;

      return;
    }

    results.innerHTML = `
      <div class="sp-loading">
        Takım fikstürü yükleniyor...
      </div>
    `;

    try {
      const data = await requestJSON(
        `/api/sportscore?action=team&slug=${encodeURIComponent(slug)}&limit=30`
      );

      const fixtures = findArray(data, [
        "fixtures",
        "matches",
        "events",
        "results"
      ]);

      renderMatchList(fixtures);

    } catch (error) {
      console.error("SPORIX fikstür hatası:", error);

      results.innerHTML = `
        <div class="sp-error">
          <h3>Fikstür yüklenemedi</h3>
          <p>${escapeHTML(error.message)}</p>
        </div>
      `;
    }
  }

});
