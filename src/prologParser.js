var AST = require('./prologAST.js');

var Part = AST.Part;
var Variable = AST.Variable;
var Atom = AST.Atom;
var Term = AST.Term;
var Partlist = AST.Partlist;
var Body = AST.Body;
var Rule = AST.Rule;

function Tokeniser(string) {
    this.remainder = string;
    this.current = null;
    this.type = null;	// "eof", "id", "var", "punc" etc.        
    this.consume();	// Load up the first token.
}

// TODO: lexer error handling
Tokeniser.prototype.consume = function consume() {
    if (this.type == "eof") return;
    // Eat any leading WS
    var r = this.remainder.match(/^\s*(.*)$/);
    if (r) {
        this.remainder = r[1];
    }
    
    if (this.remainder == "") {
        this.current = null;
        this.type = "eof";
        return;
    }
    
    r = this.remainder.match(/^([\(\)\.,\[\]\|\!]|\:\-)(.*)$/);
    if (r) {
        this.remainder = r[2];
        this.current = r[1];
        this.type = "punc";
        return;
    }
    
    r = this.remainder.match(/^([A-Z_][a-zA-Z0-9_]*)(.*)$/);
    if (r) {
        this.remainder = r[2];
        this.current = r[1];
        this.type = "var";
        return;
    }
    
    // URLs in curly-bracket pairs
    r = this.remainder.match(/^(\{[^\}]*\})(.*)$/);
    if (r) {
        this.remainder = r[2];
        this.current = r[1];
        this.type = "id";
        return;
    }
    
    // Quoted strings
    r = this.remainder.match(/^("[^"]*")(.*)$/);
    if (r) {
        this.remainder = r[2];
        this.current = r[1];
        this.type = "id";
        return;
    }
    
    r = this.remainder.match(/^([a-zA-Z0-9][a-zA-Z0-9_]*)(.*)$/);
    if (r) {
        this.remainder = r[2];
        this.current = r[1];
        this.type = "id";
        return;
    }
    
    r = this.remainder.match(/^(-[0-9][0-9]*)(.*)$/);
    if (r) {
        this.remainder = r[2];
        this.current = r[1];
        this.type = "id";
        return;
    }
    
    this.current = null;
    this.type = "eof";

};


// TODO: parser error handling

/**
 * Parses the DB
 */
exports.parse = function parse(string) {
    var tk = new Tokeniser(string), 
        rules = [],
        db = {},
        rule;

    while (tk.current != null) {        
        rule = parseRule(tk);

        if (rule) {
            rules.push(rule);
        } else {
            throw "Syntax Error";
        }
        
        // TODO: maybe it should be consumed in the rule
        if (tk.current == '.') {
            tk.consume();
        }
    }

    return rules;
};

exports.parseQuery = function parseQuery(string) {
    var tk = new Tokeniser(string),
        body = parseBody(tk);
    if (!body) {
        throw "Syntax Error";
    }
    
    return new Body(body);
};



function parseRule(tk) {
    // A rule is a Head followed by . or by :- Body
    
    var h = parseTerm(tk);
    if (!h) return null;
    
    if (tk.current == ".") {
        // A simple rule.
        return new Rule(h);
    }
    
    if (tk.current != ":-") return null;
    tk.consume();
    var b = parseBody(tk);
    
    if (tk.current != ".") return null;
    
    return new Rule(h, b);
}

function parseTerm(tk) {
    // Term -> [NOTTHIS] id ( optParamList )
    
    if (tk.type == "punc" && tk.current == "!") {
        // Parse ! as cut/0
        tk.consume();
        return new Term("cut", []);
    }
    
    var notthis = false;
    if (tk.current == "NOTTHIS") {
        notthis = true;
        tk.consume();
    }
    
    if (tk.type != "id") {
        return null;
    }
    
    var name = tk.current;
    tk.consume();
    
    if (tk.current != "(") {
        // fail shorthand for fail(), ie, fail/0
        if (name == "fail") {
            return new Term(name, []);
        }
        return null;
    }
    tk.consume();
    
    var p = [];
    var i = 0;
    while (tk.current != ")") {
        if (tk.type == "eof") return null;
        
        var part = parsePart(tk);
        if (part == null) return null;
        
        if (tk.current == ",") tk.consume();
        else if (tk.current != ")") return null;
        
        // Add the current Part onto the list...
        p[i++] = part;
    }
    tk.consume();
    
    var term = new Term(name, p);
    if (notthis) {
        term.excludeThis = true;
    }
    return term;
}

// This was a beautiful piece of code. It got kludged to add [a,b,c|Z] sugar.
function parsePart(tk) {
    // Part -> var | id | id(optParamList)
    // Part -> [ listBit ] ::-> cons(...)
    if (tk.type == "var") {
        var n = tk.current;
        tk.consume();
        return new Variable(n);
    }
    
    if (tk.type != "id") {
        if (tk.type != "punc" || tk.current != "[") return null;
        // Parse a list (syntactic sugar goes here)
        tk.consume();
        // Special case: [] = new atom(nil).
        if (tk.type == "punc" && tk.current == "]") {
            tk.consume();
            return new Atom("nil");
        }
        
        // Get a list of parts into l
        var l = [], i = 0;
        
        while (true) {
            var t = parsePart(tk);
            if (t == null) return null;
            
            l[i++] = t;
            if (tk.current != ",") break;
            tk.consume();
        }
        
        // Find the end of the list ... "| Var ]" or "]".
        var append;
        if (tk.current == "|") {
            tk.consume();
            if (tk.type != "var") return null;
            append = new Variable(tk.current);
            tk.consume();
        } else {
            append = new Atom("nil");
        }
        if (tk.current != "]") return null;
        tk.consume();
        // Return the new cons.... of all this rubbish.
        for 
        (
        --i
        ;
        i >= 0;
        i--) append = new Term("cons", [l[i], append]);
        return append;
    }
    
    var name = tk.current;
    tk.consume();
    
    if (tk.current != "(") return new Atom(name);
    tk.consume();
    
    var p = [];
    var i = 0;
    while (tk.current != ")") {
        if (tk.type == "eof") return null;
        
        var part = parsePart(tk);
        if (part == null) return null;
        
        if (tk.current == ",") tk.consume();
        else if (tk.current != ")") return null;
        
        // Add the current Part onto the list...
        p[i++] = part;
    }
    tk.consume();
    
    return new Term(name, p);
}

function parseBody(tk) {
    // Body -> Term {, Term...}
    
    var p = [];
    var i = 0;
    
    var t;
    while ((t = parseTerm(tk)) != null) {
        p[i++] = t;
        if (tk.current != ",") break;
        tk.consume();
    }
    
    if (i == 0) return null;
    return p;
}