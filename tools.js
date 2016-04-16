/* jshint node: true */
/* jslint node: true */
/* jshint strict:false */
/* jslint browser: true */
/* jslint asi: true */
'use strict'

var vec3 = require('gl-vec3')

function vec3FromArray (arr) {
  return vec3.fromValues(arr[0], arr[1], arr[2])
}

module.exports = {
    vec3FromArray: vec3FromArray
}