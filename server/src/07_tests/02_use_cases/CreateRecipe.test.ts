import { CreateRecipe } from "../../02_use_cases/CreateRecipe";

describe("CreateRecipe Use Case", () => {
  it("cleans input and calls repository.create with normalized data", async () => {
    const mockCreated = {
      id: 1,
      name: "Test Recipe",
      slug: "test-recipe",
    } as any;

    const mockRepo = {
      create: jest.fn().mockResolvedValue(mockCreated),
    } as any;

    const useCase = new CreateRecipe(mockRepo);

    const input = {
      name: "Test Recipe",
      cuisine: "Italian",
      serving_info: { number_of_people_served: 2 },
    } as any;

    const result = await useCase.execute(input);

    expect(mockRepo.create).toHaveBeenCalledTimes(1);
    const passed = mockRepo.create.mock.calls[0][0];
    expect(passed.slug).toBe("test-recipe");
    expect(passed.uniqueId).toBeDefined();
    expect(passed.dietaryRestrictions).toEqual([]);
    expect(result).toBe(mockCreated);
  });

  it("throws when name is missing", async () => {
    const mockRepo = { create: jest.fn() } as any;
    const useCase = new CreateRecipe(mockRepo);

    await expect(useCase.execute({} as any)).rejects.toThrow(
      "Recipe name is required"
    );
    expect(mockRepo.create).not.toHaveBeenCalled();
  });
});
