import {expect} from "chai";

import * as prologAST from '../src/prologAST';
import * as  prologParser from '../src/prologParser';

describe("prolog parser", function () {
    it("throws on syntax errors", function () {
        expect(function () { prologParser.parse("rule(X) :- :- check(X)."); }).to.throw("Syntax error: unexpected token :-");
        expect(function () { prologParser.parse("x."); }).to.throw("Syntax error: unexpected token .");
        expect(function () { prologParser.parse("fact([a,b,c"); }).to.throw("Syntax error: unexpected end of file");
    });

    it("can parse simple term", function () {
        var db = "adjacent(x,y).";
        var rules = prologParser.parse(db);
        expect(rules).to.be.ok;
        expect(rules.length).to.eq(1);
        expect(rules[0] instanceof prologAST.Rule).to.be.ok;
        expect(rules[0].head instanceof prologAST.Term).to.be.ok;
        expect(rules[0].head.name).to.eq("adjacent");
        expect(rules[0].head.partlist instanceof prologAST.Partlist).to.be.ok;
        expect(rules[0].head.partlist.list instanceof Array).to.be.ok;
        expect(rules[0].head.partlist.list.length).to.eq(2);
        expect(rules[0].head.partlist.list[0] instanceof prologAST.Atom).to.be.ok;
        expect(rules[0].head.partlist.list[1] instanceof prologAST.Atom).to.be.ok;
        expect(rules[0].head.partlist.list[0].name).to.eq("x");
        expect(rules[0].head.partlist.list[1].name).to.eq("y");
    });
    
    it("parses integer numbers", function () {
        var db = "val(10).";
        var rules = prologParser.parse(db);
        expect(rules).to.be.ok;
        expect(rules.length).to.eq(1);
        expect(rules[0] instanceof prologAST.Rule).to.be.ok;
        expect(rules[0].head instanceof prologAST.Term).to.be.ok;
        expect(rules[0].head.name).to.eq("val");
        expect(rules[0].head.partlist instanceof prologAST.Partlist).to.be.ok;
        expect(rules[0].head.partlist.list instanceof Array).to.be.ok;
        expect(rules[0].head.partlist.list.length).to.eq(1);
        expect(rules[0].head.partlist.list[0] instanceof prologAST.Atom).to.be.ok;        
        expect(rules[0].head.partlist.list[0].name).to.eq(10);
    });
    
    it("parses decimal numbers with fractional part", function () {
        var db = "val(3.14).";
        var rules = prologParser.parse(db);
        expect(rules).to.be.ok;
        expect(rules.length).to.eq(1);
        expect(rules[0] instanceof prologAST.Rule).to.be.ok;
        expect(rules[0].head instanceof prologAST.Term).to.be.ok;
        expect(rules[0].head.name).to.eq("val");
        expect(rules[0].head.partlist instanceof prologAST.Partlist).to.be.ok;
        expect(rules[0].head.partlist.list instanceof Array).to.be.ok;
        expect(rules[0].head.partlist.list.length).to.eq(1);
        expect(rules[0].head.partlist.list[0] instanceof prologAST.Atom).to.be.ok;
        expect(rules[0].head.partlist.list[0].name).to.eq(3.14);
    });

    it("can parse simple rule", function () {
        var db = "parent(X,Y):-child(Y,X),organism(X),organism(Y).";
        var rules = prologParser.parse(db);

        expect(rules.length).to.eq(1);
        expect(rules[0] instanceof prologAST.Rule).to.be.ok;
                
        expect(rules[0].head instanceof prologAST.Term).to.be.ok;
        expect(rules[0].head.name).to.eq("parent");
        expect(rules[0].head.partlist instanceof prologAST.Partlist).to.be.ok;
        expect(rules[0].head.partlist.list instanceof Array).to.be.ok;
        expect(rules[0].head.partlist.list.length).to.eq(2);
        expect(rules[0].head.partlist.list[0] instanceof prologAST.Variable).to.be.ok;
        expect(rules[0].head.partlist.list[1] instanceof prologAST.Variable).to.be.ok;
        expect(rules[0].head.partlist.list[0].name).to.eq("X");
        expect(rules[0].head.partlist.list[1].name).to.eq("Y");

        expect(rules[0].body instanceof prologAST.Partlist).to.be.ok;
        expect(rules[0].body.list.length).to.eq(3);
        expect(rules[0].body.list[0] instanceof prologAST.Term).to.be.ok;
        expect(rules[0].body.list[1] instanceof prologAST.Term).to.be.ok;
        expect(rules[0].body.list[2] instanceof prologAST.Term).to.be.ok;

        expect(rules[0].body.list[0].name).to.eq("child");
        expect(rules[0].body.list[0].partlist instanceof prologAST.Partlist).to.be.ok;
        expect(rules[0].body.list[0].partlist.list.length).to.eq(2);
        expect(rules[0].body.list[0].partlist.list[0] instanceof prologAST.Variable).to.be.ok;
        expect(rules[0].body.list[0].partlist.list[1] instanceof prologAST.Variable).to.be.ok;
        expect(rules[0].body.list[0].partlist.list[0].name).to.eq("Y");
        expect(rules[0].body.list[0].partlist.list[1].name).to.eq("X");
        
        expect(rules[0].body.list[1].name).to.eq("organism");
        expect(rules[0].body.list[1].partlist.list[0].name).to.eq("X");
        
        expect(rules[0].body.list[2].name).to.eq("organism");
        expect(rules[0].body.list[2].partlist.list[0].name).to.eq("Y");

    });

    it("parses several rules", function () { 
        var db = "parent(X,Y):-child(Y,X). sibling(X,Y):-child(X,Z),child(Y,Z).";
        var rules = prologParser.parse(db);
        expect(rules.length).to.eq(2);
                
        expect(rules[0] instanceof prologAST.Rule).to.be.ok;        
        expect(rules[0].head instanceof prologAST.Term).to.be.ok;
        expect(rules[0].head.name).to.eq("parent");        

        expect(rules[1] instanceof prologAST.Rule).to.be.ok;
        expect(rules[1].head instanceof prologAST.Term).to.be.ok;
        expect(rules[1].head.name).to.eq("sibling");        
    });

    it("parses ! and fail", function () {
        var db = "not(Term):-call(Term),!,fail. not(Term).";
        var rules = prologParser.parse(db);
        expect(rules.length).to.eq(2);
        expect(rules[0].body.list[1].name).to.eq("!");
        expect(rules[0].body.list[1].partlist.list.length).to.eq(0);
        expect(rules[0].body.list[2].name).to.eq("fail");
        expect(rules[0].body.list[2].partlist.list.length).to.eq(0);
    });

    it("handles new lines and tabs properly", function () {
        var db = "parent(X,Y):-\nchild(Y,X).\nsibling(X,Y)\n:-\n\tchild(X,Z),child(Y,Z).";
        var rules = prologParser.parse(db);
        expect(rules.length).to.eq(2);
        
        expect(rules[0] instanceof prologAST.Rule).to.be.ok;
        expect(rules[0].head instanceof prologAST.Term).to.be.ok;
        expect(rules[0].head.name).to.eq("parent");
        
        expect(rules[1] instanceof prologAST.Rule).to.be.ok;
        expect(rules[1].head instanceof prologAST.Term).to.be.ok;
        expect(rules[1].head.name).to.eq("sibling");
    });

    it("handles line comments properly", function () {
        var db = "parent(X,Y):-\nchild(Y,X).\n  % a comment\n% on the next line too\n\n% and skipping a line comment\nsibling(X,Y)\n:-\n\n\tchild(X,Z),child(Y,Z).";
        var rules = prologParser.parse(db);
        expect(rules.length).to.eq(2);
        
        expect(rules[0] instanceof prologAST.Rule).to.be.ok;
        expect(rules[0].head instanceof prologAST.Term).to.be.ok;
        expect(rules[0].head.name).to.eq("parent");
        
        expect(rules[1] instanceof prologAST.Rule).to.be.ok;
        expect(rules[1].head instanceof prologAST.Term).to.be.ok;
        expect(rules[1].head.name).to.eq("sibling");
    });

    it("parses lists in format [a,b,c] correctly", function () {
        var db = "fact([a,b,c]).";
        var rules = prologParser.parse(db);
        expect(rules.length).to.eq(1);
        expect(rules[0] instanceof prologAST.Rule).to.be.ok;
        expect(rules[0].head instanceof prologAST.Term).to.be.ok;
        expect(rules[0].head.name).to.eq("fact");
        
        var cons = rules[0].head.partlist.list[0];
        expect(cons.name).to.eq("cons");
        expect(cons.partlist.list[0].name).to.eq("a");
        
        cons = cons.partlist.list[1];
        expect(cons.name).to.eq("cons");
        expect(cons.partlist.list[0].name).to.eq("b");
        
        cons = cons.partlist.list[1];
        expect(cons.name).to.eq("cons");
        expect(cons.partlist.list[0].name).to.eq("c");
        
        cons = cons.partlist.list[1];
        expect(cons).to.eq(prologAST.Atom.Nil);
    });

    it("parses lists in format [a,b|X] correctly", function () {
        var db = "fact([a,b|X]).";
        var rules = prologParser.parse(db);
        expect(rules.length).to.eq(1);
        expect(rules[0] instanceof prologAST.Rule).to.be.ok;
        expect(rules[0].head instanceof prologAST.Term).to.be.ok;
        expect(rules[0].head.name).to.eq("fact");
        
        var cons = rules[0].head.partlist.list[0];
        expect(cons.name).to.eq("cons");
        expect(cons.partlist.list[0].name).to.eq("a");
        
        cons = cons.partlist.list[1];
        expect(cons.name).to.eq("cons");
        expect(cons.partlist.list[0].name).to.eq("b");
        
        cons = cons.partlist.list[1];
        expect(cons instanceof prologAST.Variable).to.be.ok;
        expect(cons.name).to.eq("X");                
    });
});