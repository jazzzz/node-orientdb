var assert = require("assert");
var parser = require("../lib/orientdb/connection/parser");

var orient = require("../lib/orientdb"),
    GraphDb = orient.GraphDb,
    Server = orient.Server;

var serverConfig = require("../config/test/serverConfig");
var dbConfig = require("../config/test/dbConfig");

var server = new Server(serverConfig);
var graphdb = new GraphDb("temp", server, dbConfig);

graphdb.open(function(err) {
    assert(!err, err);

    graphdb.select("select from OUser", function(err, results) {
        assert(!err, err);
        assert.notEqual(0, results.length);

        graphdb.selectAsync("select from OUser", function(err, results) {
            assert(!err, err);
            assert.notEqual(0, results.length);

            graphdb.select("select from OUser where name = ?", {params: ['admin']}, function(err, results) {
                assert(!err, err);
                assert.equal(1, results.length);

                graphdb.selectAsync("select from OUser where name = :name", {params: {name: 'reader'}}, function(err, results) {
                    assert(!err, err);
                    assert.equal(1, results.length);

                    graphdb.close();
                });
            });
        });
    });
});
