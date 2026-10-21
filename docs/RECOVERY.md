# Save limits and garden recovery

Every accepted write is checked against the same validation and JSON budget used by backup export and restore. A rejected write leaves the previous save intact. Originals are preserved without silent trimming.

| Limit                                | Value                                     |
| ------------------------------------ | ----------------------------------------- |
| Normalized scrap                     | 8–800 Unicode characters                  |
| Original scrap, including whitespace | 8 KiB of UTF-8                            |
| Scraps                               | 200                                       |
| Sprouts                              | 1,000                                     |
| Pairing records                      | 19,900                                    |
| Portable JSON backup                 | 2 MiB, including indentation and metadata |

The total byte budget can be reached before a record-count limit. Writes reserve enough space for the longest valid revision counter, so crossing a revision digit boundary does not break an otherwise unchanged backup. Export uses the same pretty-printed serialization as the write check. The UI reports an error before replacing the saved state when a change exceeds a limit.

## If a saved garden cannot open

An invalid, future-version or oversized record opens a recovery screen. The stored record remains intact.

1. Select **Download original record** to keep the complete stored value as JSON. This raw recovery file may need repair or exceed the normal import limits; it is not certified as a valid backup.
2. Choose a valid JSON backup for the same garden. Validation completes before a replacement preview appears. The sample and personal records are independent.
3. Review the scrap/sprout counts, then explicitly confirm replacement, or select **Cancel restore**.
4. On confirmation, one IndexedDB transaction preserves the old record under a separate recovery key and installs the validated garden. If the record changed in another tab or the transaction aborts, replacement fails without changing the old record.
5. **Backup and export → Download previous recovery copy** retrieves that preserved original, including after reload. A later confirmed recovery replaces this one previous copy; download it separately for longer retention. Normal garden backups contain the active garden, not the separate recovery copy.

You can also open the independent garden or reload recovery. A competing writer tab must be closed before restoring. Recovery does not execute or resume model calls. The app does not automatically reset, migrate or truncate an unreadable record.

Raw downloads may contain all of your original ideas. Keep them private; use fictional inputs in public bug reports.

## Regression verification

From the repository root with Node 24 / npm 11:

```sh
npm run verify
npm run build
npm run package:single
npx playwright install chromium
npm run test:recovery
```

The dedicated Chromium suite uses isolated contexts and fictional IndexedDB fault injection. It checks corrupt, unsupported-version and oversized records in both the production static build and the standalone HTML with network disabled; rejected imports, cancellation, explicit replacement, raw downloads, recovery-copy retention, reload, ordinary backup roundtrip, a changed-record conflict, independent-garden access, mobile width and rejected new input. It does not use a model or an inference substitute. The recovery tests also run in repository CI, independently of live Ollama tests.

Unit regressions additionally cover original UTF-8 byte limits, a boundary-sized pretty backup across revision 9 → 10, accumulated history/count limits, memory fallback, preserved pending requests and an aborted recovery transaction.

The [sanitized local verification record](../evidence/recovery-verification.json) lists the final file hashes, standalone hash and executed browser cases. The [recovery screenshot](../evidence/recovery.png) shows the explicit replacement preview using fictional data. Historical live-model acceptance remains separate.
