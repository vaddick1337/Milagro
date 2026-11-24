(async function () {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const input = document.querySelector("[data-login-key]");
  if (input) {
    input.value = "test";
    input.dispatchEvent(new Event("input", { bubbles: true }));
  }
  const button = document.querySelector("[data-action='login']");
  if (button) button.click();
  await wait(1500);
  return document.title;
})();
