﻿import {Part, Variable, Atom, Term, Partlist, Rule, listOfArray} from './prologAST';

/**
 * Parses the DB
 */
export function parse(string) {
    var tk = new Tokeniser(string),
        rules = [];

    while (tk.current != null) {
        rules.push(parseRule(tk));
    }

    return rules;
}

export function parseQuery(string) {
    var tk = new Tokeniser(string);
    return new Partlist(parseBody(tk));
}

//////////////////////////////////////////////////////////////////////
// TODO: lexer error handling

declare enum TokenType {
    Punc,
    Var,
    Id,
    EOF
}

var tokenizerRules = [
    [/^([\(\)\.,\[\]\|]|\:\-)/, TokenType.Punc],
    [/^([A-Z_][a-zA-Z0-9_]*)/, TokenType.Var],
    [/^("[^"]*")/, TokenType.Id],
    [/^([a-z][a-zA-Z0-9_]*)/, TokenType.Id],
    [/^(-?\d+(\.\d+)?)/, TokenType.Id, function (x) { return +x; }],
    [/^(\+|\-|\*|\/|\=|\!)/, TokenType.Id]
];

class Tokeniser {
    remainder: string
    current: string
    accepted: string
    type: TokenType

    constructor(source: string) {
        this.remainder = source;
        this.current = null;
        this.type = null;	// "eof", TokenType.Id, TokenType.Var, TokenType.Punc etc.        
        this.consume();	// Load up the first token.
    }
    consume() {
        if (this.type == TokenType.EOF) return;
    
        // Eat any leading WS and %-style comments
        var r = this.remainder.match(/^(\s+|([%].*)[\n\r]+)*/);
        if (r) {
            this.remainder = this.remainder.substring(r[0].length);
        }

        if (!this.remainder.length) {
            this.current = null;
            this.type = TokenType.EOF;
            return;
        }

        for (var i = 0, rule; rule = tokenizerRules[i++];) {
            if (r = this.remainder.match(rule[0])) {
                this.remainder = this.remainder.substring(r[0].length);
                this.type = rule[1];
                this.current = typeof (rule[2]) === "function" ? rule[2](r[1]) : r[1];
                return;
            }
        }

        throw "Unexpected tokenizer input";
    }
    accept(type: TokenType, symbol?: string) {
        if (this.type === type && (typeof (symbol) === "undefined" || this.current === symbol)) {
            this.accepted = this.current;
            this.consume();
            return true;
        }
        return false;
    }

    expect(type: TokenType, symbol?: string) {
        if (!this.accept(type, symbol)) {
            throw this.type === TokenType.EOF ? "Syntax error: unexpected end of file" : `Syntax error: unexpected token ${this.current}`;
        }
        return true; // TODO: no need for boolean?
    }
}

//////////////////////////////////////////////////////////////////////

function parseRule(tk: Tokeniser) {
    // Rule := Term . | Term :- PartList .
    
    var h = parseTerm(tk);

    if (tk.accept(TokenType.Punc, ".")) {
        return new Rule(h);
    }

    tk.expect(TokenType.Punc, ":-");
    var b = parseBody(tk);

    return new Rule(h, b);
}

function parseTerm(tk: Tokeniser) {// Term -> id ( optParamList )
    tk.expect(TokenType.Id);
    var name = tk.accepted;

    // accept fail and ! w/o ()
    if (tk.current != "(" && (name == "fail" || name === "!")) {
        return new Term(name, []);
    }

    tk.expect(TokenType.Punc, "(");

    var p = [];
    while (tk.current !== "eof") {
        p.push(parsePart(tk));

        if (tk.accept(TokenType.Punc, ")")) {
            break;
        }

        tk.expect(TokenType.Punc, ",");
    }

    return new Term(name, p);
}

function parsePart(tk: Tokeniser) {
    // Part -> var | id | id(optParamList)
    // Part -> [ listBit ] ::-> cons(...)
    if (tk.accept(TokenType.Var)) {
        return new Variable(tk.accepted);
    }
    
    // Parse a list (syntactic sugar goes here)
    if (tk.accept(TokenType.Punc, "[")) {
        return parseList(tk);
    }

    tk.expect(TokenType.Id);
    var name = tk.accepted;

    if (!tk.accept(TokenType.Punc, "(")) {
        return new Atom(name);
    }

    var p = [];
    while (tk.type !== TokenType.EOF) {
        p.push(parsePart(tk));

        if (tk.accept(TokenType.Punc, ")")) {
            break;
        }

        tk.expect(TokenType.Punc, ",");
    }

    return new Term(name, p);
}

function parseList(tk: Tokeniser) {
    // empty list
    if (tk.accept(TokenType.Punc, "]")) {
        return Atom.Nil;
    }
    
    // Get a list of parts into l
    var l = [];

    while (tk.current !== "eof") {
        l.push(parsePart(tk));
        if (!tk.accept(TokenType.Punc, ",")) {
            break;
        }
    }
    
    // Find the end of the list ... "| Var ]" or "]".
    var append;
    if (tk.accept(TokenType.Punc, "|")) {
        tk.expect(TokenType.Var);
        append = new Variable(tk.accepted);
    } else {
        append = Atom.Nil;
    }
    tk.expect(TokenType.Punc, "]");
    
    //// Construct list
    //for (var i = l.length; i--;) {
    //    append = new Term("cons", [l[i], append]);
    //}
    
    return listOfArray(l, append);
}

function parseBody(tk: Tokeniser) {// Body -> Term {, Term...}        
    var terms = [];

    while (tk.current !== "eof") {
        terms.push(parseTerm(tk));
        if (tk.accept(TokenType.Punc, ".")) {
            break;
        } else {
            tk.expect(TokenType.Punc, ",");
        }
    }

    return terms;
}




