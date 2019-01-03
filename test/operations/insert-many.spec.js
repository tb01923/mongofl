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

describe('mongo executer insert many', () => {
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
        it('should return a Right when successfully adding multiple conversation', () => {
            const payload = [
                {
                    ...conversations[0],
                    _id: 'efg456',
                },
                {
                    ...conversations[0],
                    _id: 'hij789',
                },
            ];

            const insertStatement = mongoExecuter.buildInsert(collectionName, payload);
            return mongoExecuter.withConnection(mongoClient, dbName).executeSingle(insertStatement)
                .promise()
                .then((res) => {
                    chai.assert(S.isRight(res));
                    const value = S.fromEither(0)(res);
                    chai.expect(value).to.not.equal(0);
                    chai.expect(value.result).to.deep.equal({
                        n: 2, ok: 1,
                    });
                    chai.expect(value.ops).to.deep.equal(payload);
                });
        });

        it('should return a Left when there is an index violation', () => {
            const insertPayload = [
                {
                    ...conversations[0],
                    _id: 'efg456',
                },
                {
                    ...conversations[0],
                    _id: 'hij789',
                },
            ];
            const violationPayload = [
                // index violation
                {
                    ...conversations[0],
                    _id: 'efg456',
                },
                // NO index violation - will not be inserted
                {
                    ...conversations[0],
                    _id: 'klm789',
                },
            ];
            const insertStatement1 = mongoExecuter.buildInsert(collectionName, insertPayload);
            const insertStatement2 = mongoExecuter.buildInsert(collectionName, violationPayload);
            return mongoExecuter.withConnection(mongoClient, dbName).executeSingle(insertStatement1)
                .and(mongoExecuter.withConnection(mongoClient, dbName)
                    .executeSingle(insertStatement2))
                .promise()
                .then(async (res) => {
                    chai.assert(S.isLeft(res));
                    const value = S.show(res);
                    chai.expect(value).to.contain('duplicate key error');

                    const query = {};
                    const findStatement = mongoExecuter.buildFind(collectionName, query);
                    const foundRows = await mongoExecuter.withConnection(mongoClient, dbName)
                        .executeSingle(findStatement)
                        .promise();
                    chai.expect(foundRows.value).to.deep.equal(insertPayload);
                    chai.expect(foundRows.value).to.deep.contain(violationPayload[0]);
                    chai.expect(foundRows.value).to.not.deep.contain(violationPayload[1]);
                });
        });
    });
});
