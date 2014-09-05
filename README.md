# Jsjs
## A handy javascript dialectic  transpiler

[![Build Status via Travis CI](https://travis-ci.org/aynik/jsjs.svg?branch=master)](https://travis-ci.org/aynik/jsjs)

Pull requests are very welcome!

## Install 

```bash
$ npm install [-g] jsjs
```

## Features

- Not many, at the moment barelly recompiles sources.

## Documentation

### Usage

```bash
$ jsjs [options] <file> [...<files>]
```

### Options

* [`--tab, -t [number of spaces]`](#tab)
* [`--compress, -c`](#compress)
* [`--dialect, -l [dialect]`](#dialect)

---

## Options

<a name="tab" />
### jsjs --tab [number of spaces] | -t [number of spaces]

Indents code with `number of spaces` for each indentation level.

---

<a name="compress" />
### jsjs --compress | -c

Removes optional whitespace between statements and declarations.

---

<a name="dialect" />
### jsjs --dialect [dialect] | -l [dialect]

Use another input dialect instead of javascript.

Javascript dialects are basically different languages which follow the style and the
semantics of javascript.

This library includes the following dialects:

### Standard Javascript (js): Common ECMAScript 5.

```js
function pow(a, b){
    for (var r = a, n = 0; n < b; n++) {
        r = r * a
    }
    return r
}

function head(arr){
    return arr.slice(0, 1);
}
```

### Go-Script (gs): A clone of [Go](http://golang.com) syntax without the type stuff.

```go
func pow(a, b){
    for r := a, n := 0; n < b; n++ {
        r = r * a
    }
    return r
}

func head(arr){
    return arr[0:1]
}
```

To register dialects as Node's require.extensions, you can use *jsjs.register*:

```js
var jsjs = require('jsjs');

jsjs.register('gs'); // Go-Script registered
var gos = require('./go-test.gs');

jsjs.register(jsjs.dialects); // registers all supported jsjs dialects
```

