import { randomUUID } from "node:crypto";
import type { StorefrontMarketingEvent } from "./events";

type MetaConversionEventInput = {
  eventName: StorefrontMarketingEvent;
  eventSourceUrl: string;
  eventId?: string;
  currency?: string;
  value?: number;
  contentIds?: string[];
};

export type MetaConversionEvent = {
  event_name: StorefrontMarketingEvent;
  event_time: number;
  event_id: string;
  action_source: "website";
  event_source_url: string;
  custom_data: {
    currency?: string;
    value?: number;
    content_ids?: string[];
  };
};

export function createMetaConversionEvent(
  input: MetaConversionEventInput,
  consented: boolean,
): MetaConversionEvent | null {
  if (!consented) return null;
  const eventUrl = new URL(input.eventSourceUrl);
  if (eventUrl.protocol !== "https:" && eventUrl.hostname !== "localhost") {
    throw new Error("Marketing event URLs must use HTTPS.");
  }
  if (input.value !== undefined && (!Number.isFinite(input.value) || input.value < 0)) {
    throw new Error("Marketing event value must be finite and non-negative.");
  }
  return {
    event_name: input.eventName,
    event_time: Math.floor(Date.now() / 1000),
    event_id: input.eventId ?? randomUUID(),
    action_source: "website",
    event_source_url: eventUrl.toString(),
    custom_data: {
      ...(input.currency ? { currency: input.currency } : {}),
      ...(input.value !== undefined ? { value: input.value } : {}),
      ...(input.contentIds ? { content_ids: input.contentIds } : {}),
    },
  };
}
