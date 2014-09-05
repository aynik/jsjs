exports.dialects = require('fs').readdirSync(require('path').resolve(__dirname, 'parsers')).map(function (s) {
    return (s !== ('js.js') && s.match(/(.+)\.js$/) || [0, 0])[1]
}).filter(isNaN);
exports.register = function (ext) {
    ext = [].concat(ext);
    ext.forEach(function (ext) {
        require.extensions['.' + ext] = function (module, path) {
            return module._compile(require('./').read({
                "dialect": ext
            }, require('fs').readFileSync(path, 'utf-8')), path)
        }
    })
};
exports.read = function (opts, input) {
    return compile(opts, parse(opts, input))
};
var parse = exports.parse = function (opts, input) {
    var ast = require('./parsers/' + opts.dialect).parse(input);
    if (opts.ast) return console.log(JSON.stringify(ast, null, 4)) && '';
    return ast
};
var compile = exports.compile = function (opts, ast) {
    opts = opts || {};
    opts.tab = opts.tab || -1;
    var tab = new Array(parseInt((opts.tab === -1 ? 0 : opts.tab), 10) + 1).join(' ');
    var inlineElements = {
        "Program": 0,
        "GroupedExpression": 0,
        "AssignmentExpression": 0,
        "FunctionCall": 0,
        "ForInStatement": 0,
        "ForStatement": 0,
        "IfStatement": 0,
        "VariableDeclaration": 0,
        "PropertyAccess": 0,
        "PropertyAssignment": 0
    };
    var ifStatementInline = {
        "IfStatement": 0,
        "Block": 0
    };
    var notTerminatedElements = {
        "IfStatement": 0,
        "ForStatement": 0,
        "ForInStatement": 0,
        "Function": 0,
        "WhileStatement": 0,
        "WithStatement": 0,
        "SwitchStatement": 0
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
    var noop = function () {
        return ''
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
    return function compile(il, par) {
        il = il || 0;
        return function (node) {
            var rules = {
                "Function": function () {
                    return Element(node.type, tmpl(il, '{initial}function{name}({params}){sp}{{elements}}', {
                        "initial": (!(par in inlineElements) ? inl(il) : ''),
                        "name": node.name ? ' ' + node.name : sp(),
                        "params": node.params.join(',' + sp()),
                        "elements": (node.elements && node.elements.length ? nli(il + 1) + node.elements.map(compile(il + 1, node.type)).reduce(ej(nli(il + 1), nli(il)), '') : '')
                    }))
                },
                "FunctionCall": function () {
                    return Element(node.type, tmpl(il, '{initial}{name}({args})', {
                        "initial": (!(par in inlineElements) ? inl(il) : ''),
                        "name": compile(il, node.type)(node.name),
                        "args": (node.arguments || []).map(compile(il, node.type)).join(',' + sp())
                    }))
                },
                "PropertyAccess": function () {
                    return Element(node.type, tmpl(il, (!node.name.type ? '{base}.{name}' : '{base}[{name}]'), {
                        "base": compile(il, node.type)(node.base),
                        "name": compile(il, node.type)(node.name)
                    }))
                },
                "Variable": function () {
                    return Element(node.type, compile(il, node.type)(node.name))
                },
                "NumericLiteral": function () {
                    return Element(node.type, node.value)
                },
                "StringLiteral": function () {
                    var replaces = [['\\\\', '\\\\'], ['\\n', '\\n'], ['\\r', '\\r']];
                    return Element(node.type, tmpl(il, '{quote}{str}{quote}', {
                        "quote": (node.value.indexOf("'") > -1 ? '"' : "'"),
                        "str": replaces.reduce(function (str, rep) {
                            return str.replace(new RegExp(rep[0], 'g'), rep[1])
                        }, node.value || '')
                    }))
                },
                "NullLiteral": function () {
                    return Element(node.type, 'null')
                },
                "BooleanLiteral": function () {
                    return Element(node.type, node.value)
                },
                "RegularExpressionLiteral": function () {
                    return Element(node.type, tmpl(il, '/{body}/{flags}', {
                        "body": node.elements,
                        "flags": (node.flags ? node.flags : '')
                    }))
                },
                "This": function () {
                    return Element(node.type, 'this')
                },
                "ArrayLiteral": function () {
                    return Element(node.type, tmpl(il, '[{elements}]', {
                        "elements": (node.elements || []).map(compile(il + 1, node.type)).join(',' + sp())
                    }))
                },
                "ObjectLiteral": function () {
                    return Element(node.type, tmpl(il, '{{properties}}', {
                        "properties": node.properties.length ? tmpl(il, '{nli1}{properties}{nli}', {
                                "properties": (node.properties || []).map(compile(il + 1, node.type)).join(',' + nli(il + 1))
                            }) : ''
                    }))
                },
                "GroupedExpression": function () {
                    return Element(node.type, tmpl(il, '({expression})', {
                        "expression": compile(il, node.type)(node.expression)
                    }))
                },
                "PropertyAssignment": function () {
                    return Element(node.type, tmpl(il, '"{name}":{sp}{value}', {
                        "name": node.name,
                        "value": compile(il, node.type)(node.value)
                    }))
                },
                "GetterDefinition": function () {
                    return Element(node.type, tmpl(il, 'get {name}{sp}(){sp}{{nli1}{body}{nli}}', {
                        "name": node.name,
                        "body": (node.body || []).map(compile(il + 1, node.type)).reduce(ej(nli(il), ''))
                    }))
                },
                "SetterDefinition": function () {
                    return Element(node.type, tmpl(il, 'set {name}{sp}({param}){sp}{{nli1}{body}{nli}}', {
                        "name": node.name,
                        "param": node.param,
                        "body": (node.body || []).map(compile(il + 1, node.type)).reduce(ej(nli(il), ''))
                    }))
                },
                "NewOperator": function () {
                    return Element(node.type, tmpl(il, 'new {constructor}({args})', {
                        "constructor": compile(il + 1, node.type)(node.constructor),
                        "args": (node.arguments || []).map(compile(il, node.type)).join(',' + sp())
                    }))
                },
                "FunctionCallArguments": noop,
                "PropertyAccessProperty": noop,
                "PostfixExpression": function () {
                    return Element(node.type, tmpl(il, '{expression}{operator}', {
                        "expression": compile(il, node.type)(node.expression),
                        "operator": node.operator
                    }))
                },
                "UnaryExpression": function () {
                    return Element(node.type, tmpl(il, '{operator}{expression}', {
                        "operator": (node.operator.match(/\w+/) ? node.operator + ' ' : node.operator),
                        "expression": compile(il, node.type)(node.expression)
                    }))
                },
                "ConditionalExpression": function () {
                    return Element(node.type, tmpl(il, '{condition}{sp}?{sp}{trueExpression}{sp}:{sp}{falseExpression}', {
                        "condition": compile(il, node.type)(node.condition),
                        "trueExpression": compile(il + 1, node.type)(node.trueExpression),
                        "falseExpression": compile(il + 1, node.type)(node.falseExpression)
                    }))
                },
                "AssignmentExpression": function () {
                    return Element(node.type, tmpl(il, '{left}{sp}{operator}{sp}{right}', {
                        "left": compile(il, node.type)(node.left),
                        "operator": node.operator,
                        "right": compile(il, node.type)(node.right)
                    }))
                },
                "Block": function () {
                    return Element(node.type, (node.elements || []).map(compile(il, node.type)).reduce(ej(nli(il), ''), ''))
                },
                "VariableStatement": function () {
                    return Element(node.type, tmpl(il, 'var {declarations}', {
                        "declarations": (node.declarations || []).map(compile(il, node.type)).join(', ' + (!(par in inlineElements) ? nli(il + 1) : ''))
                    }))
                },
                "VariableDeclaration": function () {
                    return Element(node.type, tmpl(il, '{name}{value}', {
                        "name": node.name,
                        "value": node.value ? tmpl(il, '{sp}={sp}{value}', {
                                "value": compile(il, node.type)(node.value)
                            }) : ''
                    }))
                },
                "BinaryExpression": function () {
                    return Element(node.type, tmpl(il, '{left}{operator}{right}', {
                        "left": compile(il, node.type)(node.left),
                        "operator": tmpl(il, (node.operator === ',' ? '{operator}{union}' : '{sp}{operator}{sp}'), {
                            "operator": node.operator,
                            "union": !(par in inlineElements) ? nli(il + 1) : sp()
                        }),
                        "right": compile(il, node.type)(node.right)
                    }))
                },
                "EmptyStatement": function () {
                    return Element(node.type, '')
                },
                "IfStatement": function () {
                    var ifStatementBlock = node.ifStatement && node.ifStatement.elements && node.ifStatement.elements.length;
                    var elseStatementBlock = node.elseStatement && node.elseStatement.elements && node.elseStatement.elements.length;
                    var elseIf = node.elseStatement && node.elseStatement.type === 'IfStatement';
                    return Element(node.type, tmpl(il, '{initial}if{sp}({condition}){ifStatement}{elseStatement}', {
                        "initial": !(par in ifStatementInline) ? inl(il) : '',
                        "condition": compile(il, node.type)(node.condition),
                        "ifStatement": tmpl(il, (ifStatementBlock ? '{sp}{{nli1}{ifStatement}{nli}}' : ' {ifStatement};'), {
                            "ifStatement": compile(il + 1, node.type)(node.ifStatement)
                        }),
                        "elseStatement": node.elseStatement ? tmpl(il, (elseStatementBlock ? '{sp}else{sp}{{nli1}{union}{elseStatement}{nli}}' : '{initial}else {elseStatement}{separator}'), {
                                "elseStatement": compile(il + (!elseIf ? 1 : 0), node.type)(node.elseStatement),
                                "initial": (ifStatementBlock ? sp() : nli(il)),
                                "union": (elseIf ? '' : nli(il + 1)),
                                "separator": (elseIf ? '' : ';')
                            }) : ''
                    }))
                },
                "DoWhileStatement": function () {
                    var statementBlock = node.statement && node.statement.elements && node.statement.elements.length;
                    return Element(node.type, tmpl(il, '{initial}do{sp}{statement}{sp}while{sp}({condition})', {
                        "initial": inl(il),
                        "condition": compile(il, node.type)(node.condition),
                        "statement": node.statement ? tmpl(il, (statementBlock ? '{sp}{{nli1}{statement}{nli}}' : ' {statement};'), {
                                "statement": compile(il + 1, node.type)(node.statement)
                            }) : ''
                    }))
                },
                "WhileStatement": function () {
                    var statementBlock = node.statement && node.statement.elements && node.statement.elements.length;
                    return Element(node.type, tmpl(il, '{initial}while{sp}({condition}){statement}', {
                        "initial": inl(il),
                        "condition": compile(il, node.type)(node.condition),
                        "statement": node.statement ? tmpl(il, (statementBlock ? '{sp}{{nli1}{statement}{nli}}' : ' {statement};'), {
                                "statement": compile(il + 1, node.type)(node.statement)
                            }) : ''
                    }))
                },
                "ForStatement": function () {
                    var statementBlock = node.statement && node.statement.elements && node.statement.elements.length;
                    return Element(node.type, tmpl(il, '{initial}for{sp}({initializer};{sp}{test};{sp}{counter}){statement}', {
                        "initial": inl(il),
                        "initializer": compile(il, node.type)(node.initializer),
                        "test": compile(il, node.type)(node.test),
                        "counter": compile(il, node.type)(node.counter),
                        "statement": node.statement ? tmpl(il, (statementBlock ? '{sp}{{nli1}{statement}{nli}}' : ' {statement};'), {
                                "statement": compile(il + 1, node.type)(node.statement)
                            }) : ''
                    }))
                },
                "ForInStatement": function () {
                    var statementBlock = node.statement && node.statement.elements && node.statement.elements.length;
                    return Element(node.type, tmpl(il, '{initial}for{sp}({iterator} in {collection}){statement}', {
                        "initial": inl(il),
                        "iterator": compile(il, node.type)(node.iterator),
                        "collection": compile(il, node.type)(node.collection),
                        "statement": node.statement ? tmpl(il, (statementBlock ? '{sp}{{nli1}{statement}{nli}}' : ' {statement};'), {
                                "statement": compile(il + 1, node.type)(node.statement)
                            }) : ''
                    }))
                },
                "ContinueStatement": function () {
                    return Element(node.type, 'continue')
                },
                "BreakStatement": function () {
                    return Element(node.type, 'break')
                },
                "ReturnStatement": function () {
                    var value = compile(il, node.type)(node.value);
                    return Element(node.type, 'return' + (value ? ' ' : '') + value)
                },
                "WithStatement": function () {
                    var statementBlock = node.statement && node.statement.elements && node.statement.elements.length;
                    return Element(node.type, tmpl(il, '{initial}with{sp}({environment}){statement}', {
                        "initial": inl(il),
                        "environment": compile(il, node.type)(node.environment),
                        "statement": node.statement ? tmpl(il, (statementBlock ? '{sp}{{nli1}{statement}{nli}}' : ' {statement};'), {
                                "statement": compile(il + 1, node.type)(node.statement)
                            }) : ''
                    }))
                },
                "SwitchStatement": function () {
                    return Element(node.type, tmpl(il, '{initial}switch{sp}({expression}){sp}{{clauses}}', {
                        "initial": inl(il),
                        "expression": compile(il, node.type)(node.expression),
                        "clauses": node.clauses.length ? tmpl(il, '{nli1}{clauses}{nli}', {
                                "clauses": node.clauses.map(compile(il + 1, node.type)).join(';' + nli(il + 1))
                            }) : ''
                    }))
                },
                "CaseClause": function () {
                    return Element(node.type, tmpl(il, 'case {selector}:{elements}', {
                        "selector": compile(il, node.type)(node.selector) || '""',
                        "elements": node.elements.length ? tmpl(il, '{nli1}{elements}', {
                                "elements": node.elements.map(compile(il + 1, node.type)).join(';' + nli(il + 1))
                            }) : ''
                    }))
                },
                "DefaultClause": function () {
                    return Element(node.type, tmpl(il, 'default:{elements}', {
                        "elements": node.elements.length ? tmpl(il, '{nli1}{elements}', {
                                "elements": node.elements.map(compile(il + 1, node.type)).join(';' + nli(il + 1))
                            }) : ''
                    }))
                },
                "LabelledStatement": function () {
                    return Element(node.type, tmpl(il, '{initial}{label}:{nli}{statement}', {
                        "initial": inl(il),
                        "label": node.label,
                        "statement": compile(il, node.type)(node.statement)
                    }))
                },
                "ThrowStatement": function () {
                    return Element(node.type, tmpl(il, 'throw {exception}', {
                        "exception": compile(il, node.type)(node.exception)
                    }))
                },
                "TryStatement": function () {
                    return Element(node.type, tmpl(il, '{initial}try{sp}{{nli1}{block}{nli}}{catchStatement}{finallyStatement}', {
                        "initial": inl(il),
                        "block": compile(il + 1, node.type)(node.block),
                        "catchStatement": compile(il, node.type)(node.catch),
                        "finallyStatement": compile(il, node.type)(node.finally)
                    }))
                },
                "Catch": function () {
                    return Element(node.type, tmpl(il, '{sp}catch{sp}({identifier}){sp}{{nli1}{block}{nli}}', {
                        "identifier": node.identifier,
                        "block": compile(il + 1, node.type)(node.block)
                    }))
                },
                "Finally": function () {
                    return Element(node.type, tmpl(il, '{sp}finally{sp}{{nli1}{block}{nli}}', {
                        "block": compile(il + 1, node.type)(node.block)
                    }))
                },
                "DebuggerStatement": function () {
                    return Element(node.type, 'debug')
                },
                "Program": function () {
                    return Element(node.type, (node.elements || []).map(compile(il, node.type)).reduce(ej(nli(il), ''), ''))
                }
            };
            if (!node) return noop();
            if (!node.type) return node;
            if (node.type in rules) return rules[node.type]();
            else console.log('missed', node.type);
        }
    }(0)(ast).toString()
}
