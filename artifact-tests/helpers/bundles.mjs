const ENVIRONMENT_ID = "10000000-0000-0000-0000-000000000000";
const PROJECT_ID = "20000000-0000-0000-0000-000000000000";

export const SERVER_BUNDLE = {
  environmentId: ENVIRONMENT_ID,
  projectId: PROJECT_ID,
  kind: "full",
  configs: {
    "welcome-message": {
      id: "00000000-0000-0000-0000-000000000001",
      key: "welcome-message",
      type: "string",
      variations: [],
      target: {
        environmentId: ENVIRONMENT_ID,
        rules: [],
        defaultValue: "Hello from ConfigDirector!",
      },
    },
    "feature-enabled": {
      id: "00000000-0000-0000-0000-000000000002",
      key: "feature-enabled",
      type: "boolean",
      variations: [],
      target: {
        environmentId: ENVIRONMENT_ID,
        rules: [],
        defaultValue: "true",
      },
    },
    "item-count": {
      id: "00000000-0000-0000-0000-000000000003",
      key: "item-count",
      type: "integer",
      variations: [],
      target: {
        environmentId: ENVIRONMENT_ID,
        rules: [],
        defaultValue: "7",
      },
    },
    "json-data": {
      id: "00000000-0000-0000-0000-000000000004",
      key: "json-data",
      type: "json",
      variations: [],
      target: {
        environmentId: ENVIRONMENT_ID,
        rules: [],
        defaultValue: JSON.stringify({ greeting: "hello", count: 3 }),
      },
    },
  },
};

export const CLIENT_BUNDLE = {
  environmentId: ENVIRONMENT_ID,
  projectId: PROJECT_ID,
  kind: "full",
  configs: {
    "welcome-message": {
      id: "00000000-0000-0000-0000-000000000001",
      key: "welcome-message",
      type: "string",
      value: "Hello from ConfigDirector!",
    },
    "feature-enabled": {
      id: "00000000-0000-0000-0000-000000000002",
      key: "feature-enabled",
      type: "boolean",
      value: "true",
    },
    "item-count": {
      id: "00000000-0000-0000-0000-000000000003",
      key: "item-count",
      type: "integer",
      value: "7",
    },
  },
};

export const EXPECTED_SERVER_VALUES = {
  welcomeMessage: "Hello from ConfigDirector!",
  featureEnabled: true,
  itemCount: 7,
  jsonData: { greeting: "hello", count: 3 },
};

export const EXPECTED_CLIENT_VALUES = {
  welcomeMessage: "Hello from ConfigDirector!",
  featureEnabled: true,
  itemCount: 7,
};
