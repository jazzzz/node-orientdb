var assert = require("assert");

var orient = require("../lib/orientdb"),
    GraphDb = orient.GraphDb,
    Server = orient.Server;

var serverConfig = require("../config/test/serverConfig");
var dbConfig = require("../config/test/dbConfig");

var server = new Server(serverConfig);
var graphdb = new GraphDb("temp", server, dbConfig);

graphdb.open(function(err) {
    assert(!err, err);

    var recordCount = 0;
    graphdb.select("select from OUser").forEach(function(err, record) {
        assert(!err, err);
        if (record) {
            recordCount++;
        } else {
            assert.notEqual(0, recordCount);
            var recordCount = 0;
            graphdb.selectAsync("select from OUser").forEach(function(err, record) {
                assert(!err, err);
                if (record) {
                    recordCount++;
                } else {
                    assert.notEqual(0, recordCount);
                    graphdb.close();
                }
            });
        }
    });
});
