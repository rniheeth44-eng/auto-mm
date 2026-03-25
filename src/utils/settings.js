const fs = require('fs');
const path = require('path');

const SETTINGS_PATH = path.join(__dirname, '../../settings.json');

const settings = {
  ltcAddress: 'ltc1qzqt2gudkap6js5a3puqymyx9vydrnfchnupdup',
  logChannelId: null,
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
function getLogChannelId() { return settings.logChannelId; }
function setLogChannelId(id) { settings.logChannelId = id; save(); }

module.exports = { getLtcAddress, setLtcAddress, getLogChannelId, setLogChannelId };
