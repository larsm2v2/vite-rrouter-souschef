"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createLogoutUser = createLogoutUser;
const LogoutUser_1 = require("../02_use_cases/LogoutUser");
function createLogoutUser() {
    return new LogoutUser_1.LogoutUser();
}
