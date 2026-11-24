(async function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const card = document.querySelector("[data-detail-id]");
  if (card) card.click();
  await wait(800);
  const add = document.querySelector("[data-add]");
  if (add) add.click();
  await wait(800);
  const checkout = document.querySelector("[data-checkout]");
  if (checkout) checkout.click();
  await wait(1200);
  const date = document.querySelector("[data-date]:not(:disabled)");
  if (date) date.click();
  await wait(500);
  const slot = document.querySelector("[data-slot]:not(:disabled)");
  if (slot) slot.click();
  await wait(400);
  return "order open";
})();
