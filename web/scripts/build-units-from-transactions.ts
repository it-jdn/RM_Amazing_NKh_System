/**
 * Build units master + pair hints from transactions and items.
 * Run after migration 005:
 *   npm run build:units
 */
import { rebuildUnitsFromTransactions } from "../src/lib/services/units";
import { loadDeployEnv } from "./load-deploy-env";

loadDeployEnv();

async function main() {
  const result = await rebuildUnitsFromTransactions();
  console.log(`✅ units upserted: ${result.unitsUpserted}, pair hints: ${result.pairsUpserted}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
