const {create, env} = require('sanctuary');
const {env: flutureEnv} = require('fluture-sanctuary-types');
const F = require('fluture');
const S = create({checkTypes: false, env: env.concat(flutureEnv)});
const R = require('ramda');
const MongoClient = require('mongodb').MongoClient;

const mongoClientConnect = R.curry(MongoClient.connect);
const connect = (host, database) => F.node(
    mongoClientConnect(`mongodb://${host}/${database}`, null),
);

const rejectMongoOf = (collection, query, projection, object) => (e) => {
    const err = {};
    err.message = e.message;
    err.stack = e.stack;
    err.collection = collection;
    err.query = query;
    err.projection = projection;
    err.object = object;
    console.error('Mongo error', err); // eslint-disable-line no-console
    return F.reject(err);
};

const skipper = R.invoker(1, 'skip');
const limmiter = R.invoker(1, 'limit');
const toArrayer = R.invoker(1, 'toArray');

const toArray = R.curry((skip, limit, cursor) => {
    const chain = [];
    if (skip) chain.push(skipper(skip));
    if (limit) chain.push(limmiter(limit));

    return new F((reject, resolve) => {
        const resolver = (err, xs) => {
            if (err) { reject(err); } else { resolve(xs); }
        };

        chain.push(toArrayer(resolver));
        S.pipe(chain)(cursor);
    });
});

/**
 * mongo-mock doesn't return `cursor.result` for upserts.
 * Instead it just returns the result `{n: Number}`.
 * @param {Object} cursor
 */
const getResult = (cursor) => {
    // Mongo 3.0.x support
    if (cursor.result) {
        return F.of(cursor.result);
        }
    // Mongo 3.1.x support
    if (cursor.toArray) {
        return F.node(done => cursor.toArray(done));
    }

    // mongo-mock support
    return F.of(cursor);
};

const executeFind = R.curry((collection, query, projection, options, db) => {
    const findInCollection = () => db.collection(collection).find(query).project(projection);

    const rejector = rejectMongoOf(collection, query, projection);

    return F.try(findInCollection)
        .chainRej(rejector)
        .chain(toArray(options.skip, options.limit));
    });

const buildFind = (collection, query, projection, skip, limit) => executeFind(collection, query, projection, { skip, limit });

const executeUpdate = R.curry((collection, query, object, upsert, db) => {
    const updateCollection = () => callback => db.collection(collection).update(query, object, { upsert }, callback);

    const rejector = rejectMongoOf(collection, query, null, object);

    return F.node(updateCollection(query, object, upsert))
        .chainRej(rejector)
        .chain(getResult);
});

const executeInsert = R.curry((collection, object, db) => {
    const updateCollection = callback => db.collection(collection).insert(object, callback);

    const rejector = rejectMongoOf(collection, null, null, object);

    return F.node(updateCollection)
        .chainRej(rejector);
});

const executeDeleteOne = R.curry((collection, object, db) => {
    const deleteFromCollection = callback => db.collection(collection).deleteOne(object, callback);

    const rejector = rejectMongoOf(collection, null, null, object);

    return F.node(deleteFromCollection)
        .chainRej(rejector);
});


const executePush = R.curry((collection, query, object, db) => {
    const updateCollection = () => callback => db.collection(collection).update(query, { $push: object }, callback);

    const rejector = rejectMongoOf(collection, query, null, object);

    return F.node(updateCollection(query, object))
        .chainRej(rejector)
        .chain(getResult);
});

const executeAggregate = R.curry((collection, query, lookUp, sort, projection, db) => {
    const aggregateCollection = () => callback => db.collection(collection).aggregate([
        { $match: query },
        { $lookup: lookUp },
        { $sort: sort },
        { $project: projection },
    ], callback);

    const rejector = rejectMongoOf(collection, query, lookUp, projection);

    return F.node(aggregateCollection(query, lookUp))
        .chainRej(rejector)
        .chain(getResult);
});


const buildUpdate = (collection, query, object) => executeUpdate(collection, query, object, false);

const buildUpsert = (collection, query, object) => executeUpdate(collection, query, object, true);

const buildInsert = executeInsert;

const buildDeleteOne = executeDeleteOne;

const buildPush = (collection, query, object) => executePush(collection, query, object);

const buildAggregate = (collection, query, lookUp, sort, projection) => executeAggregate(
    collection,
    query,
    lookUp,
    sort,
    projection,
);

/**
 * Please note when passing MongoClient in mongo parameter, dbName is required.
 * MongoDB >= 3.1 will give you client, whereas MongoDB >= 3.0 will give you Db.
 * @param {MongoClient|Db} mongo
 * @param {String} dbName Database name (required if mongo is MongoClient)
 */
const withConnection = (mongo, dbName = '') => {
    let db = mongo;

    // For mongodb >=3.1.x
    if (dbName && mongo.db) {
        db = mongo.db(dbName);
}

    if (!db.collection) {
        throw new Error('When providing MongoClient as parameter 1 to withConnection, you must pass in the dbName as parameter 2.');
    }

    // (db -> Future e a) -> Future e Either e a
    const executeSingle = S.pipe([
        S.T(db),
        F.fold(S.Left, S.Right),
    ]);

    return Object.freeze({
        executeSingle,
    });
};

module.exports = Object.freeze({
    buildFind,
    buildUpsert,
    buildInsert,
    buildDeleteOne,
    buildUpdate,
    buildPush,
    buildAggregate,
    connect,
    withConnection,
});