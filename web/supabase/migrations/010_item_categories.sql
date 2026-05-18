-- Product categories for inventory reporting (5 COGS groups, no "Other")

create table item_categories (
  category_code text primary key,
  name_th text not null,
  name_en text not null default '',
  name_kr text not null default '',
  sort_order int not null default 0
);

insert into item_categories (category_code, name_th, name_en, name_kr, sort_order) values
  ('PROT', 'เนื้อสัตว์และอาหารทะเล', 'Proteins & Seafood', '육류·해산물', 1),
  ('PROD', 'ผัก ผลไม้ และสมุนไพรสด', 'Fresh Produce & Herbs', '신선 채소·과일·허브', 2),
  ('SEA', 'เครื่องปรุงและซอส', 'Seasonings & Sauces', '조미료·소스', 3),
  ('PANTRY', 'ของแห้ง ธัญพืช และเส้น', 'Dry Goods, Grains & Noodles', '건식·곡물·면류', 4),
  ('BEV', 'เครื่องดื่ม', 'Beverages', '음료', 5);

alter table items
  add column if not exists category_code text references item_categories (category_code);

create index if not exists idx_items_category_code on items (category_code);

-- Assign categories to catalog (see scripts/item-category-mapping.csv)
UPDATE items SET category_code = 'PROT' WHERE item_code IN ('RM00066', 'RM00067', 'RM00068', 'RM00070', 'RM00071', 'RM00072', 'RM00085', 'RM00086', 'RM00087', 'RM00088', 'RM00089', 'RM00090', 'RM00091', 'RM00092', 'RM00093', 'RM00094', 'RM00095', 'RM00096', 'RM00097', 'RM00098', 'RM00099', 'RM00100', 'RM00101', 'RM00102', 'RM00130', 'RM00158', 'RM00161', 'RM00162', 'RM00172', 'RM00173');
UPDATE items SET category_code = 'PROD' WHERE item_code IN ('RM00065', 'RM00073', 'RM00074', 'RM00075', 'RM00076', 'RM00077', 'RM00078', 'RM00079', 'RM00080', 'RM00081', 'RM00082', 'RM00084', 'RM00129', 'RM00131', 'RM00132', 'RM00133', 'RM00134', 'RM00135', 'RM00136', 'RM00137', 'RM00138', 'RM00139', 'RM00140', 'RM00141', 'RM00142', 'RM00143', 'RM00144', 'RM00145', 'RM00146', 'RM00147', 'RM00148', 'RM00149', 'RM00150', 'RM00151', 'RM00152', 'RM00153', 'RM00154', 'RM00155', 'RM00156', 'RM00157', 'RM00160', 'RM00178');
UPDATE items SET category_code = 'SEA' WHERE item_code IN ('RM00001', 'RM00002', 'RM00003', 'RM00004', 'RM00005', 'RM00006', 'RM00007', 'RM00008', 'RM00009', 'RM00010', 'RM00011', 'RM00012', 'RM00013', 'RM00019', 'RM00020', 'RM00021', 'RM00022', 'RM00023', 'RM00024', 'RM00025', 'RM00026', 'RM00027', 'RM00028', 'RM00029', 'RM00030', 'RM00031', 'RM00032', 'RM00033', 'RM00034', 'RM00035', 'RM00036', 'RM00037', 'RM00038', 'RM00039', 'RM00040', 'RM00041', 'RM00042', 'RM00058', 'RM00113', 'RM00114', 'RM00115', 'RM00116', 'RM00117', 'RM00118', 'RM00119', 'RM00120', 'RM00121', 'RM00122', 'RM00177');
UPDATE items SET category_code = 'PANTRY' WHERE item_code IN ('RM00014', 'RM00015', 'RM00016', 'RM00017', 'RM00018', 'RM00043', 'RM00044', 'RM00045', 'RM00046', 'RM00047', 'RM00048', 'RM00049', 'RM00050', 'RM00051', 'RM00052', 'RM00053', 'RM00054', 'RM00055', 'RM00056', 'RM00057', 'RM00059', 'RM00060', 'RM00061', 'RM00062', 'RM00063', 'RM00064', 'RM00069', 'RM00103', 'RM00104', 'RM00105', 'RM00106', 'RM00107', 'RM00108', 'RM00109', 'RM00110', 'RM00111', 'RM00112', 'RM00123', 'RM00124', 'RM00125', 'RM00126', 'RM00127', 'RM00128', 'RM00159', 'RM00176');
UPDATE items SET category_code = 'BEV' WHERE item_code IN ('RM00083', 'RM00163', 'RM00164', 'RM00165', 'RM00166', 'RM00167', 'RM00168', 'RM00169', 'RM00170', 'RM00171', 'RM00174', 'RM00175');

alter table items
  alter column category_code set default 'PANTRY';

alter table items
  alter column category_code set not null;

alter table item_categories enable row level security;
create policy "deny_anon_item_categories" on item_categories for all to anon using (false);
