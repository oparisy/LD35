/* jshint node: true */
/* jslint browser: true */
/* jslint asi: true */
'use strict'

var glShader = require('gl-shader')
var glslify  = require('glslify')
var loader = require('./loader.js')
var model = require('./model.js')
var mat4 = require('gl-mat4')
var vec3 = require('gl-vec3')

var Engine = require('./particles.js')

var shader

// Emitter parameters
var emissionDelay = 20

/** emitterPos should be an array */
function buildEngine (gl, emitterPos, emitterRadius) {
  if (!shader) {
    shader = glShader(gl,
        glslify('../shaders/flat.vert'),
        glslify('../shaders/flat.frag'))
  }

  var engine = new Engine(emit, update, discard, shader)
  engine.emitterPos = emitterPos
  engine.emitterRadius = emitterRadius
  
  // Ensure engine will emit a first particle ASAP
  engine.lastEmission = - emissionDelay
  engine.elapsed = 0
  
  var toModel = model.toModel(gl)
  loader.loadObj('./assets/fireParticle.obj', './assets/fireParticle.mtl').then(toModel).then(function (model) {
    model.setup(model.geom.data.rawVertices)
    engine.particleModel = model
  })

  return engine
}

/** Return an array of new particles */
function emit(engine, particles, dt) {
  var result = []
  engine.elapsed += dt
  var randomDelay = emissionDelay * (1 + Math.random());
  if (engine.particleModel && ((engine.elapsed - engine.lastEmission) > randomDelay)) {
    var newp = { 'model': engine.particleModel }
    newp.pos = randomPosition(engine.emitterPos, engine.emitterRadius)
    newp.ttl = 300 * (1 + Math.random())
    newp.speed = 0.1 * (1 + Math.random())
    newp.matrix = computeMatrix(newp)
    result.push(newp)
    engine.lastEmission = engine.elapsed
  }
  return result
}

/** Modify particle in-place */
function update(engine, particle, dt) {
  particle.pos[1] += particle.speed
  particle.ttl -= dt
  particle.matrix = computeMatrix(particle)
}

/** Return true if particle must be discarded */
function discard(engine, particle, dt) {
  return particle.ttl <= 0
}

function computeMatrix(particle) {
  var m = mat4.create()
  mat4.translate(m, m, vec3.fromValues(particle.pos[0], particle.pos[1], particle.pos[2]))
  mat4.scale(m, m, vec3.fromValues(4 * (1+Math.random()), 4 * (1+Math.random()), 4 * (1+Math.random())))
  return m
}

function randomPosition(emitterPos, emitterRadius) {
  var a = Math.random() * 2 * Math.PI
  var r = Math.random() * emitterRadius
  var dx = r * Math.cos(a)
  var dy = 0
  var dz = r * Math.sin(a)
  return [emitterPos[0] + dx, emitterPos[1] + dy, emitterPos[2] + dz]
}

module.exports = buildEngine
