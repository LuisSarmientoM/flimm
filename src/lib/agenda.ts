import rawData from "../../db.json";

export type AgendaItem = {
  item?: number;
  fecha: string;
  horario: string;
  tipo: string;
  nombre: string;
  participantes?: string;
  info?: string;
  sede?: string;
};

type AgendaData = {
  evento: string;
  programacion: AgendaItem[];
};

export const SITE_URL = "https://flimm.lsarmiento.dev";
export const agendaData = rawData as AgendaData;

export function getAvailableDates(items: AgendaItem[] = agendaData.programacion) {
  return [...new Set(items.map((item) => item.fecha).filter(Boolean))].sort();
}

export function toMinutes(range = "") {
  const start = range.split("-")[0] || "";
  const [h, m] = start.split(":").map(Number);
  if (!Number.isFinite(h) || !Number.isFinite(m)) {
    return Number.MAX_SAFE_INTEGER;
  }
  return h * 60 + m;
}

export function getItemsByDate(date: string, items: AgendaItem[] = agendaData.programacion) {
  return items
    .filter((item) => item.fecha === date)
    .sort((a, b) => toMinutes(a.horario) - toMinutes(b.horario));
}

export function formatDateShort(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) {
    return isoDate;
  }

  const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];
  return `${day} ${months[month - 1] || ""}`;
}

export function formatDateLong(isoDate: string) {
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

function parseIsoDate(isoDate: string) {
  const match = isoDate.match(/^(\d{4})-(\d{2})-(\d{2})$/);
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

export function toIsoDateTime(date: string, range: string, end: boolean) {
  const [startTimeRaw, endTimeRaw] = String(range || "").split("-");
  const time = end ? endTimeRaw || startTimeRaw : startTimeRaw;
  if (!date || !time || !time.includes(":")) {
    return date || "2026-03-20";
  }

  return `${date}T${time.trim()}:00-05:00`;
}

export function absoluteUrl(path: string) {
  return new URL(path, SITE_URL).toString();
}

export function buildFestivalJsonLd() {
  const dates = getAvailableDates();
  const startDate = dates[0] || "2026-03-20";
  const endDate = dates[dates.length - 1] || "2026-03-22";

  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        name: "FLIMM",
        alternateName: agendaData.evento,
      },
      {
        "@type": "Festival",
        name: agendaData.evento,
        description:
          "Agenda oficial de FLIMM 2026 en San Jacinto, Montes de Maria. Actividades literarias, musicales y culturales por fecha, tipo y lugar.",
        startDate,
        endDate,
        eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
        eventStatus: "https://schema.org/EventScheduled",
        inLanguage: "es-CO",
        location: {
          "@type": "Place",
          name: "San Jacinto, Montes de Maria, Colombia",
        },
        organizer: {
          "@type": "Organization",
          name: "FLIMM",
        },
      },
    ],
  };
}

export function buildDayJsonLd(date: string) {
  const dayItems = getItemsByDate(date);

  return {
    "@context": "https://schema.org",
    "@graph": dayItems.map((item) => ({
      "@type": "Event",
      name: item.nombre || "Actividad FLIMM",
      startDate: toIsoDateTime(item.fecha, item.horario, false),
      endDate: toIsoDateTime(item.fecha, item.horario, true),
      eventAttendanceMode: "https://schema.org/OfflineEventAttendanceMode",
      eventStatus: "https://schema.org/EventScheduled",
      location: {
        "@type": "Place",
        name: item.sede || "San Jacinto",
      },
      description: item.info || item.tipo || "Actividad de la programacion FLIMM",
      organizer: {
        "@type": "Organization",
        name: "FLIMM",
      },
      url: absoluteUrl(`/agenda/${date}/`),
    })),
  };
}
