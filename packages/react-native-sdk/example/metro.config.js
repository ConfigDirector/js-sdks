const path = require("path");
const { getDefaultConfig } = require("@expo/metro-config");
const { withMetroConfig } = require("react-native-monorepo-config");

const root = path.resolve(__dirname, "..");

// TypeScript path aliases used by the SDK source — Metro doesn't read tsconfig paths
// so we resolve them here. Only needed when Metro loads the SDK via the "source"
// export condition (local development); production consumers get the bundled dist.
const PATH_ALIASES = {
  "@js-client-core": path.resolve(root, "../js-client-core/src"),
  "@eventsource": path.resolve(root, "../eventsource/src"),
  "@shared": path.resolve(root, "../shared/src"),
};

/**
 * Metro configuration
 * https://facebook.github.io/metro/docs/configuration
 *
 * @type {import('metro-config').MetroConfig}
 */
const config = withMetroConfig(getDefaultConfig(__dirname), {
  root,
  dirname: __dirname,
});

// withMetroConfig installs its own resolveRequest that handles monorepo packages.
// We chain onto it so our path aliases are resolved before falling through to it.
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver = {
  ...config.resolver,
  resolveRequest: (context, moduleName, platform) => {
    for (const [alias, aliasPath] of Object.entries(PATH_ALIASES)) {
      if (moduleName === alias || moduleName.startsWith(`${alias}/`)) {
        const subpath = moduleName.slice(alias.length + 1);
        const resolved = subpath ? path.join(aliasPath, subpath) : aliasPath;
        return context.resolveRequest(context, resolved, platform);
      }
    }
    return upstreamResolveRequest(context, moduleName, platform);
  },
};

// Watch workspace source directories so Metro picks up changes
config.watchFolders = [
  ...(config.watchFolders ?? []),
  ...Object.values(PATH_ALIASES),
];

module.exports = config;
