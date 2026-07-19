const fs = require("fs");
const Queue = require("promise-queue");

const { BlobManager } = require("./blobs.js");

const ID_REGEX = /^[a-z][a-z0-9_]{2,}$/;
const MAX_MESSAGES = 100;

class ChatManager {
  constructor(contacts) {
    if (!fs.existsSync("./data/chats.json")) {
      fs.writeFileSync("./data/chats.json", "[]");
    }
    this.chats = JSON.parse(fs.readFileSync("./data/chats.json"));
    this.contacts = contacts;
    this.blobs = new BlobManager();

    this.chat_pipe = new Queue(1, Infinity);
    this.message_pipe = new Queue(1, Infinity);
  }

  save() {
    fs.writeFileSync("./data/chats.json", JSON.stringify(this.chats));
  }

  async addChat(id, recipients) {
    return this.chat_pipe.add(() => {
      if (!ID_REGEX.test(id)) {
        return false;
      }
      if (recipients.length == 0) {
        return false;
      }
      for (const recip of recipients) {
        if (!this.contacts.isSaved(recip)) {
          return false;
        }
      }
      for (const chat of this.chats) {
        if (chat.id == id) {
          return false;
        }
      }
      this.chats.push({ id, recipients });
      this.save();
      return true;
    });
  }

  getRecipients(id) {
    for (const chat of this.chats) {
      if (chat.id == id) {
        return chat.recipients;
      }
    }
    return [];
  }

  getMessages(id) {
    if (!ID_REGEX.test(id)) {
      return null;
    }

    let found = false;
    for (const chat of this.chats) {
      if (chat.id == id) {
        found = true;
        break;
      }
    }
    if (!found) {
      return null;
    }

    if (!fs.existsSync("./data/chats/" + id + ".json")) {
      return [];
    }

    return JSON.parse(fs.readFileSync("./data/chats/" + id + ".json"));
  }

  // own messages: sender = null
  async addMessage(chatId, timestamp, sender, message) {
    return this.message_pipe.add(() => {
      const messages = this.getMessages(chatId);
      if (messages == null) {
        return false;
      }
      const { text, attachment } = message;
      const obj = { timestamp, sender };
      obj.text = text ?? "";
      if (attachment != null) {
        const blob = this.blobs.saveBlob(attachment);
        obj.blob = blob;
      }
      // handle deletion
      if (messages.length == MAX_MESSAGES) {
        const { blob } = messages.pop();
        if (blob != null) {
          this.blobs.deleteBlob(blob);
        }
      }
      messages.unshift(obj);
      fs.writeFileSync("./data/chats/" + chatId + ".json", JSON.stringify(messages));
      return true;
    });
  }
}

module.exports = { ChatManager };
