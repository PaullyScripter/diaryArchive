# Backup, Restore & Encryption Rotation

This guide documents the encrypted, rotation-aware backup and restore workflow
for DiaryArchive. It is the operational companion to the scripts in
`docker/scripts/` and is referenced directly by their headers.

> Meilisearch is **not** backed up. It is a rebuildable search index that is
> reindexed from MongoDB after a restore, so it is intentionally excluded.

## What gets backed up

| Component | Method | Encryption |
|-----------|--------|-----------|
| MongoDB | `mongodump --archive` | AES-256-CBC, PBKDF2 (200k iters) |
| MinIO object data | `tar` of `/data` | AES-256-CBC, PBKDF2 (200k iters) |
| Meilisearch | excluded (rebuildable) | n/a |

Both dumps are piped through `openssl enc -aes-256-cbc` immediately, so
plaintext never touches disk.

## Encryption key

- Set `BACKUP_ENCRYPTION_KEY` in `.env.production` (random, >= 32 chars).
- It is read from the environment and **never committed** to the repository.
- Generate one with `openssl rand -hex 32`.
- **Keep it safe.** Backups are unusable without it. Store a copy offline
  (e.g. a password manager / cold storage) separate from the server.

## Taking a backup

```bash
# Creates ./backups/<YYYYmmdd-HHMMSS>/ with encrypted archives
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

`BACKUP_ENCRYPTION_KEY` must match the one used to create the backup. Without
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

## Key rotation

Rotating `BACKUP_ENCRYPTION_KEY` does not re-encrypt existing archives — the
old key remains required to decrypt them. To rotate:

1. Stop accepting new backups with the old key (or keep using it for old data).
2. Set the new `BACKUP_ENCRYPTION_KEY` in `.env.production`.
3. Take a fresh backup with the new key going forward.
4. Retain the old key until all archives encrypted under it have expired from
   retention, then destroy it.

If you must re-encrypt historical archives, decrypt each with the old key and
re-encrypt with the new one using `openssl enc -d` / `openssl enc` with the
same PBKDF2 parameters (`-pbkdf2 -iter 200000`).