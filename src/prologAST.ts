export enum PartType {
    Variable,
    Atom,
    Term
}

export abstract class Part{
    /**     
     * @class Part
     * @classdesc Part := Variable(name) | Atom(name) | Term(name, partlist)
     * @param {string} name Name of the variable/atom/term
     */
    constructor(public name: string) { }
    /**
     * Type of the 
     * @member Part.type
     */
    type: PartType;
    toString() {
        return this.name;
    }
}

export class Variable extends Part {        
    constructor(name: string) {
        super(name);
    }
}
Variable.prototype.type = PartType.Variable; // TODO:  verify if it's faster than instanceof checks

export class Atom extends Part {
    constructor(head) {
        super(head);
    }    
    static Nil = new Atom(null);
}
Atom.prototype.type = PartType.Atom; // TODO:  verify if it's faster than instanceof checks

/**
 * Term(name, list)
 */
export class Term extends Part {
    partlist: Partlist
    constructor(head, list) {
        super(head);
        this.partlist = new Partlist(list);
    }        
    toString() {
        var result = "";
        if (this.name == "cons") {
            var x: (Atom | Term | Variable) = this;

            while (x instanceof Term && x.name == "cons" && x.partlist.list.length == 2) {
                x = (<Term>x).partlist.list[1];
            }

            if ((x instanceof Atom && x.name == "nil") || x instanceof Variable) {
                x = this;
                result += "[";
                var com = false;
                while (x.type == PartType.Term && x.name == "cons" && (<Term>x).partlist.list.length == 2) {
                    if (com) {
                        result += ", ";
                    }
                    result += (<Term>x).partlist.list[0].toString();
                    com = true;
                    x = (<Term>x).partlist.list[1];
                }
                if (x.type == PartType.Variable) {
                    result += " | ";
                }
                result += "]";
                return result;
            } else {
                result += `ERROR: unexpected atom: ${x.toString()}`;
            }
        }
        result += `${this.name}(${this.partlist.toString()})`;
        return result;
    };
}
Term.prototype.type = PartType.Term; // TODO:  verify if it's faster than instanceof checks


export class Partlist {
    constructor(public list:Part[]) {}
    toString() {
        return this.list.map(function (e) { return e.toString(); }).join(", ");
    }
}

/**
 * Rule(head, bodylist): Part(head), [:- Body(bodylist)].
 */
export class Rule {
    body: Partlist
    get isFact() {
        return !this.body;
    }
    constructor(public head: Part, bodylist?: Part[]) {
        this.body = bodylist && new Partlist(bodylist);
    }
    toString() {
        return this.head.toString() + (this.body ? " :- " + this.body.toString() + "." : ".");
    }
}

export function listOfArray(array, cdr){
    cdr = cdr || new Atom("nil");
    for (var i = array.length, car; car = array[--i];) {
        cdr = new Term("cons", [car, cdr]);
    }
    return cdr;
}
