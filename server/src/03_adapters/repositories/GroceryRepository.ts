import { Request, Response } from "express";
import { GetGroceryList } from "../../02_use_cases/GetGroceryList";
import pool from "../../config/database";
import { GroceryItem } from "../../01_entities/GroceryItem";

export class GroceryRepository {
  constructor(private getGroceryList: GetGroceryList) {}

  async getList(req: Request, res: Response): Promise<void> {
    const userId = req.user?.id;

    if (!userId) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const groceryList = await this.getGroceryList.execute(userId);
    res.status(200).json(groceryList);
  }

  /**
   * Find all grocery items for a specific user.
   * @param userId - The ID of the user.
   * @returns A list of grocery items.
   */
  async findByUserId(userId: number): Promise<GroceryItem[]> {
    const result = await pool.query(
      `SELECT id, user_id AS "userId", recipe_id AS "recipeId", item_name AS "itemName", 
              quantity, unit, is_checked AS "isChecked", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM grocery_list
       WHERE user_id = $1`,
      [userId]
    );
    return result.rows;
  }

  /**
   * Add a new grocery item to the user's grocery list.
   * @param groceryItem - The grocery item to add.
   * @returns The newly created grocery item.
   */
  async create(groceryItem: Partial<GroceryItem>): Promise<GroceryItem> {
    const result = await pool.query(
      `INSERT INTO grocery_list (user_id, recipe_id, item_name, quantity, unit, is_checked)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id AS "userId", recipe_id AS "recipeId", item_name AS "itemName", 
                 quantity, unit, is_checked AS "isChecked", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        groceryItem.userId,
        groceryItem.recipeId,
        groceryItem.itemName,
        groceryItem.quantity,
        groceryItem.unit,
        groceryItem.isChecked || false,
      ]
    );
    return result.rows[0];
  }

  /**
   * Update an existing grocery item.
   * @param id - The ID of the grocery item to update.
   * @param groceryItem - The updated grocery item data.
   * @returns The updated grocery item.
   */
  async update(
    id: number,
    groceryItem: Partial<GroceryItem>
  ): Promise<GroceryItem | null> {
    const result = await pool.query(
      `UPDATE grocery_list
       SET item_name = COALESCE($2, item_name),
           quantity = COALESCE($3, quantity),
           unit = COALESCE($4, unit),
           is_checked = COALESCE($5, is_checked),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, user_id AS "userId", recipe_id AS "recipeId", item_name AS "itemName", 
                 quantity, unit, is_checked AS "isChecked", created_at AS "createdAt", updated_at AS "updatedAt"`,
      [
        id,
        groceryItem.itemName,
        groceryItem.quantity,
        groceryItem.unit,
        groceryItem.isChecked,
      ]
    );
    return result.rows[0] || null;
  }

  /**
   * Delete a grocery item by its ID.
   * @param id - The ID of the grocery item to delete.
   * @returns A boolean indicating whether the deletion was successful.
   */
  async delete(id: number): Promise<boolean> {
    const result = await pool.query(`DELETE FROM grocery_list WHERE id = $1`, [
      id,
    ]);
    return (result.rowCount ?? 0) > 0;
  }
}
