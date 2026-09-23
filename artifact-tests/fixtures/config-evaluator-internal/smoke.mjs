import { ConfigEvaluator, EVALUATOR_VERSION } from "@configdirector/config-evaluator-internal";
import { evaluateScenarios } from "./scenarios.cjs";

const report = evaluateScenarios(ConfigEvaluator, EVALUATOR_VERSION);
process.stdout.write(`${JSON.stringify(report)}\n`, () => process.exit(0));
