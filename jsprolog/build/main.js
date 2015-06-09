var AST = require('./prologAST.js');
var Parser = require('./prologParser.js');
var Solver = require('./prologSolver.js');




Solver.options.enableTrace = false;

var db = Parser.parse("member(X,[X|R]). member(X, [Y | R]) :- member(X, R)."),            
    query,
    out = {},
    result,
    list = new AST.Atom("nil");

//"member(x,[l0 ... ln])."
for (var i = 10000; i > 0; i--) {
    list = new AST.Term("cons", [new AST.Atom("l" + i), list]);
}
query = new AST.Body([new AST.Term("member", [new AST.Atom("l10000"), list])]);
result = Solver.query(db, query, out);
//console.log(out);
