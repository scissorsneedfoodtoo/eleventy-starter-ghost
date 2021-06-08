const { api } = require('./ghost-api');

const wait = seconds => {
  return new Promise(resolve => {
    setTimeout(() => {
      resolve(seconds);
    }, seconds * 1000);
  });
};

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

module.exports = getAllPosts;
// module.exports = (async () => await getAllPosts())();
