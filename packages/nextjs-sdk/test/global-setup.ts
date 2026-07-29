import { startMockSseServer } from "./helpers/mock-sse-server";
import { startNextServer } from "./helpers/next-server";

export async function setup() {
  const mockServer = await startMockSseServer();

  const nextServer = await startNextServer({
    // Server SDK picks this up in instrumentation.ts, and the root layout's (server) Config-
    // DirectorProvider reads the same two vars — both run server-side, so no NEXT_PUBLIC_
    // prefix is needed even though the client key ends up in the browser as prop data.
    CONFIGDIRECTOR_SERVER_KEY: "test-server-sdk-key",
    CONFIGDIRECTOR_BASE_URL: mockServer.baseUrl,
    CONFIGDIRECTOR_CLIENT_KEY: "test-client-sdk-key",

    // hooks-test's layout uses the client-only ConfigDirectorProvider directly, a genuine
    // Client Component, so it needs the NEXT_PUBLIC_ prefix to read the value in the browser.
    NEXT_PUBLIC_CONFIGDIRECTOR_CLIENT_KEY: "test-client-sdk-key",
    NEXT_PUBLIC_CONFIGDIRECTOR_BASE_URL: mockServer.baseUrl,
  });

  // Expose the fixture base URL so test files can build request URLs and Playwright page.goto()
  process.env["NEXTJS_SDK_TEST_URL"] = nextServer.baseUrl;

  return async () => {
    await nextServer.close();
    await mockServer.close();
  };
}
