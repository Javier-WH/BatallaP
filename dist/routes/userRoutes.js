"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const userController_1 = require("../controllers/userController.js");
const router = (0, express_1.Router)();
router.get('/', userController_1.searchUsers);
// /search/stats must be registered before /:id to avoid the param route capturing "search".
router.get('/search/stats', userController_1.searchUsersStats);
router.get('/:id', userController_1.getUserDetails);
router.put('/:id', userController_1.updateUser);
router.delete('/:id/account', userController_1.deleteUserAccount);
exports.default = router;
