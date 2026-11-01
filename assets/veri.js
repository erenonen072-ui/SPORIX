
"use strict";

const params = new URLSearchParams(location.search);

let currentView = params.get("view") || "standings";
let currentSlug = params.get("slug") || "";
let currentId = params.get("id") || "";
let currentStat = params.get("stat") || "goals";

const views = {
  match: {
    title: "Maç Detayları",
    description: "Maç skoru, kadrolar, olaylar ve mevcut maç bilgileri.",
    action: "match",
    needsSlug: true
  },
  team: {
    title: "Takım Fikstürü",
    description: "Takımın geçmiş ve gelecek maçları.",
    action: "team",
    needsSlug: true
  },
  standings: {
    title: "Puan Durumu",
    description: "Lig sıralaması ve takım puanları.",
    action: "standings",
    needsSlug: true
  },
  topscorers: {
    title: "Gol ve Asist Krallığı",
    description: "Liglerin gol ve asist liderleri.",
    action: "topscorers",
    needsSlug: true
  },
  player: {
    title: "Oyuncu İstatistikleri",
    description: "Futbolcu profili ve performans bilgileri.",
    action: "player",
    needsSlug: true
  },
  bracket: {
    title: "Turnuva Ağacı",
    description: "Eleme turları ve turnuva eşleşmeleri.",
    action: "bracket",
    needsSlug: true
  },
  tracker: {
    title: "Canlı Maç Takibi",
    description: "Maç takip verileri ve saha konumu bilgileri.",
    action: "tracker",
    needsId: true
  }
};

function el(id) {
  return document.getElementById(id);
}

function safeText(value) {
  if (value === null || value === undefined) return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function make(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderValue(value, parent, depth = 0) {
  if (depth > 5) {
    parent.appendChild(make("p", "data-value", safeText(value)));
    return;
  }

  if (Array.isArray(value)) {
    if (!value.length) {
      parent.appendChild(make("p", "empty-state", "Gösterilecek kayıt bulunamadı."));
      return;
    }

    const list = make("div", "data-list");

    value.forEach((item, index) => {
      const card = make("article", "data-card");
      card.appendChild(make("h3", "", `Kayıt ${index + 1}`));
      renderValue(item, card, depth + 1);
      list.appendChild(card);
    });

    parent.appendChild(list);
    return;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value).filter(([, item]) =>
      item !== null && item !== undefined && typeof item !== "object"
    );

    const nested = Object.entries(value).filter(([, item]) =>
      item && typeof item === "object"
    );

    if (entries.length) {
      const grid = make("div", "data-grid");

      entries.forEach(([key, item]) => {
        const box = make("div", "data-field");
        box.append(
          make("span", "data-label", key.replaceAll("_", " ")),
          make("strong", "data-value", safeText(item))
        );
        grid.appendChild(box);
      });

      parent.appendChild(grid);
    }

    nested.forEach(([key, item]) => {
      const section = make("section", "data-nested");
      section.appendChild(make("h3", "", key.replaceAll("_", " ")));
      renderValue(item, section, depth + 1);
      parent.appendChild(section);
    });

    return;
  }

  parent.appendChild(make("p", "data-value", safeText(value)));
}

function setPage() {
  const config = views[currentView] || views.standings;

  el("pageTitle").textContent = config.title;
  el("pageDescription").textContent = config.description;
  el("resultTitle").textContent = config.title;

  el("slugInput").value = currentSlug;
  el("idInput").value = currentId;
  el("statInput").value = currentStat;

  el("idInput").closest("label")?.classList.toggle(
    "hidden",
    !config.needsId
  );
}

async function loadData() {
  const config = views[currentView];

  if (!config) {
    el("dataOutput").textContent = "Geçersiz sayfa türü.";
    return;
  }

  if (config.needsSlug && !currentSlug) {
    el("resultStatus").textContent = "Bilgi gerekli";
    el("dataOutput").replaceChildren(
      make("p", "empty-state", "Verileri getirmek için yukarıya geçerli bir slug yazın.")
    );
    return;
  }

  if (config.needsId && !currentId) {
    el("resultStatus").textContent = "Maç ID gerekli";
    el("dataOutput").replaceChildren(
      make("p", "empty-state", "Canlı takip için maç ID'si girin.")
    );
    return;
  }

  el("resultStatus").textContent = "Yükleniyor...";
  el("dataOutput").replaceChildren(
    make("div", "loading", "SportScore verileri alınıyor...")
  );

  const query = new URLSearchParams({
    action: config.action
  });

  if (currentSlug) query.set("slug", currentSlug);
  if (currentId) query.set("id", currentId);
  if (config.action === "topscorers") {
    query.set("stat", currentStat);
    query.set("limit", "50");
  }

  try {
    const response = await fetch(`/api/sportscore?${query.toString()}`, {
      cache: "no-store"
    });

    const result = await response.json();

    if (!response.ok || !result.success) {
      throw new Error(result.error || "Veri alınamadı.");
    }

    el("dataOutput").replaceChildren();
    renderValue(result.data, el("dataOutput"));
    el("resultStatus").textContent = "Güncel veri alındı";
  } catch (error) {
    el("resultStatus").textContent = "Hata";
    el("dataOutput").replaceChildren(
      make("p", "empty-state", error.message || "Veriler şu anda alınamıyor.")
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  setPage();
  loadData();

  el("dataForm").addEventListener("submit", event => {
    event.preventDefault();

    currentSlug = el("slugInput").value.trim();
    currentId = el("idInput").value.trim();
    currentStat = el("statInput").value;

    const query = new URLSearchParams({
      view: currentView
    });

    if (currentSlug) query.set("slug", currentSlug);
    if (currentId) query.set("id", currentId);
    if (currentStat) query.set("stat", currentStat);

    history.replaceState({}, "", `${location.pathname}?${query.toString()}`);
    loadData();
  });

  const menuToggle = el("menuToggle");
  const mainNav = el("mainNav");

  menuToggle?.addEventListener("click", () => {
    const open = mainNav.classList.toggle("open");
    menuToggle.setAttribute("aria-expanded", String(open));
  });

  el("year").textContent = new Date().getFullYear();
});
