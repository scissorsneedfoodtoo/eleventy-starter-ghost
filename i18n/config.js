const i18next = require("i18next");
const Backend = require("i18next-fs-backend");
const { readdirSync, lstatSync } = require("fs");
const { join } = require("path");

i18next
  .use(Backend)
  .init({
    lng: ['en', 'es', 'zh'],
    fallbackLng: 'en',
    // debug: true,
    initImmediate: false,
    preload: readdirSync(join(__dirname, './locales')).filter((fileName) => {
      const joinedPath = join(join(__dirname, './locales'), fileName)
      const isDirectory = lstatSync(joinedPath).isDirectory()
      return isDirectory
    }),
    ns: ['translations', 'trending', 'meta'],
    defaultNS: 'translations',
    backend: {
      loadPath: join(__dirname, './locales/{{lng}}/{{ns}}.json')
    }
  });

module.exports = i18next;
