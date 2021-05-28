/* eslint-disable no-undef */
document.addEventListener('DOMContentLoaded', () => {
  const client = algoliasearch(
    '{{ secrets.algoliaAppId }}',
    '{{ secrets.algoliaApiKey }}'
  );
  const index = client.initIndex('news');
  const urlParams = new URLSearchParams(window.location.search);
  const queryStr = urlParams.get('query');
  const postFeed = document.querySelector('.post-feed');
  let currPage = 0;

  function getHits(pageNo) {
    return index
      .search({
        query: queryStr,
        hitsPerPage: 15,
        page: pageNo,
      })
      .then(({ hits } = {}) => {
        return hits;
      })
      .catch((err) => {
        console.log(err);
        console.log(err.debugData);
      });
  }

  async function renderSearchResults(arr) {
    arr.forEach((hit) => {
      const featureImage = hit.featureImage || '#';
      const url = hit.url || '#';
      const title = hit.title || '#';
      const authorName = hit.author.name;
      const authorImage = hit.author.profileImage;
      const authorUrl = hit.author.url;
      const primaryTagCodeBlock =
        hit.tags.length === 0
          ? ''
          : `
          <a href="${hit.tags[0].url}">
            #${hit.tags[0].name}
          </a>
        `;
      const publishedAt = hit.publishedAt;
      const dateStylingClassName =
        authorName === 'freeCodeCamp.org' ? 'meta-item-single' : 'meta-item';
      const timeEl = `<time class="post-full-meta-date ${dateStylingClassName}" datetime="${publishedAt}"></time>`;
      const displayAuthorAndTime = () => {
        return authorName === 'freeCodeCamp.org'
          ? timeEl
          : `
            <ul class="author-list">
              <li class="author-list-item">
                <div class="author-name-tooltip">
                  ${authorName}
                </div>
                <a href="${authorUrl}" class="static-avatar">
                  <img class="author-profile-image" src="${authorImage}" alt="${authorName}">
                </a>
              </li>
            </ul>
            <a class="meta-item" href="${authorUrl}">${authorName}</a>
            ${timeEl}
          `;
      };

      const articleItem = document.createElement('article');
      articleItem.className =
        'post-card post tag-javascript tag-news featured post-card-large';
      const codeBlock = `
          <a class="post-card-image-link" href="${url}">
            <img class="post-card-image" srcset="${featureImage} 300w,
              ${featureImage} 600w,
              ${featureImage} 1000w,
              ${featureImage} 2000w" sizes="(max-width: 1000px) 400px, 700px" src="${featureImage}" alt="${title}"
            >
          </a>
          <div class="post-card-content">
            <div class="post-card-content-link">
              <header class="post-card-header">
                <span class="post-card-tags">
                  ${primaryTagCodeBlock}
                </span>
                <h2 class="post-card-title">
                  <a href="${url}">
                    ${title}
                  </a>
                </h2>
              </header>
            </div>
            <footer class="post-card-meta">
              ${displayAuthorAndTime()}
            </footer>
          </div>
        `;

      articleItem.innerHTML = codeBlock;
      postFeed.appendChild(articleItem);
    });
  }

  function renderLoadMoreBtn() {
    const inner = document.querySelector('.inner');

    const readMoreRow = document.createElement('div');
    readMoreRow.className = 'read-more-row';

    const loadMoreBtn = document.createElement('button');
    loadMoreBtn.innerHTML = `{% tSync 'buttons.load-more-articles', site.lang %}`;
    loadMoreBtn.id = 'readMoreBtn';

    loadMoreBtn.addEventListener('click', () => {
      // Iterate currPage and load next set of hits
      populatePage(++currPage);
    });

    // Append row and button to page
    readMoreRow.appendChild(loadMoreBtn);
    inner.appendChild(readMoreRow);
  }

  function removeLoadMoreBtn() {
    const readMoreRow = document.querySelector('.read-more-row');

    readMoreRow.remove();
  }

  async function populatePage(pageNo) {
    const hitsArr = await getHits(pageNo);

    await renderSearchResults(hitsArr);

    // Only render "Load More Articles" button
    // if there are more than 15 hits, meaning
    // that there are up to 15 more hits in the
    // next API call
    if (hitsArr.length === 15) {
      // Check for existing button and render if none exists
      document.querySelector('#readMoreBtn') ? '' : renderLoadMoreBtn();
    } else {
      // Remove readMoreRow if a button exists and there are less than 15 hits
      document.querySelector('#readMoreBtn') ? removeLoadMoreBtn() : '';
    }
  }

  // Render for search page 0
  populatePage(currPage);

  /**
   * dayjs localization for search results page
   *
   */
  const postDates = [...document.getElementsByClassName('post-full-meta-date')];
  // temporarily handle quirk with Ghost/Moment.js zh-cn not jiving
  // with i18next's expected zh-CN format and simplify for the future
  const siteLang =
    `{{ site.lang }}`.toLowerCase() === 'zh-cn'
      ? 'zh'
      : `{{ site.lang }}`.toLowerCase();

  // Load dayjs plugins and set locale
  dayjs.extend(dayjs_plugin_localizedFormat);
  dayjs.extend(dayjs_plugin_relativeTime);
  dayjs.locale(siteLang);

  const localizeDates = (datesList) => {
    datesList.forEach((date) => {
      const dateStr = date.getAttribute('datetime');
      const dateObj = dayjs(dateStr);

      // Display either time since published or month, day, and year
      date.innerHTML = dateObj.format('LL');
    });
  };

  // Localize dates on initial page load
  localizeDates(postDates);

  // Localize dates when loading more articles to the page
  const config = {
    childList: true,
    attributes: true,
    subtree: true,
    characterData: true,
  };
  const observer = new MutationObserver((mutations) => {
    // Capture new article nodes that are appended to the page
    // and localize their dates
    const newNodes = mutations
      .map((mutation) => [...mutation.addedNodes])
      .flat();
    const newPostDates = newNodes
      .map((node) => [...node.querySelectorAll('.post-full-meta-date')])
      .flat(1);

    observer.disconnect();
    localizeDates(newPostDates);
    observer.observe(postFeed, config);
  });

  // Only observe mutations on front page and search results page
  if (postFeed) observer.observe(postFeed, config);
});
