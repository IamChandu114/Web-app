const crypto = require('crypto');

const hashPassword = (password, salt = crypto.randomBytes(16).toString('hex')) => {
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return `${salt}:${hash}`;
};

const verifyPassword = (password, stored) => {
  if (!stored) return false;
  const [salt, original] = stored.split(':');
  if (!salt || !original) return false;
  const hash = crypto.pbkdf2Sync(password, salt, 100000, 64, 'sha512').toString('hex');
  return crypto.timingSafeEqual(Buffer.from(original, 'hex'), Buffer.from(hash, 'hex'));
};

const createToken = () => crypto.randomBytes(32).toString('hex');

const createId = prefix => `${prefix}_${crypto.randomBytes(8).toString('hex')}`;

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  createId
};
