/* ==========================================================================
   home-catalog.js — главная страница.
   Слайдер hero, «Готовы прямо сейчас», коллекции, студии с ленивой картой,
   блок доставки. Все данные — из api.js, разметка собирается здесь.
   ========================================================================== */
(function () {
  "use strict";

  var esc = App.esc;
  var money = App.money;
  var icon = App.icon;
  var qs = App.qs;

  var reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------------- hero */

  function renderHero(site) {
    var host = qs("[data-hero-slider]");
    if (!host) return;

    var slides = (site && site.hero_slides && site.hero_slides.length
      ? site.hero_slides
      : [{ image_url: "assets/photos/hero-1.svg", mobile_image_url: "assets/photos/hero-1-mobile.svg", alt: "Цветочная студия Milagro" }]
    ).filter(function (slide) {
      return slide && slide.image_url;
    });

    if (!slides.length) return;

    host.innerHTML =
      slides
        .map(function (slide, index) {
          return (
            '<div class="hero-slider__slide' + (index === 0 ? " is-active" : "") + '">' +
            "<picture>" +
            (slide.mobile_image_url
              ? '<source media="(max-width: 760px)" srcset="' + esc(slide.mobile_image_url) + '">'
              : "") +
            '<img src="' + esc(slide.image_url) + '" alt="' + esc(slide.alt || "") + '" ' +
            (index === 0 ? 'fetchpriority="high"' : 'loading="lazy"') + " decoding=\"async\">" +
            "</picture></div>"
          );
        })
        .join("") +
      '<div class="hero-slider__dots" role="tablist" aria-label="Кадры">' +
      slides
        .map(function (slide, index) {
          return (
            '<button class="hero-slider__dot" type="button" role="tab" data-slide="' + index + '" ' +
            'aria-label="Кадр ' + (index + 1) + '" aria-current="' + (index === 0) + '"></button>'
          );
        })
        .join("") +
      "</div>" +
      (slides.length > 1
        ? '<div class="hero-slider__nav">' +
          '<button class="hero-slider__btn" type="button" data-hero-prev aria-label="Предыдущий кадр">←</button>' +
          '<button class="hero-slider__btn" type="button" data-hero-next aria-label="Следующий кадр">→</button>' +
          "</div>"
        : "");

    var slideNodes = App.qsa(".hero-slider__slide", host);
    var dots = App.qsa(".hero-slider__dot", host);
    var current = 0;
    var timer = null;
    var paused = false;

    function show(index) {
      current = (index + slideNodes.length) % slideNodes.length;
      slideNodes.forEach(function (node, i) {
        node.classList.toggle("is-active", i === current);
        node.setAttribute("aria-hidden", i === current ? "false" : "true");
      });
      dots.forEach(function (dot, i) {
        dot.setAttribute("aria-current", i === current ? "true" : "false");
      });
    }

    function stop() {
      if (timer) {
        window.clearInterval(timer);
        timer = null;
      }
    }

    function start() {
      stop();
      if (reduceMotion || paused || slideNodes.length < 2 || document.hidden) return;
      timer = window.setInterval(function () {
        show(current + 1);
      }, 6000);
    }

    dots.forEach(function (dot) {
      dot.addEventListener("click", function () {
        show(Number(dot.dataset.slide));
        start();
      });
    });

    var prev = qs("[data-hero-prev]", host);
    var next = qs("[data-hero-next]", host);
    if (prev) {
      prev.addEventListener("click", function () {
        show(current - 1);
        start();
      });
    }
    if (next) {
      next.addEventListener("click", function () {
        show(current + 1);
        start();
      });
    }

    host.addEventListener("mouseenter", function () {
      paused = true;
      stop();
    });
    host.addEventListener("mouseleave", function () {
      paused = false;
      start();
    });
    host.addEventListener("focusin", stop);
    host.addEventListener("focusout", start);
    document.addEventListener("visibilitychange", start);
    host.addEventListener("keydown", function (event) {
      if (event.key === "ArrowLeft") {
        show(current - 1);
        event.preventDefault();
      }
      if (event.key === "ArrowRight") {
        show(current + 1);
        event.preventDefault();
      }
    });

    show(0);
    start();
  }

  /* -------------------------------------------------------------- showcase */

  function renderShowcase(products, categories) {
    var section = qs("#showcase");
    var host = qs("[data-showcase]");
    if (!section || !host) return;

    var showcase = products
      .filter(function (product) {
        return product.showcase && !product.hidden;
      })
      .slice(0, 4);

    if (!showcase.length) {
      section.hidden = true;
      return;
    }

    var byId = {};
    categories.forEach(function (category) {
      byId[category.id] = category;
    });

    host.innerHTML = showcase
      .map(function (product) {
        return App.productCard(product, {
          categoryName: byId[product.category] ? byId[product.category].name : ""
        });
      })
      .join("");
    section.hidden = false;
  }

  /* ----------------------------------------------------------- collections */

  function renderCollections(products, categories) {
    var host = qs("[data-collections]");
    if (!host) return;

    var visible = products.filter(function (product) {
      return !product.hidden;
    });

    var sorted = categories
      .slice()
      .sort(function (a, b) {
        return (a.position || 0) - (b.position || 0);
      })
      .map(function (category) {
        return {
          category: category,
          count: visible.filter(function (product) {
            return product.category === category.id;
          }).length
        };
      })
      .filter(function (item) {
        return item.count > 0; // пустые коллекции не показываем
      });

    host.innerHTML = sorted
      .map(function (item) {
        var category = item.category;
        var count = item.count;
        return (
          '<a class="collection" href="catalog.html?slug=' + encodeURIComponent(category.slug) + '">' +
          '<img src="' + esc(category.image_url) + '" alt="' + esc(category.image_alt) + '" width="900" height="700" loading="lazy" decoding="async">' +
          '<span class="collection__overlay">' +
          '<span class="collection__count">' + count + " " + App.plural(count, "товар", "товара", "товаров") + "</span>" +
          '<span class="collection__title">' + esc(category.name) + "</span>" +
          '<span class="collection__text">' + esc(category.description) + "</span>" +
          "</span></a>"
        );
      })
      .join("");
  }

  /* --------------------------------------------------------------- studios */

  function renderStudios(branches) {
    var host = qs("[data-studios]");
    if (!host || !branches || !branches.length) return;

    var branch = branches[0];
    var ll = branch.lng + "%2C" + branch.lat;
    var mapLink = "https://yandex.ru/maps/?ll=" + ll + "&z=17&pt=" + ll + "%2Cpm2rdm";

    // Без встраивания карты: только адрес, координаты и ссылка в Яндекс Карты.
    host.innerHTML =
      '<div class="studio-card" data-reveal>' +
      '<h3 class="studio-card__title">' + esc(branch.name) + "</h3>" +
      '<p class="studio-card__row">' + icon("pin") + "<span>" + esc(branch.address) + "</span></p>" +
      '<p class="studio-card__row">' + icon("clock") + "<span>" + esc(branch.hours) + "</span></p>" +
      '<p class="studio-card__row">' + icon("phone") + '<a href="' + esc(branch.phone_href || "tel:+79224461068") + '">' + esc(branch.phone) + "</a></p>" +
      '<div class="studio-card__actions">' +
      '<a class="btn btn--primary btn--sm" href="' + esc(mapLink) + '" target="_blank" rel="noopener">Маршрут</a>' +
      '<a class="btn btn--outline btn--sm" href="' + esc(branch.phone_href || "tel:+79224461068") + '">Позвонить</a>' +
      "</div></div>" +
      '<div class="studio-map" data-reveal>' +
      '<div class="studio-map__placeholder">' +
      icon("pin", "icon--lg") +
      "<p>" + esc(branch.address) + ".<br>Координаты: " + esc(branch.lat) + ", " + esc(branch.lng) + ".</p>" +
      '<a class="btn btn--outline btn--sm" href="' + esc(mapLink) + '" target="_blank" rel="noopener">Открыть в Яндекс Картах</a>' +
      "</div></div>";
  }

  /* -------------------------------------------------------------- delivery */

  /** «09:30–20:30» из первого старта и конца последнего слота. */
  function deliveryTime(delivery) {
    var slots = delivery.slots || [];
    if (!slots.length) return "10:00–20:00";
    var first = slots[0].start;
    var last = slots[slots.length - 1];
    var end = String(last.label || "").slice(-5);
    return end ? first + "–" + end : "10:00–20:00";
  }

  function renderDelivery(delivery) {
    var host = qs("[data-delivery]");
    if (!host) return;

    var zones = (delivery.zones || []).map(function (zone) {
      var hasPrice = typeof zone.price === "number";
      return (
        '<div class="delivery-zone" data-reveal>' +
        '<span class="delivery-zone__name">' + esc(zone.name) + "</span>" +
        '<span class="delivery-zone__price">' + (hasPrice ? money(zone.price) : "стоимость уточняется") + "</span>" +
        (hasPrice && zone.price_note ? '<span class="delivery-zone__note">' + esc(zone.price_note) + "</span>" : "") +
        "</div>"
      );
    });

    var surprise = (delivery.surprise_zones || []).map(function (zone) {
      return (
        '<div class="delivery-zone" data-reveal>' +
        '<span class="delivery-zone__name">' + esc(zone.name) + "</span>" +
        '<span class="delivery-zone__price">' +
        (typeof zone.price === "number" ? money(zone.price) : "стоимость уточняется") +
        "</span>" +
        '<span class="delivery-zone__note">Не знаете адрес — позвоним получателю и уточним</span>' +
        "</div>"
      );
    });

    host.innerHTML =
      '<div class="delivery__grid">' + zones.join("") + surprise.join("") + "</div>" +
      '<div class="delivery__foot">' +
      "<span>Порог бесплатной доставки: " +
      (typeof delivery.free_from === "number" ? money(delivery.free_from) : "уточняется") +
      "</span>" +
      "<span>Время доставки: " + esc(deliveryTime(delivery)) + "</span>" +
      '<a class="link-arrow" href="shop.html">Оформить доставку</a>' +
      "</div>";

    var note = qs("[data-delivery-note]");
    if (note && typeof delivery.free_from === "number") {
      note.textContent = "По городу, бесплатно от " + money(delivery.free_from) + ".";
    }
  }

  /* ------------------------------------------------------------------ boot */

  App.init({ active: "home", footer: "dark" })
    .then(function () {
      return Promise.all([
        api("/api/catalog"),
        api("/api/site"),
        api("/api/branches"),
        api("/api/delivery")
      ]);
    })
    .then(function (data) {
      var catalog = data[0];
      renderHero(data[1]);
      renderShowcase(catalog.products, catalog.categories);
      renderCollections(catalog.products, catalog.categories);
      renderStudios(data[2].branches);
      renderDelivery(data[3]);
      App.revealScan();
    })
    .catch(function (error) {
      App.toast(error.message || "Не удалось загрузить главную", "error");
    });
})();
