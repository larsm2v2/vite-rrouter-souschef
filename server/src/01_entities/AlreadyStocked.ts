export interface StockedItem {
  name: string;
  quantity?: number;
  unit?: string;
  category?: string;
  runningLow?: boolean;
}

export interface AlreadyStocked {
  id: number;
  userId: number;
  stockedItems: StockedItem[];
  createdAt: string;
  updatedAt: string;
}
