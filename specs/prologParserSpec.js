var prologAST = require('../src/prologAST.js');
var prologParser = require('../src/prologParser.js');
describe("prolog parser", function () {
    it("throws on syntax errors", function () {
        expect(function () { prologParser.parse("rule(X) :- :- check(X)."); }).toThrow("Syntax error: unexpected token :-");
        expect(function () { prologParser.parse("x."); }).toThrow("Syntax error: unexpected token .");
        expect(function () { prologParser.parse("fact([a,b,c"); }).toThrow("Syntax error: unexpected end of file");
    });

    it("can parse simple term", function () {
        var db = "adjacent(x,y).";
        var rules = prologParser.parse(db);
        expect(rules).toBeDefined();
        expect(rules.length).toBe(1);
        expect(rules[0] instanceof prologAST.Rule).toBeTruthy();
        expect(rules[0].head instanceof prologAST.Term).toBeTruthy();
        expect(rules[0].head.name).toBe("adjacent");
        expect(rules[0].head.partlist instanceof prologAST.Partlist).toBeTruthy();
        expect(rules[0].head.partlist.list instanceof Array).toBeTruthy();
        expect(rules[0].head.partlist.list.length).toBe(2);
        expect(rules[0].head.partlist.list[0] instanceof prologAST.Atom).toBeTruthy();
        expect(rules[0].head.partlist.list[1] instanceof prologAST.Atom).toBeTruthy();
        expect(rules[0].head.partlist.list[0].name).toBe("x");
        expect(rules[0].head.partlist.list[1].name).toBe("y");
    });
    
    it("parses integer numbers", function () {
        var db = "val(10).";
        var rules = prologParser.parse(db);
        expect(rules).toBeDefined();
        expect(rules.length).toBe(1);
        expect(rules[0] instanceof prologAST.Rule).toBeTruthy();
        expect(rules[0].head instanceof prologAST.Term).toBeTruthy();
        expect(rules[0].head.name).toBe("val");
        expect(rules[0].head.partlist instanceof prologAST.Partlist).toBeTruthy();
        expect(rules[0].head.partlist.list instanceof Array).toBeTruthy();
        expect(rules[0].head.partlist.list.length).toBe(1);
        expect(rules[0].head.partlist.list[0] instanceof prologAST.Atom).toBeTruthy();        
        expect(rules[0].head.partlist.list[0].name).toBe(10);
    });
    
    it("parses decimal numbers with fractional part", function () {
        var db = "val(3.14).";
        var rules = prologParser.parse(db);
        expect(rules).toBeDefined();
        expect(rules.length).toBe(1);
        expect(rules[0] instanceof prologAST.Rule).toBeTruthy();
        expect(rules[0].head instanceof prologAST.Term).toBeTruthy();
        expect(rules[0].head.name).toBe("val");
        expect(rules[0].head.partlist instanceof prologAST.Partlist).toBeTruthy();
        expect(rules[0].head.partlist.list instanceof Array).toBeTruthy();
        expect(rules[0].head.partlist.list.length).toBe(1);
        expect(rules[0].head.partlist.list[0] instanceof prologAST.Atom).toBeTruthy();
        expect(rules[0].head.partlist.list[0].name).toBe(3.14);
    });

    it("can parse simple rule", function () {
        var db = "parent(X,Y):-child(Y,X),organism(X),organism(Y).";
        var rules = prologParser.parse(db);

        expect(rules.length).toBe(1);
        expect(rules[0] instanceof prologAST.Rule).toBeTruthy();
                
        expect(rules[0].head instanceof prologAST.Term).toBeTruthy();
        expect(rules[0].head.name).toBe("parent");
        expect(rules[0].head.partlist instanceof prologAST.Partlist).toBeTruthy();
        expect(rules[0].head.partlist.list instanceof Array).toBeTruthy();
        expect(rules[0].head.partlist.list.length).toBe(2);
        expect(rules[0].head.partlist.list[0] instanceof prologAST.Variable).toBeTruthy();
        expect(rules[0].head.partlist.list[1] instanceof prologAST.Variable).toBeTruthy();
        expect(rules[0].head.partlist.list[0].name).toBe("X");
        expect(rules[0].head.partlist.list[1].name).toBe("Y");

        expect(rules[0].body instanceof prologAST.Partlist).toBeTruthy();
        expect(rules[0].body.list.length).toBe(3);
        expect(rules[0].body.list[0] instanceof prologAST.Term).toBeTruthy();
        expect(rules[0].body.list[1] instanceof prologAST.Term).toBeTruthy();
        expect(rules[0].body.list[2] instanceof prologAST.Term).toBeTruthy();

        expect(rules[0].body.list[0].name).toBe("child");
        expect(rules[0].body.list[0].partlist instanceof prologAST.Partlist).toBeTruthy();
        expect(rules[0].body.list[0].partlist.list.length).toBe(2);
        expect(rules[0].body.list[0].partlist.list[0] instanceof prologAST.Variable).toBeTruthy();
        expect(rules[0].body.list[0].partlist.list[1] instanceof prologAST.Variable).toBeTruthy();
        expect(rules[0].body.list[0].partlist.list[0].name).toBe("Y");
        expect(rules[0].body.list[0].partlist.list[1].name).toBe("X");
        
        expect(rules[0].body.list[1].name).toBe("organism");
        expect(rules[0].body.list[1].partlist.list[0].name).toBe("X");
        
        expect(rules[0].body.list[2].name).toBe("organism");
        expect(rules[0].body.list[2].partlist.list[0].name).toBe("Y");

    });

    it("parses several rules", function () { 
        var db = "parent(X,Y):-child(Y,X). sibling(X,Y):-child(X,Z),child(Y,Z).";
        var rules = prologParser.parse(db);
        expect(rules.length).toBe(2);
                
        expect(rules[0] instanceof prologAST.Rule).toBeTruthy();        
        expect(rules[0].head instanceof prologAST.Term).toBeTruthy();
        expect(rules[0].head.name).toBe("parent");        

        expect(rules[1] instanceof prologAST.Rule).toBeTruthy();
        expect(rules[1].head instanceof prologAST.Term).toBeTruthy();
        expect(rules[1].head.name).toBe("sibling");        
    });

    it("parses ! and fail", function () {
        var db = "not(Term):-call(Term),!,fail. not(Term).";
        var rules = prologParser.parse(db);
        expect(rules.length).toBe(2);
        expect(rules[0].body.list[1].name).toBe("cut");
        expect(rules[0].body.list[1].partlist.list.length).toBe(0);
        expect(rules[0].body.list[2].name).toBe("fail");
        expect(rules[0].body.list[2].partlist.list.length).toBe(0);
    });

    it("handles new lines and tabs properly", function () {
        var db = "parent(X,Y):-\nchild(Y,X).\nsibling(X,Y)\n:-\n\tchild(X,Z),child(Y,Z).";
        var rules = prologParser.parse(db);
        expect(rules.length).toBe(2);
        
        expect(rules[0] instanceof prologAST.Rule).toBeTruthy();
        expect(rules[0].head instanceof prologAST.Term).toBeTruthy();
        expect(rules[0].head.name).toBe("parent");
        
        expect(rules[1] instanceof prologAST.Rule).toBeTruthy();
        expect(rules[1].head instanceof prologAST.Term).toBeTruthy();
        expect(rules[1].head.name).toBe("sibling");
    });

    it("handles line comments properly", function () {
        var db = "parent(X,Y):-\nchild(Y,X).\n  % a comment\n% on the next line too\n\n% and skipping a line comment\nsibling(X,Y)\n:-\n\n\tchild(X,Z),child(Y,Z).";
        var rules = prologParser.parse(db);
        expect(rules.length).toBe(2);
        
        expect(rules[0] instanceof prologAST.Rule).toBeTruthy();
        expect(rules[0].head instanceof prologAST.Term).toBeTruthy();
        expect(rules[0].head.name).toBe("parent");
        
        expect(rules[1] instanceof prologAST.Rule).toBeTruthy();
        expect(rules[1].head instanceof prologAST.Term).toBeTruthy();
        expect(rules[1].head.name).toBe("sibling");
    });

    it("parses lists in format [a,b,c] correctly", function () {
        var db = "fact([a,b,c]).";
        var rules = prologParser.parse(db);
        expect(rules.length).toBe(1);
        expect(rules[0] instanceof prologAST.Rule).toBeTruthy();
        expect(rules[0].head instanceof prologAST.Term).toBeTruthy();
        expect(rules[0].head.name).toBe("fact");
        
        var cons = rules[0].head.partlist.list[0];
        expect(cons.name).toBe("cons");
        expect(cons.partlist.list[0].name).toBe("a");
        
        cons = cons.partlist.list[1];
        expect(cons.name).toBe("cons");
        expect(cons.partlist.list[0].name).toBe("b");
        
        cons = cons.partlist.list[1];
        expect(cons.name).toBe("cons");
        expect(cons.partlist.list[0].name).toBe("c");
        
        cons = cons.partlist.list[1];
        expect(cons.name).toBe("nil");
    });

    it("parses lists in format [a,b|X] correctly", function () {
        var db = "fact([a,b|X]).";
        var rules = prologParser.parse(db);
        expect(rules.length).toBe(1);
        expect(rules[0] instanceof prologAST.Rule).toBeTruthy();
        expect(rules[0].head instanceof prologAST.Term).toBeTruthy();
        expect(rules[0].head.name).toBe("fact");
        
        var cons = rules[0].head.partlist.list[0];
        expect(cons.name).toBe("cons");
        expect(cons.partlist.list[0].name).toBe("a");
        
        cons = cons.partlist.list[1];
        expect(cons.name).toBe("cons");
        expect(cons.partlist.list[0].name).toBe("b");
        
        cons = cons.partlist.list[1];
        expect(cons instanceof prologAST.Variable).toBeTruthy();
        expect(cons.name).toBe("X");                
    });
});