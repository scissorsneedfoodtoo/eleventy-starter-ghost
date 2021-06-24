const postsPerPage = process.env.POSTS_PER_PAGE;
const { api, enApi } = require('../../utils/ghost-api');

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

module.exports = async () => {
  const ghostPosts = await fetchFromGhost('posts', {
    include: ['tags', 'authors'],
    filter: 'status:published'
  });
  const ghostPages = await fetchFromGhost('pages', {
    include: ['authors'],
    filter: 'status:published'
  });

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

    // Convert publish date into a Date object
    post.published_at = new Date(post.published_at);

    // console.log(post);
    posts.push(post);
  }

  const pages = ghostPages.map(page => {
    page.path = stripDomain(page.url);

    // Convert publish date into a Date object
    page.published_at = new Date(page.published_at);
    return page;
  });

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
  allTags.forEach(tag => {
    // Attach posts to their respective tag
    const currTagPosts = posts.filter(post => post.tags.map(postTag => postTag.slug).includes(tag.slug));
    // Save post count to tag object to help determine popular tags
    tag.count = {
      posts: currTagPosts.length
    }

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
  });

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
