import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { fileURLToPath } from "node:url";
import { statSync } from "node:fs";

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const python = fileURLToPath(new URL("../../.venv/bin/python", import.meta.url));
const script = fileURLToPath(new URL("../tools/trade_replay.py", import.meta.url));
const loopback = value => ["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(value);

export default function localTradeReplay() {
  let worker;
  let workerStamp;
  let pending;
  let queue = Promise.resolve();
  function stop() {
    worker?.kill(); worker = undefined;
    pending?.reject(new Error("The replay worker stopped. Try opening the chart again."));
    pending = undefined;
  }
  function start() {
    if (worker && workerStamp !== statSync(script).mtimeMs) stop();
    if (worker) return;
    workerStamp = statSync(script).mtimeMs;
    worker = spawn(python, ["-B", script], { cwd: ROOT, stdio: ["pipe", "pipe", "pipe"], env: { ...process.env, PYTHONDONTWRITEBYTECODE: "1" } });
    const child = worker;
    // Python stdout is a strict JSON protocol. Keep diagnostics off HTTP responses.
    child.stderr.on("data", chunk => console.error("[trade replay]", chunk.toString()));
    createInterface({ input: child.stdout }).on("line", line => {
      if (!pending) return;
      const job = pending; pending = undefined;
      try {
        const response = JSON.parse(line);
        if (response.error) job.reject(new Error(response.error)); else job.resolve(response.data);
      } catch { job.reject(new Error("The replay worker returned an unreadable response.")); }
    });
    child.on("error", () => { if (worker === child) stop(); });
    child.on("exit", () => { if (worker === child) stop(); });
  }
  function request(input) {
    const job = queue.then(() => new Promise((resolve, reject) => {
      start();
      const timer = setTimeout(() => { stop(); reject(new Error("Replay took too long. Try again after checking the local tester.")); }, 240_000);
      pending = {
        resolve: value => { clearTimeout(timer); resolve(value); },
        reject: error => { clearTimeout(timer); reject(error); },
      };
      worker.stdin.write(JSON.stringify(input) + "\n", error => { if (error) stop(); });
    }));
    queue = job.catch(() => {});
    return job;
  }
  return {
    name: "local-trade-replay",
    hooks: {
      "astro:server:setup": ({ server }) => {
        server.httpServer?.once("close", stop);
        server.middlewares.use(async (req, res, next) => {
          const url = new URL(req.url ?? "/", "http://localhost");
          if (!["/__trade-replay", "/__trade-replay/status"].includes(url.pathname)) return next();
          const send = (status, value) => {
            res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" });
            res.end(JSON.stringify(value));
          };
          const host = req.headers.host;
          let localHost = false;
          try { localHost = ["localhost", "127.0.0.1", "[::1]"].includes(new URL(`http://${host}`).hostname); } catch {}
          if (!loopback(req.socket.remoteAddress) || !localHost ||
              (req.headers.origin && req.headers.origin !== `http://${host}`) ||
              (req.headers["sec-fetch-site"] && !["same-origin", "none"].includes(req.headers["sec-fetch-site"]))) {
            return send(403, { error: "Real-price charts are available on localhost only." });
          }
          if (req.method !== "GET") return send(405, { error: "Use GET." });
          if (url.pathname.endsWith("/status")) return send(200, { available: true });
          const { strategy, key, day, generated } = Object.fromEntries(url.searchParams);
          if (!["fair_price_reversal", "supertrend_kalman", "tupa_trade"].includes(strategy) ||
              !/^f(?:[12]|1m)-[a-z0-9_-]{1,100}$/.test(key ?? "") || !/^\d{4}-\d{2}-\d{2}$/.test(day ?? "") ||
              !generated) {
            return send(400, { error: "Choose a valid strategy, result and Malaysian day." });
          }
          try { send(200, await request({ strategy, key, day, slippage: 0, generated })); }
          catch (error) { send(422, { error: error.message }); }
        });
      },
      "astro:server:done": stop,
    },
  };
}
