"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCheckAuthentication = createCheckAuthentication;
const CheckAuthentication_1 = require("../02_use_cases/CheckAuthentication");
function createCheckAuthentication() {
    return new CheckAuthentication_1.CheckAuthentication();
}
