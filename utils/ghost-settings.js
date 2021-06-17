const { api } = require('./ghost-api');
const siteLangHandler = require('./site-lang-handler');

const ghostSettings = async () => {
  const settings = await api.settings
    .browse({
      include: 'icon,url'
    })
    .catch(err => {
      console.error(err);
    });

  if (process.env.SITE_URL) settings.url = process.env.SITE_URL;

  settings.lang = siteLangHandler(settings.lang);

  return settings;
};

// Return promise to await in other config files
module.exports.settings = ghostSettings();
