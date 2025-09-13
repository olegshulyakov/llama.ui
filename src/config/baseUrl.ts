export default new URL('.', document.baseURI).href
  .toString()
  .replace(/\/$/, '');
