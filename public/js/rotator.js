document.addEventListener("DOMContentLoaded", function () {
    const rotator = document.getElementById("stat-rotator");
    if (!rotator) return;

    const slides = Array.from(rotator.querySelectorAll("[data-slide]"));
    const dots   = Array.from(rotator.querySelectorAll("[data-dot]"));
    if (!slides.length || slides.length !== dots.length) return;

    let i = 0;
    let timer = null;

    function render() {
      slides.forEach((el, idx) => {
        if (idx === i) el.classList.remove("hidden");
        else el.classList.add("hidden");
      });

      dots.forEach((dot, idx) => {
        // active dot: wider and darker
        if (idx === i) {
          dot.classList.add("w-3");
          dot.classList.remove("w-1.5");
          dot.classList.remove("bg-gray-300");
          dot.classList.add("bg-gray-900/70");
        } else {
          dot.classList.remove("w-3");
          dot.classList.add("w-1.5");
          dot.classList.remove("bg-gray-900/70");
          dot.classList.add("bg-gray-300");
        }
      });
    }

    function next() {
      i = (i + 1) % slides.length;
      render();
    }

    function start() {
      stop();
      timer = setInterval(next, 3500); // 3.5s feels smooth
    }

    function stop() {
      if (timer) clearInterval(timer);
      timer = null;
    }

    // make dots clickable
    dots.forEach((dot, idx) => {
      dot.style.cursor = "pointer";
      dot.addEventListener("click", () => {
        i = idx;
        render();
        start();
      });
    });

    // ensure first render matches your initial classes
    // your first slide is visible, others have "hidden", this will sync dots too
    // if not, force i = 0 and render
    render();
    start();
  });