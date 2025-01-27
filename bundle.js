/*
 * ATTENTION: The "eval" devtool has been used (maybe by default in mode: "development").
 * This devtool is neither made for production nor for readable output files.
 * It uses "eval()" calls to create a separate source file in the browser devtools.
 * If you are trying to read the output file, select a different devtool (https://webpack.js.org/configuration/devtool/)
 * or disable the default devtool with "devtool: false".
 * If you are looking for production-ready output files, see mode: "production" (https://webpack.js.org/configuration/mode/).
 */
/******/ (() => { // webpackBootstrap
/******/ 	"use strict";
/******/ 	var __webpack_modules__ = ({

/***/ "./src/base32.ts":
/*!***********************!*\
  !*** ./src/base32.ts ***!
  \***********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   CustomBase32: () => (/* binding */ CustomBase32),\n/* harmony export */   \"default\": () => (__WEBPACK_DEFAULT_EXPORT__)\n/* harmony export */ });\nvar __values = (undefined && undefined.__values) || function(o) {\n    var s = typeof Symbol === \"function\" && Symbol.iterator, m = s && o[s], i = 0;\n    if (m) return m.call(o);\n    if (o && typeof o.length === \"number\") return {\n        next: function () {\n            if (o && i >= o.length) o = void 0;\n            return { value: o && o[i++], done: !o };\n        }\n    };\n    throw new TypeError(s ? \"Object is not iterable.\" : \"Symbol.iterator is not defined.\");\n};\nvar CustomBase32 = /** @class */ (function () {\n    function CustomBase32() {\n    }\n    CustomBase32.encBase32 = function (v) {\n        if (v < 9)\n            return String.fromCharCode(v + 49); // '1' to '9'\n        var num = v + 56; // offset\n        if (73 < num)\n            num++; // Skip 'I'\n        if (75 < num)\n            num++; // Skip 'K'\n        if (78 < num)\n            num++; // Skip 'N'\n        return String.fromCharCode(num);\n    };\n    CustomBase32.decBase32 = function (u) {\n        u = u.toUpperCase();\n        if (u < '1' || (u > '9' && u < 'A') || u === 'J' || u === 'L' || u === 'O' || u > 'Z') {\n            throw new Error(\"Invalid character: \".concat(u));\n        }\n        if (u <= '9')\n            return u.charCodeAt(0) - 49; // '1' to '9'\n        var num = u.charCodeAt(0) - 56; // 'A' starts here\n        if (u > 'I')\n            num--; // Adjust for 'I'\n        if (u > 'K')\n            num--; // Adjust for 'K'\n        if (u > 'N')\n            num--; // Adjust for 'N'\n        return num;\n    };\n    CustomBase32.base32Decode = function (code) {\n        var e_1, _a;\n        var value = 0;\n        var offset = 0;\n        var result = [];\n        try {\n            for (var code_1 = __values(code), code_1_1 = code_1.next(); !code_1_1.done; code_1_1 = code_1.next()) {\n                var u = code_1_1.value;\n                if (u === ' ' || u === '-')\n                    continue; // Ignore spaces and dashes\n                value |= CustomBase32.decBase32(u) << offset;\n                offset += 5;\n                if (offset >= 8) {\n                    result.push(value & 0xff); // Extract a byte\n                    value >>= 8;\n                    offset -= 8;\n                }\n            }\n        }\n        catch (e_1_1) { e_1 = { error: e_1_1 }; }\n        finally {\n            try {\n                if (code_1_1 && !code_1_1.done && (_a = code_1.return)) _a.call(code_1);\n            }\n            finally { if (e_1) throw e_1.error; }\n        }\n        return new Uint8Array(result);\n    };\n    CustomBase32.base32Encode = function (data) {\n        var num2 = 0;\n        var num3 = 0;\n        var result = '';\n        for (var i = 0; i < data.length; i++) {\n            num2 |= data[i] << num3;\n            num3 += 8;\n            while (num3 >= 5) {\n                result += CustomBase32.encBase32(num2 & 31); // Extract 5 bits and encode\n                num2 >>= 5;\n                num3 -= 5;\n            }\n        }\n        if (num3 > 0) {\n            result += CustomBase32.encBase32(num2 & 31);\n        }\n        return result;\n    };\n    return CustomBase32;\n}());\n\n/* harmony default export */ const __WEBPACK_DEFAULT_EXPORT__ = (CustomBase32);\n\n\n//# sourceURL=webpack://bw/./src/base32.ts?");

/***/ }),

/***/ "./src/crc8.ts":
/*!*********************!*\
  !*** ./src/crc8.ts ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   Crc8: () => (/* binding */ Crc8)\n/* harmony export */ });\nvar __values = (undefined && undefined.__values) || function(o) {\n    var s = typeof Symbol === \"function\" && Symbol.iterator, m = s && o[s], i = 0;\n    if (m) return m.call(o);\n    if (o && typeof o.length === \"number\") return {\n        next: function () {\n            if (o && i >= o.length) o = void 0;\n            return { value: o && o[i++], done: !o };\n        }\n    };\n    throw new TypeError(s ? \"Object is not iterable.\" : \"Symbol.iterator is not defined.\");\n};\nvar Crc8 = /** @class */ (function () {\n    function Crc8() {\n    }\n    Crc8.calculateCrc8 = function (data) {\n        var e_1, _a;\n        var crc = 255; // Initial CRC value\n        try {\n            for (var data_1 = __values(data), data_1_1 = data_1.next(); !data_1_1.done; data_1_1 = data_1.next()) {\n                var byte = data_1_1.value;\n                crc = Crc8.crcBytes[(crc ^ byte) & 0xff]; // Update CRC using lookup table\n            }\n        }\n        catch (e_1_1) { e_1 = { error: e_1_1 }; }\n        finally {\n            try {\n                if (data_1_1 && !data_1_1.done && (_a = data_1.return)) _a.call(data_1);\n            }\n            finally { if (e_1) throw e_1.error; }\n        }\n        return crc;\n    };\n    Crc8.crcBytes = [\n        0, 94, 188, 226, 97, 63, 221, 131, 194, 156, 126, 32, 163, 253, 31, 65,\n        157, 195, 33, 127, 252, 162, 64, 30, 95, 1, 227, 189, 62, 96, 130, 220,\n        35, 125, 159, 193, 66, 28, 254, 160, 225, 191, 93, 3, 128, 222, 60, 98,\n        190, 224, 2, 92, 223, 129, 99, 61, 124, 34, 192, 158, 29, 67, 161, 255,\n        70, 24, 250, 164, 39, 121, 155, 197, 132, 218, 56, 102, 229, 187, 89, 7,\n        219, 133, 103, 57, 186, 228, 6, 88, 25, 71, 165, 251, 120, 38, 196, 154,\n        101, 59, 217, 135, 4, 90, 184, 230, 167, 249, 27, 69, 198, 152, 122, 36,\n        248, 166, 68, 26, 153, 199, 37, 123, 58, 100, 134, 216, 91, 5, 231, 185,\n        140, 210, 48, 110, 237, 179, 81, 15, 78, 16, 242, 172, 47, 113, 147, 205,\n        17, 79, 173, 243, 112, 46, 204, 146, 211, 141, 111, 49, 178, 236, 14, 80,\n        175, 241, 19, 77, 206, 144, 114, 44, 109, 51, 209, 143, 12, 82, 176, 238,\n        50, 108, 142, 208, 83, 13, 239, 177, 240, 174, 76, 18, 145, 207, 45, 115,\n        202, 148, 118, 40, 171, 245, 23, 73, 8, 86, 180, 234, 105, 55, 213, 139,\n        87, 9, 235, 181, 54, 104, 138, 212, 149, 203, 41, 119, 244, 170, 72, 22,\n        233, 183, 85, 11, 136, 214, 52, 106, 43, 117, 151, 201, 74, 20, 246, 168,\n        116, 42, 200, 150, 21, 75, 169, 247, 182, 232, 10, 84, 215, 137, 107, 53\n    ];\n    return Crc8;\n}());\n\n\n\n//# sourceURL=webpack://bw/./src/crc8.ts?");

/***/ }),

/***/ "./src/index.ts":
/*!**********************!*\
  !*** ./src/index.ts ***!
  \**********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   Fsc: () => (/* binding */ Fsc),\n/* harmony export */   genCode: () => (/* binding */ genCode),\n/* harmony export */   parseCode: () => (/* binding */ parseCode)\n/* harmony export */ });\n/* harmony import */ var _base32__WEBPACK_IMPORTED_MODULE_0__ = __webpack_require__(/*! ./base32 */ \"./src/base32.ts\");\n/* harmony import */ var _xtea__WEBPACK_IMPORTED_MODULE_1__ = __webpack_require__(/*! ./xtea */ \"./src/xtea.ts\");\n/* harmony import */ var _crc8__WEBPACK_IMPORTED_MODULE_2__ = __webpack_require__(/*! ./crc8 */ \"./src/crc8.ts\");\nvar __read = (undefined && undefined.__read) || function (o, n) {\n    var m = typeof Symbol === \"function\" && o[Symbol.iterator];\n    if (!m) return o;\n    var i = m.call(o), r, ar = [], e;\n    try {\n        while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);\n    }\n    catch (error) { e = { error: error }; }\n    finally {\n        try {\n            if (r && !r.done && (m = i[\"return\"])) m.call(i);\n        }\n        finally { if (e) throw e.error; }\n    }\n    return ar;\n};\nvar __spreadArray = (undefined && undefined.__spreadArray) || function (to, from, pack) {\n    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {\n        if (ar || !(i in from)) {\n            if (!ar) ar = Array.prototype.slice.call(from, 0, i);\n            ar[i] = from[i];\n        }\n    }\n    return to.concat(ar || Array.prototype.slice.call(from));\n};\n\n\n\nvar Fsc = /** @class */ (function () {\n    function Fsc() {\n        this.date = null;\n        this.crypto = null;\n    }\n    Object.defineProperty(Fsc.prototype, \"RandomId\", {\n        get: function () {\n            return this.randomId;\n        },\n        enumerable: false,\n        configurable: true\n    });\n    Object.defineProperty(Fsc.prototype, \"HomologationId\", {\n        get: function () {\n            return this.homologationId;\n        },\n        enumerable: false,\n        configurable: true\n    });\n    Object.defineProperty(Fsc.prototype, \"ProgramId\", {\n        get: function () {\n            return this.programId;\n        },\n        enumerable: false,\n        configurable: true\n    });\n    Object.defineProperty(Fsc.prototype, \"Date\", {\n        get: function () {\n            return this.date;\n        },\n        enumerable: false,\n        configurable: true\n    });\n    Fsc.generateBauartKey = function (keyInd, masterKey) {\n        var bauartKey = __spreadArray([], __read(masterKey), false);\n        if (keyInd !== 0) {\n            for (var i = 0; i < 4; i++) {\n                bauartKey[i] += keyInd + 21545;\n                bauartKey[i] -= (~keyInd << 16) + 880279552;\n            }\n        }\n        return bauartKey;\n    };\n    Fsc.prototype.setKeyInd = function (keyInd) {\n        var masterKey = [1878738899, 2928249263, 3927923331, 606835660];\n        var bauartKey = Fsc.generateBauartKey(keyInd, masterKey);\n        this.crypto = new _xtea__WEBPACK_IMPORTED_MODULE_1__.Xtea();\n        this.crypto.init(bauartKey, 29);\n    };\n    Fsc.prototype.decrypt = function (code, keyInd) {\n        if (keyInd === void 0) { keyInd = 0; }\n        var input = _base32__WEBPACK_IMPORTED_MODULE_0__.CustomBase32.base32Decode(code);\n        if (input.length !== 16) {\n            throw new Error('Invalid input length');\n        }\n        console.log(input);\n        this.setKeyInd(keyInd);\n        var result = new Uint8Array(16);\n        var segment1 = input.subarray(0, 8);\n        var segment2 = input.subarray(8, 16);\n        if (!this.crypto) {\n            throw new Error('Xtea not initialized');\n        }\n        this.crypto.setData(segment1);\n        this.crypto.decrypt();\n        result.set(this.crypto.getData(), 0);\n        this.crypto.setData(segment2);\n        this.crypto.decrypt();\n        result.set(this.crypto.getData(), 8);\n        if (_crc8__WEBPACK_IMPORTED_MODULE_2__.Crc8.calculateCrc8(result.subarray(0, 15)) !== result[15]) {\n            throw new Error('Crc8 failure decoding key');\n        }\n        // Extract data\n        this.randomId = new DataView(result.buffer).getUint16(0, true); // Little-endian\n        this.homologationId = new DataView(result.buffer).getUint32(2, true); // Little-endian\n        this.programId = new DataView(result.buffer).getUint32(6, true); // Little-endian\n        var year = result[10];\n        var month = result[11];\n        var day = result[12];\n        this.date = year && month && day ? new Date(2000 + year, month - 1, day) : null;\n        return result;\n    };\n    Fsc.prototype.encryptFsc = function (date) {\n        var plaintext = new Uint8Array(16);\n        new DataView(plaintext.buffer).setUint32(0, this.homologationId, true); // Little-endian\n        new DataView(plaintext.buffer).setUint16(7, this.randomId, true); // Little-endian\n        plaintext[4] = date.getFullYear() - 2000;\n        plaintext[5] = date.getMonth() + 1;\n        plaintext[6] = date.getDate();\n        var keyInd = (this.homologationId >> 5) / 3125 & 0xffff;\n        return this.encrypt(plaintext, keyInd);\n    };\n    Fsc.prototype.encrypt = function (plaintext, keyInd) {\n        plaintext[15] = _crc8__WEBPACK_IMPORTED_MODULE_2__.Crc8.calculateCrc8(plaintext.subarray(0, 15));\n        this.setKeyInd(keyInd);\n        var encrypted = new Uint8Array(16);\n        var segment1 = plaintext.subarray(0, 8);\n        var segment2 = plaintext.subarray(8, 16);\n        if (!this.crypto) {\n            throw new Error('Xtea not initialized');\n        }\n        this.crypto.setData(segment1);\n        this.crypto.encrypt();\n        encrypted.set(this.crypto.getData(), 0);\n        this.crypto.setData(segment2);\n        this.crypto.encrypt();\n        encrypted.set(this.crypto.getData(), 8);\n        return _base32__WEBPACK_IMPORTED_MODULE_0__.CustomBase32.base32Encode(encrypted);\n    };\n    Fsc.prototype.createKc = function (homologationId, enableCode) {\n        var array = new Uint8Array(8);\n        new DataView(array.buffer).setUint32(0, homologationId, true); // Little-endian\n        new DataView(array.buffer).setUint16(4, enableCode, true); // Little-endian\n        array[7] = _crc8__WEBPACK_IMPORTED_MODULE_2__.Crc8.calculateCrc8(array.subarray(0, 7));\n        this.setKeyInd(4712);\n        var encrypted = new Uint8Array(8);\n        if (!this.crypto) {\n            throw new Error('Xtea not initialized');\n        }\n        this.crypto.setData(array);\n        this.crypto.encrypt();\n        encrypted.set(this.crypto.getData());\n        return _base32__WEBPACK_IMPORTED_MODULE_0__.CustomBase32.base32Encode(encrypted);\n    };\n    return Fsc;\n}());\n\nvar bcrypto = new Fsc();\nfunction parseCode() {\n    var code = document.getElementById(\"code\").value;\n    bcrypto.decrypt(code);\n    document.getElementById(\"date\").valueAsDate = bcrypto.Date;\n}\nfunction genCode() {\n    var ndate = (document.getElementById(\"date\").valueAsDate);\n    var fsc = bcrypto.encryptFsc(ndate);\n    console.log(fsc);\n    document.getElementById(\"out\").value = fsc;\n}\nwindow.parseCode = parseCode;\nwindow.genCode = genCode;\n\n\n//# sourceURL=webpack://bw/./src/index.ts?");

/***/ }),

/***/ "./src/xtea.ts":
/*!*********************!*\
  !*** ./src/xtea.ts ***!
  \*********************/
/***/ ((__unused_webpack_module, __webpack_exports__, __webpack_require__) => {

eval("__webpack_require__.r(__webpack_exports__);\n/* harmony export */ __webpack_require__.d(__webpack_exports__, {\n/* harmony export */   Xtea: () => (/* binding */ Xtea)\n/* harmony export */ });\nvar Xtea = /** @class */ (function () {\n    function Xtea() {\n        this.rounds = 32;\n        this.data1 = 0;\n        this.data2 = 0;\n        this.key = new Array(4).fill(0);\n    }\n    /**\n     * Sets the input data for encryption/decryption.\n     * @param data A Uint8Array containing 8 bytes (64 bits) of data.\n     */\n    Xtea.prototype.setData = function (data) {\n        var databuffer = data.buffer.slice(data.byteOffset, data.byteLength + data.byteOffset);\n        this.data1 = new DataView(databuffer).getUint32(0, true); // Little-endian\n        this.data2 = new DataView(databuffer).getUint32(4, true); // Little-endian\n    };\n    /**\n     * Retrieves the encrypted/decrypted data as a Uint8Array.\n     * @returns A Uint8Array containing 8 bytes (64 bits) of data.\n     */\n    Xtea.prototype.getData = function () {\n        var gbuffer = new ArrayBuffer(8);\n        var view = new DataView(gbuffer);\n        view.setUint32(0, this.data1, true); // Little-endian\n        view.setUint32(4, this.data2, true); // Little-endian\n        return new Uint8Array(gbuffer);\n    };\n    /**\n     * Initializes the key and data using a seed and rounds.\n     * @param seed A 128-bit key as an array of four 32-bit unsigned integers.\n     * @param rounds The number of encryption/decryption rounds.\n     */\n    Xtea.prototype.init = function (seed, rounds) {\n        if (seed.length !== 4) {\n            throw new Error(\"Seed must be an array of four 32-bit unsigned integers.\");\n        }\n        this.rounds = rounds;\n        for (var i = 0; i < 4; i++) {\n            this.key[i] = seed[i];\n        }\n        this.data1 = seed[2];\n        this.data2 = seed[3];\n        this.decrypt();\n        this.key[0] = this.data1;\n        this.key[2] = this.data2;\n        this.encrypt();\n        this.key[1] = this.data1;\n        this.key[3] = this.data2;\n        this.rounds = 32; // Reset rounds to the default for Encrypt/Decrypt\n    };\n    /**\n     * Decrypts the current `data1` and `data2` using the XTEA algorithm.\n     */\n    Xtea.prototype.decrypt = function () {\n        var sum = 0xc6ef3720; // 0x9e3779b9 * 32\n        var delta = 0x9e3779b9;\n        for (var i = 0; i < this.rounds; i++) {\n            this.data2 -= ((this.data1 << 4 ^ (this.data1 >>> 5)) + this.data1) ^ (sum + this.key[(sum >>> 11) & 3]);\n            sum -= delta;\n            this.data1 -= ((this.data2 << 4 ^ (this.data2 >>> 5)) + this.data2) ^ (sum + this.key[sum & 3]);\n        }\n    };\n    /**\n     * Encrypts the current `data1` and `data2` using the XTEA algorithm.\n     */\n    Xtea.prototype.encrypt = function () {\n        var sum = 0;\n        var delta = 0x9e3779b9;\n        for (var i = 0; i < this.rounds; i++) {\n            this.data1 += ((this.data2 << 4 ^ (this.data2 >>> 5)) + this.data2) ^ (sum + this.key[sum & 3]);\n            sum += delta;\n            this.data2 += ((this.data1 << 4 ^ (this.data1 >>> 5)) + this.data1) ^ (sum + this.key[(sum >>> 11) & 3]);\n        }\n    };\n    return Xtea;\n}());\n\n\n\n//# sourceURL=webpack://bw/./src/xtea.ts?");

/***/ })

/******/ 	});
/************************************************************************/
/******/ 	// The module cache
/******/ 	var __webpack_module_cache__ = {};
/******/ 	
/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {
/******/ 		// Check if module is in cache
/******/ 		var cachedModule = __webpack_module_cache__[moduleId];
/******/ 		if (cachedModule !== undefined) {
/******/ 			return cachedModule.exports;
/******/ 		}
/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = __webpack_module_cache__[moduleId] = {
/******/ 			// no module.id needed
/******/ 			// no module.loaded needed
/******/ 			exports: {}
/******/ 		};
/******/ 	
/******/ 		// Execute the module function
/******/ 		__webpack_modules__[moduleId](module, module.exports, __webpack_require__);
/******/ 	
/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}
/******/ 	
/************************************************************************/
/******/ 	/* webpack/runtime/define property getters */
/******/ 	(() => {
/******/ 		// define getter functions for harmony exports
/******/ 		__webpack_require__.d = (exports, definition) => {
/******/ 			for(var key in definition) {
/******/ 				if(__webpack_require__.o(definition, key) && !__webpack_require__.o(exports, key)) {
/******/ 					Object.defineProperty(exports, key, { enumerable: true, get: definition[key] });
/******/ 				}
/******/ 			}
/******/ 		};
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/hasOwnProperty shorthand */
/******/ 	(() => {
/******/ 		__webpack_require__.o = (obj, prop) => (Object.prototype.hasOwnProperty.call(obj, prop))
/******/ 	})();
/******/ 	
/******/ 	/* webpack/runtime/make namespace object */
/******/ 	(() => {
/******/ 		// define __esModule on exports
/******/ 		__webpack_require__.r = (exports) => {
/******/ 			if(typeof Symbol !== 'undefined' && Symbol.toStringTag) {
/******/ 				Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
/******/ 			}
/******/ 			Object.defineProperty(exports, '__esModule', { value: true });
/******/ 		};
/******/ 	})();
/******/ 	
/************************************************************************/
/******/ 	
/******/ 	// startup
/******/ 	// Load entry module and return exports
/******/ 	// This entry module can't be inlined because the eval devtool is used.
/******/ 	var __webpack_exports__ = __webpack_require__("./src/index.ts");
/******/ 	
/******/ })()
;