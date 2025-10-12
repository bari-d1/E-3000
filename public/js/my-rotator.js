document.addEventListener("DOMContentLoaded", function () {
    const slides = document.querySelectorAll("[data-slide-my]");
    const dots   = document.querySelectorAll("[data-dot-my]");
    if (!slides.length) return;
  
    let i = 0;
    function show(n) {
      slides.forEach((s, idx) => s.classList.toggle("hidden", idx !== n));
      dots.forEach((d, idx) => d.classList.toggle("bg-gray-900/70", idx === n));
      dots.forEach((d, idx) => d.classList.toggle("bg-gray-300", idx !== n));
    }
    show(i);
    setInterval(() => {
      i = (i + 1) % slides.length;
      show(i);
    }, 3000);
  });
  