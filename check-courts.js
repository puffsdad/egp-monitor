/**

- East Grinstead Padel – Private Court Monitor
- Runs in the cloud (Railway.app) and sends Telegram notifications to your iPhone.
  */

const puppeteer = require(“puppeteer”);

// ── ✏️  CONFIGURE THESE (or set as environment variables on Railway) ──────────
const EMAIL          = process.env.EGP_EMAIL    || “your@email.com”;
const PASSWORD       = process.env.EGP_PASSWORD || “yourpassword”;
const TG_BOT_TOKEN   = process.env.TG_BOT_TOKEN || “”;   // from @BotFather
const TG_CHAT_ID     = process.env.TG_CHAT_ID   || “”;   // your chat ID

// Date to check: “YYYY-MM-DD” or “” for today
const TARGET_DATE    = process.env.TARGET_DATE   || “”;

// How often to check, in minutes
const CHECK_EVERY_MINS = parseInt(process.env.CHECK_EVERY_MINS || “5”, 10);
// ── END CONFIG ────────────────────────────────────────────────────────────────

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
if (!TG_BOT_TOKEN || !TG_CHAT_ID) {
log(“⚠️  Telegram not configured – skipping notification.”);
return;
}
const url = `https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`;
const body = JSON.stringify({ chat_id: TG_CHAT_ID, text: message, parse_mode: “HTML” });
try {
const res = await fetch(url, {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body,
});
const json = await res.json();
if (json.ok) log(“📲  Telegram notification sent.”);
else log(`Telegram error: ${JSON.stringify(json)}`);
} catch (err) {
log(`Telegram fetch error: ${err.message}`);
}
}

async function checkCourts(browser) {
const page = await browser.newPage();
await page.setViewport({ width: 1280, height: 900 });

try {
// ── 1. Login ──────────────────────────────────────────────────────────────
log(“Logging in…”);
await page.goto(LOGIN_URL, { waitUntil: “networkidle2”, timeout: 40000 });

```
// Dismiss cookie banner if present
try { await page.click("#CookiesPolicyOK", { timeout: 3000 }); } catch (_) {}

// Try common MatchPoint field selectors
const emailSel = [
  "#ctl00_MainContent_txtEmail",
  'input[name*="email" i]',
  'input[type="email"]',
  'input[id*="Email"]',
].join(", ");

const passSel = [
  "#ctl00_MainContent_txtPassword",
  'input[name*="pass" i]',
  'input[type="password"]',
  'input[id*="Password"]',
].join(", ");

await page.waitForSelector(emailSel, { timeout: 10000 });
await page.type(emailSel, EMAIL, { delay: 40 });
await page.type(passSel, PASSWORD, { delay: 40 });

await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle2", timeout: 40000 }),
  page.click('input[type="submit"], button[type="submit"], #ctl00_MainContent_btnLogin'),
]);

if (page.url().includes("Login.aspx")) {
  log("❌  Login failed. Check EGP_EMAIL and EGP_PASSWORD.");
  await sendTelegram("❌ <b>EGP Monitor:</b> Login failed – check your credentials.");
  await page.close();
  return;
}
log("✅  Logged in.");

// ── 2. Go to booking page ─────────────────────────────────────────────────
const date     = TARGET_DATE || todayString();
const bookUrl  = `${BOOK_URL}?date=${date}`;
log(`Checking availability for ${date}…`);
await page.goto(bookUrl, { waitUntil: "networkidle2", timeout: 40000 });

// Wait a moment for any JS rendering
await new Promise(r => setTimeout(r, 2000));

// ── 3. Scrape available private slots ─────────────────────────────────────
const slots = await page.evaluate(() => {
  const found = [];

  // Helper: is this element likely an available slot?
  function isAvailable(el) {
    const cls = (el.className || "").toLowerCase();
    return (
      (cls.includes("available") || cls.includes("libre") || cls.includes("free")) &&
      !cls.includes("occupied") &&
      !cls.includes("booked") &&
      !cls.includes("blocked") &&
      !cls.includes("disabled")
    );
  }

  // Helper: does this text mention a private court?
  function mentionsPrivate(str) {
    return /private|privado/i.test(str);
  }

  // Strategy A: scan all clickable cells
  document.querySelectorAll("td, div[class*='slot'], div[class*='cell']").forEach(el => {
    if (!isAvailable(el)) return;
    const combined = el.textContent + " " + el.getAttribute("title") + " " + el.getAttribute("aria-label");
    if (mentionsPrivate(combined)) {
      found.push({
        method:  "cell-scan",
        text:    el.textContent.trim().slice(0, 100),
        title:   (el.getAttribute("title") || "").slice(0, 80),
      });
    }
  });

  // Strategy B: scan table rows whose header mentions "private"
  document.querySelectorAll("tr").forEach(row => {
    const header = row.querySelector("th, td:first-child");
    if (!header || !mentionsPrivate(header.textContent)) return;

    row.querySelectorAll("td").forEach(cell => {
      if (isAvailable(cell)) {
        found.push({
          method: "row-scan",
          court:  header.textContent.trim(),
          time:   cell.textContent.trim().slice(0, 60),
        });
      }
    });
  });

  // Strategy C: look for links/buttons that say "Book" inside a private court section
  document.querySelectorAll("a, button").forEach(el => {
    const txt = el.textContent.trim().toLowerCase();
    if (txt !== "book" && txt !== "reservar") return;

    // Walk up to find court context
    let parent = el.parentElement;
    let depth  = 0;
    while (parent && depth < 6) {
      if (mentionsPrivate(parent.textContent)) {
        found.push({
          method: "book-button",
          context: parent.textContent.trim().slice(0, 120),
        });
        break;
      }
      parent = parent.parentElement;
      depth++;
    }
  });

  return found;
});

// ── 4. Report ─────────────────────────────────────────────────────────────
if (slots.length > 0) {
  log(`🎾  ${slots.length} private slot(s) available!`);
  slots.forEach((s, i) => log(`  [${i+1}] ${JSON.stringify(s)}`));

  const lines = slots.map((s, i) =>
    `${i+1}. ${s.court || ""} ${s.time || s.text || s.context || ""}`.trim()
  ).join("\n");

  await sendTelegram(
    `🎾 <b>Private Court Available!</b>\n\n` +
    `📅 Date: ${date}\n` +
    `🕐 Slots found: ${slots.length}\n\n` +
    `${lines}\n\n` +
    `👉 <a href="${BOOK_URL}?date=${date}">Book now</a>`
  );
} else {
  log("No available private slots found.");
}
```

} catch (err) {
log(`Error: ${err.message}`);
await sendTelegram(`⚠️ <b>EGP Monitor error:</b> ${err.message}`);
} finally {
await page.close();
}
}

// ── Main ──────────────────────────────────────────────────────────────────────
(async () => {
log(“🎾  East Grinstead Padel court monitor starting…”);
log(`Checking every ${CHECK_EVERY_MINS} minute(s).`);

const browser = await puppeteer.launch({
headless: true,
args: [
“–no-sandbox”,
“–disable-setuid-sandbox”,
“–disable-dev-shm-usage”,
“–disable-gpu”,
],
});

async function run() {
await checkCourts(browser);
}

// Run immediately, then repeat
await run();
setInterval(run, CHECK_EVERY_MINS * 60 * 1000);

process.on(“SIGTERM”, async () => {
log(“Shutting down…”);
await browser.close();
process.exit(0);
});
})();
