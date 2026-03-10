let phaserLoader: Promise<void> | null = null;

const PHASER_CDN = "https://cdn.jsdelivr.net/npm/phaser@3.90.0/dist/phaser.min.js";

export function loadPhaser(): Promise<void> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("window is not available"));
  }

  if ((window as { Phaser?: unknown }).Phaser) {
    return Promise.resolve();
  }

  if (phaserLoader) {
    return phaserLoader;
  }

  phaserLoader = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-phaser="true"]');
    if (existing) {
      existing.addEventListener("load", () => resolve(), { once: true });
      existing.addEventListener("error", () => reject(new Error("Failed to load Phaser script")), {
        once: true,
      });
      return;
    }

    const script = document.createElement("script");
    script.src = PHASER_CDN;
    script.async = true;
    script.dataset.phaser = "true";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Phaser script"));
    document.head.appendChild(script);
  });

  return phaserLoader;
}
