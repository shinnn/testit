'use strict'

const IS_BROWSER = require('is-browser');
if (!IS_BROWSER) {
  const r = require;
  const wtfnode = (r)('wtfnode');
}
const Suite = require('./lib/suite');
const defaultSuite = new Suite();
defaultSuite.addLogging();
defaultSuite.addExit();

let runTriggered = false;
function it(name, fn, options) {
  defaultSuite.addTest(name, fn, options);
  if (!runTriggered) {
    runTriggered = true;
    setImmediate(() => {
      defaultSuite.run().then(() => {
        if (!IS_BROWSER) {
          setTimeout(() => wtfnode.dump(), 5000).unref()
        }
      });
    });
  }
}
function run(fn, options) {
  defaultSuite.addCode(fn, options);
}
module.exports = it
module.exports.run = run;
module.exports.disableColors = defaultSuite.disableColors.bind(defaultSuite);
module.exports.on = defaultSuite.on.bind(defaultSuite);

module.exports.Suite = Suite;
