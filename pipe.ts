type Task = {
  fn: Function;
  context?: any;
  args?: any[];
};

type DoneCallback = {
  callback: Function;
  context?: any;
};

class Pipe {
  private maxConcurrency: number; // Maximum number of concurrent tasks
  private taskQueue: Task[]; // Pending tasks queue
  private callbackQueue: DoneCallback[]; // Queue of callbacks awaiting tasks
  private runningTasksCount: number; // Number of tasks currently running

  constructor(concurrency: number = 1, ...initialTasks: Task[]) {
    this.maxConcurrency = concurrency || 1;
    this.taskQueue = initialTasks;
    this.callbackQueue = [];
    this.runningTasksCount = 0;
  }

  /**
   * Enqueue a new task to the tasks queue.
   */
  fill(fn: Function, context?: any, ...args: any[]): Pipe {
    const task: Task = (typeof fn === 'object' && fn.fn)
      ? fn as Task
      : { fn, context, args };

    // Append task to the tasks queue
    this.taskQueue.push(task);

    // Start processing tasks
    return this._start();
  }

  /**
   * Dequeue a task from the tasks queue and execute it.
   */
  fetch(callback: Function, context?: any): Pipe {
    const doneCallback: DoneCallback = (typeof callback === 'object' && callback.callback)
      ? callback as DoneCallback
      : { callback, context };

    // Wait for the availability of tasks in the queue
    this.callbackQueue.push(doneCallback);

    // Start processing tasks
    return this._start();
  }

  /**
   * Helper function to dequeue all tasks from the tasks queue.
   */
  flush(callback: Function, context?: any): Pipe {
    let pendingTasks = this.taskQueue.length - this.callbackQueue.length;
    while (pendingTasks--) {
      // Dequeue and handle with the same callback
      this.fetch(callback, context);
    }

    // Chain
    return this;
  }

  /**
   * Helper function to reset the task queue.
   */
  reset(forceReset?: boolean): Pipe {
    // Empty out tasks and callback queues
    this.taskQueue.length = this.callbackQueue.length = 0;

    // Reset running task count if forceReset is truthy
    if (forceReset) {
      this.runningTasksCount = 0;
    }

    // Chain
    return this;
  }

  private _start(): Pipe {
    // (1) If any pending tasks exist
    // (2) There's a request to process the task
    // (3) And not too many tasks are already running
    if (this.taskQueue.length && this.callbackQueue.length && (this.runningTasksCount < this.maxConcurrency)) {
      // Process the next available task
      this._run(this.taskQueue.shift()!, this.callbackQueue.shift()!);
    }

    // Chain
    return this;
  }

  private _run(task: Task, doneCallback: DoneCallback): Pipe {
    // Increment running task count
    ++this.runningTasksCount;

    // Execute the task function and wait for it to call the provided callback
    task.fn.apply(task.context || this, task.args?.concat([
      // Add the done callback to task arguments
      (...resultArgs: any[]) => {
        // Notify the callback and continue processing
        doneCallback.callback.apply(doneCallback.context || this, resultArgs.concat([
          // After task completion, proceed to start the next task
          () => {
            --this.runningTasksCount;
            this._start();
          }
        ]));
      }
    ]));

    // Chain
    return this;
  }

  /**
   * Helper function to get the count of queued tasks or dequeue requests.
   */
  count(alt: boolean = false, excludeRunning: boolean = false): number {
    return (alt ? this.callbackQueue.length : this.taskQueue.length) + (excludeRunning ? 0 : this.runningTasksCount);
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
