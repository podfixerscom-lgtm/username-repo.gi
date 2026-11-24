"use client";

import { useEffect } from "react";
import { trackStorefrontEvent } from "@/lib/marketing/client";

export function SearchEvent({ query }: { query: string }) {
  useEffect(() => {
    if (query) trackStorefrontEvent("Search", { search_term: query });
  }, [query]);
  return null;
}
