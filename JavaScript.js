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
const testiTrack = document.getElementById("testiTrack");
const testiDots = document.querySelectorAll(".testi-dot");
let testiCurrent = 0;
let testiPaused = false;

// En móvil (≤900px) los items son los 6 testi-item individuales.
// En desktop los slides son los 2 testimonial-card.
function isMobile() {
  return window.innerWidth <= 900;
}

function getSlides() {
  return isMobile()
    ? Array.from(document.querySelectorAll(".testi-item"))
    : Array.from(document.querySelectorAll(".testi-track > .testimonial-card"));
}

function goToSlide(idx) {
  const slides = getSlides();
  const total = slides.length;
  testiCurrent = (idx + total) % total;

  if (isMobile()) {
    // scroll-snap: desplazamos el contenedor
    const wrap = document.querySelector(".testi-carousel-wrap");
    const itemW = slides[0].offsetWidth + 12; // width + margin-right
    wrap.scrollTo({ left: testiCurrent * itemW, behavior: "smooth" });
  } else {
    // desktop: translateX por slides de 100%
    // Los dots solo van de 0-1 en desktop (2 slides)
    const slideIdx = testiCurrent % 2;
    testiTrack.style.transform = `translateX(-${slideIdx * 100}%)`;
  }

  // Dots: en desktop son 2, en móvil son 6 — regenerar si cambia el modo
  testiDots.forEach((d, i) => d.classList.toggle("active", i === testiCurrent));
}

document
  .getElementById("testiBtnNext")
  .addEventListener("click", () => goToSlide(testiCurrent + 1));
document
  .getElementById("testiBtnPrev")
  .addEventListener("click", () => goToSlide(testiCurrent - 1));
testiDots.forEach((dot) => {
  dot.addEventListener("click", () => goToSlide(+dot.dataset.slide));
});

// Pause on hover / touch
const testiSection = document.querySelector(".testimonials");
testiSection.addEventListener("mouseenter", () => (testiPaused = true));
testiSection.addEventListener("mouseleave", () => (testiPaused = false));
testiSection.addEventListener("touchstart", () => (testiPaused = true), { passive: true });

// Auto-advance every 10s
setInterval(() => {
  if (!testiPaused) goToSlide(testiCurrent + 1);
}, 10000);

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
