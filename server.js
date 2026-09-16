// Production entry point for Netcup / Node hosting
process.env.NODE_ENV = process.env.NODE_ENV || 'production';
require('./dist/server.js');
