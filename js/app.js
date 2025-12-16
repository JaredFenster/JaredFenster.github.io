// ===== CONFIG =====
const ALPHA_THRESHOLD = 15;
const HIT_RADIUS = 50;
const OFF_FRAMES_THRESHOLD = 8;

// ===== HELPERS =====
function $(sel, root = document) { return root.querySelector(sel); }
function $all(sel, root = document) { return Array.from(root.querySelectorAll(sel)); }

function safeInit() {
  const scene = $("#scene");
  
  const robots = $all(".robot");

  // Not on the scene page? No scene logic.
  if (!scene || robots.length === 0) return;

  // Per-robot pixel buffers
  const state = new Map(); // imgEl -> { canvas, imgData }

  function buildPixelBuffer(imgEl) {
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    canvas.width = imgEl.naturalWidth;
    canvas.height = imgEl.naturalHeight;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(imgEl, 0, 0);

    state.set(imgEl, {
      canvas,
      imgData: ctx.getImageData(0, 0, canvas.width, canvas.height),
    });
  }

  // object-fit: cover mapping (centered)
  function screenToImageCoverCoords(imgEl, clientX, clientY) {
    const rect = imgEl.getBoundingClientRect();
    const iw = imgEl.naturalWidth;
    const ih = imgEl.naturalHeight;

    const scale = Math.max(rect.width / iw, rect.height / ih); // cover
    const drawnW = iw * scale;
    const drawnH = ih * scale;

    // object-position: center
    const offsetX = rect.left + (rect.width - drawnW) / 2;
    const offsetY = rect.top  + (rect.height - drawnH) / 2;

    return {
      x: (clientX - offsetX) / scale,
      y: (clientY - offsetY) / scale,
    };
  }

  function isOpaqueAtScreenPoint(imgEl, clientX, clientY) {
    const st = state.get(imgEl);
    if (!st || !st.imgData) return false;

    const { x, y } = screenToImageCoverCoords(imgEl, clientX, clientY);
    const baseX = Math.floor(x);
    const baseY = Math.floor(y);

    const w = st.canvas.width;
    const h = st.canvas.height;
    const data = st.imgData.data;

    for (let dy = -HIT_RADIUS; dy <= HIT_RADIUS; dy++) {
      for (let dx = -HIT_RADIUS; dx <= HIT_RADIUS; dx++) {
        const px = baseX + dx;
        const py = baseY + dy;
        if (px < 0 || py < 0 || px >= w || py >= h) continue;

        const idx = (py * w + px) * 4;
        if (data[idx + 3] > ALPHA_THRESHOLD) return true;
      }
    }
    return false;
  }

  function topmostRobotHit(clientX, clientY) {
    for (let i = robots.length - 1; i >= 0; i--) {
      const el = robots[i];
      if (isOpaqueAtScreenPoint(el, clientX, clientY)) return el;
    }
    return null;
  }

  function clearHoverAll() {
    robots.forEach(el => el.classList.remove("robot--hover"));
  }

  function setHoverRobot(elOrNull) {
    clearHoverAll();
    if (!elOrNull) return;
    elOrNull.classList.add("robot--hover");
  }

  // Load buffers
  robots.forEach((imgEl) => {
    if (imgEl.complete && imgEl.naturalWidth > 0) buildPixelBuffer(imgEl);
    else imgEl.addEventListener("load", () => buildPixelBuffer(imgEl));
  });

  // Hover/click state
  let hoveredEl = null;
  let offFrames = 0;
  let forcedHoverEl = null; // set by nav dropdown hover

  scene.addEventListener("mousemove", (e) => {
    if (forcedHoverEl) return;

    const hitEl = topmostRobotHit(e.clientX, e.clientY);

    if (hitEl) {
      hoveredEl = hitEl;
      offFrames = 0;
    } else if (hoveredEl) {
      offFrames++;
      if (offFrames >= OFF_FRAMES_THRESHOLD) hoveredEl = null;
    } else {
      hoveredEl = null;
    }

    setHoverRobot(hoveredEl);
  });

  scene.addEventListener("mouseleave", () => {
    if (forcedHoverEl) return;
    hoveredEl = null;
    offFrames = 0;
    clearHoverAll();
  });

  // Click a robot => go straight to its page
  scene.addEventListener("click", (e) => {
    const hitEl = topmostRobotHit(e.clientX, e.clientY);
    if (!hitEl) return;

    const id = hitEl.dataset.robot;
    window.location.href = `projects/${id}.html`;
  });

  // Expose hooks so nav hover can control highlight
  window.__ROBOT_SCENE__ = {
    forceHoverRobot(idOrNull) {
      forcedHoverEl = idOrNull ? robots.find(r => r.dataset.robot === String(idOrNull)) : null;
      if (forcedHoverEl) setHoverRobot(forcedHoverEl);
      else clearHoverAll();
    },
    clearForcedHover() {
      forcedHoverEl = null;
      clearHoverAll();
    }
  };
}

// ===== NAV WIRING =====
window.initNav = function initNav() {
  const items = $all(".dropdown-item");
  if (items.length === 0) return;

  items.forEach((item) => {
    item.addEventListener("mouseenter", () => {
      const id = item.dataset.robot;
      if (window.__ROBOT_SCENE__) window.__ROBOT_SCENE__.forceHoverRobot(id);
    });

    item.addEventListener("mouseleave", () => {
      if (window.__ROBOT_SCENE__) window.__ROBOT_SCENE__.clearForcedHover();
    });

    item.addEventListener("click", (e) => {
      const href = item.dataset.href || item.getAttribute("href");
      if (href && href !== "#") window.location.href = href;
      e.preventDefault();
    });
  });
};

document.addEventListener("DOMContentLoaded", () => {
  safeInit();
  if (window.__NAV_READY__ && typeof window.initNav === "function") window.initNav();
});

window.addEventListener("nav:loaded", () => {
  if (typeof window.initNav === "function") window.initNav();
});
