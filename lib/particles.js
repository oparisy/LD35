/* jshint node: true */
/* jslint browser: true */
/* jslint asi: true */
'use strict'

/*
  A very simple, modular particles emitter.
  A particle has a model matrix ("matrix"), a mesh ("model"), and emiter-specific parameters.
  The engine must be provided with:
  - a function emitting new particles,
  - a function updating the particles at each time step,
  - a function discarding particles.
*/

var Model = require('./model.js')
var drawModel = Model.draw

function Engine(emit, update, discard, shader) {
  this.emit = emit
  this.update = update
  this.discard = discard
  this.shader = shader
  this.particles = []
}

Engine.prototype.step = function(dt) {
  // Remove end of life particles
  var someDiscarded = false
  for (var i=0; i<this.particles.length; i++) {
    if (this.discard(this, this.particles[i], dt)) {
      this.particles[i] = undefined
      someDiscarded = true
    }
  }
  
  // Compact array if some particles were discarded
  if (someDiscarded) {
    var newArr = []
    for (i=0; i<this.particles.length; i++) {
      if (this.particles[i]) {
        newArr.push(this.particles[i])
      }
    }
    this.particles = newArr
  }
  
  // Update existing particles
  for (i=0; i<this.particles.length; i++) {
    this.update(this, this.particles[i], dt)
  }

  // Emit new particles
  var newParts = this.emit(this, this.particles, dt)
  for (i=0; i<newParts.length; i++) {
    this.particles.push(newParts[i]);
  }
}

Engine.prototype.draw = function(VMatrix, PMatrix) {
  for (var i=0; i<this.particles.length; i++) {
    var p = this.particles[i];
    if (p.color) {
      p.model.forceColor = p.color
    }
    drawModel(p.model, p.matrix, VMatrix, PMatrix, this.shader);
  }
}

module.exports = Engine
