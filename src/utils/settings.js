const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '../../settings.json');

const settings = {
  ltcAddress: 'ltc1qzqt2gudkap6js5a3puqymyx9vydrnfchnupdup',
  btcAddress: null,
  ethAddress: null,
  solAddress: null,
  usdtAddress: null,
  logChannelId: null,
  mercyRoleId: null,
  mode: null,
};

try {
  const saved = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8'));
  Object.assign(settings, saved);
} catch (e) {}

function save() {
  try { fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2)); } catch (e) {}
}

function getLtcAddress() { return settings.ltcAddress; }
function setLtcAddress(addr) { settings.ltcAddress = addr; save(); }
function getBtcAddress() { return settings.btcAddress; }
function setBtcAddress(addr) { settings.btcAddress = addr; save(); }
function getEthAddress() { return settings.ethAddress; }
function setEthAddress(addr) { settings.ethAddress = addr; save(); }
function getSolAddress() { return settings.solAddress; }
function setSolAddress(addr) { settings.solAddress = addr; save(); }
function getUsdtAddress() { return settings.usdtAddress; }
function setUsdtAddress(addr) { settings.usdtAddress = addr; save(); }
function getLogChannelId() { return settings.logChannelId; }
function setLogChannelId(id) { settings.logChannelId = id; save(); }
function getMercyRoleId() { return settings.mercyRoleId; }
function setMercyRoleId(id) { settings.mercyRoleId = id; save(); }
function getMode() { return settings.mode || null; }
function setMode(m) { settings.mode = m; save(); }

module.exports = {
  getLtcAddress, setLtcAddress,
  getBtcAddress, setBtcAddress,
  getEthAddress, setEthAddress,
  getSolAddress, setSolAddress,
  getUsdtAddress, setUsdtAddress,
  getLogChannelId, setLogChannelId,
  getMercyRoleId, setMercyRoleId,
  getMode, setMode,
};
