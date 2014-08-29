exports.read = function(opts, input) {
    return compile(opts, parse(input))
};
var parse = exports.parse = require('./parser').parse;
var compile = exports.compile = function(opts, ast) {
    opts = opts || {};
    opts.tab = opts.tab || -1;
    var tab = new Array(parseInt((opts.tab === -1 ?
        0
        : opts.tab
    ), 10) + 1).join(' ');
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
    var noop = function() {
        return ''
    };
    var Element = function(type, code) {
        this.type = type;
        this.code = code
    };
    Element.prototype.toString = Element.prototype.valueOf = function() {
        return this.code
    };
    var inlineElements = {
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
    return function compile(il, par) {
        il = il || 0;
        return function(node) {
            var rules = {
                "Function": function() {
                    var name = (node.name ?
                        ' ' + node.name
                        : ''
                    );
                    var elements = (node.elements ?
                        (node.elements.length ?
                            node.elements.map(compile(il + 1, node.type))
                            : []
                        )
                        : []
                    );
                    return new Element(node.type, (!par in inlineElements ?
                        inl(il)
                        : ''
                    ) + 'function' + name + '(' + (node.params && node.params.length ?
                        node.params.join(',' + sp())
                        : ''
                    ) + ')' + sp() + '{' + nli(il + 1) + elements.reduce(function(code, element, index) {
                        var lastElement = index === elements.length - 1;
                        var notTerminatedElement = element.type in notTerminatedElements;
                        return code += element + (lastElement ?
                            nli(il)
                            : (notTerminatedElement ?
                                ''
                                : ';'
                            ) + nli(il + 1)
                        )
                    }, '') + '}')
                },
                "FunctionCall": function() {
                    var name = (node.name ?
                        (node.name.type ?
                            compile(il, node.type)(node.name)
                            : node.name
                        )
                        : ''
                    );
                    var args = (node.arguments ?
                        (node.arguments.length ?
                            node.arguments.map(compile(il, node.type))
                            : []
                        )
                        : []
                    );
                    return new Element(node.type, (!par in inlineElements ?
                        inl(il)
                        : ''
                    ) + name + '(' + args.join(',' + sp()) + ')')
                },
                "PropertyAccess": function() {
                    var base = (node.base ?
                        compile(il, node.type)(node.base)
                        : ''
                    );
                    var name = (node.name ?
                        (node.name.type ?
                            compile(il, node.type)(node.name)
                            : node.name
                        )
                        : ''
                    );
                    if (name.type === 'Expression' || String(name).match(/\d+|[^\w$_]+[\w\d$_]*/)) {
                        return new Element(node.type, base + '[' + name + ']')
                    }
                    else return new Element(node.type, base + '.' + name);
                },
                "Variable": function() {
                    return new Element(node.type, node.name)
                },
                "NumericLiteral": function() {
                    return new Element(node.type, node.value)
                },
                "StringLiteral": function() {
                    var replaces = [
                        [
                            '\\\\',
                            '\\\\'
                        ],
                        [
                            '\\n',
                            '\\n'
                        ],
                        [
                            '\\r',
                            '\\r'
                        ]
                    ];
                    var replaced = replaces.reduce(function(str, rep) {
                        return str.replace(new RegExp(rep[0], 'g'), rep[1])
                    }, node.value || '');
                    return new Element(node.type, (replaced.indexOf("'") > -1 ?
                        '"'
                        : "'"
                    ) + replaced + (replaced.indexOf("'") > -1 ?
                        '"'
                        : "'"
                    ))
                },
                "NullLiteral": function() {
                    return new Element(node.type, 'null')
                },
                "BooleanLiteral": function() {
                    return new Element(node.type, node.value)
                },
                "RegularExpressionLiteral": function() {
                    return new Element(node.type, '/' + node.body + '/' + (node.opts ?
                        node.opts
                        : ''
                    ))
                },
                "This": function() {
                    return new Element(node.type, 'this')
                },
                "ArrayLiteral": function() {
                    var elements = (node.elements ?
                        (node.elements.length ?
                            node.elements.map(compile(il + 1, node.type))
                            : []
                        )
                        : []
                    );
                    return new Element(node.type, '[' + (elements.length ?
                        nli(il + 1) + elements.join(',' + nli(il + 1)) + nli(il)
                        : ''
                    ) + ']')
                },
                "ObjectLiteral": function() {
                    var properties = (node.properties ?
                        (node.properties.length ?
                            node.properties.map(compile(il + 1, node.type))
                            : []
                        )
                        : []
                    );
                    return new Element(node.type, '{' + (properties.length ?
                        nli(il + 1) + properties.join(',' + nli(il + 1)) + nli(il)
                        : ''
                    ) + '}')
                },
                "PropertyAssignment": function() {
                    var value = (node.value ?
                        compile(il, node.type)(node.value)
                        : 'undefined'
                    );
                    return new Element(node.type, '"' + node.name + '":' + sp() + value)
                },
                "GetterDefinition": function() {
                    var body = (node.body ?
                        (node.body.length ?
                            node.body.map(compile(il + 1, node.type))
                            : []
                        )
                        : []
                    );
                    return new Element(node.type, 'get' + node.name + ' ()' + sp() + '{' + nli(il + 1) + body.join(';' + nli(il + 1)) + nli(il) + '}')
                },
                "SetterDefinition": function() {
                    var body = (node.body ?
                        (node.body.length ?
                            node.body.map(compile(il + 1, node.type))
                            : []
                        )
                        : []
                    );
                    return new Element(node.type, 'set' + node.name + ' (' + node.param + ')' + sp() + '{' + nli(il + 1) + body.join(';' + nli(il + 1)) + nli(il) + '}')
                },
                "NewOperator": function() {
                    var constructor = (node.constructor ?
                        (node.constructor.type ?
                            compile(il + 1, node.type)(node.constructor)
                            : node.constructor
                        )
                        : ''
                    );
                    var args = (node.arguments ?
                        (node.arguments.length ?
                            node.arguments.map(compile(il, node.type))
                            : []
                        )
                        : []
                    );
                    return new Element(node.type, 'new ' + constructor + '(' + args.join(',' + sp()) + ')')
                },
                "FunctionCallArguments": noop,
                "PropertyAccessProperty": noop,
                "PostfixExpression": function() {
                    var expression = (node.expression ?
                        compile(il, node.type)(node.expression)
                        : ''
                    );
                    return new Element(node.type, expression + node.operator)
                },
                "UnaryExpression": function() {
                    var expression = (node.expression ?
                        compile(il, node.type)(node.expression)
                        : ''
                    );
                    return new Element(node.type, node.operator + expression)
                },
                "ConditionalExpression": function() {
                    var condition = (node.condition ?
                        (node.condition.type ?
                            compile(il, node.type)(node.condition)
                            : node.condition
                        )
                        : ''
                    );
                    var trueExpression = (node.trueExpression ?
                        (node.trueExpression.type ?
                            compile(il + 1, node.type)(node.trueExpression)
                            : node.trueExpression
                        )
                        : ''
                    );
                    var falseExpression = (node.falseExpression ?
                        (node.falseExpression.type ?
                            compile(il + 1, node.type)(node.falseExpression)
                            : node.falseExpression
                        )
                        : ''
                    );
                    return new Element(node.type, '(' + condition + sp() + '?' + nli(il + 1) + trueExpression + nli(il + 1) + ':' + sp() + falseExpression + nli(il) + ')')
                },
                "AssignmentExpression": function() {
                    var left = (node.left ?
                        compile(il, node.type)(node.left)
                        : 'undefined'
                    );
                    var right = (node.right ?
                        compile(il, node.type)(node.right)
                        : 'undefined'
                    );
                    return new Element(node.type, left + sp() + node.operator + sp() + (String(right.toString()).indexOf('var') === 0 ?
                        right.replace(/^var/, '')
                        : right
                    ))
                },
                "Block": function() {
                    var statements = (node.statements ?
                        (node.statements.length ?
                            node.statements.map(compile(il, node.type))
                            : []
                        )
                        : []
                    );
                    return new Element(node.type, statements.reduce(function(code, statement, index) {
                        var lastElement = index === statements.length - 1;
                        var notTerminatedElement = statement.type in notTerminatedElements;
                        return code += statement + (lastElement ?
                            ''
                            : (notTerminatedElement ?
                                ''
                                : ';'
                            ) + nli(il)
                        )
                    }, ''))
                },
                "VariableStatement": function() {
                    var declarations = (node.declarations ?
                        (node.declarations.length ?
                            node.declarations.map(compile(il, node.type))
                            : []
                        )
                        : []
                    );
                    var statement = (par !== 'ReturnStatement' ?
                        'var '
                        : ''
                    );
                    return new Element(node.type, statement + declarations.join(';' + nli(il) + statement))
                },
                "VariableDeclaration": function() {
                    var value = (node.value ?
                        compile(il, node.type)(node.value)
                        : undefined
                    );
                    return new Element(node.type, node.name + (value === undefined ?
                        ''
                        : sp() + '=' + sp() + value
                    ))
                },
                "BinaryExpression": function() {
                    var left = (node.left ?
                        compile(il, node.type)(node.left)
                        : 'undefined'
                    );
                    var right = (node.right ?
                        compile(il, node.type)(node.right)
                        : 'undefined'
                    );
                    if (node.operator === ',') node.operator = ',' + nli(il);
                    else node.operator = sp() + node.operator + sp();
                    return new Element(node.type, left + node.operator + right)
                },
                "EmptyStatement": function() {
                    return new Element(node.type, '')
                },
                "IfStatement": function() {
                    var ifStatementBlock = node.ifStatement && node.ifStatement.statements && node.ifStatement.statements.length;
                    var elseIf = node.elseStatement && node.elseStatement.type === 'IfStatement';
                    var elseStatementBlock = node.elseStatement && node.elseStatement.statements && node.elseStatement.statements.length;
                    var condition = (node.condition ?
                        compile(il, node.type)(node.condition)
                        : ''
                    );
                    var ifStatement = (node.ifStatement ?
                        compile(il + 1, node.type)(node.ifStatement)
                        : ''
                    );
                    var elseStatement = (node.elseStatement ?
                        compile(il + (!elseIf ?
                            1
                            : 0
                        ), node.type)(node.elseStatement)
                        : ''
                    );
                    return new Element(node.type, (par !== 'IfStatement' ?
                        inl(il)
                        : ''
                    ) + 'if' + sp() + '(' + condition + ')' + (ifStatementBlock ?
                        sp() + '{' + nli(il + 1)
                        : ' '
                    ) + ifStatement + (ifStatementBlock ?
                        nli(il) + '}'
                        : (elseStatement ?
                            ';'
                            : ''
                        )
                    ) + (elseStatement ?
                        (elseStatementBlock ?
                            sp()
                            : nli(il)
                        ) + 'else' + (elseStatementBlock ?
                            sp() + '{' + nli(il + 1)
                            : ' '
                        ) + (elseIf || node.elseStatement.type ?
                            ''
                            : nli(il + 1)
                        ) + elseStatement + (elseStatementBlock ?
                            nli(il) + '}'
                            : ';'
                        )
                        : ''
                    ))
                },
                "DoWhileStatement": function() {
                    var condition = (node.condition ?
                        compile(il, node.type)(node.condition)
                        : ''
                    );
                    var statement = (node.statement ?
                        compile(il + 1, node.type)(node.statement)
                        : ''
                    );
                    return new Element(node.type, inl(il) + 'do' + sp() + '{' + nli(il + 1) + statement + nli(il) + '}' + sp() + 'while' + sp() + '(' + condition + ')')
                },
                "WhileStatement": function() {
                    var condition = (node.condition ?
                        compile(il, node.type)(node.condition)
                        : ''
                    );
                    var statement = (node.statement ?
                        compile(il + 1, node.type)(node.statement)
                        : ''
                    );
                    return new Element(node.type, inl(il) + 'while (' + condition + ')' + sp() + '{' + nli(il + 1) + statement + nli(il) + '}')
                },
                "ForStatement": function() {
                    var initializer = (node.initializer ?
                        compile(il, node.type)(node.initializer)
                        : ''
                    );
                    var test = (node.test ?
                        compile(il, node.type)(node.test)
                        : ''
                    );
                    var counter = (node.counter ?
                        compile(il, node.type)(node.counter)
                        : ''
                    );
                    var statement = (node.statement ?
                        compile(il + 1, node.type)(node.statement)
                        : ''
                    );
                    return new Element(node.type, inl(il) + 'for' + sp() + '(' + initializer + ';' + sp() + test + ';' + sp() + counter + ')' + sp() + '{' + nli(il + 1) + statement + nli(il) + '}')
                },
                "ForInStatement": function() {
                    var iterator = (node.iterator ?
                        (node.iterator.type ?
                            compile(il, node.type)(node.iterator)
                            : node.iterator
                        )
                        : ''
                    );
                    var collection = (node.collection ?
                        compile(il, node.type)(node.collection)
                        : ''
                    );
                    var statement = (node.statement ?
                        compile(il + 1, node.type)(node.statement)
                        : ''
                    );
                    return new Element(node.type, inl(il) + 'for' + sp() + '(' + iterator + ' in ' + collection + ')' + sp() + '{' + nli(il + 1) + statement + nli(il) + '}')
                },
                "ContinueStatement": function() {
                    return new Element(node.type, 'continue')
                },
                "BreakStatement": function() {
                    return new Element(node.type, 'break')
                },
                "ReturnStatement": function() {
                    var value = (node.value ?
                        (node.value.type ?
                            compile(il, node.type)(node.value)
                            : node.value
                        )
                        : ''
                    );
                    return new Element(node.type, 'return' + (value ?
                        ' '
                        : ''
                    ) + value)
                },
                "WithStatement": function() {
                    var environment = (node.environment ?
                        compile(il, node.type)(node.environment)
                        : ''
                    );
                    var statement = (node.statement ?
                        compile(il, node.type)(node.statement)
                        : ''
                    );
                    return new Element(node.type, inl(il) + 'with' + sp() + '(' + environment + ')' + sp() + '{' + nli(il) + statement + nli(il) + '}')
                },
                "SwitchStatement": function() {
                    var expression = (node.expression ?
                        (node.expression.type ?
                            compile(il, node.type)(node.expression)
                            : node.expression
                        )
                        : ''
                    );
                    var clauses = (node.clauses ?
                        (node.clauses.length ?
                            node.clauses.map(compile(il + 1, node.type))
                            : []
                        )
                        : []
                    );
                    return new Element(node.type, inl(il) + 'switch' + sp() + '(' + expression + ')' + sp() + '{' + (clauses.length ?
                        nli(il + 1) + clauses.join(nli(il + 1)) + nli(il)
                        : ''
                    ) + '}')
                },
                "CaseClause": function() {
                    var selector = (node.selector ?
                        (node.selector.type ?
                            compile(il, node.type)(node.selector)
                            : node.selector
                        )
                        : '""'
                    );
                    var statements = (node.statements ?
                        (node.statements.length ?
                            node.statements.map(compile(il + 1, node.type))
                            : []
                        )
                        : []
                    );
                    return new Element(node.type, 'case ' + selector + ':' + (statements.length ?
                        nli(il + 1) + statements.join(';' + nli(il + 1))
                        : ''
                    ))
                },
                "DefaultClause": function() {
                    var statements = (node.statements ?
                        (node.statements.length ?
                            node.statements.map(compile(il + 1, node.type))
                            : []
                        )
                        : []
                    );
                    return new Element(node.type, 'default:' + nli(il + 1) + statements.join(';' + nli(il)) + nli(il))
                },
                "LabelledStatement": function() {
                    var statement = (node.statement ?
                        compile(il, node.type)(node.statement)
                        : ''
                    );
                    return new Element(node.type, inl(il) + node.label + ':' + nli(il) + statement)
                },
                "ThrowStatement": function() {
                    var exception = (node.exception ?
                        (node.exception.type ?
                            compile(il, node.type)(node.exception)
                            : node.exception
                        )
                        : ''
                    );
                    return new Element(node.type, 'throw ' + exception)
                },
                "TryStatement": function() {
                    var block = (node.block ?
                        compile(il + 1, node.type)(node.block)
                        : ''
                    );
                    var _catch = (node.catch ?
                        compile(il, node.type)(node.catch)
                        : ''
                    );
                    var _finally = (node.finally ?
                        compile(il, node.type)(node.finally)
                        : ''
                    );
                    return new Element(node.type, inl(il) + 'try' + sp() + '{' + nli(il + 1) + block + nli(il) + '}' + _catch && _catch + _finally && _finally)
                },
                "Catch": function() {
                    var block = (node.block ?
                        (node.block.type ?
                            compile(il + 1, node.type)(node.block)
                            : node.block
                        )
                        : ''
                    );
                    return new Element(node.type, sp() + 'catch' + sp() + '(' + (node.identifier ?
                        node.identifier
                        : ''
                    ) + ')' + sp() + '{' + nli(il + 1) + block + nli(il) + '}')
                },
                "Finally": function() {
                    var block = (node.block ?
                        (node.block.type ?
                            compile(il + 1, node.type)(node.block)
                            : node.block
                        )
                        : ''
                    );
                    return new Element(node.type, sp() + 'finally' + sp() + '{' + nli(il + 1) + block + nli(il) + '}')
                },
                "DebuggerStatement": function() {
                    return new Element(node.type, 'debug')
                },
                "Program": function() {
                    var elements = (node.elements ?
                        (node.elements.length ?
                            node.elements.map(compile(il, node.type))
                            : []
                        )
                        : []
                    );
                    return new Element(node.type, elements.reduce(function(code, element, index) {
                        var lastElement = index === elements.length - 1;
                        var notTerminatedElement = element.type in notTerminatedElements;
                        return code += element + (lastElement ?
                            ''
                            : (notTerminatedElement ?
                                ''
                                : ';'
                            ) + nli(il)
                        )
                    }, ''))
                }
            };
            if (node.type in rules) return rules[node.type]();
            else console.log('missed', node.type);
        }
    }(0)(ast).toString()
}
