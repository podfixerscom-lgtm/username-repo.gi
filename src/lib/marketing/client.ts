"use client";

import type { StorefrontMarketingEvent } from "./events";

export type { StorefrontMarketingEvent } from "./events";

type MarketingPayload = Record<string, string | number | string[]>;

const CONSENT_KEY = "crazy-cart.marketing-consent.v1";

export function trackStorefrontEvent(
  eventName: StorefrontMarketingEvent,
  payload: MarketingPayload = {},
): void {
  if (typeof window === "undefined") {
    return;
  }
  try {
    if (window.localStorage.getItem(CONSENT_KEY) !== "granted") return;
  } catch (error) {
    console.error("Could not verify marketing consent; event was not sent.", error);
    return;
  }

  window.dispatchEvent(new CustomEvent("crazycart:marketing-event", {
    detail: { eventName, payload },
  }));

  const dataLayerWindow = window as Window & { dataLayer?: Array<Record<string, unknown>> };
  dataLayerWindow.dataLayer = dataLayerWindow.dataLayer ?? [];
  dataLayerWindow.dataLayer.push({ event: eventName, ...payload });

  const pixelWindow = window as Window & {
    fbq?: (command: string, event: string, data?: MarketingPayload) => void;
  };
  pixelWindow.fbq?.("track", eventName, payload);
}
