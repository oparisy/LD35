/* jshint node: true */
/* jslint browser: true */
/* jslint asi: true */
'use strict'

var Q = require('q')
var ObjMtlLoader = require('obj-mtl-loader')

/** Return the promise of a loaded wavefront model (and its materials, if provided) */
function loadObj (objurl, mtlurl) {
	var deferred = Q.defer()

	function onLoaded (err, objAndMtl) {
	    if (err) {
	    	console.log(err)
	        deferred.reject(new Error(err))
	    } else {
	        deferred.resolve(objAndMtl);
	    }
	}
	
	if (mtlurl) {
		new ObjMtlLoader().load(objurl, mtlurl, onLoaded)
	} else {
		new ObjMtlLoader().load(objurl, onLoaded)
	}

	return deferred.promise
}

module.exports = {
		loadObj: loadObj
}