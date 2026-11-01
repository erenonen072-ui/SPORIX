
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
    document.getElementById("refreshButton")?.addEventListener("click", loadMatches);
  }

  if (page === "standings") {
    const select = document.getElementById("competitionSelect");
    document.getElementById("loadButton")?.addEventListener("click", loadStandings);
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
      if (!current || typeof current !== "object" || Array.isArray(current)) break;

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

  function safeLogo(value) {
    if (typeof value !== "string") return "";
    return /^https?:\/\//i.test(value.trim()) ? value.trim() : "";
  }

  function teamName(value) {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "Takım";

    return value.name ||
      value.shortName ||
      value.short_name ||
      value.title ||
      "Takım";
  }

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

    if (Number.isNaN(date.getTime())) return "Tarih belirtilmedi";

    return date.toLocaleString("tr-TR", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Europe/Istanbul"
    });
  }

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

  function renderMatch(match) {
    const homeValue = match.home || match.homeTeam || match.home_team;
    const awayValue = match.away || match.awayTeam || match.away_team;

    const home = teamName(homeValue);
    const away = teamName(awayValue);

    const homeScore = match.home_score ?? match.homeScore ?? match.scores?.home;
    const awayScore = match.away_score ?? match.awayScore ?? match.scores?.away;

    const status = matchStatus(match);
    const row = make("article", "sp-match");

    const top = make("div", "sp-match-top");
    top.append(
      make("span", status === "CANLI" ? "sp-status live" : "sp-status", status),
      make("span", "sp-match-date", formattedDate(matchDate(match)))
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

      item.appendChild(make("span", "sp-team-name", name));
      return item;
    }

    teams.append(
      addTeam(home, teamLogo(homeValue, match, "home"), "home"),
      make(
        "div",
        "sp-score",
        homeScore !== undefined && awayScore !== undefined
          ? `${homeScore} - ${awayScore}`
          : "VS"
      ),
      addTeam(away, teamLogo(awayValue, match, "away"), "away")
    );

    row.append(top, teams);

    const slug = match.slug || match.match_slug || match.url_slug;

    if (slug && /^[a-z0-9-]+$/i.test(slug)) {
      const link = make("a", "sp-detail-link", "Maç detayları →");
      link.href = `/veri.html?view=match&slug=${encodeURIComponent(slug)}`;
      row.appendChild(link);
    }

    return row;
  }

  function renderMatchList(data, preferredKeys) {
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

  async function loadMatches() {
    loading("Maçlar yükleniyor...");

    const updated = document.getElementById("matchesUpdated");

    try {
      const data = await requestJSON("/api/matches?limit=50");
      renderMatchList(data, ["matches", "fixtures", "results"]);

      if (updated) {
        updated.textContent = `Son kontrol: ${new Date().toLocaleTimeString("tr-TR")}`;
      }
    } catch (error) {
      console.error("SPORIX maçlar:", error);
      showMessage("Maçlar şu anda yüklenemedi. Biraz sonra tekrar dene.");
      if (updated) updated.textContent = "Veri bağlantısı kurulamadı.";
    }
  }

  function findStandingsRows(data) {
    const root = unwrap(data);

    const direct = findArray(root, [
      "standings",
      "table",
      "rows",
      "items",
      "teams",
      "entries"
    ]);

    if (direct.length) return direct;

    // Bazı lig API'leri grupları iç içe döndürebilir.
    const groups = findArray(root, ["groups", "tables", "standings"]);

    for (const group of groups) {
      if (Array.isArray(group)) return group;
      if (!group || typeof group !== "object") continue;

      const nested = findArray(group, [
        "table",
        "rows",
        "teams",
        "standings",
        "items"
      ]);

      if (nested.length) return nested;
    }

    return [];
  }

  function valueFrom(row, keys) {
    for (const key of keys) {
      const value = key.split(".").reduce((obj, part) => obj?.[part], row);
      if (value !== undefined && value !== null) return value;
    }
    return "—";
  }

  function renderStandings(data) {
    const rows = findStandingsRows(data);

    if (!rows.length) {
      showMessage("Puan tablosu bu lig için alınamadı. Lig kodunu veya API yanıtını kontrol et.");
      return;
    }

    const table = make("table", "sp-table");
    const thead = document.createElement("thead");
    const header = document.createElement("tr");

    ["Sıra", "Takım", "O", "G", "B", "M", "AV", "P"].forEach(title => {
      header.appendChild(make("th", "", title));
    });

    thead.appendChild(header);
    table.appendChild(thead);

    const tbody = document.createElement("tbody");

    rows.forEach((row, index) => {
      const tr = document.createElement("tr");

      const rank = valueFrom(row, [
        "position", "rank", "place", "overall.position"
      ]);

      const name = valueFrom(row, [
        "team.name", "team", "name", "participant.name", "title"
      ]);

      const played = valueFrom(row, [
        "played", "matches", "games", "all.played"
      ]);

      const won = valueFrom(row, [
        "won", "wins", "all.win"
      ]);

      const drawn = valueFrom(row, [
        "drawn", "draws", "all.draw"
      ]);

      const lost = valueFrom(row, [
        "lost", "losses", "all.lose"
      ]);

      const difference = valueFrom(row, [
        "goalDifference", "goal_difference", "goalsDiff", "gd"
      ]);

      const points = valueFrom(row, [
        "points", "pts", "total"
      ]);

      [
        rank === "—" ? index + 1 : rank,
        name,
        played,
        won,
        drawn,
        lost,
        difference,
        points
      ].forEach((value, cellIndex) => {
        const cell = make("td", cellIndex === 1 ? "sp-team-cell" : "", value);
        tr.appendChild(cell);
      });

      tbody.appendChild(tr);
    });

    table.appendChild(tbody);
    results.replaceChildren(table);
  }

  async function loadStandings() {
    const select = document.getElementById("competitionSelect");
    const slug = select?.value;

    if (!slug) return;

    const title = document.getElementById("tableTitle");
    if (title) {
      title.textContent = select.options[select.selectedIndex].text;
    }

    loading("Puan tablosu yükleniyor...");

    try {
      const data = await requestJSON(
        `/api/sportscore?action=standings&slug=${encodeURIComponent(slug)}`
      );

      renderStandings(data);
    } catch (error) {
      console.error("SPORIX puan durumu:", error);
      showMessage("Puan durumu alınamadı. Seçilen lig için veri bulunmuyor olabilir.");
    }
  }

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
      showMessage("Bu takımın fikstürü alınamadı. Takım slug bilgisini kontrol et.");
    }
  }
});
