// bot.js
// Petit lab pour simuler des visites "humaines" sur une boutique Shopify

const { chromium } = require("playwright");

// 🔧 CONFIG À ADAPTER --------------------
const BASE_URL = "https://firstmillionever.myshopify.com"; // <= remplace par ton domaine
const PATHS = [
  "/", // home
  "/products/pull-lutin-noel", // exemple PDP
  // ajoute d'autres pages si tu veux:
  // "/collections/xxx",
  // "/products/yyy",
];

const TOTAL_VISITS = 20;      // nombre de sessions à simuler
const MIN_DELAY_BETWEEN_PAGES = 5000; // ms
const MAX_DELAY_BETWEEN_PAGES = 12000;
// Mot de passe de la boutique (page protégée)
const PASSWORD = "1";
// ---------------------------------------

function randomBetween(min, max) {
  return min + Math.random() * (max - min);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function randomUserAgent() {
  const agents = [
    // iPhone
    "Mozilla/5.0 (iPhone; CPU iPhone OS 16_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.2 Mobile/15E148 Safari/604.1",
    // Android Chrome
    "Mozilla/5.0 (Linux; Android 13; Pixel 7 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
    // Desktop Chrome
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    // Mac Safari
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 13_1) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.1 Safari/605.1.15",
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

function randomViewport() {
  const mobileViewports = [
    { width: 390, height: 844 }, // iPhone 14
    { width: 375, height: 812 }, // iPhone X/11/12
    { width: 412, height: 915 }, // Android
  ];
  return mobileViewports[Math.floor(Math.random() * mobileViewports.length)];
}

// 🔐 Bypass automatique de la page mot de passe
async function bypassPassword(page) {
  try {
    // On attend un peu que la page se stabilise
    await page.waitForTimeout(1500);

    const passwordField = await page.$(
      'input[type="password"], input#Password, input[name="password"]'
    );

    if (!passwordField) {
      // Pas de page mot de passe → on sort
      return;
    }

    console.log("🔐 Page mot de passe détectée → saisie automatique…");

    // On remplit le champ
    await passwordField.fill(PASSWORD);

    // On tente de trouver un bouton de submit
    const submitBtn =
      (await page.$('button[type="submit"]')) ||
      (await page.$('input[type="submit"]')) ||
      (await page.$("button"));

    if (submitBtn) {
      await submitBtn.click();
      console.log("🔐 Mot de passe soumis, attente de la redirection…");

      // Attendre la navigation vers la vraie page
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(1500);

      console.log("🔓 Accès boutique débloqué.");
    } else {
      console.log("⚠️ Bouton de soumission introuvable sur la page mot de passe.");
    }
  } catch (e) {
    console.log("⚠️ Erreur bypassPassword :", e.message);
  }
}

async function humanScroll(page) {
  try {
    const totalHeight = await page.evaluate(() => document.body.scrollHeight);
    let currentPos = 0;

    while (currentPos < totalHeight) {
      const step = randomBetween(200, 450);
      currentPos += step;
      await page.mouse.wheel(0, step);
      await sleep(randomBetween(600, 1400));
    }

    // petit scroll vers le haut à la fin
    await page.mouse.wheel(0, -300);
  } catch (e) {
    console.log("  ⚠️ Erreur scroll (probable redirection / page vide) :", e.message);
  }
}

async function tryAddToCart(page) {
  try {
    // différents sélecteurs possibles selon le thème
    const selectors = [
      "button[name='add']",
      "button[type='submit'][name='add']",
      "form[action*='/cart/add'] button[type='submit']",
      "form[action*='/cart/add'] input[type='submit']",
    ];

    for (const sel of selectors) {
      const exists = await page.$(sel);
      if (exists) {
        console.log("  🛒 Tentative add to cart avec sélecteur :", sel);
        await exists.click({ delay: randomBetween(50, 150) });
        await sleep(randomBetween(1500, 3000));
        return true;
      }
    }

    console.log("  🛒 Aucun bouton add-to-cart trouvé.");
    return false;
  } catch (e) {
    console.log("  ⚠️ Erreur add-to-cart :", e.message);
    return false;
  }
}

async function simulateVisit(browser, index) {
  const ua = randomUserAgent();
  const viewport = randomViewport();

  const context = await browser.newContext({
    userAgent: ua,
    viewport,
    locale: "fr-FR",
  });

  const page = await context.newPage();

  console.log(`\n=== VISITE #${index + 1} ===`);
  console.log("UA:", ua);
  console.log("Viewport:", viewport);

  // 1️⃣ Home
  const homeUrl = BASE_URL + "/";
  console.log("➡️ Home :", homeUrl);
  await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await bypassPassword(page); // 👈 passe la page mot de passe si présente
  await sleep(randomBetween(2000, 4000));
  await humanScroll(page);
  await sleep(randomBetween(1500, 3000));

  // 2️⃣ Une autre page (collection / PDP)
  const path = PATHS[Math.floor(Math.random() * PATHS.length)];
  const targetUrl = BASE_URL.replace(/\/+$/, "") + path;
  console.log("➡️ Page suivante :", targetUrl);
  await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
  await bypassPassword(page); // 👈 au cas où tu retombes dessus
  await sleep(randomBetween(2000, 5000));
  await humanScroll(page);

  // Si c'est une PDP, on tente un add-to-cart
  if (path.includes("/products/")) {
    await tryAddToCart(page);
  }

  // petite pause fin de session
  await sleep(randomBetween(2000, 4000));

  await context.close();
}

(async () => {
  const browser = await chromium.launch({
    headless: false, // false = tu vois le navigateur, plus "humain"
    slowMo: 0,
  });

  for (let i = 0; i < TOTAL_VISITS; i++) {
    await simulateVisit(browser, i);

    // délai entre les visites (comme si un nouvel utilisateur arrivait)
    const delay = randomBetween(MIN_DELAY_BETWEEN_PAGES, MAX_DELAY_BETWEEN_PAGES);
    console.log(`⏱ Pause avant prochaine visite : ~${Math.round(delay / 1000)}s`);
    await sleep(delay);
  }

  await browser.close();
  console.log("\n✅ Terminé.");
})();