(function () {
  const rects = (selector) =>
    Array.from(document.querySelectorAll(selector)).map((el) => {
      const r = el.getBoundingClientRect();
      return { cls: String(el.className).slice(0, 40), x: Math.round(r.x), w: Math.round(r.width) };
    });
  return {
    advantage: rects(".advantage"),
    collections: rects(".collection"),
    delivery: rects(".delivery-zone"),
    grid: getComputedStyle(document.querySelector(".advantages__list")).gridTemplateColumns,
    deliveryGrid: getComputedStyle(document.querySelector(".delivery__grid")).gridTemplateColumns,
    collectionsGrid: getComputedStyle(document.querySelector(".collections")).gridTemplateColumns
  };
})();
