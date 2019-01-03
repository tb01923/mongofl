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

describe('update many', () => {
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

    describe('#buildUpdateMany', () => {
        it('should return a Right when successfully updating many conversations', () => {
            const payload = [
                {
                    ...conversations[0],
                    _id: 'efg456',
                    name: 'Update this',
                },
                {
                    ...conversations[0],
                    _id: 'hij789',
                    name: 'Update this',
                },
            ];
            const updatedPayload = {
                $set: {
                    name: 'Updated name',
                },
            };
            const updateQuery = { name: 'Update this' };
            const insertStatement = mongoExecuter.buildInsert(collectionName, payload);
            const updateStatement = mongoExecuter.buildUpdate(collectionName, updateQuery, updatedPayload);
            const update = mongoExecuter.withConnection(mongoClient, dbName).executeSingle(updateStatement);
            return mongoExecuter.withConnection(mongoClient, dbName).executeSingle(insertStatement)
                .and(update)
                .promise()
                .then(async (res) => {
                    chai.assert(S.isRight(res));
                    const value = S.fromEither(0)(res);
                    chai.expect(value).to.not.equal(0);
                    chai.expect(value).to.deep.contain({
                        nModified: payload.length,
                    });

                    const findStatement = mongoExecuter.buildFind(collectionName, { name: 'Updated name' });
                    const foundRows = await mongoExecuter
                        .withConnection(mongoClient, dbName)
                        .executeSingle(findStatement)
                        .promise();
                    chai.assert(S.isRight(foundRows));
                    chai.expect(foundRows.value.length).to.equal(payload.length);
                    chai.expect(foundRows.value[0].name).to.equal('Updated name');
                    chai.expect(foundRows.value[1].name).to.equal('Updated name');
                });
        });
    });
});
