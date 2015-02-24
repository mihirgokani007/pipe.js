/**

DESCRIPTION:
  
  Async tasks queue. 


EXAMPLE:

  var task_add = function(argx, argy, done) { 
    setTimeout(function() {
      console.log('add complete!', argx, argy); 
      done(null, argx + argy);
    }, 5000);
  }
  var task_sub = function(argx, argy, done) { 
    setTimeout(function() {
      console.log('sub complete!', argx, argy); 
      done(null, argx - argy);
    }, 1000);
  }

  var get_resource = function(url, done) { 
    fetch(url, function(result) {
      done(null, result);
    });
  }

  var pipe = new Pipe();
  pipe
    .fill(task_add, 10, 15)
    .fill(task_sub, 40, 20)
    .fetch(function(err, result) { 
      console.log('result', result); // -> (null, 25) 
    })
    .fetch(function(err, result) { 
      console.log('result', result); // -> (null, 20) 
    });

  pipe
    .fill(get_resource, '1.json')
    .fill(get_resource, '2.json')
    .flush(function(err, result) { 
      console.log('result', result); // -> {contents of 1.json}, {contents of 2.json}
    });

**/

(function() {
  var slice = [].slice;

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

  if (typeof define === "function" && define.amd) define(function() { return Pipe; });
  else if (typeof module === "object" && module.exports) module.exports = Pipe;
  else this.Pipe = Pipe;
  
}());
