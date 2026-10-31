# Backup, Restore & Encryption Rotation

This guide documents the encrypted, rotation-aware backup and restore workflow
for DiaryArchive. It is the operational companion to the scripts in
`docker/scripts/` and is referenced directly by their headers.

> Meilisearch is **not** backed up. It is a rebuildable search index that is
> reindexed from MongoDB after a restore, so it is intentionally excluded.

## What gets backed up

| Component | Method | Encryption |
|-----------|--------|-----------|
| MongoDB | `mongodump --archive` | age authenticated encryption (`.age`) |
| MinIO object data | `tar` of `/data` | age authenticated encryption (`.age`) |
| Meilisearch | excluded (rebuildable) | n/a |

New dumps are piped through `age` immediately, so plaintext never touches
disk and each artifact is authenticated by the age envelope. The historical
OpenSSL AES-256-CBC + HMAC format remains readable for migration only; it is
not the recommended format for new backups.

## Encryption key

- Generate an age identity offline with `age-keygen` and derive its public
  recipient with `age-keygen -y identity.txt`.
- Put only the recipient in the production-readable
  `BACKUP_AGE_RECIPIENT_FILE`; keep the identity in offline/KMS-controlled
  recovery storage and never commit either file.
- Set `BACKUP_AGE_IDENTITY_FILE` only on the isolated restore workstation.

## Taking a backup

```bash
# Creates ./backups/<YYYYmmdd-HHMMSS>/ with authenticated .age archives
./docker/scripts/backup.sh
```

You can pass an alternate output root:
```bash
./docker/scripts/backup.sh /mnt/backups
```

### Retention / rotation

`backup.sh` prunes old backups after writing the new one:

| Retention env var | Default | Meaning |
|-------------------|---------|---------|
| `BACKUP_RETENTION_DAILY` | 14 | keep newest N by date |
| `BACKUP_RETENTION_WEEKLY` | 8 | keep newest N in a Monday week |
| `BACKUP_RETENTION_MONTHLY` | 6 | keep newest N in a fresh calendar month |

The newest backup is always kept. Set a value to `0` to disable that tier.
These defaults are also reflected in `backend/app/core/config.py`
(`backup_retention_*`) so the platform knows the intended cadence.

### Scheduling

Run `backup.sh` on a cron/systemd timer (daily is a good baseline). Example
crontab:

```cron
# Daily 02:30, weekly at 02:30 Monday, monthly at 02:30 on the 1st
30 2 * * * /path/to/diaryArchive/docker/scripts/backup.sh /mnt/backups
```

## Restoring (production)

Restoring is destructive (`mongorestore --drop`), so it requires an explicit
human confirmation guard:

```bash
CONFIRM_PRODUCTION_RESTORE=yes ./docker/scripts/restore.sh /mnt/backups/<STAMP>
```

For an age archive, set `BACKUP_AGE_IDENTITY_FILE`. Without
`CONFIRM_PRODUCTION_RESTORE=yes` the script refuses to run. After a restore,
restart the backend so Meilisearch reindexes from MongoDB:

```bash
docker compose -f docker-compose.yml -f docker-compose.prod.yml restart backend
```

## Verifying a backup is restorable

Always verify before you trust a backup. `verify-restore.sh` restores the
encrypted archive into an **isolated, throwaway** Mongo container and a scratch
MinIO dir (never production) and asserts:

1. The `users` collection is non-empty and readable.
2. At least one MinIO media object survives in the tar.

```bash
./docker/scripts/verify-restore.sh /mnt/backups/<STAMP>
```

It prints `VERIFY-RESTORE PASSED` on success and cleans up after itself. Run
this after every backup (or as a scheduled job) to catch corrupt or
unrestorable archives early.

## Migrating legacy archives and rotating keys

Set `BACKUP_AGE_RECIPIENT_FILE` and run `backup.sh` to create new `.age`
archives. Keep the legacy `BACKUP_ENCRYPTION_KEY` only until all old `.enc`
archives expire or have been intentionally re-encrypted. Do not delete the
old key before an age restore drill and an offline recovery copy succeed.

Rotating an age identity does not re-encrypt existing archives — the old
identity remains required to decrypt them. To rotate:

1. Generate a new identity and recipient offline.
2. Update `BACKUP_AGE_RECIPIENT_FILE` and take a fresh backup.
3. Retain the old identity until all archives encrypted under it have expired from
   retention, then destroy it.
