exports.read = function(opts, input) {
    return compile(opts, parse(input))
};
var parse = exports.parse = require('./parser').parse;
var compile = exports.compile = function(opts, ast) {
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
    var ind = function(il) {
        if (!opts.tab) return '';
        else return new Array(il + 1).join(tab);
    };
    var nli = function(il) {
        if (opts.tab === -1) return '';
        else return '\n' + ind(il);
    };
    var inl = function(il) {
        if (!il) return nli(il);
        else return '';
    };
    var sp = function() {
        if (opts.compress) return '';
        else return ' ';
    };
    var ej = function(snli, osnli) {
        return function(st, el, ix, els) {
            var le = ix === els.length - 1;
            var nte = el.type in notTerminatedElements;
            return st += el + (le ? osnli : (nte ? '' : ';') + snli)
        }
    };
    var format = function(il, str, dict) {
        return str.replace(/{sp}/g, sp).replace(/{(nli|inl)(\d*)}/g, function(m, f, n) {
            return ({
                "nli": nli,
                "inl": inl
            }[f])(il + parseInt(n || 0, 10))
        }).replace(/{(\w+)}/ig, function(m, k) {
            return typeof dict[k] !== 'undefined' ? dict[k] : m
        })
    };
    var noop = function() {
        return ''
    };
    var Element = function(type, code) {
        this.type = type;
        this.code = code
    };
    Element.prototype.toString = function() {
        return this.code
    };
    return function compile(il, par) {
        il = il || 0;
        return function(node) {
            var rules = {
                "Function": function() {
                    return new Element(node.type, format(il, '{initial}function{name}({args}){sp}{{elements}}', {
                        "initial": (!(par in inlineElements) ? inl(il) : ''),
                        "name": (node.name ? ' ' + node.name : ''),
                        "args": (node.params && node.params.length ? node.params.join(',' + sp()) : ''),
                        "elements": (node.elements && node.elements.length ? nli(il + 1) + node.elements.map(compile(il + 1, node.type)).reduce(ej(nli(il + 1), nli(il)), '') : '')
                    }))
                },
                "FunctionCall": function() {
                    return new Element(node.type, format(il, '{initial}{name}({args})', {
                        "initial": (!(par in inlineElements) ? inl(il) : ''),
                        "name": (node.name ? (node.name.type ? compile(il, node.type)(node.name) : node.name) : ''),
                        "args": (node.arguments ? (node.arguments.length ? node.arguments.map(compile(il, node.type)) : []) : []).join(',' + sp())
                    }))
                },
                "PropertyAccess": function() {
                    return new Element(node.type, format(il, (node.name.type in bracketAccess ? '{base}[{name}]' : '{base}.{name}'), {
                        "base": (node.base ? compile(il, node.type)(node.base) : ''),
                        "name": (node.name ? (node.name.type ? compile(il, node.type)(node.name) : node.name) : '')
                    }))
                },
                "Variable": function() {
                    return new Element(node.type, node.name)
                },
                "NumericLiteral": function() {
                    return new Element(node.type, node.value)
                },
                "StringLiteral": function() {
                    var replaces = [['\\\\', '\\\\'], ['\\n', '\\n'], ['\\r', '\\r']];
                    return new Element(node.type, format(il, '{quote}{str}{quote}', {
                        "quote": (node.value.indexOf("'") > -1 ? '"' : "'"),
                        "str": replaces.reduce(function(str, rep) {
                            return str.replace(new RegExp(rep[0], 'g'), rep[1])
                        }, node.value || '')
                    }))
                },
                "NullLiteral": function() {
                    return new Element(node.type, 'null')
                },
                "BooleanLiteral": function() {
                    return new Element(node.type, node.value)
                },
                "RegularExpressionLiteral": function() {
                    return new Element(node.type, format(il, '/{body}/{flags}', {
                        "body": node.body,
                        "flags": (node.flags ? node.flags : '')
                    }))
                },
                "This": function() {
                    return new Element(node.type, 'this')
                },
                "ArrayLiteral": function() {
                    return new Element(node.type, format(il, '[{elements}]', {
                        "elements": (node.elements ? (node.elements.length ? node.elements.map(compile(il + 1, node.type)) : []) : []).join(',' + sp())
                    }))
                },
                "ObjectLiteral": function() {
                    return new Element(node.type, format(il, '{{properties}}', {
                        "properties": (node.properties && node.properties.length ? format(il, '{nli1}{properties}{nli}', {
                                "properties": node.properties.map(compile(il + 1, node.type)).join(',' + nli(il + 1))
                            }) : '')
                    }))
                },
                "GroupedExpression": function() {
                    return new Element(node.type, format(il, '({expression})', {
                        "expression": (node.expression ? compile(il, node.type)(node.expression) : '')
                    }))
                },
                "PropertyAssignment": function() {
                    return new Element(node.type, format(il, '"{name}":{sp}{value}', {
                        "name": node.name,
                        "value": (node.value ? compile(il, node.type)(node.value) : 'undefined')
                    }))
                },
                "GetterDefinition": function() {
                    return new Element(node.type, format(il, 'get {name}{sp}(){sp}{{nli1}{body}{nli}}', {
                        "name": node.name,
                        "body": (node.body ? (node.body.length ? node.body.map(compile(il + 1, node.type)) : []) : []).reduce(ej(nli(il), ''), '')
                    }))
                },
                "SetterDefinition": function() {
                    return new Element(node.type, format(il, 'set {name}{sp}({param}){sp}{{nli1}{body}{nli}}', {
                        "name": node.name,
                        "param": node.param,
                        "body": (node.body ? (node.body.length ? node.body.map(compile(il + 1, node.type)) : []) : [])
                    }))
                },
                "NewOperator": function() {
                    return new Element(node.type, format(il, 'new {constructor}({args})', {
                        "constructor": (node.constructor ? (node.constructor.type ? compile(il + 1, node.type)(node.constructor) : node.constructor) : ''),
                        "args": (node.arguments ? (node.arguments.length ? node.arguments.map(compile(il, node.type)) : []) : []).join(',' + sp())
                    }))
                },
                "FunctionCallArguments": noop,
                "PropertyAccessProperty": noop,
                "PostfixExpression": function() {
                    return new Element(node.type, format(il, '{expression}{operator}', {
                        "expression": (node.expression ? compile(il, node.type)(node.expression) : ''),
                        "operator": node.operator
                    }))
                },
                "UnaryExpression": function() {
                    return new Element(node.type, format(il, '{operator}{expression}', {
                        "operator": (node.operator.match(/\w+/) ? node.operator + ' ' : node.operator),
                        "expression": (node.expression ? compile(il, node.type)(node.expression) : '')
                    }))
                },
                "ConditionalExpression": function() {
                    return new Element(node.type, format(il, '{condition}{sp}?{sp}{trueExpression}{sp}:{sp}{falseExpression}', {
                        "condition": (node.condition ? (node.condition.type ? compile(il, node.type)(node.condition) : node.condition) : ''),
                        "trueExpression": (node.trueExpression ? (node.trueExpression.type ? compile(il + 1, node.type)(node.trueExpression) : node.trueExpression) : ''),
                        "falseExpression": (node.falseExpression ? (node.falseExpression.type ? compile(il + 1, node.type)(node.falseExpression) : node.falseExpression) : '')
                    }))
                },
                "AssignmentExpression": function() {
                    return new Element(node.type, format(il, '{left}{sp}{operator}{sp}{right}', {
                        "left": (node.left ? compile(il, node.type)(node.left) : 'undefined'),
                        "operator": node.operator,
                        "right": (node.right ? compile(il, node.type)(node.right) : 'undefined')
                    }))
                },
                "Block": function() {
                    var statements = (node.statements ? (node.statements.length ? node.statements.map(compile(il, node.type)) : []) : []);
                    return new Element(node.type, statements.reduce(ej(nli(il), ''), ''))
                },
                "VariableStatement": function() {
                    return new Element(node.type, format(il, 'var {declarations}', {
                        "declarations": (node.declarations ? (node.declarations.length ? node.declarations.map(compile(il, node.type)) : []) : []).join(';' + nli(il) + 'var ')
                    }))
                },
                "VariableDeclaration": function() {
                    return new Element(node.type, format(il, '{name}{value}', {
                        "name": node.name,
                        "value": (node.value ? format(il, '{sp}={sp}{value}', {
                                "value": compile(il, node.type)(node.value)
                            }) : '')
                    }))
                },
                "BinaryExpression": function() {
                    return new Element(node.type, format(il, '{left}{operator}{right}', {
                        "left": (node.left ? compile(il, node.type)(node.left) : ''),
                        "operator": format(il, (node.operator === ',' ? '{operator}{nli}' : '{sp}{operator}{sp}'), {
                            "operator": node.operator
                        }),
                        "right": (node.right ? compile(il, node.type)(node.right) : '')
                    }))
                },
                "EmptyStatement": function() {
                    return new Element(node.type, '')
                },
                "IfStatement": function() {
                    var ifStatementBlock = node.ifStatement && node.ifStatement.statements && node.ifStatement.statements.length;
                    var elseStatementBlock = node.elseStatement && node.elseStatement.statements && node.elseStatement.statements.length;
                    var elseIf = node.elseStatement && node.elseStatement.type === 'IfStatement';
                    return new Element(node.type, format(il, '{initial}if{sp}({condition}){ifStatement}{elseStatement}', {
                        "initial": (par !== 'IfStatement' ? inl(il) : ''),
                        "condition": (node.condition ? compile(il, node.type)(node.condition) : ''),
                        "ifStatement": (node.ifStatement ? format(il, (ifStatementBlock ? '{sp}{{nli1}{ifStatement}{nli}}' : ' {ifStatement};'), {
                                "ifStatement": compile(il + 1, node.type)(node.ifStatement)
                            }) : ''),
                        "elseStatement": (node.elseStatement ? format(il, (elseStatementBlock ? '{sp}else{sp}{{nli1}{union}{elseStatement}{nli}}' : '{initial}else {elseStatement}{separator}'), {
                                "elseStatement": compile(il + (!elseIf ? 1 : 0), node.type)(node.elseStatement),
                                "initial": (ifStatementBlock ? sp() : nli(il)),
                                "union": (elseIf || node.elseStatement.type ? '' : nli(il + 1)),
                                "separator": (elseIf ? '' : ';')
                            }) : '')
                    }))
                },
                "DoWhileStatement": function() {
                    var statementBlock = node.statement && node.statement.statements && node.statement.statements.length;
                    return new Element(node.type, format(il, '{initial}do{condition}{sp}while{sp}{statement}', {
                        "initial": inl(il),
                        "condition": (node.condition ? compile(il, node.type)(node.condition) : ''),
                        "statement": (node.statement ? format(il, (statementBlock ? '{sp}{{nli1}{statement}{nli}}' : ' {statement};'), {
                                "statement": compile(il + 1, node.type)(node.statement)
                            }) : '')
                    }))
                },
                "WhileStatement": function() {
                    var statementBlock = node.statement && node.statement.statements && node.statement.statements.length;
                    return new Element(node.type, format(il, '{initial}while{sp}({condition}){statement}', {
                        "initial": inl(il),
                        "condition": (node.condition ? compile(il, node.type)(node.condition) : ''),
                        "statement": (node.statement ? format(il, (statementBlock ? '{sp}{{nli1}{statement}{nli}}' : ' {statement};'), {
                                "statement": compile(il + 1, node.type)(node.statement)
                            }) : '')
                    }))
                },
                "ForStatement": function() {
                    var statementBlock = node.statement && node.statement.statements && node.statement.statements.length;
                    return new Element(node.type, format(il, '{initial}for{sp}({initializer};{sp}{test};{sp}{counter}){statement}', {
                        "initial": inl(il),
                        "initializer": (node.initializer ? compile(il, node.type)(node.initializer) : ''),
                        "test": (node.test ? compile(il, node.type)(node.test) : ''),
                        "counter": (node.counter ? compile(il, node.type)(node.counter) : ''),
                        "statement": (node.statement ? format(il, (statementBlock ? '{sp}{{nli1}{statement}{nli}}' : ' {statement};'), {
                                "statement": compile(il + 1, node.type)(node.statement)
                            }) : '')
                    }))
                },
                "ForInStatement": function() {
                    var statementBlock = node.statement && node.statement.statements && node.statement.statements.length;
                    return new Element(node.type, format(il, '{initial}for{sp}({iterator} in {collection}){statement}', {
                        "initial": inl(il),
                        "iterator": (node.iterator ? (node.iterator.type ? compile(il, node.type)(node.iterator) : node.iterator) : ''),
                        "collection": (node.collection ? compile(il, node.type)(node.collection) : ''),
                        "statement": (node.statement ? format(il, (statementBlock ? '{sp}{{nli1}{statement}{nli}}' : ' {statement};'), {
                                "statement": compile(il + 1, node.type)(node.statement)
                            }) : '')
                    }))
                },
                "ContinueStatement": function() {
                    return new Element(node.type, 'continue')
                },
                "BreakStatement": function() {
                    return new Element(node.type, 'break')
                },
                "ReturnStatement": function() {
                    var value = (node.value ? (node.value.type ? compile(il, node.type)(node.value) : node.value) : '');
                    return new Element(node.type, 'return' + (value ? ' ' : '') + value)
                },
                "WithStatement": function() {
                    var statementBlock = node.statement && node.statement.statements && node.statement.statements.length;
                    return new Element(node.type, format(il, '{initial}with{sp}({environment}){statement}', {
                        "initial": inl(il),
                        "environment": (node.environment ? compile(il, node.type)(node.environment) : ''),
                        "statement": (node.statement ? format(il, (statementBlock ? '{sp}{{nli1}{statement}{nli}}' : ' {statement};'), {
                                "statement": compile(il + 1, node.type)(node.statement)
                            }) : '')
                    }))
                },
                "SwitchStatement": function() {
                    return new Element(node.type, format(il, '{initial}switch{sp}({expression}){sp}{{clauses}}', {
                        "initial": inl(il),
                        "expression": (node.expression ? (node.expression.type ? compile(il, node.type)(node.expression) : node.expression) : ''),
                        "clauses": (node.clauses && node.clauses.length ? format(il, '{nl1}{clauses}{nl1}', {
                                "clauses": node.clauses.map(compile(il + 1, node.type))
                            }) : '')
                    }))
                },
                "CaseClause": function() {
                    return new Element(node.type, format(il, 'case {selector}:{nli1}{statements}', {
                        "selector": (node.selector ? (node.selector.type ? compile(il, node.type)(node.selector) : node.selector) : '""'),
                        "statements": (node.statements && node.statements.length ? format(il, '{nl1}{statements}', {
                                "statements": node.statements.map(compile(il + 1, node.type)).join(';' + nli(il + 1))
                            }) : '')
                    }))
                },
                "DefaultClause": function() {
                    return new Element(node.type, format(il, 'default:{nli1}{statements}', {
                        "statements": (node.statements && node.statements.length ? format(il, '{nl1}{statements}', {
                                "statements": node.statements.map(compile(il + 1, node.type)).join(';' + nli(il + 1))
                            }) : '')
                    }))
                },
                "LabelledStatement": function() {
                    return new Element(node.type, format(il, '{initial}{label}:{nli}{statement}', {
                        "initial": inl(il),
                        "label": node.label,
                        "statement": (node.statement ? compile(il, node.type)(node.statement) : '')
                    }))
                },
                "ThrowStatement": function() {
                    return new Element(node.type, format(il, 'throw {exception}', {
                        "exception": (node.exception ? (node.exception.type ? compile(il, node.type)(node.exception) : node.exception) : '')
                    }))
                },
                "TryStatement": function() {
                    return new Element(node.type, format(il, '{initial}try{sp}{{nli1}{block}{nli}}{catchStatement}{finallyStatement}', {
                        "initial": inl(il),
                        "block": (node.block ? compile(il + 1, node.type)(node.block) : ''),
                        "catchStatement": (node.catch ? compile(il, node.type)(node.catch) : ''),
                        "finallyStatement": (node.finally ? compile(il, node.type)(node.finally) : '')
                    }))
                },
                "Catch": function() {
                    return new Element(node.type, format(il, '{sp}catch{sp}({identifier}){sp}{{nli1}{block}{nli}}', {
                        "identifier": (node.identifier ? node.identifier : ''),
                        "block": (node.block ? (node.block.type ? compile(il + 1, node.type)(node.block) : node.block) : '')
                    }))
                },
                "Finally": function() {
                    return new Element(node.type, format(il, '{sp}finally{sp}{{nli1}{block}{nli}}', {
                        "block": (node.block ? (node.block.type ? compile(il + 1, node.type)(node.block) : node.block) : '')
                    }))
                },
                "DebuggerStatement": function() {
                    return new Element(node.type, 'debug')
                },
                "Program": function() {
                    var elements = (node.elements ? (node.elements.length ? node.elements.map(compile(il, node.type)) : []) : []);
                    return new Element(node.type, elements.reduce(ej(nli(il), ''), ''))
                }
            };
            if (node.type in rules) return rules[node.type]();
            else console.log('missed', node.type);
        }
    }(0)(ast).toString()
}
