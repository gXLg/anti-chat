const express = require("express");
const cookieParser = require("cookie-parser");
const rateLimit = require("express-rate-limit");
const multer = require("multer");
const axios = require("axios");

const { ContactManager } = require("./contacts.js");
const { ChatManager } = require("./chats.js");
const { CryptoManager } = require("./crypto.js");
const { HTMLBuilder } = require("./site.js");
const { detectMimeType } = require("./mime.js");

class App {
  constructor() {
    this.hostname = null;
    this.server = null;
    this.agent = null;

    this.app = express();
    this.contacts = new ContactManager();
    this.chats = new ChatManager(this.contacts);
    this.crypto = new CryptoManager(this.contacts);
    this.html = new HTMLBuilder(this.contacts, this.chats, this.crypto);
  }

  async init(hostname) {
    const { SocksProxyAgent } = await import("socks-proxy-agent");
    this.agent = new SocksProxyAgent("socks5h://127.0.0.1:9050");

    this.crypto.init(hostname);

    const upload = multer({
      "storage": multer.memoryStorage(),
      "limits": { "fileSize": 10 * 1024 * 1024, "fieldNestingDepth": 0 }
    });

    this.app.use("/static", express.static("./static"));
    this.app.use(rateLimit({ "windowMs": 30000, "limit": 30 }))
    this.app.use(cookieParser());

    // unauthenticated endpoints

    this.app.get("/login", (req, res) => {
      if (this.crypto.verifyLogin(req.cookies)) {
        return res.redirect("/");
      }
      res.status(200).type("html").end(this.html.loginPage());
    });

    this.app.post("/login", upload.none(), (req, res) => {
      this.crypto.setCookie(res, req.body.secret);
      res.redirect("/");
    });

    this.app.post("/receive", express.json({ "limit": "10mb" }), async (req, res) => {
      // always respond the same and instantly
      res.status(200).end("OK");

      // format: { "chat": "chat id", "sender": "pub_key", "timestamp": unix, "message": "stringified JSON", "signature": base64 Sign(priv_key, Hash(chat + timestamp + message)) }

      // when creating a chat, a message of chat creation is sent to all participants
      // the chat ID is simply "" in this case
      // message format: { "chat": "new chat id", "recipients": ["pub_key of every recipient including the sender and ourself (need to filter accordingly)"] }

      let chatMessage = null;
      try {
        chatMessage = this.crypto.verifyChatMessage(req.body);
      } catch (err) { console.error(err); }
      if (chatMessage != null) {
        // handle message or chat creation
        const { chat, timestamp, sender, message } = chatMessage;

        if (chat == "") {
          const rec = message.recipients.filter(r => r != this.crypto.identity);
          rec.push(sender);
          await this.chats.addChat(message.chat, rec);
        } else {
          const { text, attachment } = message;
          await this.chats.addMessage(chat, timestamp, sender, message);
        }
      }
    });


    // authenticated endpoints

    this.app.use((req, res, next) => {
      // verify auth
      if (!this.crypto.verifyLogin(req.cookies)) {
        res.redirect("/login");
        return;
      }
      next();
    })

    this.app.get("/", (req, res) => {
      res.status(200).type("html").end(this.html.chatsPage());
    });

    this.app.get("/chat/:chatId", (req, res) => {
      res.status(200).type("html").end(this.html.messagesPage(req.params.chatId));
    });

    // create chat
    this.app.post("/chat", upload.none(), async (req, res) => {
      const { chatId, recipients } = req.body;
      const rec = [].concat(recipients);
      if (!(await this.chats.addChat(chatId, rec))) {
        return res.status(400).end("Could not create chat");
      }
      res.redirect("/chat/" + req.body.chatId);
      const newChat = this.crypto.newChat(chatId, rec);
      for (const r of rec) {
        const { hostname } = this.contacts.getSaved(r);
        try {
          await axios.post("http://" + hostname + "/receive", newChat, { "httpAgent": this.agent });
        } catch {}
      }
    });

    this.app.get("/contacts", (req, res) => {
      res.status(200).type("html").end(this.html.contactsPage());
    });

    this.app.get("/contacts/me", async (req, res) => {
      res.status(200).type("html").end(await this.html.qrcodePage());
    });

    this.app.post("/contacts", upload.none(), async (req, res) => {
      const { identity, name } = req.body;
      if (!(await this.contacts.addContact(identity, name))) {
        return res.status(400).end("Could not add contact");
      }
      res.redirect("/contacts");
    });

    this.app.post("/send/:chatId", upload.single("file"), async (req, res) => {
      const text = req.body.text ?? "";
      const fileBuffer = req.file?.buffer ?? null;
      const textSize = Buffer.byteLength(text, "utf8");
      const fileSize = req.file?.size ?? 0;
      if (textSize + fileSize > 10 * 1024 * 1024) {
        return res.status(413).end("Message too big (>10 MB)");
      }
      const message = { text };
      if (fileBuffer != null) {
        message.attachment = fileBuffer.toString("base64");
      }
      if (!(await this.chats.addMessage(req.params.chatId, Date.now(), null, message))) {
        return res.status(400).end("Could not add message");
      }
      res.redirect("/chat/" + req.params.chatId);
      const newMessage = this.crypto.createChatMessage(req.params.chatId, message.text, message.attachment ?? null);
      for (const rec of this.chats.getRecipients(req.params.chatId)) {
        const { hostname } = this.contacts.getSaved(rec);
        try {
          await axios.post("http://" + hostname + "/receive", newMessage, { "httpAgent": this.agent });
        } catch {}
      }
    });

    this.app.get("/blobs/:blobId", (req, res) => {
      res.sendFile(req.params.blobId, { "root": "./data/blobs", "headers": { "Content-Type": detectMimeType(req.params.blobId) }}, err => {
        if (err) {
          res.status(404).end("Not Found");
        }
      });
    });

    return new Promise(res => {
      this.server = this.app.listen(3000, () => res());
    });
  }

  stop() {
    this.server?.close();
  }
}

module.exports = { App };
