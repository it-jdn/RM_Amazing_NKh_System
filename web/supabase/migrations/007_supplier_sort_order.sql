-- Custom order for supplier dropdowns (intake); admin list still sorts by supp_code in UI
alter table suppliers
  add column if not exists sort_order int not null default 0;

with numbered as (
  select supp_code, (row_number() over (order by supp_code)) * 10 as rn
  from suppliers
)
update suppliers s
set sort_order = n.rn
from numbered n
where s.supp_code = n.supp_code
  and s.sort_order = 0;

create index if not exists idx_suppliers_sort_order on suppliers (sort_order, supp_code);
