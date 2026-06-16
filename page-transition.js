(() => {
  const transitionMs = 520;
  const selector = 'a[href]:not([target="_blank"])';
  const ignoredProtocols = ["mailto:", "tel:", "javascript:"];

  const style = document.createElement("style");
  style.textContent = `
    .page-transition {
      position: fixed;
      inset: 0;
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
      background:
        radial-gradient(circle at 50% 44%, rgba(201, 169, 110, 0.16), transparent 34%),
        #1a1208;
      color: #faf7f2;
      opacity: 1;
      pointer-events: none;
      transition: opacity ${transitionMs}ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    .page-transition.is-hidden {
      opacity: 0;
    }
    .page-transition.is-active {
      opacity: 1;
      pointer-events: all;
    }
    .page-transition__mark {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
      transform: translateY(6px);
      opacity: 0;
      transition:
        opacity 360ms cubic-bezier(0.25, 0.46, 0.45, 0.94),
        transform 360ms cubic-bezier(0.25, 0.46, 0.45, 0.94);
    }
    .page-transition.is-active .page-transition__mark,
    .page-transition:not(.is-hidden) .page-transition__mark {
      opacity: 1;
      transform: translateY(0);
    }
    .page-transition__logo {
      font-family: "DM Serif Display", serif;
      font-size: clamp(2rem, 5vw, 3.2rem);
      letter-spacing: 0.06em;
      color: #faf7f2;
    }
    .page-transition__line {
      width: 96px;
      height: 1px;
      overflow: hidden;
      background: rgba(250, 247, 242, 0.16);
      position: relative;
    }
    .page-transition__line::after {
      content: "";
      position: absolute;
      inset: 0;
      background: #c9a96e;
      transform: translateX(-100%);
      animation: pageTransitionLine 900ms cubic-bezier(0.25, 0.46, 0.45, 0.94) infinite;
    }
    @keyframes pageTransitionLine {
      to { transform: translateX(100%); }
    }
    @media (prefers-reduced-motion: reduce) {
      .page-transition {
        display: none;
      }
    }
  `;

  const overlay = document.createElement("div");
  overlay.className = "page-transition";
  overlay.setAttribute("aria-hidden", "true");
  overlay.innerHTML = `
    <div class="page-transition__mark">
      <div class="page-transition__logo">Labocata.</div>
      <div class="page-transition__line"></div>
    </div>
  `;

  function isInternalPageLink(anchor) {
    const href = anchor.getAttribute("href");
    if (!href || href.startsWith("#")) return false;
    if (ignoredProtocols.some((protocol) => href.startsWith(protocol))) return false;
    if (anchor.hasAttribute("download")) return false;

    const url = new URL(anchor.href, window.location.href);
    if (url.origin !== window.location.origin) return false;
    if (url.pathname === window.location.pathname) return false;
    return url.pathname.endsWith(".html") || url.protocol === "file:";
  }

  function showThenNavigate(event) {
    if (event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

    const anchor = event.target.closest(selector);
    if (!anchor || !isInternalPageLink(anchor)) return;

    event.preventDefault();
    overlay.classList.remove("is-hidden");
    overlay.classList.add("is-active");
    setTimeout(() => {
      window.location.href = anchor.href;
    }, transitionMs);
  }

  window.addEventListener("DOMContentLoaded", () => {
    document.head.appendChild(style);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add("is-hidden"));
    document.addEventListener("click", showThenNavigate);
  });

  window.addEventListener("pageshow", () => {
    overlay.classList.add("is-hidden");
    overlay.classList.remove("is-active");
  });
})();
