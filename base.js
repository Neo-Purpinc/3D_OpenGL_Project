
"use strict"

//--------------------------------------------------------------------------------------------------------
// SKY SHADER (GLSL language)
//--------------------------------------------------------------------------------------------------------
var sky_vert =
`#version 300 es

layout(location = 0) in vec3 position_in;
out vec3 tex_coord;
uniform mat4 projectionviewMatrix;

void main()
{
	tex_coord = position_in;
	gl_Position = projectionviewMatrix * vec4(position_in, 1.0);
}  
`;

//--------------------------------------------------------------------------------------------------------
//--------------------------------------------------------------------------------------------------------
var sky_frag =
`#version 300 es

precision highp float;
in vec3 tex_coord;
out vec4 frag;
uniform samplerCube TU;

void main()
{	
	frag = texture(TU, tex_coord);
}
`;

//--------------------------------------------------------------------------------------------------------
// GLOBAL VARIABLES
//--------------------------------------------------------------------------------------------------------
// For the environnement
var prg_envMap = null;
var tex_envMap = null;
var sky_rend = null;
var sl_refl = null;

// GUI (graphical user interface)
// - light color
var slider_r;
var slider_g;
var slider_b;

//--------------------------------------------------------------------------------------------------------
// Initialize graphics objects and GL states
//--------------------------------------------------------------------------------------------------------
function init_wgl()
{
	ewgl.continuous_update = true;
	
	UserInterface.begin(); // name of html id
		UserInterface.use_field_set('H', "LIGHT Color");
			slider_r  = UserInterface.add_slider('R ', 0, 30, 30, update_wgl);
			UserInterface.set_widget_color(slider_r,'#ff0000','#ffcccc');
			slider_g  = UserInterface.add_slider('G ', 0, 30, 28, update_wgl);
			UserInterface.set_widget_color(slider_g,'#00bb00','#ccffcc');
			slider_b  = UserInterface.add_slider('B ', 0, 30, 25, update_wgl);
			UserInterface.set_widget_color(slider_b, '#0000ff', '#ccccff');
		UserInterface.end_use();
		sl_refl = UserInterface.add_slider("Reflection",0,100,30,update_wgl);
	UserInterface.end();
	
	
	// 1. Environnement map
	// CubeMap texture creation
	tex_envMap = TextureCubeMap();
	tex_envMap.load(["textures/skybox/skybox1/right.bmp","textures/skybox/skybox1/left.bmp",
	"textures/skybox/skybox1/top.bmp","textures/skybox/skybox1/bottom.bmp",
	"textures/skybox/skybox1/front.bmp","textures/skybox/skybox1/back.bmp"]).then(update_wgl);
	// shader prog to render the cubemap
	prg_envMap = ShaderProgram(sky_vert,sky_frag,'sky');
	// geometry for the cube map (texture cube map is map on a cube)
	sky_rend = Mesh.Cube().renderer(0, -1, -1);

	ewgl.scene_camera.set_scene_center(Vec3(0,0,0));

	gl.enable(gl.DEPTH_TEST);
}

//--------------------------------------------------------------------------------------------------------
// Render scene
//--------------------------------------------------------------------------------------------------------
function draw_wgl()
{
	gl.clearColor(0, 0, 0, 0);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Render environment map
	//-----------------------------------------------------------------------------------
	// gl.disable(gl.DEPTH_TEST);
	prg_envMap.bind();
	Uniforms.projectionviewMatrix = ewgl.scene_camera.get_matrix_for_skybox();
	Uniforms.TU = tex_envMap.bind(0);
	sky_rend.draw(gl.TRIANGLES);
	// gl.enable(gl.DEPTH_TEST);

	//-----------------------------------------------------------------------------------


	// Render terrain
	//-----------------------------------------------------------------------------------
	const projectionMatrix = ewgl.scene_camera.get_projection_matrix();
	//Uniforms.uProjectionMatrix = projectionMatrix;
	let viewMatrix = ewgl.scene_camera.get_view_matrix();
	// Uniforms.uViewMatrix = viewMatrix;
  let modelMatrix = Matrix.scale(0); // hard-coded "scale" to be able to see the 3D asset
	// Uniforms.uModelMatrix = modelMatrix;
	// - normal matrix
	// Uniforms.uNormalMatrix = mvm.inverse3transpose();
	// Uniforms.uNormalModel = modelMatrix.inverse3transpose();
	// Uniforms.uNormalView = viewMatrix.inverse3transpose();
	// - Light direction and intensity
	// Uniforms.uLightDirection = viewMatrix.transform(Vec3(200.0, 200.0, -200.0));
	// Uniforms.uLightIntensity = [slider_r.value, slider_g.value, slider_b.value];
	// - Camera position
	let cameraPosWorld = Matrix.mult(viewMatrix.inverse(), Vec4(0.0, 0.0, 0.0, 1.0));
	// Uniforms.uCameraPosW = cameraPosWorld;

	// For reflection
	Uniforms.TU = tex_envMap.bind(0);

	// Alpha blending (for transparency)
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
	gl.disable(gl.BLEND);
	//-----------------------------------------------------------------------------------
	// Reset GL state(s)
	gl.bindVertexArray(null); // not mandatory. For optimization, could be removed.
	gl.useProgram(null); // not mandatory. For optimization, could be removed.
}

//--------------------------------------------------------------------------------------------------------
// => Sylvain's API - call window creation with your customized "init_wgl()" and "draw_wgl()" functions
//--------------------------------------------------------------------------------------------------------
ewgl.launch_3d();
