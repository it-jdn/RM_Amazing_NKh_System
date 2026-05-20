-- One-off cleanup: intake_slips rows with no transaction lines (e.g. after an older
-- "delete whole day" that only removed transactions). Safe to re-run; deletes nothing
-- when there are no orphans.
--
-- Run in Supabase SQL editor if the Receive (รับสินค้า) day summary still shows
-- a shop/receipt that no longer appears in Receipt History.

delete from intake_slips s
where not exists (
  select 1 from transactions t where t.slip_id = s.id
);
