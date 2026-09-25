# Finance operations

This runbook covers the approved opening ledger import and the first finance release. Run commands from the matching release checkout. Keep credentials in the existing environment configuration; never put them in command history, tickets, or this document.

## Prepare and back up

Confirm that catalog products, an active administrator, and the approved opening source are present. Before any production migration or import, take a timestamped database backup on the host and record the printed path with the release revision:

```bash
cd /opt/athlon
./scripts/backup-production.sh
```

The deployment script also takes a backup before migration. Keep the matching application image tags and database backup together; an image rollback cannot undo a database migration or import.

## Migrate, preview, reconcile, import

In a configured local or staging environment, run:

```bash
pnpm --filter @athlon/api db:deploy
pnpm --filter @athlon/api db:import-finance-opening -- --dry-run
pnpm --filter @athlon/api db:import-finance-opening
pnpm verify
```

Review the dry run before the write. It must resolve all 25 source SKUs and print purchased units, sold units, remaining stock, inventory value, revenue, COGS, and gross profit by SKU and in total. Compare those values to the approved opening source; a mismatch or missing SKU is a stop condition. The import uses stable keys and checks reconciliation again. A repeat import must report the same totals without duplicating rows. Preserve the printed reconciliation output with the release record. For production, perform this phase under the release lock and with the pre-import backup path recorded.

## Smoke checks

Run the existing public smoke after deployment:

```bash
bash scripts/smoke-production.sh
```

Sign in as an administrator and check Finance dashboard, products, purchases, sales, expenses, and the monthly summary for the opening month. Compare current stock and monetary totals to the import reconciliation. Download `monthly-summary.csv` and `accounting.xlsx` from Finance exports; check the expected month, headers, and totals, then delete any local copies containing business data according to the operator's retention policy. Verify unauthenticated finance requests return 401 and a finance write without the CSRF header returns 403. These finance checks require an authorized administrator session and are not part of the public smoke script.

## Rollback and restore

If only the application release is wrong and its schema is compatible, use the retained image tags and release-lock rollback procedure in [README](../README.md#rollback-without-removing-volumes), then rerun public and finance smoke checks. If the migration or import must be reversed, stop application traffic and restore the specific backup taken before the change using [README's database restore procedure](../README.md#backups-and-restore). A restore replaces all database changes since that backup. Pair the restored database with the matching application release, verify the opening reconciliation and exports again, and record the restored revision only after smoke succeeds. Never remove production volumes as a rollback shortcut.
