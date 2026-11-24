export type PosSource = "POS" | "FACEBOOK" | "PHONE";
export type OfflineSaleState = "QUEUED" | "SYNCING" | "NEEDS_REVIEW" | "SYNCED";

export type OfflineSaleLine = {
  variantId: string;
  quantity: number;
};

export type OfflineSale = {
  idempotencyKey: string;
  source: PosSource;
  customerName: string;
  customerPhone: string;
  lines: OfflineSaleLine[];
  createdAt: string;
  state: OfflineSaleState;
  syncStartedAt?: string;
  error?: string;
  orderId?: string;
  orderNumber?: string;
  total?: string;
};

const DATABASE_NAME = "crazy-cart-pos";
const DATABASE_VERSION = 1;
const STORE_NAME = "offline-sales";
const SYNC_LEASE_MS = 5 * 60 * 1000;
let databasePromise: Promise<IDBDatabase> | null = null;
const EMPTY_SALES: OfflineSale[] = [];
let salesSnapshot = EMPTY_SALES;
let queueErrorSnapshot = "";
let refreshPromise: Promise<void> | null = null;
const queueSubscribers = new Set<() => void>();

function openDatabase(): Promise<IDBDatabase> {
  if (typeof indexedDB === "undefined") {
    return Promise.reject(new Error("Offline sales storage is not available in this browser."));
  }
  if (databasePromise) return databasePromise;

  databasePromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME, { keyPath: "idempotencyKey" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new Error("Could not open offline sales storage."));
    request.onblocked = () => reject(new Error("Offline sales storage is blocked by another tab."));
  });
  return databasePromise;
}

export function recoverStaleSyncs(sales: OfflineSale[], now = Date.now()): OfflineSale[] {
  return sales.map((sale) => {
    if (sale.state !== "SYNCING") return sale;
    const syncStartedAt = Date.parse(sale.syncStartedAt ?? "");
    if (Number.isFinite(syncStartedAt) && now - syncStartedAt < SYNC_LEASE_MS) return sale;
    return {
      ...sale,
      state: "QUEUED",
      syncStartedAt: undefined,
      error: "A previous sync was interrupted. Retrying is safe.",
    };
  });
}

export async function listOfflineSales(): Promise<OfflineSale[]> {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    let sales: OfflineSale[] = [];
    request.onsuccess = () => {
      const currentSales = request.result as OfflineSale[];
      const recoveredSales = recoverStaleSyncs(currentSales);
      for (let index = 0; index < currentSales.length; index += 1) {
        if (recoveredSales[index] !== currentSales[index]) store.put(recoveredSales[index]);
      }
      sales = recoveredSales.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    };
    request.onerror = () => reject(request.error ?? new Error("Could not load queued sales."));
    transaction.oncomplete = () => resolve(sales);
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not read queued sales."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Could not read queued sales."));
  });
}

export function subscribeOfflineQueue(onChange: () => void) {
  queueSubscribers.add(onChange);
  void refreshOfflineQueue();
  return () => queueSubscribers.delete(onChange);
}

export function getOfflineQueueSnapshot() {
  return salesSnapshot;
}

export function getServerOfflineQueueSnapshot() {
  return EMPTY_SALES;
}

export function getOfflineQueueErrorSnapshot() {
  return queueErrorSnapshot;
}

export function getServerOfflineQueueErrorSnapshot() {
  return "";
}

async function refreshOfflineQueue() {
  if (refreshPromise) return refreshPromise;
  refreshPromise = (async () => {
    try {
      salesSnapshot = await listOfflineSales();
      queueErrorSnapshot = "";
    } catch (error) {
      queueErrorSnapshot = error instanceof Error ? error.message : "Could not read offline queue.";
    }
    for (const subscriber of queueSubscribers) subscriber();
  })();
  try {
    await refreshPromise;
  } finally {
    refreshPromise = null;
  }
}

export async function saveOfflineSale(sale: OfflineSale): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).put(sale);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not save offline sale."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline sale was not saved."));
  });
  await refreshOfflineQueue();
}

export async function removeOfflineSale(idempotencyKey: string): Promise<void> {
  const database = await openDatabase();
  await new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, "readwrite");
    transaction.objectStore(STORE_NAME).delete(idempotencyKey);
    transaction.oncomplete = () => resolve();
    transaction.onerror = () => reject(transaction.error ?? new Error("Could not remove offline sale."));
    transaction.onabort = () => reject(transaction.error ?? new Error("Offline sale was not removed."));
  });
  await refreshOfflineQueue();
}
