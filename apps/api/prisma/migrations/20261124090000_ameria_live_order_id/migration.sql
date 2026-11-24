-- vPOS 3.1 requires an integer OrderID that is unique per merchant. Live card
-- attempts take their OrderID from this int32-bounded sequence; the start value
-- keeps clear of the bank's sandbox test range (30543001-30544000).
CREATE SEQUENCE IF NOT EXISTS "ameria_live_order_id_seq"
  AS integer
  START WITH 410000001
  MINVALUE 410000001
  MAXVALUE 2147483647
  NO CYCLE;
