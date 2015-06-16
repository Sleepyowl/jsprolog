# jsprolog

### What is it?

It's a simple Prolog interpreter written with javascript (ECMAScript5). I've adapted it from [Jan's javascript Prolog interpreter](http://ioctl.org/logic/prolog-latest).

### What it can do
It can solve simple stuff, but its functionality is severely limited: it has no support for operators and only 3 builtins: fail/0, call/1 and cut/0.

### How to use

Please note that the project is far from stabilization and interface will surely change in some point in future.

#### node.js: 

    npm i jsprolog
#### requirejs

    grunt
Then grab jsprolog.js from the project root.

#### in code:


    var Parser = require('./prologParser');
    var Solver = require('./prologSolver');
    var db = Parser.parse("member(X,[X|R]). member(X, [Y | R]) :- member(X, R)."),
        query = Parser.parseQuery("member(X,[a,b,c]),member(Y,[1,2,3])."),
        out = {},
        result = Solver.query(db, query, out);


Also refer to specs/prologSolverSpec.js for usage examples.
