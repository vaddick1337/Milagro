// Скриншоты через Chrome DevTools Protocol: реальные вьюпорты 375/768/1024/1440,
// клики по интерфейсу и снимок диалогов. Требует запуска Chrome (не в песочнице).
//
// node tools/shoot.mjs <url> <out.png> <width> <height> [--mobile] [--wait 1500] [--script "js"]
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const [url, out, widthArg, heightArg, ...rest] = process.argv.slice(2);
if (!url || !out) {
  console.error("usage: node tools/shoot.mjs <url> <out.png> <w> <h> [--mobile] [--wait ms] [--script js]");
  process.exit(2);
}
const width = Number(widthArg) || 1440;
const height = Number(heightArg) || 1200;
const mobile = rest.includes("--mobile");
const waitIndex = rest.indexOf("--wait");
const waitMs = waitIndex >= 0 ? Number(rest[waitIndex + 1]) : 1500;
const scriptIndex = rest.indexOf("--script");
const scriptFileIndex = rest.indexOf("--script-file");
let script = scriptIndex >= 0 ? rest[scriptIndex + 1] : "";
if (scriptFileIndex >= 0) {
  script = fs.readFileSync(rest[scriptFileIndex + 1], "utf8");
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-chrome-"));
const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    "--remote-debugging-port=0",
    "--user-data-dir=" + profile,
    "about:blank"
  ],
  { stdio: ["ignore", "pipe", "pipe"] }
);

const wsUrl = await new Promise((resolve, reject) => {
  let buffer = "";
  const timer = setTimeout(() => reject(new Error("Chrome не отдал DevTools URL: " + buffer)), 20000);
  chrome.stderr.on("data", (chunk) => {
    buffer += chunk.toString();
    const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) {
      clearTimeout(timer);
      resolve(match[1]);
    }
  });
  chrome.on("exit", (code) => {
    clearTimeout(timer);
    reject(new Error("Chrome завершился с кодом " + code + ": " + buffer));
  });
});

const socket = new WebSocket(wsUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const listeners = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(JSON.stringify(message.error)));
    else resolve(message.result);
    return;
  }
  listeners.forEach((listener) => listener(message));
});

function send(method, params = {}, sessionId) {
  const id = nextId++;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params, sessionId }));
  });
}

function waitForEvent(eventName, sessionId, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("не дождались " + eventName)), timeout);
    const listener = (message) => {
      if (message.method === eventName) {
        clearTimeout(timer);
        listeners.splice(listeners.indexOf(listener), 1);
        resolve(message.params);
      }
    };
    listeners.push(listener);
  });
}

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });

await send("Page.enable", {}, sessionId);
await send("Emulation.setDeviceMetricsOverride", {
  width,
  height,
  deviceScaleFactor: 1,
  mobile,
  screenWidth: width,
  screenHeight: height
}, sessionId);

const loaded = waitForEvent("Page.loadEventFired", sessionId);
await send("Page.navigate", { url }, sessionId);
await loaded;
await new Promise((resolve) => setTimeout(resolve, waitMs));

if (script) {
  const result = await send("Runtime.evaluate", {
    expression: script,
    awaitPromise: true,
    returnByValue: true
  }, sessionId);
  if (result.exceptionDetails) {
    console.error("script error:", JSON.stringify(result.exceptionDetails));
  } else if (result.result && result.result.value !== undefined) {
    console.log("script:", JSON.stringify(result.result.value));
  }
  await new Promise((resolve) => setTimeout(resolve, waitMs));
}

const metrics = await send("Page.getLayoutMetrics", {}, sessionId);
const content = metrics.cssContentSize || metrics.contentSize;
const viewportOnly = rest.includes("--viewport-only");
const shotHeight = viewportOnly ? height : Math.min(Math.max(height, Math.ceil(content.height)), 6000);

const screenshot = await send("Page.captureScreenshot", {
  format: "png",
  captureBeyondViewport: !viewportOnly,
  clip: { x: 0, y: 0, width, height: shotHeight, scale: 1 }
}, sessionId);

fs.writeFileSync(out, Buffer.from(screenshot.data, "base64"));
console.log("saved", out, width + "x" + shotHeight, "scrollWidth:", content.width);

socket.close();
chrome.kill();
setTimeout(() => {
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(0);
}, 400);
