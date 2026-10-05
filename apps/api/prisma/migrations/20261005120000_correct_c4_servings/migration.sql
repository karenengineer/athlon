-- Correct the Armenian title of the 60-serving C4 only when it still has
-- the previously published 20-serving typo. Do not change the 30-serving SKU.
UPDATE "ProductTranslation" AS translation
SET "name" = 'Cellucor C4 Original — 60 չափաբաժին'
FROM "Product" AS product
WHERE translation."productId" = product."id"
  AND product."sku" = '1RPREC4HD'
  AND translation."locale" = 'HY'
  AND translation."name" = 'Cellucor C4 Original — 20 չափաբաժին';
