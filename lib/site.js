const fs = require("fs");
const qrcode = require("qrcode");

class HTMLBuilder {
  constructor(contacts, chats, crypto) {
    this._root = fs.readFileSync(require.main.path + "/html/root.html", "utf-8");
    this._login = fs.readFileSync(require.main.path + "/html/login.html", "utf-8");
    this._chats = fs.readFileSync(require.main.path + "/html/chats.html", "utf-8");
    this._chat = fs.readFileSync(require.main.path + "/html/chat.html", "utf-8");
    this._contacts = fs.readFileSync(require.main.path + "/html/contacts.html", "utf-8");
    this._contact = fs.readFileSync(require.main.path + "/html/contact.html", "utf-8");
    this._qrcode = fs.readFileSync(require.main.path + "/html/qrcode.html", "utf-8");
    this._messages = fs.readFileSync(require.main.path + "/html/messages.html", "utf-8");
    this._message = fs.readFileSync(require.main.path + "/html/message.html", "utf-8");


    this.contacts = contacts;
    this.chats = chats;
    this.crypto = crypto;
  }

  loginPage() {
    return this._root.replace("{{content}}", this._login);
  }

  chatsPage() {
    const html = [];
    for (const chat of this.chats.chats) {
      const name = chat.id;
      const rec = [];
      for (const id of chat.recipients) {
        const c = this.contacts.getSaved(id);
        rec.push(c?.name ?? "???");
      }
      html.push(this._chat.replaceAll("{{name}}", name).replace("{{recipients}}", rec.join(", ")));
    }
    const chats = this._chats.replace("{{chats}}", html.join(""));
    return this._root.replace("{{content}}", chats);
  }

  contactsPage() {
    const html = [];
    for (const { id, hostname, name } of this.contacts.contacts) {
      html.push(this._contact.replace("{{identity}}", id).replace("{{hostname}}", hostname).replace("{{name}}", name));
    }
    const contacts = this._contacts.replace("{{contacts}}", html.join(""));
    return this._root.replace("{{content}}", contacts);
  }

  async qrcodePage() {
    const data = await qrcode.toDataURL(this.crypto.identity, { "errorCorrectionLevel": "Q" });
    return this._root.replace("{{content}}", this._qrcode.replace("{{qrcode}}", data));
  }

  messagesPage(chatId) {
    const messages = this.chats.getMessages(chatId);
    if (messages == null) {
      return "Could not load messages";
    }
    const html = [];
    for (const { timestamp, sender, text, blob } of messages) {
      let name;
      if (sender == null) {
        name = "<i>You</i>";
      } else {
        const contact = this.contacts.getSaved(sender);
        name = contact?.name  ?? "???";
      }
      const time = (new Date(timestamp)).toISOString().split(".")[0].replace("T", " ");
      const txt = (text ?? "").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll(/[\r\n]+/g, "<br>");
      let blb = "";
      if (blob != null) {
        blb = "<a href=\"/blobs/" + blob + "\" target=\"_blank\" class=\"blob\">Blob</a>"
      }
      html.push(this._message.replace("{{sender}}", name).replace("{{time}}", time).replace("{{text}}", txt).replace("{{blob}}", blb));
    }
    const rec = this.chats.getRecipients(chatId).map(r => this.contacts.getSaved(r)?.name ?? "???");
    const m = this._messages.replaceAll("{{name}}", chatId).replace("{{recipients}}", rec.join(", ")).replace("{{messages}}", html.join(""));
    return this._root.replace("{{content}}", m);
  }
}

module.exports = { HTMLBuilder };
