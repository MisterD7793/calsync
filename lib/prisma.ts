import { PrismaClient } from "@prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";
import path from "path";

function makePrisma() {
  const dbFile = (process.env.DATABASE_URL ?? "file:./prisma/dev.db").replace(/^file:/, "");
  const url = `file:${path.resolve(dbFile)}`;
  const adapter = new PrismaLibSql({ url });
  return new PrismaClient({ adapter });
}

type PrismaClientSingleton = ReturnType<typeof makePrisma>;

const globalForPrisma = globalThis as unknown as { prisma: PrismaClientSingleton };

export const prisma = globalForPrisma.prisma ?? makePrisma();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
