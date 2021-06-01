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
const siteLangHandler = require('./site-lang-handler');

(async () => {
  const { lang } = await siteData();
  
  dayjs.locale(siteLangHandler(lang));
})();

module.exports = dayjs;
