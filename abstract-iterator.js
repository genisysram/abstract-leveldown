function AbstractIterator (db) {
  if (typeof db !== 'object' || db === null) {
    throw new TypeError('First argument must be an abstract-leveldown compliant store')
  }

  this.db = db
  this._ended = false
  this._nexting = false
}

AbstractIterator.prototype.next = function (callback) {
  var self = this

  if (typeof callback !== 'function') {
    throw new Error('next() requires a callback argument')
  }

  if (self._ended) {
    process.nextTick(callback, new Error('cannot call next() after end()'))
    return self
  }

  if (self._nexting) {
    process.nextTick(callback, new Error('cannot call next() before previous next() has completed'))
    return self
  }

  self._nexting = true
  self._next(function () {
    self._nexting = false
    callback.apply(null, arguments)
  })

  return self
}

AbstractIterator.prototype._next = function (callback) {
  process.nextTick(callback)
}

AbstractIterator.prototype.seek = function (target) {
  if (this._ended) {
    throw new Error('cannot call seek() after end()')
  }
  if (this._nexting) {
    throw new Error('cannot call seek() before next() has completed')
  }

  target = this.db._serializeKey(target)
  this._seek(target)
}

AbstractIterator.prototype._seek = function (target) { }

AbstractIterator.prototype.end = function (callback) {
  if (typeof callback !== 'function') {
    throw new Error('end() requires a callback argument')
  }

  if (this._ended) {
    return process.nextTick(callback, new Error('end() already called on iterator'))
  }

  this._ended = true
  this._end(callback)
}

AbstractIterator.prototype._end = function (callback) {
  process.nextTick(callback)
}

if (Symbol && Symbol['asyncIterator'] !== undefined) {
  AbstractIterator.prototype[Symbol['asyncIterator']] = function () {
    var self = this
    var it = {
      [Symbol['asyncIterator']]: function () {
        return it
      },
      next: function () {
        return new Promise(function (resolve, reject) {
          self.next(function (err, key, value) {
            if (err) {
              reject(err)
            } else if (key && value) {
              resolve({
                value: { key, value },
                done: false
              })
            } else {
              resolve({
                value: null,
                done: true
              })
            }
          })
        })
      },
      return: function () {
        return new Promise(function (resolve, reject) {
          self.end(function (err) {
            err ? reject(err) : resolve()
          })
        })
      },
      error: function (err) {
        return new Promise(function (resolve, reject) {
          self.end(function (_err) {
            reject(_err || err)
          })
        })
      }
    }
    return it
  }
}

module.exports = AbstractIterator
