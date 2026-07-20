const fs = require("fs");

let _app = 3000;
let _socks = 9050;

if (fs.existsSync(require.main.path + "/ports.json")) {
  const { app, socks } = JSON.parse(fs.readFileSync(require.main.path + "/ports.json"));
  if (app != null) {
    _app = parseInt(app);
  }
  if (socks != null) {
    _socks = parseInt(socks);
  }
}

module.exports = {
  "APP_PORT": _app,
  "SOCKS_PORT": _socks
};
