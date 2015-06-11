var prologAST = require('../src/prologAST.js');
var prologParser = require('../src/prologParser.js');
describe("prolog parser", function () {
    it("throws on syntax errors", function () {
        expect(function () { prologParser.parse("x."); }).toThrow("Syntax Error");
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
});