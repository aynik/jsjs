var test = require('tape').test;
var exec = require('child_process').exec;
var fs = require('fs');

var testOut = function(t, success){
    return function(err, stdout, stderr){
        t.notOk(err);
        t.notOk(stderr);
        success(stdout.substr(0, stdout.length - 1));
    };
};

test("Should run all tests", function(t){ 
    t.test("jsjs --tab", function(t){
        t.plan(3);
        exec('echo "var b={a:1};" > tmp; ./bin/jsjs --tab 1 tmp; rm tmp', 
            testOut(t, function(stdout){
                t.same('var b = {\n "a": 1\n}', stdout);
            }));
    });

    t.test("jsjs --compress", function(t){
        t.plan(3);
        exec('echo "var b={a:1};" > tmp; ./bin/jsjs --compress tmp; rm tmp', 
            testOut(t, function(stdout){
                t.same('var b={"a":1}', stdout);
            }));
    });

    t.test("-- self recompilation", function(t){
        t.plan(3);
        exec('./bin/jsjs -t 4 index.js > tmp; cat tmp; rm tmp', 
            testOut(t, function(stdout){
                t.same(fs.readFileSync('./index.js', 'utf-8'), stdout+"\n");
            }));
    });
});

