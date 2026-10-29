#!/bin/sh
set -eu

mongosh --host mongodb \
  --username "$MONGO_ROOT_USER" \
  --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --eval '
    const dbName = "diaryarchive";
    const dbRef = db.getSiblingDB(dbName);
    if (!dbRef.getUser(process.env.MONGO_APP_USER)) {
      dbRef.createUser({
        user: process.env.MONGO_APP_USER,
        pwd: process.env.MONGO_APP_PASSWORD,
        roles: [
          { role: "readWrite", db: dbName },
          { role: "dbAdmin", db: dbName }
        ]
      });
    }
  '
