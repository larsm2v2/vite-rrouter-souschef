import migrateRecipeTables from "./05_frameworks/database/migrations/migrations";

(async function run() {
  try {
    await migrateRecipeTables();
    console.log("All migrations completed");
    process.exit(0);
  } catch (err) {
    console.error("Migration failed", err);
    process.exit(1);
  }
})();
