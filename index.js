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

var tools = require('./lib/tools.js')
var vec3FromArray = tools.vec3FromArray
var getInput = require('./lib/input.js').getInput
var drawModel = require('./lib/model.js').draw
var buildEmitter = require('./lib/emitter.js')
var Enemy = require('./lib/enemy.js')

// Commonly used
var i

// Canvas & WebGL setup
var canvas = document.body.appendChild(document.createElement('canvas'))
window.addEventListener('resize', fit(canvas), false)
var gl = createContext(canvas, render)
var clear = glClear({color: [ 0, 0, 0, 1 ], depth: true})
gl.enable(gl.DEPTH_TEST)

// Help in masking drawing artefacts (Z fighting) on some edges;
// see zNear comment below
gl.enable(gl.CULL_FACE)

// Load assets
var assets = require('./lib/assets')(gl)

// Build a flat shader
var shader = glShader(gl,
  glslify('./shaders/flat.vert'),
	glslify('./shaders/flat.frag'))

// Projection and camera setup
var camera = require('lookat-camera')()
camera.position = [-10, 50, 50]
camera.up = [0, 1, 0]
var PMatrix = mat4.create()

// Game constants
var initialEnergy = 3
var minFireEnergy = 4
var fireConsumptionMilli = 1500
var minResourceDist = 1.5
var minTorchDistance = 3
var torchFiringDelay = 2000
var woodpileEnergy = 3
var maxEnergyLevel = 16
var nbEnemies = 6
var playerSpeed = 20

// Game and player states
var energyLevel = initialEnergy // At most maxEnergyLevel
var waitForUnpress = false
var state = 'water'
var lastFireEnergyConsumption
var inProgressTorches = {}
var lightTorches = 0
var particleEngines = []
var enemies = spawnEnemies()
var gameover = false
var victory = false

// Main loop
var lastDate = Date.now()
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

  if (!assets.models) {
    return
  }

  // Player actions
  var input = getInput()
  var player = assets.player
  
  if (input.action1 && !waitForUnpress) {
    // Debugging purpose
    energyLevel++
    waitForUnpress = true
  }
  
  if (!input.action1) {
    waitForUnpress = false
  }

  if (input.toFire && state == 'water' && energyLevel >= minFireEnergy) {
    switchToFireState()
    lastFireEnergyConsumption = now
  }
  
  if (input.toWater && state == 'fire') {
      switchToWaterState()
  }
  
  // Regularly decrease energy when in fire mode
  if (state == 'fire' && (now - lastFireEnergyConsumption) > fireConsumptionMilli) {
    lastFireEnergyConsumption = now
    
    // Player cannot die of too low energy; just switch back to water
    if (energyLevel < minFireEnergy) {
      switchToWaterState()
    } else {
      energyLevel--
    }
  }
  
  // Interact with nearby wood piles
  var localWoods = findNear(assets.sceneEntities, 'Woodpile', minResourceDist, player.x, player.y)
  for (i=0; i<localWoods.length; i++) {
    if (state == 'water') {
      energyLevel = Math.min(energyLevel + woodpileEnergy, maxEnergyLevel)
      hideResource(localWoods[i])
    } else {
      setOnFire(localWoods[i])
    }
  }

  // Interact with nearby torches
  var toReset = []
  for (i=0; i<assets.sceneEntities; i++) {
    if (assets.sceneEntities[i].kind == 'Torch') {
      toReset[assets.sceneEntities[i]] = true
    }
  }
  var localTorches = findNear(assets.sceneEntities, 'Torch', minTorchDistance, player.x, player.y)
  for (i=0; i<localTorches.length; i++) {
    if (state == 'fire') {
      var torch = localTorches[i]
      toReset[torch] = false
      var firstContact = inProgressTorches[torch]
      if (firstContact) {
        // Have we been near this torch for long enough?
        if ((now - firstContact) >= torchFiringDelay) {
          setOnFire(torch)
        }
      } else {
        inProgressTorches[torch] = now
      }
    }
  }
  
  // Reset counters of torches we have moved away from
  for (i=0; i<assets.sceneEntities; i++) {
    if (toReset[assets.sceneEntities[i]]) {
      inProgressTorches[assets.sceneEntities[i]] = undefined
    }
  }

  // Move player; its (x,y) coordinate are on the ground plane
  // Note that in world space, Y is up
  if (input.padx || input.pady) {
    player.x += playerSpeed*input.padx/(100*coef)
    player.y += playerSpeed*input.pady/(100*coef)
  }
  
  // Update enemies behavior and position
  for (i=0; i<enemies.length; i++) {
    enemies[i].step(step, player, state)
  }
  
  // Update particles emitters
  for (i=0; i<particleEngines.length; i++) {
    particleEngines[i].step(step)
  }

  // Always compute player position matrix (easier to debug this way)
  mat4.translate(player.model, mat4.create(), vec3.fromValues(player.x, 0, player.y))
  
  // Temporary: visualize player state
  if (state == 'water') {
    // Darker since normals matrix have not been recomputed?
    mat4.rotateY(player.model, player.model, Math.PI)
  }

  // Track player with camera
  updateCamera(camera, player, coef)
  var VMatrix = camera.view()

  // Update perspective matrix
  // The zNear value should not be too small to avoid z fighting
  // See http://www.gamedev.net/topic/626726-how-to-solve-z-buffer-fighting/
  // Note that backface culling will mostly hide it
  mat4.perspective(PMatrix, Math.PI / 4, width / height, 0.1, 1000)

  // Draw player and ground
  for (i=0; i<assets.models.length; i++) {
    var model = assets.models[i]
    var MMatrix = model.model
    drawModel(model, MMatrix, VMatrix, PMatrix, shader)
  }

  // Draw assets (wood, torch)
  var sceneEntities = assets.sceneEntities
  if (sceneEntities) {
    for (var j=0; j<sceneEntities.length; j++) {
      var entity = sceneEntities[j]
      if (entity.hidden) {
        continue
      }
      drawModel(entity.model, entity.matrix, VMatrix, PMatrix, shader)
    }
  }
  
  // Draw particles
  for (i=0; i<particleEngines.length; i++) {
    particleEngines[i].draw(VMatrix, PMatrix)
  }

  // Finally, draw HUD
  if (assets.energyModel && assets.torchIcon) {
    drawHUD(width, height, energyLevel, assets)
  }

  // Tested last to ensure everything is drawn in its latest state (HUD...) 
  if (energyLevel <= 0) {
    gameover = true
  }

  if (lightTorches >= sceneEntities.numTorches) {
    victory = true
  }
}

function spawnEnemies() {
  var result = []
  for (i=0; i<nbEnemies; i++) {
    var spawnAngle = 2*Math.PI*Math.random()
    var spawnPosition = [30*Math.cos(spawnAngle), 0.5, 30*Math.sin(spawnAngle)]
    var emitteropt = {
        emitterPos: spawnPosition,
        emitterRadius: 1,
        emissionDelay: 20,
        minttl: 300,
        minSpeed: 0.1,
        fizzleScale: true,
        scale: [4, 4, 4]
    }
    var emitter = buildEmitter(gl, emitteropt)
    particleEngines.push(emitter)
    
    var enemyopt = {
      initPos: spawnPosition,
      speed: 0.2,
      rotSpeed: 0.01,
      minAggroDistance: 30,
      maxAggroDistance: 40,
      minAngleBeforeDirectionChange: Math.PI / 10,
      maxDistanceBeforeCentering: 150,
      kind: 'Follower',
      hitRadius: 1.2,
      hitInterval: 500,
      hit: hitPlayer
    }
    var enemy = new Enemy(enemyopt, emitter)
    result.push(enemy)
  }

  return result
}

function hitPlayer() {
  if (!gameover && !victory) {
    energyLevel--
  }
}

function hideResource(entity) {
  entity.hidden = true
}

function setOnFire(entity) {
  if (entity.onFire) {
    return
  }
  
  entity.onFire = true
  
  // TODO Another basis convention...
  var pos = [entity.matrix[12], entity.matrix[13], entity.matrix[14]]
  
  var fireopt = {
      emitterPos: pos,
      emitterRadius: 1,
      emissionDelay: 20,
      minttl: 300,
      minSpeed: 0.1,
      fizzleScale: true,
      scale: [4, 4, 4]
  }

  switch (entity.kind) {
    case 'Torch':
      lightTorches++
      pos[1] += 3
      particleEngines.push(buildEmitter(gl, fireopt))
      break;
    case 'Woodpile':
      pos[1] += 1
      particleEngines.push(buildEmitter(gl, fireopt))
  }

  console.log(entity.kind + ' set on fire, new emitter at ' + pos)
}

function switchToFireState() {
  state = 'fire'
}

function switchToWaterState() {
  state = 'water'
}

/** Brute force "nearest assets" search */
function findNear(sceneEntities, kind, minDistance, x, y) {
  var result = []
  for (var i=0; i<sceneEntities.length; i++) {
    var entity = sceneEntities[i]
    if (entity.kind != kind) {
      continue
    }
    
    var modelMat = entity.matrix
    
    // TODO Those different spaces are a pain
    var modelPos = vec3.fromValues(modelMat[12], modelMat[14], modelMat[13])

    var playerPos = vec3.fromValues(x, y, 0)
    var modelToPlayer = vec3.create()
    vec3.subtract(modelToPlayer, playerPos, modelPos)
    var distance = vec3.length(modelToPlayer)
    if (distance <= minDistance) {
      result.push(entity)
    }
  }
  return result
}

function drawHUD(width, height, energyLevel, assets) {
  // Change to an ortho matrix to draw HUD
  var POrtho = mat4.create()
  mat4.ortho(POrtho, 0, width, 0, height, -1000, 1000)
  // TODO This would be easier but shading and orientation issues
  // See http://stackoverflow.com/a/6091781/38096
  // mat4.ortho(POrtho, 0, width, height, 0, -1000, 1000)

  var VOrtho = mat4.create()

  // Draw energy
  var jaugeCenter = vec3.fromValues(100, height - 100, 0)

  var MHud
  for (var c=0; c<energyLevel; c++) {
    MHud = mat4.create()
    mat4.translate(MHud, MHud, jaugeCenter)
    mat4.rotateZ(MHud, MHud, - c * 2 * Math.PI / maxEnergyLevel)

    drawModel(assets.energyModel, MHud, VOrtho, POrtho, shader)
  }  

  // Draw torch icons
  for (c=0; c<lightTorches; c++) {
    var iconPos = vec3.fromValues(250 + c*80, height - 100, 0)
    MHud = mat4.create()
    mat4.translate(MHud, MHud, iconPos)
    drawModel(assets.torchIcon, MHud, VOrtho, POrtho, shader)
  }
}

function updateCamera(camera, player, coef) {
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
}
