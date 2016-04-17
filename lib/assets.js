/* jshint node: true */
/* jslint node: true */
/* jshint strict:false */
/* jslint browser: true */
/* jslint asi: true */
'use strict'

var Q = require('q')
var mat4 = require('gl-mat4')
var vec3 = require('gl-vec3')

var loader = require('./loader.js')
var model = require('./model.js')
var tools = require('./tools.js')
var vec3FromArray = tools.vec3FromArray

function loadAssets (gl) {
  var result = {}

  //Load models and assets (a "P" is a promise)
  var toModel = model.toModel(gl)
  var arenaP = loader.loadObj('./assets/arena.obj', './assets/arena.mtl').then(toModel)
  var playerP = loader.loadObj('./assets/player.obj', './assets/player.mtl').then(toModel)
  var modelsP = Q.all([ arenaP, playerP ]).then(allLoaded)

  var torchP = loader.loadObj('./assets/torch.obj', './assets/torch.mtl').then(toModel)
  var woodpileP = loader.loadObj('./assets/woodpile.obj', './assets/woodpile.mtl').then(toModel)
  var sceneP = loader.loadText('./assets/scene.json', {'responseType': 'json'})
  Q.all([ torchP, woodpileP, sceneP ]).spread(parseScene)

  var energyP = loader.loadObj('./assets/energy.obj', './assets/energy.mtl').then(toModel).then(energyLoaded)
  var torchIconP = loader.loadObj('./assets/torchIcon.obj', './assets/torchIcon.mtl').then(toModel).then(torchIconLoaded)

  loader.loadObj('./assets/victory.obj', './assets/victory.mtl').then(toModel).then(victoryLoaded)
  loader.loadObj('./assets/gameover.obj', './assets/gameover.mtl').then(toModel).then(gameoverLoaded)


  // Setup loaded models, position them at the origin at first
  function allLoaded(loaded) {
    result.models = loaded
    for (var i=0; i<result.models.length; i++) {
      var model = result.models[i]
      model.setup(model.geom.data.rawVertices)
      model.model = mat4.create()
    }
    result.player = result.models[1]
    result.player.x = result.player.y = 0
    
    result.model[0].isGround = true
  }

  // Create geometrical entities from scene and loaded entities
  function parseScene (torch, woodpile, sceneText) {
    
    var sceneEntities = []
    sceneEntities.numTorches = 0

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
      
      if (entity.model == 'Torch') {
        sceneEntities.numTorches++;
    }
      
      // TODO Consider using the same world space as Blender (see wavefront export options)
      var modelMat = mat4.create()
      mat4.translate(modelMat, modelMat, vec3.fromValues(entity.pos[0], entity.pos[2], entity.pos[1]))
      mat4.rotateX(modelMat, modelMat, entity.eurot[0])
      mat4.rotateY(modelMat, modelMat, entity.eurot[1])
      mat4.rotateZ(modelMat, modelMat, entity.eurot[2])

      sceneEntities.push({'model': model, 'kind': entity.model, 'matrix': modelMat})
    }

    result.sceneEntities = sceneEntities
  }

  function energyLoaded (model) {
    result.energyModel = model
    model.setup(model.geom.data.rawVertices)
  }

  function torchIconLoaded (model) {
    result.torchIcon = model
    model.setup(model.geom.data.rawVertices)
  }
  
  function victoryLoaded (model) {
    result.victory = model
    model.setup(model.geom.data.rawVertices)
  }

  function gameoverLoaded (model) {
    result.gameover = model
    model.setup(model.geom.data.rawVertices)
  }

  return result
}

module.exports = loadAssets