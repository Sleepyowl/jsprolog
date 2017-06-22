# jsprolog

### What is it?

It's a simple Prolog interpreter written with TypeScript. 
I've adapted it from [Jan's javascript Prolog interpreter](http://ioctl.org/logic/prolog-latest) because I needed a convenient automated theorem proving engine in JavaScript.

### What it can do
It can solve simple stuff, for instance N-queen problem. It supports tail recursion.

### Limitations
- Parser doesn't support operators. Use function call notation: `=(X, Y), is(Z, +(1, X))`.
- It has a **very** limited set of built-in predicates.
- Current implementation is slow. Finding all solutions of N-queen problem takes about 25 seconds on Intel i5-3570.

### Preliminary string support 
Jsprolog features rudimental support for strings:

- Double quoted text is parsed as a list of character codes.
- Use `\"` to mask double quote. 
- No built-in predicates to work with strings.
- Will be replaced with string type in future.

### How to use 
```
npm i jsprolog
```

*Please note that the project is far from stabilization and the API will surely change at some point in the future.*

```javascript
var Prolog = require('jsprolog');
var db = Prolog.Parser.parse("member(X,[X|R]). member(X, [Y | R]) :- member(X, R)."),
    query = Prolog.Parser.parseQuery("member(X,[a,b,c]),member(Y,[1,2,3])."),    
    iter = Prolog.Solver.query(db, query);
while(iter.next()){
    console.log("X = ", iter.current.X, ", Y = ", iter.current.Y);
}
```

Also refer to specs/prologSolverSpec.js for usage examples.

### Supported built-in predicates

Predicate | Notes
----------| -------------------------------------------------
=/2       | Doesn't support cyclic terms.
!/0       | 
fail/0    | 
call/1    | 
findall/3 | 
is/2      | Supports only +,-,/,*. Silently fails on error.