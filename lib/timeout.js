'use strict';

const ms = require('ms');

module.exports = function timeout(val, timeout) {
  if (timeout === Infinity || timeout === null) {
    return Promise.resolve(val);
  }
  return new Promise(function (resolve, reject) {
    var timer = setTimeout(() => reject(new Error('Operation timed out')), ms(timeout.toString()))
    Promise.resolve(val).then(res => {
      clearTimeout(timer)
      resolve(res)
    }, err => {
      clearTimeout(timer)
      reject(err)
    });
  })
}
