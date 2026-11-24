/* ==========================================================================
   api.js — единственная точка общения фронта с данными.
   --------------------------------------------------------------------------
   На этапе 1 MOCK = true: данные читаются из /mock/*.json, а запись живёт
   в памяти + sessionStorage (чтобы правки админки не терялись при переходах
   между страницами, но исчезали после закрытия вкладки).

   На этапе 2 меняется одна константа MOCK → false и BASE → "" (или префикс),
   остальной код страниц не трогается: контракт запросов уже совпадает с
   бэкендом из MOCKS.md.

   Подпись: api(path, options) → Promise<JSON>, бросает ApiError.
   Все запросы админки передают options.token → заголовок Authorization.
   ========================================================================== */
(function () {
  "use strict";

  var MOCK = true;
  var BASE = "";
  var STORE_KEY = "milagro.mock.state.v1";
  var ADMIN_PREFIX = "/api/admin/";
  var EKB_OFFSET_MINUTES = 5 * 60; // Екатеринбург, UTC+5, без перехода на летнее время

  /* ------------------------------------------------------------------ util */

  function ApiError(message, status, payload) {
    this.name = "ApiError";
    this.message = message;
    this.status = status || 0;
    this.payload = payload || null;
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiError);
    } else {
      this.stack = new Error(message).stack;
    }
  }
  ApiError.prototype = Object.create(Error.prototype);
  ApiError.prototype.constructor = ApiError;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function delay(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function fail(message, status, payload) {
    throw new ApiError(message, status, payload);
  }

  /* ------------------------------------------------------------- timezone */

  /** Текущее время студии: часы и минуты по Екатеринбургу (UTC+5). */
  function ekbNow() {
    var shifted = new Date(Date.now() + EKB_OFFSET_MINUTES * 60000);
    return {
      date: shifted.toISOString().slice(0, 10),
      minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
      iso: shifted.toISOString().replace("Z", "+05:00")
    };
  }

  function dateToMinutes(dateString) {
    var parts = String(dateString).split("-").map(Number);
    return Date.UTC(parts[0], parts[1] - 1, parts[2]) / 60000;
  }

  function addDays(dateString, days) {
    var parts = String(dateString).split("-").map(Number);
    var ms = Date.UTC(parts[0], parts[1] - 1, parts[2]) + days * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }

  function slotToMinutes(label) {
    var match = String(label).match(/^(\d{2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
  }

  /* ---------------------------------------------------------------- state */

  var state = {
    ready: false,
    catalog: null,
    site: null,
    delivery: null,
    branches: null,
    orders: null,
    searchCodes: null,
    telegram: null,
    uploads: null
  };

  var MUTABLE = ["products", "categories", "site", "orders", "searchCodes", "telegram", "uploads"];

  var SEED_UPLOADS = [
    { url: "assets/photos/hero-1.svg", name: "hero-1.svg", created_at: "2026-11-18T12:00:00+05:00" },
    { url: "assets/photos/cat-bouquets.svg", name: "cat-bouquets.svg", created_at: "2026-11-18T12:01:00+05:00" },
    { url: "assets/photos/p-01.svg", name: "p-01.svg", created_at: "2026-11-19T09:30:00+05:00" }
  ];

  function readStore() {
    try {
      var raw = sessionStorage.getItem(STORE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (error) {
      return null;
    }
  }

  function writeStore() {
    try {
      var payload = {
        products: state.catalog.products,
        categories: state.catalog.categories,
        site: state.site,
        orders: state.orders,
        searchCodes: state.searchCodes,
        telegram: state.telegram,
        uploads: state.uploads
      };
      sessionStorage.setItem(STORE_KEY, JSON.stringify(payload));
    } catch (error) {
      /* приватный режим — просто живём в памяти страницы */
    }
  }

  function readMockFile(name) {
    return fetch("mock/" + name + ".json", { cache: "no-store" }).then(function (response) {
      if (!response.ok) {
        fail("Не удалось прочитать мок «" + name + "»", response.status);
      }
      return response.json();
    });
  }

  var bootPromise = null;

  function boot() {
    if (bootPromise) {
      return bootPromise;
    }
    bootPromise = Promise.all([
      readMockFile("catalog"),
      readMockFile("site"),
      readMockFile("delivery"),
      readMockFile("branches"),
      readMockFile("orders")
    ]).then(function (files) {
      state.catalog = files[0];
      state.site = files[1];
      state.delivery = files[2];
      state.branches = files[3];
      state.orders = files[4].orders;
      state.searchCodes = { yandex: "", google: "", updated_at: null };
      state.telegram = { ids: [], updated_at: null };
      state.uploads = SEED_UPLOADS.slice();

      var stored = readStore();
      if (stored) {
        if (Array.isArray(stored.products)) state.catalog.products = stored.products;
        if (Array.isArray(stored.categories)) state.catalog.categories = stored.categories;
        if (stored.site) state.site = stored.site;
        if (Array.isArray(stored.orders)) state.orders = stored.orders;
        if (stored.searchCodes) state.searchCodes = stored.searchCodes;
        if (stored.telegram) state.telegram = stored.telegram;
        if (Array.isArray(stored.uploads)) state.uploads = stored.uploads;
      }
      state.ready = true;
      return state;
    });
    return bootPromise;
  }

  /* -------------------------------------------------------------- domain */

  function priceOf(product) {
    if (!product) return 0;
    if (product.discount_active && product.sale_price !== null && typeof product.sale_price === "number") {
      return product.sale_price;
    }
    return product.price;
  }

  function oldPriceOf(product) {
    if (!product || !product.discount_active) return null;
    return product.price > priceOf(product) ? product.price : null;
  }

  function publicProducts() {
    return state.catalog.products.filter(function (product) {
      return !product.hidden;
    });
  }

  function productById(id) {
    return state.catalog.products.filter(function (product) {
      return product.id === id;
    })[0] || null;
  }

  function productBySlug(slug) {
    return state.catalog.products.filter(function (product) {
      return product.slug === slug;
    })[0] || null;
  }

  function categoryById(id) {
    return state.catalog.categories.filter(function (category) {
      return category.id === id;
    })[0] || null;
  }

  function minZonePrice() {
    var prices = state.delivery.zones
      .map(function (zone) {
        return zone.price;
      })
      .filter(function (price) {
        return typeof price === "number";
      });
    return prices.length ? Math.min.apply(null, prices) : null;
  }

  /** Текст наличия: одинаково собирается и на сервере, и в JS. */
  function availabilityText(product) {
    var branchNames = state.delivery.pickup.map(function (branch) {
      return branch.name;
    });
    var ownBranches = (product.pickup_branches || []).filter(function (id) {
      return state.delivery.pickup.some(function (branch) {
        return branch.id === id;
      });
    });
    var allBranches = ownBranches.length === state.delivery.pickup.length;
    var pickupText;
    if (allBranches) {
      pickupText = state.delivery.pickup.length === 1
        ? "Самовывоз из студии: " + branchNames[0]
        : "Самовывоз из всех студий";
    } else {
      pickupText = "Самовывоз только из студии: " + ownBranches
        .map(function (id) {
          return state.delivery.pickup.filter(function (branch) {
            return branch.id === id;
          })[0].name;
        })
        .join(", ");
    }

    if (product.no_delivery) {
      var address = ownBranches.length
        ? state.delivery.pickup.filter(function (branch) {
            return branch.id === ownBranches[0];
          })[0].address
        : state.delivery.pickup[0].address;
      return "Без доставки — только самовывоз из студии: " + address;
    }

    var min = minZonePrice();
    var freeFrom = state.delivery.free_from;
    var deliveryText;
    if (typeof min === "number") {
      deliveryText = "Доставка по Сургуту от " + min + " ₽";
      if (typeof freeFrom === "number") {
        deliveryText += ", бесплатно от " + freeFrom + " ₽";
      }
    } else {
      deliveryText = "Доставка по Сургуту — стоимость уточним при заказе";
    }
    return deliveryText + " · " + pickupText;
  }

  function zonePrice(zoneId) {
    var zone = state.delivery.zones.filter(function (item) {
      return item.id === zoneId;
    })[0];
    if (!zone) return { id: zoneId, name: "—", price: null, rough: true };
    return { id: zone.id, name: zone.name, price: zone.price, rough: typeof zone.price !== "number" };
  }

  /* ---------------------------------------------------------- validation */

  var SLOT_LABEL_RE = /^\d{2}:\d{2}–\d{2}:\d{2}$/;

  function digitsCount(value) {
    return String(value || "").replace(/\D/g, "").length;
  }

  /** Серверная проверка даты и слота — сервер на этапе 2 повторит её сам. */
  function checkWhen(method, date, slotLabel) {
    var slots = method === "pickup" ? state.delivery.pickup_slots : state.delivery.slots;
    var now = ekbNow();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(date))) {
      return "Выберите дату";
    }
    if (dateToMinutes(date) < dateToMinutes(now.date)) {
      return "Дата уже прошла";
    }
    if (dateToMinutes(date) > dateToMinutes(addDays(now.date, state.delivery.booking_days))) {
      return "Дата слишком далеко";
    }
    if (!SLOT_LABEL_RE.test(String(slotLabel || ""))) {
      return "Выберите время";
    }
    var slot = slots.filter(function (item) {
      return item.label === slotLabel;
    })[0];
    if (!slot) {
      return "Такого времени нет в расписании";
    }
    if (date === now.date) {
      var startMinutes = slotToMinutes(slot.label);
      if (startMinutes - now.minutes < state.delivery.lead_minutes) {
        return "До этого времени меньше часа — выберите позже";
      }
    }
    return null;
  }

  function validateOrder(payload) {
    var errors = {};
    var method = payload.delivery_method;

    if (!Array.isArray(payload.items) || !payload.items.length) {
      errors.items = "Корзина пуста";
    } else {
      payload.items.forEach(function (item) {
        if (!productById(item.product_id)) {
          errors.items = "Товар недоступен";
        }
      });
    }
    if (digitsCount(payload.phone) < 10) {
      errors.phone = "Телефон — не меньше 10 цифр";
    }
    if (String(payload.name || "").trim().length < 2) {
      errors.name = "Имя — не меньше 2 символов";
    }
    if (payload.email && String(payload.email).indexOf("@") < 0) {
      errors.email = "Проверьте email";
    }

    if (method === "delivery") {
      if (!payload.delivery_zone) {
        errors.delivery_zone = "Выберите район доставки";
      }
      if (String(payload.address || "").trim().length < 5) {
        errors.address = "Укажите адрес доставки";
      }
      if (String(payload.recipient_phone || "").trim() && digitsCount(payload.recipient_phone) < 10) {
        errors.recipient_phone = "Телефон получателя — не меньше 10 цифр";
      }
    } else if (method === "surprise") {
      if (!payload.delivery_zone) {
        errors.delivery_zone = "Выберите, куда доставить";
      }
      if (digitsCount(payload.recipient_phone) < 10) {
        errors.recipient_phone = "Телефон получателя — не меньше 10 цифр";
      }
    } else if (method === "pickup") {
      if (!payload.pickup_branch) {
        errors.pickup_branch = "Выберите студию";
      }
    } else {
      errors.delivery_method = "Выберите способ получения";
    }

    var whenError = checkWhen(method, payload.delivery_date, payload.delivery_slot);
    if (whenError) {
      errors.delivery_date = whenError;
    }
    if (payload.data_consent !== true) {
      errors.data_consent = "Нужно согласие на обработку данных";
    }
    if (payload.offer_accepted !== true) {
      errors.offer_accepted = "Нужно принять оферту";
    }
    return errors;
  }

  function orderTotal(payload) {
    var goods = 0;
    payload.items.forEach(function (item) {
      var product = productById(item.product_id);
      goods += priceOf(product) * Math.max(1, Number(item.quantity) || 1);
    });
    var deliveryPrice = null;
    if (payload.delivery_method !== "pickup" && payload.delivery_zone) {
      deliveryPrice = zonePrice(payload.delivery_zone).price;
    }
    return {
      goods: goods,
      delivery: typeof deliveryPrice === "number" ? deliveryPrice : null,
      total: goods + (typeof deliveryPrice === "number" ? deliveryPrice : 0)
    };
  }

  /* --------------------------------------------------------------- slugs */

  var TRANSLIT = {
    а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
    и: "i", й: "y", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
    с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
    ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya"
  };

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .split("")
      .map(function (char) {
        return Object.prototype.hasOwnProperty.call(TRANSLIT, char) ? TRANSLIT[char] : char;
      })
      .join("")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 60);
  }

  function uniqueSlug(base, exceptId) {
    var slug = slugify(base) || "tovar";
    var candidate = slug;
    var index = 2;
    while (
      state.catalog.products.some(function (product) {
        return product.slug === candidate && product.id !== exceptId;
      })
    ) {
      candidate = slug + "-" + index;
      index += 1;
    }
    return candidate;
  }

  function nextProductId() {
    var max = 0;
    state.catalog.products.forEach(function (product) {
      var num = Number(String(product.id).replace(/\D/g, ""));
      if (num > max) max = num;
    });
    return "p-" + String(max + 1).padStart(2, "0");
  }

  /* -------------------------------------------------------------- routes */

  function requireAdmin(options) {
    var token = options && options.token;
    if (!token) {
      fail("Нужен ключ администратора", 401, { errors: { token: "Введите ключ" } });
    }
  }

  function route(path, options) {
    var method = (options && options.method) || "GET";
    var body = (options && options.body) || {};
    var url = path.split("?")[0];

    if (url === "/api/catalog") {
      return { categories: clone(state.catalog.categories), products: clone(state.catalog.products) };
    }
    if (url === "/api/site") {
      return clone(state.site);
    }
    if (url === "/api/delivery") {
      return clone(state.delivery);
    }
    if (url === "/api/branches") {
      return clone(state.branches);
    }

    if (url === "/api/orders" && method === "POST") {
      var errors = validateOrder(body);
      if (Object.keys(errors).length) {
        fail("Проверьте поля формы", 422, { errors: errors });
      }
      var totals = orderTotal(body);
      var now = ekbNow();
      var order = {
        id: "T-" + String(1005 + state.orders.length),
        number: "T-" + String(1005 + state.orders.length),
        created_at: now.iso,
        payment_status: "pending",
        delivery_method: body.delivery_method,
        customer: {
          name: String(body.name).trim(),
          phone: String(body.phone).trim(),
          email: String(body.email || "").trim()
        },
        items: body.items.map(function (item) {
          var product = productById(item.product_id);
          return {
            product_id: product.id,
            title: product.title,
            quantity: Math.max(1, Number(item.quantity) || 1),
            price: priceOf(product),
            image_url: product.image_url,
            image_alt: product.image_alt
          };
        }),
        goods_total: totals.goods,
        delivery_price: totals.delivery,
        total: totals.total,
        comment: String(body.comment || ""),
        delivery_date: body.delivery_date,
        delivery_slot: body.delivery_slot,
        delivery_zone: body.delivery_zone || null,
        pickup_branch: body.pickup_branch || null,
        address: String(body.address || ""),
        recipient_phone: String(body.recipient_phone || ""),
        same_recipient: body.same_recipient !== false,
        consents: {
          data_consent: body.data_consent === true,
          offer_accepted: body.offer_accepted === true,
          data_consent_at: now.iso,
          offer_accepted_at: now.iso,
          consent_version: body.consent_version || "draft",
          privacy_version: body.privacy_version || "draft",
          offer_version: body.offer_version || "draft"
        },
        archived: false
      };
      state.orders.unshift(order);
      writeStore();
      return { success: true, order_id: order.id, order: clone(order) };
    }

    /* ------------------------------------------------------------- admin */

    if (url.indexOf(ADMIN_PREFIX) === 0) {
      requireAdmin(options);

      if (url === "/api/admin/orders" && method === "GET") {
        return { orders: clone(state.orders) };
      }

      var orderMatch = url.match(/^\/api\/admin\/orders\/([^/]+)$/);
      if (orderMatch && method === "PATCH") {
        var found = state.orders.filter(function (order) {
          return order.id === decodeURIComponent(orderMatch[1]);
        })[0];
        if (!found) fail("Заказ не найден", 404);
        if (Object.prototype.hasOwnProperty.call(body, "archived")) {
          found.archived = Boolean(body.archived);
        }
        writeStore();
        return { ok: true, order: clone(found) };
      }

      if (url === "/api/admin/products" && method === "GET") {
        return { products: clone(state.catalog.products) };
      }
      if (url === "/api/admin/products" && method === "POST") {
        var created = clone(body.product || {});
        created.id = nextProductId();
        created.slug = uniqueSlug(created.title);
        created.created_at = ekbNow().iso;
        created.pickup_branches = created.pickup_branches || state.delivery.pickup.map(function (b) { return b.id; });
        state.catalog.products.unshift(created);
        writeStore();
        return { ok: true, product: clone(created) };
      }

      var productMatch = url.match(/^\/api\/admin\/products\/([^/]+)$/);
      var flagsMatch = url.match(/^\/api\/admin\/products\/([^/]+)\/flags$/);

      if (flagsMatch && method === "PATCH") {
        var flagProduct = productById(decodeURIComponent(flagsMatch[1]));
        if (!flagProduct) fail("Товар не найден", 404);
        ["hidden", "showcase", "featured"].forEach(function (flag) {
          if (Object.prototype.hasOwnProperty.call(body, flag)) {
            flagProduct[flag] = Boolean(body[flag]);
          }
        });
        writeStore();
        return { ok: true, product: clone(flagProduct) };
      }

      if (productMatch && method === "PUT") {
        var target = productById(decodeURIComponent(productMatch[1]));
        if (!target) fail("Товар не найден", 404);
        var patch = clone(body.product || {});
        patch.slug = patch.slug || target.slug;
        Object.keys(patch).forEach(function (key) {
          target[key] = patch[key];
        });
        writeStore();
        return { ok: true, product: clone(target) };
      }

      if (productMatch && method === "DELETE") {
        state.catalog.products = state.catalog.products.filter(function (product) {
          return product.id !== decodeURIComponent(productMatch[1]);
        });
        writeStore();
        return { ok: true };
      }

      if (url === "/api/admin/categories" && method === "GET") {
        return { categories: clone(state.catalog.categories) };
      }
      if (url === "/api/admin/categories" && method === "POST") {
        var category = clone(body.category || {});
        category.id = category.id || "c-" + Date.now().toString(36);
        category.slug = slugify(category.name);
        category.position = Number(category.position) || state.catalog.categories.length + 1;
        state.catalog.categories.push(category);
        writeStore();
        return { ok: true, category: clone(category) };
      }

      var categoryMatch = url.match(/^\/api\/admin\/categories\/([^/]+)$/);
      if (categoryMatch && method === "PUT") {
        var categoryTarget = categoryById(decodeURIComponent(categoryMatch[1]));
        if (!categoryTarget) fail("Категория не найдена", 404);
        Object.keys(body.category || {}).forEach(function (key) {
          categoryTarget[key] = body.category[key];
        });
        writeStore();
        return { ok: true, category: clone(categoryTarget) };
      }
      if (categoryMatch && method === "DELETE") {
        var deleteId = decodeURIComponent(categoryMatch[1]);
        var used = state.catalog.products.some(function (product) {
          return product.category === deleteId;
        });
        if (used) {
          fail("В категории есть товары — сначала перенесите их", 409, {
            errors: { category: "Категория не пустая" }
          });
        }
        state.catalog.categories = state.catalog.categories.filter(function (item) {
          return item.id !== deleteId;
        });
        writeStore();
        return { ok: true };
      }

      if (url === "/api/admin/site" && method === "GET") {
        return clone(state.site);
      }
      if (url === "/api/admin/site" && method === "PUT") {
        state.site = clone(body.site || state.site);
        writeStore();
        return { ok: true, site: clone(state.site) };
      }
      if (url === "/api/admin/site/reset" && method === "POST") {
        var defaults = defaultSite();
        state.site = defaults;
        writeStore();
        return { ok: true, site: clone(state.site) };
      }

      if (url === "/api/admin/search-codes" && method === "GET") {
        return clone(state.searchCodes);
      }
      if (url === "/api/admin/search-codes" && method === "PUT") {
        state.searchCodes = {
          yandex: String(body.yandex || ""),
          google: String(body.google || ""),
          updated_at: ekbNow().iso
        };
        writeStore();
        return { ok: true, searchCodes: clone(state.searchCodes) };
      }

      if (url === "/api/admin/telegram" && method === "GET") {
        return clone(state.telegram);
      }
      if (url === "/api/admin/telegram" && method === "PUT") {
        var ids = (body.ids || []).map(String).filter(function (id) {
          return /^\d+$/.test(id);
        });
        if (ids.length > 10) fail("Можно сохранить не больше 10 получателей", 422, { errors: { ids: "Слишком много ID" } });
        state.telegram = { ids: ids, updated_at: ekbNow().iso };
        writeStore();
        return { ok: true, telegram: clone(state.telegram) };
      }
      if (url === "/api/admin/telegram/test" && method === "POST") {
        if (!state.telegram.ids.length) {
          fail("Сначала сохраните ID получателей", 422, { errors: { ids: "Список пуст" } });
        }
        return {
          ok: true,
          results: state.telegram.ids.map(function (id) {
            return { id: id, ok: true, message: "Тестовое сообщение отправлено (мок)" };
          })
        };
      }

      if (url === "/api/admin/uploads" && method === "GET") {
        return { uploads: clone(state.uploads) };
      }
      if (url === "/api/admin/upload" && method === "POST") {
        if (!body.data_url || String(body.data_url).indexOf("data:image/") !== 0) {
          fail("Файл не распознан как изображение", 422, { errors: { file: "Нужен JPG, PNG или WebP" } });
        }
        var upload = {
          url: body.data_url,
          name: body.name || "upload",
          created_at: ekbNow().iso
        };
        state.uploads.unshift(upload);
        writeStore();
        return { ok: true, upload: upload };
      }
    }

    fail("Нет такого запроса: " + method + " " + url, 404);
    return null;
  }

  /** Стандартные слайды главной — «Вернуть стандартные» в админке. */
  var DEFAULTS = null;

  function defaultSite() {
    if (!DEFAULTS) {
      DEFAULTS = {
        brand: "Milagro",
        brand_sub: "цветочная студия, Сургут",
        hero_slides: [
          { image_url: "assets/photos/hero-1.svg", mobile_image_url: "assets/photos/hero-1-mobile.svg", alt: "Букеты в студии Milagro" },
          { image_url: "assets/photos/hero-2.svg", mobile_image_url: "assets/photos/hero-2-mobile.svg", alt: "Стол флориста в студии" },
          { image_url: "assets/photos/hero-3.svg", mobile_image_url: "assets/photos/hero-3-mobile.svg", alt: "Букет в упаковке на светлом фоне" }
        ],
        offers_image_url: "assets/photos/offers.svg"
      };
    }
    return clone(DEFAULTS);
  }

  /* ---------------------------------------------------------------- entry */

  function api(path, options) {
    options = options || {};
    if (MOCK) {
      return boot()
        .then(function () {
          return delay(90);
        })
        .then(function () {
          return route(path, options);
        });
    }
    var headers = { Accept: "application/json" };
    if (options.token) {
      headers.Authorization = "Bearer " + options.token;
    }
    var init = { method: options.method || "GET", headers: headers };
    if (options.body !== undefined) {
      headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(options.body);
    }
    return fetch(BASE + path, init).then(function (response) {
      return response.json().catch(function () {
        return null;
      }).then(function (payload) {
        if (!response.ok) {
          var message = (payload && payload.message) || "Ошибка запроса";
          fail(message, response.status, payload);
        }
        return payload;
      });
    });
  }

  api.MOCK = MOCK;
  api.ApiError = ApiError;
  api.priceOf = priceOf;
  api.oldPriceOf = oldPriceOf;
  api.publicProducts = publicProducts;
  api.productById = productById;
  api.productBySlug = productBySlug;
  api.categoryById = categoryById;
  api.availabilityText = availabilityText;
  api.zonePrice = zonePrice;
  api.minZonePrice = minZonePrice;
  api.checkWhen = checkWhen;
  api.ekbNow = ekbNow;
  api.orderTotal = orderTotal;
  api.slugify = slugify;
  api.clearSessionState = function () {
    try {
      sessionStorage.removeItem(STORE_KEY);
    } catch (error) {
      /* ignore */
    }
  };

  window.api = api;
})();
