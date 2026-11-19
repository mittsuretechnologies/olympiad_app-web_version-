-- Upload categories managed by the SuperAdmin (dashboard → Upload Categories).
--
-- One row per category, with its sub-categories in UploadSubCategory. Each
-- category says which kinds of user may upload into it (audiences: NORMAL =
-- general users, and Olympiad students once both Olympiad videos are in;
-- GENERAL_SCHOOL; OLYMPIAD_SCHOOL; OLYMPIAD_STUDENT = the two Olympiad slot
-- categories), and whether / where it shows on the app's Search and Home
-- screens.
--
-- Videos keep storing the category and sub-category NAMES as text, exactly as
-- before. Nothing here touches the Video table, evaluations or marks.
--
-- Run with:  npx prisma db execute --file prisma/manual-migrations/2026-11-12-upload-categories.sql --schema prisma/schema.prisma
-- NEVER `prisma db push` / `npm run db:sync` for this: the databases have
-- tables that are not in schema.prisma, and db push would drop them.
--
-- Safe to run more than once. The tables start empty on a new database; the
-- server fills them with the lists the app used to have built in on first use
-- (src/lib/uploadCategories.ts → ensureSeeded), so nothing changes for users
-- until the SuperAdmin edits something.

CREATE TABLE IF NOT EXISTS "public"."UploadCategory" (
  "id"              TEXT NOT NULL,
  "key"             TEXT NOT NULL,
  "label"           TEXT NOT NULL,
  "aliases"         TEXT[] DEFAULT ARRAY[]::TEXT[],
  "audiences"       TEXT[] DEFAULT ARRAY[]::TEXT[],
  "slotKind"        TEXT NOT NULL DEFAULT 'NONE',
  "icon"            TEXT NOT NULL DEFAULT 'apps-outline',
  "color"           TEXT NOT NULL DEFAULT '#5C6B8A',
  "imageUrl"        TEXT,
  "searchQuery"     TEXT,
  "searchCats"      TEXT,
  "searchLabel"     TEXT,
  "showInSearch"    BOOLEAN NOT NULL DEFAULT true,
  "searchSortOrder" INTEGER NOT NULL DEFAULT 0,
  "showOnHome"      BOOLEAN NOT NULL DEFAULT false,
  "homeSortOrder"   INTEGER NOT NULL DEFAULT 0,
  "sortOrder"       INTEGER NOT NULL DEFAULT 0,
  "isActive"        BOOLEAN NOT NULL DEFAULT true,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL,
  CONSTRAINT "UploadCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "UploadCategory_key_key" ON "public"."UploadCategory"("key");

CREATE TABLE IF NOT EXISTS "public"."UploadSubCategory" (
  "id"         TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "label"      TEXT NOT NULL,
  "aliases"    TEXT[] DEFAULT ARRAY[]::TEXT[],
  "icon"       TEXT NOT NULL DEFAULT 'star-outline',
  "classCodes" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "sortOrder"  INTEGER NOT NULL DEFAULT 0,
  "isActive"   BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "UploadSubCategory_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "UploadSubCategory_categoryId_idx" ON "public"."UploadSubCategory"("categoryId");

DO $$ BEGIN
  ALTER TABLE "public"."UploadSubCategory"
    ADD CONSTRAINT "UploadSubCategory_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "public"."UploadCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Databases that already have the first version of these tables (created
-- 2026-11-03, without Home / ordering / alias columns): add the new columns
-- and give the existing rows today's Search and Home behaviour. The UPDATEs
-- run only in the same step that adds the column, so a re-run never undoes
-- what the SuperAdmin has changed since.
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'UploadCategory' AND column_name = 'aliases') THEN
    ALTER TABLE "public"."UploadCategory" ADD COLUMN "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'UploadSubCategory' AND column_name = 'aliases') THEN
    ALTER TABLE "public"."UploadSubCategory" ADD COLUMN "aliases" TEXT[] DEFAULT ARRAY[]::TEXT[];
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'UploadCategory' AND column_name = 'searchSortOrder') THEN
    ALTER TABLE "public"."UploadCategory" ADD COLUMN "searchSortOrder" INTEGER NOT NULL DEFAULT 0;
    -- Search screen order the app had built in.
    UPDATE "public"."UploadCategory" SET "searchSortOrder" = CASE "key"
      WHEN 'talent' THEN 0 WHEN 'rhymes' THEN 1 WHEN 'speech' THEN 2 WHEN 'learning' THEN 3
      WHEN 'parenting' THEN 4 WHEN 'school_activity' THEN 5 WHEN 'others' THEN 6
      WHEN 'oly_a' THEN 7 WHEN 'oly_b' THEN 8 ELSE 100 + "sortOrder" END;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'UploadCategory' AND column_name = 'showOnHome') THEN
    ALTER TABLE "public"."UploadCategory" ADD COLUMN "showOnHome" BOOLEAN NOT NULL DEFAULT false;
    ALTER TABLE "public"."UploadCategory" ADD COLUMN IF NOT EXISTS "homeSortOrder" INTEGER NOT NULL DEFAULT 0;
    -- Home had one row per category name found in the videos. Same rows now:
    -- "Talent Performance" (normal and Olympiad videos share the name),
    -- "Rhymes / Speech" (Olympiad slot B), Rhymes, Speech & Presentation,
    -- School Activity, Others. Learning / Parenting are on: their switch shows
    -- or hides the SuperAdmin's curated Learning / Parenting rows on Home.
    UPDATE "public"."UploadCategory" SET
      "showOnHome" = "key" IN ('talent', 'oly_b', 'rhymes', 'speech', 'school_activity', 'others', 'learning', 'parenting'),
      "homeSortOrder" = CASE "key"
        WHEN 'talent' THEN 0 WHEN 'oly_b' THEN 1 WHEN 'rhymes' THEN 2 WHEN 'speech' THEN 3
        WHEN 'school_activity' THEN 4 WHEN 'others' THEN 5 WHEN 'learning' THEN 6
        WHEN 'parenting' THEN 7 WHEN 'oly_a' THEN 8 ELSE 100 + "sortOrder" END;
  END IF;

  ALTER TABLE "public"."UploadCategory" ADD COLUMN IF NOT EXISTS "homeSortOrder" INTEGER NOT NULL DEFAULT 0;
END $$;

-- The first version seeded "Music (Instrument)" with 'guitar-outline', an icon
-- Ionicons doesn't have (the app drew a "?"). Use the one Search always showed.
UPDATE "public"."UploadSubCategory" SET "icon" = 'musical-notes-outline' WHERE "icon" = 'guitar-outline';

-- Home screen layout: the order of every item on the app's Home screen (the
-- category rows and the other sections: MittFest, Most Watched, Videos From
-- Your School), and the on/off switch of those other sections. "key" is a
-- section key ('mittfest', 'trending', 'school') or 'cat:<UploadCategory.key>'.
-- Categories keep their own on/off switch (UploadCategory.showOnHome); their
-- row here only holds the order. Empty = the app's original order.
CREATE TABLE IF NOT EXISTS "public"."HomeLayoutItem" (
  "key"       TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "visible"   BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "HomeLayoutItem_pkey" PRIMARY KEY ("key")
);
