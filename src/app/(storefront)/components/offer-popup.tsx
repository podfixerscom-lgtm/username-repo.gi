"use client";

import { useCallback, useSyncExternalStore } from "react";

const dismissedOffers = new Set<string>();

export function StorefrontOfferPopup({
  offer,
}: {
  offer: { id: string; title: string; description: string };
}) {
  const storageKey = `crazy-cart.offer.${offer.id}`;
  const subscribe = useCallback((onChange: () => void) => {
    const eventName = `crazycart:offer-dismissed:${offer.id}`;
    window.addEventListener(eventName, onChange);
    return () => window.removeEventListener(eventName, onChange);
  }, [offer.id]);
  const getSnapshot = useCallback(() => {
    if (dismissedOffers.has(offer.id)) return false;
    try {
      return window.sessionStorage.getItem(storageKey) !== "dismissed";
    } catch (error) {
      console.error("Could not read offer dismissal state.", error);
      return true;
    }
  }, [offer.id, storageKey]);
  const visible = useSyncExternalStore(subscribe, getSnapshot, () => true);

  if (!visible) return null;
  return (
    <aside className="offer-toast" aria-labelledby="offer-toast-title" role="status" aria-live="polite">
      <button
        className="offer-dismiss"
        type="button"
        aria-label="অফার বার্তা বন্ধ করুন"
        onClick={() => {
          dismissedOffers.add(offer.id);
          try {
            window.sessionStorage.setItem(storageKey, "dismissed");
          } catch (error) {
            console.error("Could not save offer dismissal state.", error);
          }
          window.dispatchEvent(new Event(`crazycart:offer-dismissed:${offer.id}`));
        }}
      >
        বন্ধ
      </button>
      <h2 id="offer-toast-title">{offer.title}</h2>
      <p>{offer.description}</p>
      <a href="/offers">সব অফার দেখুন</a>
    </aside>
  );
}
