const { version } = require("./package.json");

// Replaces the __VERSION__ sentinel (used in client.ts) with the actual package
// version at build time. Applies to both the bob build output and Jest tests.
const replaceVersionPlugin = () => ({
  visitor: {
    StringLiteral(path) {
      if (path.node.value === "__VERSION__") {
        path.node.value = version;
      }
    },
  },
});

module.exports = {
  overrides: [
    {
      exclude: /\/node_modules\//,
      presets: ["module:@react-native/babel-preset"],
      plugins: [replaceVersionPlugin],
    },
    {
      include: /\/node_modules\//,
      presets: ["module:@react-native/babel-preset"],
    },
  ],
};
