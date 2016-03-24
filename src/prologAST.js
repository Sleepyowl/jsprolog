"use strict";
var __extends = (this && this.__extends) || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
};
(function (PartType) {
    PartType[PartType["Variable"] = 0] = "Variable";
    PartType[PartType["Atom"] = 1] = "Atom";
    PartType[PartType["Term"] = 2] = "Term";
})(exports.PartType || (exports.PartType = {}));
var PartType = exports.PartType;
var Part = (function () {
    /**
     * @class Part
     * @classdesc Part := Variable(name) | Atom(name) | Term(name, partlist)
     * @param {string} name Name of the variable/atom/term
     */
    function Part(name) {
        this.name = name;
    }
    Part.prototype.toString = function () {
        return this.name;
    };
    return Part;
}());
exports.Part = Part;
var Variable = (function (_super) {
    __extends(Variable, _super);
    function Variable(name) {
        _super.call(this, name);
    }
    return Variable;
}(Part));
exports.Variable = Variable;
Variable.prototype.type = PartType.Variable; // TODO:  verify if it's faster than instanceof checks
var Atom = (function (_super) {
    __extends(Atom, _super);
    function Atom(head) {
        _super.call(this, head);
    }
    Atom.Nil = new Atom(null);
    return Atom;
}(Part));
exports.Atom = Atom;
Atom.prototype.type = PartType.Atom; // TODO:  verify if it's faster than instanceof checks
/**
 * Term(name, list)
 */
var Term = (function (_super) {
    __extends(Term, _super);
    function Term(head, list) {
        _super.call(this, head);
        this.partlist = new Partlist(list);
    }
    Term.prototype.toString = function () {
        var result = "";
        if (this.name == "cons") {
            var x = this;
            while (x instanceof Term && x.name == "cons" && x.partlist.list.length == 2) {
                x = x.partlist.list[1];
            }
            if ((x instanceof Atom && x.name == "nil") || x instanceof Variable) {
                x = this;
                result += "[";
                var com = false;
                while (x.type == PartType.Term && x.name == "cons" && x.partlist.list.length == 2) {
                    if (com) {
                        result += ", ";
                    }
                    result += x.partlist.list[0].toString();
                    com = true;
                    x = x.partlist.list[1];
                }
                if (x.type == PartType.Variable) {
                    result += " | ";
                }
                result += "]";
                return result;
            }
            else {
                result += "ERROR: unexpected atom: " + x.toString();
            }
        }
        result += this.name + "(" + this.partlist.toString() + ")";
        return result;
    };
    ;
    return Term;
}(Part));
exports.Term = Term;
Term.prototype.type = PartType.Term; // TODO:  verify if it's faster than instanceof checks
var Partlist = (function () {
    function Partlist(list) {
        this.list = list;
    }
    Partlist.prototype.toString = function () {
        return this.list.map(function (e) { return e.toString(); }).join(", ");
    };
    return Partlist;
}());
exports.Partlist = Partlist;
/**
 * Rule(head, bodylist): Part(head), [:- Body(bodylist)].
 */
var Rule = (function () {
    function Rule(head, bodylist) {
        this.head = head;
        this.body = bodylist && new Partlist(bodylist);
    }
    Object.defineProperty(Rule.prototype, "isFact", {
        get: function () {
            return !this.body;
        },
        enumerable: true,
        configurable: true
    });
    Rule.prototype.toString = function () {
        return this.head.toString() + (this.body ? " :- " + this.body.toString() + "." : ".");
    };
    return Rule;
}());
exports.Rule = Rule;
function listOfArray(array, cdr) {
    cdr = cdr || Atom.Nil;
    for (var i = array.length, car; car = array[--i];) {
        cdr = new Term("cons", [car, cdr]);
    }
    return cdr;
}
exports.listOfArray = listOfArray;
Object.defineProperty(exports, "__esModule", { value: true });
exports.default = { Part: Part, Variable: Variable, Atom: Atom, Term: Term, Partlist: Partlist, Rule: Rule, listOfArray: listOfArray };
