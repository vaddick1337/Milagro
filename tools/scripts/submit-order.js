(async function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  document.querySelector("[data-detail-id]").click();
  await wait(700);
  document.querySelector("[data-add]").click();
  await wait(700);
  document.querySelector("[data-checkout]").click();
  await wait(1100);

  const set = (selector, value) => {
    const node = document.querySelector(selector);
    if (!node) return false;
    node.value = value;
    node.dispatchEvent(new Event("input", { bubbles: true }));
    node.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  };

  set("#order-name", "Тестовый покупатель");
  set("#order-phone", "+7 900 000-00-00");
  set("#order-address", "г. Сургут, ул. Тестовая, 1");

  const date = document.querySelector("[data-date]:not(:disabled)");
  if (date) date.click();
  await wait(400);
  const slot = document.querySelector("[data-slot]:not(:disabled)");
  if (slot) slot.click();
  await wait(200);

  const consent = document.querySelector("#order-consent-data");
  const offer = document.querySelector("#order-consent-offer");
  if (consent) { consent.checked = true; consent.dispatchEvent(new Event("change", { bubbles: true })); }
  if (offer) { offer.checked = true; offer.dispatchEvent(new Event("change", { bubbles: true })); }

  const submit = document.querySelector("[data-order-submit]");
  if (submit) submit.click();
  await wait(1800);

  const success = document.querySelector("[data-success]");
  return {
    successOpen: Boolean(success && success.open),
    title: (document.querySelector("#success-title") || {}).textContent || null,
    code: (document.querySelector(".success__code") || {}).textContent || null,
    body: (document.querySelector("[data-success-panel]") || {}).textContent
      ? document.querySelector("[data-success-panel]").textContent.replace(/\s+/g, " ").slice(0, 200)
      : null,
    errors: Array.from(document.querySelectorAll(".field.is-invalid")).map((f) => f.dataset.field)
  };
})();
