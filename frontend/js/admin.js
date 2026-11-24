/* ==========================================================================
   admin.js — админка Milagro (Сургут), этап 1, полностью на моках api.js.
   Включается на shop.html#admin: прячет витрину, показывает админку.
   Ключ живёт только в памяти страницы. Всё динамическое экранируется App.esc.
   ========================================================================== */
(function () {
  "use strict"; var root = null, baseTitle = document.title, token = "", data = null, activeTab = "products"; var editingProductId = null, editingCategoryId = null;
  var filters = { q: "", category: "", studio: "", view: "all" };
  var orderView = { day: "all", archive: false }; var siteDraft = null, siteDirty = false, pickerApply = null, pickerReturn = null;
  var fileTarget = null, failedFile = null, failedApply = null; var MAX_INPUT = 9.5 * 1024 * 1024, MAX_SIDE = 2560;
  var HEIC_TEXT = "Формат HEIC обработает сервер на этапе 2; пришлите JPG/PNG/WebP.";
  var BIG_TEXT = "Фото больше 9,5 МБ не примется — пришлите через «Поделиться» в Файлы или сделайте скриншот."; var TABS = [
    { id: "products", label: "Товары" }, { id: "orders", label: "Заказы" }, { id: "categories", label: "Категории" }, { id: "site", label: "Фото главной" }, { id: "search", label: "Поиск" }
  ];
  var STATUS = { succeeded: "Оплачен", pending: "Ожидает оплаты", canceled: "Отменён", mismatch: "Сумма не совпала" };
  /* --------------------------------------------------------------- helpers */
  function qs(selector, scope) { return App.qs(selector, scope); }
  function qsa(selector, scope) { return App.qsa(selector, scope); }
  function esc(value) { return App.esc(value); }
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function money(value) { return App.money(value); }
  function todayIso() { return api.ekbNow().date; }
  function safeUrl(url) { var v = String(url || ""); return /^\/?(assets\/|uploads\/|data:image\/)/.test(v) ? v : ""; }
  function plusDays(iso, days) {
    var p = String(iso).split("-"); var date = new Date(Date.UTC(Number(p[0]), Number(p[1]) - 1, Number(p[2]))); date.setUTCDate(date.getUTCDate() + days);
    return date.toISOString().slice(0, 10);
  }
  function findProduct(id) { return data.products.filter(function (item) { return item.id === id; })[0] || null; }
  function findCategory(id) { return data.categories.filter(function (item) { return item.id === id; })[0] || null; }
  function categoryName(id) { var found = findCategory(id); return found ? found.name : "—"; }
  function branchName(id) {
    var branch = (data.delivery.pickup || []).filter(function (item) { return item.id === id; })[0];
    return branch ? branch.name + " · " + (branch.short || branch.address) : "—";
  }
  function zoneName(id) {
    var zone = (data.delivery.zones || []).concat(data.delivery.surprise_zones || [])
      .filter(function (item) { return item.id === id; })[0]; return zone ? zone.name : "—";
  }
  function errorText(error) {
    var message = error && error.message ? error.message : "Не получилось — попробуйте ещё раз";
    var errors = error && error.payload && error.payload.errors; if (errors) {
      var extra = Object.keys(errors).map(function (key) { return errors[key]; }).filter(Boolean); if (extra.length) message += ": " + extra.join(", ");
    }
    return message;
  }
  function optionsHtml(list, selected) {
    return list.map(function (option) {
      return '<option value="' + esc(option.value) + '"' + (String(option.value) === String(selected) ? " selected" : "") + ">" + esc(option.label) + "</option>";
    }).join("");
  }
  function categoryOptions(selected, allLabel) {
    var list = data.categories.map(function (c) { return { value: c.id, label: c.name }; }); list.unshift({ value: "", label: allLabel || "Выберите категорию" });
    return optionsHtml(list, selected);
  }
  function branchOptions(selected) {
    var list = (data.delivery.pickup || []).map(function (b) { return { value: b.id, label: b.name }; }); list.unshift({ value: "", label: "Все студии" });
    return optionsHtml(list, selected);
  }
  function field(label, control, hint) {
    return '<label class="field"><span class="field__label">' + label + "</span>" + control + (hint ? '<span class="field__hint">' + hint + "</span>" : "") + "</label>";
  }
  function textField(label, attrs, value, placeholder, type) {
    return field(label, '<input class="field__input" type="' + (type || "text") + '" ' + attrs + ' value="' + esc(value) + '" placeholder="' + esc(placeholder) + '"' + (type === "number" ? ' inputmode="numeric"' : "") + ">");
  }
  function areaField(label, attrs, value, placeholder, rows) {
    return field(label, '<textarea class="field__textarea" rows="' + (rows || 3) + '" ' + attrs + ' placeholder="' + esc(placeholder) + '">' + esc(value) + "</textarea>");
  }
  function selectField(label, attrs, options) {
    return field(label, '<select class="field__select" ' + attrs + ">" + options + "</select>");
  }
  function switchBox(attrs, label, checked) {
    return '<label class="switch"><input type="checkbox" ' + attrs + (checked ? " checked" : "") + '><span class="switch__track"></span><span>' + esc(label) + "</span></label>";
  }
  function stat(label, count) { return '<span class="stat">' + label + " · <b>" + count + "</b></span>"; }
  function statusBadge(status) {
    var key = STATUS[status] ? status : "pending"; return '<span class="status status--' + key + '">' + esc(STATUS[key]) + "</span>";
  }
  function rowHtml(key, value) {
    return '<div class="order-card__row"><span class="order-card__key">' + key + "</span><span>" + value + "</span></div>";
  }
  /* ------------------------------------------------ фото: обработка в браузере */
  function readFile(file, mode, done, fail) {
    var reader = new FileReader(); reader.onload = function () { done(reader.result); };
    reader.onerror = function () { fail("Не удалось прочитать файл — попробуйте другой."); };
    if (mode === "buffer") reader.readAsArrayBuffer(file); else reader.readAsDataURL(file);
  }
  function loadImage(url, done, fail) {
    var image = new Image(); image.onload = function () { done(image); };
    image.onerror = function () { fail("Браузер не открыл этот файл. Пришлите JPG, PNG или WebP."); }; image.src = url;
  }
  /** Ориентация JPEG из EXIF (1–8), иначе 1. */
  function exifOrientation(buffer) {
    var view = new DataView(buffer); if (view.byteLength < 4 || view.getUint16(0) !== 0xffd8) return 1; var offset = 2; while (offset + 4 < view.byteLength) {
      var marker = view.getUint16(offset); if ((marker & 0xff00) !== 0xff00) break; if (marker === 0xffe1) {
        var start = offset + 4;
        if (view.getUint32(start) === 0x45786966 && view.getUint16(start + 4) === 0) return tiffOrientation(view, start + 6);
      }
      offset += 2 + view.getUint16(offset + 2);
    }
    return 1;
  }
  function tiffOrientation(view, base) {
    if (base + 8 > view.byteLength) return 1; var little = view.getUint16(base) === 0x4949;
    function get16(pos) { return view.getUint16(pos, little); }
    function get32(pos) { return view.getUint32(pos, little); }
    if (get16(base + 2) !== 42) return 1; var ifd = base + get32(base + 4); if (ifd + 2 > view.byteLength) return 1; var count = get16(ifd);
    for (var i = 0; i < count; i += 1) {
      var entry = ifd + 2 + i * 12; if (entry + 12 > view.byteLength) break; if (get16(entry) === 0x0112) { var value = get16(entry + 8);
      return value >= 1 && value <= 8 ? value : 1; }
    }
    return 1;
  }
  function canvasUrl(image, orientation, type) {
    var width = image.naturalWidth || image.width, height = image.naturalHeight || image.height; var scale = Math.min(1, MAX_SIDE / Math.max(width, height));
    var w = Math.max(1, Math.round(width * scale)), h = Math.max(1, Math.round(height * scale));
    var swapped = orientation >= 5 && orientation <= 8; var canvas = document.createElement("canvas"); canvas.width = swapped ? h : w; canvas.height = swapped ? w : h;
    var ctx = canvas.getContext("2d");
    var t = { 2: [-1, 0, 0, 1, w, 0], 3: [-1, 0, 0, -1, w, h], 4: [1, 0, 0, -1, 0, h], 5: [0, 1, 1, 0, 0, 0], 6: [0, 1, -1, 0, h, 0], 7: [0, -1, -1, 0, h, w], 8: [0, -1, 1, 0, 0, w] }[orientation];
    if (t) ctx.transform(t[0], t[1], t[2], t[3], t[4], t[5]); ctx.drawImage(image, 0, 0, w, h); return canvas.toDataURL(type, 0.92);
  }
  function isHeic(file) { return /^image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name || ""); }
  function uploadStatus(html) {
    var host = qs("[data-upload-status]"); if (!host) return; host.hidden = !html; host.innerHTML = html || "";
  }
  function uploadFail(message) {
    uploadStatus('<div class="admin-error">' + esc(message) + "</div>" + '<div class="admin-actions"><button class="btn btn--outline btn--sm" type="button" data-action="retry-upload">Повторить загрузку</button></div>');
  }
  /** EXIF, 2560 px, JPEG 0.92 при большом/нестандартном файле, затем POST /api/admin/upload. */
  function processImage(file, apply) {
    failedFile = file; failedApply = apply; if (file.size > MAX_INPUT) { uploadFail(BIG_TEXT); return; }
    if (isHeic(file)) { uploadFail(HEIC_TEXT); return; }
    uploadStatus('<p class="admin-hint">Обрабатываю фото: поворот, размер, качество…</p>');
    var isJpeg = /jpe?g/i.test(file.type || "") || /\.jpe?g$/i.test(file.name || ""); readFile(file, "buffer", function (buffer) {
      var orientation = isJpeg ? exifOrientation(buffer) : 1; readFile(file, "data", function (dataUrl) {
        loadImage(dataUrl, function (image) {
          var width = image.naturalWidth || image.width, height = image.naturalHeight || image.height;
          var big = file.size > 2 * 1024 * 1024, known = /^image\/(jpeg|png|webp)$/i.test(file.type || "");
          var needs = orientation !== 1 || width > MAX_SIDE || height > MAX_SIDE || big || !known; var type = big || !known || isJpeg ? "image/jpeg" : file.type;
          var output = needs ? canvasUrl(image, orientation, type) : dataUrl;
          var ext = type === "image/png" ? ".png" : (type === "image/webp" ? ".webp" : ".jpg");
          var name = needs ? String(file.name || "photo").replace(/\.[^.]+$/, "") + ext : (file.name || "photo"); uploadImage(name, output, apply);
        }, uploadFail);
      }, uploadFail);
    }, uploadFail);
  }
  function uploadImage(name, dataUrl, apply) {
    req("/api/admin/upload", { method: "POST", body: { name: name, data_url: dataUrl } }).then(function (response) {
      var upload = response.upload; data.uploads.unshift(upload); apply(safeUrl(upload.url)); uploadStatus(""); App.toast("Фото загружено");
    }).catch(function (error) { uploadFail(errorText(error)); });
  }
  function startUpload(target, index) {
    fileTarget = { target: target, index: index }; var input = qs("[data-file]"); if (!input) return; input.value = ""; input.click();
  }
  function targetApplier(target, index) {
    return function (url) {
      if (target === "product") {
        var hidden = qs('[data-pf="image_url"]'); if (hidden) hidden.value = url; renderProductPreview(url);
      } else if (target === "category") {
        var cover = qs('[data-cf="image_url"]'); if (cover) cover.value = url; renderCategoryPreview(url);
      } else if (target === "offers") {
        if (!siteDraft) return; siteDraft.offers_image_url = url; markSiteDirty(); renderSitePanel();
      } else if ((target === "hero" || target === "hero-mobile") && siteDraft) {
        var slide = siteDraft.hero_slides[index]; if (!slide) return; slide[target === "hero" ? "image_url" : "mobile_image_url"] = url;
        markSiteDirty(); renderSitePanel();
      }
    };
  }
  /* ------------------------------------------------------------------- сеть */
  function req(path, options) { options = options || {}; options.token = token; return api(path, options); }
  function loadAll() {
    var current = token; return Promise.all([
      req("/api/admin/products"), req("/api/admin/categories"), req("/api/admin/orders"), req("/api/admin/site"), req("/api/admin/search-codes"), req("/api/admin/telegram"), req("/api/admin/uploads"), req("/api/delivery")
    ]).then(function (r) {
      if (token !== current) return null;
      data = { products: r[0].products, categories: r[1].categories, orders: r[2].orders, site: r[3], searchCodes: r[4], telegram: r[5], uploads: r[6].uploads, delivery: r[7] }; siteDraft = null; siteDirty = false; editingProductId = null;
      editingCategoryId = null; return data;
    });
  }
  /* ------------------------------------------------------------ вход/каркас */
  function loginHtml() {
    return '<div class="admin__login"><h1 class="admin__login-title">Админка Milagro</h1>' + '<p class="admin__state">Тестовый режим · данные в памяти</p>' +
      '<p class="admin__login-hint">Подойдёт любой непустой ключ. Ключ хранится только в памяти страницы: после перезагрузки его нужно ввести снова.</p>' +
      field("Ключ администратора", '<input class="field__input" type="password" data-login-key autocomplete="off" aria-describedby="login-hint">', "На этапе 2 ключ будет проверять сервер.") +
      '<div data-login-error role="status" aria-live="polite"></div><div class="admin-actions"><button class="btn btn--primary" type="button" data-action="login">Войти</button>' +
        '<a class="btn btn--ghost" href="shop.html">Открыть сайт</a></div>' +
      '<p class="admin__login-hint" id="login-hint">Пустой ключ не подходит. Правки этапа 1 живут в памяти вкладки и исчезают после её закрытия.</p></div>';
  }
  function renderLogin() {
    root.innerHTML = loginHtml(); var input = qs("[data-login-key]", root); if (input) input.focus();
  }
  function loginError(message) {
    var host = qs("[data-login-error]", root); if (host) host.innerHTML = '<div class="admin-error">' + esc(message) + "</div>";
  }
  function doLogin() {
    var input = qs("[data-login-key]", root); var value = input ? input.value.trim() : "";
    if (!value) { loginError("Введите ключ администратора — пустой ключ не подходит."); if (input) input.focus(); return; }
    token = value; var button = qs('[data-action="login"]', root); if (button) { button.disabled = true; button.textContent = "Вхожу…"; }
    loadAll().then(function () { renderShell(); }).catch(function (error) {
      token = ""; loginError(errorText(error)); if (button) { button.disabled = false; button.textContent = "Войти"; }
    });
  }
  function doLogout() {
    token = ""; data = null; siteDraft = null; siteDirty = false; editingProductId = null; editingCategoryId = null; renderLogin();
  }
  function barHtml() {
    return '<div class="admin__bar"><div><h1 class="admin__title">Админка</h1>' + '<p class="admin-hint">Milagro · цветочная студия, Сургут</p></div><div class="admin__bar-right">' +
      '<span class="admin__state">Тестовый режим · данные в памяти</span>' + '<a class="btn btn--outline btn--sm" href="shop.html">Открыть сайт</a>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-action="logout">Выйти</button></div></div>';
  }
  function memoHtml() {
    return '<details class="memo"><summary>Как пользоваться админкой</summary><div class="memo__body">' + "<p><strong>Добавить товар.</strong> Вкладка «Товары» → название, категория, цена и описание → «Загрузить фото» или «Выбрать из загруженных» → «Сохранить товар».</p>" +
      "<p><strong>Скрыть или удалить.</strong> «Показывать в магазине» убирает товар с витрины, но оставляет в админке. «Удалить» стирает навсегда — вернуть нельзя.</p>" +
        "<p><strong>Витрина.</strong> «Готов прямо сейчас» показывает букет в блоке на главной, «В Предложениях» — в подборке магазина.</p>" +
      "<p><strong>Заказы.</strong> После оплаты заказ приходит в Telegram. Обработали — «Оплачено — убрать»: заказ уйдёт в архив, но не удалится. Вернуть — «Вернуть заказ».</p>" +
        "<p><strong>Категории.</strong> Порядок 0 — первая в списке. Удалить можно только пустую категорию: сначала перенесите товары.</p>" +
      "<p><strong>Фото главной.</strong> Слайды баннера и фото плитки «Предложения». После правок нажмите «Сохранить главную».</p>" +
        "<p><strong>Поиск.</strong> Вставьте коды подтверждения целиком из Яндекс Вебмастера и Google Search Console — сервер сам вынет нужное.</p>" +
      "<p><strong>Если что-то не так.</strong> Обновите страницу и войдите заново. На этапе 1 данные в памяти: после закрытия вкладки тестовые правки исчезают.</p></div></details>";
  }
  function tabsHtml() {
    return '<div class="admin__tabs" role="tablist" aria-label="Разделы админки">' + TABS.map(function (tab) {
      return '<button class="admin-tab" type="button" role="tab" id="admin-tab-' + tab.id + '" aria-controls="admin-panel" aria-selected="false" data-tab="' + tab.id + '">' + tab.label +
        "</button>";
    }).join("") + "</div>";
  }
  function renderShell() {
    root.innerHTML = barHtml() + memoHtml() + tabsHtml() + '<div class="admin__panel" id="admin-panel" role="tabpanel" data-panel></div>' +
      '<div class="admin-card" data-upload-status role="status" aria-live="polite" hidden></div><div data-picker hidden></div>' + '<input class="sr-only" type="file" accept="image/*" data-file tabindex="-1">';
    setTab(activeTab);
  }
  function setTab(id) {
    activeTab = id; qsa("[data-tab]", root).forEach(function (button) {
      button.setAttribute("aria-selected", button.getAttribute("data-tab") === id ? "true" : "false");
    }); var panelNode = qs("[data-panel]", root); if (!panelNode) return; panelNode.setAttribute("aria-labelledby", "admin-tab-" + id); uploadStatus(""); closePicker(); renderPanel();
  }
  function renderPanel() {
    if (activeTab === "orders") renderOrdersPanel();
    else if (activeTab === "categories") renderCategoriesPanel();
    else if (activeTab === "site") renderSitePanel();
    else if (activeTab === "search") renderSearchPanel();
    else renderProductsPanel();
  }
  /* ------------------------------------------------------------------ товары */
  function productFormHtml() {
    var branches = (data.delivery.pickup || []).map(function (b) {
      return switchBox('data-pb="' + esc(b.id) + '"', b.name + " · " + (b.short || b.address), true);
    }).join("");
    return '<section class="admin-card" data-product-card><div class="admin-card__head">' + '<h2 class="admin-card__title" data-product-heading>Новый товар</h2><span class="admin-hint" data-product-id></span></div>' +
      '<div class="admin-grid">' + textField("Название", 'data-pf="title"', "", "Например, Букет «Северный шёлк»") + selectField("Категория", 'data-pf="category"', categoryOptions("")) +
        "</div>" + '<div class="admin-grid">' + textField("Цена, ₽", 'data-pf="price"', "", "5900", "number") +
      areaField("Описание", 'data-pf="description"', "", "Состав: роза, эустома, эвкалипт…", 2) + "</div>" + '<fieldset class="admin-fieldset"><legend class="admin-fieldset__legend">Фото</legend><div class="upload-preview" data-product-preview></div>' +
      '<div class="admin-actions"><button class="btn btn--outline btn--sm" type="button" data-action="upload" data-target="product">Загрузить фото</button>' +
        '<button class="btn btn--outline btn--sm" type="button" data-action="pick" data-target="product">Выбрать из загруженных</button></div>' +
      '<p class="admin-hint">JPG, PNG или WebP. Большое фото уменьшим до 2560 px, повернём по EXIF и пережмём в JPEG. HEIC пока не принимаем — его обработает сервер на этапе 2.</p>' +
      '<input type="hidden" data-pf="image_url" value=""></fieldset>' + '<fieldset class="admin-fieldset"><legend class="admin-fieldset__legend">Поиск Яндекс и Google · можно не заполнять</legend>' +
      '<div class="admin-grid">' + textField("Заголовок в поиске", 'data-pf="seo_title"', "", "") + textField("Подпись к фото (alt)", 'data-pf="image_alt"', "", "") + "</div>" +
      areaField("Описание в поиске", 'data-pf="seo_description"', "", "", 2) + '<p class="admin-hint">Пустые поля заполнятся сами: <span data-seo-auto>—</span></p>' +
        '<p class="admin-hint">Адрес страницы товара: <code data-product-url>product.html?slug=…</code></p></fieldset>' +
      '<fieldset class="admin-fieldset"><legend class="admin-fieldset__legend">Показ</legend>' + switchBox('data-pf="visible"', "Показывать в магазине", true) +
        switchBox('data-pf="showcase"', "Готов прямо сейчас", false) + switchBox('data-pf="featured"', "В «Предложениях»", false) + "</fieldset>" +
      '<fieldset class="admin-fieldset"><legend class="admin-fieldset__legend">Наличие и доставка</legend>' + '<div class="admin-grid">' + branches + "</div>" +
        switchBox('data-pf="delivery"', "Можно доставить", true) +
      '<p class="admin-hint">Выключите «Можно доставить» — товар останется только для самовывоза из студий, где он есть.</p></fieldset>' +
      '<fieldset class="admin-fieldset"><legend class="admin-fieldset__legend">Скидка</legend>' + switchBox('data-pf="discount_enabled"', "Включить скидку", false) +
        '<div class="admin-grid">' + selectField("Тип", 'data-pf="discount_type"', optionsHtml([
        { value: "percent", label: "Процент" }, { value: "amount", label: "Фиксированная сумма, ₽" }
      ], "percent")) + textField("Размер", 'data-pf="discount_value"', "", "15", "number") + "</div>" + '<div class="admin-grid">' + textField("Начало", 'data-pf="discount_start"', "", "", "date") + textField("Окончание", 'data-pf="discount_end"', "", "", "date") + "</div>" +
      '<p class="admin-hint">Даты необязательны и считаются включительно. Цена со скидкой и её активность пересчитаются при сохранении.</p></fieldset>' +
        '<div data-product-error role="status" aria-live="polite"></div><div class="admin-actions">' + '<button class="btn btn--primary" type="button" data-action="save-product">Сохранить товар</button>' +
      '<button class="btn btn--outline" type="button" data-action="new-product">Новый товар</button></div></section>';
  }
  function productListCardHtml() {
    return '<section class="admin-card"><div class="admin-card__head"><h2 class="admin-card__title">Товары</h2>' +
      '<span class="admin-hint">Переключатели в строке срабатывают сразу</span></div>' + '<div class="admin-summary" data-products-summary></div><div class="admin-toolbar">' +
      '<input class="field__input admin-toolbar__search" type="search" data-filter="q" placeholder="Поиск по названию" value="' + esc(filters.q) + '">' +
        '<select class="field__select" data-filter="category" aria-label="Категория">' + categoryOptions(filters.category, "Все категории") + "</select>" +
      '<select class="field__select" data-filter="studio" aria-label="Студия">' + branchOptions(filters.studio) + "</select>" +
        '<select class="field__select" data-filter="view" aria-label="Показ">' + optionsHtml([
        { value: "all", label: "Все товары" }, { value: "visible", label: "В магазине" }, { value: "hidden", label: "Скрытые" }
      ], filters.view) + "</select>" + '<button class="btn btn--ghost btn--sm" type="button" data-action="reset-filters">Сбросить фильтры</button></div>' + '<div class="admin-list" data-products-list></div></section>';
  }
  function renderProductsPanel() {
    var panelNode = qs("[data-panel]", root); if (!panelNode) return; panelNode.innerHTML = productFormHtml() + productListCardHtml();
    fillProductForm(editingProductId ? findProduct(editingProductId) : null); renderProductList();
  }
  function pf(name) { var node = qs('[data-pf="' + name + '"]', root); return node ? node.value : ""; }
  function pfChecked(name) { var node = qs('[data-pf="' + name + '"]', root); return node ? node.checked : false; }
  function setPf(name, value) { var node = qs('[data-pf="' + name + '"]', root); if (node) node.value = value === null || value === undefined ? "" : value; }
  function setChecked(name, value) { var node = qs('[data-pf="' + name + '"]', root); if (node) node.checked = Boolean(value); }
  function fillProductForm(product) {
    editingProductId = product ? product.id : null; var heading = qs("[data-product-heading]", root), meta = qs("[data-product-id]", root);
    if (heading) heading.textContent = product ? "Редактирование товара" : "Новый товар";
    if (meta) meta.textContent = product ? product.id + " · " + product.slug : "Заполните поля и сохраните"; var values = {
      title: product ? product.title : "", category: product ? product.category : "", price: product ? product.price : "", description: product ? product.description : "", image_url: product ? safeUrl(product.image_url) : "", image_alt: product ? product.image_alt : "", seo_title: product ? product.seo_title : "",
      seo_description: product ? product.seo_description : "", discount_type: product && product.discount_type ? product.discount_type : "percent",
      discount_value: product && product.discount_value ? product.discount_value : "", discount_start: product ? product.discount_start : "", discount_end: product ? product.discount_end : ""
    }; Object.keys(values).forEach(function (key) { setPf(key, values[key]); }); setChecked("visible", product ? !product.hidden : true);
    setChecked("showcase", product ? product.showcase === true : false);
    setChecked("featured", product ? product.featured === true : false); setChecked("delivery", product ? !product.no_delivery : true);
    setChecked("discount_enabled", product ? product.discount_enabled === true : false);
    qsa("[data-pb]", root).forEach(function (input) {
      input.checked = !product || (product.pickup_branches || []).indexOf(input.getAttribute("data-pb")) >= 0;
    }); renderProductPreview(product ? safeUrl(product.image_url) : ""); updateAutoSeo(); var errorHost = qs("[data-product-error]", root); if (errorHost) errorHost.innerHTML = "";
  }
  function renderProductPreview(url) {
    var host = qs("[data-product-preview]", root); if (!host) return; var safe = safeUrl(url);
    host.innerHTML = safe ? '<img src="' + esc(safe) + '" alt="Превью товара"><span class="admin-hint">Фото выбрано</span>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-action="remove-product-image">Убрать фото</button>'
      : '<span class="admin-hint">Фото не выбрано — подставим иллюстрацию категории.</span>';
  }
  function updateAutoSeo() {
    var title = pf("title").trim(); var product = editingProductId ? findProduct(editingProductId) : null; var slug = product ? product.slug : api.slugify(title);
    var autoTitle = (title || "Название") + " — купить в Сургуте | Milagro";
    var titleNode = qs('[data-pf="seo_title"]', root), descriptionNode = qs('[data-pf="seo_description"]', root); var altNode = qs('[data-pf="image_alt"]', root);
    if (titleNode) titleNode.placeholder = autoTitle;
    if (descriptionNode) descriptionNode.placeholder = (title || "Товар") + ": состав, размер и цена. Цветочная студия Milagro, Сургут.";
    if (altNode) altNode.placeholder = title || "Фото товара"; var auto = qs("[data-seo-auto]", root);
    if (auto) auto.textContent = autoTitle; var url = qs("[data-product-url]", root); if (url) url.textContent = "product.html?slug=" + (slug || "slug");
  }
  function discountFor(product) {
    var value = Number(product.discount_value) || 0, enabled = product.discount_enabled && value > 0; var sale = null, active = false, label = null; if (enabled) {
      sale = product.discount_type === "amount" ? Math.round(product.price - value) : Math.round(product.price * (100 - Math.min(100, value)) / 100);
      if (sale < 0) sale = 0; if (sale < product.price) {
        var today = todayIso();
        active = (!product.discount_start || today >= product.discount_start) && (!product.discount_end || today <= product.discount_end);
        if (active) label = product.discount_type === "amount" ? "−" + value + " ₽" : "−" + value + "%";
      }
    }
    return { sale_price: sale, discount_active: active, discount_label: label };
  }
  function showProductError(message) {
    var host = qs("[data-product-error]", root); if (host) host.innerHTML = '<div class="admin-error">' + esc(message) + "</div>";
  }
  function readProductForm() {
    var product = {
      title: pf("title").trim(), category: pf("category"), price: Math.round(Number(pf("price")) || 0), description: pf("description").trim(), image_url: safeUrl(pf("image_url")) || "assets/photos/cat-bouquets.svg",
      image_alt: pf("image_alt").trim(), seo_title: pf("seo_title").trim(), seo_description: pf("seo_description").trim(), hidden: !pfChecked("visible"), showcase: pfChecked("showcase"), featured: pfChecked("featured"), no_delivery: !pfChecked("delivery"),
      pickup_branches: qsa("[data-pb]", root).filter(function (input) { return input.checked; }).map(function (input) { return input.getAttribute("data-pb"); }),
      discount_enabled: pfChecked("discount_enabled"), discount_type: pf("discount_type") || "percent", discount_value: Math.round(Number(pf("discount_value")) || 0), discount_start: pf("discount_start") || null, discount_end: pf("discount_end") || null
    }; if (!product.title) { showProductError("Укажите название товара."); return null; }
    if (!product.category) { showProductError("Выберите категорию товара."); return null; }
    if (!product.price) { showProductError("Укажите цену больше нуля."); return null; }
    if (!product.pickup_branches.length) { showProductError("Выберите хотя бы одну студию, где товар есть."); return null; }
    return product;
  }
  function saveProduct() {
    var product = readProductForm(); if (!product) return; var base = editingProductId ? findProduct(editingProductId) : null; var discount = discountFor(product);
    product.sale_price = discount.sale_price;
    product.discount_active = discount.discount_active; product.discount_label = discount.discount_label; product.price_prefix = base ? base.price_prefix || null : null;
    product.image_thumb_url = product.image_url;
    product.size = base ? base.size || "" : ""; product.flower_types = base ? base.flower_types || [] : []; product.is_new = base ? base.is_new === true : false;
    product.badge = base ? base.badge || null : null; var isNew = !editingProductId;
    var path = isNew ? "/api/admin/products" : "/api/admin/products/" + encodeURIComponent(editingProductId);
    req(path, { method: isNew ? "POST" : "PUT", body: { product: product } }).then(function (response) {
      var saved = response.product; if (isNew) data.products.unshift(saved);
      else data.products = data.products.map(function (item) { return item.id === saved.id ? saved : item; }); fillProductForm(saved); renderProductList();
      App.toast(isNew ? "Товар создан" : "Товар сохранён");
    }).catch(function (error) { showProductError(errorText(error)); });
  }
  function renderProductList() {
    var summary = qs("[data-products-summary]", root); if (!summary) return; var total = data.products.length;
    var hidden = data.products.filter(function (p) { return p.hidden; }).length;
    var ready = data.products.filter(function (p) { return p.showcase; }).length; var pickupOnly = data.products.filter(function (p) { return p.no_delivery; }).length;
    summary.innerHTML = stat("Всего", total) + stat("В магазине", total - hidden) + stat("Скрытых", hidden) + stat("Готовы сейчас", ready) +
      stat("Только самовывоз", pickupOnly); var list = data.products.filter(function (product) {
      if (filters.q && String(product.title).toLowerCase().indexOf(filters.q.toLowerCase()) < 0) return false;
      if (filters.category && product.category !== filters.category) return false;
      if (filters.studio && (product.pickup_branches || []).indexOf(filters.studio) < 0) return false; if (filters.view === "visible" && product.hidden) return false;
      if (filters.view === "hidden" && !product.hidden) return false; return true;
    }); var host = qs("[data-products-list]", root); if (!host) return; host.innerHTML = list.length ? list.map(function (product) {
      return '<div class="admin-row"><div class="admin-row__media"><img src="' + esc(safeUrl(product.image_url)) + '" alt="' + esc(product.title) +
        '" loading="lazy"></div><div><div class="admin-row__title">' + esc(product.title) +
        '</div><div class="admin-row__meta">' + esc(categoryName(product.category)) + " · " + money(api.priceOf(product)) + (product.hidden ? " · скрыт" : "") +
          '</div><div class="admin-row__flags">' + switchBox('data-flag="shop" data-id="' + esc(product.id) + '"', "В магазине", !product.hidden) +
        switchBox('data-flag="ready" data-id="' + esc(product.id) + '"', "Готов сейчас", product.showcase === true) +
          '</div></div><div class="admin-row__actions"><button class="btn btn--outline btn--sm" type="button" data-action="edit-product" data-id="' +
        esc(product.id) + '">Изменить</button><button class="btn btn--ghost btn--sm" type="button" data-action="delete-product" data-id="' + esc(product.id) +
          '">Удалить</button></div></div>';
    }).join("") : '<p class="admin-empty">По этим фильтрам товаров нет. Сбросьте фильтры или добавьте товар.</p>';
  }
  function toggleProductFlag(input) {
    var id = input.getAttribute("data-id"), flag = input.getAttribute("data-flag"), body = {}; if (flag === "shop") body.hidden = !input.checked;
    else body.showcase = input.checked;
    req("/api/admin/products/" + encodeURIComponent(id) + "/flags", { method: "PATCH", body: body }).then(function (response) {
      data.products = data.products.map(function (item) { return item.id === response.product.id ? response.product : item; }); renderProductList();
      App.toast(flag === "shop" ? (input.checked ? "Товар показан в магазине" : "Товар скрыт из магазина")
        : (input.checked ? "Отмечен «Готов прямо сейчас»" : "Снята отметка «Готов сейчас»"));
    }).catch(function (error) { input.checked = !input.checked; App.toast(errorText(error), "error"); });
  }
  function deleteProduct(id) {
    var product = findProduct(id); if (!product) return; if (!window.confirm("Удалить товар «" + product.title + "» навсегда? Вернуть его будет нельзя.")) return;
    req("/api/admin/products/" + encodeURIComponent(id), { method: "DELETE" }).then(function () {
      data.products = data.products.filter(function (item) { return item.id !== id; }); if (editingProductId === id) fillProductForm(null);
      renderProductList(); App.toast("Товар удалён");
    }).catch(function (error) { App.toast(errorText(error), "error"); });
  }
  /* ------------------------------------------------------------------ заказы */
  function renderOrdersPanel() {
    var panelNode = qs("[data-panel]", root); if (!panelNode) return; var today = todayIso(), tomorrow = plusDays(today, 1);
    var active = data.orders.filter(function (order) { return !order.archived; }); var counts = {
      all: active.length, today: active.filter(function (o) { return o.delivery_date === today; }).length, tomorrow: active.filter(function (o) { return o.delivery_date === tomorrow; }).length
    };
    var buttons = [{ id: "all", label: "Все" }, { id: "today", label: "Сегодня" }, { id: "tomorrow", label: "Завтра" }].map(function (item) {
      return '<button class="btn ' + (orderView.day === item.id ? "btn--primary" : "btn--outline") + ' btn--sm" type="button" data-action="order-day" data-day="' + item.id +
        '" aria-pressed="' + (orderView.day === item.id ? "true" : "false") + '">' + item.label + " · " + counts[item.id] + "</button>";
    }).join("");
    panelNode.innerHTML = '<section class="admin-card"><div class="admin-card__head"><h2 class="admin-card__title">Заказы</h2>' +
      '<span class="admin-hint">Даты и слоты — по времени Екатеринбурга (UTC+5)</span></div><div class="admin-toolbar">' + buttons +
      '<button class="btn btn--outline btn--sm" type="button" data-action="refresh-orders">Обновить</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-action="toggle-archive">' +
      (orderView.archive ? "Показать активные" : "Показать убранные") + '</button></div><div class="admin-list" data-orders-list></div></section>' + telegramHtml(); renderOrdersList();
  }
  function renderOrdersList() {
    var host = qs("[data-orders-list]", root); if (!host) return; var today = todayIso(), tomorrow = plusDays(today, 1);
    var orders = data.orders.filter(function (order) {
      if (Boolean(order.archived) !== orderView.archive) return false; if (orderView.day === "today") return order.delivery_date === today;
      if (orderView.day === "tomorrow") return order.delivery_date === tomorrow; return true;
    }); orders.sort(function (a, b) {
      var dateA = a.delivery_date || "", dateB = b.delivery_date || ""; if (dateA !== dateB) return dateA < dateB ? -1 : 1;
      var slotA = String(a.delivery_slot || ""), slotB = String(b.delivery_slot || "");
      return slotA === slotB ? 0 : (slotA < slotB ? -1 : 1);
    });
    host.innerHTML = orders.length ? orders.map(orderCardHtml).join("") : '<p class="admin-empty">' + (orderView.archive ? "В архиве пусто. Убранные заказы появятся здесь." : "На этот день заказов нет. «Обновить» — перечитать список.") + "</p>";
  }
  function orderCardHtml(order) {
    var methodRows = []; if (order.delivery_method === "delivery") {
      methodRows.push(rowHtml("Способ", "Доставка · " + esc(zoneName(order.delivery_zone)))); methodRows.push(rowHtml("Адрес", esc(order.address || "—")));
      methodRows.push(rowHtml("Получатель", order.same_recipient ? "сам заказчик" : esc(order.recipient_phone || "—")));
    } else if (order.delivery_method === "surprise") {
      methodRows.push(rowHtml("Способ", "Сюрприз · " + esc(zoneName(order.delivery_zone))));
      methodRows.push(rowHtml("Позвонить получателю", '<a href="tel:' + esc(order.recipient_phone || "") + '">' + esc(order.recipient_phone || "—") + "</a>"));
      methodRows.push(rowHtml("Адрес", esc(order.address || "уточним у получателя, адрес не указан")));
    } else {
      methodRows.push(rowHtml("Способ", "Самовывоз · " + esc(branchName(order.pickup_branch))));
    }
    var consents = order.consents || {};
    var consentText = "Согласие на обработку ПДн: " + (consents.data_consent ? "да, " + esc(App.fmtDateTime(consents.data_consent_at)) : "нет") +
      " · Оферта: " + (consents.offer_accepted ? "принята, " + esc(App.fmtDateTime(consents.offer_accepted_at)) : "нет") + " · Версия документов: " +
        esc(consents.consent_version || "draft"); var archiveButton = order.archived
      ? '<button class="btn btn--outline btn--sm" type="button" data-action="restore-order" data-id="' + esc(order.id) + '">Вернуть заказ</button>'
      : '<button class="btn btn--primary btn--sm" type="button" data-action="archive-order" data-id="' + esc(order.id) + '">' +
        (order.payment_status === "succeeded" ? "Оплачено — убрать" : "Убрать в архив") + "</button>";
    return '<article class="order-card"><div class="order-card__head"><div><span class="order-card__id">№ ' + esc(order.number || order.id) + '</span> <span class="admin-hint">создан ' +
      esc(App.fmtDateTime(order.created_at)) + '</span></div><div class="admin-actions">' +
      statusBadge(order.payment_status) + archiveButton + "</div></div>" + '<div class="order-card__grid">' + rowHtml("Имя", esc(order.customer.name)) +
        rowHtml("Телефон", '<a href="tel:' + esc(order.customer.phone) + '">' + esc(order.customer.phone) + "</a>") +
      rowHtml("Email", order.customer.email ? '<a href="mailto:' + esc(order.customer.email) + '">' + esc(order.customer.email) + "</a>" : "—") + methodRows.join("") +
        rowHtml("Дата и слот", esc(App.fmtDate(order.delivery_date)) + ", " + esc(order.delivery_slot || "время не выбрано")) +
      rowHtml("Пожелания", order.comment ? esc(order.comment) : "—") + "</div>" + '<div class="order-card__items">' + (order.items || []).map(function (item) {
        var image = safeUrl(item.image_url);
        return '<div class="order-card__item">' + (image ? '<img src="' + esc(image) + '" alt="' + esc(item.image_alt) + '" loading="lazy">' : "<span></span>") +
          "<span>" + esc(item.title) + " × " + (Number(item.quantity) || 1) + "</span><span>" + money((Number(item.price) || 0) * (Number(item.quantity) || 1)) + "</span></div>";
      }).join("") + "</div>" + '<div class="order-card__grid">' + rowHtml("Товары", money(order.goods_total)) + rowHtml("Доставка", typeof order.delivery_price === "number" ? money(order.delivery_price) : "уточняется") +
      '<div class="order-card__row"><span class="order-card__key">Итого</span><b>' + money(order.total) + "</b></div></div>" + '<p class="admin-hint">' + consentText + "</p></article>";
  }
  function telegramHtml() {
    var telegram = data.telegram || { ids: [], updated_at: null };
    return '<section class="admin-card"><div class="admin-card__head"><h2 class="admin-card__title">Уведомления в Telegram</h2>' + '<span class="admin-hint" data-tg-saved>' +
      (telegram.updated_at ? "Сохранено " + esc(App.fmtDateTime(telegram.updated_at)) : "Получатели ещё не сохранены") +
      '</span></div><p class="admin-hint">Бот присылает каждый оплаченный заказ с фото букетов. Человек должен один раз открыть бота и нажать «Запустить» — иначе Telegram не даст боту написать ему первым.</p>' +
      field("Telegram ID получателей", '<input class="field__input" data-tg-ids value="' + esc((telegram.ids || []).join(", ")) + '" placeholder="123456789, 987654321" autocomplete="off">', "Через запятую, только цифры, не больше 10. Свой ID можно узнать у @userinfobot.") +
      '<div class="admin-actions"><button class="btn btn--primary btn--sm" type="button" data-action="save-telegram">Сохранить получателей</button>' +
        '<button class="btn btn--outline btn--sm" type="button" data-action="test-telegram">Отправить тест</button></div><div data-tg-result role="status" aria-live="polite"></div></section>';
  }
  function tgResult(html) { var host = qs("[data-tg-result]", root); if (host) host.innerHTML = html; }
  function parseTelegramIds() {
    var input = qs("[data-tg-ids]", root); var tokens = (input ? input.value : "").split(/[,\s;]+/).filter(function (token) { return token; });
    if (tokens.filter(function (token) { return !/^\d+$/.test(token); }).length) {
      tgResult('<div class="admin-error">Telegram ID — только цифры, без @ и букв.</div>'); return null;
    }
    if (tokens.length > 10) { tgResult('<div class="admin-error">Можно сохранить не больше 10 получателей.</div>'); return null; }
    return tokens;
  }
  function saveTelegram() {
    var ids = parseTelegramIds(); if (ids === null) return; req("/api/admin/telegram", { method: "PUT", body: { ids: ids } }).then(function (response) {
      data.telegram = response.telegram; var saved = qs("[data-tg-saved]", root); if (saved) saved.textContent = "Сохранено " + App.fmtDateTime(data.telegram.updated_at);
      tgResult('<p class="admin-hint">Получателей сохранено: ' + ids.length + ".</p>"); App.toast("Получатели сохранены");
    }).catch(function (error) { tgResult('<div class="admin-error">' + esc(errorText(error)) + "</div>"); });
  }
  function testTelegram() {
    req("/api/admin/telegram/test", { method: "POST", body: {} }).then(function (response) {
      tgResult((response.results || []).map(function (item) {
        return '<p class="admin-hint">' + (item.ok ? "✓" : "✕") + " ID " + esc(item.id) + " — " + esc(item.message) + "</p>";
      }).join("") || '<p class="admin-hint">Тест прошёл, но список получателей пуст.</p>'); App.toast("Тест отправлен");
    }).catch(function (error) { tgResult('<div class="admin-error">' + esc(errorText(error)) + "</div>"); });
  }
  function setOrderArchived(id, archived) {
    req("/api/admin/orders/" + encodeURIComponent(id), { method: "PATCH", body: { archived: archived } }).then(function (response) {
      data.orders = data.orders.map(function (order) { return order.id === response.order.id ? response.order : order; }); renderOrdersPanel();
      App.toast(archived ? "Заказ убран в архив" : "Заказ возвращён");
    }).catch(function (error) { App.toast(errorText(error), "error"); });
  }
  function refreshOrders() {
    req("/api/admin/orders").then(function (response) {
      data.orders = response.orders; renderOrdersPanel(); App.toast("Список заказов обновлён");
    }).catch(function (error) { App.toast(errorText(error), "error"); });
  }
  /* --------------------------------------------------------------- категории */
  function categoryFormHtml() {
    return '<section class="admin-card" data-category-card><div class="admin-card__head"><h2 class="admin-card__title" data-category-heading>Новая категория</h2>' +
      '<span class="admin-hint" data-category-id></span></div><div class="admin-grid">' +
      textField("Название", 'data-cf="name"', "", "Например, Букеты") + textField("Порядок", 'data-cf="position"', "", "0 — первая", "number") + "</div>" +
        areaField("Описание", 'data-cf="description"', "", "Короткое описание для карточки категории", 2) +
      '<fieldset class="admin-fieldset"><legend class="admin-fieldset__legend">Обложка</legend><div class="upload-preview" data-category-preview></div>' +
        '<div class="admin-actions"><button class="btn btn--outline btn--sm" type="button" data-action="upload" data-target="category">Загрузить обложку</button>' +
      '<button class="btn btn--outline btn--sm" type="button" data-action="pick" data-target="category">Выбрать из загруженных</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-action="remove-cover">Убрать обложку</button></div>' +
      '<p class="admin-hint">Без обложки показывается иллюстрация.</p><input type="hidden" data-cf="image_url" value=""></fieldset>' +
        '<fieldset class="admin-fieldset"><legend class="admin-fieldset__legend">Поиск Яндекс и Google · можно не заполнять</legend>' +
      textField("Заголовок на странице (H1)", 'data-cf="seo_h1"', "", "") + textField("Заголовок в поиске", 'data-cf="seo_title"', "", "") +
        areaField("Описание в поиске", 'data-cf="seo_description"', "", "", 2) + areaField("Текст о коллекции", 'data-cf="seo_text"', "", "Пустая строка = новый абзац", 5) +
      textField("Подпись к обложке (alt)", 'data-cf="image_alt"', "", "") + "</fieldset>" + '<div data-category-error role="status" aria-live="polite"></div><div class="admin-actions">' +
        '<button class="btn btn--primary" type="button" data-action="save-category">Сохранить категорию</button>' +
      '<button class="btn btn--outline" type="button" data-action="new-category">Новая категория</button></div></section>';
  }
  function renderCategoriesPanel() {
    var panelNode = qs("[data-panel]", root); if (!panelNode) return;
    var list = data.categories.slice().sort(function (a, b) { return (Number(a.position) || 0) - (Number(b.position) || 0); });
    panelNode.innerHTML = categoryFormHtml() + '<section class="admin-card"><div class="admin-card__head"><h2 class="admin-card__title">Категории</h2>' +
      '<span class="admin-hint">Удалить можно только пустую категорию</span></div><div class="admin-list">' + (list.length ? list.map(function (category) {
        var used = data.products.filter(function (p) { return p.category === category.id; }).length;
        var image = safeUrl(category.image_url) || "assets/photos/cat-bouquets.svg";
        return '<div class="admin-row"><div class="admin-row__media"><img src="' + esc(image) + '" alt="' + esc(category.image_alt || category.name) +
          '" loading="lazy"></div><div><div class="admin-row__title">' + esc(category.name) + '</div><div class="admin-row__meta">Порядок ' +
          (Number(category.position) || 0) + " · " + used + " " + App.plural(used, "товар", "товара", "товаров") + " · " + esc(category.slug || "") +
            '</div></div><div class="admin-row__actions"><button class="btn btn--outline btn--sm" type="button" data-action="edit-category" data-id="' +
          esc(category.id) + '">Изменить</button><button class="btn btn--ghost btn--sm" type="button" data-action="delete-category" data-id="' + esc(category.id) +
            '">Удалить</button></div></div>';
      }).join("") : '<p class="admin-empty">Категорий пока нет — создайте первую.</p>') + "</div></section>"; fillCategoryForm(editingCategoryId ? findCategory(editingCategoryId) : null);
  }
  function cf(name) { var node = qs('[data-cf="' + name + '"]', root); return node ? node.value : ""; }
  function fillCategoryForm(category) {
    editingCategoryId = category ? category.id : null; var heading = qs("[data-category-heading]", root), meta = qs("[data-category-id]", root);
    if (heading) heading.textContent = category ? "Редактирование категории" : "Новая категория";
    if (meta) meta.textContent = category ? category.id : "Заполните поля и сохраните"; var values = {
      name: category ? category.name : "", position: category ? category.position : data.categories.length + 1, description: category ? category.description : "", image_url: category ? safeUrl(category.image_url) : "", seo_h1: category ? category.seo_h1 : "", seo_title: category ? category.seo_title : "",
      seo_description: category ? category.seo_description : "", seo_text: category ? category.seo_text : "", image_alt: category ? category.image_alt : ""
    }; Object.keys(values).forEach(function (key) {
      var node = qs('[data-cf="' + key + '"]', root); if (node) node.value = values[key] === null || values[key] === undefined ? "" : values[key];
    }); renderCategoryPreview(values.image_url); var errorHost = qs("[data-category-error]", root); if (errorHost) errorHost.innerHTML = "";
  }
  function renderCategoryPreview(url) {
    var host = qs("[data-category-preview]", root); if (!host) return; var safe = safeUrl(url);
    host.innerHTML = '<img src="' + esc(safe || "assets/photos/cat-bouquets.svg") + '" alt="Обложка категории"><span class="admin-hint">' +
      (safe ? "Обложка выбрана" : "Без обложки — показывается иллюстрация") + "</span>";
  }
  function showCategoryError(message) {
    var host = qs("[data-category-error]", root); if (host) host.innerHTML = '<div class="admin-error">' + esc(message) + "</div>";
  }
  function saveCategory() {
    var category = {
      name: cf("name").trim(), position: Math.round(Number(cf("position")) || 0), description: cf("description").trim(), image_url: cf("image_url"), seo_h1: cf("seo_h1").trim(), seo_title: cf("seo_title").trim(),
      seo_description: cf("seo_description").trim(), seo_text: cf("seo_text").trim(), image_alt: cf("image_alt").trim()
    }; if (!category.name) { showCategoryError("Укажите название категории."); return; }
    var isNew = !editingCategoryId; var path = isNew ? "/api/admin/categories" : "/api/admin/categories/" + encodeURIComponent(editingCategoryId);
    req(path, { method: isNew ? "POST" : "PUT", body: { category: category } }).then(function (response) {
      var saved = response.category;
      // мок не сохраняет position 0 при создании — досылаем отдельным PUT
      if (isNew && Number(saved.position) !== category.position) {
        return req("/api/admin/categories/" + encodeURIComponent(saved.id), { method: "PUT", body: { category: { position: category.position } } })
          .then(function (fixed) { return fixed.category; });
      }
      return saved;
    }).then(function (saved) {
      if (isNew) data.categories.push(saved);
      else data.categories = data.categories.map(function (item) { return item.id === saved.id ? saved : item; }); editingCategoryId = saved.id; renderCategoriesPanel();
      App.toast(isNew ? "Категория создана" : "Категория сохранена");
    }).catch(function (error) { showCategoryError(errorText(error)); });
  }
  function deleteCategory(id) {
    var category = findCategory(id); if (!category) return;
    if (!window.confirm("Удалить категорию «" + category.name + "»? Это возможно только если в ней нет товаров.")) return;
    req("/api/admin/categories/" + encodeURIComponent(id), { method: "DELETE" }).then(function () {
      data.categories = data.categories.filter(function (item) { return item.id !== id; }); if (editingCategoryId === id) editingCategoryId = null;
      renderCategoriesPanel(); App.toast("Категория удалена");
    }).catch(function (error) {
      showCategoryError(error.status === 409 ? "В категории есть товары — сначала перенесите их в другую категорию." : errorText(error));
    });
  }
  /* ------------------------------------------------------------ фото главной */
  function slideHtml(slide, index, total) {
    var image = safeUrl(slide.image_url), mobile = safeUrl(slide.mobile_image_url);
    return '<fieldset class="admin-fieldset"><legend class="admin-fieldset__legend">Слайд ' + (index + 1) + '</legend><div class="upload-preview">' +
      (image ? '<img src="' + esc(image) + '" alt="' + esc(slide.alt) + '">' : '<span class="admin-hint">Фото не выбрано</span>') +
      '<div class="admin-actions"><button class="btn btn--outline btn--sm" type="button" data-action="upload" data-target="hero" data-index="' + index + '">Загрузить фото</button>' +
      '<button class="btn btn--outline btn--sm" type="button" data-action="pick" data-target="hero" data-index="' + index + '">Выбрать из загруженных</button></div></div>' +
      '<div class="upload-preview">' + (mobile ? '<img src="' + esc(mobile) + '" alt="' + esc(slide.alt) + '">' : '<span class="admin-hint">Нет фото для телефона</span>') +
      '<div class="admin-actions"><button class="btn btn--outline btn--sm" type="button" data-action="upload" data-target="hero-mobile" data-index="' + index +
        '">Фото для телефона</button>' +
      '<button class="btn btn--outline btn--sm" type="button" data-action="pick" data-target="hero-mobile" data-index="' + index + '">Выбрать из загруженных</button></div></div>' +
      field("Подпись к фото (alt)", '<input class="field__input" data-slide="' + index + '" data-slide-field="alt" value="' + esc(slide.alt) + '" placeholder="Что на фото">') +
      '<div class="admin-actions"><button class="btn btn--ghost btn--sm" type="button" data-action="slide-up" data-index="' + index + '"' + (index === 0 ? " disabled" : "") +
      '>Вверх</button><button class="btn btn--ghost btn--sm" type="button" data-action="slide-down" data-index="' + index + '"' + (index === total - 1 ? " disabled" : "") +
      '>Вниз</button><button class="btn btn--ghost btn--sm" type="button" data-action="slide-remove" data-index="' + index + '">Удалить слайд</button></div></fieldset>';
  }
  function renderSitePanel() {
    if (!siteDraft) { siteDraft = clone(data.site); siteDirty = false; }
    var panelNode = qs("[data-panel]", root); if (!panelNode) return; if (!Array.isArray(siteDraft.hero_slides)) siteDraft.hero_slides = [];
    var slides = siteDraft.hero_slides, offers = safeUrl(siteDraft.offers_image_url);
    panelNode.innerHTML = '<section class="admin-card"><div class="admin-card__head"><h2 class="admin-card__title">Фото главной</h2>' + '<span class="admin__state" data-site-dirty' +
      (siteDirty ? "" : " hidden") + '>Есть несохранённые правки</span></div>' +
      '<p class="admin-hint">Слайды показываются по порядку. Для телефона можно загрузить отдельный кадр — если его нет, покажется основное фото.</p>' + '<div class="admin-list">' +
        slides.map(function (slide, index) { return slideHtml(slide, index, slides.length); }).join("") + "</div>" +
      '<div class="admin-actions"><button class="btn btn--outline btn--sm" type="button" data-action="add-slide">Добавить слайд</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-action="reset-site">Вернуть стандартные</button></div></section>' +
      '<section class="admin-card"><div class="admin-card__head"><h2 class="admin-card__title">Плитка «Предложения»</h2>' +
        '<span class="admin-hint">Фото в блоке коллекций на главной</span></div><div class="upload-preview">' +
      (offers ? '<img src="' + esc(offers) + '" alt="Фото плитки «Предложения»">' : '<span class="admin-hint">Фото не выбрано</span>') +
        '<div class="admin-actions"><button class="btn btn--outline btn--sm" type="button" data-action="upload" data-target="offers">Загрузить фото</button>' +
      '<button class="btn btn--outline btn--sm" type="button" data-action="pick" data-target="offers">Выбрать из загруженных</button>' +
        '<button class="btn btn--ghost btn--sm" type="button" data-action="remove-offers">Убрать фото</button></div></div></section>' +
      '<section class="admin-card"><div class="admin-actions"><button class="btn btn--primary" type="button" data-action="save-site">Сохранить главную</button>' +
        '<span class="admin-hint">Без сохранения правки останутся только в этой вкладке.</span></div></section>';
  }
  function markSiteDirty() {
    siteDirty = true; var marker = qs("[data-site-dirty]", root); if (marker) marker.hidden = false;
  }
  function saveSite() {
    if (!siteDraft) return; req("/api/admin/site", { method: "PUT", body: { site: siteDraft } }).then(function (response) {
      data.site = response.site; siteDraft = clone(data.site); siteDirty = false; renderSitePanel(); App.toast("Главная сохранена");
    }).catch(function (error) { App.toast(errorText(error), "error"); });
  }
  function resetSite() {
    if (!window.confirm("Вернуть стандартные фото главной? Ваши фото в слайдах заменятся.")) return;
    req("/api/admin/site/reset", { method: "POST", body: {} }).then(function (response) {
      data.site = response.site; siteDraft = clone(data.site); siteDirty = false; renderSitePanel(); App.toast("Стандартные фото возвращены");
    }).catch(function (error) { App.toast(errorText(error), "error"); });
  }
  /* ------------------------------------------------------------------- поиск */
  function renderSearchPanel() {
    var panelNode = qs("[data-panel]", root); if (!panelNode) return; var codes = data.searchCodes || { yandex: "", google: "", updated_at: null };
    panelNode.innerHTML = '<section class="admin-card"><div class="admin-card__head"><h2 class="admin-card__title">Поиск</h2><span class="admin-hint">' +
      (codes.updated_at ? "Сохранено " + esc(App.fmtDateTime(codes.updated_at)) : "Коды ещё не сохранены") + "</span></div>" +
      areaField("Код Яндекс Вебмастера", 'data-search="yandex"', codes.yandex, "Вставьте строку подтверждения целиком: <meta name=\"yandex-verification\" content=\"…\">", 3) +
      areaField("Код Google Search Console", 'data-search="google"', codes.google, "Вставьте метатег или имя HTML-файла целиком — сервер сам вынет код", 3) +
        '<p class="admin-hint">Копируйте строку подтверждения как есть. Сервер на этапе 2 сам найдёт код в метатеге или имени файла.</p>' +
      '<div class="admin-actions"><button class="btn btn--primary" type="button" data-action="save-codes">Сохранить коды</button></div><div data-search-result role="status" aria-live="polite"></div></section>' +
        '<section class="admin-card"><div class="admin-card__head"><h2 class="admin-card__title">Карта сайта</h2></div>' +
      '<p class="admin-hint">Адрес карты сайта: <code>sitemap.xml</code> в корне сайта — открывается как <code>https://ваш-домен.ru/sitemap.xml</code>.</p><ol class="admin-steps">' +
      '<li>Откройте <a href="https://webmaster.yandex.ru/" target="_blank" rel="noopener">Яндекс Вебмастер</a>, добавьте сайт и скопируйте строку подтверждения.</li>' +
      "<li>Вставьте её в поле «Код Яндекс Вебмастера» выше и нажмите «Сохранить коды».</li>" + "<li>В Яндекс Вебмастере нажмите «Проверить» — подтверждение появится на странице сайта.</li>" +
        "<li>Добавьте карту сайта <code>sitemap.xml</code> в разделе «Индексирование → Файлы Sitemap».</li>" +
      '<li>Повторите то же для <a href="https://search.google.com/search-console" target="_blank" rel="noopener">Google Search Console</a>: добавьте сайт и скопируйте метатег или имя HTML-файла.</li>' + "<li>Вставьте строку в поле «Код Google Search Console», сохраните и нажмите «Подтвердить» в Search Console.</li>" +
      "<li>Отправьте <code>sitemap.xml</code> в Google: раздел «Файлы Sitemap».</li>" + "<li>Через день-два проверьте, что страницы появились в поиске. Если нет — напишите разработчику.</li></ol></section>";
  }
  function saveCodes() {
    var yandex = qs('[data-search="yandex"]', root), google = qs('[data-search="google"]', root);
    req("/api/admin/search-codes", { method: "PUT", body: { yandex: yandex ? yandex.value : "", google: google ? google.value : "" } })
      .then(function (response) {
        data.searchCodes = response.searchCodes; var host = qs("[data-search-result]", root);
        if (host) host.innerHTML = '<p class="admin-hint">Коды сохранены. Проверка появится на сайте после перезагрузки страницы.</p>'; App.toast("Коды сохранены");
      }).catch(function (error) {
        var host = qs("[data-search-result]", root); if (host) host.innerHTML = '<div class="admin-error">' + esc(errorText(error)) + "</div>";
      });
  }
  /* ---------------------------------------------------------------- медиатека */
  function openPicker(apply) {
    pickerApply = apply; pickerReturn = document.activeElement; renderPicker(); var host = qs("[data-picker]", root); if (host) {
      host.hidden = false; if (host.scrollIntoView) host.scrollIntoView({ block: "nearest" });
      var first = qs("[data-action='pick-media']", host); if (first) first.focus();
    }
  }
  function renderPicker() {
    var host = qs("[data-picker]", root); if (!host) return; var uploads = data.uploads || [];
    host.innerHTML = '<section class="admin-card"><div class="admin-card__head"><h2 class="admin-card__title">Загруженные фото</h2>' +
      '<button class="btn btn--ghost btn--sm" type="button" data-action="close-picker">Закрыть</button></div>' +
      (uploads.length ? '<div class="media-grid">' + uploads.map(function (upload) {
        var url = safeUrl(upload.url); if (!url) return "";
        return '<button class="media-grid__item" type="button" data-action="pick-media" data-url="' + esc(url) + '" aria-pressed="false" aria-label="Выбрать ' + esc(upload.name) +
          '"><img src="' + esc(url) + '" alt="' + esc(upload.name) + '" loading="lazy"></button>';
      }).join("") + "</div>" : '<p class="admin-empty">Загруженных фото пока нет — загрузите первое.</p>') + '<p class="admin-hint">Миниатюры — все файлы, загруженные через админку. Нажмите на фото, чтобы выбрать его.</p></section>';
  }
  function closePicker() {
    pickerApply = null; var host = qs("[data-picker]", root); if (host) { host.hidden = true; host.innerHTML = ""; }
    if (pickerReturn && pickerReturn.focus) pickerReturn.focus(); pickerReturn = null;
  }
  function pickMedia(url) {
    if (pickerApply) pickerApply(url); closePicker();
  }
  /* ----------------------------------------------------------------- события */
  function onClick(event) {
    var tabButton = event.target.closest("[data-tab]"); if (tabButton) { setTab(tabButton.getAttribute("data-tab")); return; }
    var button = event.target.closest("[data-action]"); if (!button) return; var action = button.getAttribute("data-action"), id = button.getAttribute("data-id");
    var index = Number(button.getAttribute("data-index")), target = button.getAttribute("data-target"); switch (action) {
      case "login": doLogin(); break;
      case "logout": doLogout(); break;
      case "save-product": saveProduct(); break;
      case "new-product": fillProductForm(null); break;
      case "edit-product": fillProductForm(findProduct(id)); break;
      case "delete-product": deleteProduct(id); break;
      case "remove-product-image": setPf("image_url", ""); renderProductPreview(""); break;
      case "reset-filters":
        filters = { q: "", category: "", studio: "", view: "all" };
        qsa("[data-filter]", root).forEach(function (node) { node.value = node.getAttribute("data-filter") === "view" ? "all" : ""; });
        renderProductList();
        break;
      case "upload": startUpload(target, index); break;
      case "pick": openPicker(targetApplier(target, index)); break;
      case "pick-media": pickMedia(button.getAttribute("data-url")); break;
      case "close-picker": closePicker(); break;
      case "retry-upload": if (failedFile && failedApply) processImage(failedFile, failedApply); break;
      case "order-day": orderView.day = button.getAttribute("data-day"); orderView.archive = false; renderOrdersPanel(); break;
      case "toggle-archive": orderView.archive = !orderView.archive; renderOrdersPanel(); break;
      case "archive-order": setOrderArchived(id, true); break;
      case "restore-order": setOrderArchived(id, false); break;
      case "refresh-orders": refreshOrders(); break;
      case "save-telegram": saveTelegram(); break;
      case "test-telegram": testTelegram(); break;
      case "new-category": fillCategoryForm(null); break;
      case "edit-category": fillCategoryForm(findCategory(id)); break;
      case "save-category": saveCategory(); break;
      case "delete-category": deleteCategory(id); break;
      case "remove-cover":
        var cover = qs('[data-cf="image_url"]', root); if (cover) cover.value = ""; renderCategoryPreview(""); break;
      case "save-site": saveSite(); break;
      case "reset-site": resetSite(); break;
      case "add-slide":
        if (!siteDraft) siteDraft = clone(data.site); siteDraft.hero_slides.push({ image_url: "", mobile_image_url: "", alt: "" });
        markSiteDirty(); renderSitePanel(); break;
      case "slide-up":
      case "slide-down":
        if (!siteDraft) break; var slides = siteDraft.hero_slides, next = action === "slide-up" ? index - 1 : index + 1; if (next < 0 || next >= slides.length) break;
        slides.splice(next, 0, slides.splice(index, 1)[0]); markSiteDirty();
        renderSitePanel(); break;
      case "slide-remove": if (siteDraft) { siteDraft.hero_slides.splice(index, 1); markSiteDirty(); renderSitePanel(); } break;
      case "remove-offers": if (siteDraft) { siteDraft.offers_image_url = ""; markSiteDirty(); renderSitePanel(); } break;
      case "save-codes": saveCodes(); break;
      default: break;
    }
  }
  function onChange(event) {
    var node = event.target; if (node.matches("[data-file]")) {
      var file = node.files && node.files[0]; if (!file || !fileTarget) return; processImage(file, targetApplier(fileTarget.target, fileTarget.index)); return;
    }
    if (node.matches("[data-flag]")) { toggleProductFlag(node); return; }
    if (node.matches("[data-filter]")) { filters[node.getAttribute("data-filter")] = node.value; renderProductList(); return; }
    if (node.matches("[data-slide-field]") && siteDraft) {
      var slide = siteDraft.hero_slides[Number(node.getAttribute("data-slide"))];
      if (slide) { slide[node.getAttribute("data-slide-field")] = node.value; markSiteDirty(); }
    }
  }
  function onInput(event) {
    var node = event.target; if (node.matches('[data-filter="q"]')) { filters.q = node.value; renderProductList(); }
    else if (node.matches('[data-pf="title"]')) updateAutoSeo();
    else if (node.matches("[data-slide-field]") && siteDraft) {
      var slide = siteDraft.hero_slides[Number(node.getAttribute("data-slide"))];
      if (slide) { slide[node.getAttribute("data-slide-field")] = node.value; markSiteDirty(); }
    }
  }
  function onKeydown(event) {
    if (event.key === "Enter" && event.target.matches("[data-login-key]")) { event.preventDefault(); doLogin(); return; }
    if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return; var tab = event.target.closest("[data-tab]"); if (!tab) return; event.preventDefault();
    var ids = TABS.map(function (item) { return item.id; });
    var position = ids.indexOf(tab.getAttribute("data-tab"));
    var next = event.key === "ArrowRight" ? (position + 1) % ids.length : (position - 1 + ids.length) % ids.length; setTab(ids[next]);
    var nextButton = qs('[data-tab="' + ids[next] + '"]', root); if (nextButton) nextButton.focus();
  }
  /* --------------------------------------------------------------- включение */
  function applyMode() {
    var on = location.hash.replace(/^#/, "") === "admin"; qsa(".page-head, .shop-layout").forEach(function (node) { node.hidden = on; });
    qsa("dialog").forEach(function (node) {
      if (on) { if (node.open && typeof node.close === "function") node.close(); node.hidden = true; }
      else node.hidden = false;
    }); if (!root) return; root.hidden = !on; if (!on) { document.title = baseTitle; return; }
    document.title = "Админка — Milagro"; if (token && data) renderShell();
    else if (token) {
      loadAll().then(function () { renderShell(); }).catch(function (error) {
        token = ""; renderLogin(); loginError(errorText(error));
      });
    } else renderLogin();
  }
  root = qs("#admin"); if (!root) return; root.addEventListener("click", onClick); root.addEventListener("change", onChange); root.addEventListener("input", onInput);
  root.addEventListener("keydown", onKeydown);
  window.addEventListener("hashchange", applyMode); applyMode();
})();
