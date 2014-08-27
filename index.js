// Export reader
exports.read = function(input, opts){
    opts = opts || {};
    return compile(opts)(parse(input));
};

// Export parser
var parse = exports.parse = require('./parser').parse;

// Export compiler
var compile = exports.compile = function(flags, il, debug){
    flags = flags || { tab: '  ' };
    il = il || 0; 
    var ind = function(){
        if (!flags.tab) return '';
        else return (new Array(il+1)).join(flags.tab);
    };
    var nli = function(){
        if (!flags.tab) return '';
        else return '\n'+ind(flags, il);
    };
    var sp = function(){
        if (flags.compress) return '';
        else return ' ';
    }; 
    var noop = function(){ return '' };
    return function(node){
        var rules = {  
            'Function': function(){
                var name = node.name ? ' ' +node.name : '',
                    elements = node.elements ?
                        node.elements.length ?
                            node.elements.map(compile(flags, il+1))
                            : []
                        : [];
                    return (name ?
                                'var' +name +sp(flags) +'=' +sp(flags)
                                : '')
                           +'(function' +name 
                           +'(' +(node.params && node.params.length ? 
                                   node.params.join(','+sp(flags)) 
                                   : '') +'){'
                           +nli(flags, il+1) 
                           +elements.join(';'+nli(flags, il+1)) 
                           +nli(flags, il) 
                           +'})';
            },
            'FunctionCall': function(){
                var name = node.name ?
                    node.name.type ?
                        compile(flags, il)(node.name)
                        : node.name
                    : '',
                args = node.arguments ? 
                    node.arguments.length ?
                        node.arguments.map(compile(flags, il))
                        : []
                    : [];
                return name 
                       +'(' +args.join(',' +sp(flags)) + ')';
            },
            'PropertyAccess': function(){
                var base = node.base ?
                        compile(flags, il)(node.base)
                        : '',
                    name = node.name ?
                        node.name.type ?
                            compile(flags, il)(node.name)
                            : node.name
                        : '';
                if (name.toString()
                    .match(/\d+|[^\w$_]+[\w\d$_]*/)) 
                        return base +'[' +name +']';
                else return base +'.' +name; 
            },
            'Variable': function(){
                return node.name;
            },
            'NumericLiteral': function(){
                return node.value;
            },
            'StringLiteral': function(){
                var replaces = [
                    ["\\r","\\r"],
                    ["\\n","\\n"],
                    ["\\\\","\\\\"],
                ];
                return '\"' +replaces.reduce(function(str, rep){
                    return str.replace(new RegExp(rep[0],'g'),rep[1]); 
                }, node.value || "") +'\"';
            },
            'NullLiteral': function(){
                return 'null';
            },
            'BooleanLiteral': function(){
                return node.value; 
            },
            'RegularExpressionLiteral': function(){
                return '/' +node.body +'/' +node.flags;
            },
            'This': function(){
                return 'this';
            },
            'ArrayLiteral': function(){
                var elements = node.elements ?
                        node.elements.length ?
                            node.elements.map(compile(flags, il+1))
                            : []
                        : [];
                return '[' 
                        +(elements.length ?
                            nli(flags, il+1)
                            +elements.join(','+nli(flags, il+1))
                            +nli(flags, il) : '')
                        +']';
            },
            'ObjectLiteral': function(){
                var properties = node.properties ?
                        node.properties.length ?
                            node.properties.map(compile(flags, il+1))
                            : []
                        : [];
                return '{'
                        +(properties.length ? 
                            nli(flags, il+1)
                            +properties.join(','+nli(flags, il+1)) 
                            +nli(flags, il) : '')
                        +'}';
            },
            'PropertyAssignment': function(){
                var value = node.value ?
                        compile(flags, il)(node.value)
                        : 'undefined';
                return '\"' +node.name +'\":' +sp(flags) +value;
            },
            'GetterDefinition': function(){
                var body = node.body ?
                        node.body.length ?
                            node.body.map(compile(flags, il+1))
                            : []
                        : [];
                return 'get ' +node.name +'(){'
                       +nli(flags, il+1)
                       +body.join(';'+nli(flags, il+1))
                       +nli(flags, il)
                       +'}';
            },
            'SetterDefinition': function(){
                var body = node.body ?
                        node.body.length ?
                            node.body.map(compile(flags, il+1))
                            : []
                        : [];
                return 'get ' +node.name +'('
                       +node.param
                       +'){'
                       +nli(flags, il+1)
                       +body.join(';'+nli(flags, il+1))
                       +nli(flags, il)
                       +'}';
            },
            'NewOperator': function(){
                var constructor = node.constructor ?
                        node.constructor.type ?
                            compile(flags, il)(node.constructor)
                            : node.constructor
                        : '',
                    args = node.arguments ?
                        node.arguments.length ?
                            node.arguments.map(compile(flags, il))
                            : []
                        : [];
                return 'new ' +constructor +'('
                       +args.join(',' +sp(flags))
                       +')';
            },
            'FunctionCallArguments': noop,
            'PropertyAccessProperty': noop,
            'PostfixExpression': function(){
               var expression = node.expression ?
                        compile(flags, il)(node.expression)
                        : '';
               return expression +node.operator;
            },
            'UnaryExpression': function(){
               var expression = node.expression ?
                        compile(flags, il)(node.expression)
                        : '';
               return node.operator +' ' +expression;
            },
            'ConditionalExpression': function(){
                var condition = node.condition ?
                        node.condition.type ?
                            compile(flags, il)(node.condition) 
                            : node.condition
                        : '',
                  trueExpression = node.trueExpression ? 
                            node.trueExpression.type ?
                                compile(flags, il+2)(node.trueExpression)
                                : node.trueExpression
                            : '',
                  falseExpression = node.falseExpression ? 
                            node.falseExpression.type ?
                                compile(flags, il+2)(node.falseExpression)
                                : node.falseExpression
                            : '';
                return condition +sp(flags) +'?'
                       +nli(flags, il+1) 
                       +'(' + trueExpression +')'
                       +nli(flags, il+1)
                       +':' +sp(flags) 
                       +'(' +falseExpression +')';
            },
            'AssignmentExpression': function(){
                var left = node.left ?
                        compile(flags, il)(node.left) : 'undefined',
                    right = node.right ?
                        compile(flags, il)(node.right) : 'undefined';
                return left 
                       +sp(flags) 
                       +node.operator 
                       +sp(flags) 
                       +(right.toString().indexOf('var') === 0 ?
                            right.replace(/^var/,'')
                            : right);
            },
            'Block': function(){
               var statements = node.statements ?
                        node.statements.length ?
                            node.statements.map(compile(flags, il))
                            : []
                        : [];
               return statements.join(';'+nli(flags, il)); 
            },
            'VariableStatement': function(){
                var declarations = node.declarations ?
                    node.declarations.length ?
                        node.declarations.map(compile(flags, il+1))
                        : []
                    : [];
                return  'var ' 
                        +declarations.join(','+nli(flags, il+1)); 
            },
            'VariableDeclaration': function(){
                var value = node.value ?
                        compile(flags, il)(node.value)
                        : undefined;
                return node.name +sp(flags) 
                    +(value === undefined ?
                        '' : '=' +sp(flags) +value);
            },
            'BinaryExpression': function(){
                var left = node.left ?
                        compile(flags, il)(node.left) : 'undefined',
                    right = node.right ?
                        compile(flags, il)(node.right) : 'undefined';
                if (node.operator === ',')
                    node.operator = ','+nli(flags, il);
                else node.operator = sp(flags) +node.operator +sp(flags);
                return left 
                       +node.operator 
                       +right;
            },
            'EmptyStatement': function(){
                return '';
            },
            'IfStatement': function(){
               var condition = node.condition ?
                        compile(flags, il)(node.condition) : '',
                  ifStatement = node.ifStatement ? 
                        compile(flags, il+1)(node.ifStatement) : '',
                  elseStatement = node.elseStatement ? 
                        compile(flags, il+1)(node.elseStatement) : '';
                return 'if (' +condition +'){'
                       +nli(flags, il+1) 
                       +ifStatement 
                       +nli(flags, il)
                       +'}' +(elseStatement ? 
                        ' else {' 
                        +nli(flags, il+1)
                        +elseStatement 
                        +nli(flags, il)
                        +'}'
                       : '');
            },
            'DoWhileStatement': function(){
                var condition = node.condition ?
                        compile(flags, il)(node.condition) : '',
                    statement = node.statement ? 
                        compile(flags, il+1)(node.statement) : '';
                return 'do {'
                        +nli(flags, il+1)
                        +statement
                        +nli(flags, il)
                        +'} while('
                        +condition
                        +')';
            },
            'WhileStatement': function(){
                var condition = node.condition ?
                        compile(flags, il)(node.condition) : '',
                    statement = node.statement ? 
                        compile(flags, il+1)(node.statement) : '';
                return 'while('
                       +condition
                       +')'
                       +'{'
                       +nli(flags, il+1)
                       +statement
                       +nli(flags, il)
                       +'}';
            },
            'ForStatement': function(){
               var initializer = node.initializer ?
                        compile(flags, il)(node.initializer)
                        : '',
                   test = node.test ?
                        compile(flags, il)(node.test)
                        : '',
                   counter= node.counter ?
                        compile(flags, il)(node.counter)
                        : '',
                   statement = node.statement ?
                        compile(flags, il+1)(node.statement)
                        : '';
                return 'for ('
                        +initializer
                        +';' +sp(flags)
                        +test
                        +';' +sp(flags)
                        +counter
                        +'){' 
                        +nli(flags, il+1)
                        +statement
                        +nli(flags, il)
                        +'}';
            },
            'ForInStatement': function(){
               var iterator = node.iterator ?
                        node.iterator.type ?
                            compile(flags, il)(node.iterator)
                            : node.iterator
                        : '',
                   collection = node.collection ?
                        compile(flags, il)(node.collection)
                        : '',
                   statement = node.statement ?
                        compile(flags, il+1)(node.statement)
                        : '';
                return 'for ('
                        +iterator
                        +' in '
                        +collection
                        +'){' 
                        +nli(flags, il+1)
                        +statement
                        +nli(flags, il)
                        +'}';
            },
            'ContinueStatement': function(){
                return 'continue';
            },
            'BreakStatement': function(){
                return 'break';
             },
            'ReturnStatement': function(){
                var value = node.value ?
                        node.value.type ?
                            compile(flags, il)(node.value)
                            : node.value
                        : '';
                return 'return' +(value ? ' ' : '') 
                       +value 
                       +';';
            },
            'WithStatement': function(){
                var environment = node.environment ? compile(flags, il)(node.environment) : '',
                    statement = node.statement ? compile(flags, il)(node.statement) : '';
                return 'with' +sp(flags) + '(' + environment + '){' 
                    +nli(flags, il) +statement +nli(flags, il)
                    + '}';
            },
            'SwitchStatement': function(){
                var expression = node.expression ?
                        node.expression.type ?
                            compile(flags, il)(node.expression)
                            : node.expression
                        : '',
                    clauses = node.clauses ?
                        node.clauses.length ?
                            node.clauses.map(compile(flags, il+1))
                            : []
                        : [];
                return 'switch' +sp(flags) +'(' +expression +'){'
                       +(clauses.length ?
                           nli(flags, il+1)
                           +clauses.join(nli(flags, il+1))
                           +nli(flags, il) : '')
                       +'}';
            },
            'CaseClause': function(){
                var selector = node.selector ?
                        node.selector.type ?
                            compile(flags, il)(node.selector)
                            : node.selector
                        : '\"\"',
                    statements = node.statements ?
                        node.statements.length ?
                            node.statements.map(compile(flags, il+1))
                            : []
                        : [];
                return 'case ' +selector +':'
                        +(statements.length ?
                            nli(flags, il+1)
                            +statements.join(';'+nli(flags, il+1)) : '');
            },
            'DefaultClause': function(){
                var statements = node.statements ?
                        node.statements.length ?
                            node.statements.map(compile(flags, il+1))
                            : []
                        : [];
                return 'default:'
                        +nli(flags, il+1)
                        +statements.join(';'+nli(flags, il))
                        +nli(flags, il);
            },
            'LabelledStatement': noop,
            'ThrowStatement': function(){
               var exception = node.exception ?
                        node.exception.type ?
                            compile(flags, il)(node.exception)
                            : node.exception
                        : '';
               return 'throw ' +exception;
            },
            'TryStatement': function(){
               var block = node.block ?
                        compile(flags, il+1)(node.block)
                        : '',
                   _catch = node.catch ?
                        compile(flags, il+1)(node.catch)
                        : '',
                   _finally = node.finally ?
                        compile(flags, il+1)(node.finally)
                        : '';
                return 'try' +sp(flags) +'{'
                        +nli(flags, il+1)
                        +block
                        +nli(flags, il)
                        +'}' 
                        +(_catch && _catch )
                        +(_finally && _finally );
            },
            'Catch': function(){
                var block = node.block ?
                        node.block.type ?
                            compile(flags, il+1)(node.block)
                            : node.block
                        : '';
                return sp(flags) +'catch' +sp(flags) +'('
                       +(node.identifier ? 
                            node.identifier
                            : '')
                       +'){'
                       +nli(flags, il+1)
                       +block
                       +nli(flags, il)
                       +'}';
            },
            'Finally': function(){
                var block = node.block ?
                    node.block.type ?
                        compile(flags, il+1)(node.block)
                        : node.block
                    : '';
                return 'finally' +sp(flags)
                       +'{'
                       +nli(flags, il+1)
                       +block
                       +nli(flags, il)
                       +'}';
            },
            'DebuggerStatement': noop,
            'Program': function(){
                var elements = node.elements ?
                        node.elements.length ?
                            node.elements.map(compile(flags, il)) 
                            : []
                        : [];
                return elements.join(';'+nli(flags, il))
                       +';'
                       +nli(flags, il);
            }
            
        };
        if (node.type in rules) 
            return rules[node.type]();
        else console.log('missed',node.type);
    };
};

