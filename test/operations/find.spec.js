const chai = require('chai');
const { MongoMemoryServer } = require('mongodb-memory-server');
const S = require('../../util/sanctuary');
const mongoExecuter = require('../../mongo-executer');
const conversations = require('../stubs/conversations');

let mongoServer;
const opts = {
    useNewUrlParser: true,
};
let mongoClient;

before(() => {
    mongoServer = new MongoMemoryServer();
});

after(() => {
    mongoServer.stop();
});

describe('mongo executer find', () => {
    const dbName = 'mongoExecuter';
    const collectionName = 'conversations';

    beforeEach((done) => {
        mongoServer.getConnectionString()
            .then(mongoUri => mongoExecuter.connectWithUri(mongoUri, opts, (err) => {
                if (err) {
                    done(err);
                }
            })
                .map((client) => {
                    mongoClient = client;
                    return null;
                })
                .promise()
                .then(done));
    });

    afterEach(() => {
        mongoClient.db(dbName).collection(collectionName).deleteMany({});
        mongoClient
            .close();
    });

    describe('#buildFind', () => {
        it('should return a Right when successfully finding a new conversation by _id with projection', () => {
            const payload = {
                ...conversations[0],
                _id: 'klm012',
            };
            const insertStatement = mongoExecuter.buildInsert(collectionName, payload);

            const query = {
                _id: payload._id,
            };
            const projection = { name: 1 };
            const findStatement = mongoExecuter.buildFind(collectionName, query, projection);
            return mongoExecuter.withConnection(mongoClient, dbName).executeSingle(insertStatement)
                .and(mongoExecuter.withConnection(mongoClient, dbName).executeSingle(findStatement))
                .promise()
                .then((res) => {
                    chai.assert(S.isRight(res));
                    const value = S.fromEither(0)(res);
                    chai.expect(value).to.not.equal(0);
                    chai.expect(value.length).to.equal(1);
                    chai.expect(value[0]).to.include({ name: payload.name });
                    chai.expect(value[0]).to.not.include({ number: payload.number });
                });
        });

        it('should return a Right when successfully finding a new conversation by a key names without projection', () => {
            const payload = {
                ...conversations[0],
                _id: 'nop345',
            };
            const insertStatement = mongoExecuter.buildInsert(collectionName, payload);

            const query = {
                name: payload.name,
                number: payload.number,
            };
            const findStatement = mongoExecuter.buildFind(collectionName, query);
            return mongoExecuter.withConnection(mongoClient, dbName).executeSingle(insertStatement)
                .and(mongoExecuter.withConnection(mongoClient, dbName).executeSingle(findStatement))
                .promise()
                .then((res) => {
                    chai.assert(S.isRight(res));
                    const value = S.fromEither(0)(res);
                    chai.expect(value).to.not.equal(0);
                    chai.expect(value.length).to.equal(1);
                    chai.expect(value[0]).to.include(payload);
                });
        });

        it('should return empty array when no query found', () => {
            const payload = {
                ...conversations[0],
                _id: 'qrs678',
            };
            const insertStatement = mongoExecuter.buildInsert(collectionName, payload);

            const query = {
                _id: 'efg456',
            };
            const findStatement = mongoExecuter.buildFind(collectionName, query);
            return mongoExecuter.withConnection(mongoClient, dbName).executeSingle(insertStatement)
                .and(mongoExecuter.withConnection(mongoClient, dbName).executeSingle(findStatement))
                .promise()
                .then((res) => {
                    chai.assert(S.isRight(res));
                    const value = S.fromEither(0)(res);
                    chai.assert(Array.isArray(value));
                    chai.expect(value.length).to.equal(0);
                });
        });
    });
});
