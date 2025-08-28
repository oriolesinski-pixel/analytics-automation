// Tiny event dispatcher + network bridge to your connector-service.

export function aaFire(name: string, props: Record<string, any> = {}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("aa:track", { detail: { name, props } }));
  }
}

// Automatically POSTs any fired event to your service.
(function () {
  if (typeof window === "undefined") return;

  // Keep this pointing to the repo your service knows today:
  const FULL_REPO = "oriolesinski-pixel/demo-frontend";
  const ENDPOINT = "http://localhost:8080/ingest";

  window.addEventListener("aa:track", (ev: Event) => {
    const d = (ev as CustomEvent).detail as { name: string; props: Record<string, any> };
    if (!d?.name) return;

    fetch(ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        full: FULL_REPO,
        verb: d.name,
        source: "demo-next",
        ts: Date.now(),
        metadata: { ...d.props, actor: "demo-user" },
      }),
      keepalive: true,
    }).catch(() => {});
  });
})();
