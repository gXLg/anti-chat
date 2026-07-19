const { TorContainer } = require("./lib/tor.js");
const { App } = require("./lib/app.js");

(async () => {

  const tor = new TorContainer();
  const app = new App();

  process.once("SIGINT", async () => {
    await tor.stop();
    app.stop();
  });

  const hostname = await tor.init();
  await app.init(hostname);

  console.log("Running on", hostname);

})();
