const crypto = require("crypto");

function hashPin(pin, salt) {
  return crypto.scryptSync(String(pin), salt, 64).toString("hex");
}

function pinsMatch(pin, salt, hash) {
  const test = Buffer.from(hashPin(pin, salt), "hex");
  const actual = Buffer.from(hash, "hex");
  if (test.length !== actual.length) return false;
  return crypto.timingSafeEqual(test, actual);
}

function newSalt() {
  return crypto.randomBytes(16).toString("hex");
}

module.exports = { hashPin, pinsMatch, newSalt };
