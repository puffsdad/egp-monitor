// East Grinstead Padel - Private Court Monitor
// Uses the MatchPoint mobile API directly - no browser 

const EMAIL        = process.env.EGP_EMAIL;
const PASSWORD     = process.env.EGP_PASSWORD;
const TG_BOT_TOKEN = process.env.TG_BOT_TOKEN;
const TG_CHAT_ID   = process.env.TG_CHAT_ID;
const TARGET_DATE  = process.env.TARGET_DATE;

const BASE        = “https://eastgrinsteadpadel-gb.matchpoint.com.es”;
const API         = BASE + “/services/mobi/appservices/v1”;
const DEVICE_ID   = “179a23c38a4ac2d4f9e68e15c0ef5b0f4773c7980f20eec16d1f874e6469f453”;
const APP_GUID    = “eastgrinsteadpadel”;
const VENUE_ID    = “2”;
const BOOK_URL    = BASE + “/Bookings/CreateBooking.aspx”;

function todayString() {
var d = new Date();
return String(d.getDate()).padStart(2,“0”) + “/” +
String(d.getMonth()+1).padStart(2,“0”) + “/” +
d.getFullYear();
}

function log(msg) {
console.log(”[” + new Date().toISOString() + “] “ + msg);
}

function dateForUrl(dateStr) {
// Convert DD/MM/YYYY to YYYY-MM-DD for the booking URL
var parts = dateStr.split(”/”);
return parts[2] + “-” + parts[1] + “-” + parts[0];
}

async function apiPost(path, body, userToken) {
var headers = {
“Content-Type”: “application/json”,
“Accept”: “application/json”,
“selectedvenueid”: VENUE_ID,
“userlang”: “en-GB”,
“User-Agent”: “EGPadel/95 CFNetwork/3860.400.51 Darwin/25.3.0”,
“Cache-Control”: “no-cache”
};
if (userToken) {
headers[“userToken”] = userToken;
}
var res = await fetch(BASE + path, {
method: “POST”,
headers: headers,
body: JSON.stringify(body)
});
return res.json();
}

async function sendTelegram(message) {
if (!TG_BOT_TOKEN || !TG_CHAT_ID) return;
try {
var res = await fetch(“https://api.telegram.org/bot” + TG_BOT_TOKEN + “/sendMessage”, {
method: “POST”,
headers: { “Content-Type”: “application/json” },
body: JSON.stringify({ chat_id: TG_CHAT_ID, text: message })
});
var json = await res.json();
if (json.ok) log(“Telegram notification sent.”);
else log(“Telegram error: “ + JSON.stringify(json));
} catch (e) {
log(“Telegram error: “ + e.message);
}
}

async function main() {
var fecha = TARGET_DATE ? TARGET_DATE.replace(/-/g, “/”).split(”/”).reverse().join(”/”) : todayString();
// fecha is now DD/MM/YYYY
log(“Checking courts for “ + fecha);

// Step 1: Login
log(“Logging in via API…”);
var loginRes = await apiPost(
“/services/mobi/appservices/v1/cuenta.svc/LoginWithDeviceIdAndAppGUID”,
{
password: PASSWORD,
APPGUID: APP_GUID,
deviceID: DEVICE_ID,
deviceOS: “iphone”,
deviceOSVersion: “26.3.1”,
user: EMAIL
}
);

if (!loginRes.Autentificado) {
log(“Login failed: “ + JSON.stringify(loginRes));
await sendTelegram(“EGP Monitor: Login failed - check your email and password”);
process.exit(1);
}

var userToken = loginRes.UserState;
log(“Logged in! Token received.”);

// Step 2: Get court availability
log(“Fetching court availability…”);
var courtsRes = await apiPost(
“/services/mobi/appservices/v1/reservas.svc/ObtenerCuadroReservas2”,
{
tipo: “cuadroreservas”,
cuadro: “4”,
fecha: fecha
},
userToken
);

if (!courtsRes.Correcto) {
log(“Failed to get courts: “ + JSON.stringify(courtsRes));
await sendTelegram(“EGP Monitor: Failed to fetch court data”);
process.exit(1);
}

log(“Court data received. Scanning for available private slots…”);

// Step 3: Find available private court slots
var respuesta = courtsRes.Respuesta;
var grupos = respuesta.Grupos || [];
var availableSlots = [];

grupos.forEach(function(grupo) {
var pistas = grupo.Pistas || [];
pistas.forEach(function(pista) {
var nombre = (pista.Nombre || pista.NombrePista || “”).toLowerCase();
var isPrivate = nombre.includes(“private”) || nombre.includes(“privado”) || nombre.includes(“priv”);

```
  if (!isPrivate) return;

  var horas = pista.Horas || pista.Slots || pista.HorasDisponibles || [];
  horas.forEach(function(hora) {
    var libre = hora.Libre || hora.Disponible || hora.Available || hora.Estado === "libre";
    if (libre) {
      availableSlots.push({
        court: pista.Nombre || pista.NombrePista || "Private Court",
        time: hora.Hora || hora.HoraInicio || hora.Time || "?"
      });
    }
  });
});
```

});

// Also scan top-level if structure is different
if (availableSlots.length === 0) {
var allPistas = respuesta.Pistas || [];
allPistas.forEach(function(pista) {
var nombre = (pista.Nombre || pista.NombrePista || “”).toLowerCase();
var isPrivate = nombre.includes(“private”) || nombre.includes(“privado”) || nombre.includes(“priv”);
if (!isPrivate) return;

```
  var horas = pista.Horas || pista.Slots || [];
  horas.forEach(function(hora) {
    var libre = hora.Libre || hora.Disponible || hora.Available || hora.Estado === "libre";
    if (libre) {
      availableSlots.push({
        court: pista.Nombre || "Private Court",
        time: hora.Hora || hora.HoraInicio || "?"
      });
    }
  });
});
```

}

// Step 4: Report results
if (availableSlots.length > 0) {
log(“FOUND “ + availableSlots.length + “ available private slot(s)!”);
var lines = availableSlots.map(function(s, i) {
return (i+1) + “. “ + s.court + “ at “ + s.time;
}).join(”\n”);
await sendTelegram(
“🎾 Private Court Available!\n\n” +
“Date: “ + fecha + “\n” +
“Slots: “ + availableSlots.length + “\n\n” +
lines + “\n\n” +
“Book now: “ + BOOK_URL + “?date=” + dateForUrl(fecha)
);
} else {
log(“No available private slots found.”);
// Uncomment the next line if you want a Telegram message every check (not recommended!)
// await sendTelegram(“EGP Monitor: No private slots available for “ + fecha);

```
// Log what we DID find so we can debug if needed
log("Groups found: " + grupos.length);
if (grupos.length > 0) {
  var sample = JSON.stringify(grupos[0]).slice(0, 500);
  log("Sample group data: " + sample);
}
```

}
}

main().catch(function(err) {
console.error(“Fatal error: “ + err.message);
process.exit(1);
});