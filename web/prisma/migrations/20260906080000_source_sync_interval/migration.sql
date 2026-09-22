-- AlterTable: per-source auto-sync interval (minutes). NULL = manual only.
ALTER TABLE "Source" ADD COLUMN "syncEveryMinutes" INTEGER;
