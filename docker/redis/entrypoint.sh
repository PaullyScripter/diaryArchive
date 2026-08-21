#!/bin/sh
# Generate Redis config from environment variables.
# The password is written to a file so it never appears in docker inspect,
# process listings, or shell history.
set -e

CONF=/tmp/redis.conf

cat > "$CONF" <<EOF
appendonly yes
appendfsync everysec
EOF

if [ -n "$REDIS_PASSWORD" ]; then
  # Write password via a heredoc to avoid argument-level exposure.
  cat >> "$CONF" <<EOF
requirepass $REDIS_PASSWORD
EOF
fi

exec redis-server "$CONF"
