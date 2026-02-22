const test = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, createToken } = require('../server/utils');

test('hashPassword and verifyPassword', () => {
  const hash = hashPassword('secret');
  assert.ok(hash.includes(':'));
  assert.ok(verifyPassword('secret', hash));
  assert.ok(!verifyPassword('wrong', hash));
});

test('createToken produces a token', () => {
  const token = createToken();
  assert.ok(typeof token === 'string');
  assert.ok(token.length >= 32);
});
