var assert = require("assert");

var orient = require("../lib/orientdb"),
    GraphDb = orient.GraphDb,
    Server = orient.Server;

var serverConfig = require("../config/test/serverConfig");
var dbConfig = require("../config/test/dbConfig");

var server = new Server(serverConfig);
var graphdb = new GraphDb("temp", server, dbConfig);
var count = 50;

graphdb.open(function(err) {
    graphdb.createVertex({ name: "from vertex" }, function(err1, fromVertex) {
        assert(!err, err);
        graphdb.createVertex({ name: "to vertex" }, function(err, toVertex) {
            assert(!err, err);

            var edges = [];
            for (var i = 0; i < count; i++) {
                graphdb.createEdge(fromVertex["@rid"], toVertex["@rid"], function(err, edge) {
                    assert(!err, err);

                    edges.push(edge["@rid"]);

                    if (edges.length === count) {
                        graphdb.loadRecord(fromVertex["@rid"], function(err, fromVertex, cache) {
                            assert(!err, err);

                            assert.equal(count, fromVertex.out.length);

                            graphdb.selectAsync("select from " + fromVertex["@rid"], function(err, results) {
                                assert(!err, err);

                                assert.equal(count, results[0].out.length);
                                
                                graphdb.close();
                            });
                        });
                    }
                });
            }
        });
    });
});