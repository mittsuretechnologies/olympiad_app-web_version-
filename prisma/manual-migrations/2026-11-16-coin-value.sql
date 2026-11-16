-- Coins: when SuperAdmin changes "₹ per 1 coin", coins a user already holds keep
-- the ₹ value they were earned at; only coins earned after the change count at
-- the new rate. Spending takes ₹ off in proportion (spend half the coins → half
-- the ₹ value goes) and a refund gives back exactly the ₹ its redemption took.
--
--   CoinWalletV2.balanceInr       ₹ value of the coins the user holds now
--   CoinTransactionV2.amountInr   ₹ this entry added (+) or took off (−)
--
-- Run with:  npx prisma db execute --file prisma/manual-migrations/2026-11-16-coin-value.sql --schema prisma/schema.prisma
-- Run it on a database BEFORE deploying the code that uses these columns.
-- Additive and safe to run more than once: existing wallets are filled in only
-- on the run that adds the columns. NEVER `prisma db push` / `npm run db:sync`.

DO $$
DECLARE
  rate  double precision;
  w     record;
  t     record;
  bal   integer;
  val   double precision;
  delta double precision;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'CoinWalletV2' AND column_name = 'balanceInr') THEN
    RETURN;  -- already migrated
  END IF;

  ALTER TABLE "public"."CoinWalletV2" ADD COLUMN "balanceInr" DOUBLE PRECISION NOT NULL DEFAULT 0;
  ALTER TABLE "public"."CoinTransactionV2" ADD COLUMN IF NOT EXISTS "amountInr" DOUBLE PRECISION;

  -- Today's rate, for entries written before the ledger recorded one.
  SELECT (value::jsonb ->> 'inrPerCoin')::double precision INTO rate
    FROM "public"."AppSetting" WHERE key = 'coins.config';
  rate := COALESCE(rate, 0.1);

  -- Replay each wallet's history in order, valuing every entry at the rate it
  -- was written with.
  FOR w IN SELECT "appUserId", "balance" FROM "public"."CoinWalletV2" LOOP
    bal := 0;
    val := 0;
    FOR t IN SELECT "id", "amount", "type", "idempotencyKey", "inrPerCoin"
               FROM "public"."CoinTransactionV2"
              WHERE "appUserId" = w."appUserId"
              ORDER BY "createdAt", "id" LOOP
      IF t."amount" > 0 THEN
        delta := NULL;
        IF t."type" = 'REFUND' AND t."idempotencyKey" LIKE 'refund:%' THEN
          SELECT -"amountInr" INTO delta FROM "public"."CoinTransactionV2"
           WHERE "idempotencyKey" = 'redeem:' || substr(t."idempotencyKey", 8);
        END IF;
        IF delta IS NULL THEN
          delta := t."amount" * COALESCE(t."inrPerCoin", rate);
        END IF;
      ELSIF bal + t."amount" <= 0 THEN
        delta := -val;
      ELSE
        delta := val * t."amount" / bal;   -- amount is negative here
      END IF;
      delta := round(delta::numeric, 4)::double precision;
      bal := bal + t."amount";
      val := GREATEST(val + delta, 0);
      UPDATE "public"."CoinTransactionV2" SET "amountInr" = delta WHERE "id" = t."id";
    END LOOP;
    -- History that doesn't add up to the balance: value it at today's rate.
    IF bal <> w."balance" THEN
      val := w."balance" * rate;
    END IF;
    UPDATE "public"."CoinWalletV2"
       SET "balanceInr" = round(val::numeric, 4)::double precision
     WHERE "appUserId" = w."appUserId";
  END LOOP;
END $$;
