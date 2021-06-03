/* eslint-disable no-unused-vars */
/* eslint-disable no-undef */
let client, index;

document.addEventListener('DOMContentLoaded', () => {
  const algoliaIndices = {
    en: 'news',
    es: 'news-es',
    zh: 'news-zh'
  };

  // temporarily handle quirk with Ghost/Moment.js zh-cn not jiving
  // with i18next's expected zh-CN format and simplify for the future
  const siteLang = `{% siteLangHandler site.lang %}`

  // load Algolia and set index globally
  client = algoliasearch(
    '{{ secrets.algoliaAppId }}',
    '{{ secrets.algoliaApiKey }}'
  );

  index = client.initIndex(algoliaIndices[siteLang]);
});
