import { GroceryItem } from "../../01_entities/GroceryItem";

describe("GroceryItem Entity", () => {
  it("should create a valid grocery item object", () => {
    const groceryItem: GroceryItem = {
      id: 1,
      userId: 1,
      recipeId: 101,
      itemName: "Milk",
      quantity: 2,
      unit: "liters",
      isChecked: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(groceryItem.id).toBe(1);
    expect(groceryItem.userId).toBe(1);
    expect(groceryItem.recipeId).toBe(101);
    expect(groceryItem.itemName).toBe("Milk");
    expect(groceryItem.quantity).toBe(2);
    expect(groceryItem.unit).toBe("liters");
    expect(groceryItem.isChecked).toBe(false);
    expect(groceryItem.createdAt).toBeInstanceOf(Date);
    expect(groceryItem.updatedAt).toBeInstanceOf(Date);
  });

  it("should handle optional fields correctly", () => {
    const groceryItem: GroceryItem = {
      id: 2,
      userId: 1,
      itemName: "Eggs",
      quantity: 12,
      isChecked: true,
    };

    expect(groceryItem.id).toBe(2);
    expect(groceryItem.userId).toBe(1);
    expect(groceryItem.recipeId).toBeUndefined();
    expect(groceryItem.unit).toBeUndefined();
    expect(groceryItem.isChecked).toBe(true);
    expect(groceryItem.createdAt).toBeUndefined();
    expect(groceryItem.updatedAt).toBeUndefined();
  });
});
