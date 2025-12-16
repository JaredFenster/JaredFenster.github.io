(async function includePartials() {
  const includeTargets = Array.from(document.querySelectorAll("[data-include]"));
  if (includeTargets.length === 0) return;

  for (const el of includeTargets) {
    const path = el.getAttribute("data-include");
    try {
      const res = await fetch(path, { cache: "no-store" });
      if (!res.ok) throw new Error(`Failed to load ${path}: ${res.status}`);
      el.innerHTML = await res.text();
    } catch (err) {
      console.error(err);
      el.innerHTML = `<div style="padding:12px;color:#fff;background:#400;border-radius:12px;margin:12px;">
        Failed to load partial: ${path}
      </div>`;
    }
  }

  // Let app.js know nav is ready
  window.__NAV_READY__ = true;
  window.dispatchEvent(new Event("nav:loaded"));

  // If app already defined initNav, run it
  if (typeof window.initNav === "function") window.initNav();
})();
