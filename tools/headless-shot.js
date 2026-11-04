// Headless Edge screenshot + page probe over the DevTools protocol, using
// Node's built-in WebSocket (Node 22+; no npm packages). Lets an agent see a
// page and read its state when no browser automation is available.
// usage: node tools/headless-shot.js <url> <out.png> [waitMs] [jsExpression]
// viewport: 1440x900 by default; set SHOT_W / SHOT_H to override.
// Prints console output and the expression's JSON value, saves a viewport screenshot.
const { spawn } = require("child_process");
const fs = require("fs");
const http = require("http");

const [url, out, waitArg, expr] = process.argv.slice(2);
const waitMs = Number(waitArg || 6000);
const port = 9333 + Math.floor(Math.random() * 500);
const edge = "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe";
const profile = require("path").join(__dirname, "cdp-profile-" + port);
const proc = spawn(edge, [
  "--headless=new", "--disable-gpu", "--no-first-run", "--disable-extensions",
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  "--window-size=1440,900", "--hide-scrollbars", "about:blank",
], { stdio: "ignore" });

const getJSON = (p) => new Promise((res, rej) => {
  http.get({ host: "127.0.0.1", port, path: p }, (r) => {
    let b = ""; r.on("data", (c) => (b += c)); r.on("end", () => { try { res(JSON.parse(b)); } catch (e) { rej(e); } });
  }).on("error", rej);
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  let targets = null;
  for (let i = 0; i < 50 && !targets; i++) {
    try { targets = (await getJSON("/json")).filter((t) => t.type === "page"); } catch { await sleep(200); }
  }
  if (!targets || !targets.length) throw new Error("no page target");
  const ws = new WebSocket(targets[0].webSocketDebuggerUrl);
  await new Promise((r) => (ws.onopen = r));
  let id = 0; const pending = new Map(); const events = [];
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    else if (msg.method) events.push(msg);
  };
  const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  await send("Page.enable"); await send("Runtime.enable"); await send("Log.enable"); await send("Network.enable");
  const W = Number(process.env.SHOT_W || 1440), H = Number(process.env.SHOT_H || 900);
  await send("Emulation.setDeviceMetricsOverride", { width: W, height: H, deviceScaleFactor: 1, mobile: false });
  await send("Page.navigate", { url });
  await sleep(waitMs);
  // SHOT_DRAG="x1,y1,x2,y2[,steps]": a trusted left-button drag (real input
  // events through the browser, not synthetic DOM events) before evaluating
  if (process.env.SHOT_DRAG) {
    const [x1, y1, x2, y2, st] = process.env.SHOT_DRAG.split(",").map(Number);
    const steps = st || 30;
    await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x1, y: y1 });
    await send("Input.dispatchMouseEvent", { type: "mousePressed", x: x1, y: y1, button: "left", buttons: 1, clickCount: 1 });
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: x1 + (x2 - x1) * t, y: y1 + (y2 - y1) * t + Math.sin(t * 9) * 30, button: "left", buttons: 1 });
      await sleep(16);
    }
    await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: x2, y: y2, button: "left", buttons: 0, clickCount: 1 });
    await sleep(Number(process.env.SHOT_DRAG_WAIT || 2500));
  }
  const logs = events.filter((e) => e.method === "Runtime.consoleAPICalled" || e.method === "Runtime.exceptionThrown" || e.method === "Log.entryAdded")
    .map((e) => e.method === "Runtime.consoleAPICalled" ? e.params.type + ": " + e.params.args.map((a) => a.value ?? a.description).join(" ")
      : e.method === "Runtime.exceptionThrown" ? "EXCEPTION: " + (e.params.exceptionDetails.exception?.description || e.params.exceptionDetails.text)
      : "LOG " + e.params.entry.level + ": " + e.params.entry.text);
  console.log("console:\n" + (logs.join("\n") || "(none)"));
  const bad = events.filter((e) => e.method === "Network.responseReceived" && e.params.response.status >= 400)
    .map((e) => e.params.response.status + " " + e.params.response.url);
  const failed = events.filter((e) => e.method === "Network.loadingFailed").map((e) => "FAILED " + (e.params.errorText || "") + " " + e.params.requestId);
  console.log("network problems:\n" + (bad.concat(failed).join("\n") || "(none)"));
  if (expr) {
    const r = await send("Runtime.evaluate", { expression: expr, returnByValue: true, awaitPromise: true });
    console.log("eval:", JSON.stringify(r.result?.result?.value ?? r.result?.exceptionDetails?.text ?? r, null, 1));
  }
  const shot = await send("Page.captureScreenshot", { format: "png" });
  fs.writeFileSync(out, Buffer.from(shot.result.data, "base64"));
  console.log("saved", out);
  ws.close(); proc.kill();
  await sleep(300);
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
})().catch((e) => { console.error(e); proc.kill(); process.exit(1); });
