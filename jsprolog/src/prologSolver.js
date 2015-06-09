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



var env2str = function (env) {
    var r = [];
    for (key in env) {
        if (Object.prototype.hasOwnProperty.call(env, key)) {
            r.push(key + " = " + env[key]);
        }
    }
    return r.join(", ");
};

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
    
    var cont = proveexperimental(renameVariables(query.list, 0, []), db, function (environment) {
        proven = true;
        if (outVars && typeof (outVars) === "object") {
            vars.forEach(function (v) {
                var name = v.name, val = (value(new Variable(name + ".0"), environment)).toString();
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









/**
 * prints debug information to the console
 */
function trace(str, indent) {
    if (options.enableTrace && console) {
        if (indent) {
            for (; indent > 1; indent--) str = "    " + str;
        }
        console.log(str);
    }
}

/**
 *  The value of x in a given environment (non-recursive)
 */
function value(x, env) {
    var queue = [x], acc = [], c;
    
    while (queue.length) {
        x = queue.pop();
        acc.push(x);
        if (x instanceof Term) {
            Array.prototype.push.apply(queue, x.partlist.list);
        } else if (x instanceof Variable) {
            c = env[x.name];
            if (c) {
                acc.pop();
                queue.push(c);
            }
        }
    }
    
    queue = acc;
    acc = [];
    
    for (var i = queue.length - 1; i >= 0; i--) {
        x = queue[i];
        if (x instanceof Term) {
            var c = x.partlist.list.length,
                l = acc.splice(-c, c);
            acc.push(new Term(x.name, l));
        } else acc.push(x);
    }
    
    return acc[0];
}

/**
 * Creates a new environment from the old with variable n bound to z
 * @param n name of a variable
 * @param z Part to bind to a variable (Part is Atom|Term|Variable)
 * @param e old environment
 * @returns new environment
 */
function newEnv(n, z, e) {
    var ne = [];
    // original comment: 
    // We assume that n has been 'unwound' or 'followed' as far as possible
    // in the environment. If this is not the case, we could get an alias loop.
    ne[n] = z;
    
    for (var i in e) {
        if (Object.prototype.hasOwnProperty.call(e, i) && i != n) {
            ne[i] = e[i];
        }
    }
    
    return ne;
}

/**
 * Creates a new environment from the old with variable n bound to z
 * @param n name of a variable
 * @param z Part to bind to a variable (Part is Atom|Term|Variable)
 * @param e old environment
 * @returns new environment
 */
function envSlice(e, level) {
    var ne = [];
    
    
    for (var i in e) {
        if (Object.prototype.hasOwnProperty.call(e, i) && +i.split(".")[1] === level) {
            
            ne[i] = e[i];

        }
    }
    
    return ne;
}


/**
 * Removes all levels below 'level'
 */
function cloneEnv(e) {
    var ne = [];
    
    for (var i in e) {
        if (Object.prototype.hasOwnProperty.call(e, i)) {
            ne[i] = e[i];
        }
    }
    return ne;
}


/**
 * Unifies two term in a given environment, returns environment where terms unified or null if they do not unify
 * @param x first term to unify
 * @param y second term to unify
 * @param env environment for the unification
 * @returns environment with unified terms or null
 */
function unify(x, y, env) {
    x = value(x, env);
    y = value(y, env);
    
    if (x instanceof Variable) {
        return x.name === "_" ? env : newEnv(x.name, y, env); // _ unifies with anything but doesn't bind ?
    }
    
    if (y instanceof Variable) {
        return y.name === "_" ? env : newEnv(y.name, x, env); // _ unifies with anything but doesn't bind ?
    }
    
    if (x instanceof Atom || y instanceof Atom) {
        return x.type == y.type && x.name == y.name && env || null;
    }
    
    // Term
    if (x.name != y.name || x.partlist.list.length != y.partlist.list.length) {
        return null;
    }
    
    for (var i = 0; i < x.partlist.list.length && env != null; i++) {
        env = unify(x.partlist.list[i], y.partlist.list[i], env); // TODO: remove recursion
    }
    
    return env;
}

// Go through a list of terms (ie, a Body or Partlist's list) renaming variables
// by appending 'level' to each variable name.
// How non-graph-theoretical can this get?!?
// "parent" points to the subgoal, the expansion of which lead to these terms.
function renameVariables(list, level, parent) {
    var out = [], 
        queue = [],
        stack = [list],
        clen,
        tmp;
    
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

// Return a list of all variables mentioned in a list of Terms.
function varNames(list) {
    var out = [];
    
    for (var i = 0; i < list.length; i++) {
        if (list[i] instanceof Variable) {
            for (var j = 0; j < out.length; j++) {
                if (out[j].name == list[i].name) {
                    break;
                }
            }
            j === out.length && (out[out.length] = list[i]);
        } else if (list[i] instanceof Term) {
            var o2 = varNames(list[i].partlist.list); // TODO: remove recursion
            for (var j = 0; j < o2.length; j++) {
                for (var k = 0; k < out.length; k++) {
                    if (o2[j].name == out[k].name) {
                        break;
                    }
                }
                k === out.length && (out[out.length] = o2[j]);
            }
        }
    }
    return out.filter(function (e) { return e.name !== "_"; });
}

var builtinPredicates = {
    "cut/0" : function (loop, goals, idx, environment, fbacktrack, level) {
        trace('CUT/0', level);
        var nextgoals = goals.slice(1); // cut always succeeds
        return loop(nextgoals, 0, cloneEnv(environment), function () {
            return fbacktrack && fbacktrack(2); // probably still wrong... 8(
        }, level);
    },
    "fail/0": function (loop, goals, idx, environment, fbacktrack, level) {
        trace('FAIL/0', level);
        return fbacktrack; // FAIL
    },
    "call/1": function (loop, goals, idx, environment, fbacktrack, level) {
        trace('CALL/1', level);
        
        var first = value(goals[0].partlist.list[0], environment);
        if (!(first instanceof Term)) {
            return fbacktrack; // FAIL
        }
        
        var ng = goals.slice(0);
        ng[0] = first;
        first.parent = goals[0];
        
        return loop(ng, 0, environment, fbacktrack, level);
    }
};

/**
 * The main proving engine 
 * @param originalGoals original goals to prove
 * @param rulesDB prolog database to consult with
 * @param fsuccess success callback
 * @returns a function to perform next step
 */
function proveexperimental(originalGoals, rulesDB, fsuccess) {
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
    function loop(goals, idx, environment, fbacktrack, level) {
        
        if (!goals.length) {         
            trace("FOUND A SOLUTION", level);
            fsuccess(environment);
            return fbacktrack;
        }
        
        trace("goals: " + goals + " lvl: " + level, level);
        
        var goalSuffix = level;
        var currentGoal = goals[0];
        
        var builtin = builtinPredicates[currentGoal.name + "/" + currentGoal.partlist.list.length];
        if (typeof (builtin) === "function") {
            return builtin(loop, goals, idx, cloneEnv(environment), fbacktrack, level);
        }
        
        // searching for next matching rule
        for (var i = idx, db = cdb[currentGoal.name]; i < db.length; i++) {
            var rule = db[i];
            if (rule.head.name != currentGoal.name) continue;
            trace('try db[' + i + '] = ' + rule.head, level);
            var renamedHead = new Term(rule.head.name, renameVariables(rule.head.partlist.list, goalSuffix, currentGoal));
            var env2 = unify(currentGoal, renamedHead, environment);
            if (env2 == null) continue;
            // backtracking continuation
            
            /// CURRENT BACKTRACK CONTINUATION  ///
            /// WHEN INVOKED BACKTRACKS TO THE  ///
            /// NEXT RULE IN THE PREVIOUS LEVEL ///
            var fCurrentBT = function (cut) {
                
                var b = fbacktrack;
                trace("idx = " + idx, level);
                if (cut > 0) {
                    trace("cutting goals: " + goals, level);
                    return fbacktrack && fbacktrack(cut - 1);
                } else {
                    trace(idx === 0 ? "<<<" : "|||", level);
                    return loop(goals, i + 1, environment, fbacktrack, level); // ??
                }
            };
            
            if (rule.body == null) {
                var nextGoals = goals.slice(1); // automatically succeeds
                return function sameLevel() {
                    return loop(nextGoals, 0, env2, fCurrentBT, level);
                };
            } else {
                var newFirstGoals = renameVariables(rule.body.list, goalSuffix, renamedHead);
                var nextGoals = newFirstGoals.concat(goals.slice(1));
                
                if (nextGoals.length === 1) {
                    return function levelDownTail() {
                        trace("tail>>>", level);
                        
                        
                        // Tail-recursion black magic
                        // Still leaks though
                        // Living remainder to rewrite variable binding mechanism
                        if (level > 1) {
                            var env3=[], referencingVariableNames = [], v, v2;

                            for (var key in env2) {
                                if (Object.prototype.hasOwnProperty.call(env2, key)) {
                                    v = env2[key];
                                    if (v instanceof Variable && env2[v.name] instanceof Variable) {
                                        v2 = env2[v.name];
                                        //console.log("SHORT-CUTTING: " + key + "->" + v + "->" + v2 + " => " + key + " -> " + v2);
                                        env3[key] = v2;
                                    }
                                }
                            }

                            for (var key in env2) {
                                if (Object.prototype.hasOwnProperty.call(env2, key) && key.split(".")[1] == level) {
                                    //console.log("RETAINING THIS-LEVEL: " + key);
                                    env3[key] = env2[key];
                                }
                            }

                            env2 = env3;

                        }                        
                        
                        // skipping backtracking to the same level because it's the last goal
                        return loop(nextGoals, 0, env2, fbacktrack, level + 1); 
                    };
                } else {
                    return function levelDown() {
                        trace(">>>", level);
                        return loop(nextGoals, 0, env2, fCurrentBT, level + 1);
                    };
                }
            }
        }
        trace("___", level);        
        return fbacktrack;
    }    ;
    
    
    return loop(originalGoals, 0, [], null, 1);
}