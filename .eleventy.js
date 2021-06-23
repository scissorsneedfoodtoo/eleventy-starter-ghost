require("dotenv").config();

const htmlMin = require("./utils/transforms/html-min");
const cssMin = require("./utils/transforms/css-min");
const jsMin = require("./utils/transforms/js-min");
const { readFileSync, readdirSync, writeFileSync } = require("fs");
const { basename, extname } = require("path");
const Image = require("@11ty/eleventy-img");
const pluginRSS = require("@11ty/eleventy-plugin-rss");
const { api } = require("./utils/ghost-api");
const i18next = require("./i18n/config");
const dayjs = require("./utils/dayjs");
const cacheBuster = require("@mightyplow/eleventy-plugin-cache-buster");
const { settings } = require('./utils/ghost-settings');
const probe = require('probe-image-size');

module.exports = function(config) {
  // Minify HTML
  config.addTransform("htmlMin", htmlMin);

  // Minify inline CSS
  config.addFilter("cssMin", cssMin);

  // Minify inline JS
  config.addNunjucksAsyncFilter("jsMin", jsMin);

  // Allow passthrough for styles and scripts
  config.addPassthroughCopy({'./src/_includes/css': './assets/css'});

  config.addPassthroughCopy({'./src/_includes/js': './assets/js'});

  // Minify CSS
  config.on('afterBuild', () => {
    const path = './dist/assets/css';
    const cssFiles = readdirSync(path);

    cssFiles.forEach(filename => {
      const fullPath = `${path}/${filename}`;
      const content = readFileSync(fullPath);

      writeFileSync(fullPath, cssMin(content));
    });
  });

  // Basic cache busting
  config.addPlugin(
    cacheBuster({
      outputDirectory: './dist',
    })
  );

  // Assist RSS feed template
  config.addPlugin(pluginRSS);

  // Copy images over from Ghost
  function imageShortcode(src, cls, alt, sizes, widths, index) {
    const imageFormats = ["webp"];
    const imageExtension = extname(src);
    const imageName = basename(src, imageExtension).split('?')[0]; // strip off url params, if any
    const options = {
      widths: widths,
      formats: imageFormats,
      outputDir: "./dist/assets/images/",
      filenameFormat: function (id, src, width, format, options) {
        return `${imageName}-${width}w.${format}`
      }
    }

    // generate images, while this is async we don’t wait
    Image(src, options);

    return `
      <img
        ${index === 0 ? `rel="preload" as="image"` : ''}
        ${(cls.includes('lazyload') && index > 0) ? 'data-srcset' : 'srcset'}="${widths.map(width => `/assets/images/${imageName}-${width}w.webp ${width}w`).join()}"
        sizes="${sizes.replace(/\s+/g, ' ').trim()}"
        ${(cls.includes('lazyload') && index > 0) ? 'data-src' : 'src'}="/assets/images/${imageName}-${widths[0]}w.webp"
        class="${index === 0 ? cls.replace('lazyload', '') : cls}"
        alt="${alt}"
        onerror="this.style.display='none'"
      />
    `;
  }
  
  config.addNunjucksShortcode("image", imageShortcode);

  // Copy images over from Ghost
  function featureImageShortcode(src, alt, sizes, widths) {
    const imageFormats = ["webp"];
    const imageExtension = extname(src);
    const imageName = basename(src, imageExtension).split('?')[0]; // strip off url params, if any
    const options = {
      widths: widths,
      formats: imageFormats,
      outputDir: "./dist/assets/images/",
      filenameFormat: function (id, src, width, format, options) {
        return `${imageName}-${width}w.${format}`
      }
    }

    // generate images, while this is async we don’t wait
    Image(src, options);

    return `
      <picture>
        <source
          media="(max-width: 700px)"
          sizes="1px"
          srcset="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7 1w"
        />
        <source 
          media="(min-width: 701px)"
          sizes="${sizes.replace(/\s+/g, ' ').trim()}"
          srcset="${widths.map(width => `/assets/images/${imageName}-${width}w.webp ${width}w`).join()}"
        />
        <img
          onerror="this.style.display='none'"
          src="/assets/images/${imageName}-${widths[0]}w.webp"
          alt="${alt}"
        >
      </picture>
    `;
  }
  
  config.addNunjucksShortcode("featureImage", featureImageShortcode);

  // Date and time shortcodes
  function publishedDateShortcode(dateStr) {
    return dayjs(dateStr).format('LL');
  }

  config.addNunjucksShortcode("publishedDate", publishedDateShortcode);

  function timeAgoShortcode(dateStr) {
    return dayjs().to(dayjs(dateStr));
  }

  config.addNunjucksShortcode("timeAgo", timeAgoShortcode);

  function translateShortcode(key, data) {
    return i18next.t(key, { ...data });
  }

  config.addNunjucksShortcode("t", translateShortcode);

  // Special handling for full stops
  function fullStopHandlerShortcode(siteLang) {
    const ideographicFullStopLanguageCodes = ['zh', 'zh-cn'];

    return ideographicFullStopLanguageCodes.includes(siteLang) ? '。' : '.';
  }

  config.addNunjucksShortcode("fullStopHandler", fullStopHandlerShortcode);

  config.addFilter("getReadingTime", text => {
    const wordsPerMinute = 200;
    const numberOfWords = text.split(/\s/g).length;
    return Math.ceil(numberOfWords / wordsPerMinute);
  });

  // Date formatting filter
  config.addFilter("htmlDateString", dateObj => {
    return new Date(dateObj).toISOString().split("T")[0];
  });

  config.addFilter("commentsEnabled", tagsArr => {
    return !tagsArr.map(tag => tag.name).includes('#disable-comments');
  });

  // Don't ignore the same files ignored in the git repo
  config.setUseGitIgnore(false);

  // The RSS feed seems to only work with static data or async collections,
  // so make another call to the Ghost API here (alternative would be to write
  // JSON to a separate file in _data/)
  config.addCollection("rssFeed", async function(collection) {
    collection = await api.posts
      .browse({
        include: "tags,authors",
        limit: "10"
      })
      .catch(err => {
        console.error(err);
      });

    return collection;
  });

  // This counts on all images, including the site logo, being stored like on Ghost with the
  // same directory structure
  const domainReplacer = url => url.replace(process.env.GHOST_API_URL, process.env.SITE_URL);

  async function createJsonLdShortcode(type, data) {
    // Main site settings from Ghost API
    let { url, logo, image_dimensions } = await settings;
    url = `${domainReplacer(url)}/`;
    const typeMap = {
      index: 'WebSite',
      article: 'Article',
      tag: 'Series'
    }
    const baseData = {
      "@context": "https://schema.org",
      "@type": typeMap[type],
      publisher: {
        "@type": "Organization",
        name: "freeCodeCamp.org",
        url: url,
        logo: {
          "@type": "ImageObject",
          url: domainReplacer(logo),
          width: image_dimensions.logo.width,
          height: image_dimensions.logo.height
        }
      },
      "url": url,
      // "image": {
      //   "@type": "ImageObject",
      //   "url": cover_image,
      //   "width": image_dimensions.cover_image.width,
      //   "height": image_dimensions.cover_image.height
      // },
      mainEntityOfPage: {
        "@type": "WebPage",
        "@id": url
      },
      // description: description
    }
    const returnData =  {...baseData};

    // Conditionally set other properties based on
    // objects passed to shortcodes

    // Clean this up later when we move to using slugs for permalinks
    if (data.url.startsWith('/')) returnData.url += data.url.substring(1);

    if (data.cover_image || data.feature_image) {
      const imageUrl = data.cover_image ? data.cover_image : data.feature_image;
      const { width, height } = await probe(imageUrl);
      returnData.image = {
        "@type": "ImageObject",
        url: domainReplacer(imageUrl),
        width,
        height
      }
    }

    if (data.description) returnData.description = data.description;

    



    // eleventyComputed:
    //   ldjson:
    //     "@context": "https://schema.org"
    //     "@type": "Article"
    //     "publisher":
    //       "@type": "Organization"
    //       "name": "{{ site.title }}"
    //       "url": "{{ site.url }}"
    //       "logo":
    //         "@type": "ImageObject"
    //         "url": "{{ site.logo }}"
    //     "author":
    //       "@type": "Person"
    //       "name": "{{ post.primary_author.name }}"
    //       "image":
    //         "@type": "ImageObject"
    //         "url": "{{ post.primary_author.profile_image }}"
    //       "url": "{{ site.url + post.primary_author.url }}"
    //       "sameAs": [
    //         "{{post.primary_author.website}}",
    //         "https://facebook.com/{{post.primary_author.facebook}}",
    //         "https://twitter.com/{{post.primary_author.twitter}}"
    //       ]
    //     "headline": "{{ post.title }}"
    //     "url": "{{ post.url }}"
    //     "datePublished": "{{ post.published_at }}"
    //     "dateModified": "{{ post.updated_at }}"
    //     "image":
    //       "@type": "ImageObject"
    //       "url": "{{ post.feature_image }}"
    //     "description": "{{ post.excerpt }}"
    //     "mainEntityOfPage": {
    //       "@type": "WebPage",
    //       "@id": "{{ site.url }}"
    //     }

    return JSON.stringify(returnData, null, '\t');
  }

  config.addNunjucksAsyncShortcode("createJsonLd", createJsonLdShortcode);

  // Display 404 page in BrowserSnyc
  config.setBrowserSyncConfig({
    callbacks: {
      ready: (err, bs) => {
        const content_404 = readFileSync("dist/404.html");

        bs.addMiddleware("*", (req, res) => {
          res.writeHead(404, { "Content-Type": "text/html; charset=UTF-8" });
          
          // Provides the 404 content without redirect.
          res.write(content_404);
          res.end();
        });
      }
    }
  });

  // Eleventy configuration
  return {
    dir: {
      input: "src",
      output: "dist"
    },

    // Files read by Eleventy, add as needed
    templateFormats: ["css", "njk", "md", "txt", "hbs"],
    htmlTemplateEngine: "njk",
    markdownTemplateEngine: "njk",
    passthroughFileCopy: true
  };
};
