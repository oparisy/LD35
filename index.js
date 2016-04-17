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
var GPControls = require('gp-controls')

var gamepad = GPControls({
    '<axis-left-x>': 'x',
  '<axis-left-y>': 'y',
  '<action 1>': 'swap'
})
var keyPressed = require('key-pressed')

var loader = require('./loader.js')
var model = require('./model.js')
var tools = require('./tools.js')
var vec3FromArray = tools.vec3FromArray

// Canvas & WebGL setup
var canvas = document.body.appendChild(document.createElement('canvas'))
window.addEventListener('resize', fit(canvas), false)
var gl = createContext(canvas, render)
var clear = glClear({color: [ 0, 0, 0, 1 ], depth: true})
gl.enable(gl.DEPTH_TEST)

// Help in masking drawing artefacts (Z fighting) on some edges;
// see zNear comment below
gl.enable(gl.CULL_FACE)

// Load models and assets (a "P" is a promise)
var toModel = model.toModel(gl)
var arenaP = loader.loadObj('./assets/arena.obj', './assets/arena.mtl').then(toModel)
var playerP = loader.loadObj('./assets/player.obj', './assets/player.mtl').then(toModel)
var modelsP = Q.all([ arenaP, playerP ]).then(allLoaded)

var torchP = loader.loadObj('./assets/torch.obj', './assets/torch.mtl').then(toModel)
var woodpileP = loader.loadObj('./assets/woodpile.obj', './assets/woodpile.mtl').then(toModel)
var sceneP = loader.loadText('./assets/scene.json', {'responseType': 'json'})
Q.all([ torchP, woodpileP, sceneP ]).spread(parseScene)

var energyP = loader.loadObj('./assets/energy.obj', './assets/energy.mtl').then(toModel).then(energyLoaded)

// Setup loaded models, position them at the origin at first
var models
var player
function allLoaded(loaded) {
  models = loaded
  for (var i=0; i<models.length; i++) {
    var model = models[i]
    model.setup(model.geom.data.rawVertices)
    model.model = mat4.create()
  }
  player = models[1]
  player.x = player.y = 0
}

// Create geometrical entities from scene and loaded entities
var sceneEntities = []
function parseScene (torch, woodpile, sceneText) {
  
  // TODO This boilerplate code should not be needed
  torch.setup(torch.geom.data.rawVertices)
  woodpile.setup(woodpile.geom.data.rawVertices)
  
  var modelsDict = {'Torch': torch, 'Woodpile': woodpile}

  // TODO Why isn't {'responseType': 'json'} enough?
  var scene = JSON.parse(sceneText)
  for (var i=0; i<scene.entities.length; i++) {
    var entity = scene.entities[i]
    var model = modelsDict[entity.model]
    if (!model) {
      console.log('Ignored scene entity "' + entity.model + '"')
      continue
    }
    
    // TODO Consider using the same world space as Blender (see wavefront export options)
    var modelMat = mat4.create()
    mat4.translate(modelMat, modelMat, vec3.fromValues(entity.pos[0], entity.pos[2], entity.pos[1]))
    mat4.rotateX(modelMat, modelMat, entity.eurot[0])
    mat4.rotateY(modelMat, modelMat, entity.eurot[1])
    mat4.rotateZ(modelMat, modelMat, entity.eurot[2])

    sceneEntities.push({'model': model, 'matrix': modelMat})
  }
  
  console.log('sceneEntities', sceneEntities)
}

var energyModel
function energyLoaded (model) {
  energyModel = model
  model.setup(model.geom.data.rawVertices)
}

// Build a flat shader
var shader = glShader(gl,
  glslify('./shaders/flat.vert'),
	glslify('./shaders/flat.frag'))

// Projection and camera setup
var camera = require('lookat-camera')()
camera.position = [-10, 50, 50]
camera.up = [0, 1, 0]
var PMatrix = mat4.create()

var energyLevel = 3 // At most 16
var waitForUnpress = false

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
  
  if (swapPressed && !waitForUnpress) {
    // Debugging purpose
    energyLevel++
    waitForUnpress = true
  }
  
  if (!swapPressed) {
    waitForUnpress = false
  }

  // Move player; its (x,y) coordinate are on the ground plane
  // Note that in world space, Y is up 
  if (padx || pady) {
    player.x += 15*padx/(100*coef)
    player.y += 15*pady/(100*coef)
  }

  // Always compute player position matrix (easier to debug this way)
  mat4.translate(player.model, mat4.create(), vec3.fromValues(player.x, 0, player.y))

  // Track player with camera
  camera.target = [player.x, 0, player.y]
  var cameraToPlayer = vec3.create()
  vec3.subtract(cameraToPlayer, vec3FromArray(camera.target), vec3FromArray(camera.position))
  var cameraPlayerDistance = vec3.length(cameraToPlayer)
  if (cameraPlayerDistance > 75 || cameraPlayerDistance < 60) {
    var target = cameraPlayerDistance > 75 ? 75 : 60
    var adjustment = vec3.create()
    vec3.scale(adjustment, cameraToPlayer, (cameraPlayerDistance - target) /(100*coef))
    adjustment[1] = 0 // We want to keep a constant height (altitude)
    var newCameraPos = vec3.fromValues(camera.position[0], camera.position[1], camera.position[2])
    vec3.add(newCameraPos, newCameraPos, adjustment)
    camera.position = [newCameraPos[0], newCameraPos[1], newCameraPos[2]]
  }
  var VMatrix = camera.view()

  // Update perspective matrix
  // The zNear value should not be too small to avoid z fighting
  // See http://www.gamedev.net/topic/626726-how-to-solve-z-buffer-fighting/
  // Note that backface culling will mostly hide it
  mat4.perspective(PMatrix, Math.PI / 4, width / height, 0.1, 1000)

  // Update camera rotation angle
  // camera.rotation = Date.now() * 0.0002

  // var MVMatrix = VMatrix // * ID
  // var MVPMatrix = mat4.create()
  // mat4.multiply(MVPMatrix, PMatrix, MVMatrix)

  for (var i=0; i<models.length; i++) {
    var model = models[i]
    var MMatrix = model.model
    drawModel(model, MMatrix, VMatrix, PMatrix)
  }

  if (sceneEntities) {
    for (var j=0; j<sceneEntities.length; j++) {
      var entity = sceneEntities[j]
      drawModel(entity.model, entity.matrix, VMatrix, PMatrix)
    }
  }

  if (energyModel) {
    // Change to an ortho matrix to draw HUD
    // Arguments are: ortho(out:mat4, left:number, right:number, bottom:number, top:number, near:number, far:number)
    // See http://stackoverflow.com/a/6091781/38096
    var POrtho = mat4.create()
    mat4.ortho(POrtho, 0, width, 0, height, -1000, 1000)
    // TODO This would be easier but shading and orientation issues    
    // mat4.ortho(POrtho, 0, width, height, 0, -1000, 1000)

    var VOrtho = mat4.create()

    var jaugeCenter = vec3.fromValues(100, height - 100, 0)

    for (var c=0; c<energyLevel; c++) {
      var MHud = mat4.create()
      mat4.translate(MHud, MHud, jaugeCenter)
      mat4.rotateZ(MHud, MHud, - c * 2 * Math.PI / 16)

      drawModel(energyModel, MHud, VOrtho, POrtho)
    }
  }
}

function drawModel(model, MMatrix, VMatrix, PMatrix) {
  var MVMatrix = mat4.create()
  mat4.multiply(MVMatrix, MMatrix, VMatrix)
  var normalMatrix = computeNormalMatrix(MVMatrix)
  
  model.geom.bind(shader)
  shader.uniforms.proj = PMatrix
  shader.uniforms.view = VMatrix
  shader.uniforms.normalMatrix = normalMatrix

  shader.uniforms.model = MMatrix
  model.draw(shader)
  model.geom.unbind()
}

/** Calculates a 3x3 normal matrix (transpose inverse) from the 4x4 matrix */
function computeNormalMatrix (MVMatrix) {
  var normalMatrix = mat3.create()
  mat3.normalFromMat4(normalMatrix, MVMatrix)
  return normalMatrix
}