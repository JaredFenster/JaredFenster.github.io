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

  if (!scene || robots.length === 0) return;

  const state = new Map();

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

  function screenToImageCoverCoords(imgEl, clientX, clientY) {
    const rect = imgEl.getBoundingClientRect();
    const iw = imgEl.naturalWidth;
    const ih = imgEl.naturalHeight;

    const scale = Math.max(rect.width / iw, rect.height / ih);
    const drawnW = iw * scale;
    const drawnH = ih * scale;

    const offsetX = rect.left + (rect.width - drawnW) / 2;
    const offsetY = rect.top + (rect.height - drawnH) / 2;

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
    if (elOrNull) elOrNull.classList.add("robot--hover");
  }

  robots.forEach((imgEl) => {
    imgEl.draggable = false;
    imgEl.addEventListener('dragstart', e => e.preventDefault());

    if (imgEl.complete && imgEl.naturalWidth > 0) buildPixelBuffer(imgEl);
    else imgEl.addEventListener("load", () => buildPixelBuffer(imgEl));
  });

  let hoveredEl = null;
  let offFrames = 0;
  let forcedHoverEl = null;

  scene.addEventListener("mousemove", (e) => {
    if (forcedHoverEl) return;
    if (document.body.classList.contains('cursor-closed')) return;

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
    if (window.__setCursor && !document.body.classList.contains('cursor-closed')) {
      window.__setCursor('cursor-open');
    }
  });

  scene.addEventListener("click", (e) => {
    const hitEl = topmostRobotHit(e.clientX, e.clientY);
    if (!hitEl) return;

    if (window.__setCursor) window.__setCursor('cursor-closed');

    const id = hitEl.dataset.robot;
    window.location.href = `projects/${id}.html`;
  });

  window.__ROBOT_SCENE__ = {
    forceHoverRobot(idOrNull) {
      forcedHoverEl = idOrNull ? robots.find(r => r.dataset.robot === String(idOrNull)) : null;
      if (forcedHoverEl) {
        setHoverRobot(forcedHoverEl);
        if (window.__setCursor && !document.body.classList.contains('cursor-closed')) {
          window.__setCursor('cursor-mid');
        }
      } else {
        clearHoverAll();
        if (window.__setCursor && !document.body.classList.contains('cursor-closed')) {
          window.__setCursor('cursor-open');
        }
      }
    },
    clearForcedHover() {
      forcedHoverEl = null;
      clearHoverAll();
      if (window.__setCursor && !document.body.classList.contains('cursor-closed')) {
        window.__setCursor('cursor-open');
      }
    },
    hasHover() {
      return Boolean(forcedHoverEl || hoveredEl);
    }
  };
}

// ===== NAV WIRING =====
window.initNav = function initNav() {
  // dropdown items (projects list)
  const items = $all(".dropdown-item");

  items.forEach((item) => {
    item.addEventListener("mouseenter", () => {
      const id = item.dataset.robot;
      if (window.__ROBOT_SCENE__) {
        window.__ROBOT_SCENE__.forceHoverRobot(id);
      }
      if (window.__setCursor && !document.body.classList.contains('cursor-closed')) {
        window.__setCursor('cursor-mid');
      }
    });

    item.addEventListener("mouseleave", () => {
      if (window.__ROBOT_SCENE__) {
        window.__ROBOT_SCENE__.clearForcedHover();
      }
      if (window.__setCursor && !document.body.classList.contains('cursor-closed')) {
        window.__setCursor('cursor-open');
      }
    });

    item.addEventListener("click", (e) => {
      const href = item.dataset.href || item.getAttribute("href");
      if (href && href !== "#") window.location.href = href;
      e.preventDefault();
    });
  });

  // TOP NAV hover (Name/About buttons, icons, dropdown button itself)
  const navHoverTargets = $all(".nav-control, .icon-link, .dropdown-btn");
  navHoverTargets.forEach((el) => {
    el.addEventListener("mouseenter", () => {
      if (window.__setCursor && !document.body.classList.contains('cursor-closed')) {
        window.__setCursor('cursor-mid');
      }
    });
    el.addEventListener("mouseleave", () => {
      if (window.__setCursor && !document.body.classList.contains('cursor-closed')) {
        // If robot hover is active, keep MID, else OPEN
        if (window.__ROBOT_SCENE__ && window.__ROBOT_SCENE__.hasHover()) window.__setCursor('cursor-mid');
        else window.__setCursor('cursor-open');
      }
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

  // don't duplicate the drawer if it already exists
  if (document.querySelector(".mobile-drawer")) return;

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

// ===== GLOBAL CURSOR MANAGER (ROBUST: NO "STUCK CLOSED") =====
(function () {
  const CUR_OPEN = 'cursor-open';
  const CUR_MID = 'cursor-mid';
  const CUR_CLOSED = 'cursor-closed';

  let isDown = false;
  let activePointerId = null;

  function setCursor(name) {
    document.body.classList.remove(CUR_OPEN, CUR_MID, CUR_CLOSED);
    if (name) document.body.classList.add(name);
  }
  window.__setCursor = setCursor;

  const MID_HOVER_SELECTOR =
    ".nav-control, .icon-link, .dropdown-btn, .dropdown-item, a, button";

  function isMidHoverTarget(el) {
    return !!el && !!el.closest(MID_HOVER_SELECTOR);
  }

  function robotHoverActive() {
    return !!(window.__ROBOT_SCENE__ &&
              typeof window.__ROBOT_SCENE__.hasHover === 'function' &&
              window.__ROBOT_SCENE__.hasHover());
  }

  function refreshFromHover(clientX, clientY) {
    if (isDown) return; // don't override closed while down

    if (robotHoverActive()) {
      setCursor(CUR_MID);
      return;
    }

    // use elementFromPoint when we have coords; fallback to activeElement otherwise
    let el = null;
    if (typeof clientX === "number" && typeof clientY === "number") {
      el = document.elementFromPoint(clientX, clientY);
    } else {
      el = document.activeElement;
    }

    if (isMidHoverTarget(el)) setCursor(CUR_MID);
    else setCursor(CUR_OPEN);
  }

  // Start in a known state
  setCursor(CUR_OPEN);

  // Pointer move: set open/mid
  window.addEventListener("pointermove", (e) => {
    refreshFromHover(e.clientX, e.clientY);
  }, { passive: true });

  // Pointer down: closed + capture pointer so we still get the up/cancel
  window.addEventListener("pointerdown", (e) => {
    // only track primary button/touch
    if (e.button !== undefined && e.button !== 0) return;

    isDown = true;
    activePointerId = e.pointerId;

    // capture ensures we receive pointerup even if you drag off elements
    try { e.target.setPointerCapture?.(e.pointerId); } catch {}

    setCursor(CUR_CLOSED);
  });

  function releasePointer(e) {
    if (activePointerId !== null && e && e.pointerId !== undefined && e.pointerId !== activePointerId) {
      return; // ignore other pointers
    }
    isDown = false;
    activePointerId = null;

    // decide final state based on where we released
    if (e) refreshFromHover(e.clientX, e.clientY);
    else setCursor(CUR_OPEN);
  }

  // Pointer up / cancel: always release
  window.addEventListener("pointerup", releasePointer);
  window.addEventListener("pointercancel", releasePointer);

  // If the pointer leaves the window or tab loses focus, force reset
  window.addEventListener("blur", () => releasePointer(null));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releasePointer(null);
  });

  // Some browsers fire mouseleave on window when exiting viewport
  window.addEventListener("mouseleave", () => {
    // if you were holding down and left the window, don't get stuck
    if (isDown) releasePointer(null);
  });
})();
// ===== ABOUT OVERLAY (robust: works with injected nav) =====
(function () {
  function initAboutOverlay() {
    const overlay = document.getElementById("aboutOverlay");
    const sheet = overlay ? overlay.querySelector(".about-sheet") : null;

    // Only exists on index.html
    if (!overlay || !sheet) return;

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
        if (location.hash === "#about") history.replaceState(null, "", location.pathname);
      } else {
        openAbout();
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

    // IMPORTANT: nav is injected, so use event delegation
    document.addEventListener("click", (e) => {
  const btn =
    e.target.closest("#aboutNavBtn") ||
    e.target.closest("[data-about-link]") ||
    e.target.closest('a[href$="#about"], a[href*="/#about"]');

  if (!btn) return;

  // only intercept if overlay exists on THIS page (index.html)
  const overlay = document.getElementById("aboutOverlay");
  const sheet = overlay ? overlay.querySelector(".about-sheet") : null;
  if (!overlay || !sheet) return; // <-- IMPORTANT: allow normal navigation on other pages

  e.preventDefault();

  // ✅ OPEN (don't toggle) and update hash like a real link
  overlay.classList.add("is-open");
  overlay.setAttribute("aria-hidden", "false");
  if (location.hash !== "#about") location.hash = "#about";
});


    syncFromHash();
    window.addEventListener("hashchange", syncFromHash);
  }

  document.addEventListener("DOMContentLoaded", initAboutOverlay);
  window.addEventListener("nav:loaded", initAboutOverlay);
})();


document.addEventListener("DOMContentLoaded", () => {
  const loader = document.getElementById("loader");
  if (!loader) return;

  const nav = performance.getEntriesByType("navigation")[0];
  const navType = nav ? nav.type : "navigate"; // "navigate" | "reload" | "back_forward"

  const alreadyShown = sessionStorage.getItem("bootShown") === "1";
  const isBackForward = navType === "back_forward";

  // If coming from back button OR already saw it this session → skip
  if (isBackForward || alreadyShown) {
    loader.remove();
    document.body.classList.remove("lights-off", "lights-dim", "lights-on");
    document.body.classList.add("ambient-light");
    return;
  }

  // mark as shown for this tab/session
  sessionStorage.setItem("bootShown", "1");

  const cmdWin = loader.querySelector(".cmd");
  const bodyEl = document.getElementById("terminalBody");
  const typedEl = document.getElementById("typedNow");

  // ===== TIMING (tweak these) =====
  const POP_IN_DELAY = 500;      // blank screen time before cmd appears
  const AFTER_DONE_DELAY = 450;  // pause after "DONE" before fade
  const FADE_MS = 550;           // must match CSS transition on #loader

  // typing feel
  const CHAR_MS = 100;            // 28–40 = readable
  const CHAR_JITTER = 16;
  const PAUSE_AFTER_CMD = 180;
  const PAUSE_BETWEEN_LINES = 500;
  const WAIT_AFTER_WINDOW = 2000;
  const TERMINAL_REMOVE_DELAY = 500; // after DONE, remove terminal
  const DIM_REVEAL_MS = 1400;        // 1000–2000 (1–2 sec)


  const PROMPT = `C:\\ROBOT_ROOM>`;

  const cmd = "room initialize";
  const out = [
    "Boot sequence: ROBOT_ROOM",
    "Allocating scene graph ............. OK",
    "Loading room texture ............... OK",
    "Loading robot layers ............... OK",
    "Building hover hitmaps ............. OK",
    "Warming shaders .................... OK",
    "Syncing input pipeline ............. OK",
    "DONE."
  ];

 const liveLine = document.getElementById("liveLine");

function addLine(text = "") {
  if (!bodyEl) return;

  const div = document.createElement("div");
  div.className = "cmd-line";
  div.textContent = text;

  // Insert ABOVE the live line so the live prompt stays at the bottom
  if (liveLine && liveLine.parentNode) {
    liveLine.parentNode.insertBefore(div, liveLine);
  } else {
    bodyEl.appendChild(div);
  }

  // Trim ONLY printed lines inside #terminalBody (live line is not in there)
  while (bodyEl.children.length > 12) {
    bodyEl.removeChild(bodyEl.firstChild);
  }
}


  const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function typeIntoPrompt(text) {
  if (!typedEl) return;

  typedEl.textContent = "";

  for (let i = 0; i < text.length; i++) {
    typedEl.textContent += text[i];
    await sleep(CHAR_MS + Math.floor(Math.random() * CHAR_JITTER));
  }
}


  async function run() {
  // START: lights fully off
  document.body.classList.add("lights-off");
  document.body.classList.remove("lights-dim", "lights-on", "ambient-light");

  // 1) blank screen beat
  await sleep(POP_IN_DELAY);

  // Move from OFF → DIM (still dark, but readable shapes)
  document.body.classList.remove("lights-off");
  document.body.classList.add("lights-dim");

  // 2) pop window in
  if (cmdWin) cmdWin.classList.remove("cmd--hidden");
  await sleep(WAIT_AFTER_WINDOW);

  // 3) type command
  await typeIntoPrompt(cmd);
  await sleep(40);
  await sleep(PAUSE_AFTER_CMD);

  // 4) output lines
  for (const line of out) {
    addLine(line);
    await sleep(PAUSE_BETWEEN_LINES);
  }

  // After printing all output lines:
await sleep(AFTER_DONE_DELAY);

// 1) Wait 500ms then remove ONLY the terminal window
await sleep(TERMINAL_REMOVE_DELAY);
if (cmdWin) cmdWin.remove();

// 2) Reveal the room faintly for 1–2 seconds
document.body.classList.remove("lights-off");
document.body.classList.add("lights-dim");
loader.classList.add("see-through");

await sleep(DIM_REVEAL_MS);

// 3) Flicker lights ON
document.body.classList.remove("lights-dim");
document.body.classList.add("lights-on");
loader.classList.remove("see-through");

// Optional: start ambient loop after flicker finishes
setTimeout(() => {
  document.body.classList.add("ambient-light");
}, 1300);

// 4) Fade out loader overlay
loader.classList.add("hidden");
setTimeout(() => loader.remove(), FADE_MS + 50);

}


  run();

  // failsafe: never stuck (in case something errors)
  setTimeout(() => {
    if (!loader.classList.contains("hidden")) {
      loader.classList.add("hidden");
      setTimeout(() => loader.remove(), FADE_MS + 50);
    }
  }, 15000);
});



window.addEventListener("nav:loaded", () => {
  initMobileDrawer();
  if (typeof window.initNav === "function") window.initNav();
});


// ===== BOOTSTRAP =====
function bootInteractive() {
  // robots hover/click
  safeInit();

  // nav interactions (if nav is already present)
  initMobileDrawer();
  if (typeof window.initNav === "function") window.initNav();
}

document.addEventListener("DOMContentLoaded", bootInteractive);
window.addEventListener("nav:loaded", bootInteractive);
