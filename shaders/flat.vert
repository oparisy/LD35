precision mediump float;

attribute vec3 position;
attribute vec3 normal;

uniform mat3 normalMatrix;
uniform mat4 proj;
uniform mat4 view;
uniform mat4 model;

uniform vec3 color;

varying vec3 v_normal;

void main() {
  gl_Position = (
    proj *
    view *
	model *
    vec4(position, 1.0)
  );
  v_normal = (normalMatrix * normal).xyz;
}
