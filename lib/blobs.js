const crypto = require("crypto");
const fs = require("fs");

class BlobManager {
  constructor() {
  }

  saveBlob(content) {
    const buffer = Buffer.from(content, "base64");
    const id = crypto.randomUUID();
    fs.writeFileSync(require.main.path + "/data/blobs/" + id, buffer);
    return id;
  }

  deleteBlob(id) {
    try {
      fs.unlinkSync(require.main.path + "/data/blobs/" + id);
    } catch {}
  }
}

module.exports = { BlobManager };
