type Task = {
  fn: Function;
  cxt?: any;
  args?: any[];
};

type DoneCallback = {
  cb: Function;
  cxt?: any;
};

class Pipe {
  private _c: number; // Maximum number of concurrent tasks
  private _t: Task[]; // Pending tasks queue
  private _w: DoneCallback[]; // Queue of callbacks awaiting for tasks
  private _r: number; // Number of running tasks (always <= this._c)

  constructor(concurrency: number = 1, ...tasks: Task[]) {
    // Initialize Pipe with concurrency and initial tasks
    this._c = concurrency || 1;
    this._t = tasks;
    this._w = [];
    this._r = 0;
  }

  /**
   * Enqueue a new task to the tasks queue.
   */
  fill(fn: Function, cxt?: any, ...args: any[]): Pipe {
    const task: Task = (typeof fn === 'object' && fn.fn) 
      ? fn as Task 
      : { fn, cxt, args };

    // Append task to the tasks queue
    this._t.push(task);

    // Start task
    return this._start();
  }

  /**
   * Dequeue a task from the tasks queue and execute it.
   */
  fetch(cb: Function, cxt?: any): Pipe {
    const done: DoneCallback = (typeof cb === 'object' && cb.cb)
      ? cb as DoneCallback
      : { cb, cxt };

    // Wait for availability of task in the queue
    this._w.push(done);

    // Start task
    return this._start();
  }

  /**
   * Helper function to dequeue all tasks from the tasks queue.
   */
  flush(cb: Function, cxt?: any): Pipe {
    let pending = this._t.length - this._w.length;
    while (pending--) {
      // Dequeue with the same callback
      this.fetch(cb, cxt);
    }

    // Chain
    return this;
  }

  /**
   * Helper function to reset the pipe.
   */
  reset(force?: boolean): Pipe {
    // Empty out tasks queue and waiting queue
    this._t.length = this._w.length = 0;

    // Reset running count if force is truthy
    if (force) {
      this._r = 0;
    }

    // Chain
    return this;
  }

  private _start(): Pipe {
    // (1) if any pending tasks in task queue and
    // (2) there's a request to run the task and
    // (3) not many tasks are already running
    if (this._t.length && this._w.length && (this._r < this._c)) {
      // Run the next runnable task
      this._run(this._t.shift()!, this._w.shift()!);
    }

    // Chain
    return this;
  }

  private _run(task: Task, done: DoneCallback): Pipe {
    // Task is running, increment count
    ++this._r;

    // Call task function and wait for it to call done
    task.fn.apply(task.cxt || this, task.args?.concat([
      // Add done callback to task args (without modifying it)
      (...args: any[]) => {
        // Notify via done callback and wait for it to call next
        done.cb.apply(done.cxt || this, args.concat([
          // Add next callback to done args (without modifying it)
          () => {
            // Task completed, decrement count
            --this._r;
            // Start next runnable task
            this._start();
          }
        ]));
      }
    ]));

    // Chain
    return this;
  }

  /**
   * Helper function to get count of queued tasks or dequeue requests.
   */
  count(alt: boolean = false, excludeRunning: boolean = false): number {
    return (alt ? this._w.length : this._t.length) + (excludeRunning ? 0 : this._r);
  }
}

// Export for CommonJS or AMD
if (typeof define === "function" && define.amd) {
  define(() => Pipe);
} else if (typeof module === "object" && module.exports) {
  module.exports = Pipe;
} else {
  (window as any).Pipe = Pipe;
}
