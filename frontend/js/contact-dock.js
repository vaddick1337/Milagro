/* ==========================================================================
   contact-dock.js — плавающий док «позвонить / написать».
   Живёт на главной и в магазине. Сами ссылки — из данных контактов,
   ничего не угадываем: WhatsApp и MAX появятся, когда владелец их подтвердит.
   ========================================================================== */
(function () {
  "use strict";

  function mount() {
    var host = document.querySelector("[data-contact-dock]");
    if (!host) return;

    var links = [
      {
        href: "tel:+79224461068",
        label: "Позвонить",
        icon: "phone",
        main: true,
        sr: "Позвонить +7 922 446-10-68"
      },
      {
        href: "https://t.me/+79224461068",
        label: "Telegram",
        icon: "tg",
        external: true
      },
      {
        href: "https://vk.com/milagro_surgut",
        label: "VK",
        icon: "vk",
        external: true
      }
    ];

    host.className = "contact-dock";
    host.setAttribute("role", "complementary");
    host.setAttribute("aria-label", "Быстрая связь");
    host.innerHTML = links
      .map(function (link) {
        var attrs = link.external ? ' target="_blank" rel="noopener"' : "";
        return (
          '<a class="dock-btn' + (link.main ? " dock-btn--main" : "") + '" href="' +
          link.href + '"' + attrs + ' title="' + link.label + '">' +
          '<span class="icon icon--' + link.icon + '" aria-hidden="true"></span>' +
          '<span class="dock-btn__label">' + link.label + "</span>" +
          "</a>"
        );
      })
      .join("");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", mount);
  } else {
    mount();
  }
})();
