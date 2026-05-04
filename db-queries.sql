-- ============================================
-- AquariumGalleryTripura - Utility Queries
-- Run in Supabase SQL Editor
-- ============================================


-- =====================
-- 📋 VIEW DATA
-- =====================

-- View all sales
SELECT * FROM sales ORDER BY sale_date DESC;

-- View all sale items
SELECT * FROM sale_items ORDER BY created_at DESC;

-- View all products
SELECT * FROM products ORDER BY name;

-- View all customers
SELECT * FROM customers ORDER BY created_at DESC;

-- View all damages
SELECT * FROM damages ORDER BY damage_date DESC;

-- View all points history
SELECT * FROM points_history ORDER BY created_at DESC;

-- View all product entries
SELECT * FROM product_entries ORDER BY entry_date DESC;

-- View all categories
SELECT * FROM categories ORDER BY name;

-- View homepage content
SELECT * FROM homepage_content ORDER BY sort_order;


-- =====================
-- 🔍 VIEW DATA BY DATE
-- =====================

-- Sales today
SELECT * FROM sales WHERE sale_date::date = CURRENT_DATE ORDER BY sale_date DESC;

-- Sales this month
SELECT * FROM sales WHERE sale_date >= date_trunc('month', CURRENT_DATE) ORDER BY sale_date DESC;

-- Sales between specific dates (change dates as needed)
SELECT * FROM sales WHERE sale_date BETWEEN '2026-05-01' AND '2026-05-31' ORDER BY sale_date DESC;

-- Damages today
SELECT * FROM damages WHERE damage_date::date = CURRENT_DATE ORDER BY damage_date DESC;


-- =====================
-- 🗑️ DELETE FROM SPECIFIC TABLES
-- =====================

-- ⚠️ Delete all sales (also deletes sale_items via CASCADE)
-- DELETE FROM sales;

-- ⚠️ Delete all sale items only
-- DELETE FROM sale_items;

-- ⚠️ Delete all customers (resets points too)
-- DELETE FROM customers;

-- ⚠️ Delete all damages
-- DELETE FROM damages;

-- ⚠️ Delete all points history
-- DELETE FROM points_history;

-- ⚠️ Delete all product entries log
-- DELETE FROM product_entries;

-- ⚠️ Delete all products
-- DELETE FROM products;

-- ⚠️ Delete all categories
-- DELETE FROM categories;


-- =====================
-- 🗑️ DELETE BY DATE
-- =====================

-- Delete sales from today (sale_items auto-deleted via CASCADE)
-- DELETE FROM sales WHERE sale_date::date = CURRENT_DATE;

-- Delete sales from a specific date
-- DELETE FROM sales WHERE sale_date::date = '2026-05-04';

-- Delete sales between dates
-- DELETE FROM sales WHERE sale_date BETWEEN '2026-05-01' AND '2026-05-04';

-- Delete damages from today
-- DELETE FROM damages WHERE damage_date::date = CURRENT_DATE;

-- Delete damages from a specific date
-- DELETE FROM damages WHERE damage_date::date = '2026-05-04';

-- Delete points history from today
-- DELETE FROM points_history WHERE created_at::date = CURRENT_DATE;


-- =====================
-- 🗑️ DELETE SPECIFIC RECORD BY ID
-- =====================

-- Delete a specific sale (paste the UUID)
-- DELETE FROM sales WHERE id = 'paste-uuid-here';

-- Delete a specific customer
-- DELETE FROM customers WHERE id = 'paste-uuid-here';

-- Delete a specific damage
-- DELETE FROM damages WHERE id = 'paste-uuid-here';

-- Delete a specific product
-- DELETE FROM products WHERE id = 'paste-uuid-here';


-- =====================
-- 🗑️ DELETE BY CUSTOMER
-- =====================

-- Delete all sales of a specific customer by phone
-- DELETE FROM sales WHERE customer_phone = '9876543210';

-- Delete a customer by phone
-- DELETE FROM customers WHERE phone = '9876543210';


-- =====================
-- 💣 RESET ALL DATA (NUCLEAR - careful!)
-- =====================

-- Deletes everything in correct order (respects foreign keys)
-- Run line by line:

-- DELETE FROM points_history;
-- DELETE FROM sale_items;
-- DELETE FROM sales;
-- DELETE FROM damages;
-- DELETE FROM product_entries;
-- DELETE FROM customers;
-- DELETE FROM products;
-- DELETE FROM categories;


-- =====================
-- 🔢 ROW COUNTS (quick check)
-- =====================

SELECT 'products' as table_name, COUNT(*) as rows FROM products
UNION ALL SELECT 'categories', COUNT(*) FROM categories
UNION ALL SELECT 'customers', COUNT(*) FROM customers
UNION ALL SELECT 'sales', COUNT(*) FROM sales
UNION ALL SELECT 'sale_items', COUNT(*) FROM sale_items
UNION ALL SELECT 'damages', COUNT(*) FROM damages
UNION ALL SELECT 'points_history', COUNT(*) FROM points_history
UNION ALL SELECT 'product_entries', COUNT(*) FROM product_entries
UNION ALL SELECT 'homepage_content', COUNT(*) FROM homepage_content;
