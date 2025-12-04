export interface StockedItem {
  name: string;
  quantity?: number;
  unit?: string;
}

export interface AlreadyStocked {
  id: number;
  userId: number;
  stockedItems: StockedItem[];
  createdAt: string;
  updatedAt: string;
}
