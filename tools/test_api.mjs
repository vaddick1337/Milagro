// Интеграционный тест мок-слоя api.js без браузера: подменяем fetch и
// sessionStorage, прогоняем реальные сценарии магазина и админки.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";

const here = path.dirname(fileURLToPath(import.meta.url));
const FRONT = path.join(here, "..", "frontend");

const store = new Map();
globalThis.window = globalThis;
globalThis.sessionStorage = {
  getItem: (key) => (store.has(key) ? store.get(key) : null),
  setItem: (key, value) => store.set(key, String(value)),
  removeItem: (key) => store.delete(key)
};
globalThis.fetch = async (url) => {
  const file = path.join(FRONT, String(url));
  const text = fs.readFileSync(file, "utf8");
  return { ok: true, status: 200, json: async () => JSON.parse(text) };
};

vm.runInThisContext(fs.readFileSync(path.join(FRONT, "js", "api.js"), "utf8"), { filename: "api.js" });

const api = globalThis.api;
let passed = 0;
const failures = [];

function check(name, condition, extra) {
  if (condition) {
    passed += 1;
  } else {
    failures.push(name + (extra ? " — " + extra : ""));
  }
}

async function expectError(name, promise, expectedStatus, expectedField) {
  try {
    await promise;
    failures.push(name + " — ошибки не было");
  } catch (error) {
    const statusOk = error.status === expectedStatus;
    const fieldOk = !expectedField || (error.payload && error.payload.errors && error.payload.errors[expectedField]);
    check(name, statusOk && Boolean(fieldOk), "status=" + error.status + " payload=" + JSON.stringify(error.payload));
  }
}

const catalog = await api("/api/catalog");
check("каталог: 12–30 товаров", catalog.products.length >= 12 && catalog.products.length <= 30, String(catalog.products.length));
check("каталог: 3 категории", catalog.categories.length === 3);
check("фото товара p-02 — реальный JPEG", /\.jpg$/.test(catalog.products.find((p) => p.id === "p-02").image_url));
check("цена со скидкой считается", catalog.products.find((p) => p.id === "p-04").sale_price === 5270);
check("истёкшая скидка не активна", catalog.products.find((p) => p.id === "p-07").discount_active === false);
check("скидка суммой", catalog.products.find((p) => p.id === "p-11").sale_price === 7600);

const delivery = await api("/api/delivery");
check("11 слотов доставки", delivery.slots.length === 11);
check("11 слотов самовывоза", delivery.pickup_slots.length === 11);
check("слоты доставки начинаются в 09:30", delivery.slots[0].start === "09:30");
check("таймзона", delivery.timezone === "Asia/Yekaterinburg");

const branches = await api("/api/branches");
check("одна студия", branches.branches.length === 1);
check("координаты студии", branches.branches[0].lat === 61.24921);

const now = api.ekbNow();
const tomorrow = new Date(Date.UTC(...now.date.split("-").map((v, i) => (i === 1 ? Number(v) - 1 : Number(v)))));
tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
const tomorrowIso = tomorrow.toISOString().slice(0, 10);

const deliveryOrder = {
  name: "Тест Тестов",
  phone: "+7 900 000-00-00",
  email: "test@example.com",
  delivery_method: "delivery",
  delivery_zone: "z-city",
  address: "г. Сургут, ул. Тестовая, 1",
  delivery_date: tomorrowIso,
  delivery_slot: "12:30–13:30",
  recipient_phone: "+7 900 000-00-00",
  same_recipient: true,
  comment: "",
  items: [{ product_id: "p-01", quantity: 2 }],
  data_consent: true,
  offer_accepted: true,
  consent_version: "draft",
  privacy_version: "draft",
  offer_version: "draft"
};

const created = await api("/api/orders", { method: "POST", body: deliveryOrder });
check("заказ создан", created.success === true && Boolean(created.order_id));
check("сумма товаров посчитана", created.order.goods_total === 11800, created.order.goods_total);
check("версии документов в заказе", created.order.consents.consent_version === "draft");

const badPhone = { ...deliveryOrder, phone: "123" };
await expectError("телефон короче 10 цифр", api("/api/orders", { method: "POST", body: badPhone }), 422, "phone");

const badAddress = { ...deliveryOrder, address: "" };
await expectError("пустой адрес", api("/api/orders", { method: "POST", body: badAddress }), 422, "address");

const noConsent = { ...deliveryOrder, data_consent: false };
await expectError("нет согласия", api("/api/orders", { method: "POST", body: noConsent }), 422, "data_consent");

const noOffer = { ...deliveryOrder, offer_accepted: false };
await expectError("нет оферты", api("/api/orders", { method: "POST", body: noOffer }), 422, "offer_accepted");

const noSlot = { ...deliveryOrder, delivery_slot: "" };
await expectError("не выбран слот", api("/api/orders", { method: "POST", body: noSlot }), 422, "delivery_date");

const badSlot = { ...deliveryOrder, delivery_slot: "23:00–00:00" };
await expectError("слота нет в расписании", api("/api/orders", { method: "POST", body: badSlot }), 422, "delivery_date");

const pastOrder = { ...deliveryOrder, delivery_date: "2020-01-01", delivery_slot: "12:30–13:30" };
await expectError("прошедшая дата отсекается", api("/api/orders", { method: "POST", body: pastOrder }), 422, "delivery_date");
check("checkWhen: прошедшая дата", api.checkWhen("delivery", "2020-01-01", "12:30–13:30") !== null);

// Запас в 60 минут проверяем только если первый слот сегодня ещё не наступил
// (после 20:30 все слоты уже в прошлом, а до 10:30 — ещё впереди).
const nowInfo = api.ekbNow();
const firstSlotStart = Number(delivery.slots[0].start.slice(0, 2)) * 60 + Number(delivery.slots[0].start.slice(3, 5));
if (firstSlotStart - nowInfo.minutes < delivery.lead_minutes) {
  const todaySoon = { ...deliveryOrder, delivery_date: nowInfo.date, delivery_slot: delivery.slots[0].label };
  check("ранний слот на сегодня отсекается", api.checkWhen("delivery", nowInfo.date, delivery.slots[0].label) !== null);
  await expectError("сегодняшний прошедший слот", api("/api/orders", { method: "POST", body: todaySoon }), 422, "delivery_date");
} else {
  passed += 1;
  console.log("— проверка запаса 60 минут пропущена: сейчас " + String(Math.floor(nowInfo.minutes / 60)).padStart(2, "0") + ":" + String(nowInfo.minutes % 60).padStart(2, "0") + ", первый слот " + delivery.slots[0].start);
}

const surprise = {
  ...deliveryOrder,
  delivery_method: "surprise",
  delivery_zone: "s-city",
  address: "",
  recipient_phone: "+7 900 000-00-02",
  same_recipient: false
};
const surpriseOrder = await api("/api/orders", { method: "POST", body: surprise });
check("заказ-сюрприз создан", surpriseOrder.success === true);

const surpriseNoPhone = { ...surprise, recipient_phone: "" };
await expectError("сюрприз без телефона получателя", api("/api/orders", { method: "POST", body: surpriseNoPhone }), 422, "recipient_phone");

const pickup = {
  ...deliveryOrder,
  delivery_method: "pickup",
  delivery_zone: "",
  address: "",
  pickup_branch: "b1",
  delivery_slot: "13:00–14:00"
};
const pickupOrder = await api("/api/orders", { method: "POST", body: pickup });
check("самовывоз создан", pickupOrder.success === true);

const pickupNoBranch = { ...pickup, pickup_branch: "" };
await expectError("самовывоз без студии", api("/api/orders", { method: "POST", body: pickupNoBranch }), 422, "pickup_branch");

const emptyCart = { ...deliveryOrder, items: [] };
await expectError("пустая корзина", api("/api/orders", { method: "POST", body: emptyCart }), 422, "items");

/* ------------------------------------------------------------------ админ */

await expectError("админ без токена", api("/api/admin/orders"), 401);

const orders = await api("/api/admin/orders", { token: "test-key" });
check("админ видит заказы", orders.orders.length >= 4, orders.orders.length);

const archived = await api("/api/admin/orders/T-1003", {
  method: "PATCH", token: "test-key", body: { archived: true }
});
check("заказ убран в архив", archived.order.archived === true);

const flags = await api("/api/admin/products/p-01/flags", {
  method: "PATCH", token: "test-key", body: { hidden: true }
});
check("флаг «скрыт» переключён", flags.product.hidden === true);

const created_product = await api("/api/admin/products", {
  method: "POST",
  token: "test-key",
  body: {
    product: {
      title: "Тестовый букет", category: "bouquets", price: 1000, price_prefix: null,
      description: "тест", image_url: "assets/photos/p-01.svg",
      image_thumb_url: "assets/photos/p-01-thumb.svg", image_alt: "тест",
      is_new: false, badge: null, flower_types: ["роза"], size: "S",
      featured: false, showcase: false, hidden: false, no_delivery: false,
      pickup_branches: ["b1"], discount_enabled: false, discount_type: null,
      discount_value: null, discount_start: null, discount_end: null,
      sale_price: null, discount_active: false, discount_label: null,
      seo_title: "", seo_description: ""
    }
  }
});
check("товар создан через админку", Boolean(created_product.product.id));
check("slug сгенерирован транслитом", created_product.product.slug === "testovyy-buket", created_product.product.slug);

const categoryBusy = await api("/api/admin/categories/bouquets", { method: "DELETE", token: "test-key" }).then(
  () => ({ ok: true }),
  (error) => error
);
check("непустую категорию удалить нельзя", categoryBusy.status === 409, String(categoryBusy.status));

await expectError("загрузка не-картинки", api("/api/admin/upload", {
  method: "POST", token: "test-key", body: { name: "x.txt", data_url: "data:text/plain;base64,QQ==" }
}), 422, "file");

const codes = await api("/api/admin/search-codes", {
  method: "PUT", token: "test-key", body: { yandex: "abc123", google: "meta-tag" }
});
check("коды поиска сохранены", codes.searchCodes.yandex === "abc123");

const telegram = await api("/api/admin/telegram", {
  method: "PUT", token: "test-key", body: { ids: ["123456789"] }
});
check("telegram id сохранены", telegram.telegram.ids[0] === "123456789");

const telegramBad = await api("/api/admin/telegram", {
  method: "PUT", token: "test-key", body: { ids: Array.from({ length: 11 }, (_, i) => String(i + 1)) }
}).then(() => ({ ok: true }), (error) => error);
check("больше 10 получателей нельзя", telegramBad.status === 422, String(telegramBad.status));

const persistCheck = await api("/api/admin/orders", { token: "test-key" });
check("сессия админки сохраняет правки", persistCheck.orders.find((o) => o.id === "T-1003").archived === true);

/* ------------------------------------------------------------------ итог */

console.log("Пройдено проверок:", passed);
if (failures.length) {
  console.log("Провалено:", failures.length);
  failures.forEach((line) => console.log(" -", line));
  process.exitCode = 1;
} else {
  console.log("Все проверки пройдены.");
}
