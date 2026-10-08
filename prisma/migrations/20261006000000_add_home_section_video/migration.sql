-- Purely additive: a new table for the SuperAdmin-managed "Learning" and
-- "Parenting" home screen rows. No existing table or data is touched.
CREATE TABLE IF NOT EXISTS "public"."HomeSectionVideo" (
    "id"           TEXT         NOT NULL,
    "section"      TEXT         NOT NULL,
    "title"        TEXT         NOT NULL,
    "description"  TEXT         NOT NULL DEFAULT '',
    "videoUrl"     TEXT         NOT NULL,
    "thumbnailUrl" TEXT         NOT NULL,
    "order"        INTEGER      NOT NULL DEFAULT 0,
    "isActive"     BOOLEAN      NOT NULL DEFAULT true,
    "viewsCount"   INTEGER      NOT NULL DEFAULT 0,
    "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt"    TIMESTAMP(3) NOT NULL,

    CONSTRAINT "HomeSectionVideo_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "HomeSectionVideo_section_isActive_order_idx"
    ON "public"."HomeSectionVideo"("section", "isActive", "order");
