
"use strict"

//--------------------------------------------------------------------------------------------------------
// SKYBOX SHADER
//--------------------------------------------------------------------------------------------------------
var vertexSkyboxShader =
`#version 300 es

// INPUT
layout(location = 0) in vec3 position_in;
// UNIFORM
uniform mat4 uProjectionViewMatrix;
// OUTPUT
out vec3 texCoord;

void main()
{
	texCoord = position_in;
	gl_Position = uProjectionViewMatrix * vec4(position_in, 1.0);
}  
`;
var fragmentSkyboxShader =
`#version 300 es
precision highp float;

// INPUT
in vec3 texCoord;
// UNIFORM
uniform samplerCube uSamplerCube;
// OUTPUT
out vec4 oFragmentColor;

void main()
{	
	oFragmentColor = texture(uSamplerCube, texCoord);
}
`;
//--------------------------------------------------------------------------------------------------------
// LANDSCAPE SHADER
//--------------------------------------------------------------------------------------------------------
var vertexLandscapeShader =
`#version 300 es

// INPUT
layout(location = 1) in vec2 position_in;
// UNIFORM
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat3 uNormalMatrix;
uniform sampler2D uSamplerHeightmapLandscape;
// OUTPUT
out vec2 vTexCoord;
out vec3 vPosition;
out vec3 vNormal;
out vec3 mPosition;
out vec3 mNormal;

// Cette fonction m'a été donné par Paul LABAYE (aucune implication de ma part dans cette dernière)
vec3 computeNormals(vec3 pos,sampler2D sampler){
	vec3 offset = vec3(1.0/(100.-1.0),1.0/(100.-1.0),0.0);
	float hL = texture(sampler, pos.xz - offset.xz).r;
    float hR = texture(sampler, pos.xz + offset.xz).r;
    float hD = texture(sampler, pos.xz - offset.zy).r;
    float hU = texture(sampler, pos.xz + offset.zy).r;
    return vec3(hL-hR, 2.0, hD-hU);
}
void main()
{
	vTexCoord = position_in;
	float terrainHeight = texture(uSamplerHeightmapLandscape,position_in).r;
	vec3 position = vec3(2.0 * position_in.x - 1.0, 0.0,2.0*position_in.y-1.0);
	position.y += terrainHeight;
	mPosition = position;
	vec3 normals = computeNormals(position,uSamplerHeightmapLandscape);
	mNormal = normalize(normals);
	vPosition = (uViewMatrix * vec4(position,1.0)).xyz;
	vNormal = normalize(uNormalMatrix * normals);
	gl_Position = uProjectionMatrix * uViewMatrix * vec4(position, 1.0);
}
`;

var fragmentLandscapeShader =
`#version 300 es
precision highp float;
#define M_PI 3.14159265358979

// INPUT
in vec2 vTexCoord;
in vec3 vPosition;
in vec3 vNormal;
in vec3 mPosition;
in vec3 mNormal;

// UNIFORM
uniform sampler2D uSamplerTextureLandscape;
uniform int uRef;
uniform float uWaterHeight;
uniform vec3 uLightPosition;

// OUTPUT
out vec4 oFragmentColor;

void main()
{	
	if((uRef == 1 && mPosition.y<uWaterHeight) || (uRef == 2 && mPosition.y>uWaterHeight)) discard;
	vec4 color = texture(uSamplerTextureLandscape, vTexCoord);
	vec3 Kd = color.rgb;
	vec3 lightDirection = uLightPosition - mPosition;
	lightDirection /= sqrt(dot(lightDirection, lightDirection));
	float diffuse = max(dot(mNormal, normalize(lightDirection)), 0.0);
	vec3 iD = 3.0*Kd*vec3(diffuse)/M_PI;
	oFragmentColor = vec4(iD, 1.0);
}
`;
//--------------------------------------------------------------------------------------------------------
// WATER SHADER
//--------------------------------------------------------------------------------------------------------
var vertexWaterShader = 
`#version 300 es
precision highp float;

// INPUT
layout(location = 0) in vec2 position_in;
// UNIFORM
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform float uWaterHeight;
// OUTPUT
out vec2 textureCoord;
out vec3 vPosition;
out vec3 mPosition;
out vec4 clipPosition;

void main()
{
	textureCoord = position_in;
	mPosition = vec3(position_in.x,uWaterHeight,position_in.y);
	vPosition = vec3(uViewMatrix * vec4(mPosition, 1.0));
	clipPosition = uProjectionMatrix * uViewMatrix * vec4(mPosition, 1.0);
	gl_Position = clipPosition;
}
`;

var fragmentWaterShader =
`#version 300 es
precision highp float;

#define M_PI 3.14159265358979

// INPUT
in vec2 textureCoord;
in vec3 vPosition;
in vec3 mPosition;
in vec4 clipPosition;

// UNIFORM
uniform vec3 uLightPosition;
uniform vec3 uCamPosition;
uniform float uTime;
uniform sampler2D uSamplerReflection; 
uniform sampler2D uSamplerRefraction;
uniform sampler2D uSamplerDistortion;
uniform sampler2D uSamplerNormales;

// OUTPUT
out vec4 oFragmentColor;

void main()
{
	vec3 n = normalize(vec3(0,1,0));
	vec3 viewDirection = normalize(uCamPosition - mPosition);
	float coeff = acos(dot(n,viewDirection))/M_PI;
	vec3 normal = texture(uSamplerNormales,textureCoord+uTime/30.0).rgb;
	normal.x = normal.x*2.0-1.0;
	normal.z = normal.z*2.0-1.0;
	normal.y = 10.0;
	normal = normalize(normal);

	vec2 distortion = texture(uSamplerDistortion, textureCoord+uTime/30.0).rg;
	vec2 NDC = (clipPosition.xy/clipPosition.w)/2.0+0.5;
	NDC += distortion/50.;

	vec2 coordReflection = vec2(NDC.x,NDC.y);
	vec2 coordRefraction = vec2(NDC.x,-NDC.y);
	vec4 reflection = texture(uSamplerReflection, coordReflection);
	vec4 refraction = texture(uSamplerRefraction, coordRefraction);
	vec3 color = mix(reflection, refraction, 1.0-2.5*coeff).rgb;
	vec3 lightDirection = normalize(uLightPosition - mPosition);
	vec3 halfDirection = normalize(viewDirection + lightDirection);
	vec3 ISpec = vec3(max(0.0, pow(dot(n, halfDirection), 128.0)));
	oFragmentColor = vec4(color + ISpec,1.0);
}
`;
//--------------------------------------------------------------------------------------------------------
// Global variables
//--------------------------------------------------------------------------------------------------------
// Skybox
var shaderSkyboxProgram = null;
var rendererSkybox = null;
var textureSkybox = null;

// Landscape
var shaderLandscapeProgram = null;
var vaoLandscape = null;
var heightmapLandscape = null;
var textureLandscape = null;
var nbMeshIndicesLandscape = 0;

// Water
var shaderWaterProgram = null;
var vaoWater = null;
var textureReflection = null;
var textureRefraction = null;
var textureDistortion = null;
var textureNormales = null;
var fboReflection = null;
var fboRefraction = null;
var fboWidth = 1024;
var fboHeight = 1024;

// UI
var sliderWaterHeight = null;
var sliderLightPosX = null;
var sliderLightPosY = null;
var sliderLightPosZ = null;

//--------------------------------------------------------------------------------------------------------
// Build mesh
//--------------------------------------------------------------------------------------------------------
function buildLandscape()
{
	gl.deleteVertexArray(vaoLandscape);
	var iMax = 100;
	var jMax = 100;
	let data_positions = new Float32Array(iMax * jMax * 2);
	for (let j = 0; j < jMax; j++)
	{
	    for (let i = 0; i < iMax; i++)
	    {
			data_positions[ 2 * (i + j * iMax) ] = i / (iMax - 1);
			data_positions[ 2 * (i + j * iMax) + 1 ] = j / (jMax - 1);
	    }
	}
	
	let nbMeshQuads = (iMax - 1) * (jMax - 1);
	let nbMeshTriangles = 2 * nbMeshQuads;
	nbMeshIndicesLandscape = 3 * nbMeshTriangles;
	let ebo_data = new Uint32Array(nbMeshIndicesLandscape);
	let current_quad = 0;
	for (let j = 0; j < jMax - 1; j++)
	{
	    for (let i = 0; i < iMax - 1; i++)
	    {
		   	// triangle 1
			ebo_data[ 6 * current_quad ] = i + j * iMax;
			ebo_data[ 6 * current_quad + 1 ] = (i + 1) + j * iMax;
			ebo_data[ 6 * current_quad + 2 ] = i + (j + 1) * iMax;
			// triangle 2
			ebo_data[ 6 * current_quad + 3 ] = i + (j + 1) * iMax;
			ebo_data[ 6 * current_quad + 4 ] = (i + 1) + j * iMax;
			ebo_data[ 6 * current_quad + 5 ] = (i + 1) + (j + 1) * iMax;
			current_quad++;
		}
	}

	let vbo_positions = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions); 
	gl.bufferData(gl.ARRAY_BUFFER, data_positions, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	let ebo = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ebo_data, gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	
	vaoLandscape = gl.createVertexArray();
	gl.bindVertexArray(vaoLandscape);
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions);
	gl.vertexAttribPointer(1, 2, gl.FLOAT,false, 0, 0); 
	gl.enableVertexAttribArray(1);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);

	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	update_wgl();
}

function buildWater()
{
	gl.deleteVertexArray(vaoWater);
	let vertices = [-1,-1,
					-1, 1,
					 1,-1,
					 1, 1];
	let indices =  [0,1,2,
					1,2,3];

	let vbo_positions = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions); 
	gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);

	let ebo = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, new Uint32Array(indices), gl.STATIC_DRAW);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	
	vaoWater = gl.createVertexArray();
	gl.bindVertexArray(vaoWater);
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions);
	gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(0);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);

	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	update_wgl();
}
//--------------------------------------------------------------------------------------------------------
// Mes fonctions
//--------------------------------------------------------------------------------------------------------
function getTexturesAndFBOs()
{
	// Landscape
		// Textures
	heightmapLandscape = gl.createTexture();
    const image = new Image;
    image.src = 'textures/landscapeHeightmap.png';
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D,heightmapLandscape);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D,null);
	};

    textureLandscape = gl.createTexture();
    const image2 = new Image;
    image2.src = 'textures/landscapeTexture.png';
    image2.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D,textureLandscape);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image2);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindTexture(gl.TEXTURE_2D,null);
    }
	// Water
		// Textures
	textureDistortion = gl.createTexture();
	const image3 = new Image;
	image3.src = 'textures/distortion_map.png';
	image3.onload = () => {
		gl.bindTexture(gl.TEXTURE_2D,textureDistortion);
		gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image3);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T, gl.REPEAT);
		gl.bindTexture(gl.TEXTURE_2D,null);
	}

	textureNormales = gl.createTexture();
	const image4 = new Image;
	image4.src = 'textures/normal_map.png';
	image4.onload = () => {
		gl.bindTexture(gl.TEXTURE_2D,textureNormales);
		gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image4);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S, gl.REPEAT);
		gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T, gl.REPEAT);
		gl.bindTexture(gl.TEXTURE_2D,null);
	}

	textureRefraction = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D,textureRefraction);
	gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,fboWidth,fboHeight,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
	gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T, gl.REPEAT);
	gl.bindTexture(gl.TEXTURE_2D,null);

	textureReflection = gl.createTexture();
	gl.bindTexture(gl.TEXTURE_2D,textureReflection);
	gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,fboWidth,fboHeight,0,gl.RGBA,gl.UNSIGNED_BYTE,null);
	gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER, gl.NEAREST);
	gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S, gl.REPEAT);
	gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T, gl.REPEAT);
	gl.bindTexture(gl.TEXTURE_2D,null);

		// FBOs
	fboReflection = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER,fboReflection);
	gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,textureReflection,0);
	gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
	gl.bindFramebuffer(gl.FRAMEBUFFER,null);

	fboRefraction = gl.createFramebuffer();
	gl.bindFramebuffer(gl.FRAMEBUFFER,fboRefraction);
	gl.framebufferTexture2D(gl.FRAMEBUFFER,gl.COLOR_ATTACHMENT0,gl.TEXTURE_2D,textureRefraction,0);
	gl.drawBuffers([gl.COLOR_ATTACHMENT0]);
	gl.bindFramebuffer(gl.FRAMEBUFFER,null);
}
function buildSkybox()
{
	textureSkybox = TextureCubeMap();
	textureSkybox.load(["textures/skybox/skybox1/right.bmp","textures/skybox/skybox1/left.bmp",
	"textures/skybox/skybox1/top.bmp","textures/skybox/skybox1/bottom.bmp",
	"textures/skybox/skybox1/front.bmp","textures/skybox/skybox1/back.bmp"]).then(update_wgl);
	rendererSkybox = Mesh.Cube().renderer(0, -1, -1);
}
function buildUI()
{
	UserInterface.begin();
	sliderWaterHeight = UserInterface.add_slider("Water Height",0,100,25,update_wgl);
	UserInterface.use_field_set('V', "Light Position");
		sliderLightPosX = UserInterface.add_slider("X",-100,100,10,update_wgl);
		sliderLightPosY = UserInterface.add_slider("Y",-100,100,50,update_wgl);
		sliderLightPosZ = UserInterface.add_slider("Z",-100,100,-30,update_wgl);
	UserInterface.end_use();
	UserInterface.end();
}
//--------------------------------------------------------------------------------------------------------
// Initialize graphics objects and GL states
//--------------------------------------------------------------------------------------------------------
function init_wgl()
{
	ewgl.continuous_update = true;
	buildUI();
	getTexturesAndFBOs();
	shaderSkyboxProgram = ShaderProgram(vertexSkyboxShader,fragmentSkyboxShader,'skybox shader');
	buildSkybox();
	shaderLandscapeProgram = ShaderProgram(vertexLandscapeShader, fragmentLandscapeShader, 'landscape shader');
	buildLandscape();
	shaderWaterProgram = ShaderProgram(vertexWaterShader, fragmentWaterShader, 'water shader');
	buildWater();
	gl.clearColor(0, 0, 0 ,1);
	gl.enable(gl.DEPTH_TEST);
}
//--------------------------------------------------------------------------------------------------------
// Render scene
//--------------------------------------------------------------------------------------------------------
function drawSkybox()
{
	shaderSkyboxProgram.bind();
	Uniforms.uProjectionViewMatrix = ewgl.scene_camera.get_matrix_for_skybox();
	Uniforms.uSamplerCube = textureSkybox.bind(0);
	rendererSkybox.draw(gl.TRIANGLES);
}
function drawLandscape(lightPos,waterH,ref)
{
	shaderLandscapeProgram.bind();
	Uniforms.uProjectionMatrix = ewgl.scene_camera.get_projection_matrix();
	Uniforms.uViewMatrix = ewgl.scene_camera.get_view_matrix();
	Uniforms.uNormalMatrix = Matrix.mult(ewgl.scene_camera.get_view_matrix(),Matrix.scale(1.0)).inverse3transpose();
	Uniforms.uRef = ref;
	Uniforms.uWaterHeight = waterH;
	Uniforms.uLightPosition = lightPos;
	gl.bindVertexArray(vaoLandscape);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D,heightmapLandscape);
	Uniforms.uSamplerHeightmapLandscape = 0;
	gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D,textureLandscape);
	Uniforms.uSamplerTextureLandscape = 1;
	gl.drawElements(gl.TRIANGLES, nbMeshIndicesLandscape, gl.UNSIGNED_INT, 0);
}
function drawWater(camPos,lightPos,waterH)
{
	shaderWaterProgram.bind();
	Uniforms.uProjectionMatrix = ewgl.scene_camera.get_projection_matrix();
	Uniforms.uViewMatrix = ewgl.scene_camera.get_view_matrix();
	Uniforms.uWaterHeight = waterH;
	Uniforms.uLightPosition = lightPos;
	Uniforms.uCamPosition = Vec3(camPos[0]);
	Uniforms.uTime = ewgl.current_time;
	gl.bindVertexArray(vaoWater);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D,textureReflection);
	Uniforms.uSamplerReflection = 0;
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D,textureRefraction);
	Uniforms.uSamplerRefraction = 1;
	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_2D,textureDistortion);
	Uniforms.uSamplerDistortion = 2;
	gl.activeTexture(gl.TEXTURE3);
	gl.bindTexture(gl.TEXTURE_2D,textureNormales);
	Uniforms.uSamplerNormales = 3;
	gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_INT, 0);
	
}
function firstPass(cameraInfos,lightPosition,waterHeight)
{
	gl.bindFramebuffer(gl.FRAMEBUFFER,fboReflection);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.viewport(0,0,fboWidth,fboHeight);
	
	var eye = Vec3(cameraInfos[0].xyz);
	eye.y = eye.y - 2*(eye.y - waterHeight);
	var center = Vec3(cameraInfos[1]);
	center.y = -center.y;
	var up = Vec3(0,1,0);
	ewgl.scene_camera.look(eye,center,up);
	drawSkybox();
	drawLandscape(lightPosition,waterHeight,1);
}
function secondPass(cameraInfos,lightPosition,waterHeight)
{
	gl.bindFramebuffer(gl.FRAMEBUFFER,fboRefraction);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.viewport(0,0,fboWidth,fboHeight);
	ewgl.scene_camera.look(cameraInfos[0],cameraInfos[1],Vec3(0,1,0));
	drawSkybox();
	drawLandscape(lightPosition,waterHeight,2);
}
function render(cameraInfos,lightPosition,waterHeight)
{
	gl.bindFramebuffer(gl.FRAMEBUFFER,null);
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
	gl.viewport(0,0,gl.canvas.width,gl.canvas.height);
	drawSkybox();
	drawLandscape(lightPosition,waterHeight,0);
	drawWater(cameraInfos,lightPosition,waterHeight);
}
function draw_wgl()
{
	var cameraInf = ewgl.scene_camera.get_look_info();
	var lightPos = [sliderLightPosX.value,sliderLightPosY.value,sliderLightPosZ.value];
	var waterH = sliderWaterHeight.value/100;

	firstPass(cameraInf,lightPos,waterH);
	secondPass(cameraInf,lightPos,waterH);
	render(cameraInf,lightPos,waterH);

	gl.bindVertexArray(null);
	gl.bindTexture(gl.TEXTURE_2D,null);
	gl.useProgram(null);
}
//--------------------------------------------------------------------------------------------------------
ewgl.launch_3d();
