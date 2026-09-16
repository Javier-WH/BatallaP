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
const supertest_1 = __importDefault(require("supertest"));
const app_1 = __importDefault(require("../../app.js"));
const testData_1 = require("../helpers/testData");
const index_1 = require("../../models/index.js");
describe('User Endpoints', () => {
    let agent;
    beforeEach(() => __awaiter(void 0, void 0, void 0, function* () {
        agent = supertest_1.default.agent(app_1.default);
        const { person } = yield (0, testData_1.createTestUser)({ username: 'admin' });
        const role = yield (0, testData_1.createTestRole)('Master');
        yield index_1.PersonRole.create({ personId: person.id, roleId: role.id });
        yield agent
            .post('/api/auth/login')
            .send({ username: 'admin', password: 'password123' });
    }));
    describe('GET /api/users', () => {
        it('should return all users', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, testData_1.createTestUser)({ username: 'user1' });
            yield (0, testData_1.createTestUser)({ username: 'user2' });
            const response = yield agent
                .get('/api/users')
                .expect(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThanOrEqual(3);
        }));
        it('should return users with their roles', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person } = yield (0, testData_1.createTestUser)({ username: 'teacher' });
            const role = yield (0, testData_1.createTestRole)('Profesor');
            yield index_1.PersonRole.create({
                personId: person.id,
                roleId: role.id
            });
            const response = yield agent
                .get('/api/users')
                .expect(200);
            const teacher = response.body.find((u) => u.username === 'teacher');
            expect(teacher).toBeDefined();
            expect(teacher.roles).toBeDefined();
            expect(teacher.roles.length).toBe(1);
            expect(teacher.roles[0].name).toBe('Profesor');
        }));
        it('should search users by name via ?q=', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, testData_1.createTestUser)({
                username: 'john',
                firstName: 'John',
                lastName: 'Doe'
            });
            const response = yield agent
                .get('/api/users?q=John')
                .expect(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            // Person.beforeCreate uppercases names
            expect(response.body[0].firstName).toBe('JOHN');
        }));
        it('should search users by document via ?q=', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, testData_1.createTestUser)({
                username: 'user1',
                document: '12345678'
            });
            const response = yield agent
                .get('/api/users?q=12345678')
                .expect(200);
            expect(Array.isArray(response.body)).toBe(true);
            expect(response.body.length).toBeGreaterThan(0);
            expect(response.body[0].document).toBe('12345678');
        }));
    });
    describe('GET /api/users/:id', () => {
        it('should return user by id (person with nested user)', () => __awaiter(void 0, void 0, void 0, function* () {
            const { user, person } = yield (0, testData_1.createTestUser)({ username: 'testuser' });
            const response = yield agent
                .get(`/api/users/${person.id}`)
                .expect(200);
            expect(response.body.id).toBe(person.id);
            // getUserDetails returns the full Person with nested user
            expect(response.body.user).toBeDefined();
            expect(response.body.user.username).toBe('testuser');
        }));
        it('should return 404 for non-existent user', () => __awaiter(void 0, void 0, void 0, function* () {
            yield agent
                .get('/api/users/99999')
                .expect(404);
        }));
    });
    describe('PUT /api/users/:id', () => {
        it('should update user information', () => __awaiter(void 0, void 0, void 0, function* () {
            const { person } = yield (0, testData_1.createTestUser)({
                username: 'updateme',
                firstName: 'Old',
                lastName: 'Name'
            });
            const response = yield agent
                .put(`/api/users/${person.id}`)
                .send({
                firstName: 'New',
                lastName: 'Name'
            })
                .expect(200);
            // updateUser returns { message: '...' }
            expect(response.body.message).toMatch(/updated|actualizado/i);
        }));
    });
    describe('DELETE /api/users/:id/account', () => {
        it('should delete user account', () => __awaiter(void 0, void 0, void 0, function* () {
            const { user, person } = yield (0, testData_1.createTestUser)({ username: 'deleteme' });
            yield agent
                .delete(`/api/users/${person.id}/account`)
                .expect(200);
            const deleted = yield index_1.User.findByPk(user.id);
            expect(deleted).toBeNull();
        }));
    });
});
