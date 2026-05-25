let counter = 0;
function v4() { counter++; return `mock-uuid-${counter}-${Date.now()}`; }
function v1() { counter++; return `mock-uuid-v1-${counter}`; }
module.exports = { v4, v1, default: { v4, v1 } };