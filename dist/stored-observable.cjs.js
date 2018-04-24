'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var mobx = require('mobx');
var merge = _interopDefault(require('lodash.merge'));
var cloneDeep = _interopDefault(require('lodash.clonedeep'));
var isObject = _interopDefault(require('lodash.isobject'));

/* global localStorage, sessionStorage */
var reservedKeys = ['reset', 'extend', 'destroy'];

var checkReservedKeys = function checkReservedKeys(obj) {
  if (isObject(obj)) {
    Object.keys(obj).forEach(function (key) {
      if (reservedKeys.includes(key)) {
        throw new TypeError('property ' + key + ' is reserved for storedObservable method');
      }
    });
  }
};

function factory(storage) {
  return function storedObservable(key, defaultValue) {
    var autorunOpts = arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : { delay: 500 };

    var fromStorage = storage.getItem(key);
    checkReservedKeys(defaultValue);
    checkReservedKeys(fromStorage);

    var defaultClone = cloneDeep(defaultValue); // we don't want to modify the given object, because userscript might want to use the original object to reset the state back to default values some time later
    if (fromStorage) {
      merge(defaultClone, JSON.parse(fromStorage));
    }

    var obsVal = mobx.observable(defaultClone);
    var disposeAutorun = void 0;
    var establishAutorun = function establishAutorun() {
      disposeAutorun = mobx.autorun(function () {
        storage.setItem(key, JSON.stringify(mobx.toJS(obsVal)));
      }, autorunOpts);
    };
    establishAutorun();

    var propagateChangesToMemory = function propagateChangesToMemory(e) {
      if (e.key === key) {
        disposeAutorun();
        var newValue = JSON.parse(e.newValue);
        mobx.set(obsVal, newValue);

        establishAutorun();
      }
    };
    window.addEventListener('storage', propagateChangesToMemory);

    obsVal.reset = function () {
      disposeAutorun && disposeAutorun();
      mobx.set(obsVal, defaultValue);
      Object.keys(obsVal).forEach(function (key) {
        if (!defaultValue.hasOwnProperty(key) && !['reset', 'extend', 'destroy'].includes(key)) {
          delete obsVal[key];
        }
      });
      establishAutorun();
    };
    obsVal.extend = function (obj) {
      disposeAutorun && disposeAutorun();
      mobx.set(obsVal, obj);
      establishAutorun();
    };
    obsVal.destroy = function () {
      disposeAutorun();
      storage.removeItem(key);
      window.removeEventListener('storage', propagateChangesToMemory);
    };
    return obsVal;
  };
}




if (process && process.release && process.release.name === 'node') {
  exports.localStored = factory({});
  exports.sessionStored = factory({});
} else {
  exports.localStored = factory(localStorage);
  exports.sessionStored = factory(sessionStorage);
}

exports.factory = factory;
