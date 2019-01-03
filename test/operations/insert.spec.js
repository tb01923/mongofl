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

describe('mongo executer insert', () => {
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

    describe('#buildInsert', () => {
        it('should return a Right when successfully add a new conversation', () => {
            const payload = {
                ...conversations[0],
                _id: 'efg456',
            };
            const insertStatement = mongoExecuter.buildInsert(collectionName, payload);
            return mongoExecuter.withConnection(mongoClient, dbName).executeSingle(insertStatement)
                .promise()
                .then((res) => {
                    chai.assert(S.isRight(res));
                    const value = S.fromEither(0)(res);
                    chai.expect(value).to.not.equal(0);
                    chai.expect(value.result).to.deep.equal({
                        n: 1, ok: 1,
                    });
                    chai.expect(value.ops[0]).to.equal(payload);
                });
        });

        it('should return a Left when there is an index violation', () => {
            const payload = {
                ...conversations[0],
                _id: 'hij789',
            };
            const insertStatement = mongoExecuter.buildInsert(collectionName, payload);
            return mongoExecuter.withConnection(mongoClient, dbName).executeSingle(insertStatement)
                .and(mongoExecuter.withConnection(mongoClient, dbName)
                    .executeSingle(insertStatement))
                .promise()
                .then((res) => {
                    chai.assert(S.isLeft(res));
                    const value = S.show(res);
                    chai.expect(value).to.contain('duplicate key error');
                });
        });
    });
});
