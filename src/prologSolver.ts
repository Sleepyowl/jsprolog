import {Part, Variable, Atom, Term, Partlist, Rule, listOfArray} from './prologAST';


export var options = {
    maxIterations: null,
    experimental: {
        tailRecursion: false
    }
};

/**
 * executes a query agains the database
 * @param db compiled rule database
 * @param query compiled query
 * @returns iterator to iterate through results
 */
export function query(rulesDB, query) {
    var vars = varNames(query.list),
        cdb = {};
    
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

    var iterator = new Iterator();

    var cont = getdtreeiterator(query.list, cdb, function (bindingContext) {
        var result = {};
        for (var i = 0, v; v = vars[i++];) {
            result[v.name] = termToJsValue(bindingContext.value(v));
        }
        iterator.current = result;
    });


    Iterator.prototype.next = function () {
        var i = 0;
        this.current = null;
        while (cont != null && !this.current) {
            cont = cont();
            if (typeof (options.maxIterations) === "number" && options.maxIterations <= ++i) {
                throw "iteration limit reached";
            }
        }

        return !!this.current;
    };

    return iterator;
    function Iterator() { }
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
    "!/0": function (loop, goals, idx, bindingContext, fbacktrack) {
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
        (first as any).parent = goals[0];

        return loop(ng, 0, bindingContext, fbacktrack);
    },
    "=/2": function (loop, goals, idx, bindingContext, fbacktrack) {
        var ctx = new BindingContext(bindingContext);
        if (ctx.unify(goals[0].partlist.list[0], goals[0].partlist.list[1])) {
            return loop(goals.slice(1), 0, ctx, fbacktrack);
        } else {
            return fbacktrack; // FAIL
        }
    },
    "findall/3": function (loop, goals, idx, bindingContext, fbacktrack, db) { // TODO: refactor rule db passing
        var args = goals[0].partlist.list,
            results = [];

        return getdtreeiterator([args[1]], db, collect, bindingContext, report);
        function collect(ctx) {
            results.push(ctx.value(args[0]));
        }
        function report() {
            var result = listOfArray(results);
            if (bindingContext.unify(args[2], result)) {
                return loop(goals.slice(1), 0, bindingContext, fbacktrack);
            } else {
                return fbacktrack;
            }
        }
    },
    "is/2": function (loop, goals, idx, bindingContext, fbacktrack) {
        var args = goals[0].partlist.list,
            expression = bindingContext.value(args[1]),
            ctx = new BindingContext(bindingContext);

        if (varNames([expression]).length) {
            return fbacktrack; // TODO: prolog exception "ERROR: is/2: Arguments are not sufficiently instantiated"
        }
        
        // build evaluation queue:
        var queue = [expression], acc = [], c, i, x, l;

        while (queue.length) {
            x = queue.pop();
            acc.push(x);
            if (x instanceof Term) {
                Array.prototype.push.apply(queue, x.partlist.list);
            }
        }
        
        // evaluate
        queue = acc;
        acc = [];
        i = queue.length;
        while (i--) {
            x = queue[i];
            if (x instanceof Term) {
                c = x.partlist.list.length;
                l = acc.splice(-c, c);

                switch (x.name) {
                    case "+":
                        acc.push(l[0] + l[1]);
                        break;
                    case "-":
                        acc.push(l[0] - l[1]);
                        break;
                    case "*":
                        acc.push(l[0] * l[1]);
                        break;
                    case "/":
                        acc.push(l[0] / l[1]);
                        break;
                    default:
                        return fbacktrack;// TODO: prolog exception "ERROR: is/2: Arithmetic: `{x.name}' is not a function"
                }
            } else {
                if (typeof (x.name) === "number") {
                    acc.push(x.name);
                } else {
                    // TODO: handle functions like pi e etc
                    return fbacktrack;
                }
            }
        }

        if (ctx.unify(args[0], new Atom(acc[0]))) {
            return loop(goals.slice(1), 0, ctx, fbacktrack);
        } else {
            return fbacktrack;
        }

    }
};

/**
 * The main proving engine 
 * @param originalGoals original goals to prove
 * @param rulesDB prolog database to consult with
 * @param fsuccess success callback
 * @returns a function to perform next step
 */
function getdtreeiterator(originalGoals, rulesDB, fsuccess, rootBindingContext?, rootBacktrack?) {
    "use strict";
    var tailEnabled = options.experimental.tailRecursion;
    return function () { return loop(originalGoals, 0, rootBindingContext || null, rootBacktrack || null); };

    // main loop continuation
    function loop(goals, idx, parentBindingContext, fbacktrack) {

        if (!goals.length) {
            fsuccess(parentBindingContext);
            return fbacktrack;
        }

        var currentGoal = goals[0],
            currentBindingContext = new BindingContext(parentBindingContext),
            currentGoalVarNames, rule, varMap, renamedHead, nextGoalsVarNames, existing;
        
        // TODO: add support for builtins with variable arity (like call/2+)
        var builtin = builtinPredicates[currentGoal.name + "/" + currentGoal.partlist.list.length];
        if (typeof (builtin) === "function") {
            return builtin(loop, goals, idx, currentBindingContext, fbacktrack, rulesDB);
        }
        
        // searching for next matching rule        
        for (var i = idx, db = rulesDB[currentGoal.name], dblen = db && db.length; i < dblen; i++) {
            rule = db[i];
            varMap = {};
            renamedHead = new Term(rule.head.name, currentBindingContext.renameVariables(rule.head.partlist.list, currentGoal, varMap));
            renamedHead.parent = currentGoal.parent;
            if (!currentBindingContext.unify(currentGoal, renamedHead)) {
                continue;
            }

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
                /// CURRENT BACKTRACK CONTINUATION  ///
                /// WHEN INVOKED BACKTRACKS TO THE  ///
                /// NEXT RULE IN THE PREVIOUS LEVEL ///
                var fCurrentBT = function (cut, parent) {
                    if (cut) {
                        return fbacktrack && fbacktrack(parent.parent !== goals[0].parent, parent);
                    } else {
                        return loop(goals, i + 1, parentBindingContext, fbacktrack);
                    }
                };
                return function levelDown() {
                    return loop(nextGoals, 0, currentBindingContext, fCurrentBT);
                };
            }

        }
        return fbacktrack;
    }
};

/**
 * helper function to convert terms to result values returned by query function
 */
function termToJsValue(v) {
    if (v instanceof Atom) {
        return v === Atom.Nil ? [] : v.name;
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
    this.ctx = Object.create(parent && parent.ctx || {});
}

/**
 * fine-print the context (for debugging purposes)
 * ! SLOW because of for-in
 */
BindingContext.prototype.toString = function toString() {
    var r = [], p = [];
    for (var key in this.ctx) {
        Array.prototype.push.call(
            Object.prototype.hasOwnProperty.call(this.ctx, key) ? r : p,
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
};

/**
 * Binds variable to a value in the context
 * @param name name of the variable to bind
 * @param value value to bind to the variable
 */
BindingContext.prototype.bind = function (name, value) {
    this.ctx[name] = value;
};

/**
 * Unbinds variable in the CURRENT context
 * Variable remains bound in parent contexts 
 * and might be resolved though proto chain
 * @param name variable name to unbind
 */
BindingContext.prototype.unbind = function (name) {
    delete this.ctx[name];
};

/**
 * Gets the value of the term, recursively replacing variables with bound values
 * @param x term to calculate value for
 * @returns value of term x
 */
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
    while (i--) {
        x = queue[i];
        if (x instanceof Term) {
            c = x.partlist.list.length;
            acc.push(new Term(x.name, acc.splice(-c, c)));
        } else acc.push(x);
    }

    return acc[0];
};

/**
 * Unifies terms x and y, renaming and binding variables in process
 * !! mutates variable names (altering x, y and varMap in main loop)
 * @returns true if terms unify, false otherwise
 */
BindingContext.prototype.unify = function unify(x, y) {
    var toSetNames = [],
        toSet = {},
        acc = [],
        queue = [this.value(x), this.value(y)],
        xpl,
        ypl,
        i,
        len;

    while (queue.length) {
        x = queue.pop();
        y = queue.pop();

        if (x instanceof Term && y instanceof Term) { // no need to expand if we are not unifying two terms
            xpl = x.partlist.list;
            ypl = y.partlist.list;
            if (x.name == y.name && xpl.length == ypl.length) {
                for (i = 0, len = xpl.length; i < len; i++) {
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
    var varmap = {}, key;
    for (i = 0; key = toSetNames[i++];) {
        if (toSet[key] instanceof Variable) {
            varmap[toSet[key].name] = key;
            toSet[key].name = key;
        }
    }
    
    // bind values to variables (minding renames)
    for (i = 0; key = toSetNames[i++];) {
        if (!(toSet[key] instanceof Variable)) {
            this.bind(varmap[key] || key, toSet[key]);
        }
    }

    return true;
};
