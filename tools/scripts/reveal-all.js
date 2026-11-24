(async function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const height = document.body.scrollHeight;
  for (let y = 0; y < height; y += 480) {
    window.scrollTo(0, y);
    await wait(110);
  }
  await wait(500);
  window.scrollTo(0, 0);
  await wait(400);
  const all = document.querySelectorAll("[data-reveal]");
  const visible = document.querySelectorAll("[data-reveal].is-visible");
  return { total: all.length, visible: visible.length };
})();
