"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
Object.defineProperty(exports, "__esModule", { value: true });
const CreateRecipe_1 = require("../../02_use_cases/CreateRecipe");
describe("CreateRecipe Use Case", () => {
    it("cleans input and calls repository.create with normalized data", () => __awaiter(void 0, void 0, void 0, function* () {
        const mockCreated = {
            id: 1,
            name: "Test Recipe",
            slug: "test-recipe",
        };
        const mockRepo = {
            create: jest.fn().mockResolvedValue(mockCreated),
        };
        const useCase = new CreateRecipe_1.CreateRecipe(mockRepo);
        const input = {
            name: "Test Recipe",
            cuisine: "Italian",
            serving_info: { number_of_people_served: 2 },
        };
        const result = yield useCase.execute(input);
        expect(mockRepo.create).toHaveBeenCalledTimes(1);
        const passed = mockRepo.create.mock.calls[0][0];
        expect(passed.slug).toBe("test-recipe");
        expect(passed.uniqueId).toBeDefined();
        expect(passed.dietaryRestrictions).toEqual([]);
        expect(result).toBe(mockCreated);
    }));
    it("throws when name is missing", () => __awaiter(void 0, void 0, void 0, function* () {
        const mockRepo = { create: jest.fn() };
        const useCase = new CreateRecipe_1.CreateRecipe(mockRepo);
        yield expect(useCase.execute({})).rejects.toThrow("Recipe name is required");
        expect(mockRepo.create).not.toHaveBeenCalled();
    }));
});
