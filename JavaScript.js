// Nav scroll
const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 60);
});

// ——— FULLSCREEN MENU ———
const burger = document.getElementById("navBurger");
let menuOpen = false;

function openMenu() {
  menuOpen = true;
  document.body.classList.add("nav-menu-open");
  nav.classList.add("nav-menu-open");
  document.body.style.overflow = "hidden";
}
function closeMenu() {
  menuOpen = false;
  document.body.classList.remove("nav-menu-open");
  nav.classList.remove("nav-menu-open");
  document.body.classList.add("nav-menu-closing");
  nav.classList.add("nav-menu-closing");
  setTimeout(() => {
    document.body.classList.remove("nav-menu-closing");
    nav.classList.remove("nav-menu-closing");
    document.body.style.overflow = "";
  }, 700);
}

burger.addEventListener("click", () => {
  menuOpen ? closeMenu() : openMenu();
});

// Close on Escape
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && menuOpen) closeMenu();
});

// Image hover switching
const fmLinks = document.querySelectorAll(".fullmenu-link[data-img]");
const fmImages = document.querySelectorAll(".fullmenu-img");

fmLinks.forEach((link) => {
  link.addEventListener("mouseenter", () => {
    const target = link.getAttribute("data-img");
    fmImages.forEach((img) => {
      img.classList.toggle("visible", img.id === target);
    });
  });
});

// Sucursales hover interaction
const sucursalItems = document.querySelectorAll(".sucursal-item");
const sucursalSlides = document.querySelectorAll(".sucursal-img-slide");

function activateSucursal(index) {
  sucursalItems.forEach((el) => el.classList.remove("active"));
  sucursalSlides.forEach((el) => el.classList.remove("active"));
  const targetItem = document.querySelector(
    `.sucursal-item[data-index="${index}"]`,
  );
  const targetSlide = document.querySelector(
    `.sucursal-img-slide[data-index="${index}"]`,
  );
  if (targetItem) targetItem.classList.add("active");
  if (targetSlide) targetSlide.classList.add("active");
}

sucursalItems.forEach((item) => {
  item.addEventListener("mouseenter", () => {
    const idx = item.getAttribute("data-index");
    activateSucursal(idx);
  });
});

// ——— TESTIMONIALS CAROUSEL ———
(function () {
  const MOBILE_BP = 900;
  let testiCurrent = 0;
  let testiPaused = false;
  let testiTotal = 0;
  let autoTimer = null;

  // ── Elementos base (siempre existen en el HTML) ──
  const wrap      = document.querySelector(".testi-carousel-wrap");
  const track     = document.getElementById("testiTrack");
  const dotsWrap  = document.querySelector(".testi-dots");
  const btnPrev   = document.getElementById("testiBtnPrev");
  const btnNext   = document.getElementById("testiBtnNext");
  const section   = document.querySelector(".testimonials");

  // ── Recolectar los 6 testi-item originales ANTES de tocar el DOM ──
  const allItems = Array.from(document.querySelectorAll(".testi-item"));

  // ─────────────────────────────────────────────
  //  MOBILE: reconstruye el track como 6 slides
  // ─────────────────────────────────────────────
  function buildMobile() {
    // Vaciar track y poner los 6 items directo, cada uno como slide
    track.innerHTML = "";
    track.style.transition = "transform 0.55s cubic-bezier(0.76, 0, 0.24, 1)";
    track.style.display    = "flex";
    track.style.width      = "100%";

    allItems.forEach((item) => {
      // Wrapper individual de slide
      const slide = document.createElement("div");
      slide.className = "testi-slide-mobile";
      slide.style.cssText = [
        "min-width:100%",
        "box-sizing:border-box",
        "padding:0 20px 20px",
      ].join(";");
      slide.appendChild(item.cloneNode(true));
      track.appendChild(slide);
    });

    testiTotal = allItems.length; // 6

    // Dots: 6 puntos
    dotsWrap.innerHTML = "";
    for (let i = 0; i < testiTotal; i++) {
      const d = document.createElement("button");
      d.className  = "testi-dot" + (i === 0 ? " active" : "");
      d.dataset.slide = i;
      d.setAttribute("aria-label", `Review ${i + 1}`);
      d.addEventListener("click", () => goTo(i));
      dotsWrap.appendChild(d);
    }

    goTo(0);
  }

  // ─────────────────────────────────────────────
  //  DESKTOP: restaura los 2 testimonial-cards originales
  // ─────────────────────────────────────────────
  function buildDesktop() {
    // Reconstruir los 2 grupos originales
    track.innerHTML = "";
    track.style.cssText = "";

    const g1 = document.createElement("div");
    g1.className = "testimonial-card";
    const g2 = document.createElement("div");
    g2.className = "testimonial-card";

    allItems.forEach((item, i) => {
      (i < 3 ? g1 : g2).appendChild(item.cloneNode(true));
    });
    track.appendChild(g1);
    track.appendChild(g2);

    testiTotal = 2;

    // Dots: 2 puntos
    dotsWrap.innerHTML = "";
    for (let i = 0; i < testiTotal; i++) {
      const d = document.createElement("button");
      d.className = "testi-dot" + (i === 0 ? " active" : "");
      d.dataset.slide = i;
      d.setAttribute("aria-label", `Página ${i + 1}`);
      d.addEventListener("click", () => goTo(i));
      dotsWrap.appendChild(d);
    }

    goTo(0);
  }

  // ─────────────────────────────────────────────
  //  Navegar a un slide (funciona igual en ambos modos)
  // ─────────────────────────────────────────────
  function goTo(idx) {
    testiCurrent = ((idx % testiTotal) + testiTotal) % testiTotal;
    track.style.transform = `translateX(-${testiCurrent * 100}%)`;
    document
      .querySelectorAll(".testi-dot")
      .forEach((d, i) => d.classList.toggle("active", i === testiCurrent));
  }

  // ─────────────────────────────────────────────
  //  Arrancar según tamaño actual
  // ─────────────────────────────────────────────
  function init() {
    if (window.innerWidth <= MOBILE_BP) {
      buildMobile();
    } else {
      buildDesktop();
    }
    startAuto();
  }

  // ─────────────────────────────────────────────
  //  Botones ← →
  // ─────────────────────────────────────────────
  btnPrev.addEventListener("click", () => goTo(testiCurrent - 1));
  btnNext.addEventListener("click", () => goTo(testiCurrent + 1));

  // ─────────────────────────────────────────────
  //  Auto-avance cada 8 s
  // ─────────────────────────────────────────────
  function startAuto() {
    clearInterval(autoTimer);
    autoTimer = setInterval(() => {
      if (!testiPaused) goTo(testiCurrent + 1);
    }, 8000);
  }

  section.addEventListener("mouseenter",  () => (testiPaused = true));
  section.addEventListener("mouseleave",  () => (testiPaused = false));
  section.addEventListener("touchstart",  () => (testiPaused = true),  { passive: true });
  section.addEventListener("touchend",    () => (testiPaused = false), { passive: true });

  // ─────────────────────────────────────────────
  //  Resize: reconstruir si cruza el breakpoint
  // ─────────────────────────────────────────────
  let lastMode = window.innerWidth <= MOBILE_BP ? "mobile" : "desktop";
  window.addEventListener("resize", () => {
    const mode = window.innerWidth <= MOBILE_BP ? "mobile" : "desktop";
    if (mode !== lastMode) {
      lastMode = mode;
      testiCurrent = 0;
      init();
    }
  });

  init();
})();

const reveals = document.querySelectorAll(".reveal");
const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) e.target.classList.add("visible");
    });
  },
  { threshold: 0.15 },
);
reveals.forEach((el) => observer.observe(el));
