(async function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const burger = document.querySelector("[data-burger]");
  if (burger) burger.click();
  await wait(600);
  const panel = document.querySelector("[data-mobile-nav]");
  return {
    open: document.body.classList.contains("menu-open"),
    width: panel ? getComputedStyle(panel).width : null,
    visible: panel ? getComputedStyle(panel).visibility : null
  };
})();
