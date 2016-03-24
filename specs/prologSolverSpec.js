"use strict";
var prologAST_1 = require('../src/prologAST');
var prologSolver_1 = require('../src/prologSolver');
var prologParser_1 = require('../src/prologParser');
describe("prolog solver", function () {
    var maxIterations = prologSolver_1.default.options.maxIterations, tailRecursion = prologSolver_1.default.options.experimental.tailRecursion;
    beforeEach(function () {
        prologSolver_1.default.options.maxIterations = 500000;
        prologSolver_1.default.options.experimental.tailRecursion = true;
    });
    afterEach(function () {
        prologSolver_1.default.options.maxIterations = maxIterations;
        prologSolver_1.default.options.experimental.tailRecursion = tailRecursion;
    });
    it("solves simple fact", function () {
        var db = prologParser_1.default.parse("male(bob).");
        var query = prologParser_1.default.parseQuery("male(bob).");
        var result = prologSolver_1.default.query(db, query);
        expect(result.next()).toBe(true);
    });
    it("doesn't throw on missing rule", function () {
        var db = prologParser_1.default.parse("male(bob).");
        var query = prologParser_1.default.parseQuery("female(bob).");
        var result = prologSolver_1.default.query(db, query);
        expect(result.next()).toBe(false);
    });
    it("solves simple fact and returns values", function () {
        var db = prologParser_1.default.parse("male(bob). male(jacob).");
        var query = prologParser_1.default.parseQuery("male(X).");
        var result = prologSolver_1.default.query(db, query);
        expect(result.next()).toBe(true);
        expect(result.current.X).toBe("bob");
        expect(result.next()).toBe(true);
        expect(result.current.X).toBe("jacob");
        expect(result.next()).toBe(false);
    });
    it("doesn't unify _ with itself", function () {
        var db = prologParser_1.default.parse("fact(x,x,1). fact(x,y,2)."), query = prologParser_1.default.parseQuery("fact(_,_,X)."), result = prologSolver_1.default.query(db, query);
        expect(result.next()).toBeTruthy();
        expect("_" in result.current).toBeFalsy();
        expect(result.current.X).toBe(1);
        expect(result.next()).toBeTruthy();
        expect(result.current.X).toBe(2);
        expect(result.next()).toBe(false);
    });
    it("unifies normal variable with itself", function () {
        var db = prologParser_1.default.parse("u(X,X). r(X,Y):-u(X,Y). "), query = prologParser_1.default.parseQuery("r(a,a)."), result = prologSolver_1.default.query(db, query);
        expect(result.next()).toBeTruthy();
    });
    it("can produce cartesian product", function () {
        var db = prologParser_1.default.parse("fact(a). fact(b). decart(X,Y):-fact(X),fact(Y).");
        var query = prologParser_1.default.parseQuery("decart(Fact1,Fact2).");
        var result = prologSolver_1.default.query(db, query);
        expect(result.next()).toBe(true);
        expect(result.current.Fact1).toBe("a");
        expect(result.current.Fact2).toBe("a");
        expect(result.next()).toBe(true);
        expect(result.current.Fact1).toBe("a");
        expect(result.current.Fact2).toBe("b");
        expect(result.next()).toBe(true);
        expect(result.current.Fact1).toBe("b");
        expect(result.current.Fact2).toBe("a");
        expect(result.next()).toBe(true);
        expect(result.current.Fact1).toBe("b");
        expect(result.current.Fact2).toBe("b");
        expect(result.next()).toBe(false);
    });
    it("correctly works with lists", function () {
        var db = prologParser_1.default.parse("member(X,[X|R]). member(X, [Y | R]) :- member(X, R)."), query, out = {}, result, list = prologAST_1.default.Atom.Nil, depth = 200;
        // member(x,[l0 ... ln]).
        for (var i = depth; i > 0; i--) {
            list = new prologAST_1.default.Term("cons", [new prologAST_1.default.Atom("l" + i), list]);
        }
        query = new prologAST_1.default.Partlist([new prologAST_1.default.Term("member", [new prologAST_1.default.Atom("l" + depth), list])]);
        result = prologSolver_1.default.query(db, query);
        expect(result.next()).toBeTruthy();
        expect(result.next()).toBeFalsy();
    });
    it("produces list cartesian", function () {
        var db = prologParser_1.default.parse("member(X,[X|R]). member(X, [Y | R]) :- member(X, R)."), query = prologParser_1.default.parseQuery("member(X,[a,b,c]),member(Y,[1,2,3])."), result = prologSolver_1.default.query(db, query), X = [], Y = [];
        while (result.next()) {
            X.push(result.current.X);
            Y.push(result.current.Y);
        }
        expect(X).toEqual(["a", "a", "a", "b", "b", "b", "c", "c", "c"]);
        expect(Y).toEqual([1, 2, 3, 1, 2, 3, 1, 2, 3]);
    });
    it("can append lists", function () {
        var db = prologParser_1.default.parse('append([], List, List). append([Head | Tail], List2, [Head | Result]):-append(Tail, List2, Result).'), query = prologParser_1.default.parseQuery('append([b,c,d],[one,two,three,four],L).'), result = prologSolver_1.default.query(db, query);
        expect(result.next()).toBeTruthy();
        expect(result.current.L).toEqual(['b', 'c', 'd', 'one', 'two', 'three', 'four']);
        expect(result.next()).toBeFalsy();
    });
    it("can copy lists", function () {
        var db = prologParser_1.default.parse("cop([],[]). cop([X|T1],[X|T2]):-cop(T1,T2)."), query = prologParser_1.default.parseQuery('cop([1,2,3],X).'), result = prologSolver_1.default.query(db, query);
        expect(result.next()).toBeTruthy();
        expect(result.current.X).toEqual([1, 2, 3]);
        expect(result.next()).toBeFalsy();
    });
    it("can filter lists", function () {
        var db = prologParser_1.default.parse("fil(_, [],[]). fil(X, [X|T1], T2):-fil(X, T1,T2). fil(X, [Y|T1], [Y|T2]):-fil(X,T1,T2).");
        var query = prologParser_1.default.parseQuery('fil(8, [1,2,8,3],X).');
        var result = prologSolver_1.default.query(db, query);
        expect(result.next()).toBeTruthy();
        expect(result.current.X).toEqual([1, 2, 3]);
        expect(result.next()).toBeFalsy();
    });
    it("returns correct number of results (cut issue)", function () {
        var db = prologParser_1.default.parse('fnd(Name, [Name|T1], Name).' +
            'fnd(Name, [R | T1], T2) :- fnd(Name, T1, T2).' +
            'limit([],_,[]). ' +
            'limit([H|T],GEnv,[X | Env]):-fnd(H, GEnv, X), !, limit(T,GEnv,Env).' +
            'limit([H|T],GEnv,Env):-limit(T,GEnv,Env).');
        var query = prologParser_1.default.parseQuery('limit(["i", "document"], ["i", "document", "q"], R).');
        var result = prologSolver_1.default.query(db, query);
        expect(result.next()).toBeTruthy("solves");
        expect(result.current.R).toEqual(['"i"', '"document"']);
        expect(result.next()).toBeFalsy("only one solution");
    });
    describe("solves examples", function () {
        // warning: 5s to run
        it("eight queens problem (first solution only)", function () {
            var db = prologParser_1.default.parse("solution(Ylist):- sol(Ylist, [1, 2, 3, 4, 5, 6, 7, 8], [1, 2, 3, 4, 5, 6, 7, 8], [-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7], [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])." +
                "sol([], [], [], _, _)." +
                "sol([Y | Ylist], [X | Dx1], Dy, Du, Dv):- del(Y, Dy, Dy1), is(U, -(X, Y)), del(U, Du, Du1), is(V, +(X, Y)), del(V, Dv, Dv1), sol(Ylist, Dx1, Dy1, Du1, Dv1)." +
                "del(Item, [Item | List], List)." +
                "del(Item, [First | List], [First | List1]):- del(Item, List, List1)."), query = prologParser_1.default.parseQuery("solution(X)."), result = prologSolver_1.default.query(db, query);
            expect(result.next()).toBeTruthy();
            expect(result.current.X).toEqual([1, 5, 8, 6, 3, 7, 2, 4]);
            // 2nd and 3rd (commented because slow)
            //expect(result.next()).toBeTruthy();        
            //expect(result.current.X).toEqual([1, 6, 8, 3, 7, 4, 2, 5]);
            //expect(result.next()).toBeTruthy();        
            //expect(result.current.X).toEqual([1, 7, 4, 6, 8, 2, 5, 3]);         
        });
        it("color map example from prolog tutorial", function () {
            var db = prologParser_1.default.parse("adjacent(1, 2).adjacent(2, 1).  adjacent(1, 3).adjacent(3, 1)." +
                "adjacent(1, 4).adjacent(4, 1).  adjacent(1, 5).adjacent(5, 1)." +
                "adjacent(2, 3).adjacent(3, 2).  adjacent(2, 4).adjacent(4, 2)." +
                "adjacent(3, 4).adjacent(4, 3).  adjacent(4, 5).adjacent(5, 4). " +
                "color(1, red, a).color(1, red, b).  color(2, blue, a).color(2, blue, b)." +
                "color(3, green, a).color(3, green, b).  color(4, yellow, a).color(4, blue, b)." +
                "color(5, blue, a).color(5, green, b). " +
                "conflict(Coloring):- " +
                "adjacent(X, Y), color(X, Color, Coloring), color(Y, Color, Coloring)." +
                "conflict(R1, R2, Coloring) :-" +
                "adjacent(R1, R2)," +
                "color(R1,Color,Coloring)," +
                "color(R2,Color,Coloring)."), query = prologParser_1.default.parseQuery("conflict(R1,R2,b),color(R1,C,b)."), result;
            result = prologSolver_1.default.query(db, query);
            expect(result.next()).toBe(true);
            expect(result.current.R1).toBe(2);
            expect(result.current.R2).toBe(4);
            expect(result.current.C).toBe("blue");
            expect(result.next()).toBe(true);
            expect(result.current.R1).toBe(4);
            expect(result.current.R2).toBe(2);
            expect(result.current.C).toBe("blue");
            expect(result.next()).toBe(false);
        });
    });
    describe("builtin", function () {
        describe("!/0", function () {
            it("correctly cuts", function () {
                var db = prologParser_1.default.parse("fact(a).fact(b).firstFact(X):-fact(X),!.");
                var query = prologParser_1.default.parseQuery("firstFact(Fact).");
                var result = prologSolver_1.default.query(db, query);
                expect(result.next()).toBe(true);
                expect(result.current.Fact).toBe("a");
                expect(result.next()).toBe(false);
            });
            it("works with classic not implementation", function () {
                var db = prologParser_1.default.parse("not(Term):-call(Term),!,fail. not(Term). fact(a). fact(b). secret(b). fact(c). open(X):-fact(X),not(secret(X)).");
                var query = prologParser_1.default.parseQuery("open(X).");
                var result = prologSolver_1.default.query(db, query);
                expect(result.next()).toBe(true);
                expect(result.current.X).toBe("a");
                expect(result.next()).toBe(true);
                expect(result.current.X).toBe("c");
                expect(result.next()).toBe(false);
            });
            it("works with not unify", function () {
                var db = prologParser_1.default.parse("not(Term):-call(Term),!,fail. not(Term). r(X,Y):-not(=(X,Y)). "), query = prologParser_1.default.parseQuery("r(a,b)."), result = prologSolver_1.default.query(db, query);
                expect(result.next()).toBeTruthy();
            });
        });
        describe("=/2", function () {
            it("=/2 unifies atoms", function () {
                var db = [], query = prologParser_1.default.parseQuery("=(5,5),=(a,a)."), result = prologSolver_1.default.query(db, query);
                expect(result.next()).toBeTruthy();
            });
            it("=/2 unifies structures", function () {
                var db = [], query = prologParser_1.default.parseQuery("=(tax(income,13.0), tax(income,13.0))."), result = prologSolver_1.default.query(db, query);
                expect(result.next()).toBeTruthy();
            });
            it("=/2 unifies atom with variable", function () {
                var db = [], out = {}, query = prologParser_1.default.parseQuery("=(X,5)."), result = prologSolver_1.default.query(db, query, out);
                expect(result.next()).toBeTruthy();
                expect(result.current.X).toBe(5);
            });
        });
        describe("findall/3", function () {
            it("returns all results", function () {
                var db = prologParser_1.default.parse("city(moscow,russia).city(vladivostok,russia).city(boston,usa)."), query = prologParser_1.default.parseQuery("findall(C,city(C,_),Cities)."), result = prologSolver_1.default.query(db, query);
                expect(result.next()).toBe(true);
                expect(result.current.Cities).toEqual(["moscow", "vladivostok", "boston"]);
                expect(result.next()).toBe(false);
            });
            it("sees parent context", function () {
                var db = prologParser_1.default.parse("city(moscow,russia).city(vladivostok,russia).city(boston,usa)."), query = prologParser_1.default.parseQuery("=(R,usa),findall(C,city(C,R),Cities)."), result = prologSolver_1.default.query(db, query);
                expect(result.next()).toBe(true);
                expect(result.current.Cities).toEqual(["boston"]);
                expect(result.next()).toBe(false);
            });
            it("works if first argument is not a variable and grounded", function () {
                var db = prologParser_1.default.parse("city(moscow,russia).city(vladivostok,russia).city(boston,usa)."), query = prologParser_1.default.parseQuery("findall(10,city(C,R),Cities)."), result = prologSolver_1.default.query(db, query);
                expect(result.next()).toBe(true);
                expect(result.current.Cities).toEqual([10, 10, 10]);
                expect(result.next()).toBe(false);
            });
            it("works if first argument is a partial term", function () {
                var db = prologParser_1.default.parse("city(moscow,russia).city(vladivostok,russia).city(boston,usa)."), query = prologParser_1.default.parseQuery("findall(term(C),city(C,R),Cities)."), result = prologSolver_1.default.query(db, query);
                expect(result.next()).toBe(true);
                expect(result.current.Cities).toEqual(['term(moscow)', 'term(vladivostok)', 'term(boston)']);
                expect(result.next()).toBe(false);
            });
            it("works if last argument is not a variable and should unify", function () {
                var db = prologParser_1.default.parse("city(moscow,russia).city(vladivostok,russia).city(boston,usa)."), query = prologParser_1.default.parseQuery("findall(C,city(C,R),[moscow, vladivostok, boston])."), result = prologSolver_1.default.query(db, query);
                expect(result.next()).toBe(true);
            });
            it("works if last argument is not a variable and shouldn't unify", function () {
                var db = prologParser_1.default.parse("city(moscow,russia).city(vladivostok,russia).city(boston,usa)."), query = prologParser_1.default.parseQuery("findall(C,city(C,R),[brussels])."), result = prologSolver_1.default.query(db, query);
                expect(result.next()).toBe(false);
            });
            it("returns empty list if goal fails", function () {
                var db = prologParser_1.default.parse("city(moscow,russia).city(vladivostok,russia).city(boston,usa)."), out = {}, query = prologParser_1.default.parseQuery("findall(C,city(C,canada),Cities)."), result = prologSolver_1.default.query(db, query, out);
                expect(result.next()).toBe(true);
                expect(result.current.Cities).toEqual([]);
                expect(result.next()).toBe(false);
            });
        });
        describe("is/2", function () {
            it("handles four arithmetic operations", function () {
                var db = [], out = {}, query = prologParser_1.default.parseQuery("is(X, /(*(+(3,-(8,3)),2),4))."), result = prologSolver_1.default.query(db, query, out);
                expect(result.next()).toBe(true);
                expect(result.current.X).toBe(4);
                expect(result.next()).toBe(false);
            });
        });
    });
});
