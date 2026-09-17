import { getAllUsageHistoryForMigration } from "../lib/usage-history";
import { persistPermanentGeneration } from "../lib/highres/ledger";

async function main() {
  const history = await getAllUsageHistoryForMigration();
  for (const event of history.events) await persistPermanentGeneration(event);
  console.log(`Migrated ${history.events.length} retained try-on history records to permanent storage.`);
}

main().catch((error) => {
  console.error("permanent_history_migration_failed", error);
  process.exitCode = 1;
});
