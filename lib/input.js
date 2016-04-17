/* jshint node: true */
/* jslint node: true */
/* jshint strict:false */
/* jslint browser: true */
/* jslint asi: true */
'use strict'

var GPControls = require('gp-controls')

var gamepad = GPControls({
    '<axis-left-x>': 'x',
  '<axis-left-y>': 'y',
  '<action 1>': 'swap',
  '<action 2>': 'toFire',
  '<action 3>': 'toWater'
})
var keyPressed = require('key-pressed')

function getInput () {
  var swapPressed = false;
  var toFire = false;
  var toWater = false;
  var padx = 0, pady = 0;

  // Gamepad
  gamepad.poll();
  if (gamepad.enabled) {
    padx = Math.abs(gamepad.inputs.x) < 0.25 ? 0 : gamepad.inputs.x;
    pady = Math.abs(gamepad.inputs.y) < 0.25 ? 0 : gamepad.inputs.y;
    swapPressed = gamepad.inputs.swap.pressed;
    toFire = gamepad.inputs.toFire.pressed;
    toWater = gamepad.inputs.toWater.pressed;
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
  toWater |= keyPressed("W");
  toFire |= keyPressed("F");

  return { padx: padx, pady: pady, action1: swapPressed, toFire: toFire, toWater: toWater }
}

module.exports = {
    getInput: getInput
}
