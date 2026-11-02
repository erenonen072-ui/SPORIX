
"use strict";

const params = new URLSearchParams(location.search);
let currentView = params.get("view") || "standings";
let currentSlug = params.get("slug") || "";
let currentId = params.get("id") || "";

const $ = id => document.getElementById(id);

const views = {
  match: {
    title: "Maç Merkezi",
    description: "Maçın tüm detayları, olayları ve kadroları."
  },
  team: {
    title: "Takım Merkezi",
    description: "Takımın maçları ve takım bilgileri."
  },
  standings: {
    title: "Puan Durumu",
    description: "Lig sıralaması ve takım puanları."
  },
  topscorers: {
    title: "Gol ve Asist Krallığı",
    description: "Gol ve asist liderleri."
  },
  player: {
    title: "Oyuncu Merkezi",
    description: "Oyuncu bilgileri ve performansı."
  },
  bracket: {
    title: "Turnuva Ağacı",
    description: "Turnuva eşleşmeleri."
  },
  tracker: {
    title: "Canlı Maç Takibi",
    description: "Maç takip bilgileri."
  }
};

function node(tag, cls, value) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (value !== undefined && value !== null) {
    el.textContent = String(value);
  }
  return el;
}

function text(value, fallback = "—") {
  return value === null || value === undefined || value === ""
    ? fallback
    : String(value);
}

function image(url, alt, cls = "") {
  if (!url || !/^https?:\/\//i.test(url)) return null;
  const img = node("img", cls);
  img.src = url;
  img.alt = alt || "";
  img.loading = "lazy";
  img.onerror = () => img.remove();
  return img;
}

function date(value) {
  if (!value) return "Tarih belirtilmedi";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "Tarih belirtilmedi";
  return d.toLocaleString("tr-TR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Istanbul"
  });
}

async function api(action, values = {}) {
  const query = new URLSearchParams({ action, ...values });
  const response = await fetch(`/api/sportscore?${query}`, {
    cache: "no-store"
  });
  const result = await response.json();

  if (!response.ok || !result.success) {
    throw new Error(result.error || "Veriler alınamadı.");
  }

  return result.data;
}

function section(title) {
  const box = node("section", "sx-section");
  box.appendChild(node("h2", "sx-section-title", title));
  return box;
}

function empty(message) {
  return node("p", "sx-empty", message);
}

function renderMatchCard(match) {
  const card = node("a", "sx-match-card");
  const slug = match.url?.split("/").filter(Boolean).pop();

  if (slug) {
    card.href = `/veri.html?view=match&slug=${encodeURIComponent(slug)}`;
  } else {
    card.href = "#";
    card.addEventListener("click", e => e.preventDefault());
  }

  const top = node("div", "sx-match-meta");
  top.append(
    node("span", "sx-league", text(match.competition, "Futbol")),
    node("span", "sx-date", date(match.time))
  );

  const teams = node("div", "sx-match-teams");

  function addTeam(name, logo) {
    const item = node("div", "sx-match-team");
    const img = image(logo, name, "sx-team-logo");
    if (img) item.appendChild(img);
    item.appendChild(node("strong", "", name));
    return item;
  }

  const score = match.home_score !== null &&
    match.home_score !== undefined &&
    match.away_score !== null &&
    match.away_score !== undefined
      ? `${match.home_score} - ${match.away_score}`
      : "VS";

  teams.append(
    addTeam(match.home, match.home_logo),
    node("strong", "sx-match-score", score),
    addTeam(match.away, match.away_logo)
  );

  card.append(top, teams);
  card.appendChild(
    node("span", "sx-match-status", text(match.status_text, "Maç bilgisi"))
  );

  return card;
}

function renderMatchList(matches, parent) {
  if (!Array.isArray(matches) || !matches.length) {
    parent.appendChild(empty("Gösterilecek maç bulunamadı."));
    return;
  }

  const list = node("div", "sx-match-list");
  matches.forEach(match => list.appendChild(renderMatchCard(match)));
  parent.appendChild(list);
}

function renderPlayerList(players, title) {
  const box = section(title);

  if (!Array.isArray(players) || !players.length) {
    box.appendChild(empty("Oyuncu bilgisi bulunamadı."));
    return box;
  }

  const list = node("div", "sx-player-list");

  players.forEach(player => {
    const item = node("div", "sx-player");
    item.append(
      node("span", "sx-player-number", text(player.number, "—")),
      node("strong", "sx-player-name", text(player.name)),
      node("span", "sx-player-position", text(player.position, "—"))
    );
    if (player.captain) {
      item.appendChild(node("span", "sx-captain", "Kaptan"));
    }
    list.appendChild(item);
  });

  box.appendChild(list);
  return box;
}

function renderIncidents(incidents) {
  const box = section("Maç olayları");

  if (!Array.isArray(incidents) || !incidents.length) {
    box.appendChild(empty("Bu maç için olay kaydı bulunamadı."));
    return box;
  }

  const list = node("div", "sx-timeline");

  incidents.forEach(event => {
    let icon = "•";
    if (event.is_goal) icon = "⚽";
    else if (event.is_card) icon = "🟨";
    else if (event.is_sub) icon = "🔄";

    const item = node("article", "sx-event");
    item.append(
      node("strong", "sx-event-time", `${text(event.time)}'`),
      node("span", "sx-event-icon", icon)
    );

    const detail = node("div", "sx-event-detail");
    detail.appendChild(
      node("strong", "", text(event.type, "Olay"))
    );

    if (event.player) {
      detail.appendChild(node("span", "", event.player));
    }

    if (event.is_sub) {
      detail.appendChild(
        node(
          "p",
          "",
          `${text(event.player_out)} → ${text(event.player_in)}`
        )
      );
    }

    if (event.is_goal &&
        event.home_score !== undefined &&
        event.away_score !== undefined) {
      detail.appendChild(
        node("small", "", `${event.home_score} - ${event.away_score}`)
      );
    }

    item.appendChild(detail);
    list.appendChild(item);
  });

  box.appendChild(list);
  return box;
}

function renderMatch(data) {
  const match = data.match || data;
  const output = $("dataOutput");
  output.replaceChildren();

  const hero = node("section", "sx-match-hero");

  hero.appendChild(
    node("span", "sx-match-competition", text(match.competition))
  );

  const teams = node("div", "sx-hero-teams");

  function heroTeam(name, logo) {
    const item = node("div", "sx-hero-team");
    const img = image(logo, name, "sx-hero-logo");
    if (img) item.appendChild(img);
    item.appendChild(node("h2", "", text(name)));
    return item;
  }

  teams.append(
    heroTeam(match.home, match.home_logo),
    node(
      "div",
      "sx-hero-score",
      `${text(match.home_score, "0")} - ${text(match.away_score, "0")}`
    ),
    heroTeam(match.away, match.away_logo)
  );

  hero.append(
    teams,
    node("span", "sx-hero-status", text(match.status_text)),
    node("span", "sx-hero-date", date(match.time))
  );

  output.appendChild(hero);

  const halftime = section("İlk yarı skoru");
  halftime.appendChild(
    node(
      "strong",
      "sx-halftime-score",
      `${text(match.home_ht_score, "—")} - ${text(match.away_ht_score, "—")}`
    )
  );
  output.appendChild(halftime);

  output.appendChild(renderIncidents(match.incidents));

  const lineups = match.lineups || {};

  const homeName = text(match.home);
  const awayName = text(match.away);

  output.appendChild(
    renderPlayerList(lineups.home_xi, `${homeName} - İlk 11`)
  );

  output.appendChild(
    renderPlayerList(lineups.home_subs, `${homeName} - Yedekler`)
  );

  output.appendChild(
    renderPlayerList(lineups.away_xi, `${awayName} - İlk 11`)
  );

  output.appendChild(
    renderPlayerList(lineups.away_subs, `${awayName} - Yedekler`)
  );

  if (Array.isArray(match.stats) && match.stats.length) {
    const stats = section("Maç istatistikleri");
    stats.appendChild(node("pre", "sx-raw-data", JSON.stringify(match.stats, null, 2)));
    output.appendChild(stats);
  } else {
    const stats = section("Maç istatistikleri");
    stats.appendChild(empty("Bu maç için istatistik verisi sağlanmamış."));
    output.appendChild(stats);
  }

  $("resultStatus").textContent = "Maç verileri yüklendi";
}

function renderTeam(data) {
  const output = $("dataOutput");
  output.replaceChildren();

  const team = data.team || {};
  const hero = node("section", "sx-team-hero");
  const logo = image(team.logo, team.name, "sx-team-hero-logo");

  if (logo) hero.appendChild(logo);

  hero.append(
    node("h2", "", text(team.name, "Takım")),
    node("p", "", "SPORIX Takım Merkezi")
  );

  output.appendChild(hero);

  const matches = section("Son maçlar ve gelecek fikstür");
  renderMatchList(data.matches, matches);
  output.appendChild(matches);

  $("resultStatus").textContent = "Takım verileri yüklendi";
}

function renderGeneric(data) {
  const output = $("dataOutput");
  output.replaceChildren();

  function walk(value, parent, depth = 0) {
    if (depth > 5) return;

    if (Array.isArray(value)) {
      value.forEach(item => walk(item, parent, depth + 1));
      return;
    }

    if (value && typeof value === "object") {
      Object.entries(value).forEach(([key, item]) => {
        if (item === null || item === undefined) return;

        if (typeof item === "object") {
          const box = section(key.replaceAll("_", " "));
          walk(item, box, depth + 1);
          parent.appendChild(box);
        } else {
          const field = node("div", "sx-generic-field");
          field.append(
            node("span", "", key.replaceAll("_", " ")),
            node("strong", "", String(item))
          );
          parent.appendChild(field);
        }
      });
    }
  }

  walk(data, output);
}

async function loadData() {
  const config = views[currentView];

  if (!config) {
    $("dataOutput").textContent = "Geçersiz sayfa türü.";
    return;
  }

  $("pageTitle").textContent = config.title;
  $("pageDescription").textContent = config.description;
  $("resultTitle").textContent = config.title;

  $("resultStatus").textContent = "Yükleniyor...";
  $("dataOutput").replaceChildren(node("div", "loading", "Veriler yükleniyor..."));

  try {
    let data;

    if (currentView === "match") {
      if (!currentSlug) throw new Error("Maç slug bilgisi bulunamadı.");
      data = await api("match", { slug: currentSlug });
      renderMatch(data);
    } else if (currentView === "team") {
      if (!currentSlug) throw new Error("Takım slug bilgisi bulunamadı.");
      data = await api("team", { slug: currentSlug, limit: "30" });
      renderTeam(data);
    } else if (currentView === "tracker") {
      if (!currentId) throw new Error("Maç ID bilgisi bulunamadı.");
      data = await api("tracker", { id: currentId });
      renderGeneric(data);
    } else {
      if (!currentSlug) throw new Error("Lütfen bir slug gir.");
      const values = { slug: currentSlug };

      if (currentView === "topscorers") {
        values.stat = params.get("stat") || "goals";
        values.limit = "50";
      }

      data = await api(config.action || currentView, values);
      renderGeneric(data);
    }

    $("resultStatus").textContent = "Veriler güncellendi";
  } catch (error) {
    $("resultStatus").textContent = "Veri alınamadı";
    $("dataOutput").replaceChildren(
      node("p", "sx-empty", error.message || "Bir hata oluştu.")
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const config = views[currentView] || views.standings;

  $("pageTitle").textContent = config.title;
  $("pageDescription").textContent = config.description;
  $("resultTitle").textContent = config.title;

  $("slugInput").value = currentSlug;
  $("idInput").value = currentId;

  $("dataForm").addEventListener("submit", event => {
    event.preventDefault();

    currentSlug = $("slugInput").value.trim();
    currentId = $("idInput").value.trim();

    const query = new URLSearchParams({ view: currentView });
    if (currentSlug) query.set("slug", currentSlug);
    if (currentId) query.set("id", currentId);

    history.replaceState({}, "", `${location.pathname}?${query}`);
    loadData();
  });

  const menu = $("menuToggle");
  const nav = $("mainNav");

  menu?.addEventListener("click", () => {
    const open = nav.classList.toggle("open");
    menu.setAttribute("aria-expanded", String(open));
  });

  if ($("year")) {
    $("year").textContent = new Date().getFullYear();
  }

  loadData();
});
