/**

- East Grinstead Padel – Private Court Monitor
- Runs as a GitHub Action — checks once and exits.
  */

const puppeteer = require(“puppeteer”);

const EMAIL        = process.env.EGP_EMAIL    || “”;
const PASSWORD     = process.env.EGP_PASSWORD || “”;
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || “”;
const TG_CHAT_ID   = process.env.TG_CHAT_ID   || “”;
const TARGET_DATE  = process.env.TARGET_DATE  || “”;

const BASE_URL  = “https://eastgrinsteadpadel-gb.matchpoint.com.es”;
const LOGIN_URL = `${BASE_URL}/Login.aspx`;
const BOOK_URL  = `${BASE_URL}/Bookings/CreateBooking.aspx`;

function todayString() {
const d = new Date();
return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

function log(msg) {
console.log(`[${new Date().toISOString()}] ${msg}`);
}

async function sendTelegram(message) {
if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
try {
const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({ chat_id: TG_CHAT_ID, text: message, parse_mode: “HTML” }),
});
const json = await res.json();
if (json.ok) log(“📲 Telegram notification sent.”);
else log(`Telegram error: ${JSON.stringify(json)}`);
} catch (e) {
log(`Telegram send failed: ${e.message}`);
}
}

async function main() {
const date = TARGET_DATE || todayString();
log(`Checking private court availability for ${date}…`);

const browser = await puppeteer.launch({
headless: true,
args: [”–no-sandbox”, “–disable-setuid-sandbox”, “–disable-dev-shm-usage”, “–disable-gpu”],
});

const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

page.on(“console”, msg => log(`PAGE: ${msg.text()}`));

try {
log(“Navigating to login page…”);
await page.goto(LOGIN_URL, { waitUntil: “networkidle2”, timeout: 60000 });
await new Promise(r => setTimeout(r, 3000));

```
// Dismiss cookie banners
const cookieSelectors = [
  "#CookiesPolicyOK",
  ".cookie-accept",
  "#accept-cookies",
  "button[id*='cookie' i]",
  "button[class*='cookie' i]",
];
for (const sel of cookieSelectors) {
  try { await page.click(sel, { timeout: 1000 }); await new Promise(r => setTimeout(r, 1000)); break; } catch (_) {}
}

// Log page info for debugging
const title = await page.title();
log(`Page title: ${title} | URL: ${page.url()}`);

const inputs = await page.evaluate(() =>
  Array.from(document.querySelectorAll("input")).map(i => ({
    type: i.type, id: i.id, name: i.name, placeholder: i.placeholder
  }))
);
log(`Inputs found: ${JSON.stringify(inputs)}`);

// Fill email
const emailSelectors = [
  "#ctl00_MainContent_txtEmail",
  "#txtEmail",
  'input[type="email"]',
  'input[name="email"]',
  'input[name*="Email"]',
  'input[id*="Email"]',
  'input[placeholder*="email" i]',
  'input[placeholder*="user" i]',
];

let emailFilled = false;
for (const sel of emailSelectors) {
  try {
    await page.waitForSelector(sel, { timeout: 3000 });
    await page.click(sel);
    await page.type(sel, EMAIL, { delay: 40 });
    log(`Filled email using: ${sel}`);
    emailFilled = true;
    break;
  } catch (_) {}
}
if (!emailFilled) throw new Error("Could not find email input field");

// Fill password
const passwordSelectors = [
  "#ctl00_MainContent_txtPassword",
  "#txtPassword",
  'input[type="password"]',
  'input[name="password"]',
  'input[name*="Password"]',
  'input[id*="Password"]',
];

let passFilled = false;
for (const sel of passwordSelectors) {
  try {
    await page.waitForSelector(sel, { timeout: 3000 });
    await page.click(sel);
    await page.type(sel, PASSWORD, { delay: 40 });
    log(`Filled password using: ${sel}`);
    passFilled = true;
    break;
  } catch (_) {}
}
if (!passFilled) throw new Error("Could not find password input field");

// Submit
const submitSelectors = [
  "#ctl00_MainContent_btnLogin",
  'input[type="submit"]',
  'button[type="submit"]',
  'button[id*="login" i]',
  'input[value*="Login" i]',
];

let submitted = false;
for (const sel of submitSelectors) {
  try {
    await Promise.all([
      page.waitForNavigation({ waitUntil: "networkidle2", timeout: 40000 }),
      page.click(sel),
    ]);
    log(`Submitted using: ${sel}`);
    submitted = true;
    break;
  } catch (_) {}
}
if (!submitted) throw new Error("Could not find or click login submit button");

if (page.url().includes("Login.aspx")) {
  throw new Error("Still on login page — credentials may be wrong");
}
log("✅ Logged in successfully.");

// Load booking page
log(`Loading booking page for ${date}…`);
await page.goto(`${BOOK_URL}?date=${date}`, { waitUntil: "networkidle2", timeout: 60000 });
await new Promise(r => setTimeout(r, 3000));

// Scrape slots
const slots = await page.evaluate(() => {
  const found = [];

  function isAvailable(el) {
    const cls = (el.className || "").toLowerCase();
    return (
      (cls.includes("available") || cls.includes("libre") || cls.includes("free")) &&
      !cls.includes("occupied") && !cls.includes("booked") &&
      !cls.includes("blocked") && !cls.includes("disabled")
    );
  }

  function mentionsPrivate(str) {
    return /private|privado/i.test(str);
  }

  document.querySelectorAll("td, div[class*='slot'], div[class*='cell']").forEach(el => {
    if (!isAvailable(el)) return;
    const combined = el.textContent + " " + (el.getAttribute("title") || "") + " " + (el.getAttribute("aria-label") || "");
    if (mentionsPrivate(combined)) {
      found.push({ text: el.textContent.trim().slice(0, 100), title: (el.getAttribute("title") || "").slice(0, 80) });
    }
  });

  document.querySelectorAll("tr").forEach(row => {
    const header = row.querySelector("th, td:first-child");
    if (!header || !mentionsPrivate(header.textContent)) return;
    row.querySelectorAll("td").forEach(cell => {
      if (isAvailable(cell)) {
        found.push({ court: header.textContent.trim(), time: cell.textContent.trim().slice(0, 60) });
      }
    });
  });

  document.querySelectorAll("a, button").forEach(el => {
    const txt = el.textContent.trim().toLowerCase();
    if (txt !== "book" && txt !== "reservar") return;
    let parent = el.parentElement;
    for (let i = 0; i < 6; i++) {
      if (!parent) break;
      if (mentionsPrivate(parent.textContent)) {
        found.push({ context: parent.textContent.trim().slice(0, 120) });
        break;
      }
      parent = parent.parentElement;
    }
  });

  return found;
});

if (slots.length > 0) {
  log(`🎾 ${slots.length} private slot(s) available!`);
  const lines = slots.map((s, i) =>
    `${i + 1}. ${[s.court, s.time, s.text, s.context].filter(Boolean).join(" – ")}`.trim()
  ).join("\n");
  await sendTelegram(
    `🎾 <b>Private Court Available!</b>\n\n📅 Date: ${date}\n🕐 Slots found: ${slots.length}\n\n${lines}\n\n👉 <a href="${BOOK_URL}?date=${date}">Book now</a>`
  );
} else {
  log("No available private slots found this check.");
}
```

} catch (err) {
log(`Error: ${err.message}`);
await sendTelegram(`⚠️ <b>EGP Monitor error:</b> ${err.message}`);
process.exit(1);
} finally {
await browser.close();
}
}

main();