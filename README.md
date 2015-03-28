# Pipe.js
  
Pipe.js is an async task queuing helper library with following great features:

* Small size micro library (<500b)
* It is written in pure JavaScript
* It doesn't have any dependencies
* It can work with other libraries
* It can run in browser and nodejs

It is similar to [queue.js](mbostock/queue) but built with a different 
philosophy in mind. 
* In `queue.js` you fill up a queue with tasks and \*then\* await for them to 
  complete one by one or together. By design, this only allows awaiting for 
  tasks which are already added \[1\], but not for tasks which are dynamically 
  added later. 
* With `Pipe.js`, you *fill* a pipe from one end with tasks that 
  asynchronously supply some results and *fetch* the results from the other 
  end as they become available. The *fetch* requests are deferred if there are 
  no tasks in the pipe, just like execution of tasks is deferred if there are 
  no fetch requests. The pipe ensures that the order of tasks match with order 
  of fetch requests (i.e. result of first added task is served to first fetch 
  request, second to second, and so on). This allows dynamically adding tasks 
  to the pipe while being assured about their execution order.

  %%TODO: Illustration Image%%


### USAGE

  %% TODO: @include extract_comments('pipe.js') %%


### EXAMPLE

##### Basic example:

  ```javascript
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
  ```

##### Practical example:

  ```javascript
  var get_resource = function(url, done) { 
    fetch(url, function(err, result) {
      done(err, result);
    });
  }

  pipe
    .fill(get_resource, '1.json')
    .fill(get_resource, '2.json')
    .flush(function(err, result) { 
      if (err) {
        console.error(err);
        return;
      }
      console.log('result', result); // -> {contents of *.json}
    });
  ```
