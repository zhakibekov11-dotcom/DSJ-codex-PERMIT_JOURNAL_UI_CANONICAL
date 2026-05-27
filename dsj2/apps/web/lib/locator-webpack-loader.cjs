const locatorWebpackLoader = require("@locator/webpack-loader").default;

module.exports = function wrappedLocatorWebpackLoader(source, inputSourceMap) {
  const { cwd } = this.getOptions();

  if (!cwd) {
    return locatorWebpackLoader.call(this, source, inputSourceMap);
  }

  const previousWorkingDirectory = process.cwd();

  try {
    // Force LocatorJS to compute file paths from the monorepo root.
    process.chdir(cwd);
    return locatorWebpackLoader.call(this, source, inputSourceMap);
  } finally {
    process.chdir(previousWorkingDirectory);
  }
};
