// Loaded as a blocking same-origin file: the server's CSP (script-src 'self') blocks inline scripts.
// Runs before CSS so a saved theme applies before first paint.
(() => {
  const root = document.documentElement;
  const save = (t) => { try { localStorage.setItem("theme", t); } catch {} };
  try {
    const t = localStorage.getItem("theme");
    if (t === "light" || t === "dark") root.dataset.theme = t;
  } catch {}
  const os = matchMedia("(prefers-color-scheme: dark)");
  const isDark = () => (root.dataset.theme ? root.dataset.theme === "dark" : os.matches);
  const sync = () => {
    for (const btn of document.querySelectorAll("[data-theme-toggle]")) {
      btn.setAttribute("aria-pressed", String(isDark()));
    }
  };
  os.addEventListener("change", sync);
  document.addEventListener("DOMContentLoaded", () => {
    sync();
    for (const btn of document.querySelectorAll("[data-theme-toggle]")) {
      btn.addEventListener("click", () => {
        root.dataset.theme = isDark() ? "light" : "dark";
        save(root.dataset.theme);
        sync();
      });
    }
  });
})();
