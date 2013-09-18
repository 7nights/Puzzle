'use strict';

/* Services */


// Demonstrate how to register services
// In this case it is a simple value service.
angular.module('myApp.services', []).
  value('version', '0.1').
  provider('Tiger', function () {
    /*
   * example:
   * var tiger = new Tiger();
   * tiger.feed
   */

    /*
     * @private
     */
    function emit(context, arg, type, listeners) {
      listeners.forEach(function (val) {
        if (val.type === type) {
          val.callback.call(context, arg);
        }
      });
    }

    
    function Tiger() {
      this.finished = false;
      this.count = 0;
      this.listeners = [];
    }
    Tiger.prototype = {
      feed: function (count) {
        this.count += count || 1;
        return this;
      },
      eat: function () {
        this.count --;
        if (this.finished && this.count <= 0) {
          emit(this, undefined, 'hungry', this.listeners);
        }
      },
      on: function (type, callback) {
        this.listeners.push({
          type: type,
          callback: callback
        });
      },
      removeListener: function (type, callback) {
        this.listeners.forEach(function (val, i) {
          if (val.type === type && val.callback === callback) {
            this.listeners.splice(i, 1);
          }
        });
      },
      finishFeeding: function () {
        this.finished = true;
        if (this.count <= 0) {
          emit(this, undefined, 'hungry', this.listeners);
        }
      }

    };

    this.$get = function () {
      return Tiger;
    };
  });
