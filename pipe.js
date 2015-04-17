(function() {
  var slice = [].slice;

  /**
   * Create a new instance optionally initialized with `concurrency` and initial
   * tasks.
   * 
   * The `concurrency` is maximum number of tasks that can be executed 
   * simultaneously. By default there's no concurrency (concurrency == 1). 
   * It can be set to `Infinity` to get maximum concurrency (a task gets run as 
   * soon as it is fetched). A falsy concurrency value (false, null, or 0) has 
   * same effect as concurrency value 1 (i.e. no concurrency).
   * 
   * Initial tasks can be specified as extra arguments. Each task is an object 
   * having 3 keys:
   * - `fn` a user function that actually does task (required)
   * - `cxt` a context object to use when calling `fn` (optional)
   * - `args` arguments to pass when calling `fn` (optional)
   */
  function Pipe(concurrency /*, tasks*/) {
    
    // maximum number of concurrent tasks
    this._c = concurrency || 1;
    // pending tasks queue
    this._t = slice.call(arguments, 1);
    // queue of callbacks awaiting for tasks
    this._w = [];
    // number of running tasks (always <= this._c)
    this._r = 0;

  }

  Pipe.prototype = {

    /**
     * Enqueue a new task to the tasks queue.
     * 
     * A task is a function that does some async work and calls `done` function 
     * when the async work completes. The `done` function is always passed as 
     * the last argument while the task function is called. 
     * 
     * If there are any fetch requests (callbacks) awaiting for the availability 
     * of tasks, one of the callbacks is dequeued and executed. Otherwise, the 
     * task is enqueued in the tasks queue for later fetch requests.
     *
     * Note that a task can be specified as an object having 3 keys: 
     * - `fn` a user function that actually does task (required) 
     * - `cxt` a context object to use when calling `fn` (optional) 
     * - `args` arguments to pass when calling `fn` (optional)
     *
     * The task elements can also be specified individually; where the first 2
     * arguments are `fn` and `cxt` respectively, and `args` can be specified
     * as extra arguments after `cxt`. If you want to skip `cxt` but not `args`, 
     * a `null` value can be provided (which follows the default behaviour of 
     * using the global object as context). This makes `cxt` optional only if 
     * `args` is skipped. 
     */
    fill: function(fn, cxt) {
      var task = (typeof fn === "object" && fn.fn) ? fn : {fn: fn, cxt: cxt, args: slice.call(arguments, 2)};
      // append task to the tasks queue
      this._t.push(task);
      // start task
      return this._start();
    },

    /**
     * Dequeue a task from the tasks queue and execute it.
     * 
     * A callback and an optional context is passed, which gets called when task 
     * is complete (i.e. the task function calls `done` function).
     * 
     * If there are any tasks available in the tasks queue, one is dequeued and 
     * executed. Otherwise, the callback awaits for a task to get added in the 
     * tasks queue.
     */
    fetch: function(cb, cxt) {
      var done = (typeof cb === "object" && cb.cb) ? cb : {cb: cb, cxt: cxt};
      // wait for availability of task in the queue
      this._w.push(done);
      // start task
      return this._start();
    },

    /**
     * Helper function to dequeue all tasks from the tasks queue.
     * 
     * A callback and an optional context is passed, which gets called when each 
     * task is complete (i.e. the task function calls `done` function).
     * 
     * If there are currently no tasks in the task queue, nothing will happen.
     */
    flush: function(cb, cxt) {
      // task queue length might not change with each dequeue and there might 
      // already be some callbacks in the waiting queue (both are true due to 
      // concurrency limit)
      var pending = this._t.length - this._w.length;
      // hence count manually
      while (pending--) {
        // dequeue with same callback
        this.fetch(cb, cxt);
        // note that we have to _start in each loop iteration (calling fetch() 
        // does that) to run up to maximum number of tasks in parallel
      }

      // chain
      return this;
    },

    /**
     * Helper function to reset the pipe.
     * 
     * If there are any running tasks still in the pipe, they will occupy some 
     * concurrency limit, unless force is a truthy value. So if force is falsy 
     * and any new tasks are enqueued, they will run in parallel up to maximum 
     * concurrency limit.
     */
    reset: function(force) {
      // empty out tasks queue and waiting queue
      this._t.length = this._w.length = 0;
      
      // reset running count if force is truthy
      if (force) { 
        this._r = 0;
      }
      
      // chain
      return this;
    },

    _start: function() {
      // (1) if any pending tasks in task queue and
      // (2) there's a request to run the task and
      // (3) not many tasks are already running
      if (this._t.length && this._w.length && (this._r < this._c)) {
        // run the next runnable task
        this._run(this._t.shift(), this._w.shift());
      }
      
      // chain
      return this;
    },

    _run: function(task, done) {
      // task is running, increment count
      ++this._r;
      
      // call task function and wait for it to call done
      task.fn.apply(task.cxt || this, task.args.concat([
        // add done callback to task args (without modifying it)
        function() { 
          // notify via done callback and wait for it to call next
          done.cb.apply(done.cxt || this, slice.call(arguments).concat([
            // add next callback to done args (without modifying it)
            function() {
              // task completed, decrement count
              --this._r;
              // start next runnable task
              this._start();
            }.bind(this)
          ]));
          
        }.bind(this)
      ])); 
      
      // chain
      return this;
    },

    /**
     * Helper function to get count of queued tasks or dequeue requests.
     * 
     * There are 2 different types of counts, number of tasks (fill requests) 
     * and number of dequeues (fetch requests). If `alt` is true (which 
     * activates an alternate mode), number of fetch requests are returned 
     * instead of number of fill requests. If `excludeRunning` is true, 
     * running tasks are ignored from the result (also relevant for alt-mode).
     */
    count: function(alt, excludeRunning) {
      return (alt ? this._w.length : this._t.length) + (excludeRunning ? 0 : this._r);
    }

  };

  if (typeof define === "function" && define.amd) {
    define(function() { return Pipe; });
  } else if (typeof module === "object" && module.exports) {
    module.exports = Pipe;
  } else {
    this.Pipe = Pipe;
  }

}());
