"use strict";
var prologAST_1 = require('./prologAST');
/**
 * Parses the DB
 */
function parse(string) {
    var tk = new Tokeniser(string), rules = [];
    while (tk.current != null) {
        rules.push(parseRule(tk));
    }
    return rules;
}
exports.parse = parse;
function parseQuery(string) {
    var tk = new Tokeniser(string);
    return new prologAST_1.Partlist(parseBody(tk));
}
exports.parseQuery = parseQuery;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = { parse: parse, parseQuery: parseQuery };
var tokenizerRules = [
    [/^([\(\)\.,\[\]\|]|\:\-)/, 0 /* Punc */],
    [/^([A-Z_][a-zA-Z0-9_]*)/, 1 /* Var */],
    [/^("[^"]*")/, 2 /* Id */],
    [/^([a-z][a-zA-Z0-9_]*)/, 2 /* Id */],
    [/^(-?\d+(\.\d+)?)/, 2 /* Id */, function (x) { return +x; }],
    [/^(\+|\-|\*|\/|\=|\!)/, 2 /* Id */]
];
var Tokeniser = (function () {
    function Tokeniser(source) {
        this.remainder = source;
        this.current = null;
        this.type = null; // "eof", TokenType.Id, TokenType.Var, TokenType.Punc etc.        
        this.consume(); // Load up the first token.
    }
    Tokeniser.prototype.consume = function () {
        if (this.type == 3 /* EOF */)
            return;
        // Eat any leading WS and %-style comments
        var r = this.remainder.match(/^(\s+|([%].*)[\n\r]+)*/);
        if (r) {
            this.remainder = this.remainder.substring(r[0].length);
        }
        if (!this.remainder.length) {
            this.current = null;
            this.type = 3 /* EOF */;
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
    };
    Tokeniser.prototype.accept = function (type, symbol) {
        if (this.type === type && (typeof (symbol) === "undefined" || this.current === symbol)) {
            this.accepted = this.current;
            this.consume();
            return true;
        }
        return false;
    };
    Tokeniser.prototype.expect = function (type, symbol) {
        if (!this.accept(type, symbol)) {
            throw this.type === 3 /* EOF */ ? "Syntax error: unexpected end of file" : "Syntax error: unexpected token " + this.current;
        }
        return true; // TODO: no need for boolean?
    };
    return Tokeniser;
}());
//////////////////////////////////////////////////////////////////////
function parseRule(tk) {
    // Rule := Term . | Term :- PartList .
    var h = parseTerm(tk);
    if (tk.accept(0 /* Punc */, ".")) {
        return new prologAST_1.Rule(h);
    }
    tk.expect(0 /* Punc */, ":-");
    var b = parseBody(tk);
    return new prologAST_1.Rule(h, b);
}
function parseTerm(tk) {
    tk.expect(2 /* Id */);
    var name = tk.accepted;
    // accept fail and ! w/o ()
    if (tk.current != "(" && (name == "fail" || name === "!")) {
        return new prologAST_1.Term(name, []);
    }
    tk.expect(0 /* Punc */, "(");
    var p = [];
    while (tk.current !== "eof") {
        p.push(parsePart(tk));
        if (tk.accept(0 /* Punc */, ")")) {
            break;
        }
        tk.expect(0 /* Punc */, ",");
    }
    return new prologAST_1.Term(name, p);
}
function parsePart(tk) {
    // Part -> var | id | id(optParamList)
    // Part -> [ listBit ] ::-> cons(...)
    if (tk.accept(1 /* Var */)) {
        return new prologAST_1.Variable(tk.accepted);
    }
    // Parse a list (syntactic sugar goes here)
    if (tk.accept(0 /* Punc */, "[")) {
        return parseList(tk);
    }
    tk.expect(2 /* Id */);
    var name = tk.accepted;
    if (!tk.accept(0 /* Punc */, "(")) {
        return new prologAST_1.Atom(name);
    }
    var p = [];
    while (tk.type !== 3 /* EOF */) {
        p.push(parsePart(tk));
        if (tk.accept(0 /* Punc */, ")")) {
            break;
        }
        tk.expect(0 /* Punc */, ",");
    }
    return new prologAST_1.Term(name, p);
}
function parseList(tk) {
    // empty list
    if (tk.accept(0 /* Punc */, "]")) {
        return prologAST_1.Atom.Nil;
    }
    // Get a list of parts into l
    var l = [];
    while (tk.current !== "eof") {
        l.push(parsePart(tk));
        if (!tk.accept(0 /* Punc */, ",")) {
            break;
        }
    }
    // Find the end of the list ... "| Var ]" or "]".
    var append;
    if (tk.accept(0 /* Punc */, "|")) {
        tk.expect(1 /* Var */);
        append = new prologAST_1.Variable(tk.accepted);
    }
    else {
        append = prologAST_1.Atom.Nil;
    }
    tk.expect(0 /* Punc */, "]");
    //// Construct list
    //for (var i = l.length; i--;) {
    //    append = new Term("cons", [l[i], append]);
    //}
    return prologAST_1.listOfArray(l, append);
}
function parseBody(tk) {
    var terms = [];
    while (tk.current !== "eof") {
        terms.push(parseTerm(tk));
        if (tk.accept(0 /* Punc */, ".")) {
            break;
        }
        else {
            tk.expect(0 /* Punc */, ",");
        }
    }
    return terms;
}
