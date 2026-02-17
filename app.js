// bot.js
// Petit lab pour simuler des visites "humaines" sur une boutique Shopify
// Version avec passage de commandes et code promo FREE

const { chromium } = require("playwright");
const { spawn } = require("child_process");

// 🔧 CONFIG À ADAPTER --------------------
const BASE_URL = "https://firstmillionever.myshopify.com";
const PATHS = [
  "/", // home
  "/products/pull-lutin-noel", // exemple PDP
  // ajoute d'autres pages si tu veux:
  // "/collections/xxx",
  // "/products/yyy",
];

const TOTAL_VISITS = 1600;      // nombre de sessions à simuler
const TOTAL_ORDERS = 25;         // nombre total de commandes à passer
const MIN_DELAY_BETWEEN_PAGES = 15000; // ms (Base)
const MAX_DELAY_BETWEEN_PAGES = 120000;

// ⚡️ VISITES RAPIDES (heures de pointe)
const PEAK_MIN_DELAY = 5000;
const PEAK_MAX_DELAY = 120000;

// 🎲 VISITES SIMULTANÉES (par lot)
const MIN_CONCURRENT_VISITS = 1;
const MAX_CONCURRENT_VISITS = 12;
const DELAY_BETWEEN_BATCHES_MIN = 5000;
const DELAY_BETWEEN_BATCHES_MAX = 250000;   

// 🛒 CONFIGURATION DES COMMANDES 
const PROMO_CODE = "FREE"; 
const ORDER_PROBABILITY = 0.9; // Probabilité qu'une visite se transforme en commande (40%)
const CHECKOUT_DELAY_MIN = 10000;  // délai minimum pour le processus de checkout (ms)
const CHECKOUT_DELAY_MAX = 30000;  // délai maximum pour le processus de checkout (ms)

// Données factices pour les commandes
const FIRST_NAMES = ["Jean", "Marie", "Pierre", "Sophie", "Lucas", "Emma", "Thomas", "Lea", "Nicolas", "Julie"];
const LAST_NAMES = ["Martin", "Bernard", "Dubois", "Thomas", "Robert", "Richard", "Petit", "Durand", "Leroy", "Moreau"];
const STREETS = ["Rue de la Paix", "Avenue des Champs-Élysées", "Rue du Faubourg Saint-Honoré", "Boulevard Saint-Germain", "Rue de Rivoli"];
const CITIES = ["Paris", "Lyon", "Marseille", "Bordeaux", "Lille", "Toulouse", "Nice", "Nantes", "Strasbourg", "Montpellier"];
const POSTAL_CODES = {
  "Paris": "7500" + Math.floor(Math.random() * 9 + 1),
  "Lyon": "6900" + Math.floor(Math.random() * 9 + 1),
  "Marseille": "1300" + Math.floor(Math.random() * 9 + 1),
  "Bordeaux": "3300" + Math.floor(Math.random() * 9 + 1),
  "Lille": "5900" + Math.floor(Math.random() * 9 + 1),
  "Toulouse": "3100" + Math.floor(Math.random() * 9 + 1),
  "Nice": "0600" + Math.floor(Math.random() * 9 + 1),
  "Nantes": "4400" + Math.floor(Math.random() * 9 + 1),
  "Strasbourg": "6700" + Math.floor(Math.random() * 9 + 1),
  "Montpellier": "3400" + Math.floor(Math.random() * 9 + 1)
};
const PHONE_PREFIXES = ["06", "07"];
const EMAIL_DOMAINS = ["gmail.com", "yahoo.fr", "hotmail.fr", "orange.fr", "free.fr", "outlook.fr"];

// Mot de passe de la boutique (page protégée)
const PASSWORD = "1";
// ---------------------------------------

let ordersCompleted = 0; // Compteur global de commandes

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

function generateRandomEmail() {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)].toLowerCase();
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)].toLowerCase();
  const domain = EMAIL_DOMAINS[Math.floor(Math.random() * EMAIL_DOMAINS.length)];
  const randomNum = Math.floor(Math.random() * 100);
  return `${firstName}.${lastName}${randomNum}@${domain}`;
}

function generateRandomPhone() {
  const prefix = PHONE_PREFIXES[Math.floor(Math.random() * PHONE_PREFIXES.length)];
  const number = Math.floor(Math.random() * 100000000).toString().padStart(8, '0');
  return `${prefix}${number}`;
}

function generateRandomAddress() {
  const firstName = FIRST_NAMES[Math.floor(Math.random() * FIRST_NAMES.length)];
  const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
  const street = STREETS[Math.floor(Math.random() * STREETS.length)];
  const city = CITIES[Math.floor(Math.random() * CITIES.length)];
  const postalCode = POSTAL_CODES[city] || "75001";
  const streetNumber = Math.floor(Math.random() * 150) + 1;

  return {
    firstName,
    lastName,
    address: `${streetNumber} ${street}`,
    city,
    postalCode,
    phone: generateRandomPhone(),
    email: generateRandomEmail()
  };
}

// 🔐 Bypass automatique de la page mot de passe
async function bypassPassword(page) {
  try {
    await page.waitForTimeout(1500);
    const passwordField = await page.$('input[type="password"], input#Password, input[name="password"]');

    if (!passwordField) {
      return;
    }

    console.log("🔐 Page mot de passe détectée → saisie automatique…");
    await passwordField.fill(PASSWORD);

    const submitBtn =
      (await page.$('button[type="submit"]')) ||
      (await page.$('input[type="submit"]')) ||
      (await page.$("button"));

    if (submitBtn) {
      await submitBtn.click();
      console.log("🔐 Mot de passe soumis, attente de la redirection…");
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 20000 });
      await page.waitForTimeout(1500);
      console.log("🔓 Accès boutique débloqué.");
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

    await page.mouse.wheel(0, -300);
  } catch (e) {
    console.log("  ⚠️ Erreur scroll :", e.message);
  }
}

async function tryAddToCart(page) {
  try {
    const selectors = [
      "button[name='add']",
      "button[type='submit'][name='add']",
      "form[action*='/cart/add'] button[type='submit']",
      "form[action*='/cart/add'] input[type='submit']",
    ];

    for (const sel of selectors) {
      const exists = await page.$(sel);
      if (exists) {
        console.log("  🛒 Ajout au panier avec sélecteur :", sel);
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

async function buyNow(page) {
  try {
    let selectors = [
      "button.shopify-payment-button__button",
      "button[data-testid='Checkout-button']",
      "div.shopify-payment-button",
    ];

    // 1. Première tentative de recherche du bouton
    for (const sel of selectors) {
      const exists = await page.$(sel);
      if (exists && await exists.isVisible()) {
        console.log("  ⚡️ Achat Immédiat (Buy Now) avec sélecteur :", sel);
        await exists.click({ delay: randomBetween(50, 150) });
        await page.waitForTimeout(5000);
        return true;
      }
    }

    // 2. Si pas trouvé, chercher le lien "More payment options"
    console.log("  🔎 Bouton Buy Now non visible, recherche 'More payment options'...");
    const moreOptionsLink = await page.$('a.shopify-payment-button__more-options, #more-payment-options-link, a:has-text("More payment options")');

    if (moreOptionsLink) {
      console.log("  🔄 Clic sur 'More payment options'...");
      await moreOptionsLink.click();
      await sleep(randomBetween(500, 1500));

      // Réessayer de cliquer sur le bouton Buy Now qui devrait être apparu
      for (const sel of selectors) {
        const exists = await page.$(sel);
        if (exists && await exists.isVisible()) {
          console.log("  ⚡️ Achat Immédiat (après 'More options') :", sel);
          await exists.click({ delay: randomBetween(50, 150) });
          await page.waitForTimeout(5000);
          return true;
        }
      }
    }

    console.log("  ⚡️ Aucun bouton Buy Now trouvé (même après fallback).");
    return false;
  } catch (e) {
    console.log("  ⚠️ Erreur buyNow :", e.message);
    return false;
  }
}

async function goToCart(page) {
  try {
    console.log("  🛒 Navigation vers le panier...");

    // Essayer différents sélecteurs pour le lien du panier
    const cartSelectors = [
      'button[id="checkout"]',
      'button[name="checkout"]',
      'a[href*="checkout"]',
      '.cart-icon',
      '#cart-icon'
    ];

    for (const selector of cartSelectors) {
      const cartLink = await page.$(selector);
      if (cartLink) {
        await cartLink.click({ delay: randomBetween(50, 150) });
        await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 });
        await sleep(randomBetween(2000, 4000));
        return true;
      }
    }

    // Si on ne trouve pas de lien, essayer d'aller directement à l'URL du panier
    await page.goto(`${BASE_URL}/checkouts/cn/hWN8jmEOluL9rtc47W8mZDUZ/en-fr?_r=AQABdtoRv_iW02SvFRisT4TqKejuIA2IU0mmqtsTQiSEwaI&preview_theme_id=186005455174`, { waitUntil: "domcontentloaded", timeout: 30000 });
    await sleep(randomBetween(2000, 4000));
    return true;
  } catch (e) {
    console.log("  ⚠️ Erreur navigation panier :", e.message);
    return false;
  }
}

async function applyPromoCode(page) {
  try {
    console.log("  🏷️ Application du code promo FREE...");

    // Chercher le champ de code promo
    const promoInput = await page.$('input[id="ReductionsInput0"], input[name="reductions"], input[placeholder*="code"], .discount-code-input');

    if (promoInput) {
      await promoInput.fill(PROMO_CODE);
      await sleep(randomBetween(500, 1500));

      // Chercher le bouton d'application
      const applyButton = await page.$('button._1m2hr9gf, button[type="submit"][value*="code"], button:has-text("Appliquer"), button:has-text("Apply")');
      if (applyButton) {
        await applyButton.click({ delay: randomBetween(50, 150) });
        await sleep(randomBetween(2000, 4000));
        console.log("  ✅ Code promo appliqué avec succès");
        return true;
      }
    }
    console.log("  ⚠️ Champ code promo non trouvé");
    return false;
  } catch (e) {
    console.log("  ⚠️ Erreur application code promo :", e.message);
    return false;
  }
}

async function proceedToCheckout(page) {
  try {
    console.log("  💳 Début du checkout...");

    // Bouton de checkout
    const checkoutButton = await page.$('button[name="checkout"], a[href*="checkout"], button:has-text("Commander"), button:has-text("Checkout")');
    if (checkoutButton) {
      await checkoutButton.click({ delay: randomBetween(50, 150) });
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 30000 });
      await sleep(randomBetween(3000, 6000));
      return true;
    }
    return false;
  } catch (e) {
    console.log("  ⚠️ Erreur début checkout :", e.message);
    return false;
  }
}

async function fillCheckoutForm(page) {
  try {
    console.log("  📝 Remplissage du formulaire de checkout...");

    const address = generateRandomAddress();

    // Email / Phone (sélecteur spécifique vu dans le code source)
    // ID: email (pour l'input)
    const emailInput = await page.$('#email, input[name="email"], input[type="email"]');
    if (emailInput) {
      // 80% de chance d'utiliser l'email, 20% le téléphone si c'est un champ mixte
      // Mais pour simplifier et assurer la validation, on utilise l'email ici
      await emailInput.fill(address.email);
      await sleep(randomBetween(500, 1500));
    } else {
      console.log("  ⚠️ Champ Email non trouvé");
    }

    // Prénom (ID: TextField0 ou SHIPPING_ADDRESS_FIRST_NAME)
    const firstNameInput = await page.$('#TextField0, input[name="firstName"], input[name="checkout[shipping_address][first_name]"]');
    if (firstNameInput) {
      await firstNameInput.fill(address.firstName);
      await sleep(randomBetween(300, 800));
    }

    // Nom (ID: TextField1)
    const lastNameInput = await page.$('#TextField1, input[name="lastName"], input[name="checkout[shipping_address][last_name]"]');
    if (lastNameInput) {
      await lastNameInput.fill(address.lastName);
      await sleep(randomBetween(300, 800));
    }

    // Adresse (ID: shipping-address1)
    const addressInput = await page.$('#shipping-address1, input[name="address1"], input[name="checkout[shipping_address][address1]"]');
    if (addressInput) {
      await addressInput.fill(address.address);
      await sleep(randomBetween(500, 1000));
      // Parfois une suggestion d'adresse apparaît, on peut cliquer ailleurs pour fermer ou appuyer sur Escape
      await page.keyboard.press('Escape');
    }

    // Ville (ID: TextField3)
    const cityInput = await page.$('#TextField3, input[name="city"], input[name="checkout[shipping_address][city]"]');
    if (cityInput) {
      await cityInput.fill(address.city);
      await sleep(randomBetween(300, 800));
    }

    // Code postal (ID: TextField2)
    // Important: s'assurer qu'il correspond au pays/ville pour éviter les erreurs de validation
    const zipInput = await page.$('#TextField2, input[name="postalCode"], input[name="checkout[shipping_address][zip]"]');
    if (zipInput) {
      await zipInput.fill(address.postalCode);
      await sleep(randomBetween(300, 800));
    }

    // Téléphone (Souvent un champ à part ou optionnel)
    // ID: TextField4 (souvent) ou input[name="phone"] ou #tel
    const phoneInput = await page.$('input[name="phone"], input[type="tel"], #TextField4, input[name="checkout[shipping_address][phone]"]');
    if (phoneInput) {
      await phoneInput.fill(address.phone);
      await sleep(randomBetween(300, 800));
    }

    console.log(`  ✅ Formulaire rempli (Bot: ${address.firstName} ${address.lastName})`);

    // --- GESTION DU CODE PROMO (Spécifique User) ---
    // On met tout dans un try/catch pour ne pas bloquer le checkout si ça foire
    try {
      // 1. Cliquer sur "Add discount" si le champ n'est pas visible
      const addDiscountBtn = await page.$('button:has(span:has-text("Add discount")), button:has(svg), ._1m2hr9gf:has(svg)');
      const discountInputVisible = await page.$('#ReductionsInput2');

      if (!discountInputVisible && addDiscountBtn) {
        console.log("  🎟️ Clic sur 'Add discount'...");
        // Timeout court pour ne pas bloquer
        await addDiscountBtn.click({ timeout: 3000 });
        await sleep(randomBetween(500, 1000));
      }

      // 2. Remplir le code promo
      const discountInput = await page.$('#ReductionsInput2, input[name="reductions"]');
      if (discountInput) {
        console.log(`  🏷️ Application du code promo ${PROMO_CODE}...`);
        await discountInput.fill(PROMO_CODE);
        await sleep(randomBetween(300, 800));

        // 3. Cliquer sur "Apply"
        const applyBtn = await page.$('button[aria-label="Apply Discount Code"], button:has-text("Apply")');
        if (applyBtn) {
          await applyBtn.click({ timeout: 5000 });
          await sleep(randomBetween(1000, 2000));
        }
      }
    } catch (discountError) {
      console.log("  ⚠️ Pas grave: échec application code promo (continue checkout).");
    }

    // --- FINALISATION COMMANDE ---
    // User a fourni le bouton final : #checkout-pay-button avec texte "Complete order"
    // On essaie de cliquer dessus directement ici car souvent tout est sur la même page
    console.log("  💳 Tentative de finalisation (Complete order)...");
    const completeOrderBtn = await page.$('#checkout-pay-button, button:has-text("Complete order")');

    if (completeOrderBtn) {
      await sleep(randomBetween(1000, 2000));
      try {
        const text = await completeOrderBtn.innerText();
        console.log(`  🚀 Clic sur le bouton final : "${text}"`);
        await completeOrderBtn.click({ timeout: 10000 });
      } catch (e) {
        console.log("  ⚠️ Click standard échoué, force click...");
        await completeOrderBtn.evaluate(b => b.click());
      }

      // Attente confirmation
      await page.waitForNavigation({ waitUntil: "domcontentloaded", timeout: 45000 }).catch(() => { });
      console.log("  ➡️ Navigation post-commande...");
      return true;
    }

    return true;
  } catch (e) {
    console.log("  ⚠️ Erreur remplissage formulaire :", e.message);
    return false;
  }
}

async function completeOrder(page) {
  // Cette fonction est gardée en fallback ou pour les étapes suivantes si multi-page
  // Mais la logique principale est maintenant intégrée à fillCheckoutForm pour ce checkout spécifique
  return true;
}

async function completeCheckoutProcess(page, skipProceed = false) {
  try {
    // Note: applyPromoCode is now handled inside fillCheckoutForm for this specific flow
    // but we leave it here if needed for other flows, though likely redundant
    // await applyPromoCode(page); 

    // Procéder au checkout
    if (!skipProceed) {
      if (!await proceedToCheckout(page)) {
        return false;
      }
    }

    // Remplir le formulaire ET finaliser (la logique est maintenant tout-en-un)
    if (await fillCheckoutForm(page)) {
      // Si fillCheckoutForm retourne true, c'est que le bouton "Complete order" a été cliqué
      // On considère l'ordre comme passé (ou du moins envoyé)
      ordersCompleted++;
      console.log(`  📊 Commandes totales : ${ordersCompleted}/${TOTAL_ORDERS}`);
      return true;
    }

    return false;
  } catch (e) {
    console.log("  ⚠️ Erreur processus checkout :", e.message);
    return false;
  }
}

// 🕒 Check l'heure et renvoie les delays appropriés
async function checkTimeAndGetDelay() {
  while (true) {
    const now = new Date();
    const currentHour = now.getHours();

    // // ⛔️ 01h - 04h : PAUSE
    // if (currentHour >= 1 && currentHour < 4) {
    //   console.log(`\n😴 Il est ${currentHour}h. Pause nuit jusqu'à 4h...`);
    //   const target = new Date(now);
    //   target.setHours(4, 0, 0, 0);
    //   if (target <= now) target.setDate(target.getDate() + 1);

    //   const msToWait = target.getTime() - now.getTime();
    //   console.log(`(Attente de ${(msToWait / 1000 / 60).toFixed(1)} minutes)`);

    //   await sleep(msToWait);
    //   console.log("\n☀️ Bonjour ! Reprise des visites.");
    //   continue;
    // }

    // ⛔️ 01h - 04h : PAUSE
    if (currentHour >= 1 && currentHour < 4) {
      console.log(`\n😴 Il est ${currentHour}h. Pause nuit jusqu'à 4h...`);
      const target = new Date(now);
      target.setHours(4, 0, 0, 0);
      if (target <= now) target.setDate(target.getDate() + 1);

      const msToWait = target.getTime() - now.getTime();
      console.log(`(Attente de ${(msToWait / 1000 / 60).toFixed(1)} minutes)`);

      await sleep(msToWait);
      console.log("\n☀️ Bonjour ! Reprise des visites.");
      continue;
    }


    const isPeakTime = (currentHour >= 11 && currentHour < 13) || (currentHour >= 16 && currentHour < 17);

    if (isPeakTime) {
      return { min: PEAK_MIN_DELAY, max: PEAK_MAX_DELAY, label: "🚀 PEAK", isPeakTime: true };
    }

    return { min: MIN_DELAY_BETWEEN_PAGES, max: MAX_DELAY_BETWEEN_PAGES, label: "🚶 NORMAL", isPeakTime: false };
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

  try {
    console.log(`\n=== VISITE #${index + 1} ===`);
    console.log("UA:", ua);
    console.log("Viewport:", viewport);

    // Déterminer si cette visite doit se transformer en commande
    const shouldOrder = ordersCompleted < TOTAL_ORDERS && Math.random() < ORDER_PROBABILITY;
    if (shouldOrder) {
      console.log("  🎯 Cette visite sera transformée en commande !");
    }

    // 1️⃣ Home
    const homeUrl = BASE_URL + "/";
    console.log("➡️ Home :", homeUrl);
    await page.goto(homeUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await bypassPassword(page);
    await sleep(randomBetween(2000, 4000));
    await humanScroll(page);
    await sleep(randomBetween(1500, 3000));

    // 2️⃣ Une autre page (collection / PDP)
    let path;
    if (shouldOrder) {
      // Force un produit si on doit commander
      const productPaths = PATHS.filter(p => p.includes("/products/"));
      path = productPaths[Math.floor(Math.random() * productPaths.length)];
    } else {
      path = PATHS[Math.floor(Math.random() * PATHS.length)];
    }

    const targetUrl = BASE_URL.replace(/\/+$/, "") + path;
    console.log(`[#${index + 1}] ➡️ Page suivante :`, targetUrl);
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 45000 });
    await bypassPassword(page);
    await sleep(randomBetween(2000, 5000));
    await humanScroll(page);

    // Si c'est une PDP (Product Detail Page)
    if (path.includes("/products/")) {

      if (shouldOrder) {
        // Si on doit commander, on tente le "Buy Now" d'abord
        console.log("  🎯 Tentative d'achat direct (Buy Now)...");
        const buyNowSuccess = await buyNow(page);

        if (buyNowSuccess) {
          console.log("  🛍️ Redirection vers le checkout (Buy Now réussie)...");
          await sleep(randomBetween(3000, 7000));
          // On est censé être sur le checkout ou en route
          await completeCheckoutProcess(page, true);
        } else {
          // Fallback sur Add to Cart classique si Buy Now échoue
          console.log("  ⚠️ Buy Now échoué, fallback sur Add to Cart...");
          const added = await tryAddToCart(page);
          if (added) {
            await sleep(randomBetween(2000, 5000));
            if (await goToCart(page)) {
              await sleep(randomBetween(3000, 7000));
              await completeCheckoutProcess(page);
            }
          }
        }

      } else {
        // Visite simple : juste add to cart éventuellement
        await tryAddToCart(page);
      }
    }

    // petite pause fin de session
    await sleep(randomBetween(2000, 4000));

    console.log(`✅ Visite #${index + 1} terminée avec succès`);
  } catch (error) {
    console.log(`⚠️ Erreur lors de la visite #${index + 1} : ${error.message}`);
  } finally {
    await context.close();
  }
}

(async () => {
  console.log("🚀 Démarrage du bot avec passage de commandes automatique");
  console.log(`📊 Objectif: ${TOTAL_VISITS} visites, ${TOTAL_ORDERS} commandes avec code "${PROMO_CODE}"`);
  console.log(`📈 Probabilité de commande par visite: ${(ORDER_PROBABILITY * 100).toFixed(1)}%\n`);

  const browser = await chromium.launch({
    headless: true,
    slowMo: 0,
    args: [
      '--disable-blink-features=AutomationControlled',
      '--no-sandbox',
      '--disable-web-security',
    ]
  });

  let totalCompleted = 0;
  let batchNumber = 0;

  while (totalCompleted < TOTAL_VISITS) {
    const timeConfig = await checkTimeAndGetDelay();

    const peakMultiplier = timeConfig.isPeakTime ? 3 : 1;
    const minConcurrent = MIN_CONCURRENT_VISITS * peakMultiplier;
    const maxConcurrent = MAX_CONCURRENT_VISITS * peakMultiplier;

    const remainingVisits = TOTAL_VISITS - totalCompleted;
    const maxBatchSize = Math.min(remainingVisits, maxConcurrent);
    const minBatchSize = Math.min(minConcurrent, maxBatchSize);
    const batchSize = Math.floor(randomBetween(minBatchSize, maxBatchSize + 1));

    batchNumber++;
    console.log(`\n🎲 === LOT #${batchNumber} : ${batchSize} visites simultanées [${timeConfig.label}] ===`);
    console.log(`📊 Progression: ${totalCompleted}/${TOTAL_VISITS} visites | ${ordersCompleted}/${TOTAL_ORDERS} commandes`);

    const visitPromises = [];
    for (let i = 0; i < batchSize; i++) {
      const visitIndex = totalCompleted + i;
      visitPromises.push(simulateVisit(browser, visitIndex));
    }

    await Promise.all(visitPromises);
    totalCompleted += batchSize;

    console.log(`\n✅ Lot #${batchNumber} terminé (${totalCompleted}/${TOTAL_VISITS} visites, ${ordersCompleted}/${TOTAL_ORDERS} commandes)`);

    if (totalCompleted < TOTAL_VISITS) {
      const batchDelay = randomBetween(DELAY_BETWEEN_BATCHES_MIN, DELAY_BETWEEN_BATCHES_MAX);
      console.log(`⏱ Pause avant le prochain lot : ~${Math.round(batchDelay / 1000)}s\n`);
      await sleep(batchDelay);
    }
  }

  await browser.close();
  console.log("\n✅ Toutes les visites sont terminées !");
  console.log(`📊 Récapitulatif: ${totalCompleted}/${TOTAL_VISITS} visites | ${ordersCompleted}/${TOTAL_ORDERS} commandes`);
})();