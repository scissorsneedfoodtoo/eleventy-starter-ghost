const probe = require('probe-image-size');
// const requestImageSize = require('request-image-size');

// module.exports = async (url) => {
//   try {
//     const { width, height } = await probe(url);
//     return {
//       width,
//       height
//     }
//   } catch(err) {
//     console.log(err);
//   }
// }

module.exports = async (url) => {
  // console.log(url);
  try {
    return probe(url);
  } catch(err) {
    console.log(err);
  }
}

// module.exports = async (url) => {
//   console.log(url);
//   try {
//     return requestImageSize(url);
//   } catch(err) {
//     console.log(err);
//   }
// }
