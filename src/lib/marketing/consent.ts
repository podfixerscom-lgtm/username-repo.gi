"use client";

export type MarketingConsent = "granted" | "denied" | null;
const CONSENT_KEY = "crazy-cart.marketing-consent.v1";

export function getMarketingConsent(): MarketingConsent {
  if (typeof window === "undefined") return null;
  try {
    const consent = window.localStorage.getItem(CONSENT_KEY);
    return consent === "granted" || consent === "denied" ? consent : null;
  } catch (error) {
    console.error("Could not read marketing consent; tracking remains disabled.", error);
    return null;
  }
}

export function subscribeToMarketingConsent(onChange: () => void) {
  window.addEventListener("crazycart:consent-change", onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener("crazycart:consent-change", onChange);
    window.removeEventListener("storage", onChange);
  };
}

export function updateMarketingConsent(consent: Exclude<MarketingConsent, null>) {
  window.localStorage.setItem(CONSENT_KEY, consent);
  window.dispatchEvent(new CustomEvent("crazycart:consent-change", { detail: { consent } }));
}

export function clearMarketingConsent() {
  window.localStorage.removeItem(CONSENT_KEY);
  window.dispatchEvent(new CustomEvent("crazycart:consent-change", { detail: { consent: null } }));
}
