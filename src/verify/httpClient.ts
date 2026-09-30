import http from "node:http";

// Node's global fetch (undici) reuses a small keep-alive connection pool per origin by default,
// which serializes requests that are meant to race — defeating the whole point of the concurrent
// race-condition check. This client opens a fresh, non-pooled connection per request instead, so
// N "concurrent" requests really do hit the server at once.
const agent = new http.Agent({ keepAlive: false, maxSockets: Infinity });

export interface RaceRequestOptions {
  method: string;
  headers?: Record<string, string>;
  body?: string;
}

export function fireStatus(url: string, opts: RaceRequestOptions): Promise<number> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const req = http.request(
      {
        agent,
        hostname: u.hostname,
        port: u.port,
        path: `${u.pathname}${u.search}`,
        method: opts.method,
        headers: opts.headers,
      },
      (res) => {
        res.resume(); // drain, we only need the status
        res.on("end", () => resolve(res.statusCode ?? 0));
      }
    );
    req.on("error", reject);
    if (opts.body) req.write(opts.body);
    req.end();
  });
}
