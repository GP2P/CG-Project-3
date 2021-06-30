// WebGL
let canvas: HTMLCanvasElement;
let gl: WebGLRenderingContext;
let program: WebGLProgram;

// Data
let vPosition: number[][];
let vNormal: number[][];
let vTexture: number[][];
let materialDiffuse: number[][];
let materialSpecular: number[][];
let offset: number[];

// Controls
let animationSpeed: HTMLInputElement;
let animationCheckbox: HTMLInputElement;
let phongCheckbox: HTMLInputElement;

// Animation: Degree to rotate about the Y axis
let degree = 0;
// Animation: Amount to bounce up or down
let variance = 0;
// Animation: variance direction
let varianceDir = true;

// Initialize
window.onload = async function () {
	canvas = <HTMLCanvasElement>document.getElementById("webgl");
	animationSpeed = <HTMLInputElement>document.getElementById("animationSpeed");
	animationCheckbox = <HTMLInputElement>document.getElementById("animationCheckbox");
	phongCheckbox = <HTMLInputElement>document.getElementById("phongCheckbox");

	gl = WebGLUtils.setupWebGL(canvas, null);
	if (!gl) alert("WebGL isn't available");

	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.clearColor(1, 1, 1, 1);

	gl.enable(gl.DEPTH_TEST);

	readIn();
}

async function readIn() {
	// Get info from link
	// - Read .mtl before .obj
	// - Keep temporary list of materials for the object
	// - Read object in order
	// - Add to list of vPosition, vNormal, vTexture and shading stuff, if no texture then use -1
	// - When encounter more than 3 vertices in a face, use fan triangulation
	vPosition = [];
	vNormal = [];
	vTexture = [];
	materialDiffuse = [];
	materialSpecular = [];

	offset = [2.9, -0.2, 0];
	await parseObject("car");
	offset = [0, 0, 5];
	await parseObject("lamp");
	offset = [0, 0, -4.5];
	await parseObject("stopsign");
	offset = [0, 0, 0];
	await parseObject("street");
	// offset = [0, 0, 0];
	// await parseObject("street_alt");

	shaderChange();
}

// Uses a file name to fetch and parse .obj files and it's corresponding .mtl files
async function parseObject(fileName: string) {
	let listOfMaterials: any[] = [];

	await fetch('https://web.cs.wpi.edu/~jmcuneo/cs4731/project3_1/' + fileName + ".mtl")
		.then(response => response.text())
		.then(data => {
			console.log("Processing file: " + fileName + ".mtl");

			let newmtls = data.split('newmtl');
			for (let mtlIndex = 1; mtlIndex < newmtls.length; mtlIndex++) {
				// Create material
				let material: any[] = [];
				material.push(["notMe"]); // material[0] = name
				material.push([1, 0, 1, 1]); // material[1] = diffuseColors
				material.push([1, 0, 1, 1]); // material[2] = specularColors

				// Add name
				let thisMtl = newmtls[mtlIndex];
				let lines = thisMtl.split('\n');
				material[0] = lines[0].split(" ")[1];

				// Parse material
				console.log("\tProcessing material: " + material[0]);
				for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
					let thisLine = lines[lineIndex];
					let segs = thisLine.split(" ");
					switch (segs[0]) {
						case "Kd":
							if ((<HTMLInputElement>document.getElementById("invertCheckbox")).checked)
								material[1] = [+segs[1], +segs[2], +segs[3], 1];
							else material[1] = [1 - +segs[1], 1 - +segs[2], 1 - +segs[3], 1];
							break;
						case "Ks":
							if ((<HTMLInputElement>document.getElementById("invertCheckbox")).checked)
								material[2] = [+segs[1], +segs[2], +segs[3], 1];
							else material[2] = [1 - +segs[1], 1 - +segs[2], 1 - +segs[3], 1];
							break;
						case "map_Kd":
							material.push(["diffuseTextureMap", segs[1]]);
							break;
						default:
							break;
					}
				}
				listOfMaterials.push(material);
			}
		});

	await fetch('https://web.cs.wpi.edu/~jmcuneo/cs4731/project3_1/' + fileName + ".obj")
		.then(response => response.text())
		.then(data => {
			console.log("Processing file: " + fileName + ".obj");

			// List of data
			let vertices: number[][] = [];
			let textureCoords: number[][] = [];
			let vertexNormals: number[][] = [];

			// Initialize for 1-index
			vertices.push([0, 0, 0, 0]);
			textureCoords.push([0, 0]);
			vertexNormals.push([0, 0, 0, 0]);

			// goes to default texture (purple)
			let currentMtl: any[] = [];
			currentMtl.push(["notMe"]);    // material[0] = name
			currentMtl.push([1, 0, 1, 1]); // material[1] = diffuseColors
			currentMtl.push([1, 0, 1, 1]); // material[2] = specularColors

			let lines = data.split('\n');
			lines.forEach(function (value, index) {
				let segs = value.split(" ");
				switch (segs[0]) {
					case "v":
						vertices.push([+segs[1] + offset[0], +segs[2] + offset[1], +segs[3] + offset[2], 1]);
						break;
					case "vt":
						textureCoords.push([+segs[1], +segs[2]]);
						break;
					case "vn":
						vertexNormals.push([+segs[1], +segs[2], +segs[3], 0]);
						break;
					case "usemtl":
						if (segs[1] != currentMtl[0]) {
							listOfMaterials.forEach(function (value) {
								if (segs[1] == value[0]) currentMtl = value;
							});
						}
						break;
					case "f":
						// Handles if a face needs to be fan triangulated
						for (let i = 3; i < segs.length; i++) {
							vPosition.push(vertices[+segs[1].split("/")[0]]);
							vPosition.push(vertices[+segs[i - 1].split("/")[0]]);
							vPosition.push(vertices[+segs[i].split("/")[0]]);

							vNormal.push(vertexNormals[+segs[1].split("/")[2]]);
							vNormal.push(vertexNormals[+segs[i - 1].split("/")[2]]);
							vNormal.push(vertexNormals[+segs[i].split("/")[2]]);

							if (listOfMaterials[0].length > 3) {
								vTexture.push(textureCoords[+segs[1].split("/")[1]]);
								vTexture.push(textureCoords[+segs[i - 1].split("/")[1]]);
								vTexture.push(textureCoords[+segs[i].split("/")[1]]);
							}

							materialDiffuse.push(currentMtl[1]);
							materialDiffuse.push(currentMtl[1]);
							materialDiffuse.push(currentMtl[1]);

							materialSpecular.push(currentMtl[2]);
							materialSpecular.push(currentMtl[2]);
							materialSpecular.push(currentMtl[2]);
						}
						break;
					default:
						break;
				}
			});
		});
}

// switch lighting modes
function shaderChange() {
	if (phongCheckbox.checked) program = initShaders(gl, "vShaderPhong", "fShaderPhong");
	else program = initShaders(gl, "vShaderGouraud", "fShaderGouraud");

	gl.useProgram(program);

	// vPosition
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, flatten(vPosition), gl.STATIC_DRAW);
	const vPositionPosition = gl.getAttribLocation(program, "vPosition");
	gl.vertexAttribPointer(vPositionPosition, 4, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(vPositionPosition);

	// vNormal
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, flatten(vNormal), gl.STATIC_DRAW);
	const vNormalPosition = gl.getAttribLocation(program, "vNormal");
	gl.vertexAttribPointer(vNormalPosition, 4, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(vNormalPosition);

	// materialDiffuse
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, flatten(materialDiffuse), gl.STATIC_DRAW);
	const materialDiffusePosition = gl.getAttribLocation(program, "materialDiffuse");
	gl.vertexAttribPointer(materialDiffusePosition, 4, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(materialDiffusePosition);

	// materialSpecular
	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, flatten(materialSpecular), gl.STATIC_DRAW);
	const materialSpecularPosition = gl.getAttribLocation(program, "materialSpecular");
	gl.vertexAttribPointer(materialSpecularPosition, 4, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(materialSpecularPosition);

	// Light Calculation
	gl.uniform4fv(gl.getUniformLocation(program, "lightPosition"), [0, 4, 0, 1]);
	gl.uniform4fv(gl.getUniformLocation(program, "lightAmbient"), [0.5, 0.5, 0.5, 1]);
	gl.uniform4fv(gl.getUniformLocation(program, "lightDiffuse"), [1, 1, 1, 1]);
	gl.uniform4fv(gl.getUniformLocation(program, "lightSpecular"), [1, 1, 1, 1]);
	gl.uniform1f(gl.getUniformLocation(program, "shininess"), 20);

	if (!animationCheckbox.checked) render();
}

// Animation
function render() {
	document.getElementById("animationDegree")!.innerText = String(degree) + "˚";
	document.getElementById("animationVariance")!.innerText = String(variance.toFixed(3));

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Model, View, Projection Matrices
	let cameraDistance = +(<HTMLInputElement>document.getElementById("cameraDistance")).value;
	let viewMatrix = lookAt(mult(
		mat3(Math.cos(radians(degree)), 0, Math.sin(radians(degree)),
			0, 1, 0,
			-Math.sin(radians(degree)), 0, Math.cos(radians(degree))),
		[cameraDistance, variance + 5, cameraDistance]), [0, 0, 0], [0, 1, 0]);
	gl.uniformMatrix4fv(gl.getUniformLocation(program, "projectionMatrix"), false, flatten(perspective(
		(<HTMLInputElement>document.getElementById("fieldOfViewY")).value, canvas.width / canvas.height, 0.1,
		(<HTMLInputElement>document.getElementById("perspectiveFar")).value)));
	gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelViewMatrix"), false, flatten(viewMatrix));

	// Toggle lamp light
	if ((<HTMLInputElement>document.getElementById("lampLightCheckbox")).checked)
		gl.uniform1f(gl.getUniformLocation(program, "lightOn"), 1);
	else gl.uniform1f(gl.getUniformLocation(program, "lightOn"), 0);

	// Draw triangles
	gl.drawArrays(gl.TRIANGLES, 0, vPosition.length);

	// Animation based on rendering ticks: (not relative to time, progresses one step per frame)
	if (animationCheckbox.checked) {
		if (degree > 360) degree -= 360;
		else degree += +animationSpeed.value;
		if (variance > 3) varianceDir = false;
		else if (variance < -3) varianceDir = true;
		if (varianceDir) variance += 3 * (+animationSpeed.value / 360);
		else variance -= 3 * (+animationSpeed.value / 360);
		requestAnimationFrame(render);
	}
}

// Keyboard Shortcuts
window.onkeypress = function (event: { key: any; }) {
	switch (event.key) {
		// Toggle between Gouraud shading and Phong shading
		case "l":
		case "L":
			phongCheckbox.checked = !phongCheckbox.checked;
			shaderChange();
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
			degree = 0;
			variance = 0;
			varianceDir = true;
			shaderChange();
			break;
		default:
			break;
	}
}
