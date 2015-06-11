var AST = require('./prologAST.js');
var Parser = require('./prologParser.js');
var Solver = require('./prologSolver.js');
exports.AST = AST;
exports.Parser = Parser;
exports.Solver = Solver;


var db = Parser.parse("male(bob). male(jacob).");
var query = Parser.parseQuery("male(X).");
var out = {};
var result = Solver.query(db, query, out);

