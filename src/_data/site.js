const { api } = require('../../utils/ghost-api');
const siteLangHandler = require('../../utils/site-lang-handler');

// Get all site information
module.exports = async function() {
  const siteData = await api.settings
    .browse({
      include: 'icon,url'
    })
    .catch(err => {
      console.error(err);
    });

  if (process.env.SITE_URL) siteData.url = process.env.SITE_URL;

  siteData.lang = siteLangHandler(siteData.lang);

  return siteData;
};
