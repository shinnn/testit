'use strict';

const assert = require('assert');
const EventEmitter = require('events').EventEmitter;
const promisify = require('promise').denodeify;
const chalk = require('chalk');
const ms = require('ms');
const result = require('test-result');
const timeout = require('./timeout');

class TestSuite extends EventEmitter {
  constructor(name) {
    super();

    this.name = name;
    this.colors = true;
    this._queue = [];
    this._stack = [];
  }

  static now() {
    return Date.now();
  }

  addTest(name, fn, options) {
    assert(typeof name === 'string', 'The description must be a string')
    assert(typeof fn === 'function', 'The test must be a function')
    if (fn.length === 1) {
      fn = promisify(fn);
    }
    this._queue.push(new TestCase(false, name, fn, options || {}));
  }

  addCode(fn, options) {
    this._queue.push(new TestCase(true, '', fn, options || {}));
  }

  run() {
    let index = 0;
    return new Promise((resolve, reject) => {
      const next = () => {
        while (index >= this._queue.length && this._stack.length) {
          const frame = this._stack.pop();
          index = frame.index;
          this._queue = frame.queue;
          this.emit('end-section', frame.name);
        }
        if (index >= this._queue.length) {
          this.emit('suite-pass');
          return resolve();
        }
        const test = this._queue[index];
        if (test.justRun) {
          this.emit('run-start');
          Promise.resolve(null).then(() => timeout(test.fn(), test.timeout)).then(() => {
            this.emit('run-pass');
            this.emit('run-end');
            index++;
            next();
          }, err => {
            this.emit('run-fail', err);
            this.emit('run-end');
            this.emit('suite-fail');
            reject(err);
          });
          return;
        }
        this._stack.push(new StackFrame(index + 1, this._queue, test.name));
        index = 0;
        this._queue = [];
        this.emit('start', test.name);
        Promise.resolve(null).then(() => timeout(test.fn(), test.timeout)).then(() => {
          if (this._queue.length) {
            this.emit('end', test.name);
            this.emit('start-section', test.name);
          } else {
            this.emit('pass', test.name);
            this.emit('end', test.name);
            const frame = this._stack.pop();
            index = frame.index;
            this._queue = frame.queue;
          }
          next();
        }, err => {
          this.emit('fail', test.name, err);
          this.emit('end', test.name);
          this.emit('suite-fail');
          reject(err);
        });
      }
      this.emit('suite-start');
      next();
    });
  }

  disableColors() {
    this.colors = false;
  }

  addLogging() {
    const color = (colorName, str) => this.colors ? chalk[colorName](str) : str;
    const indent = [];
    let start = TestSuite.now();
    this.on('start-section', name => {
      console.log(`${indent.join('')}${color('magenta', ' \u2022 ')}${name}`);
      indent.push('  ');
    });
    this.on('end-section', name => indent.pop());
    this.on('start', () => {
      start = TestSuite.now();
    });
    this.on('run-start', () => {
      start = TestSuite.now();
    });
    this.on('pass', name => {
      const end = TestSuite.now();
      const duration = end - start;
      console.log(`${indent.join('')}${color('green', ' \u2713 ')}${name} ${color('cyan', `(${ms(duration)})`)}`);
    });
    this.on('fail', (name, err) => {
      const end = TestSuite.now();
      const duration = end - start;
      console.log(indent.join('') +
                  color('red', ' \u2717 ') +
                  name +
                  color('cyan', ' (' + ms(duration) + ')'));
      console.log('');
      const errString = errorToString(err);
      console.log(errString.replace(/^/gm, `${indent.join('')}   `));
    });
    this.on('run-fail', err => {
      const end = TestSuite.now();
      const duration = end - start;
      console.log(`${indent.join('')}${color('red', ' \u2717 ')}run ${color('cyan', `(${ms(duration)})`)}`);
      console.log('');
      const errString = errorToString(err);
      console.log(errString.replace(/^/gm, `${indent.join('')}   `));
    });
  }

  addExit() {
    const name = this.name || 'tests';
    let start = TestSuite.now();
    this.on('suite-start', () => {
      start = TestSuite.now();
    });
    this.on('suite-pass', () => {
      console.log('');
      console.log(`Total duration ${ms(TestSuite.now() - start)}`);
      result.pass(name);
    });
    this.on('suite-fail', () => {
      console.log('');
      console.log(`Total duration ${ms(TestSuite.now() - start)}`);
      result.fail(name);
    });
  }
}

class TestCase {
  constructor(justRun, name, fn, options) {
    this.justRun = justRun;
    this.name = name;
    this.fn = fn;
    this.timeout = options.timeout || '20 seconds';
  }
}
class StackFrame {
  constructor(index, queue, name) {
    this.index = index;
    this.queue = queue;
    this.name = name;
  }
}

function errorToString(e) {
  const hasToString = e && typeof e.toString === 'function';
  const stack = e.stack;
  /* istanbul ignore else */
  if (stack && stack.includes(e.message) && stack.includes(e.name)) return stack;
  else return hasToString ? e.toString() : `${e}`;
}

module.exports = TestSuite;
