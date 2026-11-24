"use client";

import { useSyncExternalStore } from "react";
import {
  getMarketingConsent,
  clearMarketingConsent,
  subscribeToMarketingConsent,
  updateMarketingConsent,
} from "@/lib/marketing/consent";

export function ConsentBanner() {
  const consent = useSyncExternalStore(subscribeToMarketingConsent, getMarketingConsent, () => null);

  if (consent !== null) {
    return (
      <button className="consent-preferences" type="button" onClick={clearMarketingConsent}>
        Marketing preferences
      </button>
    );
  }
  return (
    <aside className="consent-banner" aria-labelledby="consent-title">
      <div>
        <h2 id="consent-title">ঐচ্ছিক analytics ও marketing</h2>
        <p>আপনার সম্মতি ছাড়া marketing event provider-এ কোনো event পাঠানো হবে না।</p>
      </div>
      <div className="consent-actions">
        <button type="button" onClick={() => {
          updateMarketingConsent("denied");
        }}>না, ধন্যবাদ</button>
        <button type="button" onClick={() => {
          updateMarketingConsent("granted");
        }}>সম্মতি দিন</button>
      </div>
    </aside>
  );
}
