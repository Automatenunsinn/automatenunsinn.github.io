(()=>{"use strict";var t=function(){function t(){}return t.encBase32=function(t){if(t<9)return String.fromCharCode(t+49);var e=t+56;return 73<e&&e++,75<e&&e++,78<e&&e++,String.fromCharCode(e)},t.decBase32=function(t){if((t=t.toUpperCase())<"1"||t>"9"&&t<"A"||"J"===t||"L"===t||"O"===t||t>"Z")throw new Error("Invalid character: ".concat(t));if(t<="9")return t.charCodeAt(0)-49;var e=t.charCodeAt(0)-56;return t>"I"&&e--,t>"K"&&e--,t>"N"&&e--,e},t.base32Decode=function(e){var r,n,a=0,o=0,i=e.replace("l","1").replace("O","0"),c=[];try{for(var s=function(t){var e="function"==typeof Symbol&&Symbol.iterator,r=e&&t[e],n=0;if(r)return r.call(t);if(t&&"number"==typeof t.length)return{next:function(){return t&&n>=t.length&&(t=void 0),{value:t&&t[n++],done:!t}}};throw new TypeError(e?"Object is not iterable.":"Symbol.iterator is not defined.")}(i),u=s.next();!u.done;u=s.next()){var d=u.value;" "!==d&&"-"!==d&&"_"!==d&&(a|=t.decBase32(d)<<o,(o+=5)>=8&&(c.push(255&a),a>>=8,o-=8))}}catch(t){r={error:t}}finally{try{u&&!u.done&&(n=s.return)&&n.call(s)}finally{if(r)throw r.error}}return new Uint8Array(c)},t.base32Encode=function(e){for(var r=0,n=0,a="",o=0;o<e.length;o++)for(r|=e[o]<<n,n+=8;n>=5;)a+=t.encBase32(31&r),r>>=5,n-=5;return n>0&&(a+=t.encBase32(31&r)),a},t}(),e=function(){function t(){this.rounds=32,this.data1=0,this.data2=0,this.key=new Array(4).fill(0)}return t.prototype.setData=function(t){var e=t.buffer.slice(t.byteOffset,t.byteLength+t.byteOffset);this.data1=new DataView(e).getUint32(0,!0),this.data2=new DataView(e).getUint32(4,!0)},t.prototype.getData=function(){var t=new ArrayBuffer(8),e=new DataView(t);return e.setUint32(0,this.data1,!0),e.setUint32(4,this.data2,!0),new Uint8Array(t)},t.prototype.init=function(t,e){if(4!==t.length)throw new Error("Seed must be an array of four 32-bit unsigned integers.");this.rounds=e;for(var r=0;r<4;r++)this.key[r]=t[r];this.data1=t[2],this.data2=t[3],this.decrypt(),this.key[0]=this.data1,this.key[2]=this.data2,this.encrypt(),this.key[1]=this.data1,this.key[3]=this.data2,this.rounds=32},t.prototype.decrypt=function(){for(var t=3337565984,e=0;e<this.rounds;e++)this.data2-=(this.data1<<4^this.data1>>>5)+this.data1^t+this.key[t>>>11&3],t-=2654435769,this.data1-=(this.data2<<4^this.data2>>>5)+this.data2^t+this.key[3&t]},t.prototype.encrypt=function(){for(var t=0,e=0;e<this.rounds;e++)this.data1+=(this.data2<<4^this.data2>>>5)+this.data2^t+this.key[3&t],t+=2654435769,this.data2+=(this.data1<<4^this.data1>>>5)+this.data1^t+this.key[t>>>11&3]},t}(),r=function(){function t(){}return t.calculateCrc8=function(e){var r,n,a=255;try{for(var o=function(t){var e="function"==typeof Symbol&&Symbol.iterator,r=e&&t[e],n=0;if(r)return r.call(t);if(t&&"number"==typeof t.length)return{next:function(){return t&&n>=t.length&&(t=void 0),{value:t&&t[n++],done:!t}}};throw new TypeError(e?"Object is not iterable.":"Symbol.iterator is not defined.")}(e),i=o.next();!i.done;i=o.next()){var c=i.value;a=t.crcBytes[255&(a^c)]}}catch(t){r={error:t}}finally{try{i&&!i.done&&(n=o.return)&&n.call(o)}finally{if(r)throw r.error}}return a},t.crcBytes=[0,94,188,226,97,63,221,131,194,156,126,32,163,253,31,65,157,195,33,127,252,162,64,30,95,1,227,189,62,96,130,220,35,125,159,193,66,28,254,160,225,191,93,3,128,222,60,98,190,224,2,92,223,129,99,61,124,34,192,158,29,67,161,255,70,24,250,164,39,121,155,197,132,218,56,102,229,187,89,7,219,133,103,57,186,228,6,88,25,71,165,251,120,38,196,154,101,59,217,135,4,90,184,230,167,249,27,69,198,152,122,36,248,166,68,26,153,199,37,123,58,100,134,216,91,5,231,185,140,210,48,110,237,179,81,15,78,16,242,172,47,113,147,205,17,79,173,243,112,46,204,146,211,141,111,49,178,236,14,80,175,241,19,77,206,144,114,44,109,51,209,143,12,82,176,238,50,108,142,208,83,13,239,177,240,174,76,18,145,207,45,115,202,148,118,40,171,245,23,73,8,86,180,234,105,55,213,139,87,9,235,181,54,104,138,212,149,203,41,119,244,170,72,22,233,183,85,11,136,214,52,106,43,117,151,201,74,20,246,168,116,42,200,150,21,75,169,247,182,232,10,84,215,137,107,53],t}(),n=new(function(){function n(){this.date=null,this.crypto=null}return Object.defineProperty(n.prototype,"RandomId",{get:function(){return this.randomId},enumerable:!1,configurable:!0}),Object.defineProperty(n.prototype,"HomologationId",{get:function(){return this.homologationId},enumerable:!1,configurable:!0}),Object.defineProperty(n.prototype,"ProgramId",{get:function(){return this.programId},enumerable:!1,configurable:!0}),Object.defineProperty(n.prototype,"Date",{get:function(){return this.date},enumerable:!1,configurable:!0}),n.insertChar=function(t,e,r){return[t.slice(0,e),r,t.slice(e)].join("")},n.addHyphens=function(t){var e=this.insertChar(t,20,"-");return e=this.insertChar(e,15,"-"),e=this.insertChar(e,10,"-"),this.insertChar(e,5,"-")},n.generateBauartKey=function(t,e){var r=function(t,e,r){if(r||2===arguments.length)for(var n,a=0,o=e.length;a<o;a++)!n&&a in e||(n||(n=Array.prototype.slice.call(e,0,a)),n[a]=e[a]);return t.concat(n||Array.prototype.slice.call(e))}([],function(t,e){var r="function"==typeof Symbol&&t[Symbol.iterator];if(!r)return t;var n,a,o=r.call(t),i=[];try{for(;(void 0===e||e-- >0)&&!(n=o.next()).done;)i.push(n.value)}catch(t){a={error:t}}finally{try{n&&!n.done&&(r=o.return)&&r.call(o)}finally{if(a)throw a.error}}return i}(e),!1);if(0!==t)for(var n=0;n<4;n++)r[n]+=t+21545,r[n]-=880279552+(~t<<16);return r},n.prototype.setKeyInd=function(t){var r=n.generateBauartKey(t,[1878738899,2928249263,3927923331,606835660]);this.crypto=new e,this.crypto.init(r,29)},n.prototype.decrypt=function(e,n){void 0===n&&(n=0);var a=t.base32Decode(e);if(a.length%8!=0)throw new Error("Invalid input length");this.setKeyInd(n);var o=new Uint8Array(16),i=a.subarray(0,8),c=a.subarray(8,16);if(!this.crypto)throw new Error("Xtea not initialized");if(this.crypto.setData(i),this.crypto.decrypt(),o.set(this.crypto.getData(),0),this.crypto.setData(c),this.crypto.decrypt(),o.set(this.crypto.getData(),8),r.calculateCrc8(o.subarray(0,15))!==o[15])throw new Error("Crc8 failure decoding key");this.randomId=new DataView(o.buffer).getUint16(0,!0),this.homologationId=new DataView(o.buffer).getUint32(2,!0),this.programId=new DataView(o.buffer).getUint32(6,!0);var s=o[10],u=o[11],d=o[12];return this.date=s&&u&&d?new Date(2e3+s,u-1,d+1):null,o},n.prototype.encryptFsc=function(t){var e=new Uint8Array(16);new DataView(e.buffer).setUint32(0,this.homologationId,!0),new DataView(e.buffer).setUint16(7,this.randomId,!0),e[4]=t.getFullYear()-2e3,e[5]=t.getMonth()+1,e[6]=t.getDate();var r=(this.homologationId>>5)/3125&65535;return n.addHyphens(this.encrypt(e,r))},n.prototype.encrypt=function(e,n){e[15]=r.calculateCrc8(e.subarray(0,15))+1,console.log(e),this.setKeyInd(n);var a=new Uint8Array(16),o=e.subarray(0,8),i=e.subarray(8,16);if(!this.crypto)throw new Error("Xtea not initialized");return this.crypto.setData(o),this.crypto.encrypt(),a.set(this.crypto.getData(),0),this.crypto.setData(i),this.crypto.encrypt(),a.set(this.crypto.getData(),8),t.base32Encode(a)},n.prototype.createKc=function(e,n){var a=new Uint8Array(8);new DataView(a.buffer).setUint32(0,e,!0),new DataView(a.buffer).setUint16(4,n,!0),a[7]=r.calculateCrc8(a.subarray(0,7)),this.setKeyInd(4712);var o=new Uint8Array(8);if(!this.crypto)throw new Error("Xtea not initialized");return this.crypto.setData(a),this.crypto.encrypt(),o.set(this.crypto.getData()),t.base32Encode(o)},n}());window.parseCode=function(){var t=document.getElementById("code").value;try{n.decrypt(t),document.getElementById("date").valueAsDate=n.Date,document.getElementById("code").style.backgroundColor="#353"}catch(t){document.getElementById("code").style.backgroundColor="#533"}},window.genCode=function(){try{var t=document.getElementById("date").valueAsDate,e=n.encryptFsc(t);document.getElementById("out").value=e,document.getElementById("date").style.backgroundColor="#353",document.getElementById("out").style.animation="shine 1s ease-in infinite"}catch(t){document.getElementById("date").style.backgroundColor="#533"}},window.maxDate=function(){document.getElementById("date").value="2089-01-01"}})();