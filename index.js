/* jshint node: true */
/* jslint node: true */
/* jshint strict:false */
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
var GPControls = require('gp-controls')

var gamepad = GPControls({
    '<axis-left-x>': 'x',
  '<axis-left-y>': 'y',
  '<action 1>': 'swap'
})
var keyPressed = require('key-pressed')

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
var player
function allLoaded(loaded) {
  models = loaded
  for (var i=0; i<models.length; i++) {
    var model = models[i]
    model.setup(model.geom.data.rawVertices);
    model.model = mat4.create()
  }
  player = models[1]
  player.x = player.y = 0
}

// Build a flat shader
var shader = glShader(gl,
  glslify('./shaders/flat.vert'),
	glslify('./shaders/flat.frag'))

// Projection and camera setup
var PMatrix = mat4.create()
var camera = turntableCamera()
camera.downwards = Math.PI * 0.2

// Main loop
var lastDate = Date.now();
function render () {
  // Compute the time elasped since last render (in ms)
  var now = Date.now();
  var step = now - lastDate;
  lastDate = now;
  
  // Time coefficient. 1 is the base, will double if frame rate doubles
  var coef = (step === 0) ? 1 : (18/step);

  var width = canvas.width
  var height = canvas.height

  gl.viewport(0, 0, width, height)
  clear(gl)

  if (!models) {
    return
  }

  // Player actions
  var swapPressed = false;
  var padx = 0, pady = 0;

  // Gamepad
  gamepad.poll();
  if (gamepad.enabled) {
    padx = Math.abs(gamepad.inputs.x) < 0.25 ? 0 : gamepad.inputs.x;
    pady = Math.abs(gamepad.inputs.y) < 0.25 ? 0 : gamepad.inputs.y;
    swapPressed = gamepad.inputs.swap.pressed;
  }

  // Keyboard
  if (keyPressed("<left>")) {
    padx = -1;
  }
  if (keyPressed("<right>")) {
    padx = +1;
  }
  if (keyPressed("<up>")) {
    pady = -1;
  }
  if (keyPressed("<down>")) {
    pady = +1;
  }
  swapPressed |= keyPressed("<space>");
  
  if (swapPressed) {
    console.log('Swap pressed')
  }

  // Move player; its (x,y) coordinate are on the ground plane
  // Note that in world space, Y is up 
  if (padx || pady) {
    player.x += 15*padx/(100*coef)
    player.y += 15*pady/(100*coef)
    mat4.translate(player.model, mat4.create(), vec3.fromValues(player.x, 0, player.y))
  }

  // TODO Track player with camera
  // Animate camera
  //var x=padx/(100*coef),y=pady/(100*coef);
  //camera.rotate([x,y], [0,0]);

  mat4.perspective(PMatrix, Math.PI / 4, width / height, 0.001, 1000)

  // Update camera rotation angle
  // camera.rotation = Date.now() * 0.0002

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