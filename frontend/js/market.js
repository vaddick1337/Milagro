/* ==========================================================================
   market.js — магазин: каталог и фильтры, карточка товара, корзина,
   оформление заказа (доставка / сюрприз / самовывоз), календарь и слоты,
   проверки формы, экран успеха.
   Все данные — через api.js, корзина — только id и количество.
   ========================================================================== */
(function () {
  "use strict";

  var esc = App.esc;
  var money = App.money;
  var icon = App.icon;
  var qs = App.qs;
  var qsa = App.qsa;

  var DOC_VERSION = "draft";
  var PER_PAGE = 12;

  var data = { products: [], categories: [], delivery: null, branches: [] };
  var filters = {
    category: "all",
    offersOnly: false,
    priceMin: null,
    priceMax: null,
    flowers: [],
    sizes: [],
    fulfilment: "all",
    search: "",
    sort: "default"
  };
  var view = { page: 1, list: [] };
  var adminMode = /^#admin/.test(window.location.hash);

  var order = {
    method: "delivery",
    zone: "",
    surpriseZone: "",
    pickupBranch: "",
    date: "",
    slot: "",
    sameRecipient: true
  };
  var calendar = { year: 0, month: 0 };

  /* ------------------------------------------------------------ утилиты */

  function categoryName(id) {
    var found = data.categories.filter(function (category) {
      return category.id === id;
    })[0];
    return found ? found.name : "";
  }

  function productById(id) {
    return data.products.filter(function (product) {
      return product.id === id;
    })[0] || null;
  }

  function cartProducts() {
    return App.cart
      .read()
      .map(function (item) {
        var product = productById(item.id);
        return product ? { product: product, quantity: item.quantity } : null;
      })
      .filter(Boolean);
  }

  function cartGoods() {
    return cartProducts().reduce(function (sum, row) {
      return sum + api.priceOf(row.product) * row.quantity;
    }, 0);
  }

  function debounce(fn, delay) {
    var timer = null;
    return function () {
      var args = arguments;
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        fn.apply(null, args);
      }, delay);
    };
  }

  function pluralCount(count) {
    return count + " " + App.plural(count, "товар", "товара", "товаров");
  }

  /* ------------------------------------------------------------ фильтры */

  function buildFilters() {
    var categoryHost = qs("[data-filter-categories]");
    var flowerHost = qs("[data-filter-flowers]");
    var sizeHost = qs("[data-filter-sizes]");
    if (!categoryHost || !flowerHost || !sizeHost) return;

    var visible = data.products.filter(function (product) {
      return !product.hidden;
    });

    categoryHost.innerHTML = ['<button class="chip" type="button" data-category="all">Все</button>']
      .concat(
        data.categories
          .slice()
          .sort(function (a, b) {
            return (a.position || 0) - (b.position || 0);
          })
          .filter(function (category) {
            return visible.some(function (product) {
              return product.category === category.id;
            });
          })
          .map(function (category) {
            return '<button class="chip" type="button" data-category="' + esc(category.id) + '">' + esc(category.name) + "</button>";
          })
      )
      .join("");

    var flowers = [];
    var sizes = [];
    visible.forEach(function (product) {
      (product.flower_types || []).forEach(function (flower) {
        if (flowers.indexOf(flower) < 0) flowers.push(flower);
      });
      if (product.size && sizes.indexOf(product.size) < 0) sizes.push(product.size);
    });

    flowerHost.innerHTML = flowers
      .sort()
      .map(function (flower) {
        return (
          '<label class="checkbox"><input type="checkbox" value="' + esc(flower) + '" data-flower>' +
          "<span>" + esc(flower) + "</span></label>"
        );
      })
      .join("");

    sizeHost.innerHTML = sizes
      .sort()
      .map(function (size) {
        return '<button class="chip" type="button" data-size="' + esc(size) + '">' + esc(size) + "</button>";
      })
      .join("");

    syncFilterUI();
  }

  function syncFilterUI() {
    qsa("[data-category]").forEach(function (chip) {
      chip.setAttribute("aria-pressed", chip.dataset.category === filters.category ? "true" : "false");
    });
    qsa("[data-size]").forEach(function (chip) {
      chip.setAttribute("aria-pressed", filters.sizes.indexOf(chip.dataset.size) >= 0 ? "true" : "false");
    });
    qsa("[data-flower]").forEach(function (input) {
      input.checked = filters.flowers.indexOf(input.value) >= 0;
    });
    var min = qs("#filter-price-min");
    var max = qs("#filter-price-max");
    if (min) min.value = filters.priceMin === null ? "" : filters.priceMin;
    if (max) max.value = filters.priceMax === null ? "" : filters.priceMax;
  }

  function filteredProducts() {
    var list = data.products.filter(function (product) {
      return !product.hidden;
    });

    if (filters.category !== "all") {
      list = list.filter(function (product) {
        return product.category === filters.category;
      });
    }
    if (filters.offersOnly) {
      list = list.filter(function (product) {
        return product.featured;
      });
    }
    if (filters.priceMin !== null) {
      list = list.filter(function (product) {
        return api.priceOf(product) >= filters.priceMin;
      });
    }
    if (filters.priceMax !== null) {
      list = list.filter(function (product) {
        return api.priceOf(product) <= filters.priceMax;
      });
    }
    if (filters.flowers.length) {
      list = list.filter(function (product) {
        return filters.flowers.every(function (flower) {
          return (product.flower_types || []).indexOf(flower) >= 0;
        });
      });
    }
    if (filters.sizes.length) {
      list = list.filter(function (product) {
        return filters.sizes.indexOf(product.size) >= 0;
      });
    }
    if (filters.fulfilment === "delivery") {
      list = list.filter(function (product) {
        return !product.no_delivery;
      });
    }
    if (filters.fulfilment === "pickup") {
      list = list.filter(function (product) {
        return (product.pickup_branches || []).length > 0;
      });
    }
    if (filters.search) {
      var needle = filters.search.toLowerCase();
      list = list.filter(function (product) {
        return (
          product.title.toLowerCase().indexOf(needle) >= 0 ||
          (product.description || "").toLowerCase().indexOf(needle) >= 0 ||
          (product.flower_types || []).join(" ").toLowerCase().indexOf(needle) >= 0
        );
      });
    }

    if (filters.sort === "price-asc") {
      list.sort(function (a, b) {
        return api.priceOf(a) - api.priceOf(b);
      });
    } else if (filters.sort === "price-desc") {
      list.sort(function (a, b) {
        return api.priceOf(b) - api.priceOf(a);
      });
    } else if (filters.sort === "new") {
      list.sort(function (a, b) {
        return String(b.created_at).localeCompare(String(a.created_at));
      });
    }
    return list;
  }

  function renderGrid(resetPage) {
    var grid = qs("[data-shop-grid]");
    var empty = qs("[data-shop-empty]");
    var countNode = qs("[data-shop-count]");
    var more = qs("[data-shop-more]");
    if (!grid) return;

    var all = filteredProducts();
    if (resetPage !== false) view.page = 1;
    var visible = all.slice(0, view.page * PER_PAGE);

    grid.innerHTML = visible
      .map(function (product) {
        return App.productCard(product, { categoryName: categoryName(product.category) });
      })
      .join("");

    if (countNode) countNode.textContent = pluralCount(all.length);
    if (empty) empty.hidden = all.length > 0;
    if (more) more.hidden = visible.length >= all.length;
    App.revealScan(grid);
  }

  /* ------------------------------------------------------------ каталог */

  function applyUrl() {
    var params = new URLSearchParams(window.location.search);
    var category = params.get("category");
    if (category && data.categories.some(function (item) { return item.id === category; })) {
      filters.category = category;
    }
    filters.offersOnly = params.get("offers") === "1";
    var title = qs("[data-shop-title]");
    var subtitle = qs("[data-shop-subtitle]");
    if (filters.offersOnly) {
      if (title) title.textContent = "Предложения";
      if (subtitle) subtitle.textContent = "Букеты и цветы, которые студия отметила в «Предложениях».";
      document.title = "Предложения — Milagro, цветочная студия в Сургуте";
    } else if (filters.category !== "all") {
      var name = categoryName(filters.category);
      if (title) title.textContent = name;
      if (subtitle) subtitle.textContent = "Категория «" + name + "» в студии Milagro, Сургут.";
      document.title = name + " — Milagro, Сургут";
    }
  }

  function wireFilters() {
    var form = qs("[data-filters]");
    if (!form) return;

    qs("[data-filter-categories]").addEventListener("click", function (event) {
      var chip = event.target.closest("[data-category]");
      if (!chip) return;
      filters.category = chip.dataset.category;
      syncFilterUI();
      renderGrid();
    });

    qs("[data-filter-sizes]").addEventListener("click", function (event) {
      var chip = event.target.closest("[data-size]");
      if (!chip) return;
      var size = chip.dataset.size;
      var index = filters.sizes.indexOf(size);
      if (index >= 0) {
        filters.sizes.splice(index, 1);
      } else {
        filters.sizes.push(size);
      }
      syncFilterUI();
      renderGrid();
    });

    qs("[data-filter-flowers]").addEventListener("change", function (event) {
      var input = event.target.closest("[data-flower]");
      if (!input) return;
      var index = filters.flowers.indexOf(input.value);
      if (input.checked && index < 0) filters.flowers.push(input.value);
      if (!input.checked && index >= 0) filters.flowers.splice(index, 1);
      renderGrid();
    });

    form.addEventListener("change", function (event) {
      var radio = event.target.closest('[name="fulfilment"]');
      if (!radio) return;
      filters.fulfilment = radio.value;
      renderGrid();
    });

    qs("#filter-price-min").addEventListener(
      "input",
      debounce(function (event) {
        var value = event.target.value.trim();
        filters.priceMin = value === "" || isNaN(Number(value)) ? null : Number(value);
        renderGrid();
      }, 260)
    );

    qs("#filter-price-max").addEventListener(
      "input",
      debounce(function (event) {
        var value = event.target.value.trim();
        filters.priceMax = value === "" || isNaN(Number(value)) ? null : Number(value);
        renderGrid();
      }, 260)
    );

    qs("#shop-search").addEventListener(
      "input",
      debounce(function (event) {
        filters.search = event.target.value.trim();
        renderGrid();
      }, 220)
    );

    qs("#shop-sort").addEventListener("change", function (event) {
      filters.sort = event.target.value;
      renderGrid();
    });

    form.addEventListener("reset", function () {
      window.setTimeout(function () {
        filters.category = "all";
        filters.priceMin = null;
        filters.priceMax = null;
        filters.flowers = [];
        filters.sizes = [];
        filters.fulfilment = "all";
        filters.search = "";
        filters.sort = "default";
        var search = qs("#shop-search");
        var sort = qs("#shop-sort");
        if (search) search.value = "";
        if (sort) sort.value = "default";
        syncFilterUI();
        renderGrid();
      }, 0);
    });

    var moreBtn = qs("[data-shop-more-btn]");
    if (moreBtn) {
      moreBtn.addEventListener("click", function () {
        view.page += 1;
        renderGrid(false);
      });
    }

    var toggle = qs("[data-filters-toggle]");
    var panel = qs(".filters");
    var closeBtn = qs("[data-filters-close]");
    function setFiltersOpen(open) {
      if (!panel) return;
      panel.classList.toggle("is-open", open);
      document.body.classList.toggle("filters-open", open);
      if (toggle) toggle.setAttribute("aria-expanded", open ? "true" : "false");
    }
    if (toggle) {
      toggle.addEventListener("click", function () {
        setFiltersOpen(!panel.classList.contains("is-open"));
      });
    }
    if (closeBtn) {
      closeBtn.addEventListener("click", function () {
        setFiltersOpen(false);
      });
    }
    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape" && panel && panel.classList.contains("is-open")) {
        setFiltersOpen(false);
      }
    });
  }

  /* ------------------------------------------------------- диалог товара */

  function openDetail(id) {
    var product = productById(id);
    var dialog = qs("[data-detail]");
    var panel = qs("[data-detail-panel]");
    if (!product || !dialog || !panel) return;

    var oldPrice = api.oldPriceOf(product);
    var qty = 1;

    panel.innerHTML =
      '<div class="dialog__head">' +
      '<h2 class="dialog__title" id="detail-title">' + esc(product.title) + "</h2>" +
      '<button class="icon-btn" type="button" data-close aria-label="Закрыть">' + icon("close") + "</button>" +
      "</div>" +
      '<div class="detail__grid">' +
      '<div class="detail__media"><img src="' + esc(product.image_url) + '" alt="' + esc(product.image_alt) + '" width="800" height="600"></div>' +
      '<div class="detail__body">' +
      '<div class="detail__price' + (oldPrice ? " price--sale" : "") + '">' + App.priceLabel(product) +
      (oldPrice ? '<s class="price--old">' + money(oldPrice) + "</s>" : "") + "</div>" +
      '<p class="detail__text">' + esc(product.description) + "</p>" +
      (product.flower_types && product.flower_types.length
        ? '<div class="detail__chips">' +
          product.flower_types.map(function (flower) {
            return '<span class="chip">' + esc(flower) + "</span>";
          }).join("") +
          (product.size ? '<span class="chip">' + esc(product.size) + "</span>" : "") +
          "</div>"
        : "") +
      '<p class="detail__availability">' + esc(api.availabilityText(product)) + "</p>" +
      '<div class="detail__buy">' +
      '<div class="qty">' +
      '<button class="qty__btn" type="button" data-qty-minus aria-label="Убрать одну штуку">−</button>' +
      '<span class="qty__value" data-qty-value>1</span>' +
      '<button class="qty__btn" type="button" data-qty-plus aria-label="Добавить одну штуку">+</button>' +
      "</div>" +
      '<button class="btn btn--primary" type="button" data-add>В корзину · <span data-add-sum>' + App.priceLabel(product) + "</span></button>" +
      "</div>" +
      "</div></div>";

    function refreshQty() {
      var valueNode = qs("[data-qty-value]", panel);
      var sumNode = qs("[data-add-sum]", panel);
      if (valueNode) valueNode.textContent = String(qty);
      if (sumNode) sumNode.textContent = money(api.priceOf(product) * qty);
    }

    qs("[data-qty-minus]", panel).addEventListener("click", function () {
      qty = Math.max(1, qty - 1);
      refreshQty();
    });
    qs("[data-qty-plus]", panel).addEventListener("click", function () {
      qty = Math.min(99, qty + 1);
      refreshQty();
    });
    qs("[data-add]", panel).addEventListener("click", function () {
      App.cart.add(product.id, qty);
      App.toast("Добавили в корзину: " + product.title);
      dialog.close();
      openCart();
    });
    qs("[data-close]", panel).addEventListener("click", function () {
      dialog.close();
    });

    dialog.showModal();
  }

  /* ------------------------------------------------------------- корзина */

  function openCart() {
    var dialog = qs("[data-cart]");
    if (!dialog) return;
    if (!dialog.open) dialog.showModal();
    renderCart();
  }

  function renderCart() {
    var panel = qs("[data-cart-panel]");
    if (!panel) return;
    var rows = cartProducts();

    if (!rows.length) {
      panel.innerHTML =
        '<div class="dialog__head">' +
        '<h2 class="dialog__title" id="cart-title">Корзина</h2>' +
        '<button class="icon-btn" type="button" data-close aria-label="Закрыть">' + icon("close") + "</button>" +
        "</div>" +
        '<div class="dialog__body">' +
        '<div class="empty-state"><p>Корзина пуста.</p>' +
        '<a class="btn btn--outline btn--sm" href="shop.html">Перейти в каталог</a></div>' +
        "</div>";
      bindClose(panel, qs("[data-cart]"));
      return;
    }

    var goods = cartGoods();

    panel.innerHTML =
      '<div class="dialog__head">' +
      '<h2 class="dialog__title" id="cart-title">Корзина · ' + pluralCount(App.cart.count()) + "</h2>" +
      '<button class="icon-btn" type="button" data-close aria-label="Закрыть">' + icon("close") + "</button>" +
      "</div>" +
      '<div class="cart__list">' +
      rows
        .map(function (row) {
          var product = row.product;
          return (
            '<div class="cart-item" data-cart-item="' + esc(product.id) + '">' +
            '<div class="cart-item__media"><img src="' + esc(product.image_url) + '" alt="' + esc(product.image_alt) + '" width="78" height="78"></div>' +
            "<div>" +
            '<p class="cart-item__title">' + esc(product.title) + "</p>" +
            '<p class="cart-item__meta">' + esc(categoryName(product.category)) + (product.size ? " · " + esc(product.size) : "") + "</p>" +
            '<div class="cart-item__controls">' +
            '<div class="qty">' +
            '<button class="qty__btn" type="button" data-cart-minus aria-label="Меньше">−</button>' +
            '<span class="qty__value">' + row.quantity + "</span>" +
            '<button class="qty__btn" type="button" data-cart-plus aria-label="Больше">+</button>' +
            "</div>" +
            '<button class="cart-item__remove" type="button" data-cart-remove>Убрать</button>' +
            "</div></div>" +
            '<span class="cart-item__sum">' + money(api.priceOf(product) * row.quantity) + "</span>" +
            "</div>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="cart__foot">' +
      '<div class="cart__row"><span>Товары</span><span>' + money(goods) + "</span></div>" +
      '<div class="cart__row"><span>Доставка</span><span>' + deliveryCaption() + "</span></div>" +
      '<div class="cart__row cart__row--total"><span>Итого</span><span data-cart-total>' + money(goods) + "</span></div>" +
      '<button class="btn btn--primary btn--block" type="button" data-checkout>Оформить заказ</button>' +
      '<p class="cart__note">Оплата на этапе 1 не подключена: заказ уходит в тестовое хранилище.</p>' +
      "</div>";

    bindClose(panel, qs("[data-cart]"));

    qsa("[data-cart-item]", panel).forEach(function (item) {
      var id = item.dataset.cartItem;
      qs("[data-cart-plus]", item).addEventListener("click", function () {
        var row = App.cart.read().filter(function (entry) { return entry.id === id; })[0];
        App.cart.set(id, (row ? row.quantity : 1) + 1);
        renderCart();
      });
      qs("[data-cart-minus]", item).addEventListener("click", function () {
        var row = App.cart.read().filter(function (entry) { return entry.id === id; })[0];
        if (row && row.quantity > 1) {
          App.cart.set(id, row.quantity - 1);
          renderCart();
        }
      });
      qs("[data-cart-remove]", item).addEventListener("click", function () {
        App.cart.remove(id);
        renderCart();
      });
    });

    qs("[data-checkout]", panel).addEventListener("click", function () {
      qs("[data-cart]").close();
      openOrder();
    });
  }

  function deliveryCaption() {
    var prices = data.delivery.zones.map(function (zone) {
      return zone.price;
    }).filter(function (price) {
      return typeof price === "number";
    });
    if (!prices.length) return "уточняется";
    return "от " + money(Math.min.apply(null, prices));
  }

  function bindClose(panel, dialog) {
    var close = qs("[data-close]", panel);
    if (close) {
      close.addEventListener("click", function () {
        dialog.close();
      });
    }
  }

  /* --------------------------------------------------- оформление заказа */

  function methodAvailability() {
    var rows = cartProducts();
    var hasPickupOnly = rows.some(function (row) {
      return row.product.no_delivery;
    });
    var branches = data.delivery.pickup.map(function (branch) {
      var hasAll = rows.length > 0 && rows.every(function (row) {
        return (row.product.pickup_branches || []).indexOf(branch.id) >= 0;
      });
      return { branch: branch, hasAll: hasAll };
    });
    var common = branches.filter(function (item) {
      return item.hasAll;
    });
    return {
      hasPickupOnly: hasPickupOnly,
      branches: branches,
      common: common,
      noCommon: rows.length > 0 && !hasPickupOnly && common.length === 0
    };
  }

  function todayEkb() {
    return api.ekbNow().date;
  }

  function addDays(dateString, days) {
    var parts = dateString.split("-").map(Number);
    var ms = Date.UTC(parts[0], parts[1] - 1, parts[2]) + days * 86400000;
    return new Date(ms).toISOString().slice(0, 10);
  }

  function monthLabel(year, month) {
    return new Date(Date.UTC(year, month, 1)).toLocaleDateString("ru-RU", {
      month: "long",
      year: "numeric",
      timeZone: "UTC"
    });
  }

  function slotsFor(method) {
    return method === "pickup" ? data.delivery.pickup_slots : data.delivery.slots;
  }

  function slotDisabled(method, date, slot) {
    if (!date) return true;
    var now = api.ekbNow();
    var slots = slotsFor(method);
    if (date < now.date) return true;
    if (date === now.date) {
      var start = Number(String(slot.start).slice(0, 2)) * 60 + Number(String(slot.start).slice(3, 5));
      return start - now.minutes < data.delivery.lead_minutes;
    }
    return false;
  }

  function hasAnySlot(method, date) {
    return slotsFor(method).some(function (slot) {
      return !slotDisabled(method, date, slot);
    });
  }

  function openOrder() {
    var dialog = qs("[data-order]");
    var panel = qs("[data-order-panel]");
    if (!dialog || !panel) return;

    var rows = cartProducts();
    if (!rows.length) {
      App.toast("Сначала добавьте букет в корзину", "error");
      return;
    }

    var availability = methodAvailability();
    if (availability.hasPickupOnly || availability.noCommon) {
      order.method = "pickup";
    }
    if (!data.delivery.zones.some(function (zone) { return zone.id === order.zone; })) {
      order.zone = data.delivery.zones.length ? data.delivery.zones[0].id : "";
    }
    if (!data.delivery.surprise_zones.some(function (zone) { return zone.id === order.surpriseZone; })) {
      order.surpriseZone = data.delivery.surprise_zones.length ? data.delivery.surprise_zones[0].id : "";
    }
    if (availability.common.length && !order.pickupBranch) {
      order.pickupBranch = availability.common[0].branch.id;
    }
    if (!order.date) order.date = todayEkb();
    if (!hasAnySlot(order.method, order.date)) {
      order.date = addDays(todayEkb(), 1);
    }
    if (order.method === "pickup" && availability.common.length && !availability.common.some(function (item) {
      return item.branch.id === order.pickupBranch;
    })) {
      order.pickupBranch = availability.common[0].branch.id;
    }

    calendar = (function () {
      var parts = order.date.split("-").map(Number);
      return { year: parts[0], month: parts[1] - 1 };
    })();

    panel.innerHTML = orderMarkup(rows, availability);
    wireOrder(panel, availability);
    renderCalendar();
    renderSlots();
    renderTotals();
    syncMethodPanels();

    dialog.showModal();
  }

  function zoneOptions(zones, selected) {
    return zones
      .map(function (zone) {
        return (
          '<option value="' + esc(zone.id) + '"' + (zone.id === selected ? " selected" : "") + ">" +
          esc(zone.name) + " — " + (typeof zone.price === "number" ? money(zone.price) : "стоимость уточняется") +
          "</option>"
        );
      })
      .join("");
  }

  function orderMarkup(rows, availability) {
    var deliveryDisabled = availability.hasPickupOnly;
    var pickupDisabled = availability.noCommon || !availability.common.length;

    return (
      '<div class="dialog__head">' +
      '<h2 class="dialog__title" id="order-title">Оформление заказа</h2>' +
      '<button class="icon-btn" type="button" data-close aria-label="Закрыть">' + icon("close") + "</button>" +
      "</div>" +
      '<form class="order__grid" data-order-form novalidate>' +
      '<div class="order__form">' +
      '<p class="order__errors" data-order-errors role="alert" aria-live="assertive"></p>' +

      /* способ получения */
      '<fieldset class="order-block">' +
      '<legend class="order-block__legend">Как получить</legend>' +
      '<div class="methods">' +
      methodCard("delivery", "Доставка", deliveryDisabled ? "Недоступна: в корзине есть товар «только самовывоз»" : "Курьер по Сургуту, оплата при получении", deliveryDisabled) +
      methodCard("surprise", "Сюрприз", deliveryDisabled ? "Недоступно: в корзине есть товар «только самовывоз»" : "Не знаете адрес — позвоним получателю", deliveryDisabled) +
      methodCard("pickup", "Самовывоз", pickupDisabled ? "Нет студии, где есть все товары корзины" : "Забрать в студии на Набережном", pickupDisabled) +
      "</div></fieldset>" +

      /* доставка */
      '<fieldset class="order-block" data-panel="delivery">' +
      '<legend class="order-block__legend">Куда доставить</legend>' +
      '<div class="order-fields order-fields--two">' +
      field("delivery_zone", "Район доставки", '<select class="field__select" id="order-zone" name="delivery_zone">' + zoneOptions(data.delivery.zones, order.zone) + "</select>") +
      field("address", "Адрес доставки", '<input class="field__input" id="order-address" name="address" autocomplete="street-address" placeholder="Улица, дом, квартира">') +
      "</div>" +
      '<label class="checkbox"><input type="checkbox" id="order-same-recipient" checked>' +
      "<span>Получу сам — телефон получателя совпадает с моим</span></label>" +
      '<div data-recipient-wrap hidden>' +
      field("recipient_phone", "Телефон получателя", '<input class="field__input" id="order-recipient-phone" name="recipient_phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 ___ ___-__-__">') +
      "</div>" +
      "</fieldset>" +

      /* сюрприз */
      '<fieldset class="order-block" data-panel="surprise">' +
      '<legend class="order-block__legend">Сюрприз</legend>' +
      '<p class="order-block__note muted">Не знаете адрес? Оставьте телефон получателя — мы позвоним ему, уточним адрес и время, не раскрывая сюрприз.</p>' +
      '<div class="order-fields order-fields--two">' +
      field("delivery_zone", "Куда", '<select class="field__select" id="order-surprise-zone" name="surprise_zone">' + zoneOptions(data.delivery.surprise_zones, order.surpriseZone) + "</select>") +
      field("recipient_phone", "Телефон получателя", '<input class="field__input" id="order-surprise-phone" name="recipient_phone_surprise" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 ___ ___-__-__">') +
      "</div>" +
      field("surprise_note", "Что знаете об адресе · необязательно", '<input class="field__input" id="order-surprise-note" name="surprise_note" placeholder="Район, ориентир, домофон">') +
      "</fieldset>" +

      /* самовывоз */
      '<fieldset class="order-block" data-panel="pickup">' +
      '<legend class="order-block__legend">Студия самовывоза</legend>' +
      (pickupDisabled
        ? '<p class="note note--muted">' + icon("question") + "<span>Товары из корзины есть в разных студиях или в студии нет всех позиций — выберите доставку или оформите отдельными заказами.</span></p>"
        : '<div class="order-fields">' +
          availability.branches.map(function (item) {
            return (
              '<label class="checkbox"><input type="radio" name="pickup_branch" value="' + esc(item.branch.id) + '"' +
              (item.branch.id === order.pickupBranch ? " checked" : "") + (item.hasAll ? "" : " disabled") + ">" +
              "<span><b>" + esc(item.branch.name) + "</b> · " + esc(item.branch.address) + (item.branch.details ? ", " + esc(item.branch.details) : "") +
              " · " + esc(item.branch.hours) + (item.hasAll ? "" : " — здесь нет всех товаров корзины") + "</span></label>"
            );
          }).join("") +
          "</div>") +
      "</fieldset>" +

      /* когда */
      '<fieldset class="order-block">' +
      '<legend class="order-block__legend">Когда доставить / забрать</legend>' +
      '<p class="when__hint">Время · по Екатеринбургу (UTC+5)</p>' +
      '<div class="when">' +
      '<div class="calendar" data-calendar></div>' +
      '<div class="slots" data-slots role="group" aria-label="Время"></div>' +
      '<p class="field__error" data-error-for="delivery_date"></p>' +
      "</div></fieldset>" +

      /* контакты */
      '<fieldset class="order-block">' +
      '<legend class="order-block__legend">Контакты</legend>' +
      '<div class="order-fields order-fields--two">' +
      field("name", "Имя", '<input class="field__input" id="order-name" name="name" autocomplete="name" placeholder="Как к вам обращаться">') +
      field("phone", "Телефон", '<input class="field__input" id="order-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+7 ___ ___-__-__">') +
      "</div>" +
      field("email", "Email для чека · необязательно", '<input class="field__input" id="order-email" name="email" type="email" autocomplete="email" placeholder="name@example.com">') +
      field("comment", "Пожелания или текст открытки · необязательно", '<textarea class="field__textarea" id="order-comment" name="comment" rows="3" placeholder="Например: подписать открытку"></textarea>') +
      "</fieldset>" +

      /* согласия */
      '<fieldset class="order-block">' +
      '<legend class="order-block__legend">Согласия</legend>' +
      '<div class="order__consents">' +
      '<label class="field" data-field="data_consent"><span class="checkbox"><input type="checkbox" id="order-consent-data" name="data_consent">' +
      '<span>Согласен с <a href="consent.html" target="_blank" rel="noopener">обработкой персональных данных</a></span></span>' +
      '<span class="field__error" data-error-for="data_consent"></span></label>' +
      '<label class="field" data-field="offer_accepted"><span class="checkbox"><input type="checkbox" id="order-consent-offer" name="offer_accepted">' +
      '<span>Принимаю <a href="offer.html" target="_blank" rel="noopener">условия оферты</a></span></span>' +
      '<span class="field__error" data-error-for="offer_accepted"></span></label>' +
      '<p class="order-aside__note">Данные нужны только для заказа, без рассылок. <a href="privacy.html" target="_blank" rel="noopener">Политика обработки данных</a>.</p>' +
      "</div></fieldset>" +

      '<div class="order__submit">' +
      '<button class="btn btn--primary btn--block" type="submit" data-order-submit>Оформить заказ</button>' +
      '<p class="order-aside__note">Тестовый режим: оплата не подключена, заказ сохраняется только в браузере.</p>' +
      "</div>" +
      "</div>" +

      /* итог */
      '<aside class="order__aside">' +
      '<h3 class="order-aside__title">Ваш заказ</h3>' +
      '<div class="order-aside__items">' +
      rows
        .map(function (row) {
          return (
            '<div class="order-aside__item">' +
            '<img src="' + esc(row.product.image_url) + '" alt="' + esc(row.product.image_alt) + '" width="44" height="44">' +
            '<span class="order-aside__item-name">' + esc(row.product.title) + ' <span class="muted">× ' + row.quantity + "</span></span>" +
            '<span class="order-aside__sum">' + money(api.priceOf(row.product) * row.quantity) + "</span>" +
            "</div>"
          );
        })
        .join("") +
      "</div>" +
      '<div class="order-aside__totals">' +
      '<div class="order-aside__row"><span>Товары</span><span data-total-goods>' + money(cartGoods()) + "</span></div>" +
      '<div class="order-aside__row"><span>Доставка</span><span data-total-delivery>—</span></div>' +
      '<div class="order-aside__row order-aside__row--total"><span>Итого</span><span data-total-sum>' + money(cartGoods()) + "</span></div>" +
      "</div>" +
      '<p class="order-aside__note" data-delivery-note></p>' +
      "</aside>" +
      "</form>"
    );
  }

  function methodCard(value, title, text, disabled) {
    return (
      '<label class="method' + (disabled ? " is-disabled" : "") + '">' +
      '<input type="radio" name="delivery_method" value="' + value + '"' +
      (order.method === value ? " checked" : "") + (disabled ? " disabled" : "") + ">" +
      '<span class="method__title">' + title + "</span>" +
      '<span class="method__text">' + text + "</span>" +
      "</label>"
    );
  }

  function field(name, label, control) {
    return (
      '<label class="field" data-field="' + name + '">' +
      '<span class="field__label">' + label + "</span>" +
      control +
      '<span class="field__error" data-error-for="' + name + '"></span>' +
      "</label>"
    );
  }

  function wireOrder(panel, availability) {
    var form = qs("[data-order-form]", panel);
    var dialog = qs("[data-order]");

    bindClose(panel, dialog);

    qsa('[name="delivery_method"]', form).forEach(function (input) {
      input.addEventListener("change", function () {
        order.method = input.value;
        if (order.method === "pickup" && availability.common.length) {
          var checked = qs('[name="pickup_branch"]:checked', form);
          order.pickupBranch = checked ? checked.value : availability.common[0].branch.id;
        }
        order.slot = "";
        syncMethodPanels();
        renderSlots();
        renderTotals();
      });
    });

    qs("#order-zone", form).addEventListener("change", function (event) {
      order.zone = event.target.value;
      renderTotals();
    });
    qs("#order-surprise-zone", form).addEventListener("change", function (event) {
      order.surpriseZone = event.target.value;
      renderTotals();
    });

    var same = qs("#order-same-recipient", form);
    var recipientWrap = qs("[data-recipient-wrap]", form);
    function syncRecipient() {
      order.sameRecipient = same.checked;
      recipientWrap.hidden = same.checked;
    }
    same.addEventListener("change", syncRecipient);
    syncRecipient();

    qsa('[name="pickup_branch"]', form).forEach(function (input) {
      input.addEventListener("change", function () {
        order.pickupBranch = input.value;
      });
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      submitOrder(form);
    });
  }

  function syncMethodPanels() {
    var panel = qs("[data-order-panel]");
    if (!panel) return;
    qsa("[data-panel]", panel).forEach(function (block) {
      block.hidden = block.dataset.panel !== order.method;
    });
    var calendarNode = qs("[data-calendar]", panel);
    if (calendarNode) {
      renderCalendar();
    }
  }

  /* ----------------------------------------------------------- календарь */

  function renderCalendar() {
    var host = qs("[data-calendar]");
    if (!host) return;

    var today = todayEkb();
    var firstDate = today;
    var lastDate = addDays(today, data.delivery.booking_days);
    var year = calendar.year;
    var month = calendar.month;

    var firstOfMonth = Date.UTC(year, month, 1);
    var monthStart = new Date(firstOfMonth);
    var daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
    var startOffset = (monthStart.getUTCDay() + 6) % 7; // Пн = 0

    var canPrev = new Date(Date.UTC(year, month, 1)) > new Date(Date.UTC(Number(firstDate.slice(0, 4)), Number(firstDate.slice(5, 7)) - 1, 1));
    var canNext = new Date(Date.UTC(year, month, 1)) < new Date(Date.UTC(Number(lastDate.slice(0, 4)), Number(lastDate.slice(5, 7)) - 1, 1));

    var cells = [];
    for (var i = 0; i < startOffset; i += 1) {
      cells.push('<span class="calendar__day calendar__day--empty"></span>');
    }
    for (var day = 1; day <= daysInMonth; day += 1) {
      var iso = year + "-" + String(month + 1).padStart(2, "0") + "-" + String(day).padStart(2, "0");
      var disabled = iso < firstDate || iso > lastDate || !hasAnySlot(order.method, iso);
      cells.push(
        '<button class="calendar__day" type="button" data-date="' + iso + '" aria-pressed="' + (iso === order.date) + '"' +
        (disabled ? " disabled" : "") + ">" + day + "</button>"
      );
    }

    host.innerHTML =
      '<div class="calendar__head">' +
      '<span class="calendar__month">' + monthLabel(year, month) + "</span>" +
      '<span class="calendar__nav">' +
      '<button type="button" data-cal-prev aria-label="Предыдущий месяц"' + (canPrev ? "" : " disabled") + ">←</button>" +
      '<button type="button" data-cal-next aria-label="Следующий месяц"' + (canNext ? "" : " disabled") + ">→</button>" +
      "</span></div>" +
      '<div class="calendar__weekdays">' +
      ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"]
        .map(function (label) {
          return '<span class="calendar__weekday">' + label + "</span>";
        })
        .join("") +
      "</div>" +
      '<div class="calendar__grid">' + cells.join("") + "</div>";

    qs("[data-cal-prev]", host).addEventListener("click", function () {
      calendar.month -= 1;
      if (calendar.month < 0) {
        calendar.month = 11;
        calendar.year -= 1;
      }
      renderCalendar();
    });
    qs("[data-cal-next]", host).addEventListener("click", function () {
      calendar.month += 1;
      if (calendar.month > 11) {
        calendar.month = 0;
        calendar.year += 1;
      }
      renderCalendar();
    });

    qsa("[data-date]", host).forEach(function (button) {
      button.addEventListener("click", function () {
        order.date = button.dataset.date;
        order.slot = "";
        renderCalendar();
        renderSlots();
        clearError("delivery_date");
      });
    });
  }

  function renderSlots() {
    var host = qs("[data-slots]");
    if (!host) return;
    var slots = slotsFor(order.method);
    var anyAvailable = false;

    host.innerHTML = slots
      .map(function (slot) {
        var disabled = slotDisabled(order.method, order.date, slot);
        if (!disabled) anyAvailable = true;
        return (
          '<button class="slot" type="button" data-slot="' + esc(slot.label) + '" aria-pressed="' +
          (order.slot === slot.label) + '"' + (disabled ? " disabled" : "") + ">" + esc(slot.label) + "</button>"
        );
      })
      .join("");

    if (!anyAvailable) {
      host.insertAdjacentHTML(
        "afterbegin",
        '<p class="admin-hint" style="grid-column:1/-1">На эту дату времени нет — выберите другой день.</p>'
      );
    }

    qsa("[data-slot]", host).forEach(function (button) {
      button.addEventListener("click", function () {
        order.slot = button.dataset.slot;
        qsa("[data-slot]", host).forEach(function (node) {
          node.setAttribute("aria-pressed", node === button ? "true" : "false");
        });
        clearError("delivery_date");
      });
    });
  }

  /* -------------------------------------------------------------- суммы */

  function activeZoneId() {
    return order.method === "surprise" ? order.surpriseZone : order.zone;
  }

  function deliveryAmount() {
    if (order.method === "pickup") return { value: 0, known: true };
    var zone = data.delivery.zones
      .concat(data.delivery.surprise_zones)
      .filter(function (item) {
        return item.id === activeZoneId();
      })[0];
    if (!zone || typeof zone.price !== "number") return { value: 0, known: false };
    return { value: zone.price, known: true };
  }

  function renderTotals() {
    var panel = qs("[data-order-panel]");
    if (!panel) return;
    var goods = cartGoods();
    var delivery = deliveryAmount();
    var total = goods + delivery.value;

    var goodsNode = qs("[data-total-goods]", panel);
    var deliveryNode = qs("[data-total-delivery]", panel);
    var sumNode = qs("[data-total-sum]", panel);
    var note = qs("[data-delivery-note]", panel);

    if (goodsNode) goodsNode.textContent = money(goods);
    if (deliveryNode) {
      deliveryNode.textContent = order.method === "pickup"
        ? "самовывоз"
        : delivery.known ? money(delivery.value) : "уточняется";
    }
    if (sumNode) sumNode.textContent = money(total);
    if (note) {
      note.textContent = order.method === "pickup"
        ? "Бесплатно: забираете в студии."
        : delivery.known
          ? "Стоимость доставки зафиксирована в заказе."
          : "Точную стоимость доставки подтвердит флорист по телефону — она добавится к заказу.";
    }
  }

  /* --------------------------------------------------------- проверки */

  function setError(name, message) {
    var wrapper = qs('[data-field="' + name + '"]', qs("[data-order-panel]"));
    var message_node = qs('[data-error-for="' + name + '"]', qs("[data-order-panel]"));
    if (message_node) message_node.textContent = message;
    if (wrapper && wrapper.classList.contains("field")) {
      wrapper.classList.add("is-invalid");
    } else if (message_node) {
      message_node.style.display = "block";
    }
  }

  function clearErrors() {
    var panel = qs("[data-order-panel]");
    qsa(".field.is-invalid", panel).forEach(function (node) {
      node.classList.remove("is-invalid");
    });
    qsa("[data-error-for]", panel).forEach(function (node) {
      node.textContent = "";
      node.style.display = "";
    });
    var box = qs("[data-order-errors]", panel);
    if (box) {
      box.textContent = "";
      box.classList.remove("is-visible");
    }
  }

  function clearError(name) {
    var wrapper = qs('[data-field="' + name + '"]', qs("[data-order-panel]"));
    var message_node = qs('[data-error-for="' + name + '"]', qs("[data-order-panel]"));
    if (wrapper) wrapper.classList.remove("is-invalid");
    if (message_node) message_node.textContent = "";
  }

  function collectOrder(form) {
    var checkedMethod = qs('[name="delivery_method"]:checked', form);
    var branch = qs('[name="pickup_branch"]:checked', form);
    return {
      name: qs("#order-name", form).value.trim(),
      phone: qs("#order-phone", form).value.trim(),
      email: qs("#order-email", form).value.trim(),
      comment: qs("#order-comment", form).value.trim(),
      delivery_method: checkedMethod ? checkedMethod.value : "",
      delivery_zone: order.method === "surprise" ? order.surpriseZone : order.zone,
      address: order.method === "delivery" ? qs("#order-address", form).value.trim() : "",
      pickup_branch: branch ? branch.value : "",
      delivery_date: order.date,
      delivery_slot: order.slot,
      recipient_phone: order.method === "delivery"
        ? (order.sameRecipient ? qs("#order-phone", form).value.trim() : qs("#order-recipient-phone", form).value.trim())
        : order.method === "surprise" ? qs("#order-surprise-phone", form).value.trim() : "",
      same_recipient: order.method === "delivery" ? order.sameRecipient : false,
      surprise_note: qs("#order-surprise-note", form) ? qs("#order-surprise-note", form).value.trim() : "",
      data_consent: qs("#order-consent-data", form).checked,
      offer_accepted: qs("#order-consent-offer", form).checked,
      consent_version: DOC_VERSION,
      privacy_version: DOC_VERSION,
      offer_version: DOC_VERSION,
      items: App.cart.read().map(function (item) {
        return { product_id: item.id, quantity: item.quantity };
      })
    };
  }

  function validate(payload, form) {
    clearErrors();
    var errors = {};
    if (App.digits(payload.phone).length < 10) errors.phone = "Телефон — не меньше 10 цифр";
    if (payload.name.length < 2) errors.name = "Имя — не меньше 2 символов";
    if (payload.email && payload.email.indexOf("@") < 0) errors.email = "Проверьте email";

    if (payload.delivery_method === "delivery") {
      if (!payload.delivery_zone) errors.delivery_zone = "Выберите район доставки";
      if (payload.address.length < 5) errors.address = "Укажите адрес доставки";
      if (!payload.same_recipient && App.digits(payload.recipient_phone).length < 10) {
        errors.recipient_phone = "Телефон получателя — не меньше 10 цифр";
      }
    }
    if (payload.delivery_method === "surprise") {
      if (!payload.delivery_zone) errors.delivery_zone = "Выберите, куда доставить";
      if (App.digits(payload.recipient_phone).length < 10) errors.recipient_phone = "Телефон получателя — не меньше 10 цифр";
    }
    if (payload.delivery_method === "pickup" && !payload.pickup_branch) {
      errors.pickup_branch = "Выберите студию";
    }
    if (!payload.delivery_slot && !errors.delivery_date) errors.delivery_date = "Выберите время";
    var when = api.checkWhen(payload.delivery_method, payload.delivery_date, payload.delivery_slot);
    if (when && !errors.delivery_date) errors.delivery_date = when;
    if (!payload.data_consent) errors.data_consent = "Нужно согласие на обработку данных";
    if (!payload.offer_accepted) errors.offer_accepted = "Нужно принять оферту";

    var keys = Object.keys(errors);
    if (!keys.length) return true;

    keys.forEach(function (key) {
      setError(key, errors[key]);
    });

    var box = qs("[data-order-errors]", qs("[data-order-panel]"));
    if (box) {
      box.textContent = "Проверьте поля: " + keys.length + " " + App.plural(keys.length, "поле", "поля", "полей") + " с ошибкой.";
      box.classList.add("is-visible");
    }

    var first = qs('[data-field="' + keys[0] + '"]', form);
    var target = first ? qs("input, select, textarea", first) : null;
    if (target) target.focus();
    return false;
  }

  function submitOrder(form) {
    var button = qs("[data-order-submit]", form);
    var payload = collectOrder(form);
    if (!validate(payload, form)) return;

    button.disabled = true;
    button.textContent = "Отправляем…";

    api("/api/orders", { method: "POST", body: payload })
      .then(function (response) {
        App.cart.clear();
        qs("[data-order]").close();
        showSuccess(response.order_id, payload);
      })
      .catch(function (error) {
        var errors = error && error.payload && error.payload.errors;
        if (errors) {
          Object.keys(errors).forEach(function (key) {
            setError(key, errors[key]);
          });
          var box = qs("[data-order-errors]", qs("[data-order-panel]"));
          if (box) {
            box.textContent = error.message;
            box.classList.add("is-visible");
          }
        } else {
          App.toast(error.message || "Не удалось оформить заказ", "error");
        }
      })
      .then(function () {
        button.disabled = false;
        button.textContent = "Оформить заказ";
      });
  }

  /* ------------------------------------------------------------- успех */

  function showSuccess(orderId, payload) {
    var dialog = qs("[data-success]");
    var panel = qs("[data-success-panel]");
    if (!dialog || !panel) return;

    panel.innerHTML =
      '<span class="success__icon">' + icon("check") + "</span>" +
      '<h2 class="success__title" id="success-title">Заказ оформлен</h2>' +
      '<p class="success__text">Номер заказа: <b>' + esc(orderId) + "</b>. " +
      (payload.delivery_method === "pickup"
        ? "Мы позвоним, чтобы подтвердить время самовывоза."
        : "Мы позвоним, чтобы подтвердить детали доставки.") +
      "</p>" +
      '<p class="success__test">Тестовый режим: заказ сохранён только в браузере. Оплата и отправка на сервер появятся на этапе 2.</p>' +
      '<div class="btn-row">' +
      '<a class="btn btn--primary" href="shop.html">Продолжить покупки</a>' +
      '<a class="btn btn--outline" href="tel:+79224461068">Позвонить</a>' +
      "</div>";

    dialog.showModal();
    qs("[data-close]", panel) && qs("[data-close]", panel).addEventListener("click", function () {
      dialog.close();
    });
  }

  /* ------------------------------------------------ SEO-шаблоны страниц */

  function pageMode() {
    return document.body.getAttribute("data-page") || "shop";
  }

  function setMeta(title, description) {
    if (title) document.title = title;
    if (description) {
      var meta = qs('meta[name="description"]');
      if (meta) meta.setAttribute("content", description);
    }
  }

  function renderBreadcrumbs(items) {
    var host = qs("[data-breadcrumbs]");
    if (!host) return;
    host.innerHTML = items
      .map(function (item, index) {
        var last = index === items.length - 1;
        var node = last
          ? '<span aria-current="page">' + esc(item.label) + "</span>"
          : '<a href="' + esc(item.href) + '">' + esc(item.label) + "</a>";
        return node + (last ? "" : '<span class="breadcrumbs__sep" aria-hidden="true">/</span>');
      })
      .join("");
  }

  function renderSeoCategory() {
    var slug = new URLSearchParams(window.location.search).get("slug");
    var category = data.categories.filter(function (item) {
      return item.slug === slug;
    })[0];
    var head = qs("[data-seo-head]");
    var grid = qs("[data-seo-grid]");
    var text = qs("[data-seo-text]");
    if (!head || !grid) return;

    if (!category) {
      head.innerHTML =
        '<h1 class="h-section">Категория не найдена</h1>' +
        '<p class="muted">Возможно, ссылка устарела. Откройте <a href="shop.html">каталог</a> — там все букеты и цветы.</p>';
      grid.innerHTML = "";
      return;
    }

    setMeta(category.seo_title, category.seo_description);
    renderBreadcrumbs([
      { label: "Главная", href: "index.html" },
      { label: "Магазин", href: "shop.html" },
      { label: category.name }
    ]);

    var products = data.products.filter(function (product) {
      return product.category === category.id && !product.hidden;
    });

    head.innerHTML =
      '<p class="eyebrow">Коллекция</p>' +
      '<h1 class="h-section" data-seo-h1>' + esc(category.seo_h1 || category.name) + "</h1>" +
      '<p class="lead">' + esc(category.description) + "</p>";

    grid.innerHTML = products.length
      ? products
          .map(function (product) {
            return App.productCard(product, { categoryName: category.name });
          })
          .join("")
      : '<div class="empty-state"><p>В этой коллекции пока нет товаров.</p>' +
        '<a class="btn btn--outline btn--sm" href="shop.html">Открыть каталог</a></div>';

    if (text) {
      var paragraphs = String(category.seo_text || "").split(/\n\s*\n/).filter(Boolean);
      text.innerHTML = paragraphs.length
        ? paragraphs.map(function (paragraph) { return "<p>" + esc(paragraph) + "</p>"; }).join("")
        : '<p class="muted">Описание коллекции готовится.</p>';
    }
  }

  function renderSeoProduct() {
    var slug = new URLSearchParams(window.location.search).get("slug");
    var product = data.products.filter(function (item) {
      return item.slug === slug;
    })[0];
    var host = qs("[data-product-view]");
    var relatedHost = qs("[data-related]");
    if (!host) return;

    if (!product || product.hidden) {
      host.innerHTML =
        '<div class="empty-state"><p>Такого товара нет или он скрыт.</p>' +
        '<a class="btn btn--outline btn--sm" href="shop.html">Открыть каталог</a></div>';
      return;
    }

    var category = data.categories.filter(function (item) {
      return item.id === product.category;
    })[0];
    var oldPrice = api.oldPriceOf(product);

    setMeta(product.seo_title, product.seo_description);
    renderBreadcrumbs([
      { label: "Главная", href: "index.html" },
      { label: "Магазин", href: "shop.html" },
      category ? { label: category.name, href: categoryHref(category) } : { label: "Каталог", href: "shop.html" },
      { label: product.title }
    ]);

    var qty = 1;
    host.innerHTML =
      '<article class="product-view">' +
      '<div class="product-view__media">' +
      '<img src="' + esc(product.image_url) + '" alt="' + esc(product.image_alt) + '" width="1000" height="750">' +
      "</div>" +
      '<div class="product-view__info">' +
      '<p class="eyebrow">' + esc(category ? category.name : "Каталог") + "</p>" +
      '<h1 class="h-section product-view__title">' + esc(product.title) + "</h1>" +
      '<p class="product-view__price' + (oldPrice ? " price--sale" : "") + '">' + App.priceLabel(product) +
      (oldPrice ? ' <s class="price--old">' + money(oldPrice) + "</s>" : "") + "</p>" +
      '<p class="product-view__text">' + esc(product.description) + "</p>" +
      (product.flower_types && product.flower_types.length
        ? '<div class="detail__chips">' +
          product.flower_types.map(function (flower) {
            return '<span class="chip">' + esc(flower) + "</span>";
          }).join("") +
          (product.size ? '<span class="chip">' + esc(product.size) + "</span>" : "") +
          "</div>"
        : "") +
      '<p class="detail__availability">' + esc(api.availabilityText(product)) + "</p>" +
      '<div class="product-view__buy">' +
      '<div class="qty">' +
      '<button class="qty__btn" type="button" data-qty-minus aria-label="Убрать одну штуку">−</button>' +
      '<span class="qty__value" data-qty-value>1</span>' +
      '<button class="qty__btn" type="button" data-qty-plus aria-label="Добавить одну штуку">+</button>' +
      "</div>" +
      '<button class="btn btn--primary" type="button" data-add>В корзину · <span data-add-sum>' + App.priceLabel(product) + "</span></button>" +
      "</div>" +
      '<p class="order-aside__note">Оформить доставку или самовывоз можно в <a href="shop.html#cart">корзине</a>.</p>' +
      "</div></article>";

    App.revealScan(host);

    var valueNode = qs("[data-qty-value]", host);
    var sumNode = qs("[data-add-sum]", host);
    qs("[data-qty-minus]", host).addEventListener("click", function () {
      qty = Math.max(1, qty - 1);
      valueNode.textContent = String(qty);
      sumNode.textContent = money(api.priceOf(product) * qty);
    });
    qs("[data-qty-plus]", host).addEventListener("click", function () {
      qty = Math.min(99, qty + 1);
      valueNode.textContent = String(qty);
      sumNode.textContent = money(api.priceOf(product) * qty);
    });
    qs("[data-add]", host).addEventListener("click", function () {
      App.cart.add(product.id, qty);
      App.toast("Добавили в корзину: " + product.title);
      openCart();
    });

    if (relatedHost) {
      var related = data.products
        .filter(function (item) {
          return item.category === product.category && item.id !== product.id && !item.hidden;
        })
        .slice(0, 4);
      if (!related.length) {
        relatedHost.innerHTML = "";
      } else {
        relatedHost.innerHTML =
          '<div class="container">' +
          '<div class="section-head"><h2 class="h-section">С этой полки</h2>' +
          '<a class="link-arrow" href="' + (category ? categoryHref(category) : "shop.html") + '">Вся коллекция</a></div>' +
          '<div class="product-grid">' +
          related.map(function (item) {
            return App.productCard(item, { categoryName: category ? category.name : "" });
          }).join("") +
          "</div></div>";
        App.revealScan(relatedHost);
      }
    }
  }

  function categoryHref(category) {
    return "catalog.html?slug=" + encodeURIComponent(category.slug);
  }

  /* --------------------------------------------------------------- старт */

  function boot() {
    return App.init({ active: "shop", footer: "light" })
      .then(function () {
        return Promise.all([api("/api/catalog"), api("/api/delivery"), api("/api/branches")]);
      })
      .then(function (result) {
        data.products = result[0].products;
        data.categories = result[0].categories;
        data.delivery = result[1];
        data.branches = result[2].branches;

        if (adminMode) return;

        if (pageMode() === "catalog") {
          renderSeoCategory();
          if (window.location.hash === "#cart") openCart();
          document.addEventListener("cart:change", function () {
            if (qs("[data-cart]").open) renderCart();
          });
          wireDialogShell();
          return;
        }
        if (pageMode() === "product") {
          renderSeoProduct();
          if (window.location.hash === "#cart") openCart();
          document.addEventListener("cart:change", function () {
            if (qs("[data-cart]").open) renderCart();
          });
          wireDialogShell();
          return;
        }

        applyUrl();
        buildFilters();
        wireFilters();
        renderGrid();

        // Клик по карточке в магазине открывает диалог, а не уводит на SEO-страницу.
        var gridHost = qs("[data-shop-grid]");
        if (gridHost) {
          gridHost.addEventListener("click", function (event) {
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
            var link = event.target.closest("[data-detail-id]");
            if (!link) return;
            event.preventDefault();
            openDetail(link.dataset.detailId);
          });
        }

        var params = new URLSearchParams(window.location.search);
        if (params.get("p")) {
          var product = data.products.filter(function (item) { return item.slug === params.get("p"); })[0];
          if (product) openDetail(product.id);
        }

        if (window.location.hash === "#cart") openCart();

        document.addEventListener("cart:change", function () {
          if (qs("[data-cart]").open) renderCart();
        });

        wireDialogShell();
      })
      .catch(function (error) {
        App.toast(error.message || "Не удалось загрузить магазин", "error");
      });
  }

  /** Закрытие диалога по клику на подложку + иконка корзины в шапке. */
  function wireDialogShell() {
    qsa("dialog").forEach(function (dialog) {
      dialog.addEventListener("click", function (event) {
        if (event.target === dialog) dialog.close();
      });
    });

    document.addEventListener("click", function (event) {
      var cartLink = event.target.closest('[data-nav="cart"], [data-open-cart]');
      if (!cartLink || pageMode() !== "shop") return;
      event.preventDefault();
      openCart();
    });

    window.addEventListener("hashchange", function () {
      if (window.location.hash === "#cart") openCart();
    });
  }

  boot();
})();
