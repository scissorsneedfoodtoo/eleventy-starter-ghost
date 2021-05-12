require("dotenv").config();

const cleanCSS = require("clean-css");
const fs = require("fs");
const path = require("path");
const Image = require("@11ty/eleventy-img");
const pluginRSS = require("@11ty/eleventy-plugin-rss");
const ghostContentAPI = require("@tryghost/content-api");

const dayjs = require('dayjs');
const localizedFormat = require('dayjs/plugin/localizedFormat');
const relativeTime = require('dayjs/plugin/relativeTime');

// Load dayjs plugins and set locale
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);
dayjs.locale(`{{ site.lang }}`);

const htmlMinTransform = require("./src/transforms/html-min-transform.js");

const postsPerPage = 2;

// Init Ghost API
const api = new ghostContentAPI({
  url: process.env.GHOST_API_URL,
  key: process.env.GHOST_CONTENT_API_KEY,
  version: "v3"
});

// Strip Ghost domain from urls
const stripDomain = url => {
  return url.replace(process.env.GHOST_API_URL, "");
};

// For custom tag and author post pagination
const chunkArray = (arr, size) => {
  const chunkedArr = [];
  let copy = [...arr];
  const numOfChunks = Math.ceil(copy.length / size);
  for (let i = 0; i < numOfChunks; i++) {
    chunkedArr.push(copy.splice(0, size));
  }

  return chunkedArr;
}

module.exports = function(config) {
  // Minify HTML
  config.addTransform("htmlmin", htmlMinTransform);

  // Assist RSS feed template
  config.addPlugin(pluginRSS);

  // Copy images over from Ghost
  function imageShortcode(src, cls, alt, sizes, widths) {
    const imageFormats = ["webp"];
    const imageExtension = path.extname(src);
    const imageName = path.basename(src, imageExtension).split('?')[0]; // strip off url params, if any
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
        srcset="${widths.map(width => `/assets/images/${imageName}-${width}w.webp ${width}w`).join()}"
        sizes="${sizes}"
        src="/assets/images/${imageName}-${widths[0]}w.webp"
        class="${cls}"
        alt="${alt}"
        loading="lazy"
        decoding="async"
      />
    `;
  }
  
  config.addNunjucksShortcode("image", imageShortcode);

  // Copy images over from Ghost
  function featureImageShortcode(src, cls, alt, sourceOptions) {
    const imageFormats = ["webp"];
    const imageExtension = path.extname(src);
    const imageName = path.basename(src, imageExtension).split('?')[0]; // strip off url params, if any
    const widths = [...new Set(sourceOptions.map(obj => obj.width))]; // get unique widths
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
        ${sourceOptions.map(obj => `
          <source 
            media="${obj.mediaStr}"
            srcset="/assets/images/${imageName}-${obj.width}w.webp"
          >`).join('')
        }
        <img 
          class="${cls}"
          src="/assets/images/${imageName}-${widths[0]}w.webp"
          alt="${alt}" 
          loading="lazy"
          decoding="async"
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

  // Inline CSS
  config.addFilter("cssmin", code => {
    return new cleanCSS({}).minify(code).styles;
  });

  config.addFilter("getReadingTime", text => {
    const wordsPerMinute = 200;
    const numberOfWords = text.split(/\s/g).length;
    return Math.ceil(numberOfWords / wordsPerMinute);
  });

  // Date formatting filter
  config.addFilter("htmlDateString", dateObj => {
    return new Date(dateObj).toISOString().split("T")[0];
  });

  // Don't ignore the same files ignored in the git repo
  config.setUseGitIgnore(false);

  // Get all pages, called 'docs' to prevent
  // conflicting the eleventy page object
  config.addCollection("docs", async function(collection) {
    collection = await api.pages
      .browse({
        include: "authors",
        limit: "all"
      })
      .catch(err => {
        console.error(err);
      });

    collection.map(doc => {
      doc.url = stripDomain(doc.url);
      doc.primary_author.url = stripDomain(doc.primary_author.url);

      // Convert publish date into a Date object
      doc.published_at = new Date(doc.published_at);
      return doc;
    });

    return collection;
  });

  // Get all posts
  config.addCollection("posts", async function(collection) {
    collection = await api.posts
      .browse({
        include: "tags,authors",
        limit: "all"
      })
      .catch(err => {
        console.error(err);
      });

    collection.forEach(post => {
      post.url = stripDomain(post.url);
      post.primary_author.url = stripDomain(post.primary_author.url);
      post.tags.map(tag => (tag.url = stripDomain(tag.url)));
      if (post.primary_tag) post.primary_tag.url = stripDomain(post.primary_tag.url);
      post.authors.forEach(author => author.url = stripDomain(author.url));

      // Convert publish date into a Date object
      post.published_at = new Date(post.published_at);
    });

    // Bring featured post to the top of the list
    collection.sort((post, nextPost) => nextPost.featured - post.featured);

    console.log(collection);
    return collection;
  });

  // Get all authors
  config.addCollection("authors", async function(collection) {
    collection = await api.authors
      .browse({
        include: "count.posts",
        limit: "all"
      })
      .catch(err => {
        console.error(err);
      });

    // Get all posts with their authors attached
    const posts = await api.posts
      .browse({
        include: "tags,authors",
        limit: "all"
      })
      .catch(err => {
        console.error(err);
      });

    // Attach posts to their respective authors
    collection.forEach(async author => {
      const authorsPosts = posts.filter(post => {
        post.url = stripDomain(post.url);
        post.primary_author.url = stripDomain(post.primary_author.url);
        post.tags.map(tag => (tag.url = stripDomain(tag.url)));
        if (post.primary_tag) post.primary_tag.url = stripDomain(post.primary_tag.url);
        return post.primary_author.id === author.id;
      });
      if (authorsPosts.length) author.posts = authorsPosts;

      author.absolute_url = author.url;
      author.url = stripDomain(author.url);
    });

    return collection;
  });

  // Get all tags and paginate them based on posts per page
  config.addCollection("tags", async function(collection) {
    const allTags = await api.tags
      .browse({
        include: "count.posts",
        limit: "all",
        filter: "visibility:public"
      })
      .catch(err => {
        console.error(err);
      });

    // Get all posts with their tags attached
    const posts = await api.posts
      .browse({
        include: "tags,authors",
        limit: "all"
      })
      .catch(err => {
        console.error(err);
      });

    // // Attach posts to their respective tags
    // collection.forEach(async targetTag => {
      // const taggedPosts = posts.filter(post => {
      //   post.url = stripDomain(post.url);
      //   post.primary_author.url = stripDomain(post.primary_author.url);
      //   if (post.primary_tag) post.primary_tag.url = stripDomain(post.primary_tag.url);

      //   return post.tags.map(tag => tag.slug).includes(targetTag.slug);
      // });
      // if (taggedPosts.length) targetTag.posts = taggedPosts;

      // targetTag.url = stripDomain(targetTag.url);
    // });

    collection = [];

    allTags.forEach(tag => {
      tag.url = stripDomain(tag.url);

      const currTagPosts = posts.filter(post => {
        post.url = stripDomain(post.url);
        post.primary_author.url = stripDomain(post.primary_author.url);
        if (post.primary_tag) post.primary_tag.url = stripDomain(post.primary_tag.url);

        return post.tags.map(postTag => postTag.slug).includes(tag.slug); 
      });
      const paginatedCurrTagPosts = chunkArray(currTagPosts, postsPerPage);

      for( let page = 0, max = paginatedCurrTagPosts.length; page < max; page++) {
        // For each entry in paginatedCurrTagPosts, add the tag object
        // with some extra data for custom pagination
        collection.push({
          ...tag,
          page,
          posts: paginatedCurrTagPosts[page]
        });
      }
    });

    // [{
		// 	tagName: "tag1",
		// 	pageNumber: 0
		// 	pageData: [] // array of items
		// },{
		// 	tagName: "tag1",
		// 	pageNumber: 1
		// 	pageData: [] // array of items
		// },{
		// 	tagName: "tag1",
		// 	pageNumber: 2
		// 	pageData: [] // array of items
		// },{
		// 	tagName: "tag2",
		// 	pageNumber: 0
		// 	pageData: [] // array of items
		// }]

    // console.log(collection);
    return collection;
  });

  // // Get all tags
  // config.addCollection("tags", async function(collection) {
  //   collection = await api.tags
  //     .browse({
  //       include: "count.posts",
  //       limit: "all",
  //       filter: "visibility:public"
  //     })
  //     .catch(err => {
  //       console.error(err);
  //     });

  //   // Get all posts with their tags attached
  //   const posts = await api.posts
  //     .browse({
  //       include: "tags,authors",
  //       limit: "all"
  //     })
  //     .catch(err => {
  //       console.error(err);
  //     });

  //   // Attach posts to their respective tags
  //   collection.forEach(async targetTag => {
  //     const taggedPosts = posts.filter(post => {
  //       post.url = stripDomain(post.url);
  //       post.primary_author.url = stripDomain(post.primary_author.url);
  //       if (post.primary_tag) post.primary_tag.url = stripDomain(post.primary_tag.url);

  //       return post.tags.map(tag => tag.slug).includes(targetTag.slug);
  //     });
  //     if (taggedPosts.length) targetTag.posts = taggedPosts;

  //     targetTag.url = stripDomain(targetTag.url);
  //   });

  //   console.log(collection);
  //   return collection;
  // });

  // Get the post popular tags
  config.addCollection("popularTags", async function(collection) {
    collection = await api.tags
      .browse({
        include: "count.posts",
        limit: "15",
        filter: "visibility:public",
        order: "count.posts desc"
      })
      .catch(err => {
        console.error(err);
      });

    collection.forEach(tag => {
      tag.url = stripDomain(tag.url);
    });

    return collection;
  });

  // Display 404 page in BrowserSnyc
  config.setBrowserSyncConfig({
    callbacks: {
      ready: (err, bs) => {
        const content_404 = fs.readFileSync("dist/404.html");

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
