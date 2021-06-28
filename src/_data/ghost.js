const postsPerPage = process.env.POSTS_PER_PAGE;
const { api, enApi } = require('../../utils/ghost-api');
const getImageDimensions = require('../../utils/image-dimensions');

const wait = seconds => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(seconds);
    }, seconds * 1000);
  });
};

// Strip Ghost domain from urls
const stripDomain = url => url.replace(process.env.GHOST_API_URL, "");

// For custom tag and author post pagination
const chunkArray = (arr, size) => {
  const chunkedArr = [];
  const copy = [...arr];
  const numOfChunks = Math.ceil(copy.length / size);
  for (let i = 0; i < numOfChunks; i++) {
    chunkedArr.push(copy.splice(0, size));
  }

  return chunkedArr;
}

const getUniqueList = (arr, key) => [...new Map(arr.map(item => [item[key], item])).values()];

const fetchFromGhost = async (endpoint, options) => {
  let currPage = 1;
  let lastPage = 5;
  let posts = [];

  while (currPage && currPage <= lastPage) {
    const data = await api[endpoint].browse({
      ...options,
      page: currPage
    })
    .catch(err => {
      console.error(err);
    });

    data.forEach((post) => posts.push(post));

    lastPage = data.meta.pagination.pages;
    console.log(`Fetched ${endpoint} page ${currPage} of ${lastPage}...`);
    currPage = data.meta.pagination.next;

    await wait(0.25);
  }

  return posts;
};

const imageDimensionHandler = async (targetObj, type, mapObj, mapKey) => {
  // Check map for existing dimensions
  if (mapObj[mapKey] && mapObj[mapKey][type]) {
    targetObj.image_dimensions = mapObj[mapKey];
  } else {
    // Get dimensions and append to targetObj and map
    targetObj.image_dimensions = {...targetObj.image_dimensions};
    mapObj[mapKey] = {...mapObj[mapKey]};

    const { width, height } = await getImageDimensions(targetObj[type]);

    targetObj.image_dimensions[type] = { width, height };
    mapObj[mapKey][type] = { width, height };
  }
}

module.exports = async () => {
  const ghostPosts = await fetchFromGhost('posts', {
    include: ['tags', 'authors'],
    filter: 'status:published'
  });
  const ghostPages = await fetchFromGhost('pages', {
    include: ['authors'],
    filter: 'status:published'
  });
  const featureImageDimensions = {};
  const authorImageDimensions = {};

  const posts = [];
  for (let i in ghostPosts) {
    const post = ghostPosts[i];
    const originalPostRegex = /const\s+fccOriginalPost\s+=\s+("|')(?<url>.*)\1;?/g;
    const match = originalPostRegex.exec(post.codeinjection_head);
    
    if (match) {
      const url = match.groups.url;
      const urlArr = url.split('/');
      // handle urls that end with a slash,
      // then urls that don't end in a slash
      const originalPostSlug = urlArr[urlArr.length - 1] ?
        urlArr[urlArr.length - 1] :
        urlArr[urlArr.length - 2];
      const originalPostRes = await enApi.posts
        .read({
          include: 'authors',
          slug: originalPostSlug
        })
        .catch(err => {
          console.error(err);
        });
      const {
        title,
        published_at,
        primary_author
      } = originalPostRes;

      post.original_post = {
        title,
        published_at,
        url,
        primary_author
      }
    }

    post.path = stripDomain(post.url);
    post.primary_author.path = stripDomain(post.primary_author.url);
    post.tags.map(tag => (tag.path = stripDomain(tag.url)));
    if (post.primary_tag) post.primary_tag.path = stripDomain(post.primary_tag.url);
    post.authors.forEach(author => author.path = stripDomain(author.url));

    // Post image resolutions for structured data
    if (post.feature_image) await imageDimensionHandler(post, 'feature_image', featureImageDimensions, post.feature_image);

    // Author image resolutions for structured data
    if (post.primary_author.profile_image) {
      await imageDimensionHandler(post.primary_author, 'profile_image', authorImageDimensions, post.primary_author.slug);
    }

    if (post.primary_author.cover_image) {
      await imageDimensionHandler(post.primary_author, 'cover_image', authorImageDimensions, post.primary_author.slug);
    }

    // Convert publish date into a Date object
    post.published_at = new Date(post.published_at);

    posts.push(post);
  }

  const pages = []
  for (let i in ghostPages) {
    const page = ghostPages[i];

    page.path = stripDomain(page.url);

    // Author image resolutions for structured data
    if (page.primary_author.profile_image) {
      await imageDimensionHandler(page.primary_author, 'profile_image', authorImageDimensions, page.primary_author.slug);
    }

    if (page.primary_author.cover_image) {
      await imageDimensionHandler(page.primary_author, 'cover_image', authorImageDimensions, page.primary_author.slug);
    }

    // Page image resolutions for structured data
    if (page.feature_image) {
      const { width, height } = await getImageDimensions(page.feature_image);
      page.image_dimensions = {
        feature_image: {
          width,
          height
        }
      }
    }

    // Convert publish date into a Date object
    page.published_at = new Date(page.published_at);
    pages.push(page);
  }

  const authors = [];
  const primaryAuthors = getUniqueList(posts.map(post => post.primary_author), 'id');
  primaryAuthors.forEach(author => {
    // Attach posts to their respective author
    const currAuthorPosts = posts.filter(post => post.primary_author.id === author.id);

    if (currAuthorPosts.length) author.posts = currAuthorPosts;

    const paginatedCurrAuthorPosts = chunkArray(currAuthorPosts, postsPerPage);

    paginatedCurrAuthorPosts.forEach((arr, i) => {
      // For each entry in paginatedCurrAuthorPosts, add the author object
      // with some extra data for custom pagination
      authors.push({
        ...author,
        page: i,
        posts: arr,
        count: {
          posts: currAuthorPosts.length
        }
      });
    });
  });

  const tags = [];
  const visibleTags = posts.reduce((arr, post) => {
    return [
      ...arr,
      ...post.tags.filter(tag => tag.visibility === 'public')
    ]
  }, []);
  const allTags = getUniqueList(visibleTags, 'id');
  for (let i in allTags) {
    const tag = allTags[i];
    // Attach posts to their respective tag
    const currTagPosts = posts.filter(post => post.tags.map(postTag => postTag.slug).includes(tag.slug));
    // Save post count to tag object to help determine popular tags
    tag.count = {
      posts: currTagPosts.length
    }

    if (tag.feature_image) await imageDimensionHandler(tag, 'feature_image', featureImageDimensions, tag.feature_image);

    const paginatedCurrTagPosts = chunkArray(currTagPosts, postsPerPage);

    paginatedCurrTagPosts.forEach((arr, i) => {
      // For each entry in paginatedCurrTagPosts, add the tag object
      // with some extra data for custom pagination
      tags.push({
        ...tag,
        page: i,
        posts: arr,
        count: {
          posts: currTagPosts.length
        }
      });
    });
  }

  const popularTags = [...allTags].sort((a, b) => 
    b.count.posts - a.count.posts ||
    a.name.toLowerCase().localeCompare(b.name.toLowerCase(), 'en', { sensitivity: 'base' }
  )).slice(0, 15);

  return {
    posts,
    pages,
    authors,
    tags,
    popularTags
  };
};
