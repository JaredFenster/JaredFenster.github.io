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

window.initNav = function initNav() {
  // dropdown items hover/click (projects list)
  const bindDropdownItems = () => {
    const items = $all(".dropdown-item");
    items.forEach((item) => {
      if (item.dataset.bound === "1") return;
      item.dataset.bound = "1";

      item.addEventListener("mouseenter", () => {
        const id = item.dataset.robot;
        if (window.__ROBOT_SCENE__) window.__ROBOT_SCENE__.forceHoverRobot(id);
        if (window.__setCursor && !document.body.classList.contains("cursor-closed")) {
          window.__setCursor("cursor-mid");
        }
      });

      item.addEventListener("mouseleave", () => {
        if (window.__ROBOT_SCENE__) window.__ROBOT_SCENE__.clearForcedHover();
        if (window.__setCursor && !document.body.classList.contains("cursor-closed")) {
          window.__setCursor("cursor-open");
        }
      });

      item.addEventListener("click", (e) => {
        const href = item.dataset.href || item.getAttribute("href");
        if (href && href !== "#") window.location.href = href;
        e.preventDefault();
      });
    });
  };

  // TOP NAV hover cursor handling
  const navHoverTargets = $all(".nav-control, .icon-link, .dropdown-btn");
  navHoverTargets.forEach((el) => {
    if (el.dataset.boundHover === "1") return;
    el.dataset.boundHover = "1";

    el.addEventListener("mouseenter", () => {
      if (window.__setCursor && !document.body.classList.contains("cursor-closed")) {
        window.__setCursor("cursor-mid");
      }
    });

    el.addEventListener("mouseleave", () => {
      if (window.__setCursor && !document.body.classList.contains("cursor-closed")) {
        if (window.__ROBOT_SCENE__ && window.__ROBOT_SCENE__.hasHover()) window.__setCursor("cursor-mid");
        else window.__setCursor("cursor-open");
      }
    });
  });

  // ===== Projects dropdown: robust (creates if missing), portals to body for real blur =====
  const dropdownButton = document.getElementById("projectsButton");
  if (!dropdownButton) return;

  let dropdownPortal = document.getElementById("projectsDropdown");

  // If the dropdown markup isn't in the DOM, create it.
  if (!dropdownPortal) {
    dropdownPortal = document.createElement("div");
    dropdownPortal.id = "projectsDropdown";
    dropdownPortal.className = "projects-dropdown";
    dropdownPortal.setAttribute("aria-label", "Projects");

    dropdownPortal.innerHTML = `
      <div class="projects-hover-bridge" aria-hidden="true"></div>
      <div class="projects-dropdown-menu" role="menu" aria-label="Projects">
        <div class="dropdown-prompt">C:\\PROJECTS&gt;</div>

        <a class="dropdown-item" href="/projects/precision-arm.html" data-robot="precision-arm">
          <div class="title">Precision Robotic Arm</div>
          <div class="sub">Most Recent Project</div>
        </a>

        <a class="dropdown-item" href="/projects/b2emo.html" data-robot="b2emo">
          <div class="title">B2EMO</div>
          <div class="sub">Star Wars Replica</div>
        </a>

        <a class="dropdown-item" href="/projects/harmonic-drive.html" data-robot="harmonic-drive">
          <div class="title">Harmonic Drive</div>
          <div class="sub">High Torque Harmonic Drive</div>
        </a>

        <a class="dropdown-item" href="/projects/vision-arm.html" data-robot="vision-arm">
          <div class="title">Vision Arm</div>
          <div class="sub">Robot Arm with Camera</div>
        </a>

        <a class="dropdown-item" href="/projects/omni.html" data-robot="omni">
          <div class="title">Omnidirectional Robot</div>
          <div class="sub">RC Mechanum Wheels</div>
        </a>

        <a class="dropdown-item" href="/projects/controller.html" data-robot="controller">
          <div class="title">Controller</div>
          <div class="sub">Universal Robot Controller</div>
        </a>

        <a class="dropdown-item" href="/projects/car.html" data-robot="car">
          <div class="title">RC Car</div>
          <div class="sub">Simple RC Car</div>
        </a>

        <a class="dropdown-item" href="/projects/vertical-launcher.html" data-robot="vertical-launcher">
          <div class="title">Vertical Launcher</div>
          <div class="sub">Phyisics Demo</div>
        </a>
      </div>
    `;
  }

  const menu = dropdownPortal.querySelector(".projects-dropdown-menu");
  if (!menu) return;

  // Ensure bridge exists even if markup came from HTML
  let bridge = dropdownPortal.querySelector(".projects-hover-bridge");
  if (!bridge) {
    bridge = document.createElement("div");
    bridge.className = "projects-hover-bridge";
    bridge.setAttribute("aria-hidden", "true");
    dropdownPortal.insertBefore(bridge, menu);
  }

  // Init once
  if (dropdownPortal.dataset.portalInit === "1") {
    bindDropdownItems();
    return;
  }
  dropdownPortal.dataset.portalInit = "1";

  // Portal to body so blur samples the real scene
  if (dropdownPortal.parentElement !== document.body) document.body.appendChild(dropdownPortal);

  dropdownPortal.style.position = "fixed";
  dropdownPortal.style.left = "0px";
  dropdownPortal.style.top = "0px";
  dropdownPortal.style.zIndex = "5000";
  dropdownPortal.style.pointerEvents = "none";

  let closeT = null;

  const GAP_PX = 22; // your current gap

  const syncBridgeSize = () => {
    const w = menu.getBoundingClientRect().width || 280;
    bridge.style.position = "absolute";
    bridge.style.left = "0px";
    bridge.style.top = "0px";
    bridge.style.width = `${w}px`;
    bridge.style.height = `${GAP_PX}px`;
    bridge.style.background = "transparent";
    bridge.style.pointerEvents = "auto";
  };

  const position = () => {
    const r = dropdownButton.getBoundingClientRect();

    // Anchor portal at the button bottom (NOT after the gap)
    dropdownPortal.style.left = `${r.left}px`;
    dropdownPortal.style.top = `${r.bottom}px`;

    // Push the menu down by the gap
    menu.style.left = "0px";
    menu.style.top = `${GAP_PX}px`;

    // Bridge fills the exact gap between button and menu
    syncBridgeSize();
  };

  const open = () => {
    clearTimeout(closeT);
    position();
    dropdownPortal.classList.add("is-open");
    dropdownPortal.style.pointerEvents = "auto";
    dropdownButton.setAttribute("aria-expanded", "true");

    // ensure correct width after paint
    requestAnimationFrame(() => {
      syncBridgeSize();
    });
  };

  const close = () => {
    clearTimeout(closeT);
    closeT = setTimeout(() => {
      dropdownPortal.classList.remove("is-open");
      dropdownPortal.style.pointerEvents = "none";
      dropdownButton.setAttribute("aria-expanded", "false");
    }, 140);
  };

  dropdownButton.addEventListener("mouseenter", open);
  dropdownButton.addEventListener("mouseleave", close);
  dropdownPortal.addEventListener("mouseenter", open);
  dropdownPortal.addEventListener("mouseleave", close);

  dropdownButton.addEventListener("focus", open);
  dropdownButton.addEventListener("blur", close);

  window.addEventListener("resize", position, { passive: true });
  window.addEventListener("scroll", position, { passive: true });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      dropdownPortal.classList.remove("is-open");
      dropdownPortal.style.pointerEvents = "none";
      dropdownButton.setAttribute("aria-expanded", "false");
    }
  });

  bindDropdownItems();
  position();
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
    if (isDown) return;

    if (robotHoverActive()) {
      setCursor(CUR_MID);
      return;
    }

    let el = null;
    if (typeof clientX === "number" && typeof clientY === "number") {
      el = document.elementFromPoint(clientX, clientY);
    } else {
      el = document.activeElement;
    }

    if (isMidHoverTarget(el)) setCursor(CUR_MID);
    else setCursor(CUR_OPEN);
  }

  setCursor(CUR_OPEN);

  window.addEventListener("pointermove", (e) => {
    refreshFromHover(e.clientX, e.clientY);
  }, { passive: true });

  window.addEventListener("pointerdown", (e) => {
    if (e.button !== undefined && e.button !== 0) return;

    isDown = true;
    activePointerId = e.pointerId;

    try { e.target.setPointerCapture?.(e.pointerId); } catch {}

    setCursor(CUR_CLOSED);
  });

  function releasePointer(e) {
    if (activePointerId !== null && e && e.pointerId !== undefined && e.pointerId !== activePointerId) {
      return;
    }
    isDown = false;
    activePointerId = null;

    if (e) refreshFromHover(e.clientX, e.clientY);
    else setCursor(CUR_OPEN);
  }

  window.addEventListener("pointerup", releasePointer);
  window.addEventListener("pointercancel", releasePointer);

  window.addEventListener("blur", () => releasePointer(null));
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) releasePointer(null);
  });

  window.addEventListener("mouseleave", () => {
    if (isDown) releasePointer(null);
  });
})();

// ===== ABOUT OVERLAY (robust: works with injected nav) =====
(function () {
  function initAboutOverlay() {
    const overlay = document.getElementById("aboutOverlay");
    const sheet = overlay ? overlay.querySelector(".about-sheet") : null;

    if (!overlay || !sheet) return;

    function openAbout() {
      overlay.classList.add("is-open");
      overlay.setAttribute("aria-hidden", "false");
    }

    function closeAbout() {
      overlay.classList.remove("is-open");
      overlay.setAttribute("aria-hidden", "true");
    }

    function syncFromHash() {
      if (location.hash === "#about") openAbout();
      else closeAbout();
    }

    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeAbout();
        if (location.hash === "#about") history.replaceState(null, "", location.pathname);
      }
    });

    sheet.addEventListener("click", (e) => e.stopPropagation());

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        closeAbout();
        if (location.hash === "#about") history.replaceState(null, "", location.pathname);
      }
    });

    document.addEventListener("click", (e) => {
      const btn =
        e.target.closest("#aboutNavBtn") ||
        e.target.closest("[data-about-link]") ||
        e.target.closest('a[href$="#about"], a[href*="/#about"]');

      if (!btn) return;

      const overlay = document.getElementById("aboutOverlay");
      const sheet = overlay ? overlay.querySelector(".about-sheet") : null;
      if (!overlay || !sheet) return;

      e.preventDefault();

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
  const navType = nav ? nav.type : "navigate";

  const alreadyShown = sessionStorage.getItem("bootShown") === "1";
  const isBackForward = navType === "back_forward";

  if (isBackForward || alreadyShown) {
    loader.remove();
    document.body.classList.remove("lights-off", "lights-dim", "lights-on");
    document.body.classList.add("ambient-light");
    return;
  }

  sessionStorage.setItem("bootShown", "1");

  const cmdWin = loader.querySelector(".cmd");
  const bodyEl = document.getElementById("terminalBody");
  const typedEl = document.getElementById("typedNow");

  const POP_IN_DELAY = 500;
  const AFTER_DONE_DELAY = 450;
  const FADE_MS = 550;

  const CHAR_MS = 100;
  const CHAR_JITTER = 16;
  const PAUSE_AFTER_CMD = 180;
  const PAUSE_BETWEEN_LINES = 300;
  const WAIT_AFTER_WINDOW = 2000;
  const TERMINAL_REMOVE_DELAY = 500;
  const DIM_REVEAL_MS = 1400;

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

    if (liveLine && liveLine.parentNode) {
      liveLine.parentNode.insertBefore(div, liveLine);
    } else {
      bodyEl.appendChild(div);
    }

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
    document.body.classList.add("lights-off");
    document.body.classList.remove("lights-dim", "lights-on", "ambient-light");

    await sleep(POP_IN_DELAY);

    document.body.classList.remove("lights-off");
    document.body.classList.add("lights-dim");

    if (cmdWin) cmdWin.classList.remove("cmd--hidden");
    await sleep(WAIT_AFTER_WINDOW);

    await typeIntoPrompt(cmd);
    await sleep(40);
    await sleep(PAUSE_AFTER_CMD);

    for (const line of out) {
      addLine(line);
      await sleep(PAUSE_BETWEEN_LINES);
    }

    await sleep(AFTER_DONE_DELAY);

    await sleep(TERMINAL_REMOVE_DELAY);
    if (cmdWin) cmdWin.remove();

    document.body.classList.remove("lights-off");
    document.body.classList.add("lights-dim");
    loader.classList.add("see-through");

    await sleep(DIM_REVEAL_MS);

    document.body.classList.remove("lights-dim");
    document.body.classList.add("lights-on");
    loader.classList.remove("see-through");

    setTimeout(() => {
      document.body.classList.add("ambient-light");
    }, 1300);

    loader.classList.add("hidden");
    setTimeout(() => loader.remove(), FADE_MS + 50);
  }

  run();

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
  safeInit();
  initMobileDrawer();
  if (typeof window.initNav === "function") window.initNav();
}

document.addEventListener("DOMContentLoaded", bootInteractive);
window.addEventListener("nav:loaded", bootInteractive);

// Terminal-style typing + cascading bullets (on scroll)
document.addEventListener("DOMContentLoaded", () => {
  const sections = document.querySelectorAll(".project-section");

  if (!("IntersectionObserver" in window)) return;

  const observer = new IntersectionObserver(
    (entries, obs) => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;

        const section = entry.target;
        const heading = section.querySelector(".project-text h2");
        const bullets = section.querySelectorAll(".project-text li");

        if (!heading) {
          obs.unobserve(section);
          return;
        }

        heading.classList.add("is-typing");

        const TYPE_DURATION = 900;
        const BULLET_DELAY = 140;

        setTimeout(() => {
          bullets.forEach((li, i) => {
            setTimeout(() => {
              li.classList.add("is-visible");
            }, i * BULLET_DELAY);
          });
        }, TYPE_DURATION + 120);

        obs.unobserve(section);
      });
    },
    {
      threshold: 0.55,
      rootMargin: "0px 0px -10% 0px"
    }
  );

  sections.forEach(section => observer.observe(section));
});
