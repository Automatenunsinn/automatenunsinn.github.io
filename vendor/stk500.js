var __getOwnPropNames = Object.getOwnPropertyNames;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};

// node_modules/async/lib/async.js
var require_async = __commonJS({
  "node_modules/async/lib/async.js"(exports, module) {
    (function() {
      var async = {};
      var root, previous_async;
      root = this;
      if (root != null) {
        previous_async = root.async;
      }
      async.noConflict = function() {
        root.async = previous_async;
        return async;
      };
      function only_once(fn) {
        var called = false;
        return function() {
          if (called) throw new Error("Callback was already called.");
          called = true;
          fn.apply(root, arguments);
        };
      }
      var _toString = Object.prototype.toString;
      var _isArray = Array.isArray || function(obj) {
        return _toString.call(obj) === "[object Array]";
      };
      var _each = function(arr, iterator) {
        for (var i = 0; i < arr.length; i += 1) {
          iterator(arr[i], i, arr);
        }
      };
      var _map = function(arr, iterator) {
        if (arr.map) {
          return arr.map(iterator);
        }
        var results = [];
        _each(arr, function(x, i, a) {
          results.push(iterator(x, i, a));
        });
        return results;
      };
      var _reduce = function(arr, iterator, memo) {
        if (arr.reduce) {
          return arr.reduce(iterator, memo);
        }
        _each(arr, function(x, i, a) {
          memo = iterator(memo, x, i, a);
        });
        return memo;
      };
      var _keys = function(obj) {
        if (Object.keys) {
          return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
          if (obj.hasOwnProperty(k)) {
            keys.push(k);
          }
        }
        return keys;
      };
      if (typeof process === "undefined" || !process.nextTick) {
        if (typeof setImmediate === "function") {
          async.nextTick = function(fn) {
            setImmediate(fn);
          };
          async.setImmediate = async.nextTick;
        } else {
          async.nextTick = function(fn) {
            setTimeout(fn, 0);
          };
          async.setImmediate = async.nextTick;
        }
      } else {
        async.nextTick = process.nextTick;
        if (typeof setImmediate !== "undefined") {
          async.setImmediate = function(fn) {
            setImmediate(fn);
          };
        } else {
          async.setImmediate = async.nextTick;
        }
      }
      async.each = function(arr, iterator, callback) {
        callback = callback || function() {
        };
        if (!arr.length) {
          return callback();
        }
        var completed = 0;
        _each(arr, function(x) {
          iterator(x, only_once(done));
        });
        function done(err) {
          if (err) {
            callback(err);
            callback = function() {
            };
          } else {
            completed += 1;
            if (completed >= arr.length) {
              callback();
            }
          }
        }
      };
      async.forEach = async.each;
      async.eachSeries = function(arr, iterator, callback) {
        callback = callback || function() {
        };
        if (!arr.length) {
          return callback();
        }
        var completed = 0;
        var iterate = function() {
          iterator(arr[completed], function(err) {
            if (err) {
              callback(err);
              callback = function() {
              };
            } else {
              completed += 1;
              if (completed >= arr.length) {
                callback();
              } else {
                iterate();
              }
            }
          });
        };
        iterate();
      };
      async.forEachSeries = async.eachSeries;
      async.eachLimit = function(arr, limit, iterator, callback) {
        var fn = _eachLimit(limit);
        fn.apply(null, [arr, iterator, callback]);
      };
      async.forEachLimit = async.eachLimit;
      var _eachLimit = function(limit) {
        return function(arr, iterator, callback) {
          callback = callback || function() {
          };
          if (!arr.length || limit <= 0) {
            return callback();
          }
          var completed = 0;
          var started = 0;
          var running = 0;
          (function replenish() {
            if (completed >= arr.length) {
              return callback();
            }
            while (running < limit && started < arr.length) {
              started += 1;
              running += 1;
              iterator(arr[started - 1], function(err) {
                if (err) {
                  callback(err);
                  callback = function() {
                  };
                } else {
                  completed += 1;
                  running -= 1;
                  if (completed >= arr.length) {
                    callback();
                  } else {
                    replenish();
                  }
                }
              });
            }
          })();
        };
      };
      var doParallel = function(fn) {
        return function() {
          var args = Array.prototype.slice.call(arguments);
          return fn.apply(null, [async.each].concat(args));
        };
      };
      var doParallelLimit = function(limit, fn) {
        return function() {
          var args = Array.prototype.slice.call(arguments);
          return fn.apply(null, [_eachLimit(limit)].concat(args));
        };
      };
      var doSeries = function(fn) {
        return function() {
          var args = Array.prototype.slice.call(arguments);
          return fn.apply(null, [async.eachSeries].concat(args));
        };
      };
      var _asyncMap = function(eachfn, arr, iterator, callback) {
        arr = _map(arr, function(x, i) {
          return { index: i, value: x };
        });
        if (!callback) {
          eachfn(arr, function(x, callback2) {
            iterator(x.value, function(err) {
              callback2(err);
            });
          });
        } else {
          var results = [];
          eachfn(arr, function(x, callback2) {
            iterator(x.value, function(err, v) {
              results[x.index] = v;
              callback2(err);
            });
          }, function(err) {
            callback(err, results);
          });
        }
      };
      async.map = doParallel(_asyncMap);
      async.mapSeries = doSeries(_asyncMap);
      async.mapLimit = function(arr, limit, iterator, callback) {
        return _mapLimit(limit)(arr, iterator, callback);
      };
      var _mapLimit = function(limit) {
        return doParallelLimit(limit, _asyncMap);
      };
      async.reduce = function(arr, memo, iterator, callback) {
        async.eachSeries(arr, function(x, callback2) {
          iterator(memo, x, function(err, v) {
            memo = v;
            callback2(err);
          });
        }, function(err) {
          callback(err, memo);
        });
      };
      async.inject = async.reduce;
      async.foldl = async.reduce;
      async.reduceRight = function(arr, memo, iterator, callback) {
        var reversed = _map(arr, function(x) {
          return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
      };
      async.foldr = async.reduceRight;
      var _filter = function(eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function(x, i) {
          return { index: i, value: x };
        });
        eachfn(arr, function(x, callback2) {
          iterator(x.value, function(v) {
            if (v) {
              results.push(x);
            }
            callback2();
          });
        }, function(err) {
          callback(_map(results.sort(function(a, b) {
            return a.index - b.index;
          }), function(x) {
            return x.value;
          }));
        });
      };
      async.filter = doParallel(_filter);
      async.filterSeries = doSeries(_filter);
      async.select = async.filter;
      async.selectSeries = async.filterSeries;
      var _reject = function(eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function(x, i) {
          return { index: i, value: x };
        });
        eachfn(arr, function(x, callback2) {
          iterator(x.value, function(v) {
            if (!v) {
              results.push(x);
            }
            callback2();
          });
        }, function(err) {
          callback(_map(results.sort(function(a, b) {
            return a.index - b.index;
          }), function(x) {
            return x.value;
          }));
        });
      };
      async.reject = doParallel(_reject);
      async.rejectSeries = doSeries(_reject);
      var _detect = function(eachfn, arr, iterator, main_callback) {
        eachfn(arr, function(x, callback) {
          iterator(x, function(result) {
            if (result) {
              main_callback(x);
              main_callback = function() {
              };
            } else {
              callback();
            }
          });
        }, function(err) {
          main_callback();
        });
      };
      async.detect = doParallel(_detect);
      async.detectSeries = doSeries(_detect);
      async.some = function(arr, iterator, main_callback) {
        async.each(arr, function(x, callback) {
          iterator(x, function(v) {
            if (v) {
              main_callback(true);
              main_callback = function() {
              };
            }
            callback();
          });
        }, function(err) {
          main_callback(false);
        });
      };
      async.any = async.some;
      async.every = function(arr, iterator, main_callback) {
        async.each(arr, function(x, callback) {
          iterator(x, function(v) {
            if (!v) {
              main_callback(false);
              main_callback = function() {
              };
            }
            callback();
          });
        }, function(err) {
          main_callback(true);
        });
      };
      async.all = async.every;
      async.sortBy = function(arr, iterator, callback) {
        async.map(arr, function(x, callback2) {
          iterator(x, function(err, criteria) {
            if (err) {
              callback2(err);
            } else {
              callback2(null, { value: x, criteria });
            }
          });
        }, function(err, results) {
          if (err) {
            return callback(err);
          } else {
            var fn = function(left, right) {
              var a = left.criteria, b = right.criteria;
              return a < b ? -1 : a > b ? 1 : 0;
            };
            callback(null, _map(results.sort(fn), function(x) {
              return x.value;
            }));
          }
        });
      };
      async.auto = function(tasks, callback) {
        callback = callback || function() {
        };
        var keys = _keys(tasks);
        var remainingTasks = keys.length;
        if (!remainingTasks) {
          return callback();
        }
        var results = {};
        var listeners = [];
        var addListener = function(fn) {
          listeners.unshift(fn);
        };
        var removeListener = function(fn) {
          for (var i = 0; i < listeners.length; i += 1) {
            if (listeners[i] === fn) {
              listeners.splice(i, 1);
              return;
            }
          }
        };
        var taskComplete = function() {
          remainingTasks--;
          _each(listeners.slice(0), function(fn) {
            fn();
          });
        };
        addListener(function() {
          if (!remainingTasks) {
            var theCallback = callback;
            callback = function() {
            };
            theCallback(null, results);
          }
        });
        _each(keys, function(k) {
          var task = _isArray(tasks[k]) ? tasks[k] : [tasks[k]];
          var taskCallback = function(err) {
            var args = Array.prototype.slice.call(arguments, 1);
            if (args.length <= 1) {
              args = args[0];
            }
            if (err) {
              var safeResults = {};
              _each(_keys(results), function(rkey) {
                safeResults[rkey] = results[rkey];
              });
              safeResults[k] = args;
              callback(err, safeResults);
              callback = function() {
              };
            } else {
              results[k] = args;
              async.setImmediate(taskComplete);
            }
          };
          var requires = task.slice(0, Math.abs(task.length - 1)) || [];
          var ready = function() {
            return _reduce(requires, function(a, x) {
              return a && results.hasOwnProperty(x);
            }, true) && !results.hasOwnProperty(k);
          };
          if (ready()) {
            task[task.length - 1](taskCallback, results);
          } else {
            var listener = function() {
              if (ready()) {
                removeListener(listener);
                task[task.length - 1](taskCallback, results);
              }
            };
            addListener(listener);
          }
        });
      };
      async.retry = function(times, task, callback) {
        var DEFAULT_TIMES = 5;
        var attempts = [];
        if (typeof times === "function") {
          callback = task;
          task = times;
          times = DEFAULT_TIMES;
        }
        times = parseInt(times, 10) || DEFAULT_TIMES;
        var wrappedTask = function(wrappedCallback, wrappedResults) {
          var retryAttempt = function(task2, finalAttempt) {
            return function(seriesCallback) {
              task2(function(err, result) {
                seriesCallback(!err || finalAttempt, { err, result });
              }, wrappedResults);
            };
          };
          while (times) {
            attempts.push(retryAttempt(task, !(times -= 1)));
          }
          async.series(attempts, function(done, data) {
            data = data[data.length - 1];
            (wrappedCallback || callback)(data.err, data.result);
          });
        };
        return callback ? wrappedTask() : wrappedTask;
      };
      async.waterfall = function(tasks, callback) {
        callback = callback || function() {
        };
        if (!_isArray(tasks)) {
          var err = new Error("First argument to waterfall must be an array of functions");
          return callback(err);
        }
        if (!tasks.length) {
          return callback();
        }
        var wrapIterator = function(iterator) {
          return function(err2) {
            if (err2) {
              callback.apply(null, arguments);
              callback = function() {
              };
            } else {
              var args = Array.prototype.slice.call(arguments, 1);
              var next = iterator.next();
              if (next) {
                args.push(wrapIterator(next));
              } else {
                args.push(callback);
              }
              async.setImmediate(function() {
                iterator.apply(null, args);
              });
            }
          };
        };
        wrapIterator(async.iterator(tasks))();
      };
      var _parallel = function(eachfn, tasks, callback) {
        callback = callback || function() {
        };
        if (_isArray(tasks)) {
          eachfn.map(tasks, function(fn, callback2) {
            if (fn) {
              fn(function(err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                  args = args[0];
                }
                callback2.call(null, err, args);
              });
            }
          }, callback);
        } else {
          var results = {};
          eachfn.each(_keys(tasks), function(k, callback2) {
            tasks[k](function(err) {
              var args = Array.prototype.slice.call(arguments, 1);
              if (args.length <= 1) {
                args = args[0];
              }
              results[k] = args;
              callback2(err);
            });
          }, function(err) {
            callback(err, results);
          });
        }
      };
      async.parallel = function(tasks, callback) {
        _parallel({ map: async.map, each: async.each }, tasks, callback);
      };
      async.parallelLimit = function(tasks, limit, callback) {
        _parallel({ map: _mapLimit(limit), each: _eachLimit(limit) }, tasks, callback);
      };
      async.series = function(tasks, callback) {
        callback = callback || function() {
        };
        if (_isArray(tasks)) {
          async.mapSeries(tasks, function(fn, callback2) {
            if (fn) {
              fn(function(err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (args.length <= 1) {
                  args = args[0];
                }
                callback2.call(null, err, args);
              });
            }
          }, callback);
        } else {
          var results = {};
          async.eachSeries(_keys(tasks), function(k, callback2) {
            tasks[k](function(err) {
              var args = Array.prototype.slice.call(arguments, 1);
              if (args.length <= 1) {
                args = args[0];
              }
              results[k] = args;
              callback2(err);
            });
          }, function(err) {
            callback(err, results);
          });
        }
      };
      async.iterator = function(tasks) {
        var makeCallback = function(index) {
          var fn = function() {
            if (tasks.length) {
              tasks[index].apply(null, arguments);
            }
            return fn.next();
          };
          fn.next = function() {
            return index < tasks.length - 1 ? makeCallback(index + 1) : null;
          };
          return fn;
        };
        return makeCallback(0);
      };
      async.apply = function(fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function() {
          return fn.apply(
            null,
            args.concat(Array.prototype.slice.call(arguments))
          );
        };
      };
      var _concat = function(eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function(x, cb) {
          fn(x, function(err, y) {
            r = r.concat(y || []);
            cb(err);
          });
        }, function(err) {
          callback(err, r);
        });
      };
      async.concat = doParallel(_concat);
      async.concatSeries = doSeries(_concat);
      async.whilst = function(test, iterator, callback) {
        if (test()) {
          iterator(function(err) {
            if (err) {
              return callback(err);
            }
            async.whilst(test, iterator, callback);
          });
        } else {
          callback();
        }
      };
      async.doWhilst = function(iterator, test, callback) {
        iterator(function(err) {
          if (err) {
            return callback(err);
          }
          var args = Array.prototype.slice.call(arguments, 1);
          if (test.apply(null, args)) {
            async.doWhilst(iterator, test, callback);
          } else {
            callback();
          }
        });
      };
      async.until = function(test, iterator, callback) {
        if (!test()) {
          iterator(function(err) {
            if (err) {
              return callback(err);
            }
            async.until(test, iterator, callback);
          });
        } else {
          callback();
        }
      };
      async.doUntil = function(iterator, test, callback) {
        iterator(function(err) {
          if (err) {
            return callback(err);
          }
          var args = Array.prototype.slice.call(arguments, 1);
          if (!test.apply(null, args)) {
            async.doUntil(iterator, test, callback);
          } else {
            callback();
          }
        });
      };
      async.queue = function(worker, concurrency) {
        if (concurrency === void 0) {
          concurrency = 1;
        }
        function _insert(q2, data, pos, callback) {
          if (!q2.started) {
            q2.started = true;
          }
          if (!_isArray(data)) {
            data = [data];
          }
          if (data.length == 0) {
            return async.setImmediate(function() {
              if (q2.drain) {
                q2.drain();
              }
            });
          }
          _each(data, function(task) {
            var item = {
              data: task,
              callback: typeof callback === "function" ? callback : null
            };
            if (pos) {
              q2.tasks.unshift(item);
            } else {
              q2.tasks.push(item);
            }
            if (q2.saturated && q2.tasks.length === q2.concurrency) {
              q2.saturated();
            }
            async.setImmediate(q2.process);
          });
        }
        var workers = 0;
        var q = {
          tasks: [],
          concurrency,
          saturated: null,
          empty: null,
          drain: null,
          started: false,
          paused: false,
          push: function(data, callback) {
            _insert(q, data, false, callback);
          },
          kill: function() {
            q.drain = null;
            q.tasks = [];
          },
          unshift: function(data, callback) {
            _insert(q, data, true, callback);
          },
          process: function() {
            if (!q.paused && workers < q.concurrency && q.tasks.length) {
              var task = q.tasks.shift();
              if (q.empty && q.tasks.length === 0) {
                q.empty();
              }
              workers += 1;
              var next = function() {
                workers -= 1;
                if (task.callback) {
                  task.callback.apply(task, arguments);
                }
                if (q.drain && q.tasks.length + workers === 0) {
                  q.drain();
                }
                q.process();
              };
              var cb = only_once(next);
              worker(task.data, cb);
            }
          },
          length: function() {
            return q.tasks.length;
          },
          running: function() {
            return workers;
          },
          idle: function() {
            return q.tasks.length + workers === 0;
          },
          pause: function() {
            if (q.paused === true) {
              return;
            }
            q.paused = true;
          },
          resume: function() {
            if (q.paused === false) {
              return;
            }
            q.paused = false;
            for (var w = 1; w <= q.concurrency; w++) {
              async.setImmediate(q.process);
            }
          }
        };
        return q;
      };
      async.priorityQueue = function(worker, concurrency) {
        function _compareTasks(a, b) {
          return a.priority - b.priority;
        }
        ;
        function _binarySearch(sequence, item, compare) {
          var beg = -1, end = sequence.length - 1;
          while (beg < end) {
            var mid = beg + (end - beg + 1 >>> 1);
            if (compare(item, sequence[mid]) >= 0) {
              beg = mid;
            } else {
              end = mid - 1;
            }
          }
          return beg;
        }
        function _insert(q2, data, priority, callback) {
          if (!q2.started) {
            q2.started = true;
          }
          if (!_isArray(data)) {
            data = [data];
          }
          if (data.length == 0) {
            return async.setImmediate(function() {
              if (q2.drain) {
                q2.drain();
              }
            });
          }
          _each(data, function(task) {
            var item = {
              data: task,
              priority,
              callback: typeof callback === "function" ? callback : null
            };
            q2.tasks.splice(_binarySearch(q2.tasks, item, _compareTasks) + 1, 0, item);
            if (q2.saturated && q2.tasks.length === q2.concurrency) {
              q2.saturated();
            }
            async.setImmediate(q2.process);
          });
        }
        var q = async.queue(worker, concurrency);
        q.push = function(data, priority, callback) {
          _insert(q, data, priority, callback);
        };
        delete q.unshift;
        return q;
      };
      async.cargo = function(worker, payload) {
        var working = false, tasks = [];
        var cargo = {
          tasks,
          payload,
          saturated: null,
          empty: null,
          drain: null,
          drained: true,
          push: function(data, callback) {
            if (!_isArray(data)) {
              data = [data];
            }
            _each(data, function(task) {
              tasks.push({
                data: task,
                callback: typeof callback === "function" ? callback : null
              });
              cargo.drained = false;
              if (cargo.saturated && tasks.length === payload) {
                cargo.saturated();
              }
            });
            async.setImmediate(cargo.process);
          },
          process: function process2() {
            if (working) return;
            if (tasks.length === 0) {
              if (cargo.drain && !cargo.drained) cargo.drain();
              cargo.drained = true;
              return;
            }
            var ts = typeof payload === "number" ? tasks.splice(0, payload) : tasks.splice(0, tasks.length);
            var ds = _map(ts, function(task) {
              return task.data;
            });
            if (cargo.empty) cargo.empty();
            working = true;
            worker(ds, function() {
              working = false;
              var args = arguments;
              _each(ts, function(data) {
                if (data.callback) {
                  data.callback.apply(null, args);
                }
              });
              process2();
            });
          },
          length: function() {
            return tasks.length;
          },
          running: function() {
            return working;
          }
        };
        return cargo;
      };
      var _console_fn = function(name) {
        return function(fn) {
          var args = Array.prototype.slice.call(arguments, 1);
          fn.apply(null, args.concat([function(err) {
            var args2 = Array.prototype.slice.call(arguments, 1);
            if (typeof console !== "undefined") {
              if (err) {
                if (console.error) {
                  console.error(err);
                }
              } else if (console[name]) {
                _each(args2, function(x) {
                  console[name](x);
                });
              }
            }
          }]));
        };
      };
      async.log = _console_fn("log");
      async.dir = _console_fn("dir");
      async.memoize = function(fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function(x) {
          return x;
        };
        var memoized = function() {
          var args = Array.prototype.slice.call(arguments);
          var callback = args.pop();
          var key = hasher.apply(null, args);
          if (key in memo) {
            async.nextTick(function() {
              callback.apply(null, memo[key]);
            });
          } else if (key in queues) {
            queues[key].push(callback);
          } else {
            queues[key] = [callback];
            fn.apply(null, args.concat([function() {
              memo[key] = arguments;
              var q = queues[key];
              delete queues[key];
              for (var i = 0, l = q.length; i < l; i++) {
                q[i].apply(null, arguments);
              }
            }]));
          }
        };
        memoized.memo = memo;
        memoized.unmemoized = fn;
        return memoized;
      };
      async.unmemoize = function(fn) {
        return function() {
          return (fn.unmemoized || fn).apply(null, arguments);
        };
      };
      async.times = function(count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
          counter.push(i);
        }
        return async.map(counter, iterator, callback);
      };
      async.timesSeries = function(count, iterator, callback) {
        var counter = [];
        for (var i = 0; i < count; i++) {
          counter.push(i);
        }
        return async.mapSeries(counter, iterator, callback);
      };
      async.seq = function() {
        var fns = arguments;
        return function() {
          var that = this;
          var args = Array.prototype.slice.call(arguments);
          var callback = args.pop();
          async.reduce(
            fns,
            args,
            function(newargs, fn, cb) {
              fn.apply(that, newargs.concat([function() {
                var err = arguments[0];
                var nextargs = Array.prototype.slice.call(arguments, 1);
                cb(err, nextargs);
              }]));
            },
            function(err, results) {
              callback.apply(that, [err].concat(results));
            }
          );
        };
      };
      async.compose = function() {
        return async.seq.apply(null, Array.prototype.reverse.call(arguments));
      };
      var _applyEach = function(eachfn, fns) {
        var go = function() {
          var that = this;
          var args2 = Array.prototype.slice.call(arguments);
          var callback = args2.pop();
          return eachfn(
            fns,
            function(fn, cb) {
              fn.apply(that, args2.concat([cb]));
            },
            callback
          );
        };
        if (arguments.length > 2) {
          var args = Array.prototype.slice.call(arguments, 2);
          return go.apply(this, args);
        } else {
          return go;
        }
      };
      async.applyEach = doParallel(_applyEach);
      async.applyEachSeries = doSeries(_applyEach);
      async.forever = function(fn, callback) {
        function next(err) {
          if (err) {
            if (callback) {
              return callback(err);
            }
            throw err;
          }
          fn(next);
        }
        next();
      };
      if (typeof module !== "undefined" && module.exports) {
        module.exports = async;
      } else if (typeof define !== "undefined" && define.amd) {
        define([], function() {
          return async;
        });
      } else {
        root.async = async;
      }
    })();
  }
});

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

// node_modules/stk500/lib/receiveData.js
var require_receiveData = __commonJS({
  "node_modules/stk500/lib/receiveData.js"(exports, module) {
    var Statics = require_statics();
    var startingBytes = [
      Statics.Resp_STK_INSYNC
    ];
    module.exports = function(stream, timeout, responseLength, callback) {
      var buffer = Buffer.alloc(0);
      var started = false;
      var timeoutId = null;
      var handleChunk = function(data) {
        var index = 0;
        while (!started && index < data.length) {
          var byte = data[index];
          if (startingBytes.indexOf(byte) !== -1) {
            data = data.slice(index, data.length - index);
            started = true;
          }
          index++;
        }
        if (started) {
          buffer = Buffer.concat([buffer, data]);
        }
        if (buffer.length > responseLength) {
          return finished(new Error("buffer overflow " + buffer.length + " > " + responseLength));
        }
        if (buffer.length == responseLength) {
          finished();
        }
      };
      var finished = function(err) {
        if (timeoutId) {
          clearTimeout(timeoutId);
        }
        stream.removeListener("data", handleChunk);
        callback(err, buffer);
      };
      if (timeout && timeout > 0) {
        timeoutId = setTimeout(function() {
          timeoutId = null;
          finished(new Error("receiveData timeout after " + timeout + "ms"));
        }, timeout);
      }
      stream.on("data", handleChunk);
    };
  }
});

// node_modules/stk500/lib/sendCommand.js
var require_sendCommand = __commonJS({
  "node_modules/stk500/lib/sendCommand.js"(exports, module) {
    var receiveData = require_receiveData();
    var Statics = require_statics();
    module.exports = function(stream, opt, callback) {
      var timeout = opt.timeout || 0;
      var startingBytes = [
        Statics.Resp_STK_INSYNC,
        Statics.Resp_STK_NOSYNC
      ];
      var responseData = null;
      var responseLength = 0;
      var error;
      if (opt.responseData && opt.responseData.length > 0) {
        responseData = opt.responseData;
      }
      if (responseData) {
        responseLength = responseData.length;
      }
      if (opt.responseLength) {
        responseLength = opt.responseLength;
      }
      var cmd = opt.cmd;
      if (cmd instanceof Array) {
        cmd = Buffer.from(cmd.concat(Statics.Sync_CRC_EOP));
      }
      stream.write(cmd, function(err) {
        if (err) {
          error = new Error("Sending " + cmd.toString("hex") + ": " + err.message);
          return callback(error);
        }
        receiveData(stream, timeout, responseLength, function(err2, data) {
          if (err2) {
            error = new Error("Sending " + cmd.toString("hex") + ": " + err2.message);
            return callback(error);
          }
          if (responseData && !data.equals(responseData)) {
            error = new Error(cmd + " response mismatch: " + data.toString("hex") + ", " + responseData.toString("hex"));
            return callback(error);
          }
          callback(null, data);
        });
      });
    };
  }
});

// node_modules/stk500/index.js
var require_index = __commonJS({
  "node_modules/stk500/index.js"(exports, module) {
    var async = require_async();
    var Statics = require_statics();
    var sendCommand = require_sendCommand();
    var stk500 = function(opts) {
      this.opts = opts || {};
      this.quiet = this.opts.quiet || false;
      if (this.quiet) {
        this.log = function() {
        };
      } else {
        if (typeof window === "object") {
          this.log = console.log.bind(window);
        } else {
          this.log = console.log;
        }
      }
    };
    stk500.prototype.sync = function(stream, attempts, timeout, done) {
      this.log("sync");
      var self = this;
      var tries = 1;
      var opt = {
        cmd: [
          Statics.Cmnd_STK_GET_SYNC
        ],
        responseData: Statics.OK_RESPONSE,
        timeout
      };
      function attempt() {
        tries = tries + 1;
        sendCommand(stream, opt, function(err, data) {
          if (err && tries <= attempts) {
            if (err) {
              self.log(err);
            }
            self.log("failed attempt again", tries);
            return attempt();
          }
          self.log("sync complete", err, data, tries);
          done(err, data);
        });
      }
      attempt();
    };
    stk500.prototype.verifySignature = function(stream, signature, timeout, done) {
      this.log("verify signature");
      var self = this;
      match = Buffer.concat([
        Buffer.from([Statics.Resp_STK_INSYNC]),
        signature,
        Buffer.from([Statics.Resp_STK_OK])
      ]);
      var opt = {
        cmd: [
          Statics.Cmnd_STK_READ_SIGN
        ],
        responseLength: match.length,
        timeout
      };
      sendCommand(stream, opt, function(err, data) {
        if (data) {
          self.log("confirm signature", err, data, data.toString("hex"));
        } else {
          self.log("confirm signature", err, "no data");
        }
        done(err, data);
      });
    };
    stk500.prototype.getSignature = function(stream, timeout, done) {
      this.log("get signature");
      var opt = {
        cmd: [
          Statics.Cmnd_STK_READ_SIGN
        ],
        responseLength: 5,
        timeout
      };
      sendCommand(stream, opt, function(err, data) {
        this.log("getSignature", err, data);
        done(err, data);
      });
    };
    stk500.prototype.setOptions = function(stream, options, timeout, done) {
      this.log("set device");
      var self = this;
      var opt = {
        cmd: [
          Statics.Cmnd_STK_SET_DEVICE,
          options.devicecode || 0,
          options.revision || 0,
          options.progtype || 0,
          options.parmode || 0,
          options.polling || 0,
          options.selftimed || 0,
          options.lockbytes || 0,
          options.fusebytes || 0,
          options.flashpollval1 || 0,
          options.flashpollval2 || 0,
          options.eeprompollval1 || 0,
          options.eeprompollval2 || 0,
          options.pagesizehigh || 0,
          options.pagesizelow || 0,
          options.eepromsizehigh || 0,
          options.eepromsizelow || 0,
          options.flashsize4 || 0,
          options.flashsize3 || 0,
          options.flashsize2 || 0,
          options.flashsize1 || 0
        ],
        responseData: Statics.OK_RESPONSE,
        timeout
      };
      sendCommand(stream, opt, function(err, data) {
        self.log("setOptions", err, data);
        if (err) {
          return done(err);
        }
        done();
      });
    };
    stk500.prototype.enterProgrammingMode = function(stream, timeout, done) {
      this.log("send enter programming mode");
      var self = this;
      var opt = {
        cmd: [
          Statics.Cmnd_STK_ENTER_PROGMODE
        ],
        responseData: Statics.OK_RESPONSE,
        timeout
      };
      sendCommand(stream, opt, function(err, data) {
        self.log("sent enter programming mode", err, data);
        done(err, data);
      });
    };
    stk500.prototype.loadAddress = function(stream, useaddr, timeout, done) {
      this.log("load address");
      var self = this;
      var addr_low = useaddr & 255;
      var addr_high = useaddr >> 8 & 255;
      var opt = {
        cmd: [
          Statics.Cmnd_STK_LOAD_ADDRESS,
          addr_low,
          addr_high
        ],
        responseData: Statics.OK_RESPONSE,
        timeout
      };
      sendCommand(stream, opt, function(err, data) {
        self.log("loaded address", err, data);
        done(err, data);
      });
    };
    stk500.prototype.loadPage = function(stream, writeBytes, timeout, done) {
      this.log("load page");
      var self = this;
      var bytes_low = writeBytes.length & 255;
      var bytes_high = writeBytes.length >> 8;
      var cmd = Buffer.concat([
        Buffer.from([Statics.Cmnd_STK_PROG_PAGE, bytes_high, bytes_low, 70]),
        writeBytes,
        Buffer.from([Statics.Sync_CRC_EOP])
      ]);
      var opt = {
        cmd,
        responseData: Statics.OK_RESPONSE,
        timeout
      };
      sendCommand(stream, opt, function(err, data) {
        self.log("loaded page", err, data);
        done(err, data);
      });
    };
    stk500.prototype.upload = function(stream, hex, pageSize, timeout, done) {
      this.log("program");
      var pageaddr = 0;
      var writeBytes;
      var useaddr;
      var self = this;
      async.whilst(
        function() {
          return pageaddr < hex.length;
        },
        function(pagedone) {
          self.log("program page");
          async.series(
            [
              function(cbdone) {
                useaddr = pageaddr >> 1;
                cbdone();
              },
              function(cbdone) {
                self.loadAddress(stream, useaddr, timeout, cbdone);
              },
              function(cbdone) {
                writeBytes = hex.slice(pageaddr, hex.length > pageSize ? pageaddr + pageSize : hex.length - 1);
                cbdone();
              },
              function(cbdone) {
                self.loadPage(stream, writeBytes, timeout, cbdone);
              },
              function(cbdone) {
                self.log("programmed page");
                pageaddr = pageaddr + writeBytes.length;
                setTimeout(cbdone, 4);
              }
            ],
            function(error) {
              self.log("page done");
              pagedone(error);
            }
          );
        },
        function(error) {
          self.log("upload done");
          done(error);
        }
      );
    };
    stk500.prototype.exitProgrammingMode = function(stream, timeout, done) {
      this.log("send leave programming mode");
      var self = this;
      var opt = {
        cmd: [
          Statics.Cmnd_STK_LEAVE_PROGMODE
        ],
        responseData: Statics.OK_RESPONSE,
        timeout
      };
      sendCommand(stream, opt, function(err, data) {
        self.log("sent leave programming mode", err, data);
        done(err, data);
      });
    };
    stk500.prototype.verify = function(stream, hex, pageSize, timeout, done) {
      this.log("verify");
      var pageaddr = 0;
      var writeBytes;
      var useaddr;
      var self = this;
      async.whilst(
        function() {
          return pageaddr < hex.length;
        },
        function(pagedone) {
          self.log("verify page");
          async.series(
            [
              function(cbdone) {
                useaddr = pageaddr >> 1;
                cbdone();
              },
              function(cbdone) {
                self.loadAddress(stream, useaddr, timeout, cbdone);
              },
              function(cbdone) {
                writeBytes = hex.slice(pageaddr, hex.length > pageSize ? pageaddr + pageSize : hex.length - 1);
                cbdone();
              },
              function(cbdone) {
                self.verifyPage(stream, writeBytes, pageSize, timeout, cbdone);
              },
              function(cbdone) {
                self.log("verified page");
                pageaddr = pageaddr + writeBytes.length;
                setTimeout(cbdone, 4);
              }
            ],
            function(error) {
              self.log("verify done");
              pagedone(error);
            }
          );
        },
        function(error) {
          self.log("verify done");
          done(error);
        }
      );
    };
    stk500.prototype.verifyPage = function(stream, writeBytes, pageSize, timeout, done) {
      this.log("verify page");
      var self = this;
      match = Buffer.concat([
        Buffer.from([Statics.Resp_STK_INSYNC]),
        writeBytes,
        Buffer.from([Statics.Resp_STK_OK])
      ]);
      var size = writeBytes.length >= pageSize ? pageSize : writeBytes.length;
      var opt = {
        cmd: [
          Statics.Cmnd_STK_READ_PAGE,
          size >> 8 & 255,
          size & 255,
          70
        ],
        responseLength: match.length,
        timeout
      };
      sendCommand(stream, opt, function(err, data) {
        self.log("confirm page", err, data, data.toString("hex"));
        done(err, data);
      });
    };
    stk500.prototype.bootload = function(stream, hex, opt, done) {
      var parameters = {
        pagesizehigh: opt.pagesizehigh << 8 & 255,
        pagesizelow: opt.pagesizelow & 255
      };
      async.series([
        // send two dummy syncs like avrdude does
        this.sync.bind(this, stream, 3, opt.timeout),
        this.sync.bind(this, stream, 3, opt.timeout),
        this.sync.bind(this, stream, 3, opt.timeout),
        this.verifySignature.bind(this, stream, opt.signature, opt.timeout),
        this.setOptions.bind(this, stream, parameters, opt.timeout),
        this.enterProgrammingMode.bind(this, stream, opt.timeout),
        this.upload.bind(this, stream, hex, opt.pageSize, opt.timeout),
        this.verify.bind(this, stream, hex, opt.pageSize, opt.timeout),
        this.exitProgrammingMode.bind(this, stream, opt.timeout)
      ], function(error) {
        return done(error);
      });
    };
    module.exports = stk500;
  }
});
export default require_index();
/*! Bundled license information:

async/lib/async.js:
  (*!
   * async
   * https://github.com/caolan/async
   *
   * Copyright 2010-2014 Caolan McMahon
   * Released under the MIT license
   *)
*/
