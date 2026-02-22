const fs = require('fs');
const path = require('path');

const dataDir = path.join(__dirname, 'data');

const readJson = (file, fallback) => {
  try {
    const filePath = path.join(dataDir, file);
    if (!fs.existsSync(filePath)) return fallback;
    const raw = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return fallback;
  }
};

const writeJson = (file, data) => {
  fs.mkdirSync(dataDir, { recursive: true });
  fs.writeFileSync(path.join(dataDir, file), JSON.stringify(data, null, 2));
};

const getUsers = () => readJson('users.json', []);
const setUsers = data => writeJson('users.json', data);

const getOrders = () => readJson('orders.json', []);
const setOrders = data => writeJson('orders.json', data);

const getSessions = () => readJson('sessions.json', []);
const setSessions = data => writeJson('sessions.json', data);

module.exports = {
  getUsers,
  setUsers,
  getOrders,
  setOrders,
  getSessions,
  setSessions
};
