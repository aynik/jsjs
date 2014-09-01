var be = require('be-async');
exports.read = function (opts, input, next) {
    return compile(opts, parse(opts, input), next)
};
var parse = exports.parse = function (opts, input) {
    return require('./parsers/' + opts.language).parse(input)
};
var compile = exports.compile = function (opts, ast, next) {
    opts = opts || {};
    opts.tab = opts.tab || -1;
    var tab = new Array(parseInt((opts.tab === -1 ? 0 : opts.tab), 10) + 1).join(' ');
    var inlineElements = {
        "GroupedExpression": 0,
        "AssignmentExpression": 0,
        "FunctionCall": 0,
        "VariableDeclaration": 0,
        "PropertyAccess": 0,
        "PropertyAssignment": 0
    };
    var notTerminatedElements = {
        "IfStatement": 0,
        "ForStatement": 0,
        "ForInStatement": 0,
        "Function": 0,
        "WhileStatement": 0,
        "DoWhileStatement": 0,
        "WithStatement": 0,
        "SwitchStatement": 0
    };
    var bracketAccess = {
        "Expression": 0,
        "Variable": 0,
        "NumericLiteral": 0,
        "PropertyAccess": 0
    };
    var ind = function (il) {
        if (!opts.tab) return '';
        else return new Array(il + 1).join(tab);
    };
    var nli = function (il) {
        if (opts.tab === -1) return '';
        else return '\n' + ind(il);
    };
    var inl = function (il) {
        if (!il) return nli(il);
        else return '';
    };
    var sp = function () {
        if (opts.compress) return '';
        else return ' ';
    };
    var ej = function (snli, osnli) {
        return function (st, el, ix, els) {
            var le = ix === els.length - 1;
            var nte = el.type in notTerminatedElements;
            return st += el + (le ? osnli : (nte ? '' : ';') + snli)
        }
    };
    var tmpl = function (il, str, dict) {
        return str.replace(/{sp}/g, sp).replace(/{(nli|inl)(\d*)}/g, function (m, f, n) {
            return ({
                "nli": nli,
                "inl": inl
            }[f])(il + parseInt(n || 0, 10))
        }).replace(/{(\w+)}/ig, function (m, k) {
            return typeof dict[k] !== 'undefined' ? dict[k] : m
        })
    };
    var Element = function (type, code) {
        if (!(this instanceof Element)) {
            return new Element(type, code)
        } else {
            this.type = type;
            this.code = code
        }
    };
    Element.prototype.toString = function () {
        return this.code
    };
    return function compile (il, par) {
        il = il || 0;
        return function (node, next) {
            var noop = function () {
                next(null, '')
            };
            var rules = {
                "Function": function () {
                    be.map(node.elements, compile(il + 1, node.type), function (err, elements) {
                        next(err, Element(node.type, tmpl(il, '{initial}function{name}({params}){sp}{{elements}}', {
                            "initial": (!(par in inlineElements) ? inl(il) : ''),
                            "name": node.name ? ' ' + node.name + sp() : sp(),
                            "params": node.params.join(',' + sp()),
                            "elements": elements.length ? tmpl(il, '{nli1}{elements}', {
                                    "elements": elements.reduce(ej(nli(il + 1), nli(il)), '')
                                }) : ''
                        })))
                    })
                },
                "FunctionCall": function () {
                    be.waterfall([function (next) {
                        compile(il, node.type)(node.name, next)
                    }, function (name, next) {
                        be.map(node.arguments, compile(il, node.type), be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }], function (err, name, args) {
                        next(err, Element(node.type, tmpl(il, '{initial}{name}({args})', {
                            "initial": (!(par in inlineElements) ? inl(il) : ''),
                            "name": name,
                            "args": args.join(',' + sp())
                        })))
                    })
                },
                "PropertyAccess": function () {
                    be.waterfall([function (next) {
                        compile(il, node.type)(node.base, next)
                    }, function (base, next) {
                        compile(il, node.type)(node.name, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }], function (err, base, name) {
                        next(err, Element(node.type, tmpl(il, (node.name.type in bracketAccess ? '{base}[{name}]' : '{base}.{name}'), {
                            "base": base,
                            "name": name
                        })))
                    })
                },
                "Variable": function () {
                    next(null, Element(node.type, node.name))
                },
                "NumericLiteral": function () {
                    next(null, Element(node.type, node.value))
                },
                "StringLiteral": function () {
                    var replaces = [['\\\\', '\\\\'], ['\\n', '\\n'], ['\\r', '\\r']];
                    next(null, Element(node.type, tmpl(il, '{quote}{str}{quote}', {
                        "quote": (node.value.indexOf("'") > -1 ? '"' : "'"),
                        "str": replaces.reduce(function (str, rep) {
                            return str.replace(new RegExp(rep[0], 'g'), rep[1])
                        }, node.value || '')
                    })))
                },
                "NullLiteral": function () {
                    next(null, Element(node.type, 'null'))
                },
                "BooleanLiteral": function () {
                    next(null, Element(node.type, node.value))
                },
                "RegularExpressionLiteral": function () {
                    next(null, Element(node.type, tmpl(il, '/{elements}/{flags}', {
                        "elements": node.elements,
                        "flags": (node.flags ? node.flags : '')
                    })))
                },
                "This": function () {
                    next(null, Element(node.type, 'this'))
                },
                "ArrayLiteral": function () {
                    be.map(node.elements, compile(il, node.type), function (err, elements) {
                        next(err, Element(node.type, tmpl(il, '[{elements}]', {
                            "elements": elements.join(',' + sp())
                        })))
                    })
                },
                "ObjectLiteral": function () {
                    be.map(node.properties, compile(il + 1, node.type), function (err, properties) {
                        next(err, Element(node.type, tmpl(il, '{{properties}}', {
                            "properties": properties.length ? tmpl(il, '{nli1}{properties}{nli}', {
                                    "properties": properties.join(',' + nli(il + 1))
                                }) : ''
                        })))
                    })
                },
                "ExpressionStatement": function () {
                    compile(il, node.type)(node.expression, function (err, expression) {
                        next(err, Element(node.type, expression))
                    })
                },
                "GroupedExpression": function () {
                    compile(il, node.type)(node.expression, function (err, expression) {
                        next(err, Element(node.type, tmpl(il, '({expression})', {
                            "expression": expression
                        })))
                    })
                },
                "PropertyAssignment": function () {
                    compile(il, node.type)(node.value, function (err, value) {
                        next(err, Element(node.type, tmpl(il, '"{name}":{sp}{value}', {
                            "name": node.name,
                            "value": value
                        })))
                    })
                },
                "GetterDefinition": function () {
                    be.map(node.elements, compile(il + 1, node.type), function (err, elements) {
                        next(err, Element(node.type, tmpl(il, 'get {name}{sp}(){sp}{{nli1}{elements}{nli}}', {
                            "name": node.name,
                            "elements": elements.reduce(ej(nli(il), ''), '')
                        })))
                    })
                },
                "SetterDefinition": function () {
                    be.map(node.elements, compile(il + 1, node.type), function (err, elements) {
                        next(err, Element(node.type, tmpl(il, 'set {name}{sp}({param}){sp}{{nli1}{elements}{nli}}', {
                            "name": node.name,
                            "param": node.param,
                            "elements": elements.reduce(ej(nli(il), ''), '')
                        })))
                    })
                },
                "NewOperator": function () {
                    be.waterfall([function (next) {
                        compile(il + 1, node.type)(node.constructor, next)
                    }, function (condition, next) {
                        be.map(node.arguments, compile(il, node.type), be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }], function (err, constructor, args) {
                        next(err, Element(node.type, tmpl(il, 'new {constructor}({args})', {
                            "constructor": constructor,
                            "args": args.join(',' + sp())
                        })))
                    })
                },
                "FunctionCallArguments": noop,
                "PropertyAccessProperty": noop,
                "PostfixExpression": function () {
                    compile(il, node.type)(node.expression, function (err, expression) {
                        next(err, Element(node.type, tmpl(il, '{expression}{operator}', {
                            "expression": expression,
                            "operator": node.operator
                        })))
                    })
                },
                "UnaryExpression": function () {
                    compile(il, node.type)(node.expression, function (err, expression) {
                        next(err, Element(node.type, tmpl(il, '{operator}{expression}', {
                            "operator": (node.operator.match(/\w+/) ? node.operator + ' ' : node.operator),
                            "expression": expression
                        })))
                    })
                },
                "ConditionalExpression": function () {
                    be.waterfall([function (next) {
                        compile(il, node.type)(node.condition, next)
                    }, function (condition, next) {
                        compile(il + 1, node.type)(node.trueExpression, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }, function (condition, trueExpression, next) {
                        compile(il + 1, node.type)(node.falseExpression, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }], function (err, condition, trueExpression, falseExpression) {
                        next(err, Element(node.type, tmpl(il, '{condition}{sp}?{sp}{trueExpression}{sp}:{sp}{falseExpression}', {
                            "condition": condition,
                            "trueExpression": trueExpression,
                            "falseExpression": falseExpression
                        })))
                    })
                },
                "AssignmentExpression": function () {
                    be.waterfall([function (next) {
                        compile(il, node.type)(node.left, next)
                    }, function (left, next) {
                        compile(il, node.type)(node.right, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }], function (err, left, right) {
                        next(err, Element(node.type, tmpl(il, '{left}{sp}{operator}{sp}{right}', {
                            "left": left,
                            "operator": node.operator,
                            "right": right
                        })))
                    })
                },
                "Block": function () {
                    be.map(node.elements, compile(il, node.type), function (err, elements) {
                        next(err, Element(node.type, elements.reduce(ej(nli(il), ''), '')))
                    })
                },
                "VariableStatement": function () {
                    be.map(node.declarations, compile(il, node.type), function (err, declarations) {
                        next(err, Element(node.type, tmpl(il, 'var {declarations}', {
                            "declarations": declarations.join(';' + nli(il) + 'var ')
                        })))
                    })
                },
                "VariableDeclaration": function () {
                    compile(il, node.type)(node.value, function (err, value) {
                        next(err, Element(node.type, tmpl(il, '{name}{value}', {
                            "name": node.name,
                            "value": tmpl(il, '{sp}={sp}{value}', {
                                "value": value
                            })
                        })))
                    })
                },
                "BinaryExpression": function () {
                    be.waterfall([function (next) {
                        compile(il, node.type)(node.left, next)
                    }, function (left, next) {
                        compile(il, node.type)(node.right, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }], function (err, left, right) {
                        next(err, Element(node.type, tmpl(il, '{left}{operator}{right}', {
                            "left": left,
                            "operator": tmpl(il, (node.operator === ',' ? '{operator}{nli}' : '{sp}{operator}{sp}'), {
                                "operator": node.operator
                            }),
                            "right": right
                        })))
                    })
                },
                "EmptyStatement": function () {
                    next(null, Element(node.type, ''))
                },
                "IfStatement": function () {
                    var ifStatementBlock = node.ifStatement && node.ifStatement.elements && node.ifStatement.elements.length;
                    var elseStatementBlock = node.elseStatement && node.elseStatement.elements && node.elseStatement.elements.length;
                    var elseIf = node.elseStatement && node.elseStatement.type === 'IfStatement';
                    be.waterfall([function (next) {
                        compile(il, node.type)(node.condition, next)
                    }, function (condition, next) {
                        compile(il, node.type)(node.ifStatement, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }, function (condition, ifStatement, next) {
                        compile(il + (!elseIf ? 1 : 0), node.type)(node.elseStatement, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }], function (err, condition, ifStatement, elseStatement) {
                        next(err, Element(node.type, tmpl(il, '{initial}if{sp}({condition}){ifStatement}{elseStatement}', {
                            "initial": (par !== 'IfStatement' ? inl(il) : ''),
                            "condition": condition,
                            "ifStatement": tmpl(il, (ifStatementBlock ? '{sp}{{nli1}{ifStatement}{nli}}' : ' {ifStatement};'), {
                                "ifStatement": ifStatement
                            }),
                            "elseStatement": elseStatement ? tmpl(il, (elseStatementBlock ? '{sp}else{sp}{{nli1}{union}{elseStatement}{nli}}' : '{initial}else {elseStatement}{separator}'), {
                                    "elseStatement": elseStatement,
                                    "initial": (ifStatementBlock ? sp() : nli(il)),
                                    "union": (elseIf || elseStatement ? '' : nli(il + 1)),
                                    "separator": (elseIf ? '' : ';')
                                }) : ''
                        })))
                    })
                },
                "DoWhileStatement": function () {
                    var statementBlock = node.statement && node.statement.elements && node.statement.elements.length;
                    be.waterfall([function (next) {
                        compile(il, node.type)(node.condition, next)
                    }, function (condition, next) {
                        compile(il, node.type)(node.statement, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }], function (err, condition, statement) {
                        next(err, Element(node.type, tmpl(il, '{initial}do{condition}{sp}while{sp}{statement}', {
                            "initial": inl(il),
                            "condition": condition,
                            "statement": tmpl(il, (statementBlock ? '{sp}{{nli1}{statement}{nli}}' : ' {statement};'), {
                                "statement": statement
                            })
                        })))
                    })
                },
                "WhileStatement": function () {
                    var statementBlock = node.statement && node.statement.elements && node.statement.elements.length;
                    be.waterfall([function (next) {
                        compile(il, node.type)(node.condition, next)
                    }, function (condition, next) {
                        compile(il, node.type)(node.statement, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }], function (err, condition, statement) {
                        next(err, Element(node.type, tmpl(il, '{initial}while{sp}({condition}){statement}', {
                            "initial": inl(il),
                            "condition": condition,
                            "statement": tmpl(il, (statementBlock ? '{sp}{{nli1}{statement}{nli}}' : ' {statement};'), {
                                "statement": statement
                            })
                        })))
                    })
                },
                "ForStatement": function () {
                    var statementBlock = node.statement && node.statement.elements && node.statement.elements.length;
                    be.waterfall([function (next) {
                        compile(il, node.type)(node.initializer, next)
                    }, function (initializer, next) {
                        compile(il, node.type)(node.test, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }, function (initializer, test, next) {
                        compile(il, node.type)(node.counter, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }, function (initializer, test, counter, next) {
                        compile(il, node.type)(node.statement, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }], function (err, initializer, test, counter, statement) {
                        next(err, Element(node.type, tmpl(il, '{initial}for{sp}({initializer};{sp}{test};{sp}{counter}){statement}', {
                            "initial": inl(il),
                            "initializer": initializer,
                            "test": test,
                            "counter": counter,
                            "statement": tmpl(il, (statementBlock ? '{sp}{{nli1}{statement}{nli}}' : ' {statement};'), {
                                "statement": statement
                            })
                        })))
                    })
                },
                "ForInStatement": function () {
                    var statementBlock = node.statement && node.statement.elements && node.statement.elements.length;
                    be.waterfall([function (next) {
                        compile(il, node.type)(node.iterator, next)
                    }, function (iterator, next) {
                        compile(il, node.type)(node.collection, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }, function (iterator, collection, next) {
                        compile(il, node.type)(node.statement, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }], function (err, iterator, collection, statement) {
                        next(err, Element(node.type, tmpl(il, '{initial}for{sp}({iterator} in {collection}){statement}', {
                            "initial": inl(il),
                            "iterator": iterator,
                            "collection": collection,
                            "statement": tmpl(il, (statementBlock ? '{sp}{{nli1}{statement}{nli}}' : ' {statement};'), {
                                "statement": statement
                            })
                        })))
                    })
                },
                "ContinueStatement": function () {
                    next(null, Element(node.type, 'continue'))
                },
                "BreakStatement": function () {
                    next(null, Element(node.type, 'break'))
                },
                "ReturnStatement": function () {
                    compile(il, node.type)(node.value, function (err, value) {
                        next(err, Element(node.type, 'return' + (value ? ' ' : '') + value))
                    })
                },
                "WithStatement": function () {
                    var statementBlock = node.statement && node.statement.elements && node.statement.elements.length;
                    be.waterfall([function (next) {
                        compile(il, node.type)(node.environment, next)
                    }, function (environment, next) {
                        compile(il, node.type)(node.statement, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }], function (err, environment, statement) {
                        next(err, Element(node.type, tmpl(il, '{initial}with{sp}({environment}){statement}', {
                            "initial": inl(il),
                            "environment": environment,
                            "statement": tmpl(il, (statementBlock ? '{sp}{{nli1}{statement}{nli}}' : ' {statement};'), {
                                "statement": statement
                            })
                        })))
                    })
                },
                "SwitchStatement": function () {
                    be.waterfall([function (next) {
                        compile(il, node.type)(node.expression, next)
                    }, function (expression, next) {
                        be.map(node.clauses, compile(il + 1, node.type), be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }], function (err, expression, clauses) {
                        next(err, Element(node.type, tmpl(il, '{initial}switch{sp}({expression}){sp}{{clauses}}', {
                            "initial": inl(il),
                            "expression": expression,
                            "clauses": clauses.length ? tmpl(il, '{nli1}{clauses}{nli1}', {
                                    "clauses": clauses
                                }) : ''
                        })))
                    })
                },
                "CaseClause": function () {
                    be.waterfall([function (next) {
                        compile(il, node.type)(node.selector, next)
                    }, function (selector, next) {
                        compile(il, node.type)(node.block, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }], function (err, selector, elements) {
                        next(err, Element(node.type, tmpl(il, 'case {selector}:{nli1}{elements}', {
                            "selector": selector || '""',
                            "elements": elements.length ? tmpl(il, '{nli1}{elements}', {
                                    "elements": elements.reduce(ej(nli(il + 1), ''), '')
                                }) : ''
                        })))
                    })
                },
                "DefaultClause": function () {
                    be.map(node.elements, compile(il, node.type), function (err, elements) {
                        next(err, Element(node.type, tmpl(il, 'default:{nli1}{elements}', {
                            "elements": elements.length ? tmpl(il, '{nli1}{elements}', {
                                    "elements": elements.reduce(ej(nli(il + 1), ''), '')
                                }) : ''
                        })))
                    })
                },
                "LabelledStatement": function () {
                    compile(il, node.type)(node.statement, function (err, statement) {
                        next(err, Element(node.type, tmpl(il, '{initial}{label}:{nli}{statement}', {
                            "initial": inl(il),
                            "label": node.label,
                            "statement": statement
                        })))
                    })
                },
                "ThrowStatement": function () {
                    compile(il, node.type)(node.exception, function (err, exception) {
                        next(err, Element(node.type, tmpl(il, 'throw {exception}', {
                            "exception": exception
                        })))
                    })
                },
                "TryStatement": function () {
                    be.waterfall([function (next) {
                        compile(il + 1, node.type)(node.block, next)
                    }, function (block, next) {
                        compile(il, node.type)(node.block, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }, function (block, catchBlock, next) {
                        compile(il, node.type)(node.block, be.curry(next, 1, 0, [].slice.call(arguments, 0, -1)))
                    }], function (err, block, catchBlock, finallyBlock) {
                        next(err, Element(node.type, tmpl(il, '{initial}try{sp}{{nli1}{block}{nli}}{catchBlock}{finallyBlock}', {
                            "initial": inl(il),
                            "block": block,
                            "catchBlock": catchBlock,
                            "finallyBlock": finallyBlock
                        })))
                    })
                },
                "Catch": function () {
                    compile(il, node.type)(node.block, function (err, block) {
                        next(err, Element(node.type, tmpl(il, '{sp}catch{sp}({identifier}){sp}{{nli1}{block}{nli}}', {
                            "identifier": node.identifier,
                            "block": block
                        })))
                    })
                },
                "Finally": function () {
                    compile(il, node.type)(node.block, function (err, block) {
                        next(err, Element(node.type, tmpl(il, '{sp}finally{sp}{{nli1}{block}{nli}}', {
                            "block": block
                        })))
                    })
                },
                "DebuggerStatement": function () {
                    next(null, Element(node.type, 'debug'))
                },
                "Program": function () {
                    be.map(node.elements, compile(il, node.type), function (err, elements) {
                        next(err, Element(node.type, elements.reduce(ej(nli(il), ''), '')))
                    })
                }
            };
            if (!node) return noop();
            if (!node.type) return next(null, Element('Identifier', node));
            if (node.type in rules) return rules[node.type]();
            else console.log('missed', node.type);
        }
    }(0, null)(ast, next)
}
