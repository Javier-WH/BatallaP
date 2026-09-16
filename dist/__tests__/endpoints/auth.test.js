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
describe('Auth Endpoints', () => {
    let agent;
    describe('POST /api/auth/login', () => {
        it('should login successfully with valid credentials', () => __awaiter(void 0, void 0, void 0, function* () {
            agent = supertest_1.default.agent(app_1.default);
            yield (0, testData_1.createTestUser)({
                username: 'testuser',
                password: 'password123'
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .post('/api/auth/login')
                .send({
                username: 'testuser',
                password: 'password123'
            })
                .expect(200);
            expect(response.body.message).toMatch(/login|exitoso/i);
            expect(response.body).toHaveProperty('user');
            expect(response.body.user.username).toBe('testuser');
        }));
        it('should fail login with invalid password', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, testData_1.createTestUser)({
                username: 'testuser',
                password: 'password123'
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .post('/api/auth/login')
                .send({
                username: 'testuser',
                password: 'wrongpassword'
            })
                .expect(401);
            expect(response.body.message).toMatch(/invalid|inválidas/i);
        }));
        it('should fail login with non-existent user', () => __awaiter(void 0, void 0, void 0, function* () {
            const response = yield (0, supertest_1.default)(app_1.default)
                .post('/api/auth/login')
                .send({
                username: 'nonexistent',
                password: 'password123'
            })
                .expect(401);
            expect(response.body.message).toMatch(/invalid|inválidas/i);
        }));
        it('should return user with roles', () => __awaiter(void 0, void 0, void 0, function* () {
            const { user, person } = yield (0, testData_1.createTestUser)({ username: 'admin' });
            const role = yield (0, testData_1.createTestRole)('Master');
            yield index_1.PersonRole.create({
                personId: person.id,
                roleId: role.id
            });
            const response = yield (0, supertest_1.default)(app_1.default)
                .post('/api/auth/login')
                .send({
                username: 'admin',
                password: 'password123'
            })
                .expect(200);
            expect(response.body.user.roles).toBeDefined();
            expect(response.body.user.roles.length).toBe(1);
            expect(response.body.user.roles[0]).toBe('Master');
        }));
    });
    describe('POST /api/auth/logout', () => {
        it('should logout successfully', () => __awaiter(void 0, void 0, void 0, function* () {
            const agent = supertest_1.default.agent(app_1.default);
            yield (0, testData_1.createTestUser)({ username: 'testuser' });
            yield agent
                .post('/api/auth/login')
                .send({ username: 'testuser', password: 'password123' });
            const response = yield agent
                .post('/api/auth/logout')
                .expect(200);
            expect(response.body.message).toMatch(/logout|exitoso/i);
        }));
    });
    describe('GET /api/auth/me', () => {
        it('should return current user when authenticated', () => __awaiter(void 0, void 0, void 0, function* () {
            const agent = supertest_1.default.agent(app_1.default);
            yield (0, testData_1.createTestUser)({ username: 'testuser' });
            yield agent
                .post('/api/auth/login')
                .send({ username: 'testuser', password: 'password123' });
            const response = yield agent
                .get('/api/auth/me')
                .expect(200);
            expect(response.body.authenticated).toBe(true);
            expect(response.body.user.username).toBe('testuser');
        }));
        it('should return 401 when not authenticated', () => __awaiter(void 0, void 0, void 0, function* () {
            yield (0, supertest_1.default)(app_1.default)
                .get('/api/auth/me')
                .expect(401);
        }));
    });
});
