const agendaEl = document.getElementById("agenda");
const metaEl = document.getElementById("agenda-meta");
const template = document.getElementById("activity-template");
const appRoot = document.querySelector(".app[data-selected-date]");

const venueFilterBtn = document.getElementById("venue-filter-btn");
const venueFilterMenu = document.getElementById("venue-filter-menu");
const typeFilterBtn = document.getElementById("type-filter-btn");
const typeFilterMenu = document.getElementById("type-filter-menu");
const searchInputEl = document.getElementById("search-input");
const dayTabsEl = document.getElementById("day-tabs");

const ALL_VALUE = "ALL";
const DETAILS_ANIMATION_MS = 260;

let dayItems = [];
let selectedVenue = ALL_VALUE;
let selectedType = ALL_VALUE;
let searchQuery = "";

const selectedDate = appRoot?.dataset.selectedDate || "";
const todayDate = getTodayIsoDate();

if (shouldRedirectToToday()) {
  window.location.replace(`/agenda/${todayDate}/`);
} else if (selectedDate && agendaEl && metaEl && template) {
  queueAgendaHydration();
}

function queueAgendaHydration() {
  const run = () => {
    if ("requestIdleCallback" in window) {
      window.requestIdleCallback(() => {
        void init();
      }, { timeout: 1200 });
      return;
    }

    window.setTimeout(() => {
      void init();
    }, 240);
  };

  if (document.readyState === "complete") {
    run();
    return;
  }

  window.addEventListener("load", run, { once: true });
}

function shouldRedirectToToday() {
  if (!selectedDate || !dayTabsEl) {
    return false;
  }

  const cleanPath = window.location.pathname.replace(/\/+$/, "");
  if (cleanPath !== "") {
    return false;
  }

  const availableDates = [...dayTabsEl.querySelectorAll("a.day-tab")]
    .map((link) => getDateFromAgendaPath(link.getAttribute("href") || ""))
    .filter(Boolean);

  return todayDate !== selectedDate && availableDates.includes(todayDate);
}

function getDateFromAgendaPath(path) {
  const match = path.match(/\/agenda\/(\d{4}-\d{2}-\d{2})\/?$/);
  return match?.[1] || "";
}

function getTodayIsoDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Bogota",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

async function init() {
  try {
    const response = await fetch("/db.json");
    if (!response.ok) {
      throw new Error(`No se pudo leer db.json (${response.status})`);
    }

    const data = await response.json();
    const allItems = Array.isArray(data.programacion) ? data.programacion : [];
    dayItems = allItems
      .filter((item) => item.fecha === selectedDate)
      .sort((a, b) => toMinutes(a.horario) - toMinutes(b.horario));

    setupFilterToggles();
    setupTextSearch();
    wireCardToggles();
    renderSelectedDay();
  } catch (error) {
    console.error(error);
    if (metaEl) {
      metaEl.textContent = "No se pudieron cargar filtros";
    }
  }
}

function renderSelectedDay() {
  renderFilters(dayItems);

  const filteredItems = dayItems.filter((item) => {
    const matchesVenue = selectedVenue === ALL_VALUE || item.sede === selectedVenue;
    const matchesType = selectedType === ALL_VALUE || item.tipo === selectedType;
    const matchesSearch = matchesTextFilter(item, searchQuery);
    return matchesVenue && matchesType && matchesSearch;
  });

  const fullDate = formatDateLong(selectedDate);
  renderAgenda(filteredItems, fullDate, dayItems.length);
}

function renderFilters(items) {
  if (!venueFilterBtn || !venueFilterMenu || !typeFilterBtn || !typeFilterMenu) {
    return;
  }

  const venues = getUniqueValues(items, "sede");
  const types = getUniqueValues(items, "tipo");

  if (selectedVenue !== ALL_VALUE && !venues.includes(selectedVenue)) {
    selectedVenue = ALL_VALUE;
  }
  if (selectedType !== ALL_VALUE && !types.includes(selectedType)) {
    selectedType = ALL_VALUE;
  }

  renderFilterMenu({
    menuEl: venueFilterMenu,
    options: [ALL_VALUE, ...venues],
    selected: selectedVenue,
    onSelect: (value) => {
      selectedVenue = value;
      closeAllFilterMenus();
      renderSelectedDay();
    },
  });

  renderFilterMenu({
    menuEl: typeFilterMenu,
    options: [ALL_VALUE, ...types],
    selected: selectedType,
    onSelect: (value) => {
      selectedType = value;
      closeAllFilterMenus();
      renderSelectedDay();
    },
  });

  venueFilterBtn.textContent = `Lugar: ${selectedVenue === ALL_VALUE ? "Todos" : selectedVenue}`;
  typeFilterBtn.textContent = `Tipo: ${selectedType === ALL_VALUE ? "Todos" : selectedType}`;
}

function renderFilterMenu({ menuEl, options, selected, onSelect }) {
  menuEl.innerHTML = "";

  options.forEach((option) => {
    const item = document.createElement("button");
    item.type = "button";
    item.className = "filter__item";
    if (option === selected) {
      item.classList.add("is-selected");
    }

    item.textContent = option === ALL_VALUE ? "Todos" : option;
    item.addEventListener("click", () => onSelect(option));
    menuEl.appendChild(item);
  });
}

function setupFilterToggles() {
  if (!venueFilterBtn || !typeFilterBtn) {
    return;
  }

  venueFilterBtn.addEventListener("click", () => toggleFilterMenu("venue"));
  typeFilterBtn.addEventListener("click", () => toggleFilterMenu("type"));

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".filter")) {
      closeAllFilterMenus();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAllFilterMenus();
    }
  });
}

function setupTextSearch() {
  if (!searchInputEl) {
    return;
  }

  searchInputEl.addEventListener("input", (event) => {
    searchQuery = event.target.value || "";
    renderSelectedDay();
  });
}

function toggleFilterMenu(which) {
  if (!venueFilterBtn || !venueFilterMenu || !typeFilterBtn || !typeFilterMenu) {
    return;
  }

  const targetBtn = which === "venue" ? venueFilterBtn : typeFilterBtn;
  const targetMenu = which === "venue" ? venueFilterMenu : typeFilterMenu;
  const isOpen = targetBtn.getAttribute("aria-expanded") === "true";

  closeAllFilterMenus();
  if (!isOpen) {
    targetBtn.setAttribute("aria-expanded", "true");
    targetMenu.hidden = false;
  }
}

function closeAllFilterMenus() {
  if (!venueFilterBtn || !venueFilterMenu || !typeFilterBtn || !typeFilterMenu) {
    return;
  }

  venueFilterBtn.setAttribute("aria-expanded", "false");
  typeFilterBtn.setAttribute("aria-expanded", "false");
  venueFilterMenu.hidden = true;
  typeFilterMenu.hidden = true;
}

function renderAgenda(items, fullDate, totalDayItems) {
  if (!agendaEl || !metaEl || !template) {
    return;
  }

  if (items.length === 0) {
    metaEl.textContent = `${fullDate} - 0 de ${totalDayItems} actividades`;
    agendaEl.innerHTML = '<div class="message">No hay eventos para este filtro.</div>';
    return;
  }

  metaEl.textContent = `${fullDate} - ${items.length} actividades`;
  agendaEl.innerHTML = "";

  items.forEach((item) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".card");
    const button = fragment.querySelector(".card__toggle");
    const time = fragment.querySelector(".card__time");
    const type = fragment.querySelector(".card__type");
    const title = fragment.querySelector(".card__title");
    const venue = fragment.querySelector(".card__venue");
    const details = fragment.querySelector(".card__details");
    const info = fragment.querySelector(".card__info");
    const participants = fragment.querySelector(".card__participants");

    card.dataset.type = item.tipo || "";
    time.textContent = item.horario || "Hora por confirmar";
    type.textContent = item.tipo || "ACTIVIDAD";
    title.textContent = item.nombre || "Sin titulo";
    venue.textContent = item.sede ? `📍 ${item.sede}` : "📍 Sede por confirmar";
    info.textContent = item.info || "Sin detalle";
    participants.textContent = item.participantes || "Por confirmar";

    button.addEventListener("click", () => toggleCard(card, details, button));
    agendaEl.appendChild(fragment);
  });
}

function wireCardToggles() {
  if (!agendaEl) {
    return;
  }

  const cards = agendaEl.querySelectorAll(".card");
  cards.forEach((card) => {
    const button = card.querySelector(".card__toggle");
    const details = card.querySelector(".card__details");
    if (!button || !details) {
      return;
    }

    button.addEventListener("click", () => toggleCard(card, details, button));
  });
}

function toggleCard(card, details, button) {
  const isOpen = card.classList.contains("is-open");

  if (isOpen) {
    button.setAttribute("aria-expanded", "false");
    card.classList.remove("is-open");
    window.setTimeout(() => {
      if (!card.classList.contains("is-open")) {
        details.hidden = true;
      }
    }, DETAILS_ANIMATION_MS);
    return;
  }

  details.hidden = false;
  requestAnimationFrame(() => {
    card.classList.add("is-open");
    button.setAttribute("aria-expanded", "true");
  });
}

function matchesTextFilter(item, query) {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    return true;
  }

  const searchableText = [item.nombre, item.participantes]
    .filter(Boolean)
    .map((value) => normalizeText(value))
    .join(" ");

  return searchableText.includes(normalizedQuery);
}

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function getUniqueValues(items, field) {
  return [...new Set(items.map((item) => item[field]).filter(Boolean))].sort((a, b) =>
    String(a).localeCompare(String(b), "es", { sensitivity: "base" }),
  );
}

function formatDateLong(isoDate) {
  const date = parseIsoDate(isoDate);
  if (!date) {
    return isoDate;
  }

  return new Intl.DateTimeFormat("es-CO", {
    timeZone: "UTC",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(date);
}

function parseIsoDate(isoDate) {
  const match = String(isoDate || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) {
    return null;
  }

  const [, year, month, day] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function toMinutes(range = "") {
  const start = range.split("-")[0] || "";
  const [h, m] = start.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return h * 60 + m;
}
