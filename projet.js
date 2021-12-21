
"use strict"

//--------------------------------------------------------------------------------------------------------
// VERTEX SHADERS (GLSL language)
//--------------------------------------------------------------------------------------------------------
var vertexSkyboxShader =
`#version 300 es

layout(location = 0) in vec3 position_in;
out vec3 tex_coord;
uniform mat4 uProjectionViewMatrix;

void main()
{
	tex_coord = position_in;
	gl_Position = uProjectionViewMatrix * vec4(position_in, 1.0);
}  
`;
var vertexLandscapeShader =
`#version 300 es

// INPUT
layout(location = 1) in vec2 position_in;

// UNIFORM
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
uniform sampler2D uSampler;

// OUTPUT
out vec2 v_textureCoord;

// MAIN PROGRAM
void main()
{
	gl_PointSize = 10.0;
	v_textureCoord = position_in;
	float terrainHeight = texture(uSampler,position_in).r;
	vec3 position = vec3(2.0 * position_in - 1.0, 0.0);
	position.z = terrainHeight;
	gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(position, 1.0);
}
`;
var vertexWaterShader = 
`#version 300 es
precision highp float;

// INPUT
layout(location = 1) in vec2 position_in;

// UNIFORM
uniform mat4 uProjectionMatrix;
uniform mat4 uViewMatrix;
uniform mat4 uModelMatrix;
// OUTPUT

// MAIN PROGRAM
void main()
{
	gl_PointSize = 10.0;
	vec3 position = vec3(2.0 * position_in - 1.0, 0.0);
	position.z = 0.3;
	gl_Position = uProjectionMatrix * uViewMatrix * uModelMatrix * vec4(position, 1.0);
}
`;
//--------------------------------------------------------------------------------------------------------
// FRAGMENT SHADERS (GLSL language)
//--------------------------------------------------------------------------------------------------------
var fragmentSkyboxShader =
`#version 300 es

precision highp float;
in vec3 tex_coord;
out vec4 frag;
uniform samplerCube uSamplerCube;

void main()
{	
	frag = texture(uSamplerCube, tex_coord);
}
`;
var fragmentLandscapeShader =
`#version 300 es
precision highp float;

// INPUT
in vec2 v_textureCoord;

// UNIFORM
uniform sampler2D uSampler2;

// OUTPUT
out vec4 oFragmentColor;

// MAIN PROGRAM
void main()
{	
	vec4 textureColor = texture(uSampler2,v_textureCoord);
	oFragmentColor = textureColor;
}
`;
var fragmentWaterShader =
`#version 300 es
precision highp float;

// OUTPUT
out vec4 oFragmentColor;

// MAIN PROGRAM
void main()
{
	oFragmentColor = vec4(0.0,0.0,1.0,1.0);
}
`;
//--------------------------------------------------------------------------------------------------------
// Global variables
//--------------------------------------------------------------------------------------------------------
var shaderSkyboxProgram = null;
var shaderLandscapeProgram = null;
var shaderWaterProgram = null;
var rendererSkybox = null;
var vaoLandscape = null;
var vaoWater = null;
var textureSkybox = null;
var heightmapLandscape = null;
var textureLandscape = null;
var nbMeshIndicesLandscape = 0;
var nbMeshIndicesWater = 0;
//--------------------------------------------------------------------------------------------------------
// Build mesh
//--------------------------------------------------------------------------------------------------------
function buildLandscape()
{
	var iMax = 100;
	var jMax = 100;

	gl.deleteVertexArray(vaoLandscape);

	// Create ande initialize a vertex buffer object (VBO) [it is a buffer of generic user data: positions, normals, texture coordinates, temperature, etc...]
	// - create data on CPU
	// - this is the geometry of your object)
	// - we store 2D positions as 1D array : (x0,y0,x1,y1,x2,y2,x3,y3)
	// - for a terrain: a grid of 2D points in [0.0;1.0]
	let data_positions = new Float32Array(iMax * jMax * 2);
	for (let j = 0; j < jMax; j++)
	{
	    for (let i = 0; i < iMax; i++)
	    {
			// x
			data_positions[ 2 * (i + j * iMax) ] = i / (iMax - 1);
			// y
			data_positions[ 2 * (i + j * iMax) + 1 ] = j / (jMax - 1);
	    }
	}
	// - create a VBO (kind of memory pointer or handle on GPU)
	let vbo_positions = gl.createBuffer();
	// - bind "current" VBO
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions); 
	// - allocate memory on GPU (size of data) and send data from CPU to GPU
	gl.bufferData(gl.ARRAY_BUFFER, data_positions, gl.STATIC_DRAW);
	// - reset GL state
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	
	// Create ande initialize an element buffer object (EBO) [it is a buffer of generic user data: positions, normals, texture coordinates, temperature, etc...]
	// - create data on CPU
	// - this is the geometry of your object)
	// - we store 2D position "indices" as 1D array of "triangle" indices : (i0,j0,k0, i1,j1,k1, i2,j2,k2, ...)
	let nbMeshQuads = (iMax - 1) * (jMax - 1);
	let nbMeshTriangles = 2 * nbMeshQuads;
	nbMeshIndicesLandscape = 3 * nbMeshTriangles;
	let ebo_data = new Uint32Array(nbMeshIndicesLandscape);
	let current_quad = 0;
	for (let j = 0; j < jMax - 1; j++)
	{
		//for (let i = 0; i < iMax; i++)
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
	let ebo = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	// - allocate memory on GPU (size of data) and send data from CPU to GPU
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ebo_data, gl.STATIC_DRAW);
	// - reset GL state
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	
	// Create ande initialize a vertex array object (VAO) [it is a "container" of vertex buffer objects (VBO)]
	// - create a VAO (kind of memory pointer or handle on GPU)
	vaoLandscape = gl.createVertexArray();
	// - bind "current" VAO
	gl.bindVertexArray(vaoLandscape);
	// - bind "current" VBO
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions);
	// - attach VBO to VAO
	// - tell how data is stored in "current" VBO in terms of size and format.
	// - it specifies the "location" and data format of the array of generic vertex attributes at "index" ID to use when rendering
	let vertexAttributeID = 1; // specifies the "index" of the generic vertex attribute to be modified
	let dataSize = 2; // 2 for 2D positions. Specifies the number of components per generic vertex attribute. Must be 1, 2, 3, 4.
	let dataType = gl.FLOAT; // data type
	gl.vertexAttribPointer(vertexAttributeID, dataSize, dataType,
	                        false, 0, 0); // unused parameters for the moment (normalized, stride, pointer)
	// - enable the use of VBO. It enable or disable a generic vertex attribute array
	gl.enableVertexAttribArray(vertexAttributeID);
	// - bind "current" EBO
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	
	// Reset GL states
	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null); // BEWARE: only unbind the VBO after unbinding the VAO !
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // BEWARE: only unbind the EBO after unbinding the VAO !

	// HACK...
	update_wgl();
}

function buildWater()
{
	var iMax = 100;
	var jMax = 100;

	gl.deleteVertexArray(vaoWater);

	// Create ande initialize a vertex buffer object (VBO) [it is a buffer of generic user data: positions, normals, texture coordinates, temperature, etc...]
	// - create data on CPU
	// - this is the geometry of your object)
	// - we store 2D positions as 1D array : (x0,y0,x1,y1,x2,y2,x3,y3)
	// - for a terrain: a grid of 2D points in [0.0;1.0]
	let data_positions = new Float32Array(iMax * jMax * 2);
	for (let j = 0; j < jMax; j++)
	{
	    for (let i = 0; i < iMax; i++)
	    {
			// x
			data_positions[ 2 * (i + j * iMax) ] = i / (iMax - 1);
			// y
			data_positions[ 2 * (i + j * iMax) + 1 ] = j / (jMax - 1);
	    }
	}
	// - create a VBO (kind of memory pointer or handle on GPU)
	let vbo_positions = gl.createBuffer();
	// - bind "current" VBO
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions); 
	// - allocate memory on GPU (size of data) and send data from CPU to GPU
	gl.bufferData(gl.ARRAY_BUFFER, data_positions, gl.STATIC_DRAW);
	// - reset GL state
	gl.bindBuffer(gl.ARRAY_BUFFER, null);
	
	// Create ande initialize an element buffer object (EBO) [it is a buffer of generic user data: positions, normals, texture coordinates, temperature, etc...]
	// - create data on CPU
	// - this is the geometry of your object)
	// - we store 2D position "indices" as 1D array of "triangle" indices : (i0,j0,k0, i1,j1,k1, i2,j2,k2, ...)
	let nbMeshQuads = (iMax - 1) * (jMax - 1);
	let nbMeshTriangles = 2 * nbMeshQuads;
	nbMeshIndicesWater = 3 * nbMeshTriangles;
	let ebo_data = new Uint32Array(nbMeshIndicesWater);
	let current_quad = 0;
	for (let j = 0; j < jMax - 1; j++)
	{
		//for (let i = 0; i < iMax; i++)
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
	let ebo = gl.createBuffer();
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	// - allocate memory on GPU (size of data) and send data from CPU to GPU
	gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, ebo_data, gl.STATIC_DRAW);
	// - reset GL state
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null);
	
	// Create ande initialize a vertex array object (VAO) [it is a "container" of vertex buffer objects (VBO)]
	// - create a VAO (kind of memory pointer or handle on GPU)
	vaoWater = gl.createVertexArray();
	// - bind "current" VAO
	gl.bindVertexArray(vaoWater);
	// - bind "current" VBO
	gl.bindBuffer(gl.ARRAY_BUFFER, vbo_positions);
	// - attach VBO to VAO
	// - tell how data is stored in "current" VBO in terms of size and format.
	// - it specifies the "location" and data format of the array of generic vertex attributes at "index" ID to use when rendering
	let vertexAttributeID = 1; // specifies the "index" of the generic vertex attribute to be modified
	let dataSize = 2; // 2 for 2D positions. Specifies the number of components per generic vertex attribute. Must be 1, 2, 3, 4.
	let dataType = gl.FLOAT; // data type
	gl.vertexAttribPointer(vertexAttributeID, dataSize, dataType,
	                        false, 0, 0); // unused parameters for the moment (normalized, stride, pointer)
	// - enable the use of VBO. It enable or disable a generic vertex attribute array
	gl.enableVertexAttribArray(vertexAttributeID);
	// - bind "current" EBO
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ebo);
	
	// Reset GL states
	gl.bindVertexArray(null);
	gl.bindBuffer(gl.ARRAY_BUFFER, null); // BEWARE: only unbind the VBO after unbinding the VAO !
	gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, null); // BEWARE: only unbind the EBO after unbinding the VAO !

	// HACK...
	update_wgl();
}
//--------------------------------------------------------------------------------------------------------
// Mes fonctions
//--------------------------------------------------------------------------------------------------------
function getTextures()
{
	heightmapLandscape = gl.createTexture();
    const image = new Image;
    image.src = 'textures/landscapeHeightmap.png';
    image.onload = () => {
        gl.bindTexture(gl.TEXTURE_2D,heightmapLandscape);
        gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,gl.RGBA,gl.UNSIGNED_BYTE,image);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T, gl.REPEAT);
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
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S, gl.REPEAT);
        gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T, gl.REPEAT);
        gl.bindTexture(gl.TEXTURE_2D,null);
    }
}
function bindTexturesLandscape()
{
	gl.bindVertexArray(vaoLandscape);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D,heightmapLandscape);
	gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D,textureLandscape);
}
function bindTexturesWater()
{
	gl.bindVertexArray(vaoWater);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D,heightmapWater);
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D,textureWater);
}
function resetStates()
{
	gl.bindVertexArray(null);
	gl.bindTexture(gl.TEXTURE_2D,null);
	gl.useProgram(null);
}
function setUniformsLandscape()
{
	Uniforms.uProjectionMatrix = ewgl.scene_camera.get_projection_matrix();
	Uniforms.uViewMatrix = ewgl.scene_camera.get_view_matrix();
    Uniforms.uSampler = 0;
    Uniforms.uSampler2 = 1;
	Uniforms.uModelMatrix = Matrix.rotateX(0);
}
function setUniformsWater()
{
	Uniforms.uProjectionMatrix = ewgl.scene_camera.get_projection_matrix();
	Uniforms.uViewMatrix = ewgl.scene_camera.get_view_matrix();
	// Uniforms.uSampler = 0;
	// Uniforms.uSampler2 = 1;
	Uniforms.uModelMatrix = Matrix.rotateX(0);
}
function setUniformsSkybox()
{
	Uniforms.uProjectionViewMatrix = ewgl.scene_camera.get_matrix_for_skybox();
	Uniforms.uSamplerCube = textureSkybox.bind(0);
}
function buildSkybox()
{
	textureSkybox = TextureCubeMap();
	textureSkybox.load(["textures/skybox/skybox1/right.bmp","textures/skybox/skybox1/left.bmp",
	"textures/skybox/skybox1/top.bmp","textures/skybox/skybox1/bottom.bmp",
	"textures/skybox/skybox1/front.bmp","textures/skybox/skybox1/back.bmp"]).then(update_wgl);
}
//--------------------------------------------------------------------------------------------------------
// Initialize graphics objects and GL states
//--------------------------------------------------------------------------------------------------------
function initSkybox()
{
	shaderSkyboxProgram = ShaderProgram(vertexSkyboxShader,fragmentSkyboxShader,'skybox shader');
	buildSkybox();
	rendererSkybox = Mesh.Cube().renderer(0, -1, -1);
}
function initLandscape()
{
	shaderLandscapeProgram = ShaderProgram(vertexLandscapeShader, fragmentLandscapeShader, 'landscape shader');
	buildLandscape();
}
function initWater()
{
	shaderWaterProgram = ShaderProgram(vertexWaterShader, fragmentWaterShader, 'water shader');
	buildWater();
}
function init_wgl()
{
	ewgl.continuous_update = true;
	getTextures();
	initSkybox();
	initLandscape();
	initWater();
	gl.clearColor(0, 0, 0 ,1);
	gl.enable(gl.DEPTH_TEST);
}
//--------------------------------------------------------------------------------------------------------
// Render scene
//--------------------------------------------------------------------------------------------------------
function drawSkybox()
{
	shaderSkyboxProgram.bind();
	setUniformsSkybox();
	rendererSkybox.draw(gl.TRIANGLES);
}
function drawLandscape()
{
	shaderLandscapeProgram.bind();
	setUniformsLandscape();
	bindTexturesLandscape();
	gl.drawElements(gl.TRIANGLES, nbMeshIndicesLandscape, gl.UNSIGNED_INT, 0);
}
function drawWater()
{
	shaderWaterProgram.bind();
	setUniformsWater();
	// bindTexturesWater();
	gl.drawElements(gl.TRIANGLES, nbMeshIndicesWater, gl.UNSIGNED_INT, 0);
}
function draw_wgl()
{
	gl.clear(gl.COLOR_BUFFER_BIT);
	drawSkybox();
	drawLandscape();
	drawWater();
	resetStates();
}
//--------------------------------------------------------------------------------------------------------
ewgl.launch_3d();
