(function() {
  var slice = [].slice;

  /**
   * Create a new instance optionally initialized with `concurrency` and initial
   * tasks.
   * 
   * The `concurrency` is maximum number of tasks that can be executed 
   * simultaneously. By default there's no concurrency (concurrency == 1). 
   * It can be set to Infinity to get maximum concurrency (a task gets run as 
   * soon as it is fetched). A falsy concurrency value (false, null, or 0) has 
   * same effect as concurrency value 1 (i.e. no concurrency).
   * 
   * Initial tasks can be specified as extra arguments. Each task is an object 
   * having 2 keys:
   * - `fn` a user function that actually does task
   * - `args` arguments to pass to `fn` when calling
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
     */
    fill: function(fn) {
      var task = {fn: fn, args: slice.call(arguments, 1)};
      // if any tasks already available in the queue
      if (!this._w.length || this._r >= this._c) {
        // append [fn + arguments] to tasks queue
        this._t.push(task);
        return this;
      } 
      // get done callback
      var done = this._w.shift();
      // start task
      return this._run(task, done);
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
      var done = {cb: cb, cxt: cxt || this};
      // if any callbacks already waiting in the queue
      if (!this._t.length || this._r >= this._c) {
        // wait for availability of task in the queue
        this._w.push(done);
        return this; 
      }
      // get [fn + its arguments]
      var task = this._t.shift();
      // start task
      return this._run(task, done);
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
      var done = {cb: cb, cxt: cxt || this};
      var task;
      // count manually
      while (this._t.length > 0) {
        // dequeue with same callback
        task = this._t.shift();
        this._run(task, done);
      }

      // chain
      return this;
    },

    _run: function(task, done) {
      // task is running, increment count
      ++this._r;
      
      // add done callback to task args
      task.args.push(function(err, val) { 
        // task completed, decrement count
        --this._r;
        // notify via done callback
        done.cb.call(done.cxt, err, val)
        // if any pending tasks in task queue and
        // there's a request to run the task and
        // not many tasks are already running
        if (this._t.length && this._w.length && (this._r < this._c)) {
          // reuse variables for next runnable task
          task = this._t.shift();
          done = this._w.shift();
          // run the next runnable task
          this._run(task, done);
        }
      }.bind(this));

      // call task function and wait for it to call done
      task.fn.apply(null, task.args); 
      
      // chain
      return this;
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
