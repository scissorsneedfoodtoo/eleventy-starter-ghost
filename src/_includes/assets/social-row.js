document.addEventListener('DOMContentLoaded', () => {
  const title = `{{ post.title | safe }}`.replace(/'/g, '%27');
  const twitter = `{{ post.primary_author.twitter }}`;
  const url = window.location;
  const thanks = `{% tSync 'social-row.default-tweet', { twitter: post.primary_author.twitter } %}.` +
      `%0A%0A${title}%0A%0A${url}`;
  const button = document.getElementById('tweet-btn');
  button.addEventListener('click', () => {
      if (twitter) {
          window.open(`https://twitter.com/intent/tweet?text=${thanks}`, `share-twitter`, `width=550, height=235`);
          return false;
      }
      else {
          window.open(`https://twitter.com/intent/tweet?text=${title}%0A%0A${url}`, `share-twitter`, `width=550, height=235`);
          return false;
      }
  });
});
