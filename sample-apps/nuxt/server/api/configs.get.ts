export default defineEventHandler((event) =>
  resolveConfigs(useConfigDirectorServerClient(), getRequestURL(event).searchParams),
);
