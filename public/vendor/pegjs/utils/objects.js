"use strict";

/* Object utilities. */
var objects = {
  keys: function(object) {
    var result = [], key;

    for (key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        result.push(key);
      }
    }

    return result;
  },

  values: function(object) {
    var result = [], key;

    for (key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        result.push(object[key]);
      }
    }

    return result;
  },

  clone: function(object) {
    var result = {}, key;

    for (key in object) {
      if (Object.prototype.hasOwnProperty.call(object, key)) {
        result[key] = object[key];
      }
    }

    return result;
  },

  defaults: function(object, defaults) {
    var key;

    for (key in defaults) {
      if (Object.prototype.hasOwnProperty.call(defaults, key)) {
        if (!(key in object)) {
          object[key] = defaults[key];
        }
      }
    }
  }
};

module.exports = objects;
