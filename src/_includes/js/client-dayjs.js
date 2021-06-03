/* eslint-disable no-undef */
document.addEventListener('DOMContentLoaded', () => {
  // temporarily handle quirk with Ghost/Moment.js zh-cn not jiving
  // with i18next's expected zh-CN format and simplify for the future
  const siteLang = `{% siteLangHandler site.lang %}`

  // Load dayjs plugins and set locale
  dayjs.extend(dayjs_plugin_localizedFormat);
  dayjs.extend(dayjs_plugin_relativeTime);
  dayjs.locale(siteLang);
});
