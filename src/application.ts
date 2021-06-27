// WebGL
let canvas: HTMLCanvasElement;
let gl: WebGLRenderingContext;
let program: WebGLProgram;

// Light Properties
const lightPosition = [1, 1, 1, 0];
const lightAmbient = [0.2, 0.2, 0.2, 1];
const lightDiffuse = [1, 1, 1, 1];
const lightSpecular = [1, 1, 1, 1];

// Controls
let animationCheckbox: HTMLInputElement;
let phongCheckbox: HTMLInputElement;
let animationSpeed: HTMLInputElement;

// Animation: Degree to rotate about the Y axis
let degree = 0;
// Animation:Amount to bounce up or down
let variance = 0;

// Initialize
window.onload = function () {
	canvas = <HTMLCanvasElement>document.getElementById("webgl");
	animationSpeed = <HTMLInputElement>document.getElementById("animationSpeed");
	animationCheckbox = <HTMLInputElement>document.getElementById("animationCheckbox");
	phongCheckbox = <HTMLInputElement>document.getElementById("phongCheckbox");

	gl = WebGLUtils.setupWebGL(canvas, null);
	if (!gl) alert("WebGL isn't available");

	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.clearColor(0, 0, 0, 1.0);

	gl.enable(gl.DEPTH_TEST);

	program = initShaders(gl, "vShader", "fShader");
	gl.useProgram(program);

	// // Get info from link
	// let pointsArray: number[][] = [];
	//
	// // vPosition
	// gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	// gl.bufferData(gl.ARRAY_BUFFER, pointsArray, gl.STATIC_DRAW);
	// const vPosition = gl.getAttribLocation(program, "vPosition");
	// gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
	// gl.enableVertexAttribArray(vPosition);
	//
	// // vNormal
	// gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	// gl.bufferData(gl.ARRAY_BUFFER, flatten(normalsArrays[+sphereLOD.value]), gl.STATIC_DRAW);
	// const vNormalPosition = gl.getAttribLocation(program, "vNormal");
	// gl.vertexAttribPointer(vNormalPosition, 4, gl.FLOAT, false, 0, 0);
	// gl.enableVertexAttribArray(vNormalPosition);
	//
	// // Light Calculation
	// gl.uniform4fv(gl.getUniformLocation(program, "ambientProduct"), flatten(mult(lightAmbient, materialAmbient)));
	// gl.uniform4fv(gl.getUniformLocation(program, "diffuseProduct"), flatten(mult(lightDiffuse, materialDiffuse)));
	// gl.uniform4fv(gl.getUniformLocation(program, "specularProduct"), flatten(mult(lightSpecular, materialSpecular)));
	// gl.uniform4fv(gl.getUniformLocation(program, "lightPosition"), flatten(lightPosition));
	// gl.uniform1f(gl.getUniformLocation(program, "shininess"), materialShininess);

	render();
}

// Animation
function render() {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Model, View, Projection Matrices
	let viewMatrix = lookAt(mult(
		mat3(Math.cos(radians(degree)), 0, Math.sin(radians(degree)),
			0, 1, 0,
			-Math.sin(radians(degree)), 0, Math.cos(radians(degree))),
		[0, variance, 0]), [0, 0, 0], [0, 1, 0]);
	gl.uniformMatrix4fv(gl.getUniformLocation(program, "projectionMatrix"), false, flatten(perspective(
		(<HTMLInputElement>document.getElementById("fieldOfViewY")).value, canvas.width / canvas.height, 0.000001,
		(<HTMLInputElement>document.getElementById("perspectiveFar")).value)));

	// Animation based on rendering ticks: (not relative to time, progresses one step per frame)
	if (animationCheckbox.checked) {
		if (degree > 360) degree -= 360;
		else degree += +animationSpeed.value;
		if (variance > 3) variance -= 3;
		else variance += 3 * (+animationSpeed.value / 360);
		requestAnimationFrame(render);
	}
}

// switch lighting modes
function switchShading() {
	render;
}

// Keyboard Shortcuts
window.onkeypress = function (event: { key: any; }) {
	switch (event.key) {
		// Toggle between Gouraud shading and Phong shading
		case "l":
		case "L":
			phongCheckbox.checked = !phongCheckbox.checked;
			switchShading();
			break;
		// Toggle animation
		case "c":
		case "C":
			animationCheckbox.checked = !animationCheckbox.checked;
			render();
			break;
		// Change animation speed with numbers
		case "1":
			animationSpeed.value = "1";
			break;
		case "2":
			animationSpeed.value = "2";
			break;
		case "3":
			animationSpeed.value = "3";
			break;
		case "4":
			animationSpeed.value = "4";
			break;
		case "5":
			animationSpeed.value = "5";
			break;
		case "6":
			animationSpeed.value = "6";
			break;
		case "7":
			animationSpeed.value = "7";
			break;
		case "8":
			animationSpeed.value = "8";
			break;
		case "9":
			animationSpeed.value = "9";
			break;
		case "0":
			animationSpeed.value = "10";
			break;
		// Super Reset
		case "r":
		case "R":
			animationCheckbox.checked = false;
			phongCheckbox.checked = true;
			animationSpeed.value = "1";
			switchShading();
			break;
		default:
			break;
	}
}
