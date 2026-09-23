const { ConfigEvaluator, EVALUATOR_VERSION } = require("@configdirector/config-evaluator-internal");
const { evaluateScenarios } = require("./scenarios.cjs");

const report = evaluateScenarios(ConfigEvaluator, EVALUATOR_VERSION);
process.stdout.write(`${JSON.stringify(report)}\n`, () => process.exit(0));
