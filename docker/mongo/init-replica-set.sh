#!/bin/sh
# Initialize MongoDB as a single-member replica set for transaction support.
# This is idempotent: if the set is already initialized, rs.status() succeeds.
set -e

REPLICA_SET="${MONGO_REPLICA_SET:-diaryarchive}"
MONGO_USER="${MONGO_INITDB_ROOT_USERNAME:-admin}"
MONGO_PASS="${MONGO_INITDB_ROOT_PASSWORD:-}"
MONGO_HOST="${MONGO_HOST:-mongodb:27017}"

echo "==> Waiting for mongod to accept connections..."
until mongosh --host "$MONGO_HOST" --quiet -u "$MONGO_USER" -p "$MONGO_PASS" --authenticationDatabase admin \
    --eval 'db.runCommand({ping:1}).ok' >/dev/null 2>&1; do
  sleep 1
done

echo "==> Checking replica set status..."
STATUS=$(mongosh --host "$MONGO_HOST" --quiet -u "$MONGO_USER" -p "$MONGO_PASS" --authenticationDatabase admin \
  --eval "try { rs.status().ok } catch(e) { 0 }" 2>/dev/null || echo 0)

if [ "$STATUS" = "1" ]; then
  echo "   Replica set '$REPLICA_SET' already initialized."
else
  echo "==> Initializing replica set '$REPLICA_SET'..."
  mongosh --host "$MONGO_HOST" --quiet -u "$MONGO_USER" -p "$MONGO_PASS" --authenticationDatabase admin \
    --eval "rs.initiate({ _id: '$REPLICA_SET', members: [{ _id: 0, host: '$MONGO_HOST' }] })"
  echo "   Replica set initialized."
fi

echo "==> Enabling MongoDB profiling for slow queries (threshold: 100ms)..."
mongosh --host "$MONGO_HOST" --quiet -u "$MONGO_USER" -p "$MONGO_PASS" --authenticationDatabase admin \
  --eval "db.setProfilingLevel(1, { slowms: 100 })" 2>/dev/null || echo "   profiling setup skipped (may need standalone mode)"
