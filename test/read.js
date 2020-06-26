require('dotenv').config();
const { expect } = require('chai');
const request = require('supertest');
const express = require('express');
const { MongoClient } = require('mongodb');
const restRoutes = require('../lib/restRoutes');

/*
 * Run this script using "npx mocha test/read" from the project directory. If you want to
 * run selective tests, run "npx mocha test/read --grep filter".
 */

/* global describe it before after */

const dbUrl = 'mongodb://localhost';
const dbName = 'rest-on-mongo';
const collection = 'test';
const app = express();
let client;
let db;

describe('Read tests', () => {
  before(async () => {
    client = new MongoClient(dbUrl, { useNewUrlParser: true, useUnifiedTopology: true });
    await client.connect();
    db = client.db(dbName);
    app.use('/', (req, res, next) => {
      req.db = db;
      next();
    });
    await db.collection(collection).deleteMany({});
    app.use(restRoutes.all());
  });
  after(() => {
    client.close();
  });

  it('should get one', async () => {
    // Prepare
    const toCreate = { _id: 'id-1', testNumber: 1.1, testString: 'string-to-test' };
    await db.collection(collection).insertOne(toCreate);
    // Do
    const res = await request(app)
      .get(`/${collection}/id-1`);
    expect(res.statusCode).to.equal(200);
    expect(res.body.testNumber).to.equal(toCreate.testNumber);
    // Cleanup
    const result = await db.collection(collection).deleteOne({ _id: 'id-1' });
    expect(result.deletedCount).to.equal(1);
  });

  it('should get one - autogenerated ID', async () => {
    // Prepare
    const toCreate = { testNumber: 2.1, name: 'auto id' };
    const createResult = await db.collection(collection).insertOne(toCreate);
    const { insertedId } = createResult;
    // Do
    const res = await request(app)
      .get(`/${collection}/${insertedId}`);
    expect(res.statusCode).to.equal(200);
    expect(res.body.name).to.equal(toCreate.name);
    // Cleanup
    const result = await db.collection(collection).deleteOne({ _id: insertedId });
    expect(result.deletedCount).to.equal(1);
  });

  it('should get many (unfiltered)', async () => {
    // Prepare
    const toCreateMany = [
      { _id: 'id-1', name: 'first', autoId: false },
      { _id: 'id-2', name: 'second', autoId: false },
    ];
    await db.collection(collection).insertMany(toCreateMany);
    // Do
    const res = await request(app)
      .get(`/${collection}`);
    expect(res.statusCode).to.equal(200);
    expect(res.body.length).to.equal(toCreateMany.length);
    expect(res.body[0]).to.deep.equal(toCreateMany[0]);
    // Cleanup
    const result = await db.collection(collection).deleteMany({});
    expect(result.deletedCount).to.equal(toCreateMany.length);
  });

  it('should get many (filtered - query params)', async () => {
    // Prepare
    const toCreateMany = [
      { _id: 'id-1', name: 'first', autoId: false },
      { _id: 'id-2', name: 'second', autoId: false },
      { name: 'auto id', autoId: true },
    ];
    await db.collection(collection).insertMany(toCreateMany);
    // Do
    const res = await request(app)
      .get(`/${collection}?autoId=false`);
    expect(res.statusCode).to.equal(200);
    const filtered = toCreateMany.filter((x) => x.autoId === false);
    expect(res.body.length).to.equal(filtered.length);
    expect(res.body[0]).to.deep.equal(filtered[0]);
    // Cleanup
    const result = await db.collection(collection).deleteMany({});
    expect(result.deletedCount).to.equal(toCreateMany.length);
  });

  it('should get many (filtered - mongo filter)', async () => {
    // Prepare - intentionally create a number value as a string
    const toCreateMany = [
      { _id: 'id-1', name: '123456' },
      { _id: 'id-2', name: 'third', autoId: false },
      { name: 'auto id', autoId: true },
    ];
    await db.collection(collection).insertMany(toCreateMany);
    // Do
    const res = await request(app)
      .get(`/${collection}`)
      .query({ __filter: '{"name": "123456" }' });
    expect(res.statusCode).to.equal(200);
    expect(res.body.length).to.equal(toCreateMany.filter((x) => x.name === '123456').length);
    expect(res.body[0]._id).to.equal('id-1');
    // Cleanup
    const result = await db.collection(collection).deleteMany({});
    expect(result.deletedCount).to.equal(toCreateMany.length);
  });
});