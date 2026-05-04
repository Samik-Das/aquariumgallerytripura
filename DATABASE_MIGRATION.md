# Featured Products System - Database Migration

## Overview
This migration adds a featured products system that allows admins to manually select which products appear in the homepage carousel.

## Required Database Changes

### 1. Add `is_featured` Column to Products Table

Execute this SQL command in your Supabase SQL Editor:

```sql
ALTER TABLE products 
ADD COLUMN is_featured BOOLEAN DEFAULT false;
```

### 2. Create Index for Featured Products (Optional but Recommended)

For better query performance:

```sql
CREATE INDEX idx_products_is_featured 
ON products (is_featured) 
WHERE is_featured = true;
```

### 3. Set Initial Featured Products (Optional)

If you want to automatically feature some existing products:

**Option A: Feature newest 5 in-stock products**
```sql
UPDATE products 
SET is_featured = true 
WHERE quantity > 0 
  AND id IN (
    SELECT id 
    FROM products 
    WHERE quantity > 0 
    ORDER BY created_at DESC 
    LIMIT 5
  );
```

**Option B: Feature products by name/category**
```sql
-- Example: Feature all products containing "premium" in the name
UPDATE products 
SET is_featured = true 
WHERE LOWER(name) LIKE '%premium%';

-- Example: Feature all products in "Aquarium" category
UPDATE products 
SET is_featured = true 
WHERE category = 'Aquarium';
```

## How It Works

### Admin Control
- In **Admin Catalogue**, each product now has a "⭐ Featured" checkbox above the image
- Clicking the checkbox immediately toggles the featured status
- Featured products can be in-stock or out-of-stock
- No automatic limits on number of featured products

### Customer Experience
- **Homepage carousel** now shows only featured products
- If no products are featured, the carousel section is hidden
- Out-of-stock featured products still appear but without the "Add to Cart" button
- Stock status is clearly shown (Available/Low Stock/Out of Stock)

### Database Schema After Migration
```sql
-- products table structure (relevant columns)
CREATE TABLE products (
  id uuid PRIMARY KEY,
  name text NOT NULL,
  category text,
  quantity integer DEFAULT 0,
  selling_price numeric,
  buying_price numeric,
  image_url text,
  description text,
  is_featured boolean DEFAULT false,  -- 👈 NEW COLUMN
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);
```

## Rollback Instructions

If you need to remove the featured products system:

```sql
-- Remove the column
ALTER TABLE products DROP COLUMN is_featured;

-- Drop the index (if created)
DROP INDEX IF EXISTS idx_products_is_featured;
```

Then revert the code changes to restore the old carousel logic (featured products by quantity > 0).

## Testing the Migration

1. **Execute the SQL migration**
2. **Go to Admin Catalogue page** - you should see "⭐ Featured" checkboxes above product images
3. **Check/uncheck a few products** - should see success toast messages
4. **Visit the customer homepage** - carousel should show only featured products
5. **If no products are featured** - carousel section should be hidden

## Notes

- The featured status is stored in the database permanently
- Featured products maintain their order by creation date (newest first)
- The system gracefully handles empty featured product lists
- Out-of-stock products can still be featured for promotional purposes

---

# Per-Item Discount Feature - Database Migration

## Overview
This migration adds a per-item discount system in the sales flow. Discounts are tracked per item and reflected in profit/loss calculations.

## Required Database Changes

Execute these SQL commands in your Supabase SQL Editor:

### 1. Add `discount_amount` Column to `sale_items` Table

```sql
ALTER TABLE sale_items 
ADD COLUMN discount_amount DECIMAL(10,2) DEFAULT 0;
```

### 2. Add `total_discount` Column to `sales` Table

```sql
ALTER TABLE sales 
ADD COLUMN total_discount DECIMAL(10,2) DEFAULT 0;
```

## How It Works

- Each sale item row now has a **"Discount (₹)"** input field
- The discount is subtracted from the sale total
- Dashboard profit formula: `Profit = Revenue - Cost - Commission - Discount`
- Discount is visible in:
  - Sales page history table
  - Dashboard stat card ("Total Discount")
  - Dashboard sales detail table (per-item)
  - CSV export

## Rollback

```sql
ALTER TABLE sale_items DROP COLUMN discount_amount;
ALTER TABLE sales DROP COLUMN total_discount;
```