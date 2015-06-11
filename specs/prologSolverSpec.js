var AST = require('../src/prologAST.js');
var Solver = require("../src/prologSolver.js");
// TODO: remove Parser dependency ?
var Parser = require('../src/prologParser.js');

describe("prolog solver", function () {
    it("solves simple fact", function () {
        var db = Parser.parse("male(bob).");
        var query = Parser.parseQuery("male(bob).");
        var result = Solver.query(db, query);
        expect(result).toBe(true);
    });
    
    it("doesn't throw on missing rule", function () {
        var db = Parser.parse("male(bob).");
        var query = Parser.parseQuery("female(bob).");
        var result = Solver.query(db, query);
        expect(result).toBe(false);
    });
    
    it("solves simple fact and returns values", function () {
        var db = Parser.parse("male(bob). male(jacob).");
        var query = Parser.parseQuery("male(X).");
        var out = {};
        var result = Solver.query(db, query, out);
        expect(result).toBe(true);
        expect(out.X instanceof Array).toBe(true);
        expect(out.X.length).toBe(2);
        expect(out.X[0]).toBe("bob");
        expect(out.X[1]).toBe("jacob");
    });
    
    it("doesn't unify _ with itself", function () {
        var db = Parser.parse("fact(x,x,1). fact(x,y,2)."),
            query = Parser.parseQuery("fact(_,_,X)."),
            out = {},
            result = Solver.query(db, query, out);
        
        expect(result).toBeTruthy();
        expect("_" in out).toBeFalsy();
        expect(out.X.length).toBe(2);
    });
    
    it("can produce cartesian product", function () {
        var db = Parser.parse("fact(a). fact(b). decart(X,Y):-fact(X),fact(Y).");
        var query = Parser.parseQuery("decart(Fact1,Fact2).");
        var out = {};
        var result = Solver.query(db, query, out);
        expect(result).toBe(true);
        expect(out.Fact1.length).toBe(4);
        expect(out.Fact1[0]).toBe("a"); expect(out.Fact2[0]).toBe("a");
        expect(out.Fact1[1]).toBe("a"); expect(out.Fact2[1]).toBe("b");
        expect(out.Fact1[2]).toBe("b"); expect(out.Fact2[2]).toBe("a");
        expect(out.Fact1[3]).toBe("b"); expect(out.Fact2[3]).toBe("b");
    });
    
    it("correctly cuts", function () {
        var db = Parser.parse("fact(a).fact(b).firstFact(X):-fact(X),!.");
        var query = Parser.parseQuery("firstFact(Fact).");
        var out = {};
        var result = Solver.query(db, query, out);
        expect(result).toBe(true);        
        expect(out.Fact.length).toBe(1);
    });    
    
    it("works with classic not implementation", function () {
        
        var db = Parser.parse("not(Term):-call(Term),!,fail. not(Term). fact(a). fact(b). secret(b). fact(c). open(X):-fact(X),not(secret(X)).");
        var query = Parser.parseQuery("open(X).");
        var out = {};
        var result = Solver.query(db, query, out);
        expect(result).toBe(true);
        expect(out.X instanceof Array).toBe(true);
        expect(out.X.length).toBe(2);
        expect(out.X[0]).toBe("a");
        expect(out.X[1]).toBe("c");        
    });   
        
    it("correctly works with lists", function () {
        var db = Parser.parse("member(X,[X|R]). member(X, [Y | R]) :- member(X, R)."),            
            query,
            out = {},
            result,
            list = new AST.Atom("nil"),
            depth = 200;
        
        // member(x,[l0 ... ln]).
        for (var i = depth; i > 0; i--) {
            list = new AST.Term("cons", [new AST.Atom("l"+i), list]);
        }
        query = new AST.Body([new AST.Term("member",[new AST.Atom("l" + depth), list])]);

        result = Solver.query(db, query, out);        
        expect(result).toBeTruthy();
    });
    
    it("produces list cartesian", function () { 
        var db = Parser.parse("member(X,[X|R]). member(X, [Y | R]) :- member(X, R)."),            
            query = Parser.parseQuery("member(X,[a,b,c]),member(Y,[1,2,3])."),
            out = {},
            result = Solver.query(db, query, out);

        expect(result).toBeTruthy();                
        expect(out.X).toEqual(["a", "a", "a", "b", "b", "b", "c", "c", "c"]);
        expect(out.Y).toEqual(["1", "2", "3", "1", "2", "3", "1", "2", "3"]);
    });
   
    
    it("correctly solves color map example from prolog tutorial", function () {
        var db = Parser.parse(
            "adjacent(1, 2).adjacent(2, 1).  adjacent(1, 3).adjacent(3, 1)." +
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
                "color(R2,Color,Coloring)."),             
            query = Parser.parseQuery("conflict(R1,R2,b),color(R1,C,b)."),
            out = {},
            result;
        
        result = Solver.query(db, query, out);
        
        expect(result).toBe(true);
        expect(out.R1[0]).toBe("2");
        expect(out.R2[0]).toBe("4");
        expect(out.C[0]).toBe("blue");
        expect(out.R1[1]).toBe("4");
        expect(out.R2[1]).toBe("2");
        expect(out.C[1]).toBe("blue");
    });

});