var AST = require('./prologAST');

var Part = AST.Part;
var Variable = AST.Variable;
var Atom = AST.Atom;
var Term = AST.Term;
var Partlist = AST.Partlist;
var Body = AST.Body;
var Rule = AST.Rule;


var options = {
    maxIterations: null,
    experimental: {
        tailRecursion: false
    }
};

exports.options = options;

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
    
    var cont = getdtreeiterator(query.list, db, function (result) {
        proven = true;
        if (outVars && typeof (outVars) === "object") {
            vars.forEach(function (v) {
                v = v.name;
                if (!(v in outVars)) {
                    outVars[v] = [];
                }
                outVars[v].push(result[v]);
            });
        }
    });
    
    var i = 0;
    while (cont != null) {
        cont = cont();
        if (typeof (options.maxIterations) === "number" && options.maxIterations <= ++i) {
            throw "iteration limit reached";
        }
    }
    
    return proven;
};

/** 
 * Get a list of all variables mentioned in a list of Terms.
 */
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
    "cut/0" : function (loop, goals, idx, bindingContext, fbacktrack) {
        var nextgoals = goals.slice(1); // cut always succeeds
        return loop(nextgoals, 0, new BindingContext(bindingContext), function () {
            return fbacktrack && fbacktrack(true, goals[0].parent);
        });
    },
    "fail/0": function (loop, goals, idx, bindingContext, fbacktrack) {
        return fbacktrack; // FAIL
    },
    "call/1": function (loop, goals, idx, bindingContext, fbacktrack) {
        var first = bindingContext.value(goals[0].partlist.list[0]);
        if (!(first instanceof Term)) {
            return fbacktrack; // FAIL
        }
        
        var ng = goals.slice(0);
        ng[0] = first;
        first.parent = goals[0];
        
        return loop(ng, 0, bindingContext, fbacktrack);
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
    var cdb = {}, tailEnabled = options.experimental.tailRecursion;
    
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
    function loop(goals, idx, parentBindingContext, fbacktrack) {
        
        if (!goals.length) {
            fsuccess(parentBindingContext);
            return fbacktrack;
        }
        
        var currentGoal = goals[0],
            currentBindingContext = new BindingContext(parentBindingContext),
            currentGoalVarNames, rule, varMap, renamedHead, currentGoalVarNames, nextGoalsVarNames, existing;
        
        // TODO: add support for builtins with variable arity (like call/2+)
        var builtin = builtinPredicates[currentGoal.name + "/" + currentGoal.partlist.list.length];
        if (typeof (builtin) === "function") {
            return builtin(loop, goals, idx, currentBindingContext, fbacktrack);
        }
        
        // searching for next matching rule        
        for (var i = idx, db = cdb[currentGoal.name], dblen = db && db.length; i < dblen; i++) {
            rule = db[i];
            varMap = {};
            renamedHead = new Term(rule.head.name, currentBindingContext.renameVariables(rule.head.partlist.list, currentGoal, varMap));
            renamedHead.parent = currentGoal.parent;
            if (!currentBindingContext.unify(currentGoal, renamedHead)) {
                continue;
            }
            
            /// CURRENT BACKTRACK CONTINUATION  ///
            /// WHEN INVOKED BACKTRACKS TO THE  ///
            /// NEXT RULE IN THE PREVIOUS LEVEL ///
            var fCurrentBT = function (cut, parent) {
                
                var b = fbacktrack;
                if (cut) {
                    return fbacktrack && fbacktrack(parent.parent !== goals[0].parent, parent);
                } else {
                    return loop(goals, i + 1, parentBindingContext, fbacktrack);
                }
            };
            
            var nextGoals = goals.slice(1); // current head succeeded            
            
            
            if (rule.body != null) {
                nextGoals = currentBindingContext.renameVariables(rule.body.list, renamedHead, varMap).concat(nextGoals);
            }
            
            // TODO: remove 'free' variables (need to check values as well)
            
            if (rule.body != null && nextGoals.length === 1) {
                // call in a tail position: reusing parent variables                
                // prevents context groth in some recursive scenarios
                if (tailEnabled) {
                    currentGoalVarNames = varNames([currentGoal]);
                    nextGoalsVarNames = varNames(nextGoals);
                    existing = nextGoalsVarNames.concat(currentGoalVarNames).map(function (e) { return e.name; });
                    
                    if (currentGoalVarNames.length === nextGoalsVarNames.length) {
                        for (var vn in varMap) {
                            for (var cv, cn, nn, k = currentGoalVarNames.length; k--;) {
                                cn = currentGoalVarNames[k];
                                nn = nextGoalsVarNames[k];
                                cv = currentBindingContext.value(cn);
                                
                                if (cn.name != nn.name && varMap[vn] === nn) {
                                    // do not short-cut if cn's value references nn
                                    // TODO: probably need to check other variables
                                    if (cv && varNames([cv]).indexOf(nn) !== -1) {
                                        continue;
                                    }
                                    varMap[vn] = cn;
                                    currentBindingContext.ctx[cn.name] = currentBindingContext.ctx[nn.name];
                                    currentBindingContext.unbind(nn.name);
                                }
                            }
                        }
                        
                        // re-rename vars in next goals (can be optimised)
                        nextGoals = currentBindingContext.renameVariables(rule.body.list, renamedHead, varMap);
                    }
                }
                
                return function levelDownTail() {
                    // skipping backtracking to the same level because it's the last goal                        
                    // TODO: removing extra stuff from binding context                                                
                    return loop(nextGoals, 0, currentBindingContext, fbacktrack);
                };
            } else {
                return function levelDown() {
                    return loop(nextGoals, 0, currentBindingContext, fCurrentBT);
                };
            }
            
        }
        return fbacktrack;
    }    ;
    
    var rootContext = new BindingContext();
    var map = {};
    var _fs = fsuccess;
    fsuccess = function (bindingContext) {
        var result = {};
        for (var key in map) {
            result[key] = termToJsValue(bindingContext.value(map[key]));
        }
        _fs(result);
    };
    return loop(rootContext.renameVariables(originalGoals, null, map), 0, null, null);
};

/**
 * helper function to convert terms to result values returned by query function
 */
function termToJsValue(v) {
    if (v instanceof Atom) {
        return v.name;
    }
    
    if (v instanceof Term && v.name === "cons") {
        var t = [];
        while (v.partlist && v.name !== "nil") { // we're not expecting malformed lists...
            t.push(termToJsValue(v.partlist.list[0]));
            v = v.partlist.list[1];
        }
        return t;
    }
    
    return v.toString();
}


/**
 * creates binding context for variables
 */
function BindingContext(parent) {
    var ctx = this.ctx = {};
    
    this.varNames = parent && parent.varNames.slice(0) || []; // to avoid for(in) which is way too slow
    if (parent) {
        for (var n, vn = parent.varNames, i = vn.length; i--;) {
            n = vn[i];
            ctx[n] = parent.ctx[n];
        }
    }
}

/**
 * fine-print the context (for debugging purposes)
 * ! SLOW because of for-in
 */
BindingContext.prototype.toString = function toString() {
    var r = [], p = [];
    for (key in this.ctx) {
        Array.prototype.push.call(
            Object.prototype.hasOwnProperty.call(this.ctx, key) ? r :p,
            key + " = " + this.ctx[key]);
    }
    return r.join(", ") + " || " + p.join(", ");
};

var globalGoalCounter = 0;

/**
 * renames variables to make sure names are unique
 * @param list list of terms to rename
 * @param parent parent term (parent is used in cut)
 * @param varMap (out) map of variable mappings, used to make sure that both head and body have same names
 * @returns new term with renamed variables
 */
BindingContext.prototype.renameVariables = function renameVariables(list, parent, varMap) {
    var out = [], 
        queue = [],
        stack = [list],
        clen,
        tmp,
        level = this.level,
        v;
    
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
    var vars = varMap || {}, _ = new Variable("_");
    for (var i = queue.length - 1; i >= 0; i--) {
        list = queue[i];
        if (list instanceof Atom) {
            out.push(list);
        } else if (list instanceof Variable) {
            if (list.name === "_") {
                v = _;
            } else {
                v = vars[list.name] || (vars[list.name] = new Variable("_G" + (globalGoalCounter++)));
            }
            out.push(v);
        } else if (list instanceof Term) {
            clen = list.partlist.list.length;
            tmp = new Term(list.name, out.splice(-clen, clen));
            for (var pl = tmp.partlist.list, k = pl.length; k--;) {
                if (pl[k] instanceof Term) {
                    pl[k].parent = tmp;
                }
            }
            tmp.parent = parent;
            out.push(tmp);
        } else {
            clen = list.length;
            clen && Array.prototype.push.apply(out, out.splice(-clen, clen));
        }
    }
    
    return out;
}

/**
 * Binds variable to a value in the context
 * @param name name of the variable to bind
 * @param value value to bind to the variable
 */
BindingContext.prototype.bind = function (name, value) {
    this.ctx[name] = value;
    this.varNames.push(name);
};

/**
 * Unbinds variable in the context
 * @param name variable name to unbind
 */
BindingContext.prototype.unbind = function (name) {
    delete this.ctx[name];
    this.varNames.splice(this.varNames.indexOf(name), 1);
};

/**
 * Gets the value of the term, recursively replacing variables with bound values
 * @param x term to calculate value for
 * @returns value of term x
 */
BindingContext.prototype.value = function value(x) {
    var queue = [x], acc = [], c, i, l;
    
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
    while (i--) {
        x = queue[i];
        if (x instanceof Term) {
            c = x.partlist.list.length;            
            acc.push(new Term(x.name, acc.splice(-c, c)));
        } else acc.push(x);
    }    
    
    return acc[0];
}

/**
 * Unifies terms x and y, renaming and binding variables in process
 * !! mutates variable names (altering x, y and varMap in main loop)
 * @returns true if terms unify, false otherwise
 */
BindingContext.prototype.unify = function unify(x, y) {    
    var toSetNames = [],
        toSet = {}, 
        acc = [], 
        queue = [x, y], 
        xpl, 
        ypl,
        i;
    
    while (queue.length) {
        x = this.value(queue.pop());
        y = this.value(queue.pop());
        
        if (x instanceof Term && y instanceof Term) { // no need to expand if we are not unifying two terms
            xpl = x.partlist.list;
            ypl = y.partlist.list;
            if (x.name == y.name && xpl.length == ypl.length) {
                for (var i = 0, len = xpl.length; i < len; i++) {
                    queue.push(xpl[i], ypl[i]);
                }
            } else {
                return false;
            }
        } else {
            if ((x instanceof Atom || y instanceof Atom) && !(x instanceof Variable || y instanceof Variable)) {
                if (!(x instanceof Atom && y instanceof Atom && x.name == y.name)) {
                    return false;
                }
            }
            acc.push(x, y);
        }
    }
        
    i = acc.length;
    while (i) {
        y = acc[--i];
        x = acc[--i];
        
        if (x instanceof Variable) {
            if (x.name === "_") { continue; }
            if (toSetNames.indexOf(x.name) === -1) {
                toSetNames.push(x.name);
            } else if (toSet[x.name].name !== y.name) {
                return false;
            }
            toSet[x.name] = y;
            
        } else if (y instanceof Variable) {
            if (y.name === "_") { continue; }
            if (toSetNames.indexOf(y.name) === -1) {
                toSetNames.push(y.name);
            } else if (toSet[y.name].name !== x.name) {
                return false;
            }
            toSet[y.name] = x;
        }
    }
        
    // renaming unified variables
    // it's guaranteed that variable with the same name is the same instance within rule, see renameVariables()
    var varmap = {};
    for (var i = 0, key; key = toSetNames[i++];) {
        if (toSet[key] instanceof Variable) {
            varmap[toSet[key].name] = key;            
            toSet[key].name = key; 
        }
    }
    
    // bind values to variables (minding renames)
    for (var i = 0, key; key = toSetNames[i++];) {
        if (!(toSet[key] instanceof Variable)) {
            this.bind(varmap[key] || key, toSet[key]);
        }
    }
    
    return true;
}