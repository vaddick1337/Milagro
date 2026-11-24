/* ==========================================================================
   app.js — общий каркас: шапка, подвал, корзина, мелкие помощники.
   Подключается на каждой странице после api.js. Страница вызывает
   App.init({ active: "home" | "shop" | "catalog" | "product" | "legal" })
   и дальше работает с App.*
   ========================================================================== */
(function () {
  "use strict";

  var CART_KEY = "milagro.cart.v1";
  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var revealObserver = null;
  var lastCartCount = null;
  var PHONE = "+7 922 446-10-68";
  var PHONE_HREF = "tel:+79224461068";
  var TG = "https://t.me/+79224461068";
  var VK = "https://vk.com/milagro_surgut";
  var ADDRESS = "г. Сургут, пр-т Набережный, 2, 1 этаж";
  var HOURS = "Ежедневно 10:00–20:00";

  var BRAND = "Milagro";
  var BINK_WHITE =
    '<a class="binc-made binc-made--white" href="https://b-inc.ru/" target="_blank" rel="noopener"><span class="binc-made__muted">Сделано вместе&nbsp;с</span> <span class="binc-made__name">Бинк</span></a>' +
    "<style>" +
    'a.binc-made.binc-made--white,a.binc-made.binc-made--black{display:inline-flex;align-items:baseline;gap:.3em;padding:6px 0;margin:0;border:0;background:none;font:400 22px/1 Inter,system-ui,-apple-system,\"Segoe UI\",Roboto,Arial,sans-serif;letter-spacing:0;text-transform:none;text-decoration:none;white-space:nowrap;-webkit-tap-highlight-color:transparent}' +
    "a.binc-made.binc-made--white{color:#fff}" +
    "a.binc-made.binc-made--black{color:#0b0b0c}" +
    "a.binc-made .binc-made__muted{opacity:.72;transition:opacity .2s ease}" +
    "a.binc-made.binc-made--solid .binc-made__muted{opacity:1}" +
    "a.binc-made .binc-made__name{font-size:1.5em;font-weight:600;letter-spacing:-.015em;line-height:1;color:inherit}" +
    "a.binc-made:hover .binc-made__muted,a.binc-made:focus-visible .binc-made__muted{opacity:1}" +
    "a.binc-made:focus-visible{outline:2px solid currentColor;outline-offset:4px;border-radius:4px}" +
    "@media (prefers-reduced-motion:reduce){a.binc-made .binc-made__muted{transition:none}}" +
    "</style>";

  var BINK_BLACK =
    '<a class="binc-made binc-made--black" href="https://b-inc.ru/" target="_blank" rel="noopener"><span class="binc-made__muted">Сделано вместе&nbsp;с</span> <span class="binc-made__name">Бинк</span></a>' +
    "<style>" +
    'a.binc-made.binc-made--white,a.binc-made.binc-made--black{display:inline-flex;align-items:baseline;gap:.3em;padding:6px 0;margin:0;border:0;background:none;font:400 22px/1 Inter,system-ui,-apple-system,\"Segoe UI\",Roboto,Arial,sans-serif;letter-spacing:0;text-transform:none;text-decoration:none;white-space:nowrap;-webkit-tap-highlight-color:transparent}' +
    "a.binc-made.binc-made--white{color:#fff}" +
    "a.binc-made.binc-made--black{color:#0b0b0c}" +
    "a.binc-made .binc-made__muted{opacity:.72;transition:opacity .2s ease}" +
    "a.binc-made.binc-made--solid .binc-made__muted{opacity:1}" +
    "a.binc-made .binc-made__name{font-size:1.5em;font-weight:600;letter-spacing:-.015em;line-height:1;color:inherit}" +
    "a.binc-made:hover .binc-made__muted,a.binc-made:focus-visible .binc-made__muted{opacity:1}" +
    "a.binc-made:focus-visible{outline:2px solid currentColor;outline-offset:4px;border-radius:4px}" +
    "@media (prefers-reduced-motion:reduce){a.binc-made .binc-made__muted{transition:none}}" +
    "</style>";

  var NAV = [
    { href: "shop.html", label: "Каталог", key: "shop" },
    { href: "shop.html?offers=1", label: "Предложения", key: "offers" },
    { href: "index.html#studios", label: "Студии", key: "studios" },
    { href: "index.html#delivery", label: "Доставка", key: "delivery" },
    { href: "index.html#contacts", label: "Контакты", key: "contacts" }
  ];

  /* ------------------------------------------------------------ helpers */

  function esc(value) {
    return String(value === undefined || value === null ? "" : value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function money(value) {
    if (value === null || value === undefined || value === "") return "—";
    var number = Number(value);
    if (!isFinite(number)) return "—";
    // Обычный неразрывный пробел (U+00A0): есть в любой гарнитуре, в отличие от узкого.
    return new Intl.NumberFormat("ru-RU").format(Math.round(number)) + "\u00A0₽";
  }

  function priceLabel(product) {
    var price = api.priceOf(product);
    var prefix = product.price_prefix ? product.price_prefix + " " : "";
    return prefix + money(price);
  }

  /** Карточка товара. Ссылка ведёт на SEO-страницу; в магазине её перехватывает
      market.js и открывает диалог — без JS ссылка продолжает работать. */
  function productCard(product, options) {
    options = options || {};
    var oldPrice = api.oldPriceOf(product);
    var badges = [];
    if (product.is_new) {
      badges.push('<span class="badge badge--new">' + esc(product.badge || "Новинка") + "</span>");
    }
    if (oldPrice) {
      badges.push('<span class="badge badge--sale">' + esc(product.discount_label || "Скидка") + "</span>");
    }
    var meta = [];
    if (options.categoryName) meta.push(esc(options.categoryName));
    if (product.size) meta.push(esc(product.size));
    return (
      '<article class="product-card" data-reveal>' +
      '<a class="product-card__link" href="product.html?slug=' + encodeURIComponent(product.slug) + '" data-detail-id="' + esc(product.id) + '">' +
      '<div class="product-card__media">' +
      '<img src="' + esc(product.image_url) + '" alt="' + esc(product.image_alt) + '" width="800" height="600" loading="lazy" decoding="async">' +
      (badges.length ? '<div class="badges">' + badges.join("") + "</div>" : "") +
      "</div>" +
      '<div class="product-card__body">' +
      '<h3 class="product-card__title">' + esc(product.title) + "</h3>" +
      (meta.length ? '<p class="product-card__meta">' + meta.join(" · ") + "</p>" : "") +
      '<div class="product-card__foot">' +
      '<span class="price' + (oldPrice ? " price--sale" : "") + '">' + priceLabel(product) +
      (oldPrice ? '<s class="price--old">' + money(oldPrice) + "</s>" : "") +
      "</span>" +
      (product.no_delivery ? '<span class="product-card__meta">Самовывоз</span>' : "") +
      "</div></div></a></article>"
    );
  }

  function plural(count, one, few, many) {    var mod10 = count % 10;
    var mod100 = count % 100;
    if (mod10 === 1 && mod100 !== 11) return one;
    if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
    return many;
  }

  function fmtDate(iso) {
    if (!iso) return "";
    var date = new Date(iso.length === 10 ? iso + "T00:00:00+05:00" : iso);
    if (isNaN(date.getTime())) return String(iso);
    return date.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Yekaterinburg" });
  }

  function fmtDateTime(iso) {
    if (!iso) return "";
    var date = new Date(iso);
    if (isNaN(date.getTime())) return String(iso);
    return date.toLocaleString("ru-RU", {
      day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit",
      timeZone: "Asia/Yekaterinburg"
    });
  }

  function digits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  function qs(selector, root) {
    return (root || document).querySelector(selector);
  }

  function qsa(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function icon(name, extraClass) {
    return '<span class="icon icon--' + esc(name) + (extraClass ? " " + extraClass : "") + '" aria-hidden="true"></span>';
  }

  function toast(message, tone) {
    var host = qs("[data-toast-host]");
    if (!host) {
      host = document.createElement("div");
      host.className = "toast-host";
      host.setAttribute("data-toast-host", "");
      host.setAttribute("aria-live", "polite");
      document.body.appendChild(host);
    }
    var node = document.createElement("div");
    node.className = "toast" + (tone ? " toast--" + tone : "");
    node.textContent = message;
    host.appendChild(node);
    window.setTimeout(function () {
      node.classList.add("is-hiding");
      window.setTimeout(function () {
        node.remove();
      }, 240);
    }, 3200);
  }

  /* --------------------------------------------------------------- cart */

  function readCart() {
    try {
      var raw = localStorage.getItem(CART_KEY);
      var parsed = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter(function (item) {
          return item && typeof item.id === "string";
        })
        .map(function (item) {
          return { id: item.id, quantity: Math.max(1, Math.min(99, Number(item.quantity) || 1)) };
        });
    } catch (error) {
      return [];
    }
  }

  function writeCart(items) {
    try {
      localStorage.setItem(CART_KEY, JSON.stringify(items));
    } catch (error) {
      /* хранилище недоступно — корзина живёт до перезагрузки */
    }
    syncCartBadges();
    document.dispatchEvent(new CustomEvent("cart:change", { detail: { items: items } }));
  }

  function cartCount() {
    return readCart().reduce(function (sum, item) {
      return sum + item.quantity;
    }, 0);
  }

  function cartAdd(id, quantity) {
    var items = readCart();
    var found = items.filter(function (item) {
      return item.id === id;
    })[0];
    if (found) {
      found.quantity = Math.min(99, found.quantity + (quantity || 1));
    } else {
      items.push({ id: id, quantity: Math.max(1, quantity || 1) });
    }
    writeCart(items);
    return items;
  }

  function cartSet(id, quantity) {
    var items = readCart()
      .map(function (item) {
        return item.id === id ? { id: id, quantity: Math.max(1, Math.min(99, quantity)) } : item;
      })
      .filter(function (item) {
        return item.quantity > 0;
      });
    writeCart(items);
    return items;
  }

  function cartRemove(id) {
    writeCart(
      readCart().filter(function (item) {
        return item.id !== id;
      })
    );
  }

  function cartClear() {
    writeCart([]);
  }

  function syncCartBadges() {
    var count = cartCount();
    qsa("[data-cart-count]").forEach(function (node) {
      node.textContent = String(count);
      node.hidden = count === 0;
      if (lastCartCount !== null && count !== lastCartCount && count > 0) {
        node.classList.remove("is-bumping");
        void node.offsetWidth; // перезапуск анимации
        node.classList.add("is-bumping");
      }
    });
    lastCartCount = count;
  }

  /* ------------------------------------------------------------ движение */

  /** Подсветить «появление» у новых элементов: карточки, секции, плашки. */
  function revealScan(root) {
    var scope = root || document;
    qsa("[data-reveal]", scope).forEach(function (node, index) {
      if (node.classList.contains("is-visible")) return;
      node.style.setProperty("--reveal-delay", (index % 6) * 70 + "ms");
      if (revealObserver) {
        revealObserver.observe(node);
      } else {
        node.classList.add("is-visible");
      }
    });
  }

  function initMotion() {
    document.documentElement.classList.add("js");

    var header = qs(".site-header");
    if (header) {
      var onScroll = function () {
        header.classList.toggle("is-scrolled", window.scrollY > 6);
      };
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
    }

    if (!reduceMotion && "IntersectionObserver" in window) {
      revealObserver = new IntersectionObserver(
        function (entries) {
          entries.forEach(function (entry) {
            if (!entry.isIntersecting) return;
            entry.target.classList.add("is-visible");
            revealObserver.unobserve(entry.target);
          });
        },
        { rootMargin: "0px 0px -5% 0px", threshold: 0.06 }
      );
      revealScan(document);
    } else {
      qsa("[data-reveal]").forEach(function (node) {
        node.classList.add("is-visible");
      });
    }
  }

  /* ----------------------------------------------------------- fragments */

  function navLinks(active) {
    return NAV.map(function (item) {
      var current = item.key === active ? ' aria-current="page"' : "";
      return '<a class="site-nav__link" href="' + esc(item.href) + '" data-nav="' + esc(item.key) + '"' + current + ">" + esc(item.label) + "</a>";
    }).join("");
  }

  function headerHtml(active) {
    return (
      '<div class="site-header__inner container">' +
      '<a class="logo" href="index.html" aria-label="Milagro — на главную">' +
      '<span class="logo__word">' + esc(BRAND) + "</span>" +
      '<span class="logo__sub">цветочная студия · Сургут</span>' +
      "</a>" +
      '<nav class="site-nav" aria-label="Основная навигация">' + navLinks(active) + "</nav>" +
      '<div class="site-header__actions">' +
      '<a class="icon-btn icon-btn--phone" href="' + PHONE_HREF + '" data-nav="phone">' + icon("phone") +
      '<span class="sr-only">Позвонить ' + esc(PHONE) + "</span></a>" +
      '<a class="icon-btn icon-btn--cart" href="shop.html#cart" data-nav="cart">' + icon("cart") +
      '<span class="cart-count" data-cart-count hidden>0</span><span class="sr-only">Корзина</span></a>' +
      '<button class="icon-btn burger" type="button" aria-expanded="false" aria-controls="mobile-nav" data-burger>' +
      icon("menu") + '<span class="sr-only">Меню</span></button>' +
      "</div>" +
      "</div>" +
      '<div class="menu-overlay" data-menu-overlay aria-hidden="true"></div>' +
      '<div class="mobile-nav" id="mobile-nav" data-mobile-nav aria-hidden="true">' +
      '<div class="mobile-nav__head">' +
      '<span class="logo__word">' + esc(BRAND) + "</span>" +
      '<button class="icon-btn" type="button" data-mobile-close aria-label="Закрыть меню">' + icon("close") + "</button>" +
      "</div>" +
      '<div class="mobile-nav__inner">' + navLinks(active) +
      '<a class="mobile-nav__phone" href="' + PHONE_HREF + '">' + esc(PHONE) + "</a>" +
      "</div></div>"
    );
  }

  function footerHtml(variant) {
    var dark = variant !== "light";
    var bink = dark ? BINK_WHITE : BINK_BLACK;
    var wrapperStyle = dark
      ? "display:flex;justify-content:flex-end;flex-basis:100%;width:100%;grid-column:1/-1;padding-top:16px"
      : "display:flex;justify-content:flex-end;flex-basis:100%;width:100%;grid-column:1/-1;padding-top:16px";
    return (
      '<div class="container footer-grid">' +
      '<div class="footer-col footer-col--brand">' +
      '<a class="logo logo--footer" href="index.html"><span class="logo__word">' + esc(BRAND) + '</span><span class="logo__sub">цветочная студия · Сургут</span></a>' +
      '<p class="footer-note">Цветы и букеты в Сургуте. Студия на Набережном, 2.</p>' +
      "</div>" +
      '<div class="footer-col">' +
      '<h2 class="footer-title">Контакты</h2>' +
      '<ul class="footer-list">' +
      '<li><a href="' + PHONE_HREF + '">' + esc(PHONE) + "</a></li>" +
      "<li>" + esc(ADDRESS) + "</li>" +
      "<li>" + esc(HOURS) + "</li>" +
      '<li class="footer-messengers">' +
      '<a class="footer-messenger" href="' + TG + '" target="_blank" rel="noopener">' + icon("tg") + "Telegram</a>" +
      '<a class="footer-messenger" href="' + VK + '" target="_blank" rel="noopener">' + icon("vk") + "VK</a>" +
      "</li>" +
      "</ul>" +
      "</div>" +
      '<div class="footer-col">' +
      '<h2 class="footer-title">Продавец и документы</h2>' +
      '<ul class="footer-list footer-list--docs">' +
      '<li class="footer-placeholder">[Реквизиты — этап 3]</li>' +
      '<li><a href="privacy.html">Политика обработки ПДн</a></li>' +
      '<li><a href="consent.html">Согласие на обработку ПДн</a></li>' +
      '<li><a href="offer.html">Публичная оферта</a></li>' +
      '<li><a href="requisites.html">Реквизиты продавца</a></li>' +
      "</ul>" +
      "</div>" +
      "</div>" +
      '<div class="container footer-bottom">' +
      '<p class="footer-copy">© 2026 ' + esc(BRAND) + " (Сургут)</p>" +
      '<div class="binc-made-row" style="' + wrapperStyle + '">' + bink + "</div>" +
      "</div>"
    );
  }

  /* ---------------------------------------------------------------- init */

  var catalogPromise = null;

  function loadCatalog() {
    if (!catalogPromise) {
      catalogPromise = api("/api/catalog");
    }
    return catalogPromise;
  }

  function mountHeader(active) {
    var host = qs("[data-site-header]");
    if (!host) return;
    host.className = "site-header" + (qs("body") && qs("body").dataset.headerStyle === "overlay" ? " site-header--overlay" : "");
    host.innerHTML = headerHtml(active || "");

    // Шапка с backdrop-filter создаёт свой containing block, поэтому шторку меню
    // и затемнение переносим в body — иначе position: fixed считается от шапки.
    var panel = qs("[data-mobile-nav]");
    var overlay = qs("[data-menu-overlay]");
    if (overlay) document.body.appendChild(overlay);
    if (panel) document.body.appendChild(panel);
  }

  function mountFooter(variant) {
    var host = qs("[data-site-footer]");
    if (!host) return;
    host.className = "site-footer" + (variant === "light" ? " site-footer--light" : " site-footer--dark");
    host.innerHTML = footerHtml(variant === "light" ? "light" : "dark");
  }

  function wireBurger() {
    var burger = qs("[data-burger]");
    var panel = qs("[data-mobile-nav]");
    var closeBtn = qs("[data-mobile-close]", panel);
    if (!burger || !panel) return;

    function setOpen(open) {
      panel.classList.toggle("is-open", open);
      panel.setAttribute("aria-hidden", open ? "false" : "true");
      burger.setAttribute("aria-expanded", open ? "true" : "false");
      document.body.classList.toggle("menu-open", open);
    }

    burger.addEventListener("click", function () {
      setOpen(burger.getAttribute("aria-expanded") !== "true");
    });

    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        setOpen(false);
        burger.focus();
      });
    }

    panel.addEventListener("click", function (event) {
      if (event.target.closest("a")) setOpen(false);
    });

    // Клик мимо панели (по затемнению) закрывает меню.
    document.addEventListener("click", function (event) {
      if (!document.body.classList.contains("menu-open")) return;
      if (panel.contains(event.target) || burger.contains(event.target)) return;
      setOpen(false);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && document.body.classList.contains("menu-open")) {
        setOpen(false);
        burger.focus();
      }
    });

    window.addEventListener("resize", function () {
      if (window.innerWidth > 980 && document.body.classList.contains("menu-open")) setOpen(false);
    });
  }

  function init(options) {
    options = options || {};
    mountHeader(options.active);
    mountFooter(options.footer || "dark");
    wireBurger();
    initMotion();
    syncCartBadges();
    document.addEventListener("cart:change", syncCartBadges);
    return loadCatalog()
      .then(function (data) {
        document.dispatchEvent(new CustomEvent("app:ready", { detail: data }));
        return data;
      })
      .catch(function (error) {
        toast("Не удалось загрузить данные: " + (error.message || "ошибка"), "error");
        throw error;
      });
  }

  window.App = {
    init: init,
    loadCatalog: loadCatalog,
    esc: esc,
    money: money,
    priceLabel: priceLabel,
    productCard: productCard,
    plural: plural,
    fmtDate: fmtDate,
    fmtDateTime: fmtDateTime,
    digits: digits,
    qs: qs,
    qsa: qsa,
    icon: icon,
    toast: toast,
    revealScan: revealScan,
    cart: {
      read: readCart,
      write: writeCart,
      add: cartAdd,
      set: cartSet,
      remove: cartRemove,
      clear: cartClear,
      count: cartCount,
      sync: syncCartBadges
    },
    phone: PHONE,
    phoneHref: PHONE_HREF,
    telegram: TG,
    vk: VK,
    address: ADDRESS,
    hours: HOURS,
    brand: BRAND
  };

  /* Страницы без своего скрипта (документы) объявляют автостарт атрибутом. */
  function autoInit() {
    var body = document.body;
    if (!body || !body.hasAttribute("data-site-autoinit")) return;
    init({
      active: body.getAttribute("data-active") || "",
      footer: body.getAttribute("data-footer") || "dark"
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", autoInit);
  } else {
    autoInit();
  }
})();
