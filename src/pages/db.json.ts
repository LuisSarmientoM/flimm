import type { APIRoute } from "astro";
import { agendaData } from "../lib/agenda";

export const prerender = true;

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(agendaData), {
    headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "public, max-age=300",
    },
  });
};
