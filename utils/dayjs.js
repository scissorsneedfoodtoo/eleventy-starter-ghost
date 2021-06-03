const dayjs = require('dayjs');
const localizedFormat = require('dayjs/plugin/localizedFormat');
const relativeTime = require('dayjs/plugin/relativeTime');

// Include dayjs locales
require('dayjs/locale/es');
require('dayjs/locale/zh');

// Load dayjs plugins
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);

const siteData = require('../src/_data/site');

(async () => {
  const { lang } = await siteData();
  
  dayjs.locale(lang);
})();

module.exports = dayjs;
