import pg from "pg";
import { Sequelize } from "sequelize";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

const sslEnabled =
  process.env.DATABASE_SSL === "true" ||
  process.env.NODE_ENV === "production" ||
  databaseUrl.includes("sslmode=require");

const globalForSequelize = globalThis as unknown as {
  sequelize?: Sequelize;
};

export const sequelize =
  globalForSequelize.sequelize ??
  new Sequelize(databaseUrl, {
    dialect: "postgres",
    logging: false,
    dialectModule: pg,
    dialectOptions: sslEnabled
      ? {
          ssl: {
            require: true,
            rejectUnauthorized: false,
          },
        }
      : {},
  });

if (process.env.NODE_ENV !== "production") {
  globalForSequelize.sequelize = sequelize;
}

let hasSynced = false;

export async function ensureDb() {
  if (hasSynced) return;
  await sequelize.sync({ alter: true });
  hasSynced = true;
}
