// Забирает фотографии из карточки Milagro на Яндекс Картах через headless Chrome.
// Режимы:
//   node tools/grab_photos.mjs discover   — только показать найденные URL
//   node tools/grab_photos.mjs download   — скачать в assets/photos/incoming/raw
import { spawn } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const CHROME = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const here = path.dirname(fileURLToPath(import.meta.url));
const FRONT = path.join(here, "..", "frontend");
const RAW = path.join(FRONT, "assets", "photos", "incoming", "raw");
const ORG = process.argv[3] || "https://yandex.ru/maps/org/milagro/49020909994/";
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/158.0.0.0 Safari/537.36";

const mode = process.argv[2] || "discover";

fs.mkdirSync(RAW, { recursive: true });
const profile = fs.mkdtempSync(path.join(os.tmpdir(), "dsh-grab-"));
const chrome = spawn(CHROME, [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--no-default-browser-check",
  "--hide-scrollbars",
  "--disable-blink-features=AutomationControlled",
  "--lang=ru-RU",
  "--remote-debugging-port=0",
  "--user-data-dir=" + profile,
  "about:blank"
], { stdio: ["ignore", "pipe", "pipe"] });

const wsUrl = await new Promise((resolve, reject) => {
  let buffer = "";
  const timer = setTimeout(() => reject(new Error("нет DevTools URL: " + buffer)), 20000);
  chrome.stderr.on("data", (chunk) => {
    buffer += chunk.toString();
    const match = buffer.match(/DevTools listening on (ws:\/\/\S+)/);
    if (match) { clearTimeout(timer); resolve(match[1]); }
  });
});
const socket = new WebSocket(wsUrl);
await new Promise((res, rej) => {
  socket.addEventListener("open", res, { once: true });
  socket.addEventListener("error", rej, { once: true });
});

let nextId = 1;
const pending = new Map();
const listeners = [];
socket.addEventListener("message", (event) => {
  const message = JSON.parse(event.data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(JSON.stringify(message.error))) : resolve(message.result);
    return;
  }
  listeners.forEach((fn) => fn(message));
});
const send = (method, params = {}, sessionId) => new Promise((resolve, reject) => {
  const id = nextId++;
  pending.set(id, { resolve, reject });
  socket.send(JSON.stringify({ id, method, params, sessionId }));
});
const waitEvent = (name, sessionId, timeout = 20000) => new Promise((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("нет события " + name)), timeout);
  const fn = (m) => {
    if (m.method === name) { clearTimeout(timer); listeners.splice(listeners.indexOf(fn), 1); resolve(m.params); }
  };
  listeners.push(fn);
});

const { targetId } = await send("Target.createTarget", { url: "about:blank" });
const { sessionId } = await send("Target.attachToTarget", { targetId, flatten: true });
await send("Page.enable", {}, sessionId);
await send("Network.enable", {}, sessionId);
await send("Emulation.setUserAgentOverride", { userAgent: UA, acceptLanguage: "ru-RU,ru" }, sessionId);
await send("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false }, sessionId);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function evaluate(expression) {
  const result = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true }, sessionId);
  if (result.exceptionDetails) throw new Error(JSON.stringify(result.exceptionDetails).slice(0, 400));
  return result.result.value;
}

console.log("→ открываю", ORG);
const loaded = waitEvent("Page.loadEventFired", sessionId).catch(() => null);
await send("Page.navigate", { url: ORG }, sessionId);
await loaded;
await sleep(2500);

// Согласие на cookie/уведомления, если всплыло.
await evaluate(`(() => {
  const words = ["Принять", "Принять все", "Хорошо", "Понятно", "Закрыть"];
  let clicked = 0;
  document.querySelectorAll("button, a, span").forEach((el) => {
    const text = (el.textContent || "").trim();
    if (words.includes(text) && el.offsetParent !== null) { el.click(); clicked++; }
  });
  return clicked;
})()`).catch(() => {});
await sleep(800);

// Прокрутка, чтобы догрузились ленивые картинки и галерея.
for (let i = 0; i < 4; i += 1) {
  await evaluate("window.scrollBy(0, window.innerHeight * 0.9)").catch(() => {});
  await sleep(900);
}

const collected = await evaluate(`(() => {
  const urls = new Set();
  document.querySelectorAll("img").forEach((img) => {
    const src = img.currentSrc || img.src;
    if (src) urls.add(src);
  });
  document.querySelectorAll("*").forEach((el) => {
    const bg = getComputedStyle(el).backgroundImage;
    if (bg && bg !== "none") {
      const m = bg.match(/url\\("?([^")]+)"?\\)/);
      if (m) urls.add(m[1]);
    }
  });
  const photoLinks = Array.from(document.querySelectorAll("a"))
    .map((a) => a.href)
    .filter((href) => /photo|gallery/i.test(href));
  return {
    title: document.title,
    urls: Array.from(urls),
    photoLinks: Array.from(new Set(photoLinks)).slice(0, 10)
  };
})()`);

console.log("страница:", collected.title);
console.log("всего URL картинок:", collected.urls.length);
const yandexImages = collected.urls.filter((u) => /avatars\\.mds\\.yandex\\.net|get-altay|get-maps|get-ya/i.test(u));
const other = collected.urls.filter((u) => !yandexImages.includes(u));
console.log("яндекс-картинок:", yandexImages.length);
yandexImages.slice(0, 40).forEach((u) => console.log("  ", u.slice(0, 160)));
console.log("прочие:", other.length);
other.slice(0, 10).forEach((u) => console.log("  ", u.slice(0, 160)));
if (collected.photoLinks.length) {
  console.log("ссылки на фото:", collected.photoLinks);
}

if (mode === "download") {
  const targets = yandexImages
    .filter((u) => /get-altay|get-maps|get-ya/i.test(u))
    .slice(0, 24);
  console.log("скачиваю:", targets.length);
  let index = 0;
  for (const url of targets) {
    index += 1;
    try {
      const dataUrl = await evaluate(`(async () => {
        const response = await fetch(${JSON.stringify(url)}, { credentials: "omit" });
        if (!response.ok) return "HTTP " + response.status;
        const buffer = await response.arrayBuffer();
        if (buffer.byteLength < 20000) return "small " + buffer.byteLength;
        let binary = "";
        const bytes = new Uint8Array(buffer);
        const chunk = 0x8000;
        for (let i = 0; i < bytes.length; i += chunk) {
          binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
        }
        return "data:" + (response.headers.get("content-type") || "image/jpeg") + ";base64," + btoa(binary);
      })()`);
      if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:")) {
        console.log("  пропуск", index, dataUrl);
        continue;
      }
      const [meta, base64] = dataUrl.split(",");
      const ext = /png/.test(meta) ? "png" : "jpg";
      const file = path.join(RAW, "photo-" + String(index).padStart(2, "0") + "." + ext);
      fs.writeFileSync(file, Buffer.from(base64, "base64"));
      console.log("  +", path.basename(file), Math.round(base64.length * 0.75 / 1024) + " КБ");
    } catch (error) {
      console.log("  ошибка", index, String(error).slice(0, 140));
    }
  }
}

socket.close();
chrome.kill();
setTimeout(() => {
  try { fs.rmSync(profile, { recursive: true, force: true }); } catch { /* ignore */ }
  process.exit(0);
}, 400);
