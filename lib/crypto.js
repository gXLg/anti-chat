const fs = require("fs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");

const LOGIN_DURATION = 30 * 24 * 60 * 60 * 1000; // 30 days
const TOKEN = "anti.chat.auth";

class CryptoManager {
  constructor(contacts) {
    this.pub = null;
    this.priv = null;
    this.secret = null;
    this.jwt = null;
    this.identity = null;
    this.contacts = contacts;
  }

  init(hostname) {
    if (!fs.existsSync("./data/identity.json")) {
      const { publicKey, privateKey } = crypto.generateKeyPairSync("ed25519");
      const secret = crypto.randomUUID();
      const jwt = crypto.randomUUID();
      const identity = {
        "pub": publicKey.export({ "type": "spki", "format": "pem" }),
        "priv": privateKey.export({ "type": "pkcs8", "format": "pem" }),
        secret, jwt
      };
      fs.writeFileSync("./data/identity.json", JSON.stringify(identity, null, 2));
    }
    const { pub, priv, secret, jwt } = JSON.parse(fs.readFileSync("./data/identity.json"));

    this.pub = crypto.createPublicKey(pub);
    this.priv = crypto.createPrivateKey(priv);
    this.secret = secret;
    this.jwt = jwt;
    this.hostname = hostname;
    this.identity = btoa(JSON.stringify([hostname, pub]));
  }

  // chat: id, text: utf8 string, attachment:  base64 string
  createChatMessage(chat, text, attachment) {
    const message = JSON.stringify({ text, attachment });
    const timestamp = Date.now();
    const payload = Buffer.from(JSON.stringify([chat, timestamp, message]));
    const signature = crypto.sign(null, payload, this.priv).toString("base64");
    const sender = this.identity;
    return { chat, timestamp, sender, message, signature };
  }

  // chat: id, recipients: array of identities
  newChat(chat, recipients) {
    const message = JSON.stringify({ chat, recipients });
    const timestamp = Date.now();
    const payload = Buffer.from(JSON.stringify(["", timestamp, message]));
    const signature = crypto.sign(null, payload, this.priv).toString("base64");
    const sender = this.identity;
    return { "chat": "", timestamp, sender, message, signature };
  }

  verifyChatMessage(body) {
    const { chat, timestamp, sender, message, signature } = body;
    const now = Date.now();
    console.log(chat, timestamp, sender, message, signature);

    // only allow messages 2s from the "future" (local time mismatch)
    if (timestamp - now > 2000) {
      console.log("2s");
      return null;
    }

    // only allow messages 30s from the past (connection timings)
    if (now - timestamp > 30_000) {
      console.log("30s");
      return null;
    }

    // only allow messages from saved contacts
    const contact = this.contacts.getSaved(sender);
    if (contact == null) {
      console.log("contact");
      return null;
    }

    // verify signature
    const payload = Buffer.from(JSON.stringify([chat, timestamp, message]));
    if (!crypto.verify(null, payload, contact.pub, Buffer.from(signature, "base64"))) {
      console.log("crypto");
      return null;
    }

    return { chat, timestamp, sender, "message": JSON.parse(message) };
  }

  verifyLogin(cookies) {
    const token = cookies[TOKEN];
    if (token == null) return false;
    try {
      const d = jwt.verify(token, this.jwt);
      return bcrypt.compareSync(this.secret, d.secret); // reversed comparison - backend in has plaintext, client has bcrypt
    } catch {
      return false;
    }
  }

  setCookie(res, secret) {
    const token = jwt.sign({ "secret": bcrypt.hashSync(secret ?? "") }, this.jwt, { "expiresIn": LOGIN_DURATION.toString() });
    const options = {
      "httpOnly": true,
      "sameSite": true,
      "maxAge": LOGIN_DURATION
    };
    res.cookie(TOKEN, token, options);
  }
}

module.exports = { CryptoManager };
