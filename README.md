# DESCRIPTION
  
  Async tasks queue. 


# USAGE

  %% TODO: @include extract_comments('pipe.js') %%


# EXAMPLE

### Basic example:

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

### Practical example:

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
