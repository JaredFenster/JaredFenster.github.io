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
    // Prevent default browser image dragging which creates a tiny drag ghost
    imgEl.draggable = false;
    imgEl.addEventListener('dragstart', (ev) => ev.preventDefault());

    if (imgEl.complete && imgEl.naturalWidth > 0) buildPixelBuffer(imgEl);
    else imgEl.addEventListener("load", () => buildPixelBuffer(imgEl));
  });

  // Hover/click state
  let hoveredEl = null;
  let offFrames = 0;
  let forcedHoverEl = null; // set by nav dropdown hover

  scene.addEventListener("mousemove", (e) => {
    if (forcedHoverEl) return;

    // If the user is holding the mouse (closed cursor), don't let hover
    // logic override the closed state.
    if (document.body.classList && document.body.classList.contains && document.body.classList.contains('cursor-closed')) return;

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
    // Cursor state: mid when hovering a clickable robot, open otherwise
    if (window.__setCursor) {
      if (hoveredEl) window.__setCursor('cursor-mid');
      else window.__setCursor('cursor-open');
    }
  });

  scene.addEventListener("mouseleave", () => {
    if (forcedHoverEl) return;
    hoveredEl = null;
    offFrames = 0;
    clearHoverAll();
    if (window.__setCursor && !(document.body.classList && document.body.classList.contains && document.body.classList.contains('cursor-closed'))) window.__setCursor('cursor-open');
  });

  // Click a robot => go straight to its page
  scene.addEventListener("click", (e) => {
    const hitEl = topmostRobotHit(e.clientX, e.clientY);
    if (!hitEl) return;

    // show closed cursor briefly on click
    if (window.__setCursor) window.__setCursor('cursor-closed');

    const id = hitEl.dataset.robot;
    window.location.href = `projects/${id}.html`;
  });

  // Expose hooks so nav hover can control highlight
  window.__ROBOT_SCENE__ = {
    forceHoverRobot(idOrNull) {
      forcedHoverEl = idOrNull ? robots.find(r => r.dataset.robot === String(idOrNull)) : null;
      if (forcedHoverEl) {
        setHoverRobot(forcedHoverEl);
        if (window.__setCursor && !(document.body.classList && document.body.classList.contains && document.body.classList.contains('cursor-closed'))) window.__setCursor('cursor-mid');
      } else {
        clearHoverAll();
        if (window.__setCursor && !(document.body.classList && document.body.classList.contains && document.body.classList.contains('cursor-closed'))) window.__setCursor('cursor-open');
      }
    },
    clearForcedHover() {
      forcedHoverEl = null;
      clearHoverAll();
      if (window.__setCursor && !(document.body.classList && document.body.classList.contains && document.body.classList.contains('cursor-closed'))) window.__setCursor('cursor-open');
    }
  };

  // Allow external code to query if there is a hover present
  window.__ROBOT_SCENE__.hasHover = () => Boolean(forcedHoverEl || hoveredEl);
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

function ensureMobileDrawerMarkup() {
  // backdrop
  if (!document.querySelector(".drawer-backdrop")) {
    const bd = document.createElement("div");
    bd.className = "drawer-backdrop";
    document.body.appendChild(bd);
  }

  
  //Yes this is a terrible way to do this, No I do not care.
  const d = document.createElement("aside");
  d.className = "mobile-drawer";
  d.setAttribute("aria-label", "Mobile menu");
  d.innerHTML = `
    <div class="drawer-title">Navigation</div>
    <a href="/">Home</a>
    <a href="/#about" data-about-link>About</a>
    <a href="/gallery.html">Gallery</a>
    <div class="drawer-title">Projects</div>
    <a href="/projects/precision-arm.html">Precision Arm</a>
    <a href="/projects/b2emo.html">B2EMO</a>
    <a href="/projects/harmonic-drive.html">Harmonic Drive</a>
    <a href="/projects/vision-arm.html">Vision Arm</a>
    <a href="/projects/omni.html">Omnidirectional Robot</a>
    <a href="/projects/controller.html">Controller</a>
    <a href="/projects/car.html">RC Car</a>
    <a href="/projects/vertical-launcher.html">Vertical Launcher</a>
    <div class="drawer-title">Social</div>
    <div class="drawer-social">
      <a class="icon-link" href="https://www.linkedin.com/in/jaredfenster" target="_blank" rel="noopener" aria-label="LinkedIn">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20.45 20.45h-3.55v-5.57c0-1.33-.03-3.04-1.85-3.04-1.86 0-2.14 1.45-2.14 2.95v5.66H9.32V9h3.41v1.56h.05c.48-.9 1.65-1.85 3.39-1.85 3.62 0 4.28 2.38 4.28 5.48v6.26zM5.34 7.43a2.06 2.06 0 1 1 0-4.12 2.06 2.06 0 0 1 0 4.12zM7.11 20.45H3.56V9h3.55v11.45z"/>
        </svg>
      </a>
      <a class="icon-link" href="https://www.youtube.com/@jaredfenster" target="_blank" rel="noopener" aria-label="YouTube">
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path d="M21.6 7.2a3 3 0 0 0-2.1-2.1C17.7 4.6 12 4.6 12 4.6s-5.7 0-7.5.5A3 3 0 0 0 2.4 7.2 31.1 31.1 0 0 0 2 12s.1 3.2.4 4.8a3 3 0 0 0 2.1 2.1c1.8.5 7.5.5 7.5.5s5.7 0 7.5-.5a3 3 0 0 0 2.1-2.1c.3-1.6.4-4.8.4-4.8s0-3.2-.4-4.8zM10 15V9l6 3-6 3z"/>
        </svg>
      </a>
    </div>`;
  document.body.appendChild(d);
}
 // ===== ABOUT OVERLAY (toggle + deep-link from other pages) =====
// ===== ABOUT OVERLAY (toggle + deep-link /#about) =====
(function () {
  function initAboutOverlay() {
    const overlay = document.getElementById("aboutOverlay");
    const sheet = overlay ? overlay.querySelector(".about-sheet") : null;

    // Only exists on index.html
    if (!overlay || !sheet) return;

    // The nav gets injected, so this might be null on first pass
    const aboutBtn = document.getElementById("aboutNavBtn");

    function openAbout() {
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
    }

    function closeAbout() {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
    }

    function toggleAbout() {
      const open = overlay.classList.contains("is-open");
      if (open) {
        closeAbout();
        // remove hash (no jump)
        if (location.hash === "#about") history.replaceState(null, "", location.pathname);
      } else {
        openAbout();
        // add hash (so copy/paste works)
        if (location.hash !== "#about") history.replaceState(null, "", location.pathname + "#about");
      }
    }

    function syncFromHash() {
      if (location.hash === "#about") openAbout();
      else closeAbout();
    }

    // Click outside closes
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeAbout();
        if (location.hash === "#about") history.replaceState(null, "", location.pathname);
      }
    });

    // Stop clicks inside the sheet from closing
    sheet.addEventListener("click", (e) => e.stopPropagation());

    // ESC closes
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAbout();
        if (location.hash === "#about") history.replaceState(null, "", location.pathname);
      }
    });

    // About button toggles (ONLY on index)
    if (aboutBtn && !aboutBtn.__aboutBound) {
      aboutBtn.__aboutBound = true;
      aboutBtn.addEventListener("click", (e) => {
        // prevent navigation on index
        e.preventDefault();
        toggleAbout();
      });
    }

    // Open automatically if landing on /#about
    syncFromHash();

    // Back/forward + manual hash edits
    window.addEventListener("hashchange", syncFromHash);
  }

  // Run once when DOM is ready
  document.addEventListener("DOMContentLoaded", initAboutOverlay);

  // Run again when nav is injected (important!)
  window.addEventListener("nav:loaded", initAboutOverlay);
})();

























function initMobileDrawer() {
  ensureMobileDrawerMarkup();

  const menuBtn = document.querySelector(".nav-menu-btn");
  const backdrop = document.querySelector(".drawer-backdrop");
  const drawer = document.querySelector(".mobile-drawer");

  if (!menuBtn || !backdrop || !drawer) return;

  if (menuBtn.dataset.drawerInit === "1") return;
  menuBtn.dataset.drawerInit = "1";

  menuBtn.addEventListener("click", (e) => {
    e.preventDefault();
    document.body.classList.toggle("drawer-open");
  });

  backdrop.addEventListener("click", () => {
    document.body.classList.remove("drawer-open");
  });

  drawer.addEventListener("click", (e) => {
    if (e.target.closest("a")) document.body.classList.remove("drawer-open");
  });
}






// Global cursor manager: idle/open/mid/closed
(function () {
  const CUR_OPEN = 'cursor-open';
  const CUR_MID = 'cursor-mid';
  const CUR_CLOSED = 'cursor-closed';
  let idleTimer = null;
  const IDLE_MS = 2000;

  function setCursor(name) {
    document.body.classList.remove(CUR_OPEN, CUR_MID, CUR_CLOSED);
    if (name) document.body.classList.add(name);
  }

  // expose to scene code
  window.__setCursor = setCursor;

  document.addEventListener('mousemove', (e) => {
    // don't override closed state while mouse is down
    if (document.body.classList.contains(CUR_CLOSED)) return;

    // If the robot scene reports a hover, keep the mid cursor and
    // avoid resetting it to open (so robot hover isn't immediately
    // overridden by the global mousemove listener).
    if (window.__ROBOT_SCENE__ && typeof window.__ROBOT_SCENE__.hasHover === 'function' && window.__ROBOT_SCENE__.hasHover()) {
      clearTimeout(idleTimer);
      return;
    }

    setCursor(CUR_OPEN);
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      // idle: revert to default cursor by removing custom classes
      document.body.classList.remove(CUR_OPEN, CUR_MID);
    }, IDLE_MS);
  });

  document.addEventListener('mousedown', () => {
    setCursor(CUR_CLOSED);
  });

  document.addEventListener('mouseup', () => {
    // restore based on current scene hover
    if (window.__ROBOT_SCENE__ && typeof window.__ROBOT_SCENE__.hasHover === 'function' && window.__ROBOT_SCENE__.hasHover()) {
      setCursor(CUR_MID);
    } else {
      setCursor(CUR_OPEN);
    }
  });
})();

document.addEventListener("DOMContentLoaded", () => {
  safeInit();
  initMobileDrawer();
  if (window.__NAV_READY__ && typeof window.initNav === "function") window.initNav();
});

window.addEventListener("nav:loaded", () => {
  initMobileDrawer();
  if (typeof window.initNav === "function") window.initNav();
});



