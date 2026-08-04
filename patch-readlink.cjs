const fs = require('fs');

const wrapReadlinkErr = (err) => {
  if (err && err.code === 'EISDIR') {
    const error = new Error(`EINVAL: invalid argument, readlink '${err.path}'`);
    error.code = 'EINVAL';
    error.errno = -4071;
    return error;
  }
  return err;
};

if (fs.readlink) {
  const origReadlink = fs.readlink;
  fs.readlink = function (path, options, callback) {
    if (typeof options === 'function') {
      callback = options;
      options = undefined;
    }
    return origReadlink.call(this, path, options, (err, target) => {
      if (err) return callback(wrapReadlinkErr(err));
      if (callback) callback(null, target);
    });
  };
}

if (fs.readlinkSync) {
  const origReadlinkSync = fs.readlinkSync;
  fs.readlinkSync = function (path, options) {
    try {
      return origReadlinkSync.call(this, path, options);
    } catch (err) {
      throw wrapReadlinkErr(err);
    }
  };
}

if (fs.promises && fs.promises.readlink) {
  const origPromisesReadlink = fs.promises.readlink;
  fs.promises.readlink = async function (path, options) {
    try {
      return await origPromisesReadlink.call(this, path, options);
    } catch (err) {
      throw wrapReadlinkErr(err);
    }
  };
}
