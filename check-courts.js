const puppeteer = require("puppeteer");

const EMAIL        = process.env.EGP_EMAIL    || "";
const PASSWORD     = process.env.EGP_PASSWORD || "";
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN || "";
const TG_CHAT_ID   = process.env.TG_CHAT_ID   || "";
const TARGET_DATE  = process.env.TARGET_DATE  || "";

const BASE_URL  = "https://eastgrinsteadpadel-gb.matchpoint.com.es";
const LOGIN_URL = BASE_URL + "/Login.aspx";
const BOOK_URL  = BASE_URL + "/Bookings/CreateBooking.aspx";

function todayString() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth()+1).padStart(2,"0") + "-" + String(d.getDate()).padStart(2,"0");
}

function log(msg) {
  console.log("[" + new Date().toISOString() + "] " + msg);
}

async function sendTelegram(message) {
  if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
  try {
    const res = await fetch("https://api.telegram.org/bot" + TG_BOT_TOKEN + "/sendMessage", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TG_CHAT_ID, text: message, parse_mode: "HTML" }),
    });
    const json = await res.json();
    if (json.ok) log("Telegram notification sent.");
    else log("Telegram error: " + JSON.stringify(json));
  } catch (e) {
    log("Telegram send failed: " + e.message);
  }
}

async function main() {
  const date = TARGET_DATE || todayString();
  log("Checking private court availability for " + date);

  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  try {
    log("Navigating to login page...");
    await page.goto(LOGIN_URL, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    try { await page.click("#CookiesPolicyOK", { timeout: 1000 }); } catch (_) {}

    const title = await page.title();
    log("Page title: " + title);

    const inputs = await page.evaluate(function() {
      return Array.from(document.querySelectorAll("input")).map(function(i) {
        return { type: i.type, id: i.id, name: i.name, placeholder: i.placeholder };
      });
    });
    log("Inputs found: " + JSON.stringify(inputs));

    var emailSel = null;
    var emailOptions = [
      "#ctl00_MainContent_txtEmail",
      "#txtEmail",
      "input[type=email]",
      "input[name=email]",
    ];
    for (var i = 0; i < emailOptions.length; i++) {
      try {
        await page.waitForSelector(emailOptions[i], { timeout: 2000 });
        emailSel = emailOptions[i];
        break;
      } catch (_) {}
    }

    if (!emailSel) throw new Error("Could not find email field");
    await page.click(emailSel);
    await page.type(emailSel, EMAIL, { delay: 40 });
    log("Filled email using: " + emailSel);

    var passSel = null;
    var passOptions = [
      "#ctl00_MainContent_txtPassword",
      "#txtPassword",
      "input[type=password]",
    ];
    for (var j = 0; j < passOptions.length; j++) {
      try {
        await page.waitForSelector(passOptions[j], { timeout: 2000 });
        passSel = passOptions[j];
        break;
      } catch (_) {}
    }

    if (!passSel) throw new Error("Could not find password field");
    await page.click(passSel);
    await page.type(passSel, PASSWORD, { delay: 40 });
    log("Filled password using: " + passSel);

    var submitOptions = [
      "#ctl00_MainContent_btnLogin",
      "input[type=submit]",
      "button[type=submit]",
    ];
    for (var k = 0; k < submitOptions.length; k++) {
      try {
        await Promise.all([
          page.waitForNavigation({ waitUntil: "networkidle2", timeout: 40000 }),
          page.click(submitOptions[k]),
        ]);
        log("Submitted using: " + submitOptions[k]);
        break;
      } catch (_) {}
    }

    if (page.url().includes("Login.aspx")) {
      throw new Error("Still on login page - credentials may be wrong");
    }
    log("Logged in successfully.");

    log("Loading booking page for " + date);
    await page.goto(BOOK_URL + "?date=" + date, { waitUntil: "networkidle2", timeout: 60000 });
    await new Promise(r => setTimeout(r, 3000));

    const slots = await page.evaluate(function() {
      var found = [];

      function isAvailable(el) {
        var cls = (el.className || "").toLowerCase();
        return (
          (cls.includes("available") || cls.includes("libre") || cls.includes("free")) &&
          !cls.includes("occupied") && !cls.includes("booked") &&
          !cls.includes("blocked") && !cls.includes("disabled")
        );
      }

      function mentionsPrivate(str) {
        return /private|privado/i.test(str);
      }

      document.querySelectorAll("td").forEach(function(el) {
        if (!isAvailable(el)) return;
        var combined = el.textContent + " " + (el.getAttribute("title") || "");
        if (mentionsPrivate(combined)) {
          found.push({ text: el.textContent.trim().slice(0, 100) });
        }
      });

      document.querySelectorAll("tr").forEach(function(row) {
        var header = row.querySelector("th, td:first-child");
        if (!header || !mentionsPrivate(header.textContent)) return;
        row.querySelectorAll("td").forEach(function(cell) {
          if (isAvailable(cell)) {
            found.push({ court: header.textContent.trim(), time: cell.textContent.trim().slice(0, 60) });
          }
        });
      });

      return found;
    });

    if (slots.length > 0) {
      log("Found " + slots.length + " private slot(s)!");
      var lines = slots.map(function(s, i) {
        return (i+1) + ". " + (s.court || "") + " " + (s.time || s.text || "");
      }).join("\n");
      await sendTelegram(
        "🎾 Private Court Available!\n\n" +
        "Date: " + date + "\n" +
        "Slots: " + slots.length + "\n\n" +
        lines + "\n\n" +
        "Book now: " + BOOK_URL + "?date=" + date
      );
    } else {
      log("No available private slots found this check.");
    }

  } catch (err) {
    log("Error: " + err.message);
    await sendTelegram("EGP Monitor error: " + err.message);
    process.exit(1);
  } finally {
    await browser.close();
  }
}

main();
