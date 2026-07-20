const crypto = require("crypto");
const fs = require("fs");
const Queue = require("promise-queue");

const NAME_REGEX = /^[a-zA-Z][a-zA-Z0-9-_ ]*$/;

class ContactManager {
  constructor(contacts) {
    if (!fs.existsSync(require.main.path + "/data/contacts.json")) {
      fs.writeFileSync(require.main.path + "/data/contacts.json", "[]");
    }
    this.contacts = JSON.parse(fs.readFileSync(require.main.path + "/data/contacts.json"));
    this.pipe = new Queue(1, Infinity);
  }

  save() {
    fs.writeFileSync(require.main.path + "/data/contacts.json", JSON.stringify(this.contacts));
  }

  isSaved(identity) {
    for (const { id, hostname, pub, name } of this.contacts) {
      if (id == identity) {
        return true;
      }
    }
    return false;
  }

  getSaved(identity) {
    for (const { id, hostname, pub, name } of this.contacts) {
      if (id == identity) {
        const key = crypto.createPublicKey(pub);
        return { name, hostname, "pub": key };
      }
    }
    return null;
  }

  async addContact(identity, displayname) {
    return this.pipe.add(() => {
      if (!NAME_REGEX.test(displayname)) {
        return false;
      }
      for (const { id, hostname, pub, name } of this.contacts) {
        if (id == identity || displayname == name) {
          return false;
        }
      }
      const [hostname, pub] = JSON.parse(atob(identity));
      this.contacts.push({ "name": displayname, hostname, pub, "id": identity });
      this.save();
      return true;
    });
  }
}

module.exports = { ContactManager };
