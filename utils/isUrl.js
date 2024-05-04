function isUrl(str) {
    var httpUrlPattern = /^(http|https):\/\/.+/i;
    return httpUrlPattern.test(str);
}

module.exports = { isUrl };