#!/bin/sh
# Generate Redis config from environment variables.
# The password is written to a file so it never appears in docker inspect,
# process listings, or shell history.
set -e

CONF=/tmp/redis.conf

cat > "$CONF" <<EOF
# AOF persistence (primary)
appendonly yes
appendfsync everysec
appenddirname "appendonlydir"

# RDB snapshots (fallback)
save 900 1
save 300 10
save 60 10000
rdbcompression yes
rdbchecksum yes
dbfilename dump.rdb

# Memory management
maxmemory ${REDIS_MAXMEMORY:-128mb}
maxmemory-policy allkeys-lru

# Logging
loglevel notice
EOF

if [ -n "$REDIS_PASSWORD" ]; then
  # Write password via a heredoc to avoid argument-level exposure.
  cat >> "$CONF" <<EOF
requirepass $REDIS_PASSWORD
EOF
fi

exec redis-server "$CONF"
