-- Hand the 12 tables created as `postgres` (Coins + SchoolNotification) to the
-- app role `olympiad`, which owns every other table in public. Until then the
-- app cannot even SELECT them ("permission denied"), so Coins does not work.
--
-- DATA: unchanged. Only the owner of each table changes.
-- RUN AS: the `postgres` superuser on the production database. The app role
--         `olympiad` is not allowed to run this.
-- Safe to run twice: setting the same owner again does nothing.

BEGIN;

ALTER TABLE public."CoinWalletV2"       OWNER TO olympiad;
ALTER TABLE public."CoinTransactionV2"  OWNER TO olympiad;
ALTER TABLE public."CoinTaskV2"         OWNER TO olympiad;
ALTER TABLE public."CoinRewardV2"       OWNER TO olympiad;
ALTER TABLE public."CoinRewardCode"     OWNER TO olympiad;
ALTER TABLE public."CoinRedemption"     OWNER TO olympiad;
ALTER TABLE public."CoinCheckin"        OWNER TO olympiad;
ALTER TABLE public."CoinStreakDay"      OWNER TO olympiad;
ALTER TABLE public."CoinTaskProgress"   OWNER TO olympiad;
ALTER TABLE public."CoinGameRule"       OWNER TO olympiad;
ALTER TABLE public."Referral"           OWNER TO olympiad;
ALTER TABLE public."SchoolNotification" OWNER TO olympiad;

-- Check: must list nothing before COMMIT takes effect.
SELECT c.relname AS still_not_olympiad
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relkind = 'r' AND pg_get_userbyid(c.relowner) <> 'olympiad';

COMMIT;
