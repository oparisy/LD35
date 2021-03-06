/* jshint node: true */
/* jslint node: true */
/* jshint strict:false */
/* jslint browser: true */
/* jslint asi: true */
'use strict'

var vec3 = require('gl-vec3')
var mat3 = require('gl-mat3')

/** Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix */
function computeNormalMatrix (MVMatrix) {
  var normalMatrix = mat3.create()
  mat3.normalFromMat4(normalMatrix, MVMatrix)
  return normalMatrix
}

module.exports = {
    computeNormalMatrix: computeNormalMatrix
}