"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createGetUserProfile = createGetUserProfile;
const repositories_1 = require("../03_adapters/repositories");
const _02_use_cases_1 = require("../02_use_cases");
function createGetUserProfile() {
    const userRepository = new repositories_1.UserRepository();
    return new _02_use_cases_1.GetUserProfile(userRepository);
}
