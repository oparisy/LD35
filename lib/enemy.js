/*
	An enemy has an "aggro" flag, a position and a speed.
	It is visually represented (controls) by a particle system.
	Behavior:
	without aggro :
	 - random walk (regularly interpolated direction, constant speed)
	 - a bias towards the origin when too far away
	with aggros :
	 - [charger] either "vibrate" (position) / "pulse" (color) for a small time, then "charge" at a fast speed,
	 - [follower] or direct tracking of player
    Different ennemies have different speeds
*/

/* jshint node: true */
/* jslint browser: true */
/* jslint asi: true */
'use strict'

var vec3 = require('gl-vec3')

function Enemy(opt, emitter) {
	this.opt = opt
	this.emitter = emitter
	this.position = vec3.fromValues(opt.initPos[0], opt.initPos[1], opt.initPos[2])
	this.aggro = false
	this.lastHit = undefined

	// Random initial direction and objective
	this.direction = randomPlaneUnitVector()
	this.objective = randomPlaneUnitVector()
}

function randomPlaneUnitVector() {
  var a = Math.random() * 2 * Math.PI
  return vec3.fromValues(Math.cos(a), 0, Math.sin(a))
}

Enemy.prototype.step = function(dt, player, playerState) {
	var opt = this.opt

  var toPlayer = vec3.create()
  vec3.subtract(toPlayer, player.pos, this.position)
  var playerDistance = vec3.length(toPlayer)
  
  if (playerDistance < opt.hitRadius) {
    var now = Date.now()
    if (!this.lastHit || (now - this.lastHit) >= opt.hitInterval) {
      this.lastHit = now
      opt.hit()
    }
  }

  // Some hysteresis
  if (this.aggro && playerDistance > opt.maxAggroDistance) {
    this.aggro = false
  }
	if (!this.aggro && playerDistance < opt.minAggroDistance) {
	  this.aggro = true
	}
	
  // Aggo mode: react to player position 
  if (this.aggro && opt.kind == 'Follower') {
    // Simply try to reach the player
    this.objective = vec3.clone(toPlayer)
    this.objective[1] = 0
    vec3.normalize(this.objective, this.objective)
    
    // If player is lit, flee
    if (playerState == 'fire') {
      vec3.scale(this.objective, this.objective, -1)
    }
  }
  
  if (this.aggro && opt.kind == 'Charger') {
    throw 'Not implemented'
  }

  // Random walk mode
  if (!this.aggro) {
    // If objective attained, pick another one
    var angle = vec3.angle(this.direction, this.objective)
    if (angle < opt.minAngleBeforeDirectionChange) {
      this.objective = randomPlaneUnitVector()
    }

    // If too far from center, abruptly change objective
    if (vec3.length(this.position) > opt.maxDistanceBeforeCentering) {
      // Dumb: point to center
      var toCenter = vec3.create()
      vec3.scale(toCenter, this.position, -1)
      toCenter[1] = 0
      vec3.normalize(toCenter, toCenter)
      this.objective = toCenter
    }
  }

  // Walk in current direction
  var dp = vec3.create()
  vec3.scale(dp, this.direction, opt.speed)
  var newPos = vec3.create()
  vec3.add(newPos, this.position, dp)
  this.position = newPos

  // Gradually lerp to objective direction
  vec3.lerp(this.direction, this.direction, this.objective, opt.rotSpeed)
	
	// Update emitter
	this.emitter.updatePosition(this.position)
}

module.exports = Enemy
