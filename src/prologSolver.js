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
    "cut/0" : function (loop, goals, idx, bindingContext, fbacktrack) {
        var nextgoals = goals.slice(1); // cut always succeeds
        return loop(nextgoals, 0, new BindingContext(bindingContext), function () {
            return fbacktrack && fbacktrack(2);
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
        
        var builtin = builtinPredicates[currentGoal.name + "/" + currentGoal.partlist.list.length];
        if (typeof (builtin) === "function") {
            return builtin(loop, goals, idx, currentBindingContext, fbacktrack);
        }
        
        // searching for next matching rule        
        for (var i = idx, db = cdb[currentGoal.name], dblen = db && db.length; i < dblen; i++) {
            rule = db[i];
            varMap = {};
            renamedHead = new Term(rule.head.name, currentBindingContext.renameVariables(rule.head.partlist.list, currentGoal, varMap));
            if (!currentBindingContext.unify(currentGoal, renamedHead)) {
                continue;
            }
            
            /// CURRENT BACKTRACK CONTINUATION  ///
            /// WHEN INVOKED BACKTRACKS TO THE  ///
            /// NEXT RULE IN THE PREVIOUS LEVEL ///
            var fCurrentBT = function (cut) {
                
                var b = fbacktrack;
                if (cut > 0) {
                    return fbacktrack && fbacktrack(cut - 1);
                } else {
                    return loop(goals, i + 1, parentBindingContext, fbacktrack);
                }
            };
            
            var nextGoals = goals.slice(1); // current head succeeded            
            
            
            if (rule.body != null) {
                nextGoals = currentBindingContext.renameVariables(rule.body.list, renamedHead, varMap).concat(nextGoals);
            }
            
            if (tailEnabled) {
                currentGoalVarNames = varNames([currentGoal]);
                nextGoalsVarNames = varNames(nextGoals);
                existing = nextGoalsVarNames.concat(currentGoalVarNames).map(function (e) { return e.name; });
                
                // If a new variable is not in the current goals -- remove it
                if (parentBindingContext) {
                    currentBindingContext.varNames
                        .filter(function (e) { return existing.indexOf(e) === -1 && parentBindingContext.varNames.indexOf(e) === -1; })
                        .forEach(function (e) {
                        currentBindingContext.unbind(e);
                    });
                }
            }
            
            if (rule.body != null && nextGoals.length === 1) {
                // recursive call in a tail position: reusing parent variables
                // TODO: detect it before renaming variables in goals
                if (tailEnabled && currentGoalVarNames.length === nextGoalsVarNames.length) {
                    for (var vn in varMap) {
                        for (var cn, nn, k = currentGoalVarNames.length; k--;) {
                            cn = currentGoalVarNames[k];
                            nn = nextGoalsVarNames[k];
                            if (cn.name != nn.name && varMap[vn] === nn) {
                                varMap[vn] = cn;
                                currentBindingContext.ctx[cn.name] = currentBindingContext.ctx[nn.name];
                                currentBindingContext.unbind(nn.name);
                            }
                        }
                    }
                    
                    // re-rename vars in next goals (can be optimised)
                    nextGoals = currentBindingContext.renameVariables(rule.body.list, renamedHead, varMap);
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

function termToJsValue(v) {
    if (v instanceof Atom && v.name.match(/^\d+$/)) {
        return +v.name;
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
var globalGoalCounter = 0;
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
    //if (name in (this.ctx)) {// sanity check
    //    throw "variable " + name + " is already bound in the context!";
    //}    
    this.ctx[name] = value;
    
    // to avoid for ... in which is way too slow
    this.varNames.push(name);
};

BindingContext.prototype.unbind = function (name) {
    //if (name in (this.ctx)) {// sanity check
    //    throw "variable " + name + " is already bound in the context!";
    //}    
    delete this.ctx[name];
    
    // to avoid for ... in which is way too slow
    this.varNames.splice(this.varNames.indexOf(name), 1);
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
    while (i--) {
        x = queue[i];
        if (x instanceof Term) {
            var c = x.partlist.list.length,
                l = acc.splice(-c, c);
            acc.push(new Term(x.name, l));
        } else acc.push(x);
    }    ;
    
    return acc[0];
}

BindingContext.prototype.unify = function unify(x, y) {
    var toSet = {}, p, acc = [];
    var queue = [{ x: x, y: y }];
    while (queue.length) {
        p = queue.pop();
        x = this.value(p.x);
        y = this.value(p.y);
        
        if (x instanceof Term && y instanceof Term) { // no need to unwind if we are not unifying two terms
            if (x.name == y.name && x.partlist.list.length == y.partlist.list.length) {
                for (var i = 0, len = x.partlist.list.length; i < len; i++) {
                    queue.push({ x: x.partlist.list[i], y: y.partlist.list[i] });
                }
            } else {
                return false;
            }
        } else {
            acc.push({ x: x, y: y });
        }
    }
    
    queue = acc;
    for (var i = queue.length; i--;) {
        p = queue[i];
        x = p.x;
        y = p.y;
        
        if (x instanceof Variable) {
            if (x.name === "_") { continue; }
            if (x.name in toSet && toSet[x.name].name !== y.name) {
                return false;
            }
            toSet[x.name] = y;
            
        } else if (y instanceof Variable) {
            if (y.name === "_") { continue; }
            if (y.name in toSet && toSet[y.name].name !== x.name) {
                return false;
            }
            toSet[y.name] = x;
        } else if (x instanceof Atom || y instanceof Atom) {
            if (!(x instanceof Atom && y instanceof Atom && x.name == y.name)) {
                return false;
            }
        } else {
            throw "unexpected types in bind()";
        }
    }
    
    // binding variables only if x indeed unifies with y
    // TODO: cleanup
    var varmap = {};
    for (var key in toSet) {
        if (Object.prototype.hasOwnProperty.call(toSet, key)) {
            if (toSet[key] instanceof Variable) {
                varmap[toSet[key].name] = key;
                toSet[key].name = key; // renaming variables (it's guaranteed that variable with the same name is the same instance within rule, see rename)
            }
        }
    }
    
    for (var key in toSet) { // consider replacing for in with a regular for
        if (Object.prototype.hasOwnProperty.call(toSet, key)) {
            if (!(toSet[key] instanceof Variable)) {
                this.bind(varmap[key] || key, toSet[key]);
            }
        }
    }
    
    return true;
}