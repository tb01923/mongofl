const updateObject = (object) => {
    let updatedObject = object;
    if (!object.$set && !object.$unset && !object.$rename) {
        console.warn('Adding `$set` to your make update queries work atomically. If you need `$unset` or `$rename`, please pass them explicitly as part of `object` to `buildUpdate`.'); // eslint-disable-line no-console
        updatedObject = {
            $set: object,
        };
    }

    return updatedObject;
};

module.exports = {
    updateObject,
};
