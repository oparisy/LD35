/* jshint node: true */
/* jslint browser: true */
/* jslint asi: true */
'use strict'

var glClear = require('gl-clear')
var createContext = require('gl-context')
var fit = require('canvas-fit')
var glShader = require('gl-shader')
var glslify  = require('glslify')
var Q = require('q')
var mat4    = require('gl-mat4')
var mat3    = require('gl-mat3')
var vec3    = require('gl-vec3')
var quat    = require('gl-quat')
var turntableCamera = require('turntable-camera')

var loader = require('./loader.js')
var model = require('./model.js')

// Canvas & WebGL setup
var canvas = document.body.appendChild(document.createElement('canvas'))
window.addEventListener('resize', fit(canvas), false)
var gl = createContext(canvas, render)
var clear = glClear({color: [ 0, 0, 0, 1 ], depth: true})
gl.enable(gl.DEPTH_TEST)

// Load models(a "P" is a promise)
var toModel = model.toModel(gl)
var arenaP = loader.loadObj('./assets/arena.obj', './assets/arena.mtl').then(toModel)
var playerP = loader.loadObj('./assets/player.obj', './assets/player.mtl').then(toModel)
var modelsP = Q.all([ arenaP, playerP ]).then(allLoaded).done()

// Setup loaded models, position them at the origin at first
var models
function allLoaded(loaded) {
  models = loaded
  for (var i=0; i<models.length; i++) {
    var model = models[i]
    model.setup(model.geom.data.rawVertices);
    model.model = mat4.create()
  }
}

// Build a flat shader
var shader = glShader(gl,
    glslify('./shaders/flat.vert'),
	glslify('./shaders/flat.frag'))

// Projection and camera setup
var PMatrix = mat4.create()
var camera = turntableCamera()
camera.downwards = Math.PI * 0.2

//Main loop
function render () {
  var width = canvas.width
  var height = canvas.height

  gl.viewport(0, 0, width, height)
  clear(gl)

  if (!models) {
    return
  }

  mat4.perspective(PMatrix, Math.PI / 4, width / height, 0.001, 1000)

  // Update camera rotation angle
  camera.rotation = Date.now() * 0.0002

  // Model matrix is ID here
  var VMatrix = camera.view()
  // var MVMatrix = VMatrix // * ID
  // var MVPMatrix = mat4.create()
  // mat4.multiply(MVPMatrix, PMatrix, MVMatrix)

  for (var i=0; i<models.length; i++) {
    var model = models[i]
    var MMatrix = model.model

    var MVMatrix = mat4.create()
    mat4.multiply(MVMatrix, MMatrix, VMatrix)
    var normalMatrix = computeNormalMatrix(MVMatrix)
    
    model.geom.bind(shader);
    shader.uniforms.proj = PMatrix;
    shader.uniforms.view = VMatrix;
    shader.uniforms.normalMatrix = normalMatrix;
    
    shader.uniforms.model = MMatrix;
    model.draw(shader);
    model.geom.unbind();
  }
}

/** Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix */
function computeNormalMatrix (MVMatrix) {
  var normalMatrix = mat3.create()
  mat3.normalFromMat4(normalMatrix, MVMatrix)
  return normalMatrix
}