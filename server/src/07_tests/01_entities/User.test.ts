import { User } from "../../01_entities";

describe("User Entity", () => {
  it("should create a valid user object", () => {
    const user: User = {
      id: 1,
      email: "test@example.com",
      displayName: "Test User",
      avatar: "avatar.png",
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    expect(user.id).toBe(1);
    expect(user.email).toBe("test@example.com");
    expect(user.displayName).toBe("Test User");
    expect(user.avatar).toBe("avatar.png");
    expect(user.createdAt).toBeInstanceOf(Date);
    expect(user.updatedAt).toBeInstanceOf(Date);
  });
  it("should handle optional fields correctly", () => {
    const user: User = {
      id: 2,
      email: "optional@example.com",
      displayName: "Optional User",
    };

    expect(user.id).toBe(2);
    expect(user.email).toBe("optional@example.com");
    expect(user.displayName).toBe("Optional User");
    expect(user.googleSub).toBeUndefined();
    expect(user.avatar).toBeUndefined();
    expect(user.createdAt).toBeUndefined();
    expect(user.updatedAt).toBeUndefined();
  });
});
