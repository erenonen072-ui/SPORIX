"use strict";

document.addEventListener("DOMContentLoaded", () => {
  const page = document.body.dataset.page;
  const results = document.getElementById("pageResults");
  const year = document.getElementById("currentYear");
  const menuButton = document.getElementById("mobileMenuButton");
  const mainNav = document.getElementById("mainNav");

  if (year) year.textContent = new Date().getFullYear();

  if (menuButton && mainNav) {
    menuButton.addEventListener("click", () => {
      const open = mainNav.classList.toggle("open");
      menuButton.setAttribute("aria-expanded", String(open));
      menuButton.textContent = open ? "✕" : "☰";
    });
  }

  if (page === "matches") {
    loadMatches();

    document.getElementById("refreshButton")
      ?.addEventListener("click", loadMatches);
  }

  if (page === "standings") {
    const select = document.getElementById("competitionSelect");

    document.getElementById("loadButton")
      ?.addEventListener("click", loadStandings);

    select?.addEventListener("change", loadStandings);

    loadStandings();
  }

  if (page === "fixtures") {
    const form = document.getElementById("fixtureForm");

    form?.addEventListener("submit", event => {
      event.preventDefault();
      loadFixtures();
    });

    loadFixtures();
  }

  // =====================================
  // API İSTEKLERİ
  // =====================================

  async function requestJSON(url) {
    const response = await fetch(url, {
      method: "GET",
      cache: "no-store",
      headers: { Accept: "application/json" }
    });

    if (!response.ok) {
      throw new Error(`Sunucu hatası: ${response.status}`);
    }

    const json = await response.json();

    if (json.success === false) {
      throw new Error(json.error || "Veri alınamadı.");
    }

    return json;
  }

  function showMessage(message, className = "sp-empty") {
    if (!results) return;

    results.replaceChildren();

    const box = document.createElement("div");
    box.className = className;
    box.textContent = message;

    results.appendChild(box);
  }

  function loading(message = "Veriler yükleniyor...") {
    showMessage(message, "sp-loading");
  }

  function unwrap(data) {
    let current = data;

    for (let i = 0; i < 4; i++) {
      if (
        !current ||
        typeof current !== "object" ||
        Array.isArray(current)
      ) break;

      const next =
        current.data ??
        current.result ??
        current.response ??
        current.payload;

      if (!next || next === current) break;

      current = next;
    }

    return current;
  }

  function findArray(data, preferredKeys = []) {
    const root = unwrap(data);

    if (Array.isArray(root)) return root;

    if (!root || typeof root !== "object") return [];

    for (const key of preferredKeys) {
      if (Array.isArray(root[key])) return root[key];
    }

    for (const value of Object.values(root)) {
      if (Array.isArray(value) && value.length) return value;
    }

    return [];
  }

  function make(tag, className, text) {
    const element = document.createElement(tag);

    if (className) element.className = className;

    if (text !== undefined && text !== null) {
      element.textContent = String(text);
    }

    return element;
  }

  // =====================================
  // LOGO
  // =====================================

  function safeLogo(value) {
    if (typeof value !== "string") return "";

    const url = value.trim();

    return /^https?:\/\//i.test(url) ? url : "";
  }

  // =====================================
  // TÜRKÇE TAKIM İSİMLERİ
  // =====================================

  const TURKISH_TEAM_NAMES = {
    // TÜRKİYE
    "Fenerbahce": "Fenerbahçe",
    "Fenerbahçe": "Fenerbahçe",
    "Besiktas": "Beşiktaş",
    "Beşiktaş": "Beşiktaş",
    "Galatasaray": "Galatasaray",
    "Trabzonspor": "Trabzonspor",
    "Basaksehir": "Başakşehir",
    "Istanbul Basaksehir": "Başakşehir",
    "Başakşehir": "Başakşehir",
    "Goztepe": "Göztepe",
    "Göztepe": "Göztepe",
    "Eyupspor": "Eyüpspor",
    "Eyüpspor": "Eyüpspor",
    "Caykur Rizespor": "Çaykur Rizespor",
    "Rizespor": "Çaykur Rizespor",
    "Kasimpasa": "Kasımpaşa",
    "Kasımpaşa": "Kasımpaşa",

    // İNGİLTERE
    "Manchester United": "Manchester United",
    "Manchester City": "Manchester City",
    "Liverpool": "Liverpool",
    "Arsenal": "Arsenal",
    "Chelsea": "Chelsea",
    "Tottenham Hotspur": "Tottenham",
    "Tottenham": "Tottenham",
    "Newcastle United": "Newcastle United",
    "West Ham United": "West Ham United",
    "Aston Villa": "Aston Villa",
    "Nottingham Forest": "Nottingham Forest",
    "Brighton and Hove Albion": "Brighton",
    "Brighton": "Brighton",

    // İSPANYA
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

    // ALMANYA
    "Bayern Munich": "Bayern Münih",
    "Bayern München": "Bayern Münih",
    "Borussia Dortmund": "Borussia Dortmund",
    "Bayer Leverkusen": "Bayer Leverkusen",
    "RB Leipzig": "RB Leipzig",
    "Eintracht Frankfurt": "Eintracht Frankfurt",
    "VfB Stuttgart": "VfB Stuttgart",
    "Wolfsburg": "Wolfsburg",

    // İTALYA
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

    // FRANSA
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

    // HOLLANDA
    "Ajax": "Ajax",
    "PSV Eindhoven": "PSV Eindhoven",
    "Feyenoord": "Feyenoord"
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

    if (!name) return "Takım";

    return TURKISH_TEAM_NAMES[name] || name;
  }

  // =====================================
  // TAKIM LOGOLARI
  // =====================================

  function teamLogo(value, match, side) {
    if (side === "home") {
      return safeLogo(
        match.home_logo ||
        match.homeLogo ||
        (typeof value === "object" && value
          ? value.logo || value.image || value.crest
          : "")
      );
    }

    return safeLogo(
      match.away_logo ||
      match.awayLogo ||
      (typeof value === "object" && value
        ? value.logo || value.image || value.crest
        : "")
    );
  }

  // =====================================
  // MAÇ TARİHİ
  // =====================================

  function matchDate(match) {
    return match.time ||
      match.startTime ||
      match.start_time ||
      match.datetime ||
      match.date ||
      match.timestamp ||
      match.kickoff ||
      "";
  }

  function formattedDate(value) {
    if (!value) return "Tarih belirtilmedi";

    const date = typeof value === "number"
      ? new Date(value < 10000000000 ? value * 1000 : value)
      : new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "Tarih belirtilmedi";
    }

    return date.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul"
    });
  }

  // =====================================
  // MAÇ DURUMLARI
  // =====================================

  function matchStatus(match) {
    const raw = String(
      match.status?.name ||
      match.status?.type ||
      match.status ||
      match.state ||
      match.status_text ||
      ""
    ).toLowerCase();

    if (
      raw.includes("live") ||
      raw.includes("progress") ||
      raw.includes("in_play") ||
      raw === "1h" ||
      raw === "2h"
    ) return "CANLI";

    if (
      raw.includes("finish") ||
      raw.includes("ended") ||
      raw.includes("complete") ||
      raw === "ft"
    ) return "BİTTİ";

    if (raw.includes("postponed")) return "ERTELENDİ";

    if (raw.includes("cancel")) return "İPTAL";

    return "BAŞLAMADI";
  }

  // =====================================
  // MAÇ KARTLARI
  // =====================================

  function renderMatch(match) {
    const homeValue =
      match.home ||
      match.homeTeam ||
      match.home_team;

    const awayValue =
      match.away ||
      match.awayTeam ||
      match.away_team;

    const home = teamName(homeValue);
    const away = teamName(awayValue);

    const homeScore =
      match.home_score ??
      match.homeScore ??
      match.scores?.home;

    const awayScore =
      match.away_score ??
      match.awayScore ??
      match.scores?.away;

    const status = matchStatus(match);

    const row = make("article", "sp-match");

    const top = make("div", "sp-match-top");

    top.append(
      make(
        "span",
        status === "CANLI" ? "sp-status live" : "sp-status",
        status
      ),
      make(
        "span",
        "sp-match-date",
        formattedDate(matchDate(match))
      )
    );

    const teams = make("div", "sp-match-teams");

    function addTeam(name, logo, side) {
      const item = make("div", `sp-team ${side}`);

      const imageURL = safeLogo(logo);

      if (imageURL) {
        const image = make("img", "sp-team-logo");

        image.src = imageURL;
        image.alt = name;
        image.loading = "lazy";
        image.onerror = () => image.remove();

        item.appendChild(image);
      }

      item.appendChild(
        make("span", "sp-team-name", name)
      );

      return item;
    }

    teams.append(
      addTeam(
        home,
        teamLogo(homeValue, match, "home"),
        "home"
      ),

      make(
        "div",
        "sp-score",
        homeScore !== undefined && awayScore !== undefined
          ? `${homeScore} - ${awayScore}`
          : "VS"
      ),

      addTeam(
        away,
        teamLogo(awayValue, match, "away"),
        "away"
      )
    );

    row.append(top, teams);

    const slug =
      match.slug ||
      match.match_slug ||
      match.url_slug;

    if (slug && /^[a-z0-9-]+$/i.test(slug)) {
      const link = make(
        "a",
        "sp-detail-link",
        "Maç detayları →"
      );

      link.href =
        `/veri.html?view=match&slug=${encodeURIComponent(slug)}`;

      row.appendChild(link);
    }

    return row;
  }

  // =====================================
  // MAÇ LİSTESİ
  // =====================================

  function renderMatchList(data, preferredKeys) {
    if (!results) return;

    const matches = findArray(data, preferredKeys);

    if (!matches.length) {
      showMessage("Bu istekte gösterilebilecek maç bulunamadı.");
      return;
    }

    results.replaceChildren();

    matches.forEach(match => {
      if (match && typeof match === "object") {
        results.appendChild(renderMatch(match));
      }
    });

    if (!results.children.length) {
      showMessage("Maç verileri görüntülenemedi.");
    }
  }

  // =====================================
  // MAÇLARI YÜKLE
  // =====================================

  async function loadMatches() {
    loading("Maçlar yükleniyor...");

    const updated = document.getElementById("matchesUpdated");

    try {
      const data = await requestJSON("/api/matches?limit=50");

      renderMatchList(data, [
        "matches",
        "fixtures",
        "results"
      ]);

      if (updated) {
        updated.textContent =
          `Son kontrol: ${new Date().toLocaleTimeString("tr-TR")}`;
      }

    } catch (error) {
      console.error("SPORIX maçlar:", error);

      showMessage(
        "Maçlar şu anda yüklenemedi. Biraz sonra tekrar dene."
      );

      if (updated) {
        updated.textContent = "Veri bağlantısı kurulamadı.";
      }
    }
  }

  // =====================================
  // SPORIX PUAN DURUMU
  // =====================================

  let standingsRequestId = 0;

  function renderStandings(data) {
    const rows = Array.isArray(data.standings)
      ? data.standings
      : [];

    if (!rows.length) {
      showMessage("Bu lig için puan durumu bulunamadı.");
      return;
    }

    const wrapper = make("div", "sp-standings-wrap");

    const table = make(
      "table",
      "sp-table sp-standings-table"
    );

    const thead = document.createElement("thead");
    const header = document.createElement("tr");

    [
      "#", "Takım", "O", "G", "B", "M",
      "AG", "YG", "AV", "P"
    ].forEach(title => {
      header.appendChild(make("th", "", title));
    });

    thead.appendChild(header);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    rows.forEach((row, index) => {
      const tr = document.createElement("tr");

      const position = row.pos ?? index + 1;
      const name = teamName(row.team);
      const logoURL = safeLogo(row.team_logo);

      const rankCell = make(
        "td",
        "sp-rank-cell",
        position
      );

      if (Number(position) <= 4) {
        rankCell.classList.add("top-four");
      }

      const teamCell = make("td", "sp-team-cell");

      const teamInfo = make(
        "div",
        "sp-standings-team"
      );

      if (logoURL) {
        const image = make("img", "sp-standings-logo");

        image.src = logoURL;
        image.alt = name;
        image.loading = "lazy";
        image.onerror = () => image.remove();

        teamInfo.appendChild(image);
      }

      teamInfo.appendChild(
        make("span", "sp-standings-name", name)
      );

      teamCell.appendChild(teamInfo);

      const values = [
        rankCell,
        teamCell,
        make("td", "", row.p ?? "—"),
        make("td", "", row.w ?? "—"),
        make("td", "", row.d ?? "—"),
        make("td", "", row.l ?? "—"),
        make("td", "", row.gf ?? "—"),
        make("td", "", row.ga ?? "—"),
        make("td", "sp-goal-difference", row.gd ?? "—"),
        make("td", "sp-points-cell", row.pts ?? "—")
      ];

      values.forEach(cell => tr.appendChild(cell));

      if (row.promo_name) {
        tr.title = row.promo_name;
        tr.dataset.promotion = row.promo_name;
      }

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    wrapper.appendChild(table);

    results.replaceChildren(wrapper);

    const updated = document.getElementById("standingsUpdated");

    if (updated) {
      updated.textContent = data.updated
        ? `Son güncelleme: ${new Date(data.updated).toLocaleString("tr-TR")}`
        : "";
    }
  }

  async function loadStandings() {
    const select = document.getElementById("competitionSelect");

    if (!select || !results) return;

    const slug = select.value;

    if (!slug) return;

    const requestId = ++standingsRequestId;

    const title = document.getElementById("tableTitle");

    if (title) {
      title.textContent =
        select.options[select.selectedIndex].text;
    }

    const button = document.getElementById("loadButton");

    if (button) {
      button.disabled = true;
      button.textContent = "Yükleniyor...";
    }

    loading("Puan tablosu yükleniyor...");

    try {
      const data = await requestJSON(
        `/api/standings?league=${encodeURIComponent(slug)}`
      );

      if (requestId !== standingsRequestId) return;

      renderStandings(data);

    } catch (error) {
      if (requestId !== standingsRequestId) return;

      console.error("SPORIX puan durumu:", error);

      showMessage(
        error.message || "Puan durumu alınamadı."
      );

    } finally {
      if (requestId === standingsRequestId && button) {
        button.disabled = false;
        button.textContent = "Tabloyu Getir";
      }
    }
  }

  // =====================================
  // TAKIM FİKSTÜRÜ
  // =====================================

  async function loadFixtures() {
    const input = document.getElementById("teamSlug");

    const slug = input?.value.trim();

    if (!slug || !/^[a-z0-9-]+$/i.test(slug)) {
      showMessage("Geçerli bir takım slug bilgisi gir.");
      return;
    }

    loading("Takım fikstürü yükleniyor...");

    try {
      const data = await requestJSON(
        `/api/sportscore?action=team&slug=${encodeURIComponent(slug)}&limit=30`
      );

      renderMatchList(data, [
        "matches",
        "fixtures",
        "schedule",
        "events",
        "results"
      ]);

    } catch (error) {
      console.error("SPORIX fikstür:", error);

      showMessage(
        "Bu takımın fikstürü alınamadı. Takım slug bilgisini kontrol et."
      );
    }
  }

});
