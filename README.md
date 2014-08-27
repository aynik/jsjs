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
``

### Options

* [`--format, -f [chars]`](#format)
* [`--squeeze, -s`](#squeeze)

---

## Options

<a name="format" />
### jsjs --format [chars] | -f [chars]

Indents code using `chars` string as the minimum unit.

---

<a name="squeeze" />
### sx --squeeze | -s

Squeezes optional whitespace between statements and declarations.

---


