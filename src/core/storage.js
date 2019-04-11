const low = require('lowdb')
const FileSync = require('lowdb/adapters/FileSync')

const adapter = new FileSync('src/data/db.json')
const db = low(adapter);

db.defaults({
    imagesDisk: ""
}).write();

module.exports = db;