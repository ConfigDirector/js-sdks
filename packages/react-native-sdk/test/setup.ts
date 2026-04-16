import { cleanup } from "@testing-library/react-native";
import { afterEach, jest } from "@jest/globals";

// The Node.js test environment has no XMLHttpRequest, so we replace the XHR-based
// streaming fetch with the global fetch. Using an indirect reference ensures that
// per-test jest.spyOn(global, 'fetch') calls are correctly intercepted.
jest.mock("../src/reactNativeStreamingFetch", () => ({
  reactNativeStreamingFetch: (...args: Parameters<typeof fetch>) => fetch(...args),
}));

afterEach(cleanup);
