"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createUserController = createUserController;
const GetUserProfileFactory_1 = require("./GetUserProfileFactory");
const UserController_1 = require("../03_adapters/controllers/UserController");
function createUserController() {
    const getUserProfile = (0, GetUserProfileFactory_1.createGetUserProfile)();
    const updateUserProfile = (0, GetUserProfileFactory_1.createUpdateUserProfile)();
    return new UserController_1.UserController(getUserProfile, updateUserProfile);
}
