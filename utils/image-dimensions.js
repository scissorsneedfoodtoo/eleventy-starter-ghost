const probe = require('probe-image-size');

module.exports = async (url) => {
  try {
    const { width, height } = await probe(url);
    return {
      width,
      height
    }
  } catch(err) {
    console.log(err);
  }
}