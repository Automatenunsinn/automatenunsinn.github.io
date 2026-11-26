var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// node_modules/intel-hex/index.js
var require_index = __commonJS({
  "node_modules/intel-hex/index.js"(exports) {
    var DATA = 0;
    var END_OF_FILE = 1;
    var EXT_SEGMENT_ADDR = 2;
    var START_SEGMENT_ADDR = 3;
    var EXT_LINEAR_ADDR = 4;
    var START_LINEAR_ADDR = 5;
    var EMPTY_VALUE = 255;
    exports.parse = function parseIntelHex(data, bufferSize, addressOffset) {
      if (data instanceof Buffer)
        data = data.toString("ascii");
      var buf = Buffer.alloc(bufferSize || 8192), bufLength = 0, highAddress = 0, startSegmentAddress = null, startLinearAddress = null, addressOffset = addressOffset || 0, lineNum = 0, pos = 0;
      const SMALLEST_LINE = 11;
      while (pos + SMALLEST_LINE <= data.length) {
        if (data.charAt(pos++) != ":")
          throw new Error("Line " + (lineNum + 1) + " does not start with a colon (:).");
        else
          lineNum++;
        var dataLength = parseInt(data.substr(pos, 2), 16);
        pos += 2;
        var lowAddress = parseInt(data.substr(pos, 4), 16);
        pos += 4;
        var recordType = parseInt(data.substr(pos, 2), 16);
        pos += 2;
        var dataField = data.substr(pos, dataLength * 2), dataFieldBuf = Buffer.from(dataField, "hex");
        pos += dataLength * 2;
        var checksum = parseInt(data.substr(pos, 2), 16);
        pos += 2;
        var calcChecksum = dataLength + (lowAddress >> 8) + lowAddress + recordType & 255;
        for (var i = 0; i < dataLength; i++)
          calcChecksum = calcChecksum + dataFieldBuf[i] & 255;
        calcChecksum = 256 - calcChecksum & 255;
        if (checksum != calcChecksum)
          throw new Error("Invalid checksum on line " + lineNum + ": got " + checksum + ", but expected " + calcChecksum);
        switch (recordType) {
          case DATA:
            var absoluteAddress = highAddress + lowAddress - addressOffset;
            if (absoluteAddress + dataLength >= buf.length) {
              var tmp = Buffer.alloc((absoluteAddress + dataLength) * 2);
              buf.copy(tmp, 0, 0, bufLength);
              buf = tmp;
            }
            if (absoluteAddress > bufLength)
              buf.fill(EMPTY_VALUE, bufLength, absoluteAddress);
            dataFieldBuf.copy(buf, absoluteAddress);
            bufLength = Math.max(bufLength, absoluteAddress + dataLength);
            if (bufLength >= bufferSize) {
              return {
                "data": buf.slice(0, bufLength),
                "startSegmentAddress": startSegmentAddress,
                "startLinearAddress": startLinearAddress
              };
            }
            break;
          case END_OF_FILE:
            if (dataLength != 0)
              throw new Error("Invalid EOF record on line " + lineNum + ".");
            return {
              "data": buf.slice(0, bufLength),
              "startSegmentAddress": startSegmentAddress,
              "startLinearAddress": startLinearAddress
            };
            break;
          case EXT_SEGMENT_ADDR:
            if (dataLength != 2 || lowAddress != 0)
              throw new Error("Invalid extended segment address record on line " + lineNum + ".");
            highAddress = parseInt(dataField, 16) << 4;
            break;
          case START_SEGMENT_ADDR:
            if (dataLength != 4 || lowAddress != 0)
              throw new Error("Invalid start segment address record on line " + lineNum + ".");
            startSegmentAddress = parseInt(dataField, 16);
            break;
          case EXT_LINEAR_ADDR:
            if (dataLength != 2 || lowAddress != 0)
              throw new Error("Invalid extended linear address record on line " + lineNum + ".");
            highAddress = parseInt(dataField, 16) << 16;
            break;
          case START_LINEAR_ADDR:
            if (dataLength != 4 || lowAddress != 0)
              throw new Error("Invalid start linear address record on line " + lineNum + ".");
            startLinearAddress = parseInt(dataField, 16);
            break;
          default:
            throw new Error("Invalid record type (" + recordType + ") on line " + lineNum);
            break;
        }
        if (data.charAt(pos) == "\r")
          pos++;
        if (data.charAt(pos) == "\n")
          pos++;
      }
      throw new Error("Unexpected end of input: missing or invalid EOF record.");
    };
  }
});
export default require_index();
