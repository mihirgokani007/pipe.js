type Task = {
  fn: Function;  // Function to execute the task
  context?: any;  // Context (`this`) to use when calling the task function
  args?: any[];   // Arguments to pass to the task function
};

type DoneCallback = {
  callback: Function;  // Callback function to execute when the task is complete
  context?: any;       // Context (`this`) to use when calling the callback function
};

class TaskQueue {
  private _maxConcurrentTasks: number;  // Maximum number of tasks that can run concurrently
  private _pendingTasks: Task[];        // Queue of tasks that are yet to be processed
  private _waitingCallbacks: DoneCallback[]; // Queue of callbacks waiting for tasks to finish
  private _activeTaskCount: number;     // Number of tasks currently running

  /**
   * Create a new TaskQueue instance with optional concurrency and initial tasks.
   * @param concurrency - Maximum number of concurrent tasks to process. Defaults to 1.
   * @param initialTasks - Optional tasks to enqueue initially.
   */
  constructor(concurrency: number = 1, ...initialTasks: Task[]) {
    this._maxConcurrentTasks = concurrency || 1;
    this._pendingTasks = initialTasks;   // Initialize with the provided tasks
    this._waitingCallbacks = [];         // No callbacks waiting initially
    this._activeTaskCount = 0;           // No tasks running initially
  }

  /**
   * Add a new task to the task queue.
   * @param fn - The function representing the task to execute.
   * @param context - The context (`this`) to bind when calling the function.
   * @param args - Arguments to pass to the task function.
   * @returns The current TaskQueue instance for chaining.
   */
  fill(fn: Function, context?: any, ...args: any[]): TaskQueue {
    const task: Task = (typeof fn === 'object' && fn.fn) 
      ? fn as Task 
      : { fn, context, args };

    this._pendingTasks.push(task);  // Add the new task to the queue

    return this._processNextTask();  // Attempt to start processing tasks
  }

  /**
   * Request a task to be executed and specify a callback to be called when it finishes.
   * @param callback - The function to call when the task is complete.
   * @param context - The context (`this`) to bind when calling the callback.
   * @returns The current TaskQueue instance for chaining.
   */
  fetch(callback: Function, context?: any): TaskQueue {
    const doneCallback: DoneCallback = (typeof callback === 'object' && callback.callback)
      ? callback as DoneCallback
      : { callback, context };

    this._waitingCallbacks.push(doneCallback);  // Add the callback to the waiting queue

    return this._processNextTask();  // Attempt to start processing tasks
  }

  /**
   * Dequeue and process all pending tasks in the queue.
   * @param callback - The callback to be called when each task finishes.
   * @param context - The context (`this`) to bind when calling the callback.
   * @returns The current TaskQueue instance for chaining.
   */
  flush(callback: Function, context?: any): TaskQueue {
    let remainingTasks = this._pendingTasks.length - this._waitingCallbacks.length;
    
    // Process remaining tasks in the queue
    while (remainingTasks--) {
      this.fetch(callback, context);  // Request task execution for each remaining task
    }

    return this;  // Return the current instance to allow chaining
  }

  /**
   * Reset the task queue, clearing all pending tasks and waiting callbacks.
   * Optionally resets the active task count.
   * @param forceReset - Whether to reset the active task count or not.
   * @returns The current TaskQueue instance for chaining.
   */
  reset(forceReset?: boolean): TaskQueue {
    this._pendingTasks.length = this._waitingCallbacks.length = 0;  // Clear both queues

    if (forceReset) {
      this._activeTaskCount = 0;  // Optionally reset the active task count
    }

    return this;  // Return the current instance to allow chaining
  }

  /**
   * Internal method to start processing tasks if there is capacity.
   * @returns The current TaskQueue instance for chaining.
   */
  private _processNextTask(): TaskQueue {
    // If there are pending tasks and waiting callbacks, and the concurrency limit allows:
    if (this._pendingTasks.length && this._waitingCallbacks.length && (this._activeTaskCount < this._maxConcurrentTasks)) {
      // Process the next task from the pending tasks queue
      this._executeTask(this._pendingTasks.shift()!, this._waitingCallbacks.shift()!);
    }

    return this;  // Return the current instance to allow chaining
  }

  /**
   * Internal method to execute a given task and notify the callback when it's done.
   * @param task - The task to execute.
   * @param doneCallback - The callback to call when the task completes.
   * @returns The current TaskQueue instance for chaining.
   */
  private _executeTask(task: Task, doneCallback: DoneCallback): TaskQueue {
    this._activeTaskCount++;  // Increment the count of active tasks

    // Execute the task function and ensure to call the done callback when it's finished
    task.fn.apply(task.context || this, task.args?.concat([
      (...resultArgs: any[]) => {
        // Notify the callback and start the next task once this one is done
        doneCallback.callback.apply(doneCallback.context || this, resultArgs.concat([
          // After task completion, decrement the active task count and process the next task
          () => {
            this._activeTaskCount--;  // Decrement the active task count
            this._processNextTask();  // Process the next task if available
          }
        ]));
      }
    ]));

    return this;  // Return the current instance to allow chaining
  }

  /**
   * Get the count of tasks in the queue or the number of callbacks waiting for tasks.
   * @param alt - If true, return the number of waiting callbacks instead of pending tasks.
   * @param excludeRunning - If true, exclude currently running tasks from the count.
   * @returns The count of tasks or waiting callbacks in the queue.
   */
  count(alt: boolean = false, excludeRunning: boolean = false): number {
    // Return the count of either pending tasks or waiting callbacks, adjusted for active tasks if needed
    return (alt ? this._waitingCallbacks.length : this._pendingTasks.length) + (excludeRunning ? 0 : this._activeTaskCount);
  }
}

// Export for CommonJS or AMD
if (typeof define === "function" && define.amd) {
  define(() => TaskQueue);
} else if (typeof module === "object" && module.exports) {
  module.exports = TaskQueue;
} else {
  (window as any).TaskQueue = TaskQueue;
}
