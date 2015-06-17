var AST = require('./prologAST');

var Part = AST.Part;
var Variable = AST.Variable;
var Atom = AST.Atom;
var Term = AST.Term;
var Partlist = AST.Partlist;
var Body = AST.Body;
var Rule = AST.Rule;


exports.parse = parse;
exports.parseQuery = parseQuery;

/**
 * Parses the DB
 */
function parse(string) {
    var tk = new Tokeniser(string), 
        rules = [];
    
    while (tk.current != null) {
        rules.push(parseRule(tk));        
    }
    
    return rules;
}

function parseQuery(string) {
    var tk = new Tokeniser(string);
    return new Body(parseBody(tk));
}

//////////////////////////////////////////////////////////////////////

function Tokeniser(string) {
    this.remainder = string;
    this.current = null;
    this.type = null;	// "eof", "id", "var", "punc" etc.        
    this.consume();	// Load up the first token.
}

var tokenizerRules = [
    [/^([\(\)\.,\[\]\|\!]|\:\-)/, "punc"],
    [/^([A-Z_][a-zA-Z0-9_]*)/, "var"],
    [/^("[^"]*")/, "id"],
    [/^([a-z][a-zA-Z0-9_]*)/, "id"],
    [/^(-?\d+(\.\d+)?)/, "id", function (x) { return +x; }]
];

// TODO: lexer error handling
Tokeniser.prototype.consume = function consume() {
    if (this.type == "eof") return;
    
    // Eat any leading WS and %-style comments
    var r = this.remainder.match(/^(\s+|([%].*)[\n\r]+)*/);
    if (r) {
        this.remainder = this.remainder.substring(r[0].length);
    }
    
    if (this.remainder == "") {
        this.current = null;
        this.type = "eof";
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
    
    // TODO: throw tokenizer error instead of eof'ing
    this.current = null;
    this.type = "eof";
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
    if (this.accept(type, symbol)) {
        return true;
    }
    throw this.type === "eof" ? "Syntax error: unexpected end of file" : "Syntax error: unexpected token " + this.current;
};

//////////////////////////////////////////////////////////////////////

function parseRule(tk) {
    // Rule := Term . | Term :- PartList .
    
    var h = parseTerm(tk);
    
    if (tk.accept("punc", ".")) {
        return new Rule(h);
    }
    
    tk.expect("punc", ":-");
    var b = parseBody(tk);
    
    return new Rule(h, b);
}

function parseTerm(tk) {// Term -> id ( optParamList )
    if (tk.accept("punc", "!")) {
        // Parse ! as cut/0        
        return new Term("cut", []);
    }
    
    tk.expect("id");
    var name = tk.accepted;
    
    // fail shorthand for fail(), ie, fail/0
    if (tk.current != "(" && name == "fail") {
        return new Term(name, []);
    }
    
    tk.expect("punc", "(");
    
    var p = [];
    while (tk.current !== "eof") {        
        p.push(parsePart(tk));
        
        if (tk.accept("punc", ")")) {
            break;
        }
        
        tk.expect("punc", ",");
    }
    
    return new Term(name, p);
}

function parsePart(tk) {
    // Part -> var | id | id(optParamList)
    // Part -> [ listBit ] ::-> cons(...)
    if (tk.accept("var")) {
        return new Variable(tk.accepted);
    }
    
    // Parse a list (syntactic sugar goes here)
    if (tk.accept("punc", "[")) {
        return parseList(tk);
    }
    
    tk.expect("id");
    var name = tk.accepted;    
    
    if (!tk.accept("punc", "(")) {    
        return new Atom(name);
    }

    var p = [];    
    while (tk.type !== "eof") {                
        p.push(parsePart(tk));        
        
        if (tk.accept("punc", ")")) {
            break;
        }

        tk.expect("punc", ",");
    }    
    
    return new Term(name, p);
}

function parseList(tk) {
    // empty list
    if (tk.accept("punc", "]")) {
        return new Atom("nil");
    }
    
    // Get a list of parts into l
    var l = [];
    
    while (tk.current !== "eof") {        
        l.push(parsePart(tk));
        if (!tk.accept("punc", ",")) {
            break;
        }
    }
    
    // Find the end of the list ... "| Var ]" or "]".
    var append;
    if (tk.accept("punc", "|")) {
        tk.expect("var");
        append = new Variable(tk.accepted);
    } else {
        append = new Atom("nil");
    }
    tk.expect("punc", "]");
    
    // Construct list
    for (var i = l.length; i--;) {
        append = new Term("cons", [l[i], append]);
    }
    
    return append;
}

function parseBody(tk) {// Body -> Term {, Term...}        
    var terms = [];
    
    while (tk.current !== "eof") {        
        terms.push(parseTerm(tk));
        if (tk.accept("punc", ".")) {
            break;
        } else {
            tk.expect("punc", ",");
        }
    }
    
    return terms;
}




