import fs from "node:fs/promises";
import path from "node:path";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

import { chromium } from "@playwright/test";

const args = process.argv.slice(2);
const argMap = new Map();

for (let i = 0; i < args.length; i += 1) {
  const arg = args[i];
  if (!arg.startsWith("--")) {
    continue;
  }
  const key = arg.slice(2);
  const next = args[i + 1];
  if (next && !next.startsWith("--")) {
    argMap.set(key, next);
    i += 1;
  } else {
    argMap.set(key, "true");
  }
}

const baseUrl = argMap.get("base") || process.env.BASE_URL || "http://localhost:5173";
const outputDir = argMap.get("out") || "screenshots";
const routes = (argMap.get("routes") || "/,/lobby,/game?screenshot=1")
  .split(",")
  .map((route) => route.trim())
  .filter(Boolean)
  .map((route) => (route.startsWith("/") ? route : `/${route}`));

const reduceMotion = (argMap.get("reduce-motion") ?? "true") !== "false";
const fullPage = (argMap.get("full-page") ?? "true") !== "false";

const viewports = [
  { name: "iphone-se", width: 375, height: 667 },
  { name: "iphone-14", width: 390, height: 844 },
  { name: "iphone-14-pro-max", width: 430, height: 932 },
  { name: "ipad-mini", width: 768, height: 1024 },
  { name: "ipad-mini-landscape", width: 1024, height: 768 },
  { name: "samsung-fold", width: 320, height: 720 },
  { name: "samsung-fold-open", width: 673, height: 841 },
  { name: "laptop-13", width: 1280, height: 800 },
  { name: "laptop-14", width: 1440, height: 900 },
  { name: "laptop-15", width: 1536, height: 864 },
  { name: "laptop-16", width: 1728, height: 1117 },
  { name: "monitor-24", width: 1920, height: 1080 },
  { name: "monitor-27", width: 2560, height: 1440 },
  { name: "monitor-34-ultrawide", width: 3440, height: 1440 },
  { name: "monitor-40-4k", width: 3840, height: 2160 },
];

const parseSelectionTokens = (raw) =>
  raw
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

const selectViewportsFromTokens = (tokens) => {
  const selected = [];
  const seen = new Set();

  for (const token of tokens) {
    let viewport;
    if (/^\d+$/.test(token)) {
      const index = Number(token) - 1;
      viewport = viewports[index];
    } else {
      viewport = viewports.find((entry) => entry.name.toLowerCase() === token.toLowerCase());
    }
    if (!viewport || seen.has(viewport.name)) {
      continue;
    }
    seen.add(viewport.name);
    selected.push(viewport);
  }

  return selected;
};

const pickViewports = async () => {
  const deviceArg = argMap.get("devices") || argMap.get("device");
  if (deviceArg) {
    const selected = selectViewportsFromTokens(parseSelectionTokens(deviceArg));
    if (selected.length > 0) {
      return selected;
    }
    process.stderr.write(`No matching devices found for "${deviceArg}", defaulting to all devices.\n`);
    return viewports;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return viewports;
  }

  process.stdout.write("Available devices:\n");
  for (const [index, viewport] of viewports.entries()) {
    process.stdout.write(`${index + 1}. ${viewport.name} (${viewport.width}x${viewport.height})\n`);
  }
  process.stdout.write("\n");

  const rl = readline.createInterface({ input, output });
  const answer = await rl.question("Select device number(s) (comma-separated), or press Enter for all: ");
  rl.close();

  const selectedTokens = parseSelectionTokens(answer);

  if (selectedTokens.length === 0) {
    return viewports;
  }

  const selected = selectViewportsFromTokens(selectedTokens);
  if (selected.length === 0) {
    process.stderr.write("No valid device numbers selected, defaulting to all devices.\n");
    return viewports;
  }
  return selected;
};

const slugify = (value) =>
  value
    .replace(/^\//, "")
    .replace(/[^\w-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "") || "home";

const run = async () => {
  await fs.mkdir(outputDir, { recursive: true });
  const selectedViewports = await pickViewports();

  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  if (reduceMotion) {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.addStyleTag({
      content: `
        *,
        *::before,
        *::after {
          animation-duration: 0.001ms !important;
          animation-iteration-count: 1 !important;
          transition-duration: 0.001ms !important;
          scroll-behavior: auto !important;
        }
      `,
    });
  }

  for (const viewport of selectedViewports) {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });

    for (const route of routes) {
      const targetUrl = `${baseUrl}${route}`;
      const routeSlug = slugify(route);
      const fileName = `${viewport.name}-${routeSlug}.png`;
      const filePath = path.join(outputDir, fileName);

      try {
        await page.goto(targetUrl, { waitUntil: "domcontentloaded" });
        await page.waitForSelector("#root", { timeout: 5000 });
        await page.waitForTimeout(5000);
        await page.screenshot({ path: filePath, fullPage });
        process.stdout.write(`Saved ${filePath}\n`);
      } catch (error) {
        process.stderr.write(`Failed ${viewport.name} ${route}: ${error?.message ?? error}\n`);
      }
    }
  }

  await browser.close();
};

run().catch((error) => {
  process.stderr.write(`${error?.stack ?? error}\n`);
  process.exit(1);
});
