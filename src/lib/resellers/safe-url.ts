import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

function isPrivateIPv4(address: string): boolean {
  const [first, second, third] = address.split(".").map(Number);

  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && (second === 0 || second === 168)) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 203 && second === 0 && third === 113)
  );
}

function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    return isPrivateIPv4(address);
  }

  const normalized = address.toLowerCase().split("%")[0];
  if (normalized.startsWith("::ffff:")) {
    const mappedAddress = normalized.slice("::ffff:".length);
    return isIP(mappedAddress) === 4 && isPrivateIPv4(mappedAddress);
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    /^fe[89ab]/.test(normalized) ||
    normalized.startsWith("ff") ||
    normalized.startsWith("2001:db8:")
  );
}

export async function assertPublicHttpsUrl(value: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Reseller base URL must be a valid HTTPS URL.");
  }

  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  const blockedSuffixes = [
    ".localhost",
    ".local",
    ".internal",
    ".test",
    ".invalid",
    ".example",
  ];

  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash ||
    isIP(hostname) !== 0 ||
    hostname === "localhost" ||
    blockedSuffixes.some((suffix) => hostname.endsWith(suffix))
  ) {
    throw new Error("Reseller base URL must use a public HTTPS host.");
  }

  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (addresses.length === 0 || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new Error("Reseller host resolves to a non-public network address.");
  }

  return url;
}

export function createProductsUrl(baseUrl: URL, limit: number): URL {
  const url = new URL(baseUrl);
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/products`;
  url.searchParams.set("limit", String(limit));
  return url;
}
