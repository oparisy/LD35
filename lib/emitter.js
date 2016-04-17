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

/** emitterPos should be an array */
function buildEngine (gl, opt) {
  
  if (!shader) {
    shader = glShader(gl,
        glslify('../shaders/flat.vert'),
        glslify('../shaders/flat.frag'))
  }

  var engine = new Engine(emit, update, discard, shader)
  engine.opt = opt
  
  // Ensure engine will emit a first particle ASAP
  engine.lastEmission = - opt.emissionDelay
  engine.elapsed = 0
  
  var toModel = model.toModel(gl)
  loader.loadObj('./assets/fireParticle.obj', './assets/fireParticle.mtl').then(toModel).then(function (model) {
    model.setup(model.geom.data.rawVertices)
    engine.particleModel = model
  })
  
  engine.updatePosition = function (newEmitterPos) {
    this.opt.emitterPos = [ newEmitterPos[0], newEmitterPos[1], newEmitterPos[2] ]
  }

  return engine
}

/** Return an array of new particles */
function emit(engine, particles, dt) {
  var result = []

  var opt = engine.opt
  engine.elapsed += dt
  var randomDelay = opt.emissionDelay * (1 + Math.random());
  if (engine.particleModel && ((engine.elapsed - engine.lastEmission) > randomDelay)) {
    var newp = { 'model': engine.particleModel }
    newp.pos = randomPosition(opt.emitterPos, opt.emitterRadius)
    newp.ttl = opt.minttl * (1 + Math.random())
    newp.speed = opt.minSpeed * (1 + Math.random())
    
    if (opt.fizzleScale) {
      // Will randomize in computeMatrix
      newp.scale = [opt.scale[0], opt.scale[1], opt.scale[2]]
    } else {
      // Randomize at particle creation
      newp.scale = [opt.scale[0] * (1+Math.random()), opt.scale[1] * (1+Math.random()), opt.scale[2] * (1+Math.random())]
    }

    newp.matrix = computeMatrix(newp, opt)

    result.push(newp)
    engine.lastEmission = engine.elapsed
  }

  return result
}

/** Modify particle in-place */
function update(engine, particle, dt) {
  particle.pos[1] += particle.speed
  particle.ttl -= dt
  particle.matrix = computeMatrix(particle, engine.opt)
}

/** Return true if particle must be discarded */
function discard(engine, particle, dt) {
  return particle.ttl <= 0
}

function computeMatrix(particle, opt) {
  var m = mat4.create()
  mat4.translate(m, m, vec3.fromValues(particle.pos[0], particle.pos[1], particle.pos[2]))
  if (opt.fizzleScale) {
    mat4.scale(m, m, vec3.fromValues(particle.scale[0] * (1+Math.random()), particle.scale[1] * (1+Math.random()), particle.scale[2] * (1+Math.random())))
  } else {
    mat4.scale(m, m, vec3.fromValues(particle.scale[0], particle.scale[1], particle.scale[2]))
  }
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
