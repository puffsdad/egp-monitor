/**

- East Grinstead Padel – Private Court Monitor
- Runs as a GitHub Action — checks once and exits.
- GitHub triggers it on a schedule (every 10 mins).
- 
- Do NOT put credentials here — add them as GitHub Secrets.
- See the setup guide for instructions.
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
const res = await fetch(`https://api.telegram.org/bot${TG_BOT_TOKEN}/sendMessage`, {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({ chat_id: TG_CHAT_ID, text: message, parse_mode: “HTML” }),
});
const json = await res.json();
if (json.ok) log(“📲 Telegram notification sent.”);
else log(`Telegram error: ${JSON.stringify(json)}`);
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

try {
// ── Login ──────────────────────────────────────────────────────────────
log(“Logging in…”);
await page.goto(LOGIN_URL, { waitUntil: “networkidle2”, timeout: 40000 });

```
try { await page.click("#CookiesPolicyOK", { timeout: 3000 }); } catch (_) {}

const emailSel = [
  "#ctl00_MainContent_txtEmail",
  'input[name*="email" i]',
  'input[type="email"]',
].join(", ");

const passSel = [
  "#ctl00_MainContent_txtPassword",
  'input[name*="pass" i]',
  'input[type="password"]',
].join(", ");

await page.waitForSelector(emailSel, { timeout: 10000 });
await page.type(emailSel, EMAIL, { delay: 40 });
await page.type(passSel, PASSWORD, { delay: 40 });

await Promise.all([
  page.waitForNavigation({ waitUntil: "networkidle2", timeout: 40000 }),
  page.click('input[type="submit"], button[type="submit"], #ctl00_MainContent_btnLogin'),
]);

if (page.url().includes("Login.aspx")) {
  log("❌ Login failed — check EGP_EMAIL and EGP_PASSWORD secrets.");
  await sendTelegram("❌ <b>EGP Monitor:</b> Login failed – check your credentials.");
  process.exit(1);
}
log("✅ Logged in.");

// ── Load booking page ──────────────────────────────────────────────────
await page.goto(`${BOOK_URL}?date=${date}`, { waitUntil: "networkidle2", timeout: 40000 });
await new Promise(r => setTimeout(r, 2000));

// ── Scrape available private slots ─────────────────────────────────────
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

  // Scan individual cells
  document.querySelectorAll("td, div[class*='slot'], div[class*='cell']").forEach(el => {
    if (!isAvailable(el)) return;
    const combined = el.textContent + " " + (el.getAttribute("title") || "") + " " + (el.getAttribute("aria-label") || "");
    if (mentionsPrivate(combined)) {
      found.push({ text: el.textContent.trim().slice(0, 100), title: (el.getAttribute("title") || "").slice(0, 80) });
    }
  });

  // Scan table rows whose header says "private"
  document.querySelectorAll("tr").forEach(row => {
    const header = row.querySelector("th, td:first-child");
    if (!header || !mentionsPrivate(header.textContent)) return;
    row.querySelectorAll("td").forEach(cell => {
      if (isAvailable(cell)) {
        found.push({ court: header.textContent.trim(), time: cell.textContent.trim().slice(0, 60) });
      }
    });
  });

  // Look for Book buttons inside private court sections
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

// ── Report ─────────────────────────────────────────────────────────────
if (slots.length > 0) {
  log(`🎾 ${slots.length} private slot(s) available!`);
  const lines = slots.map((s, i) =>
    `${i + 1}. ${[s.court, s.time, s.text, s.context].filter(Boolean).join(" – ")}`.trim()
  ).join("\n");

  await sendTelegram(
    `🎾 <b>Private Court Available!</b>\n\n` +
    `📅 Date: ${date}\n` +
    `🕐 Slots found: ${slots.length}\n\n` +
    `${lines}\n\n` +
    `👉 <a href="${BOOK_URL}?date=${date}">Book now</a>`
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
