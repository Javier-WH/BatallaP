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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.register = exports.me = exports.logout = exports.login = void 0;
const sequelize_1 = require("sequelize");
const database_1 = __importDefault(require("../config/database.js"));
const index_1 = require("../models/index.js"); // Import from index to ensure associations
const login = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    // Prevent browser from caching the login response (Opera/Chrome cache POST 401s)
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    try {
        const { username, password } = req.body;
        // Fetch user with associated Person and Roles
        // Use case-insensitive username match so "javier" matches "Javier".
        // SQLite uses LIKE (case-insensitive for ASCII by default), MySQL uses LOWER() for
        // case-insensitive comparison.
        const isSqlite = database_1.default.getDialect() === 'sqlite';
        const user = yield index_1.User.findOne({
            where: isSqlite
                ? { username: { [sequelize_1.Op.like]: username } }
                : database_1.default.where(database_1.default.fn('LOWER', database_1.default.col('username')), username.toLowerCase()),
            include: [
                {
                    model: index_1.Person,
                    as: 'person',
                    include: [
                        {
                            model: index_1.Role,
                            as: 'roles',
                            through: {
                                attributes: [] // Don't include the junction table attributes in the result
                            }
                        }
                    ]
                }
            ]
        });
        if (!user) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        const isValid = yield user.validatePassword(password);
        if (!isValid) {
            res.status(401).json({ message: 'Invalid credentials' });
            return;
        }
        const person = user.person; // Type casting might be needed until types are fully generated/inferred
        const roles = person ? person.roles : [];
        // Save session (adapt to new structure)
        req.session.user = {
            id: user.id,
            username: user.username,
            personId: person === null || person === void 0 ? void 0 : person.id,
            roles: roles.map((r) => r.name), // Accessing role name
            firstName: person === null || person === void 0 ? void 0 : person.firstName,
            lastName: person === null || person === void 0 ? void 0 : person.lastName
        };
        res.json({ message: 'Login successful', user: req.session.user });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Server error check console' });
    }
});
exports.login = login;
const logout = (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({ message: 'Could not log out' });
        }
        res.clearCookie('connect.sid');
        res.json({ message: 'Logout successful' });
    });
};
exports.logout = logout;
const me = (req, res) => {
    const user = req.session.user;
    if (user) {
        res.json({ authenticated: true, user });
    }
    else {
        res.status(401).json({ authenticated: false });
    }
};
exports.me = me;
// Updated register to handle new structure
const register = (req, res) => __awaiter(void 0, void 0, void 0, function* () {
    try {
        const { username, password, firstName, lastName, documentType, document, gender, birthdate, roleName, roles, 
        // Contact Info
        phone1, phone2, email, address, whatsapp } = req.body;
        // 1. Create User
        const user = yield index_1.User.create({ username, password });
        // 2. Create Person linked to User
        const person = yield index_1.Person.create({
            firstName,
            lastName,
            documentType,
            document,
            gender,
            birthdate,
            userId: user.id
        });
        // 3. Create Contact linked to Person
        yield index_1.Contact.create({
            phone1,
            phone2,
            email,
            address,
            whatsapp,
            personId: person.id
        });
        // 4. Assign Roles
        const rolesToAssign = roles || (roleName ? [roleName] : []);
        for (const name of rolesToAssign) {
            let role = yield index_1.Role.findOne({ where: { name } });
            if (!role) {
                // Create if not exists (optional, or throw error)
                role = yield index_1.Role.create({ name });
            }
            if (role) {
                yield index_1.PersonRole.create({
                    personId: person.id,
                    roleId: role.id
                });
            }
        }
        res.status(201).json({ message: 'User registered successfully', user, person });
    }
    catch (error) {
        console.error(error);
        res.status(400).json({ error: error });
    }
});
exports.register = register;
