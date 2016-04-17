precision mediump float;
uniform vec3 v_color;
varying vec3 v_normal;

void main() {
  gl_FragColor = vec4(v_color, 1.0);
}
