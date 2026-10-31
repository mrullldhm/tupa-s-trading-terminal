// Browser-only chart boot. The chart library (about 57 KB gzipped) is fetched only when a chart is about to scroll
// into view, so pages without a visible chart never download it.
function mark(el: HTMLElement, state: "loading" | "ready" | "error") {
  el.dataset.chartState = state;
}

function boot() {
  const pending = document.querySelectorAll<HTMLElement>("[data-chart]");
  if (!pending.length) return;
  let lib: Promise<typeof import("./charts.render")> | null = null;
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        io.unobserve(e.target);
        const el = e.target as HTMLElement;
        mark(el, "loading");
        lib ??= import("./charts.render");
        lib
          .then((m) => {
            if (el.dataset.chart === "annotated") m.annotated(el);
            if (el.dataset.chart === "curves") m.curves(el);
            mark(el, "ready");
          })
          .catch((err) => {
            // The text around every chart (steps, captions, the numbers table) still carries the content.
            mark(el, "error");
            lib = null;
            console.error("chart failed to load", err);
          });
      }
    },
    { rootMargin: "300px" },
  );
  pending.forEach((el) => io.observe(el));
}

boot();
