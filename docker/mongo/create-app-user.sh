#!/bin/sh
set -eu

mongosh --host mongodb \
  --username "$MONGO_ROOT_USER" \
  --password "$MONGO_ROOT_PASSWORD" \
  --authenticationDatabase admin \
  --eval '
    const dbName = "diaryarchive";
    const dbRef = db.getSiblingDB(dbName);
    const user = process.env.MONGO_APP_USER;
    const roles = [{ role: "readWrite", db: dbName }];
    if (dbRef.getUser(user)) {
      // Reconcile legacy deployments too: the API never needs dbAdmin or
      // root-equivalent privileges to read/write its own database.
      dbRef.updateUser(user, { pwd: process.env.MONGO_APP_PASSWORD, roles });
    } else {
      dbRef.createUser({
        user,
        pwd: process.env.MONGO_APP_PASSWORD,
        roles
      });
    }
  '
