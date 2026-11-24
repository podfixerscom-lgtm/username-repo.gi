import type { CourierProvider } from "@/generated/prisma/client";

export type CourierCredentials = Record<string, string>;

export type CourierShipmentInput = {
  orderId: string;
  orderNumber: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  city: string;
  area: string | null;
  cashCollectionBDT: number;
  weightGrams: number;
  itemSummary: string;
};

export type CourierBookingResult = {
  trackingNumber: string | null;
  consignmentId: string | null;
};

export type CourierTrackingResult = {
  status: "IN_TRANSIT" | "DELIVERED" | "RETURNED" | "CANCELLED" | "BOOKED";
  trackingNumber: string | null;
  consignmentId: string | null;
};

export interface CourierAdapter {
  readonly provider: CourierProvider;
  testConnection(credentials: CourierCredentials): Promise<void>;
  createBooking(
    credentials: CourierCredentials,
    shipment: CourierShipmentInput,
    idempotencyKey: string,
  ): Promise<CourierBookingResult>;
  track(
    credentials: CourierCredentials,
    booking: CourierBookingResult,
  ): Promise<CourierTrackingResult>;
}

export class CourierAdapterError extends Error {
  constructor(
    message: string,
    readonly outcomeUnknown = false,
  ) {
    super(message);
    this.name = "CourierAdapterError";
  }
}

export async function requestCourierJson(
  url: string,
  init: RequestInit,
  requestMayHaveCreatedShipment = false,
): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      cache: "no-store",
      redirect: "error",
      signal: AbortSignal.timeout(12_000),
    });
  } catch {
    throw new CourierAdapterError(
      "Courier request did not complete. Check the provider portal before retrying.",
      requestMayHaveCreatedShipment,
    );
  }

  if (!response.ok) {
    throw new CourierAdapterError(
      `Courier provider rejected the request (HTTP ${response.status}).`,
      requestMayHaveCreatedShipment && response.status >= 500,
    );
  }
  const contentLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(contentLength) && contentLength > 64 * 1024) {
    throw new CourierAdapterError("Courier provider response exceeds the 64 KB limit.", requestMayHaveCreatedShipment);
  }
  if (!response.body) {
    throw new CourierAdapterError("Courier provider returned an empty response.", requestMayHaveCreatedShipment);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > 64 * 1024) {
      await reader.cancel();
      throw new CourierAdapterError("Courier provider response exceeds the 64 KB limit.", requestMayHaveCreatedShipment);
    }
    chunks.push(value);
  }
  const body = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(body) as unknown;
  } catch {
    throw new CourierAdapterError("Courier provider returned invalid JSON.", requestMayHaveCreatedShipment);
  }
}
