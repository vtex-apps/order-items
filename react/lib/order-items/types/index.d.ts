export interface AssemblyOptionInput {
  id: string;
  quantity: number;
  assemblyId: string;
  seller: string;
  inputValues: Record<string, string>;
  options?: AssemblyOptionInput[];
}

export interface BaseOrderForm {
  id: string;
  value: number;
  canEditData: boolean;
}

export interface CatalogItem {
  additionalInfo: ItemAdditionalInfo;
  availability: string;
  detailUrl: string;
  id: string;
  imageUrl: string;
  index?: number;
  listPrice: number;
  measurementUnit: string;
  name: string;
  price: number;
  productId: string;
  quantity: number;
  sellingPrice: number;
  seller: string;
  skuName: string;
  skuSpecifications: SKUSpecification[];
  options?: AssemblyOptionInput[];
  uniqueId?: string;
}

interface ItemAdditionalInfo {
  brandName: string;
}

export interface Item {
  id: string;
  quantity: number;
  uniqueId: string;
}

export interface MarketingData {
  coupon: string;
}

export interface OrderForm {
  id: string;
  items: Item[];
  canEditData: boolean;
  totalizers: Array<{
    id: string;
    name?: string | null;
    value: number;
  }>;
  value: number;
}

export interface OrderFormItemInput {
  id?: number;
  index?: number;
  quantity?: number;
  seller?: string;
  uniqueId?: string;
  options?: AssemblyOptionInput[];
}

export interface Totalizer {
  id: string;
  name: string;
  value: number;
}
