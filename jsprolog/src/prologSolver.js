var AST = require('./prologAST.js');

var Part = AST.Part;
var Variable = AST.Variable;
var Atom = AST.Atom;
var Term = AST.Term;
var Partlist = AST.Partlist;
var Body = AST.Body;
var Rule = AST.Rule;

var options = {
    enableTrace: false
};
exports.options = options;

/**
 * prints debug information to the console
 * @param message message to print
 * @param indentLevel indentation level
 */
function trace(message, indentLevel) {
    if (options.enableTrace && console) {
        for (; indentLevel > 1; indentLevel--) { message = "    " + message; }
        console.log(message);
    }
}

/**
 * executes a query agains the database
 * @param db compiled rule database
 * @param query compiled query
 * @param outVars (optional) object to store output
 * @returns true if unify
 */
exports.query = function query(db, query, outVars) {
    var vars = varNames(query.list);
    var proven = false;
    
    var cont = getdtreeiterator(query.list, db, function (bindingContext) {
        proven = true;
        if (outVars && typeof (outVars) === "object") {
            vars.forEach(function (v) {
                var name = v.name, val = (bindingContext.value(new Variable(name))).toString();
                if (!(name in outVars)) {
                    outVars[name] = [];
                }
                outVars[name].push(val);
            });
        }
    });
    
    while (cont != null) {
        cont = cont();
    }
    
    return proven;
};

// Return a list of all variables mentioned in a list of Terms.
function varNames(list) {
    var out = [], vars = {}, t, n;
    list = list.slice(0); // clone   
    while (list.length) {
        t = list.pop();
        if (t instanceof Variable) {
            n = t.name;
            // ignore special variable _
            // push only new names
            if (n !== "_" && out.indexOf(n) === -1) {
                out.push(n);
                vars[n] = t;
            }
        } else if (t instanceof Term) {
            // we don't care about tree walk order
            Array.prototype.push.apply(list, t.partlist.list);
        }
    }
    
    return out.map(function (name) { return vars[name]; });
}

var builtinPredicates = {
    "cut/0" : function (loop, goals, idx, bindingContext, fbacktrack, level) {
        var nextgoals = goals.slice(1); // cut always succeeds
        return loop(nextgoals, 0, new BindingContext(bindingContext), function () {
            return fbacktrack && fbacktrack(2); // probably still wrong... 8(
        }, level);
    },
    "fail/0": function (loop, goals, idx, bindingContext, fbacktrack, level) {
        return fbacktrack; // FAIL
    },
    "call/1": function (loop, goals, idx, bindingContext, fbacktrack, level) {       
        var first = bindingContext.value(goals[0].partlist.list[0]);
        if (!(first instanceof Term)) {
            return fbacktrack; // FAIL
        }
        
        var ng = goals.slice(0);
        ng[0] = first;
        first.parent = goals[0];
        
        return loop(ng, 0, bindingContext, fbacktrack, level);
    }
};

/**
 * The main proving engine 
 * @param originalGoals original goals to prove
 * @param rulesDB prolog database to consult with
 * @param fsuccess success callback
 * @returns a function to perform next step
 */
function getdtreeiterator(originalGoals, rulesDB, fsuccess) {
    "use strict";
    var cdb = {};
    
    // maybe move to parser level, idk
    for (var i = 0, name, rule; i < rulesDB.length; i++) {
        rule = rulesDB[i];
        name = rule.head.name;
        if (name in cdb) {
            cdb[name].push(rule);
        } else {
            cdb[name] = [rule];
        }
    }
    
    // main loop continuation
    function loop(goals, idx, parentBindingContext, fbacktrack, level) {
        
        if (!goals.length) {
            fsuccess(parentBindingContext);
            return fbacktrack;
        }
        
        var currentGoal = goals[0],
            currentBindingContext = new BindingContext(parentBindingContext);
        
        var builtin = builtinPredicates[currentGoal.name + "/" + currentGoal.partlist.list.length];
        if (typeof (builtin) === "function") {
            return builtin(loop, goals, idx, currentBindingContext, fbacktrack, level);
        }
        
        // searching for next matching rule
        for (var i = idx, db = cdb[currentGoal.name]; i < db.length; i++) {
            var rule = db[i];            
            
            var renamedHead = new Term(rule.head.name, currentBindingContext.renameVariables(rule.head.partlist.list, currentGoal));
            
            if (!currentBindingContext.unify(currentGoal, renamedHead)) {
                continue;
            }
            
            // backtracking continuation
            
            /// CURRENT BACKTRACK CONTINUATION  ///
            /// WHEN INVOKED BACKTRACKS TO THE  ///
            /// NEXT RULE IN THE PREVIOUS LEVEL ///
            var fCurrentBT = function (cut) {
                
                var b = fbacktrack;
                if (cut > 0) {
                    return fbacktrack && fbacktrack(cut - 1);
                } else {
                    return loop(goals, i + 1, parentBindingContext, fbacktrack, level);
                }
            };
            
            if (rule.body == null) {
                var nextGoals = goals.slice(1); // no body = goal is met
                return function nextGoal() {
                    return loop(nextGoals, 0, currentBindingContext, fCurrentBT, level);
                };
            } else {                
                var newFirstGoals = currentBindingContext.renameVariables(rule.body.list, renamedHead);
                var nextGoals = newFirstGoals.concat(goals.slice(1));
                
                if (nextGoals.length === 1) {
                    return function levelDownTail() {
                        // skipping backtracking to the same level because it's the last goal                        
                        // removing parent from binding context, making grand-parent its parent
                        // TODO: there's a problem with the possibility of variables in the parent context being referenced by ancestor contexts, write tests for that and fix
                        return loop(nextGoals, 0, currentBindingContext.cutTail(goals), fbacktrack, level + 1);
                    };
                } else {
                    return function levelDown() {
                        return loop(nextGoals, 0, currentBindingContext, fCurrentBT, level + 1);
                    };
                }
            }
        }
        return fbacktrack;
    }    ;
    
    
    return loop(originalGoals, 0, null, null, 1);
};


/**
 * creates binding context for variables
 */
function BindingContext(parentContext) {
    this.parent = parentContext;   
    this.parentCtx = parentContext && parentContext.ctx || null;
    this.ctx = Object.create(this.parentCtx);    
    this.level = (parentContext && parentContext.level || 0) + 1;
    
    // to avoid for ... in which is way too slow
    this.varNames = [];
    this.allVarNames = parentContext && parentContext.varNames.slice(0) || [];
}

BindingContext.prototype.toString = function toString() {
    var r = [], p = [];
    for (key in this.ctx) {
        Array.prototype.push.call(
            Object.prototype.hasOwnProperty.call(this.ctx, key) ? r :p,
            key + " = " + this.ctx[key]);
    }
    return r.join(", ") + " || " + p.join(", ");
};

/**
 * renames variables to make sure names are unique
 */
BindingContext.prototype.renameVariables = function renameVariables(list, parent) {
    var out = [], 
        queue = [],
        stack = [list],
        clen,
        tmp,
        level = this.level;
    
    // prepare depth-first queue
    while (stack.length) {
        list = stack.pop();
        queue.push(list);
        if (list instanceof Array) {
            list.length && Array.prototype.push.apply(stack, list);
        } else if (list instanceof Term) {
            list.partlist.list.length && Array.prototype.push.apply(stack, list.partlist.list);
        }
    }
    
    // process depth-first queue
    for (var i = queue.length - 1; i >= 0; i--) {
        list = queue[i];
        if (list instanceof Atom) {
            out.push(list);
        } else if (list instanceof Variable) {
            out.push(list.name === "_" ?  new Variable("_") : new Variable(list.name + "." + level));
        } else if (list instanceof Term) {
            clen = list.partlist.list.length;
            tmp = new Term(list.name, out.splice(-clen, clen));
            tmp.parent = parent;
            out.push(tmp);
        } else {
            clen = list.length;
            clen && Array.prototype.push.apply(out, out.splice(-clen, clen));
        }
    }
    
    return out;
}

BindingContext.prototype.bind = function (name, value) {    
    if (name in (this.ctx)) {// sanity check
        throw "variable " + name + " is already bound in the context!";
    }    
    this.ctx[name] = value;
    
    // to avoid for ... in which is way too slow
    this.varNames.push(name);
    this.allVarNames.push(name);
};

BindingContext.prototype.value = function value(x) {
    var queue = [x], acc = [], c, i;
    
    while (queue.length) {
        x = queue.pop();
        acc.push(x);
        if (x instanceof Term) {
            Array.prototype.push.apply(queue, x.partlist.list);
        } else if (x instanceof Variable) {
            c = this.ctx[x.name];
            
            if (c) {
                acc.pop();
                queue.push(c);
            }
        }
    }
    
    queue = acc;
    acc = [];
    i = queue.length;
    while(i--) {
        x = queue[i];
        if (x instanceof Term) {
            var c = x.partlist.list.length,
                l = acc.splice(-c, c);
            acc.push(new Term(x.name, l));
        } else acc.push(x);
    };
    
    return acc[0];
}

BindingContext.prototype.unify = function unify(x, y) {
    var toSet = {}, p, acc = [];
    
    x = this.value(x);
    y = this.value(y);
    
    var queue = [{ x: x, y: y }];
    while (queue.length) {
        p = queue.pop();
        x = p.x;
        y = p.y;
        
        if (x instanceof Term && y instanceof Term) { // no need to unwind if we are not unifying two terms
            if (x.name == y.name && x.partlist.list.length == y.partlist.list.length) {
                for (var i = 0, len = x.partlist.list.length; i < len; i++) {
                    queue.push({ x: x.partlist.list[i], y: y.partlist.list[i] });
                }
            } else {                
                return false;
            }
        } else {
            acc.push(p);
        }
    }
    
    queue = acc;
    for (var i = queue.length - 1; i >= 0; i--) {
        p = queue[i];
        x = p.x;
        y = p.y;
        
        if (x instanceof Variable) {
            x.name !== "_" && (toSet[x.name] = y);
        } else if (y instanceof Variable) {
            y.name !== "_" && (toSet[y.name] = x);
        } else if (x instanceof Atom || y instanceof Atom) {
            if (!(x instanceof Atom && y instanceof Atom && x.name == y.name)) {
                return false;
            }
        } else {
            throw "unexpected types in bind()";
            //return false; // actually throw
        }
    }
    
    // binding variables only if x indeed unifies with y
    for (var key in toSet) { // consider replacing for in with a regular for
        if (Object.prototype.hasOwnProperty.call(toSet, key)) {
            this.bind(key, toSet[key]);
        }
    }
    
    return true;
}

/**
 * removes variables from the context that are not referenced by parent context
 */
BindingContext.prototype.cutTail = function cutTail(goal) {
    var ctx = this.ctx, candidates, v, n, cutTailContext = this, parent = this.parent;
    if (parent && parent.parentCtx) {        
        cutTailContext = new BindingContext(parent);        
        candidates = varNames(goal).filter(function (name) { return name in parent.ctx; });
        
        // copy current level
        for (var i = 0, vn = this.varNames, len = vn.length; i < len; ++i) {
            n = vn[i];
            cutTailContext.ctx[n] = ctx[n];
        }
        
        // copy parents that are not in candidates
        for (var i = 0, vn = parent.varNames, len = vn.length; i < len; ++i) {
            n = vn[i];
            if (candidates.indexOf(n) === -1) {
                cutTailContext.ctx[n] = parent.ctx[n];
            }
        }

        // process links to the candidates (should be any variables linked to a variable in the same context... right?)
        for (var i = 0, vn = parent.allVarNames, len = vn.length; i < len; ++i) {
            n = vn[i];
            v = parent.parentCtx[n]; 
            if (v instanceof Variable && candidates.indexOf(v.name) !== -1) {
                cutTailContext.ctx[n] = parent.ctx[v.name];
            }
        }
    }
    return cutTailContext;
};