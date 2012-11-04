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

    graphdb.selectAsync("select from OUser where name = ?", {params: ["admin"], fetchPlan: "roles:1"}, function(err, results, cache) {
        assert(!err, err);
        assert.equal(1, results.length);
        assert.equal(1, Object.keys(cache).length);

        graphdb.close();
    });
});
