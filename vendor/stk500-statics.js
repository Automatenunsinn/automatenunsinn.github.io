var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// node_modules/stk500/lib/statics.js
var require_statics = __commonJS({
  "node_modules/stk500/lib/statics.js"(exports, module) {
    var Resp_STK_INSYNC = 20;
    var Resp_STK_OK = 16;
    module.exports = {
      Cmnd_STK_GET_SYNC: 48,
      Cmnd_STK_SET_DEVICE: 66,
      Cmnd_STK_ENTER_PROGMODE: 80,
      Cmnd_STK_LOAD_ADDRESS: 85,
      Cmnd_STK_PROG_PAGE: 100,
      Cmnd_STK_LEAVE_PROGMODE: 81,
      Cmnd_STK_READ_SIGN: 117,
      Sync_CRC_EOP: 32,
      Resp_STK_OK: 16,
      Resp_STK_INSYNC: 20,
      Resp_STK_NOSYNC: 21,
      Cmnd_STK_READ_PAGE: 116,
      OK_RESPONSE: Buffer.from([Resp_STK_INSYNC, Resp_STK_OK])
    };
  }
});
export default require_statics();
