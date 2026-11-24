"use client";

import { useEffect, useSyncExternalStore } from "react";
import { getMarketingConsent, subscribeToMarketingConsent } from "@/lib/marketing/consent";

function installAnalytics(measurementId: string) {
  if (!measurementId || document.getElementById("crazy-cart-ga-script")) return;
  const script = document.createElement("script");
  script.id = "crazy-cart-ga-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(measurementId)}`;
  document.head.appendChild(script);

  const analyticsWindow = window as Window & {
    dataLayer?: Array<unknown>;
    gtag?: (...args: unknown[]) => void;
  };
  analyticsWindow.dataLayer = analyticsWindow.dataLayer ?? [];
  analyticsWindow.gtag = analyticsWindow.gtag ?? function gtag(...args: unknown[]) {
    analyticsWindow.dataLayer?.push(args);
  };
  analyticsWindow.gtag("js", new Date());
  analyticsWindow.gtag("config", measurementId);
}

function installTagManager(containerId: string) {
  if (!containerId || document.getElementById("crazy-cart-gtm-script")) return;
  const dataLayerWindow = window as Window & { dataLayer?: Array<Record<string, unknown>> };
  dataLayerWindow.dataLayer = dataLayerWindow.dataLayer ?? [];
  dataLayerWindow.dataLayer.push({ "gtm.start": Date.now(), event: "gtm.js" });
  const script = document.createElement("script");
  script.id = "crazy-cart-gtm-script";
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtm.js?id=${encodeURIComponent(containerId)}`;
  document.head.appendChild(script);
}

function installMetaPixel(pixelId: string) {
  if (!pixelId || document.getElementById("crazy-cart-meta-pixel")) return;
  const pixelWindow = window as Window & {
    fbq?: {
      (command: string, event: string, data?: Record<string, unknown>): void;
      queue?: unknown[];
    };
  };
  if (!pixelWindow.fbq) {
    const fbq: {
      (command: string, event: string, data?: Record<string, unknown>): void;
      queue: unknown[];
    } = (command, event, data) => {
      fbq.queue?.push([command, event, data]);
    };
    fbq.queue = [];
    pixelWindow.fbq = fbq;
  }
  pixelWindow.fbq?.("init", pixelId);
  pixelWindow.fbq?.("track", "PageView");
  const script = document.createElement("script");
  script.id = "crazy-cart-meta-pixel";
  script.async = true;
  script.src = "https://connect.facebook.net/en_US/fbevents.js";
  document.head.appendChild(script);
}

export function MarketingProvider() {
  const consent = useSyncExternalStore(subscribeToMarketingConsent, getMarketingConsent, () => null);

  useEffect(() => {
    if (consent === "denied") {
      const analyticsWindow = window as Window & {
        gtag?: (...args: unknown[]) => void;
        dataLayer?: Array<Record<string, unknown>>;
        fbq?: (command: string, event: string, data?: Record<string, unknown>) => void;
      };
      analyticsWindow.gtag?.("consent", "update", {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      });
      analyticsWindow.dataLayer?.push({ event: "consent_update", marketing_consent: "denied" });
      analyticsWindow.fbq?.("consent", "revoke");
      return;
    }
    if (consent !== "granted") return;
    installAnalytics(process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID ?? "");
    installTagManager(process.env.NEXT_PUBLIC_GTM_ID ?? "");
    installMetaPixel(process.env.NEXT_PUBLIC_META_PIXEL_ID ?? "");
  }, [consent]);

  return null;
}
