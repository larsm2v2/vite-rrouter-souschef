"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.GroceryRepository = void 0;
const tsyringe_1 = require("tsyringe");
const connection_1 = __importDefault(require("../../05_frameworks/database/connection"));
let GroceryRepository = class GroceryRepository {
    constructor() { }
    getList(req, res) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const userId = (_a = req.user) === null || _a === void 0 ? void 0 : _a.id;
            if (!userId) {
                res.status(401).json({ error: "Unauthorized" });
                return;
            }
            const groceryList = yield this.findByUserId(userId);
            res.status(200).json(groceryList);
        });
    }
    /**
     * Find all grocery items for a specific user.
     * @param userId - The ID of the user.
     * @returns A list of grocery items.
     */
    findByUserId(userId) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield connection_1.default.query(`SELECT id, user_id AS "userId", recipe_id AS "recipeId", item_name AS "itemName", 
              quantity, unit, is_checked AS "isChecked", created_at AS "createdAt", updated_at AS "updatedAt"
       FROM grocery_list
       WHERE user_id = $1`, [userId]);
            return result.rows;
        });
    }
    /**
     * Add a new grocery item to the user's grocery list.
     * @param groceryItem - The grocery item to add.
     * @returns The newly created grocery item.
     */
    create(groceryItem) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield connection_1.default.query(`INSERT INTO grocery_list (user_id, recipe_id, item_name, quantity, unit, is_checked)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, user_id AS "userId", recipe_id AS "recipeId", item_name AS "itemName", 
                 quantity, unit, is_checked AS "isChecked", created_at AS "createdAt", updated_at AS "updatedAt"`, [
                groceryItem.userId,
                groceryItem.recipeId,
                groceryItem.itemName,
                groceryItem.quantity,
                groceryItem.unit,
                groceryItem.isChecked || false,
            ]);
            return result.rows[0];
        });
    }
    /**
     * Update an existing grocery item.
     * @param id - The ID of the grocery item to update.
     * @param groceryItem - The updated grocery item data.
     * @returns The updated grocery item.
     */
    update(id, groceryItem) {
        return __awaiter(this, void 0, void 0, function* () {
            const result = yield connection_1.default.query(`UPDATE grocery_list
       SET item_name = COALESCE($2, item_name),
           quantity = COALESCE($3, quantity),
           unit = COALESCE($4, unit),
           is_checked = COALESCE($5, is_checked),
           updated_at = NOW()
       WHERE id = $1
       RETURNING id, user_id AS "userId", recipe_id AS "recipeId", item_name AS "itemName", 
                 quantity, unit, is_checked AS "isChecked", created_at AS "createdAt", updated_at AS "updatedAt"`, [
                id,
                groceryItem.itemName,
                groceryItem.quantity,
                groceryItem.unit,
                groceryItem.isChecked,
            ]);
            return result.rows[0] || null;
        });
    }
    /**
     * Delete a grocery item by its ID.
     * @param id - The ID of the grocery item to delete.
     * @returns A boolean indicating whether the deletion was successful.
     */
    delete(id) {
        return __awaiter(this, void 0, void 0, function* () {
            var _a;
            const result = yield connection_1.default.query(`DELETE FROM grocery_list WHERE id = $1`, [
                id,
            ]);
            return ((_a = result.rowCount) !== null && _a !== void 0 ? _a : 0) > 0;
        });
    }
};
exports.GroceryRepository = GroceryRepository;
exports.GroceryRepository = GroceryRepository = __decorate([
    (0, tsyringe_1.injectable)(),
    __metadata("design:paramtypes", [])
], GroceryRepository);
