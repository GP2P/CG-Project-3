// WebGL
let canvas: HTMLCanvasElement;
let gl: WebGLRenderingContext;
let program: WebGLProgram;
let animating: boolean;

// Data
let vPosition: number[][];
let vNormal: number[][];
let vTexCoord: number[][];
let materialDiffuse: number[][];
let materialSpecular: number[][];
let offset: number[];
let objectLength: number[];
let lightPosition = [0, 5, 0, 1];
let lightAmbient = [0.1, 0.1, 0.1, 1];
let lightDiffuse = [1, 1, 1, 1];
let lightSpectular = [1, 1, 1, 1];
let stack: number[][] = [];

// Controls
let lightAmbientInput: HTMLInputElement;
let lightDiffuseInput: HTMLInputElement;
let lightSpectularInput: HTMLInputElement;
let carCamCheckbox: HTMLInputElement;
let shadowsCheckbox: HTMLInputElement;
let camAnimationCheckbox: HTMLInputElement;
let carAnimationCheckbox: HTMLInputElement;
let lampLightCheckbox: HTMLInputElement;
let invertCheckbox: HTMLInputElement;
let phongCheckbox: HTMLInputElement;
let animationSpeed: HTMLInputElement;

// Animation: Degree to rotate car about the Y axis
let carDegree = 0;
// Animation: Degree to rotate camera about the Y axis
let camDegree = 0;
// Animation: Amount to bounce up or down
let variance = 0;
// Animation: variance direction
let varianceDir = true;

// Initialize
window.onload = async function () {
	canvas = <HTMLCanvasElement>document.getElementById("webgl");
	animationSpeed = <HTMLInputElement>document.getElementById("animationSpeed");
	carCamCheckbox = <HTMLInputElement>document.getElementById("carCamCheckbox");
	shadowsCheckbox = <HTMLInputElement>document.getElementById("shadowsCheckbox");
	camAnimationCheckbox = <HTMLInputElement>document.getElementById("camAnimationCheckbox");
	carAnimationCheckbox = <HTMLInputElement>document.getElementById("carAnimationCheckbox");
	lampLightCheckbox = <HTMLInputElement>document.getElementById("lampLightCheckbox");
	invertCheckbox = <HTMLInputElement>document.getElementById("invertCheckbox");
	phongCheckbox = <HTMLInputElement>document.getElementById("phongCheckbox");
	lightAmbientInput = <HTMLInputElement>document.getElementById("lightAmbient");
	lightDiffuseInput = <HTMLInputElement>document.getElementById("lightDiffuse");
	lightSpectularInput = <HTMLInputElement>document.getElementById("lightSpecular");

	// Listens for lightAmbient input and change colors
	lightAmbientInput.oninput = function () {
		if (lightAmbientInput.value == null || lightAmbientInput.value == "") {
			lightAmbient = [0.1, 0.1, 0.1, 1];
		} else {
			lightAmbient[0] = parseInt(lightAmbientInput.value.substr(1, 2), 16) / 255;
			lightAmbient[1] = parseInt(lightAmbientInput.value.substr(3, 2), 16) / 255;
			lightAmbient[2] = parseInt(lightAmbientInput.value.substr(5, 2), 16) / 255;
		}
		shaderChange();
	}

	// Listens for lightDiffuse input and change colors
	lightDiffuseInput.oninput = function () {
		if (lightDiffuseInput.value == null || lightDiffuseInput.value == "") {
			lightDiffuse = [1, 1, 1, 1];
		} else {
			lightDiffuse[0] = parseInt(lightDiffuseInput.value.substr(1, 2), 16) / 255;
			lightDiffuse[1] = parseInt(lightDiffuseInput.value.substr(3, 2), 16) / 255;
			lightDiffuse[2] = parseInt(lightDiffuseInput.value.substr(5, 2), 16) / 255;
		}
		shaderChange();
	}

	// Listens for lightSpecular input and change colors
	lightSpectularInput.oninput = function () {
		if (lightSpectularInput.value == null || lightSpectularInput.value == "") {
			lightSpectular = [1, 1, 1, 1];
		} else {
			lightSpectular[0] = parseInt(lightSpectularInput.value.substr(1, 2), 16) / 255;
			lightSpectular[1] = parseInt(lightSpectularInput.value.substr(3, 2), 16) / 255;
			lightSpectular[2] = parseInt(lightSpectularInput.value.substr(5, 2), 16) / 255;
		}
		shaderChange();
	}

	gl = WebGLUtils.setupWebGL(canvas, null);
	if (!gl) alert("WebGL isn't available");

	gl.viewport(0, 0, canvas.width, canvas.height);

	gl.enable(gl.DEPTH_TEST);

	readIn();
}

async function readIn() {
	if (invertCheckbox.checked) gl.clearColor(1, 1, 1, 1);
	else gl.clearColor(0, 0, 0, 1);
	// Get info from link
	// - Read .mtl before .obj
	// - Keep temporary list of materials for the object
	// - Read object in order
	// - Add to list of vPosition, vNormal, vTexture and shading stuff, if no texture then use -1
	// - When encounter more than 3 vertices in a face, use fan triangulation
	vPosition = [];
	vNormal = [];
	vTexCoord = [];
	materialDiffuse = [];
	materialSpecular = [];
	objectLength = [];

	offset = [2.9, 0, 0];
	await parseObject("1/car");
	objectLength.push(vPosition.length);
	offset = [2.5, 0.6, 1.5];
	await parseObject("2/bunny");
	objectLength.push(vPosition.length);
	offset = [0, 0, 0];
	await parseObject("1/lamp");
	objectLength.push(vPosition.length);
	offset = [0, 0, -4.5];
	await parseObject("1/stopsign");
	objectLength.push(vPosition.length);
	offset = [2, -1, -2];
	await parseMyObject();
	objectLength.push(vPosition.length);
	offset = [0, 0, 0];
	await parseObject("1/street");
	objectLength.push(vPosition.length);
	// offset = [0, 0, 0];
	// await parseObject("street_alt");
	// objectLength.push(vPosition.length);

	shaderChange();
}

// Uses a file name to fetch and parse .obj files and it's corresponding .mtl files
async function parseObject(fileName: string) {
	let listOfMaterials: any[] = [];

	await fetch('https://web.cs.wpi.edu/~jmcuneo/cs4731/project3_' + fileName + ".mtl")
		.then(response => response.text())
		.then(async data => {
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
				for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
					let thisLine = lines[lineIndex];
					let segs = thisLine.split(" ");
					switch (segs[0]) {
						case "Kd":
							if (invertCheckbox.checked) material[1] = [1 - +segs[1], 1 - +segs[2], 1 - +segs[3], 1];
							else material[1] = [+segs[1], +segs[2], +segs[3], 1];
							break;
						case "Ks":
							if (invertCheckbox.checked) material[2] = [+segs[1], +segs[2], +segs[3], 1];
							else material[2] = [1 - +segs[1], 1 - +segs[2], 1 - +segs[3], 1];
							break;
						case "map_Kd":
							material.push([segs[1]]);
							let image = new Image();
							image.crossOrigin = "";
							image.src = "https://web.cs.wpi.edu/~jmcuneo/cs4731/project3_1/" + segs[1];
							image.onload = function () {
								gl.bindTexture(gl.TEXTURE_2D, gl.createTexture());
								gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
								gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
								gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
								gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
								gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
								// gl.uniform1i(gl.getUniformLocation(program, "texture"), 0);
							}
							break;
						default:
							break;
					}
				}
				listOfMaterials.push(material);
			}
		});

	await fetch('https://web.cs.wpi.edu/~jmcuneo/cs4731/project3_' + fileName + ".obj")
		.then(response => response.text())
		.then(data => {
			// List of data
			let vertices: number[][] = [];
			let vertexNormals: number[][] = [];
			let textureCoords: number[][] = [];

			// Initialize for 1-index
			vertices.push([0, 0, 0, 0]);
			vertexNormals.push([0, 0, 0, 0]);
			textureCoords.push([0, 0]);

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
						textureCoords.push([+segs[1], 1 - +segs[2]]);
						break;
					case "vn":
						vertexNormals.push([+segs[1], +segs[2], +segs[3], 0]);
						break;
					case "usemtl":
						if (segs[1] != currentMtl[0]) listOfMaterials.forEach(function (value) {
							if (segs[1] == value[0]) currentMtl = value;
						});
						break;
					case "f":
						// Handles if a face needs to be fan triangulated
						for (let i = 3; i < segs.length; i++) {
							vPosition.push(vertices[+segs[1].split("/")[0]]);
							vPosition.push(vertices[+segs[i - 1].split("/")[0]]);
							vPosition.push(vertices[+segs[i].split("/")[0]]);

							if (currentMtl.length > 3 || segs[1].split("/")[1] != "") {
								vTexCoord.push(textureCoords[+segs[1].split("/")[1]]);
								vTexCoord.push(textureCoords[+segs[i - 1].split("/")[1]]);
								vTexCoord.push(textureCoords[+segs[i].split("/")[1]]);
							} else {
								vTexCoord.push(textureCoords[0]);
								vTexCoord.push(textureCoords[0]);
								vTexCoord.push(textureCoords[0]);
							}

							vNormal.push(vertexNormals[+segs[1].split("/")[2]]);
							vNormal.push(vertexNormals[+segs[i - 1].split("/")[2]]);
							vNormal.push(vertexNormals[+segs[i].split("/")[2]]);

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

// Uses a .obj content string to parse my object (the G3P "statue")
async function parseMyObject() {
	// List of data
	let vertices: number[][] = [];
	let vertexNormals: number[][] = [];
	let textureCoords: number[][] = [];

	// Initialize for 1-index
	vertices.push([0, 0, 0, 0]);
	vertexNormals.push([0, 0, 0, 0]);
	textureCoords.push([0, 0]);

	// single texture (white with purple specular)
	let currentMtl: any[] = [];
	currentMtl.push(["myTexture"]);    // material[0] = name
	if (invertCheckbox.checked) {
		currentMtl.push([0, 0, 0, 1]); // material[1] = diffuseColors
		currentMtl.push([0, 1, 0, 1]); // material[2] = specularColors
	} else {
		currentMtl.push([1, 1, 1, 1]); // material[1] = diffuseColors
		currentMtl.push([1, 0, 1, 1]); // material[2] = specularColors
	}

	let data = "# normals\nvn -1 0 0\nvn 1 0 0\nvn 0 0 1\nvn 0 0 -1\nvn 0 -1 0\nvn 0 1 0\n# texcoords\nvt 0.958984 0.5\n# verts\nv 0 2 0\nv 0 2 -1\nv 0 2.2 -0.3\nv 0 2.2 -1\nv 0 2.4 -0.3\nv 0 2.4 -1\nv 0 2.6 -0.3\nv 0 2.6 -1\nv 0 2.8 -0.3\nv 0 2.8 -1\nv 0 3 0\nv 0 3 -1\nv 0.2 2.2 -0.3\nv 0.2 2.2 -1\nv 0.2 2.4 -0.3\nv 0.2 2.4 -1\nv 0.2 2.6 -0.3\nv 0.2 2.6 -1\nv 0.2 2.8 -0.3\nv 0.2 2.8 -1\nv 0.4 2.7 -0.4\nv 0.4 2.7 -0.6\nv 0.4 3 -0.4\nv 0.4 3 -0.6\nv 0.8 2.5 0\nv 0.8 2.5 -0.4\nv 0.8 2.6 -0.3\nv 0.8 2.6 -0.4\nv 0.8 2.7 -0.2\nv 0.8 2.7 -0.3\nv 0.8 2.7 -0.4\nv 0.8 2.8 0\nv 0.8 2.8 -0.2\nv 0.8 2.8 -0.3\nv 0.8 3 -0.2\nv 0.8 3 -0.4\nv 0.2 2 0\nv 0.2 2 -0.4\nv 0.2 2.1 -0.3\nv 0.2 2.1 -0.4\nv 0.2 2.2 -0.2\nv 0.2 2.2 -0.3\nv 0.2 2.3 0\nv 0.2 2.3 -0.2\nv 0.2 2.5 0\nv 0.2 2.5 -0.4\nv 0.2 2.6 -0.3\nv 0.2 2.6 -0.4\nv 0.2 2.7 -0.2\nv 0.2 2.7 -0.3\nv 0.2 2.8 0\nv 0.2 2.8 -0.2\nv 0.2 2.8 -0.8\nv 0.2 3 -0.2\nv 0.2 3 -0.8\nv 0.3 2.7 -0.3\nv 0.3 2.7 -0.8\nv 0.3 2.8 -0.3\nv 0.3 2.8 -0.8\nv 0.4 2.6 -0.6\nv 0.4 2.6 -0.8\nv 0.4 2.7 -0.6\nv 0.4 2.7 -0.8\nv 1 2 -0.4\nv 1 2 -1\nv 1 2.1 -0.3\nv 1 2.1 -0.4\nv 1 2.2 -0.2\nv 1 2.2 -0.3\nv 1 2.3 0\nv 1 2.3 -0.2\nv 1 2.6 -0.6\nv 1 2.6 -0.8\nv 1 3 0\nv 1 3 -0.6\nv 1 3 -0.8\nv 1 3 -1\nv 0 2 0\nv 0 3 0\nv 0.2 2 0\nv 0.2 2.3 0\nv 0.2 2.5 0\nv 0.2 2.8 0\nv 0.8 2.5 0\nv 0.8 2.8 0\nv 1 2.3 0\nv 1 3 0\nv 0.2 2.2 -0.2\nv 0.2 2.3 -0.2\nv 0.2 2.7 -0.2\nv 0.2 2.8 -0.2\nv 0.8 2.7 -0.2\nv 0.8 2.8 -0.2\nv 1 2.2 -0.2\nv 1 2.3 -0.2\nv 0.2 2.1 -0.3\nv 0.2 2.2 -0.3\nv 0.2 2.6 -0.3\nv 0.2 2.7 -0.3\nv 0.8 2.6 -0.3\nv 0.8 2.7 -0.3\nv 1 2.1 -0.3\nv 1 2.2 -0.3\nv 0.2 2 -0.4\nv 0.2 2.1 -0.4\nv 0.2 2.5 -0.4\nv 0.2 2.6 -0.4\nv 0.4 2.7 -0.4\nv 0.4 3 -0.4\nv 0.8 2.5 -0.4\nv 0.8 2.6 -0.4\nv 0.8 2.7 -0.4\nv 0.8 3 -0.4\nv 1 2 -0.4\nv 1 2.1 -0.4\nv 0.2 2.8 -0.8\nv 0.2 3 -0.8\nv 0.3 2.7 -0.8\nv 0.3 2.8 -0.8\nv 0.4 2.6 -0.8\nv 0.4 2.7 -0.8\nv 1 2.6 -0.8\nv 1 3 -0.8\nv 0.2 2.8 -0.2\nv 0.2 3 -0.2\nv 0.8 2.8 -0.2\nv 0.8 3 -0.2\nv 0 2.2 -0.3\nv 0 2.4 -0.3\nv 0 2.6 -0.3\nv 0 2.8 -0.3\nv 0.2 2.2 -0.3\nv 0.2 2.4 -0.3\nv 0.2 2.6 -0.3\nv 0.2 2.8 -0.3\nv 0.3 2.7 -0.3\nv 0.3 2.8 -0.3\nv 0.8 2.7 -0.3\nv 0.8 2.8 -0.3\nv 0.4 2.6 -0.6\nv 0.4 2.7 -0.6\nv 0.4 3 -0.6\nv 1 2.6 -0.6\nv 1 3 -0.6\nv 0 2 -1\nv 0 2.2 -1\nv 0 2.4 -1\nv 0 2.6 -1\nv 0 2.8 -1\nv 0 3 -1\nv 0.2 2.2 -1\nv 0.2 2.4 -1\nv 0.2 2.6 -1\nv 0.2 2.8 -1\nv 1 2 -1\nv 1 3 -1\nv 0 2 0\nv 0.2 2 0\nv 0.2 2 -0.4\nv 1 2 -0.4\nv 0 2 -1\nv 1 2 -1\nv 0.2 2.1 -0.3\nv 1 2.1 -0.3\nv 0.2 2.1 -0.4\nv 1 2.1 -0.4\nv 0.2 2.2 -0.2\nv 1 2.2 -0.2\nv 0.2 2.2 -0.3\nv 1 2.2 -0.3\nv 0.2 2.3 0\nv 1 2.3 0\nv 0.2 2.3 -0.2\nv 1 2.3 -0.2\nv 0 2.4 -0.3\nv 0.2 2.4 -0.3\nv 0 2.4 -1\nv 0.2 2.4 -1\nv 0.2 2.6 -0.3\nv 0.8 2.6 -0.3\nv 0.2 2.6 -0.4\nv 0.8 2.6 -0.4\nv 0.2 2.7 -0.2\nv 0.8 2.7 -0.2\nv 0.2 2.7 -0.3\nv 0.8 2.7 -0.3\nv 0.2 2.8 0\nv 0.8 2.8 0\nv 0.2 2.8 -0.2\nv 0.8 2.8 -0.2\nv 0 2.8 -0.3\nv 0.2 2.8 -0.3\nv 0 2.8 -1\nv 0.2 2.8 -1\nv 0 2.2 -0.3\nv 0.2 2.2 -0.3\nv 0 2.2 -1\nv 0.2 2.2 -1\nv 0.2 2.5 0\nv 0.8 2.5 0\nv 0.2 2.5 -0.4\nv 0.8 2.5 -0.4\nv 0 2.6 -0.3\nv 0.2 2.6 -0.3\nv 0.4 2.6 -0.6\nv 1 2.6 -0.6\nv 0.4 2.6 -0.8\nv 1 2.6 -0.8\nv 0 2.6 -1\nv 0.2 2.6 -1\nv 0.3 2.7 -0.3\nv 0.8 2.7 -0.3\nv 0.4 2.7 -0.4\nv 0.8 2.7 -0.4\nv 0.4 2.7 -0.6\nv 0.3 2.7 -0.8\nv 0.4 2.7 -0.8\nv 0.2 2.8 -0.2\nv 0.8 2.8 -0.2\nv 0.3 2.8 -0.3\nv 0.8 2.8 -0.3\nv 0.2 2.8 -0.8\nv 0.3 2.8 -0.8\nv 0 3 0\nv 1 3 0\nv 0.2 3 -0.2\nv 0.8 3 -0.2\nv 0.4 3 -0.4\nv 0.8 3 -0.4\nv 0.4 3 -0.6\nv 1 3 -0.6\nv 0.2 3 -0.8\nv 1 3 -0.8\nv 0 3 -1\nv 1 3 -1\n# faces\nf 3/1/1 2/1/1 1/1/1\nf 4/1/1 2/1/1 3/1/1\nf 5/1/1 3/1/1 1/1/1\nf 7/1/1 5/1/1 1/1/1\nf 7/1/1 6/1/1 5/1/1\nf 8/1/1 6/1/1 7/1/1\nf 9/1/1 7/1/1 1/1/1\nf 11/1/1 9/1/1 1/1/1\nf 11/1/1 10/1/1 9/1/1\nf 12/1/1 10/1/1 11/1/1\nf 15/1/1 14/1/1 13/1/1\nf 16/1/1 14/1/1 15/1/1\nf 19/1/1 18/1/1 17/1/1\nf 20/1/1 18/1/1 19/1/1\nf 23/1/1 22/1/1 21/1/1\nf 24/1/1 22/1/1 23/1/1\nf 27/1/1 26/1/1 25/1/1\nf 28/1/1 26/1/1 27/1/1\nf 29/1/1 27/1/1 25/1/1\nf 30/1/1 27/1/1 29/1/1\nf 32/1/1 29/1/1 25/1/1\nf 33/1/1 29/1/1 32/1/1\nf 34/1/1 31/1/1 30/1/1\nf 35/1/1 34/1/1 33/1/1\nf 36/1/1 31/1/1 34/1/1\nf 36/1/1 34/1/1 35/1/1\nf 37/1/2 38/1/2 39/1/2\nf 39/1/2 38/1/2 40/1/2\nf 37/1/2 39/1/2 41/1/2\nf 41/1/2 39/1/2 42/1/2\nf 37/1/2 41/1/2 43/1/2\nf 43/1/2 41/1/2 44/1/2\nf 45/1/2 46/1/2 47/1/2\nf 47/1/2 46/1/2 48/1/2\nf 45/1/2 47/1/2 49/1/2\nf 49/1/2 47/1/2 50/1/2\nf 45/1/2 49/1/2 51/1/2\nf 51/1/2 49/1/2 52/1/2\nf 52/1/2 53/1/2 54/1/2\nf 54/1/2 53/1/2 55/1/2\nf 56/1/2 57/1/2 58/1/2\nf 58/1/2 57/1/2 59/1/2\nf 60/1/2 61/1/2 62/1/2\nf 62/1/2 61/1/2 63/1/2\nf 64/1/2 65/1/2 67/1/2\nf 66/1/2 67/1/2 69/1/2\nf 68/1/2 69/1/2 71/1/2\nf 67/1/2 65/1/2 72/1/2\nf 70/1/2 71/1/2 72/1/2\nf 71/1/2 69/1/2 72/1/2\nf 69/1/2 67/1/2 72/1/2\nf 72/1/2 65/1/2 73/1/2\nf 70/1/2 72/1/2 74/1/2\nf 74/1/2 72/1/2 75/1/2\nf 73/1/2 65/1/2 76/1/2\nf 76/1/2 65/1/2 77/1/2\nf 80/1/3 79/1/3 78/1/3\nf 81/1/3 79/1/3 80/1/3\nf 82/1/3 79/1/3 81/1/3\nf 83/1/3 79/1/3 82/1/3\nf 84/1/3 82/1/3 81/1/3\nf 85/1/3 79/1/3 83/1/3\nf 86/1/3 84/1/3 81/1/3\nf 86/1/3 85/1/3 84/1/3\nf 87/1/3 79/1/3 85/1/3\nf 87/1/3 85/1/3 86/1/3\nf 92/1/3 91/1/3 90/1/3\nf 93/1/3 91/1/3 92/1/3\nf 94/1/3 89/1/3 88/1/3\nf 95/1/3 89/1/3 94/1/3\nf 100/1/3 99/1/3 98/1/3\nf 101/1/3 99/1/3 100/1/3\nf 102/1/3 97/1/3 96/1/3\nf 103/1/3 97/1/3 102/1/3\nf 110/1/3 107/1/3 106/1/3\nf 111/1/3 107/1/3 110/1/3\nf 112/1/3 109/1/3 108/1/3\nf 113/1/3 109/1/3 112/1/3\nf 114/1/3 105/1/3 104/1/3\nf 115/1/3 105/1/3 114/1/3\nf 119/1/3 117/1/3 116/1/3\nf 121/1/3 119/1/3 118/1/3\nf 122/1/3 121/1/3 120/1/3\nf 123/1/3 117/1/3 119/1/3\nf 123/1/3 121/1/3 122/1/3\nf 123/1/3 119/1/3 121/1/3\nf 124/1/4 125/1/4 126/1/4\nf 126/1/4 125/1/4 127/1/4\nf 128/1/4 129/1/4 132/1/4\nf 132/1/4 129/1/4 133/1/4\nf 130/1/4 131/1/4 134/1/4\nf 134/1/4 131/1/4 135/1/4\nf 136/1/4 137/1/4 138/1/4\nf 138/1/4 137/1/4 139/1/4\nf 140/1/4 141/1/4 143/1/4\nf 141/1/4 142/1/4 143/1/4\nf 143/1/4 142/1/4 144/1/4\nf 145/1/4 146/1/4 151/1/4\nf 147/1/4 148/1/4 152/1/4\nf 152/1/4 148/1/4 153/1/4\nf 149/1/4 150/1/4 154/1/4\nf 152/1/4 153/1/4 155/1/4\nf 153/1/4 154/1/4 155/1/4\nf 145/1/4 151/1/4 155/1/4\nf 151/1/4 152/1/4 155/1/4\nf 154/1/4 150/1/4 156/1/4\nf 155/1/4 154/1/4 156/1/4\nf 159/1/5 158/1/5 157/1/5\nf 161/1/5 159/1/5 157/1/5\nf 161/1/5 160/1/5 159/1/5\nf 162/1/5 160/1/5 161/1/5\nf 165/1/5 164/1/5 163/1/5\nf 166/1/5 164/1/5 165/1/5\nf 169/1/5 168/1/5 167/1/5\nf 170/1/5 168/1/5 169/1/5\nf 173/1/5 172/1/5 171/1/5\nf 174/1/5 172/1/5 173/1/5\nf 177/1/5 176/1/5 175/1/5\nf 178/1/5 176/1/5 177/1/5\nf 181/1/5 180/1/5 179/1/5\nf 182/1/5 180/1/5 181/1/5\nf 185/1/5 184/1/5 183/1/5\nf 186/1/5 184/1/5 185/1/5\nf 189/1/5 188/1/5 187/1/5\nf 190/1/5 188/1/5 189/1/5\nf 193/1/5 192/1/5 191/1/5\nf 194/1/5 192/1/5 193/1/5\nf 195/1/6 196/1/6 197/1/6\nf 197/1/6 196/1/6 198/1/6\nf 199/1/6 200/1/6 201/1/6\nf 201/1/6 200/1/6 202/1/6\nf 205/1/6 206/1/6 207/1/6\nf 207/1/6 206/1/6 208/1/6\nf 203/1/6 204/1/6 209/1/6\nf 209/1/6 204/1/6 210/1/6\nf 211/1/6 212/1/6 213/1/6\nf 213/1/6 212/1/6 214/1/6\nf 211/1/6 213/1/6 215/1/6\nf 211/1/6 215/1/6 216/1/6\nf 216/1/6 215/1/6 217/1/6\nf 218/1/6 219/1/6 220/1/6\nf 220/1/6 219/1/6 221/1/6\nf 218/1/6 220/1/6 222/1/6\nf 222/1/6 220/1/6 223/1/6\nf 224/1/6 225/1/6 226/1/6\nf 226/1/6 225/1/6 227/1/6\nf 227/1/6 225/1/6 229/1/6\nf 228/1/6 229/1/6 230/1/6\nf 229/1/6 225/1/6 231/1/6\nf 230/1/6 229/1/6 231/1/6\nf 224/1/6 226/1/6 232/1/6\nf 224/1/6 232/1/6 234/1/6\nf 232/1/6 233/1/6 234/1/6\nf 234/1/6 233/1/6 235/1/6\n";

	let lines = data.split('\n');
	lines.forEach(function (value, index) {
		let segs = value.split(" ");
		switch (segs[0]) {
			case "v":
				vertices.push([+segs[1] + offset[0], +segs[2] + offset[1], +segs[3] + offset[2], 1]);
				break;
			case "vn":
				vertexNormals.push([+segs[1], +segs[2], +segs[3], 0]);
				break;
			case "f":
				// Handles if a face needs to be fan triangulated
				for (let i = 3; i < segs.length; i++) {
					vPosition.push(vertices[+segs[1].split("/")[0]]);
					vPosition.push(vertices[+segs[i - 1].split("/")[0]]);
					vPosition.push(vertices[+segs[i].split("/")[0]]);

					vTexCoord.push(textureCoords[0]);
					vTexCoord.push(textureCoords[0]);
					vTexCoord.push(textureCoords[0]);

					vNormal.push(vertexNormals[+segs[1].split("/")[2]]);
					vNormal.push(vertexNormals[+segs[i - 1].split("/")[2]]);
					vNormal.push(vertexNormals[+segs[i].split("/")[2]]);

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

	gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
	gl.bufferData(gl.ARRAY_BUFFER, flatten(vTexCoord), gl.STATIC_DRAW);
	const vTexCoordPosition = gl.getAttribLocation(program, "vTexCoord");
	gl.vertexAttribPointer(vTexCoordPosition, 2, gl.FLOAT, false, 0, 0);
	gl.enableVertexAttribArray(vTexCoordPosition);

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
	gl.uniform4fv(gl.getUniformLocation(program, "lightPosition"), lightPosition);
	gl.uniform4fv(gl.getUniformLocation(program, "lightAmbient"), lightAmbient);
	gl.uniform4fv(gl.getUniformLocation(program, "lightDiffuse"), lightDiffuse);
	gl.uniform4fv(gl.getUniformLocation(program, "lightSpecular"), lightSpectular);
	gl.uniform1f(gl.getUniformLocation(program, "shininess"), 20);

	if (!animating) render();
}

// Animation
function render() {
	document.getElementById("camAnimationDegree")!.innerText = String(camDegree) + "˚";
	document.getElementById("camAnimationVariance")!.innerText = String(variance.toFixed(3));
	document.getElementById("carAnimationDegree")!.innerText = String(carDegree) + "˚";

	gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);

	// Toggle lamp light
	if (lampLightCheckbox.checked)
		gl.uniform1f(gl.getUniformLocation(program, "lightOn"), 1);
	else gl.uniform1f(gl.getUniformLocation(program, "lightOn"), 0);

	// Spectator View Matrix
	let cameraDistance = +(<HTMLInputElement>document.getElementById("cameraDistance")).value;
	let sin = Math.sin(radians(camDegree));
	let cos = Math.cos(radians(camDegree));
	let viewMatrix = lookAt(mult(mat3(cos, 0, sin, 0, 1, 0, -sin, 0, cos),
		[cameraDistance, variance + 5, cameraDistance]), [0, 0, 0], [0, 1, 0]);

	// Projection Matrix
	gl.uniformMatrix4fv(gl.getUniformLocation(program, "projectionMatrix"), false, flatten(perspective(
		(<HTMLInputElement>document.getElementById("fieldOfViewY")).value, canvas.width / canvas.height, 0.1,
		(<HTMLInputElement>document.getElementById("perspectiveFar")).value)));

	// Car Animation Model Matrix
	let modelMatrix = rotateY(carDegree);

	// Draw Car and bunny
	gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelViewMatrix"), false, flatten(mult(viewMatrix, modelMatrix)));
	gl.drawArrays(gl.TRIANGLES, 0, objectLength[1])

	// Draw other triangles
	gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelViewMatrix"), false, flatten(viewMatrix));
	gl.drawArrays(gl.TRIANGLES, objectLength[1], vPosition.length - objectLength[1]);

	// Draw Shadows
	if (shadowsCheckbox.checked && lampLightCheckbox.checked) {
		let m = mat4();
		m[3][3] = 0;
		m[3][1] = -1 / lightPosition[1];
		const shadowModelMatrix = mult(mult(translate(lightPosition[0], lightPosition[1], lightPosition[2]), m), translate(-lightPosition[0], -lightPosition[1], -lightPosition[2]));
		gl.uniform1f(gl.getUniformLocation(program, "lightOn"), 0);

		// Shadows of Car and bunny
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelViewMatrix"), false, flatten(mult(viewMatrix, mult(shadowModelMatrix, rotateY(carDegree)))));
		gl.drawArrays(gl.TRIANGLES, 0, objectLength[1]);

		// Shadows of Other triangles
		gl.uniformMatrix4fv(gl.getUniformLocation(program, "modelViewMatrix"), false, flatten(mult(viewMatrix, shadowModelMatrix)));
		gl.drawArrays(gl.TRIANGLES, objectLength[1], objectLength[4] - objectLength[1]);
	}

	// Animation based on rendering ticks: (not relative to time, progresses one step per frame)
	if (camAnimationCheckbox.checked && carAnimationCheckbox.checked) {
		// Cam Degree
		camDegree += +animationSpeed.value;
		if (camDegree > 359) camDegree -= 360;
		// Cam Variance
		if (variance > 3) varianceDir = false;
		else if (variance < -3) varianceDir = true;
		// Cam Variance Direction
		if (varianceDir) variance += 3 * (+animationSpeed.value / 360);
		else variance -= 3 * (+animationSpeed.value / 360);
		// Car Degree
		carDegree += -animationSpeed.value;
		if (carDegree < 0) carDegree += 360;

		animating = true;
		requestAnimationFrame(render);
	} else if (camAnimationCheckbox.checked) {
		// Cam Degree
		camDegree += +animationSpeed.value;
		if (camDegree > 359) camDegree -= 360;
		// Cam Variance
		if (variance > 3) varianceDir = false;
		else if (variance < -3) varianceDir = true;
		// Cam Variance Direction
		if (varianceDir) variance += 3 * (+animationSpeed.value / 360);
		else variance -= 3 * (+animationSpeed.value / 360);

		animating = true;
		requestAnimationFrame(render);
	} else if (carAnimationCheckbox.checked) {
		// Car Degree
		carDegree += -animationSpeed.value;
		if (carDegree < 0) carDegree += 360;

		animating = true;
		requestAnimationFrame(render);
	} else animating = false;
}

// Keyboard Shortcuts
window.onkeypress = function (event: { key: any; }) {
	switch (event.key) {
		// Toggle shadows
		case "s":
		case "S":
			shadowsCheckbox.checked = !shadowsCheckbox.checked;
			if (!animating) render();
			break;
		// Toggle spectator camera animation
		case "a":
		case "A":
			camAnimationCheckbox.checked = !camAnimationCheckbox.checked;
			carCamCheckbox.checked = false;
			if (!animating) render();
			break;
		// Toggle camera position
		case "c":
		case "C":
			carCamCheckbox.checked = !carCamCheckbox.checked;
			camAnimationCheckbox.checked = false;
			if (!animating) render();
			break;
		// Toggle car animation
		case "m":
		case "M":
			carAnimationCheckbox.checked = !carAnimationCheckbox.checked;
			if (!animating) render();
			break;
		// Toggle lamp light
		case "l":
		case "L":
			lampLightCheckbox.checked = !lampLightCheckbox.checked;
			if (!animating) render();
			break;
		// Toggle between Gouraud shading and Phong shading
		case "q":
		case "Q":
			phongCheckbox.checked = !phongCheckbox.checked;
			shaderChange();
			break;
		// Toggle X-ray
		case "x":
		case "X":
			invertCheckbox.checked = !invertCheckbox.checked;
			readIn();
			break;
		// Change animation speed with numbers
		case "1":
		case "2":
		case "3":
		case "4":
		case "5":
		case "6":
		case "7":
		case "8":
		case "9":
			animationSpeed.value = event.key;
			break;
		case "0":
			animationSpeed.value = "10";
			break;
		// Super Reset
		case "r":
		case "R":
			(<HTMLInputElement>document.getElementById("fieldOfViewY")).value = "50";
			(<HTMLInputElement>document.getElementById("cameraDistance")).value = "7";
			(<HTMLInputElement>document.getElementById("perspectiveFar")).value = "30";
			(<HTMLInputElement>document.getElementById("lightX")).value = "0";
			(<HTMLInputElement>document.getElementById("lightY")).value = "5";
			(<HTMLInputElement>document.getElementById("lightZ")).value = "0";
			lightPosition = [0, 5, 0, 1];
			lightAmbient = [0.1, 0.1, 0.1, 1];
			lightDiffuse = [1, 1, 1, 1];
			lightSpectular = [1, 1, 1, 1];
			carCamCheckbox.checked = false;
			shadowsCheckbox.checked = true;
			camAnimationCheckbox.checked = false;
			carAnimationCheckbox.checked = false;
			lampLightCheckbox.checked = true;
			phongCheckbox.checked = true;
			invertCheckbox.checked = false;
			animationSpeed.value = "1";
			camDegree = 0;
			variance = 0;
			varianceDir = true;
			carDegree = 0;
			readIn();
			break;
		default:
			break;
	}
}
