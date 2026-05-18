-- Replace mistaken unit GRAMG (Gramma) with GRAMG1 (กรัม); keep convert_rate values.

do $$
declare
  bad_code text := 'GRAMG';
  good_code text := 'GRAMG1';
  good_label text := 'กรัม';
begin
  if not exists (select 1 from units where unit_code = good_code) then
    raise exception 'Target unit % not found', good_code;
  end if;

  update items
  set sub_unit_code = good_code
  where sub_unit_code = bad_code;

  update items
  set main_unit_code = good_code
  where main_unit_code = bad_code;

  update items
  set sub_unit = good_label
  where sub_unit_code = good_code
    and (sub_unit ilike '%Gramma%' or sub_unit ilike '%gramma%');

  update supplier_item_mapping
  set sub_unit_code = good_code
  where sub_unit_code = bad_code;

  update supplier_item_mapping
  set main_unit_code = good_code
  where main_unit_code = bad_code;

  update unit_pair_hints
  set sub_unit_code = good_code
  where sub_unit_code = bad_code;

  update unit_pair_hints
  set main_unit_code = good_code
  where main_unit_code = bad_code;

  update item_versions
  set sub_unit_code = good_code
  where sub_unit_code = bad_code;

  update item_versions
  set main_unit_code = good_code
  where main_unit_code = bad_code;

  update supplier_item_mapping_versions
  set sub_unit_code = good_code
  where sub_unit_code = bad_code;

  update supplier_item_mapping_versions
  set main_unit_code = good_code
  where main_unit_code = bad_code;

  update transactions
  set sub_unit = good_label
  where sub_unit ilike '%Gramma%';

  update transactions
  set main_unit = good_label
  where main_unit ilike '%Gramma%';

  update units as g
  set
    usage_count_main = g.usage_count_main + coalesce(b.usage_count_main, 0),
    usage_count_sub = g.usage_count_sub + coalesce(b.usage_count_sub, 0),
    last_used_at = greatest(g.last_used_at, b.last_used_at)
  from units as b
  where g.unit_code = good_code
    and b.unit_code = bad_code;

  delete from units where unit_code = bad_code;
end $$;
