const { api } = require('../../utils/ghost-api');

const wait = seconds => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(seconds);
    }, seconds * 1000);
  });
};

// Strip Ghost domain from urls
const stripDomain = url => url.replace(process.env.GHOST_API_URL, "");

const getAllPosts = async () => {
  let currPage = 1;
  let lastPage = 5;
  let posts = [];

  while (currPage && currPage <= lastPage) {
    const data = await api.posts.browse({
      include: ['tags', 'authors'],
      filter: 'status:published',
      page: currPage,
    })
    .catch(err => {
      console.error(err);
    });

    data.forEach((post) => posts.push(post));

    lastPage = data.meta.pagination.pages;
    console.log(`Posts page ${currPage} of ${lastPage} fetched...`);
    currPage = data.meta.pagination.next;
    

    await wait(0.25);
  }

  return posts;
};

// // Get all posts
// config.addCollection("posts", async function(collection) {
//   collection = await api.posts
//     .browse({
//       include: "tags,authors",
//       limit: "all"
//     })
//     .catch(err => {
//       console.error(err);
//     });

//   // remove meta pagination object
//   delete collection.meta;
  
//   for (let i in collection) {
//     const post = collection[i];
//     const originalPostRegex = /const\s+fccOriginalPost\s+\=\s+("|')(?<url>.*)\1\;?/g;
//     const match = originalPostRegex.exec(post.codeinjection_head);
    
//     if (match) {
//       const url = match.groups.url;
//       const urlArr = url.split('/');
//       // handle urls that end with a slash,
//       // then urls that don't end in a slash
//       const originalPostSlug = urlArr[urlArr.length - 1] ?
//         urlArr[urlArr.length - 1] :
//         urlArr[urlArr.length - 2];
//       const originalPostRes = await enApi.posts
//         .read({
//           include: 'authors',
//           slug: originalPostSlug
//         })
//         .catch(err => {
//           console.error(err);
//         });
//       const {
//         title,
//         published_at,
//         primary_author
//       } = originalPostRes;

//       post.original_post = {
//         title,
//         published_at,
//         url,
//         primary_author
//       }
//     }

//     post.url = stripDomain(post.url);
//     post.primary_author.url = stripDomain(post.primary_author.url);
//     post.tags.map(tag => (tag.url = stripDomain(tag.url)));
//     if (post.primary_tag) post.primary_tag.url = stripDomain(post.primary_tag.url);
//     post.authors.forEach(author => author.url = stripDomain(author.url));

//     // Convert publish date into a Date object
//     post.published_at = new Date(post.published_at);
//   }

//   // Bring featured post to the top of the list
//   collection.sort((post, nextPost) => nextPost.featured - post.featured);

//   return collection;
// });

module.exports = async () => {
  const allPosts = await getAllPosts();

  for (let i in allPosts) {
    const post = allPosts[i];
    // const originalPostRegex = /const\s+fccOriginalPost\s+\=\s+("|')(?<url>.*)\1\;?/g;
    // const match = originalPostRegex.exec(post.codeinjection_head);
    
    // if (match) {
    //   const url = match.groups.url;
    //   const urlArr = url.split('/');
    //   // handle urls that end with a slash,
    //   // then urls that don't end in a slash
    //   const originalPostSlug = urlArr[urlArr.length - 1] ?
    //     urlArr[urlArr.length - 1] :
    //     urlArr[urlArr.length - 2];
    //   const originalPostRes = await enApi.posts
    //     .read({
    //       include: 'authors',
    //       slug: originalPostSlug
    //     })
    //     .catch(err => {
    //       console.error(err);
    //     });
    //   const {
    //     title,
    //     published_at,
    //     primary_author
    //   } = originalPostRes;

    //   post.original_post = {
    //     title,
    //     published_at,
    //     url,
    //     primary_author
    //   }
    // }

    post.url = stripDomain(post.url);
    post.primary_author.url = stripDomain(post.primary_author.url);
    post.tags.map(tag => (tag.url = stripDomain(tag.url)));
    if (post.primary_tag) post.primary_tag.url = stripDomain(post.primary_tag.url);
    post.authors.forEach(author => author.url = stripDomain(author.url));

    // Convert publish date into a Date object
    post.published_at = new Date(post.published_at);
  }

  // Bring featured post to the top of the list
  allPosts.sort((post, nextPost) => nextPost.featured - post.featured);

  return {
    posts: allPosts,
    rssFeed: allPosts.slice(0, 10)
  };
};
