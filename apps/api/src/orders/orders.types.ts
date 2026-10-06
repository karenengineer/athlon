export type OrderLocale = "hy" | "ru" | "en";

export interface OrderEmailItem {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: string | null;
  lineTotal: string | null;
}

export interface OrderEmailMessage {
  orderReference: string;
  locale: OrderLocale;
  customer: { name: string; phone: string; address: string };
  items: OrderEmailItem[];
  total: string | null;
}
