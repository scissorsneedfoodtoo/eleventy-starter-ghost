const { api } = require('./ghost-api');
const siteLangHandler = require('./site-lang-handler');
const probe = require('probe-image-size');

const ghostSettings = async () => {
  const settings = await api.settings
    .browse({
      include: 'icon,url'
    })
    .catch(err => {
      console.error(err);
    });
  const logoDimensions = await probe(settings.logo);

  if (process.env.SITE_URL) settings.url = process.env.SITE_URL;

  settings.lang = siteLangHandler(settings.lang);

  settings.image_dimensions = {
    logo: {
      width: logoDimensions.width,
      height: logoDimensions.height
    }
  }

  // console.log(settings);

  return settings;
};

// Return promise to await in other config files
module.exports.settings = ghostSettings();
