// Nav scroll
const nav = document.getElementById("nav");
window.addEventListener("scroll", () => {
  nav.classList.toggle("scrolled", window.scrollY > 60);
});

// â€”â€”â€” FULLSCREEN MENU â€”â€”â€”
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

// â€”â€”â€” TESTIMONIALS CAROUSEL â€”â€”â€”
const testiTrack = document.getElementById("testiTrack");
const testiCards = [...document.querySelectorAll(".testi-track > .testimonial-card")];
const testiItems = testiCards.flatMap((card) => [
  ...card.querySelectorAll(".testi-item"),
]);
const testiDotsWrap = document.querySelector(".testi-dots");
const testiMobileQuery = window.matchMedia("(max-width: 768px)");
let testiDots = [];
let testiCurrent = 0;
let testiPaused = false;

function getTestiTotal() {
  return testiMobileQuery.matches ? testiItems.length : testiCards.length;
}

function getTestiCardIndex() {
  if (!testiMobileQuery.matches) return testiCurrent;
  return testiCards.findIndex((card) => card.contains(testiItems[testiCurrent]));
}

function renderTestiDots() {
  const total = getTestiTotal();
  testiDotsWrap.innerHTML = Array.from(
    { length: total },
    (_, i) => `<button class="testi-dot" data-slide="${i}" aria-label="Reseña ${i + 1}"></button>`,
  ).join("");
  testiDots = [...testiDotsWrap.querySelectorAll(".testi-dot")];
  testiDots.forEach((dot) => {
    dot.addEventListener("click", () => goToSlide(+dot.dataset.slide));
  });
}

function updateMobileTestiItem() {
  testiItems.forEach((item) => item.classList.remove("is-mobile-active"));
  if (testiMobileQuery.matches && testiItems[testiCurrent]) {
    testiItems[testiCurrent].classList.add("is-mobile-active");
  }
}

function goToSlide(idx) {
  const total = getTestiTotal();
  testiCurrent = (idx + total) % total;
  testiTrack.style.transform = `translateX(-${getTestiCardIndex() * 100}%)`;
  updateMobileTestiItem();
  testiDots.forEach((d, i) => d.classList.toggle("active", i === testiCurrent));
}

function resetTestiCarousel() {
  testiCurrent = 0;
  renderTestiDots();
  goToSlide(0);
}

document
  .getElementById("testiBtnNext")
  .addEventListener("click", () => goToSlide(testiCurrent + 1));
document
  .getElementById("testiBtnPrev")
  .addEventListener("click", () => goToSlide(testiCurrent - 1));
testiMobileQuery.addEventListener("change", resetTestiCarousel);
resetTestiCarousel();
// Pause on hover
const testiSection = document.querySelector(".testimonials");
testiSection.addEventListener("mouseenter", () => (testiPaused = true));
testiSection.addEventListener("mouseleave", () => (testiPaused = false));

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

