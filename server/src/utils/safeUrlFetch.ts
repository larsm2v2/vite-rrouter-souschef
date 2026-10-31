import { lookup } from "dns/promises";
import http from "http";
import https from "https";
import net, { LookupFunction } from "net";
import { URL } from "url";

const MAX_HTML_BYTES = 3 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;

interface FetchResponse {
  statusCode: number;
  headers: http.IncomingHttpHeaders;
  body: Buffer;
}

function isPublicIpv4(address: string): boolean {
  const octets = address.split(".").map(Number);
  if (octets.length !== 4 || octets.some((part) => part < 0 || part > 255)) {
    return false;
  }
  const [first, second, third] = octets;

  return !(
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 192 && second === 0 && (third === 0 || third === 2)) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 198 && (second === 18 || second === 19 || second === 51)) ||
    (first === 203 && second === 0 && third === 113)
  );
}

function expandIpv6(address: string): number[] | null {
  const normalized = address.toLowerCase().split("%")[0];
  if (!normalized || normalized.includes(".")) return null;

  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const left = halves[0] ? halves[0].split(":") : [];
  const right = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - left.length - right.length;
  if ((halves.length === 1 && missing !== 0) || missing < 0) return null;

  const groups = [
    ...left,
    ...Array(halves.length === 2 ? missing : 0).fill("0"),
    ...right,
  ].map((part) => Number.parseInt(part, 16));
  if (
    groups.length !== 8 ||
    groups.some((part) => !Number.isInteger(part) || part < 0 || part > 0xffff)
  ) {
    return null;
  }
  return groups;
}

export function isPublicIp(address: string): boolean {
  const family = net.isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family !== 6) return false;

  const groups = expandIpv6(address);
  if (!groups) return false;
  const [first, second, third] = groups;

  // Allow global-unicast 2000::/3, excluding special-purpose ranges.
  if (first < 0x2000 || first > 0x3fff) return false;
  if (
    first === 0x2001 &&
    (second === 0x0db8 || second === 0 || second === 0x0020)
  ) {
    return false;
  }
  return !(
    first === 0x2002 ||
    (first === 0x2001 && second === 0 && third === 0)
  );
}

function validateUrl(input: string): URL {
  if (input.length > 2048) throw new Error("URL is too long");

  let url: URL;
  try {
    url = new URL(input);
  } catch {
    throw new Error("A valid recipe URL is required");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Only HTTP and HTTPS recipe URLs are supported");
  }
  if (url.username || url.password) {
    throw new Error("URLs containing credentials are not allowed");
  }
  if (url.port && url.port !== (url.protocol === "https:" ? "443" : "80")) {
    throw new Error("Nonstandard URL ports are not allowed");
  }

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const bareHostname = hostname.replace(/^\[|\]$/g, "");
  if (
    !hostname ||
    net.isIP(bareHostname) ||
    hostname === "localhost" ||
    /\.(localhost|local|internal|test|invalid|example|home\.arpa)$/.test(
      hostname,
    )
  ) {
    throw new Error("This host is not allowed");
  }
  return url;
}

async function resolvePublicAddresses(hostname: string, timeoutMs: number) {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    const addresses = await Promise.race([
      lookup(hostname, { all: true, verbatim: true }),
      new Promise<never>((_, reject) => {
        timeout = setTimeout(
          () => reject(new Error("The recipe page request timed out")),
          timeoutMs,
        );
      }),
    ]);
    if (
      addresses.length === 0 ||
      addresses.some(({ address }) => !isPublicIp(address))
    ) {
      throw new Error("This host is not allowed");
    }
    return addresses;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function createPinnedAgent(
  url: URL,
  addresses: Awaited<ReturnType<typeof resolvePublicAddresses>>,
) {
  const pinnedLookup = ((
    _hostname: string,
    options: number | { all?: boolean },
    callback: (...args: unknown[]) => void,
  ) => {
    const first = addresses[0];
    if (typeof options === "object" && options.all) {
      callback(null, addresses);
    } else {
      callback(null, first.address, first.family);
    }
  }) as unknown as LookupFunction;

  return url.protocol === "https:"
    ? new https.Agent({ lookup: pinnedLookup, keepAlive: false })
    : new http.Agent({ lookup: pinnedLookup, keepAlive: false });
}

function requestOnce(
  url: URL,
  addresses: Awaited<ReturnType<typeof resolvePublicAddresses>>,
  timeoutMs: number,
): Promise<FetchResponse> {
  return new Promise((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const agent = createPinnedAgent(url, addresses);
    const request = transport.request(
      {
        protocol: url.protocol,
        hostname: url.hostname.replace(/^\[|\]$/g, ""),
        port: url.port || undefined,
        path: `${url.pathname}${url.search}`,
        method: "GET",
        agent,
        headers: {
          Accept: "text/html,application/xhtml+xml",
          "User-Agent": "SousChefRecipeImporter/1.0",
          Connection: "close",
        },
      },
      (response) => {
        const statusCode = response.statusCode || 0;
        const contentLength = Number(response.headers["content-length"] || 0);
        if (contentLength > MAX_HTML_BYTES) {
          response.destroy();
          agent.destroy();
          reject(new Error("The recipe page is too large"));
          return;
        }

        const chunks: Buffer[] = [];
        let totalBytes = 0;
        response.on("data", (chunk: Buffer | string) => {
          const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
          totalBytes += buffer.length;
          if (totalBytes > MAX_HTML_BYTES) {
            response.destroy(new Error("The recipe page is too large"));
            return;
          }
          chunks.push(buffer);
        });
        response.on("end", () => {
          agent.destroy();
          resolve({
            statusCode,
            headers: response.headers,
            body: Buffer.concat(chunks),
          });
        });
        response.on("error", (error) => {
          agent.destroy();
          reject(error);
        });
      },
    );

    const timeout = setTimeout(
      () => request.destroy(new Error("The recipe page request timed out")),
      timeoutMs,
    );
    request.on("error", (error) => {
      clearTimeout(timeout);
      agent.destroy();
      reject(error);
    });
    request.on("close", () => clearTimeout(timeout));
    request.end();
  });
}

export async function fetchPublicHtml(input: string): Promise<string> {
  let currentUrl = validateUrl(input);
  const deadline = Date.now() + REQUEST_TIMEOUT_MS;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount++) {
    const timeoutMs = deadline - Date.now();
    if (timeoutMs <= 0) throw new Error("The recipe page request timed out");

    const hostname = currentUrl.hostname.replace(/^\[|\]$/g, "");
    const addresses = await resolvePublicAddresses(hostname, timeoutMs);
    const response = await requestOnce(
      currentUrl,
      addresses,
      deadline - Date.now(),
    );

    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = response.headers.location;
      if (!location || redirectCount === MAX_REDIRECTS) {
        throw new Error("The recipe page redirected too many times");
      }
      currentUrl = validateUrl(new URL(location, currentUrl).toString());
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new Error("The recipe page could not be fetched");
    }

    const contentType = response.headers["content-type"] || "";
    if (!/^(text\/html|application\/xhtml\+xml)(?:;|$)/i.test(contentType)) {
      throw new Error("The URL did not return an HTML page");
    }
    return response.body.toString("utf8");
  }

  throw new Error("The recipe page redirected too many times");
}
