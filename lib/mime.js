const { spawnSync } = require("child_process");

function detectMimeType(blobId) {
  const file = spawnSync("file", ["-biE", require.main.path + "/data/blobs/" + blobId]);
  if (file.status != 0) {
    return "application/octet-stream";
  }
  return file.stdout.toString("utf-8").trim();
}

module.exports = { detectMimeType };
