/**
 * Part: Atom | Variable | Term
 */
function Part(head) {
    this.name = head;
}
Part.prototype.toString = function () { return this.name; };

function Variable(head) {
    Part.apply(this, arguments);
}
Variable.prototype = Object.create(Part.prototype);
Variable.prototype.type = "Variable"; // TODO: replace type checks with instanceof

function Atom(head) {
    Part.apply(this, arguments);
}
Atom.prototype = Object.create(Part.prototype);
Atom.prototype.type = "Atom";// TODO: replace type checks with instanceof

/**
 * Term(name, list)
 */
function Term(head, list) {
    Part.apply(this, arguments);
    this.partlist = new Partlist(list);
}
Term.prototype = Object.create(Part.prototype);
Term.prototype.type = "Term";// TODO: replace type checks with instanceof
Term.prototype.toString = function () {
    var result = "";
    if (this.name == "cons") {
        var x = this;
        while (x.type == "Term" && x.name == "cons" && x.partlist.list.length == 2) {
            x = x.partlist.list[1];
        }
        if ((x instanceof Atom && x.name == "nil") || x instanceof Variable) {
            x = this;
            result += "[";
            var com = false;
            while (x.type == "Term" && x.name == "cons" && x.partlist.list.length == 2) {
                if (com) {
                    result += ", ";
                }
                result += x.partlist.list[0].toString();
                com = true;
                x = x.partlist.list[1];
            }
            if (x.type == "Variable") {
                result += " | ";
            }
            result += "]";
            return result;
        }
    }
    result += this.name + "(" + this.partlist.toString() + ")";
    return result;
};

function Partlist(list) {
    this.list = list;
}
Partlist.prototype.toString = function toString() {
    return this.list.map(function (e) { return e.toString(); }).join(", ");
};

function Body(list) {
    Partlist.call(this, list);
}
Body.prototype = Object.create(Partlist.prototype);

/**
 * Rule(head, bodylist): Part(head), [:- Body(bodylist)].
 */
function Rule(head, bodylist) {
    this.head = head;
    this.body = bodylist && new Body(bodylist);
}
Rule.prototype.toString = function toString() {
    return this.head.toString() + (this.body ? " :- " + this.body.toString() + "." : ".");
};

module.exports.Part = Part;
module.exports.Variable = Variable;
module.exports.Atom = Atom;
module.exports.Term = Term;
module.exports.Partlist = Partlist;
module.exports.Body = Body;
module.exports.Rule = Rule;


/*
 * JUST FOR REFERENCE
 * 
<program> ::= <clause list> <query> | <query>
<clause list> ::= <clause> | <clause list> <clause>
<clause> ::= <predicate> . | <predicate> :- <predicate list>.
<predicate list> ::= <predicate> | <predicate list> , <predicate>
<predicate> ::= <atom> | <atom> ( <term list> )
<term list> ::= <term> | <term list> , <term>
<term> ::= <numeral> | <atom> | <variable> | <structure>
<structure> ::= <atom> ( <term list> )
<query> ::= ?- <predicate list>. 
<atom> ::= <small atom> | ' <string> '
<small atom> ::= <lowercase letter> | <small atom> <character>
<variable> ::= <uppercase letter> | <variable> <character>
<lowercase letter> ::= a | b | c | ... | x | y | z
<uppercase letter> ::= A | B | C | ... | X | Y | Z | _
<numeral> ::= <digit> | <numeral> <digit>
<digit> ::= 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9
<character> ::= <lowercase letter> | <uppercase letter> | <digit> | <special>
<special> ::= + | - | * | / | \ | ^ | ~ | : | . | ? |  | # | $ | &
<string> ::= <character> | <string> <character> */