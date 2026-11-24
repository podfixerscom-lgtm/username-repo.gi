"use client";

import { useEffect } from "react";
import { trackStorefrontEvent } from "@/lib/marketing/client";

export function ProductViewEvent({ productId, name, price }: { productId: string; name: string; price: string }) {
  useEffect(() => {
    trackStorefrontEvent("ViewContent", {
      content_ids: [productId],
      content_name: name,
      value: Number(price),
      currency: "BDT",
    });
  }, [productId, name, price]);
  return null;
}
