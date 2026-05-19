import { startMockSseServer } from "./helpers/mock-sse-server";
import { startNextServer } from "./helpers/next-server";

export async function setup() {
  const mockServer = await startMockSseServer();

  const nextServer = await startNextServer({
    // Server SDK picks this up in instrumentation.ts
    CONFIGDIRECTOR_SERVER_KEY: "test-server-sdk-key",
    CONFIGDIRECTOR_BASE_URL: mockServer.baseUrl,

    // Client SDK picks this up in the layout's ConfigDirectorProvider
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
