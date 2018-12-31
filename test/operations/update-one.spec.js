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

describe('update one', () => {
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

    describe('#buildUpdateOne', () => {
        it('should return a Right when successfully updating a conversation', () => {
            const tobeUpdatedPayload = {
                ...conversations[0],
                _id: 'efg456',
            };
            const payload = [
                tobeUpdatedPayload,
                {
                    ...conversations[0],
                    _id: 'hij789',
                },
            ];
            const updatedPayload = {
                $set: {
                    name: 'Updated name',
                },
            };
            const updateQuery = { _id: tobeUpdatedPayload._id };
            const insertStatement = mongoExecuter.buildInsert(collectionName, payload);
            const updateStatement = mongoExecuter.buildUpdateOne(collectionName, updateQuery, updatedPayload);
            const update = mongoExecuter.withConnection(mongoClient, dbName).executeSingle(updateStatement);
            return mongoExecuter.withConnection(mongoClient, dbName).executeSingle(insertStatement)
                .and(update)
                .promise()
                .then(async (res) => {
                    chai.assert(S.isRight(res));
                    const value = S.fromEither(0)(res);
                    chai.expect(value).to.not.equal(0);
                    chai.expect(value).to.deep.contain({
                        nModified: 1,
                    });

                    const findStatement = mongoExecuter.buildFind(collectionName, updateQuery);
                    const foundRows = await mongoExecuter
                        .withConnection(mongoClient, dbName)
                        .executeSingle(findStatement)
                        .promise();
                    chai.assert(S.isRight(foundRows));
                    chai.expect(foundRows.value[0]).to.deep.contain(updatedPayload.$set);
                });
        });
    });
});
