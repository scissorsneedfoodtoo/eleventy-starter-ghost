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

  if (process.env.SITE_URL) {
    settings.url = process.env.SITE_URL;

    const logoPath = `${settings.url}/assets/images/fcc_primary_large_24X210.svg`;
    settings.logo = logoPath;

    const coverImagePath = `${settings.url}/assets/images/fcc_ghost_publication_cover.png`;
    settings.cover_image = coverImagePath;
    settings.og_image = coverImagePath;
    settings.twitter_image = coverImagePath;
  }

  const logoDimensions = await probe(settings.logo);
  settings.image_dimensions = {
    logo: {
      width: logoDimensions.width,
      height: logoDimensions.height
    }
  }

  settings.lang = siteLangHandler(settings.lang);

  return settings;
};

// Return promise to await in other config files
module.exports.settings = ghostSettings();
