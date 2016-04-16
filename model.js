/* jshint node: true */
/* jslint browser: true */
/* jslint asi: true */
'use strict'

var Geom    = require('gl-geometry');
var assert = require('chai').assert;
var computeNormals = require('normals');
var Q = require('q')

/** Return a function returning the promise of a Model (a wrapper for a gl-geometry) */
function toModel (gl) {
	return function(objAndMtl) {
		var deferred = Q.defer()
		return Q.fcall(function () {
		    return new Model(objAndMtl, gl)
		});
	}
}

/* A model loaded from an .obj + .mtl and ready to be drawn */
function Model(objAndMtl, gl) {

	this.gl = gl;

	// Convert data to the expected format
	var vertices = convertVertices(objAndMtl.vertices);
	var tuple = convertFaces(objAndMtl.faces);
	var rawFaces = tuple[0], rawNormals = tuple[1]; // Could use destructuring assignment. Not sure of its availability
	
	// Duplicate vertices and normals indexes since there is one normal per face
	// (so a member of "vertices" will have as many normals as faces it contributes to)
	// See https://forums.khronos.org/showthread.php/7063-Texture-coordinates-per-face-index-instead-of-per-vertex
	// Having separate faces is mandatory to get a "flat" shading
	// TODO Have a look at hughsk/unindex-mesh
	// Note that we will not actually use the .obj normals since the .pc2 does not provide them for intermediary poses
	// To keep things simple each face "f" (numbered from 0) will use position and normal at index f, f+1 and f+2
	var faceIndices = [];
	for (var i=0; i<rawFaces.length; i++) {
		faceIndices.push([3*i, 3*i+1, 3*i+2]);
	}
	assert.equal(faceIndices.length, objAndMtl.faces.length);
	assert.equal(faceIndices.length, rawFaces.length);

	// Build rendering model (manage VAO, buffers and draw calls)
	// Note that this object will not actually be drawn (see render)
	this.geom = Geom(gl).attr('position', vertices).faces(faceIndices);
	
	// Attach topology and materials data to model for later use
	var data = {};
	data.rawVertices = vertices;
	data.rawFaces = rawFaces;
	data.rawNormals = objAndMtl.normals;
	data.faceNormals = rawNormals;
	data.faceIndices = faceIndices;
	data.materials = objAndMtl.materials;
	data.facesMaterials = objAndMtl.facesMaterialsIndex;
	this.geom.data = data;
	
	console.log('Raw model statistics: ' + vertices.length + ' vertices, ' + rawFaces.length + ' faces, ' + data.materials.length + ' materials');
	console.log('Materials:', data.materials);
	console.log('Faces Materials:', data.facesMaterials);

	// We want to be able to access those by name
	for (var j=0; j<data.materials.length; j++) {
		var material = data.materials[j];
		data.materials[material.name] = material;
	}

	// Debugging purpose
	data.baseVertices = vertices;

	console.log('Model set up');
}

// Call this to animate vertices (and at least once to compute normals)
Model.prototype.setup = function(currentFrameVertices) {
	var data = this.geom.data;

	// Duplicate positions (see comments in onModelLoaded)
	var positions = [];
	for (var j=0; j<data.rawFaces.length; j++) {
		var idx = data.rawFaces[j];
		positions.push(currentFrameVertices[idx[0]]);
		positions.push(currentFrameVertices[idx[1]]);
		positions.push(currentFrameVertices[idx[2]]);
	}
	
	// Compute normals per vertex
	var faceNormals = computeNormals.faceNormals(data.faceIndices, positions);
	var normals = [];
	for (var k=0; k<data.rawFaces.length; k++) {
		var faceNormal = faceNormals[k];
		normals.push(faceNormal);
		normals.push(faceNormal);
		normals.push(faceNormal);
	}

	// Update model with animation data
	this.geom.attr('position', positions).attr('normal', normals);
};

Model.prototype.draw = function(shader) {

	// Subdivide draw calls by material (we asked the obj exporter to sort faces accordingly)
	var data = this.geom.data;
	var fmat = data.facesMaterials;
	for (var i=0; i<fmat.length; i++) {
		var facesInfo = fmat[i];
		var firstFace = facesInfo.materialStartIndex;
		var nbFaces = ((i == fmat.length - 1) ? (data.faceIndices.length) : fmat[i + 1].materialStartIndex) - firstFace;

		var material = data.materials[facesInfo.materialName];
		var diffuse = material.diffuse;
		var color = [ parseFloat(diffuse[0]), parseFloat(diffuse[1]), parseFloat(diffuse[2]) ];
		shader.uniforms.v_color = color;

		var start = firstFace * 3;
		var stop = start + nbFaces * 3;

		this.geom.draw(this.gl.TRIANGLES, start, stop);
	}
};

// Convert vertices returned by obj-mtl-loader to a format suitable for gl-geometry
function convertVertices(vertices) {
	assert.isArray(vertices);

	if (vertices.length === 0) {
		return vertices;
	}
	
	assert.isArray(vertices[0]);
	
	if (vertices[0].length === 3) {
		return vertices;
	}
	
	if (vertices[0].length === 4) {
		// Only keep the first 3 components for each vertex
		var result = [];
		for (var i=0; i<vertices.length; i++) {
			result.push([ vertices[i][0], vertices[i][1], vertices[i][2] ]);
		}
		return result;
	}

	throw 'Unhandled vertices format';
}

// Convert vertice and normal indexes returned by obj-mtl-loader to a format suitable for gl-geometry
function convertFaces(faces) {
	assert.isArray(faces);
	
	var verticesIndex = [];
	var normalsIndex = [];
	for (var i=0; i<faces.length; i++) {
		var indices	= faces[i].indices;
		verticesIndex.push([ parseInt(indices[0])-1, parseInt(indices[1])-1, parseInt(indices[2])-1 ]);
		normalsIndex.push(parseInt(faces[i].normal)-1);
	}

	return [verticesIndex, normalsIndex];
}

module.exports = {
		toModel: toModel
}