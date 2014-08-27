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
    t.test("sx --tab", function(t){
        t.plan(3);
        exec('echo "var b={a:1};" > tmp; ./bin/jsjs --tab " " tmp; rm tmp', 
            testOut(t, function(stdout){
                t.same('var b = {\n "a": 1\n };\n', stdout);
            }));
    });

    t.test("sx --compress", function(t){
        t.plan(3);
        exec('echo "var b={a:1};" > tmp; ./bin/jsjs --compress tmp; rm tmp', 
            testOut(t, function(stdout){
                t.same('var b={"a":1};', stdout);
            }));
    });
});

