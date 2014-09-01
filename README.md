# Jsjs
## A handy javascript to javascript transpiler

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
* [`--language, -l [language]`](#language)

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

<a name="language" />
### jsjs --language [language] | -l [language]

Use another input language instead of javascript.

Supported languages:
        
    - Javascript, code: **js**

---


