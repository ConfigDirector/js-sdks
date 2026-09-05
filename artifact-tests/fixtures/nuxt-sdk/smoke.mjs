const module = await import("@configdirector/nuxt-sdk");

const report = {
  defaultExportType: typeof module.default,
};
process.stdout.write(`${JSON.stringify(report)}\n`, () => process.exit(0));
