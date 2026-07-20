const { spawn } = require("child_process");
const fs = require("fs");

const { APP_PORT, SOCKS_PORT } = require("./ports.js");

function getBinaryName() {
  if (process.platform != "linux") {
    throw new Error(`Unsupported platform: ${process.platform}`);
  }
  switch (process.arch) {
    case "x64":
      return "linux-x86";
    case "arm64":
      return "linux-aarch64";
    default:
      throw new Error(`Unsupported architecture: ${process.arch}`);
  }
}

const torDir = require.main.path + "/embedded-tor/" + getBinaryName();

class TorContainer {
  contructor() {
    this.tor = null;
    this.hostname = null;
  }

  async init() {
    let resolve, reject;
    const promise = new Promise((r, j) => {
      resolve = r;
      reject = j;
    });

    fs.writeFileSync(require.main.path + "/data/torrc", [
      `DataDirectory ${require.main.path}/data/tor`,
      `HiddenServiceDir ${require.main.path}/data/onion`,
      `HiddenServicePort 80 127.0.0.1:${APP_PORT}`,
      `SocksPort ${SOCKS_PORT}`
    ].join("\n"));

    this.tor = spawn(
      `${torDir}/tor`,
      ["-f", require.main.path + "/data/torrc"],
      {
        "env": { ...process.env, "LD_LIBRARY_PATH": torDir },
        "detatched": true
      }
    );

    this.tor.once("exit", () => {
      reject();
    });

    let output = "";
    this.tor.stdout.on("data", data => {
      const str = data.toString("utf-8");
      output += str;
      process.stdout.write(str);
      if (output.includes("Bootstrapped 100% (done): Done")) {
        this.tor.stdout.removeAllListeners("data");
        this.tor.removeAllListeners("exit");
        resolve();
      }
    });

    await promise;
    this.hostname = fs.readFileSync(require.main.path + "/data/onion/hostname", "utf-8").trim();
    return this.hostname;
  }

  async stop() {
    const p = new Promise(r => this.tor.once("exit", r));
    this.tor.kill("SIGINT");
    const force = setTimeout(() => this.tor.kill("SIGKILL"), 5000);
    await p;
    clearTimeout(force);
  }
}

module.exports = { TorContainer };
