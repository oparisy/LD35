precision mediump float;
uniform vec3 v_color;
varying vec3 v_normal;

void main() {

	vec3 normal = normalize(v_normal);
	vec4 color = vec4(0., 0., 0., 0.);
	vec4 diffuse = vec4(0., 0., 0., 1.);
	diffuse.rgb = v_color.rgb;
	diffuse.xyz *= max(dot(normal,vec3(0.,0.,1.)), 0.);
	color.xyz += diffuse.xyz;
	color = vec4(color.rgb, 1.0);
	gl_FragColor = color;

  //gl_FragColor = vec4(color, 1.0);
}
