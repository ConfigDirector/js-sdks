const quietLogger = { debug() {}, info() {}, warn() {}, error() {} };

const config = {
  id: "00000000-0000-0000-0000-000000000001",
  key: "new-checkout-flow",
  type: "boolean",
  variations: [],
  target: {
    defaultValue: "false",
    rules: [
      {
        id: "10000000-0000-0000-0000-000000000001",
        type: "conditional",
        order: 0,
        target: "value",
        value: "true",
        percentages: [],
        conditions: [
          {
            id: "20000000-0000-0000-0000-000000000001",
            attribute: "traits",
            trait: "/plan",
            operator: "is one of",
            targetType: "text",
            targetValues: ["pro", "enterprise"],
          },
          {
            id: "20000000-0000-0000-0000-000000000002",
            attribute: "appVersion",
            operator: ">=",
            targetType: "semver",
            targetValues: ["3.2.0"],
          },
        ],
      },
    ],
  },
};

const evaluateScenarios = (ConfigEvaluator, version) => {
  const evaluator = new ConfigEvaluator(quietLogger);
  const value = (plan, appVersion) =>
    evaluator.evaluate(config, { context: { id: "user-1", traits: { plan } }, metadata: { appVersion } }).value;
  return {
    version,
    bothConditionsMatch: value("pro", "3.4.0"),
    onlyThePlanMatches: value("pro", "3.1.0"),
    onlyTheVersionMatches: value("free", "3.4.0"),
  };
};

module.exports = { evaluateScenarios };
