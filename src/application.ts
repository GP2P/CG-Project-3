// WebGL
let canvas: HTMLCanvasElement;
let gl: WebGLRenderingContext;
let programCurrent: WebGLProgram;
let programGouraud: WebGLProgram;
let programPhong: WebGLProgram;

// Data
let onFloor: number;
let trianglesArrays: (number[][])[] = [];
let normalsArrays: (number[][])[] = [];
let wireframeArrays: (number[][])[] = [];
let pathsArrays: (number[][])[] = [];

// Light Properties
const lightPosition = [1, 1, 1, 0];
const lightAmbient = [0.2, 0.2, 0.2, 1];
const lightDiffuse = [1, 1, 1, 1];
const lightSpecular = [1, 1, 1, 1];

// Material Properties
const materialAmbient = [1, 0, 1, 1];
let materialDiffuse = [1, 0.8, 0, 1];
const materialSpecular = [1, 1, 1, 1];
const materialShininess = 20.0;

// Controls
let wireframeCheckbox: HTMLInputElement;
let animationCheckbox: HTMLInputElement;
let phongCheckbox: HTMLInputElement;
let sphereOnlyCheckBox: HTMLInputElement;
let animationSpeed: HTMLInputElement;
let sphereLOD: HTMLInputElement;
let pathLOD: HTMLInputElement;
let ballColor: HTMLInputElement;

// Animation
let tick = 0;

// Initialize
window.onload = function init() {
	canvas = <HTMLCanvasElement>document.getElementById("webgl");
	animationSpeed = <HTMLInputElement>document.getElementById("animationSpeed");
	sphereLOD = <HTMLInputElement>document.getElementById("sphereLOD");
	pathLOD = <HTMLInputElement>document.getElementById("pathLOD");
	wireframeCheckbox = <HTMLInputElement>document.getElementById("wireframeCheckbox");
	animationCheckbox = <HTMLInputElement>document.getElementById("animationCheckbox");
	phongCheckbox = <HTMLInputElement>document.getElementById("phongCheckbox");
	sphereOnlyCheckBox = <HTMLInputElement>document.getElementById("sphereOnlyCheckBox");
	ballColor = <HTMLInputElement>document.getElementById("ballColor");

	// Listens for ballColor input and change colors
	ballColor.oninput = function () {
		if (ballColor.value == null || ballColor.value == "") {
			materialDiffuse = [1, 0.8, 0, 1];
		} else {
			materialDiffuse[0] = parseInt(ballColor.value.substr(1, 2), 16) / 255;
			materialDiffuse[1] = parseInt(ballColor.value.substr(3, 2), 16) / 255;
			materialDiffuse[2] = parseInt(ballColor.value.substr(5, 2), 16) / 255;
		}
		shapeChange();
	}

	gl = WebGLUtils.setupWebGL(canvas, null);
	if (!gl) alert("WebGL isn't available");

	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.clearColor(0, 0, 0, 1.0);

	gl.enable(gl.DEPTH_TEST);

	programGouraud = initShaders(gl, "vShader", "fShader");
	programPhong = initShaders(gl, "vShaderPhong", "fShaderPhong");

	makeTetrahedrons();
	makePaths();

	shaderChange();
	shapeChange();
}

// Only called when changing between Wireframe, Gouraud and Phong
function shaderChange() {
	// Switch WebGL Program
	if (phongCheckbox.checked) {
		programCurrent = programPhong;
		gl.useProgram(programCurrent);
	} else {
		programCurrent = programGouraud;
		gl.useProgram(programCurrent);
	}

	shapeChange();
}

// Only called when the geometry has to change, or when shaders change
function shapeChange() {
	// vPosition
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());

	// Change passed array
	if (wireframeCheckbox.checked) {
		gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from([...flatten(wireframeArrays[+sphereLOD.value]), ...flatten(pathsArrays[+pathLOD.value])]), gl.STATIC_DRAW);
	} else {
		gl.bufferData(gl.ARRAY_BUFFER, Float32Array.from([...flatten(trianglesArrays[+sphereLOD.value]), ...flatten(pathsArrays[+pathLOD.value])]), gl.STATIC_DRAW);
	}
	const vPosition = gl.getAttribLocation(programCurrent, "vPosition");
	gl.vertexAttribPointer(vPosition, 4, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(vPosition);

	if (!wireframeCheckbox.checked) {
		// vNormal
		gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
		gl.bufferData(gl.ARRAY_BUFFER, flatten(normalsArrays[+sphereLOD.value]), gl.STATIC_DRAW);
		const vNormalPosition = gl.getAttribLocation(programCurrent, "vNormal");
		gl.vertexAttribPointer(vNormalPosition, 4, gl.FLOAT, false, 0, 0);
		gl.enableVertexAttribArray(vNormalPosition);

		// Light Calculation
		gl.uniform4fv(gl.getUniformLocation(programCurrent, "ambientProduct"), flatten(mult(lightAmbient, materialAmbient)));
		gl.uniform4fv(gl.getUniformLocation(programCurrent, "diffuseProduct"), flatten(mult(lightDiffuse, materialDiffuse)));
		gl.uniform4fv(gl.getUniformLocation(programCurrent, "specularProduct"), flatten(mult(lightSpecular, materialSpecular)));
		gl.uniform4fv(gl.getUniformLocation(programCurrent, "lightPosition"), flatten(lightPosition));
		gl.uniform1f(gl.getUniformLocation(programCurrent, "shininess"), materialShininess);
	}

	// Render, but avoid double rendering
	if (!animationCheckbox.checked || sphereOnlyCheckBox.checked) render();
}

// Only called when shaders change, geometry change, and... animation
function render() {
	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Debug: Tick Value
	(<HTMLInputElement>document.getElementById("tickValue")).innerText = String(tick);

	// Animation based on frames:
	// (not relative to time, progresses one step per frame)

	let divNum = Math.pow(2, (8 - +pathLOD.value));
	// Adjust Tick to offset slopped starting points of different subdivision numbers
	// (to eliminate animation jumping)
	let adjustedTick: number;
	if (+pathLOD.value == 0) adjustedTick = tick;
	else adjustedTick = tick - (0.5 * (Math.pow(2, +pathLOD.value) - 1) * divNum);
	// Avoids index out of bound
	if (adjustedTick > 1534) adjustedTick -= 1535;
	if (adjustedTick < 0) adjustedTick += 1535;
	// Debug: Adjusted Tick Value
	(<HTMLInputElement>document.getElementById("adjustedTickValue")).innerText = String(adjustedTick);

	let extraMultiplier = (adjustedTick % divNum) / divNum;
	let lineIndex = (adjustedTick / divNum - extraMultiplier);
	let nextLineIndex = lineIndex + 1;
	// Check for loop
	let length = pathsArrays[+pathLOD.value].length;
	if (lineIndex > length - 1) lineIndex -= length;
	if (lineIndex < 0) lineIndex += length;
	if (nextLineIndex > length - 1) nextLineIndex -= length;
	if (nextLineIndex < 0) nextLineIndex += length;
	// Debug: Line Composition
	(<HTMLInputElement>document.getElementById("lineComposition")).innerText = String((1 - extraMultiplier).toFixed(3)) + " × line " + String(lineIndex) + " + " + String(extraMultiplier.toFixed(3)) + " × line " + nextLineIndex;
	// Calculates transformation values
	let animationX = ((1 - extraMultiplier) * pathsArrays[+pathLOD.value][lineIndex][0]) + (extraMultiplier * pathsArrays[+pathLOD.value][nextLineIndex][0]);
	let animationY = ((1 - extraMultiplier) * pathsArrays[+pathLOD.value][lineIndex][1]) + (extraMultiplier * pathsArrays[+pathLOD.value][nextLineIndex][1]);
	let animationZ = ((1 - extraMultiplier) * pathsArrays[+pathLOD.value][lineIndex][2]) + (extraMultiplier * pathsArrays[+pathLOD.value][nextLineIndex][2]);

	// Model, View, Projection Matrices
	let eyeZ = +(<HTMLInputElement>document.getElementById("cameraDistance")).value;
	let viewMatrix = lookAt([0, 0, eyeZ], [0, 0, 0], [0, 1, 0]);
	let modelMatrix = translate(animationX, animationY, animationZ - 5);
	if (sphereOnlyCheckBox.checked) {
		viewMatrix = lookAt([0, 0, 3], [0, 0, 0], [0, 1, 0]);
		modelMatrix = translate(0, 0, 0);
	}
	gl.uniformMatrix4fv(gl.getUniformLocation(programCurrent, "projectionMatrix"), false, flatten(perspective(
		(<HTMLInputElement>document.getElementById("fieldOfViewY")).value, canvas.width / canvas.height, 0.000001,
		(<HTMLInputElement>document.getElementById("perspectiveFar")).value)));

	// Drawing
	if (wireframeCheckbox.checked) {
		// Set color mode to white
		gl.uniform1f(gl.getUniformLocation(programCurrent, "doWireframe"), 1);
		// Set modelView to animated
		gl.uniformMatrix4fv(gl.getUniformLocation(programCurrent, "modelViewMatrix"), false, flatten(mult(viewMatrix, modelMatrix)));
		// Draw wireframe
		gl.drawArrays(gl.LINES, 0, wireframeArrays[+sphereLOD.value].length);
		// Set modelView to view
		gl.uniformMatrix4fv(gl.getUniformLocation(programCurrent, "modelViewMatrix"), false, flatten(mult(viewMatrix, translate(0, 0, -5))));
		// Draw path
		if (!sphereOnlyCheckBox.checked) gl.drawArrays(gl.LINE_STRIP, wireframeArrays[+sphereLOD.value].length, pathsArrays[+pathLOD.value].length);
	} else {
		// Enable vNormal
		gl.enableVertexAttribArray(gl.getAttribLocation(programCurrent, "vNormal"));
		// Set modelView to animated
		gl.uniformMatrix4fv(gl.getUniformLocation(programCurrent, "modelViewMatrix"), false, flatten(mult(viewMatrix, modelMatrix)));
		// Set color mode to lit
		gl.uniform1f(gl.getUniformLocation(programCurrent, "doWireframe"), 0);
		// Draw triangles
		gl.drawArrays(gl.TRIANGLES, 0, trianglesArrays[+sphereLOD.value].length);
		// Disable vNormal
		gl.disableVertexAttribArray(gl.getAttribLocation(programCurrent, "vNormal"));
		// Set modelView to view
		gl.uniformMatrix4fv(gl.getUniformLocation(programCurrent, "modelViewMatrix"), false, flatten(mult(viewMatrix, translate(0, 0, -5))));
		// Set color mode to white
		gl.uniform1f(gl.getUniformLocation(programCurrent, "doWireframe"), 1);
		// Draw path
		if (!sphereOnlyCheckBox.checked) gl.drawArrays(gl.LINE_STRIP, trianglesArrays[+sphereLOD.value].length, pathsArrays[+pathLOD.value].length);
	}

	// Animation based on rendering ticks: (not relative to time, progresses one step per frame)
	if (animationCheckbox.checked && !sphereOnlyCheckBox.checked) {
		if (tick > 1534) tick -= 1535;
		else tick += +animationSpeed.value;
		requestAnimationFrame(render);
	}
}

// Only called when page loads
function makeTetrahedrons() {
	// Tetrahedron Values
	let a = [0, 0, -1, 1];
	let b = [0, 0.942809, 0.333333, 1];
	let c = [-0.816497, -0.471405, 0.333333, 1];
	let d = [0.816497, -0.471405, 0.333333, 1];

	// Initialize arrays of arrays
	trianglesArrays = [];
	trianglesArrays.push([]);
	normalsArrays = [];
	normalsArrays.push([]);
	wireframeArrays = [];
	wireframeArrays.push([]);

	// Loop through "floor" 1 to 8 to create arrays
	for (onFloor = 1; onFloor < 9; onFloor++) {
		// Creates the new "floor"
		trianglesArrays.push([]);
		normalsArrays.push([]);
		wireframeArrays.push([]);

		// Populate that "floor"
		divideTriangle(a, b, c, onFloor);
		divideTriangle(d, c, b, onFloor);
		divideTriangle(a, d, b, onFloor);
		divideTriangle(a, c, d, onFloor);
	}
}

function divideTriangle(a: number[], b: number[], c: number[], count: number) {
	if (count > 0) {
		let ab = mix(a, b, 0.5);
		let ac = mix(a, c, 0.5);
		let bc = mix(b, c, 0.5);

		ab = normalize(ab, true);
		ac = normalize(ac, true);
		bc = normalize(bc, true);

		divideTriangle(a, ab, ac, count - 1);
		divideTriangle(ab, b, bc, count - 1);
		divideTriangle(bc, c, ac, count - 1);
		divideTriangle(ab, bc, ac, count - 1);
	} else {
		trianglesArrays[onFloor].push(a);
		trianglesArrays[onFloor].push(b);
		trianglesArrays[onFloor].push(c);

		// Calculate Normals with the Newell Method
		let normal = [-(a[1] - b[1]) * (a[2] + b[2]) - (b[1] - c[1]) * (b[2] + c[2]) - (c[1] - a[1]) * (c[2] + a[2]),
			-(a[2] - b[2]) * (a[0] + b[0]) - (b[2] - c[2]) * (b[0] + c[0]) - (c[2] - a[2]) * (c[0] + a[0]),
			-(a[0] - b[0]) * (a[1] + b[1]) - (b[0] - c[0]) * (b[1] + c[1]) - (c[0] - a[0]) * (c[1] + a[1]), 0.0];
		normalsArrays[onFloor].push(normal);
		normalsArrays[onFloor].push(normal);
		normalsArrays[onFloor].push(normal);

		wireframeArrays[onFloor].push(a);
		wireframeArrays[onFloor].push(b);
		wireframeArrays[onFloor].push(b);
		wireframeArrays[onFloor].push(c);
		wireframeArrays[onFloor].push(c);
		wireframeArrays[onFloor].push(a);
	}
}

// Only called when page loads
function makePaths() {
	// Initialize array of arrays
	pathsArrays = [];

	// Control vertices for line
	pathsArrays[0] = [
		[-4, 4, -1 / 3, 1],
		[1, 2, -1 / 3, 1],
		[3, 3, -1 / 3, 1],
		[5, -4, -1 / 3, 1],
		[1, -1, -1 / 3, 1],
		[-3, -1, -1 / 3, 1]
	];

	// Loop through "floor" 0 to 8 to create arrays
	for (onFloor = 0; onFloor < 8; onFloor++) {
		// Creates the new "floor"
		pathsArrays.push([]);

		// Populate that "floor"
		for (let i = 0; i < pathsArrays[onFloor].length - 1; i++) {
			// Get starting and ending vertices of line segment, cut vertices and add to list
			pathsArrays[onFloor + 1].push(
				mix(pathsArrays[onFloor][i], pathsArrays[onFloor][i + 1], 0.25),
				mix(pathsArrays[onFloor][i], pathsArrays[onFloor][i + 1], 0.75));
		}
		pathsArrays[onFloor + 1].push(
			mix(pathsArrays[onFloor][pathsArrays[onFloor].length - 1], pathsArrays[onFloor][0], 0.25),
			mix(pathsArrays[onFloor][pathsArrays[onFloor].length - 1], pathsArrays[onFloor][0], 0.75));
	}

	// Loop through "floor" 0 to 8 to add final piece
	for (onFloor = 0; onFloor < 9; onFloor++) pathsArrays[onFloor].push(pathsArrays[onFloor][0]);
}

// Keyboard Shortcuts
window.onkeypress = function (event: { key: any; }) {
	switch (event.key) {
		// Change sphereLOD
		case "q":
		case "Q":
		case "_":
			// @ts-ignore
			sphereLOD.value--;
			shapeChange();
			break;
		case "e":
		case "E":
		case "+":
			// @ts-ignore
			sphereLOD.value++;
			shapeChange();
			break;
		// Change pathLOD
		case "j":
		case "J":
		case "-":
			// @ts-ignore
			pathLOD.value--;
			shapeChange();
			break;
		case "i":
		case "I":
		case "=":
			// @ts-ignore
			pathLOD.value++;
			shapeChange();
			break;
		// Toggle between wireframe and lit modes
		case "m":
		case "M":
			wireframeCheckbox.checked = !wireframeCheckbox.checked;
			shapeChange();
			break;
		// Toggle between Gouraud shading and Phong shading
		case "l":
		case "L":
			phongCheckbox.checked = !phongCheckbox.checked;
			shaderChange();
			break;
		// Toggle animation
		case "a":
		case "A":
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
			wireframeCheckbox.checked = false;
			animationCheckbox.checked = false;
			phongCheckbox.checked = false;
			sphereOnlyCheckBox.checked = false;
			animationSpeed.value = "1";
			sphereLOD.value = "7";
			pathLOD.value = "8";
			(<HTMLInputElement>document.getElementById("fieldOfViewY")).value = "50";
			(<HTMLInputElement>document.getElementById("cameraDistance")).value = "7";
			(<HTMLInputElement>document.getElementById("perspectiveFar")).value = "30";
			materialDiffuse = [1, 0.8, 0, 1];
			tick = 0;
			shaderChange();
			break;
		default:
			break;
	}
}
