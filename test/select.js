var assert = require("assert");
var _ = require("underscore");

var orient = require("../lib/orientdb"),
    GraphDb = orient.GraphDb,
    Server = orient.Server;

var serverConfig = require("../config/test/serverConfig");
var dbConfig = require("../config/test/dbConfig");

var server = new Server(serverConfig);
var graphdb = new GraphDb("temp", server, dbConfig);

graphdb.open(function(err) {
    assert(!err, err);

    var name = '"name\\ \\"';
    graphdb.createVertex({name: name}, function(err, vertex) {
        assert(!err, err);

        assert(!_.isUndefined(vertex["@rid"]));
        assert.equal(vertex.name, name);

        graphdb.select("select from V where name = ?", {params: [name]}, function(err, results) {
            assert(!err, err);
            assert.notEqual(0, results.length);
            assert.equal(name, results[0].name);

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
    });
});