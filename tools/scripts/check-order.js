(async function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const card = document.querySelector("[data-detail-id]");
  if (card) card.click();
  await wait(700);
  const add = document.querySelector("[data-add]");
  if (add) add.click();
  await wait(700);
  const checkout = document.querySelector("[data-checkout]");
  if (checkout) checkout.click();
  await wait(1200);

  const days = Array.from(document.querySelectorAll("[data-date]"));
  const disabled = days.filter((d) => d.disabled).map((d) => d.dataset.date);
  const enabled = days.filter((d) => !d.disabled);
  const slots = Array.from(document.querySelectorAll("[data-slot]"));
  return {
    panel: Boolean(document.querySelector("[data-order-form]")),
    daysTotal: days.length,
    daysEnabled: enabled.length,
    firstEnabled: enabled.length ? enabled[0].dataset.date : null,
    lastEnabled: enabled.length ? enabled[enabled.length - 1].dataset.date : null,
    disabledSample: disabled.slice(0, 6),
    slotsTotal: slots.length,
    slotsEnabled: slots.filter((s) => !s.disabled).length,
    selectedDate: (document.querySelector('[data-date][aria-pressed="true"]') || {}).dataset
      ? document.querySelector('[data-date][aria-pressed="true"]').dataset.date
      : null,
    methods: Array.from(document.querySelectorAll('[name="delivery_method"]')).map((m) => m.value + (m.disabled ? ":off" : ":on")),
    total: (document.querySelector("[data-total-sum]") || {}).textContent,
    errors: document.querySelectorAll(".field.is-invalid").length
  };
})();
