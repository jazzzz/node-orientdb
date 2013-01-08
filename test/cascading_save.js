var assert = require("assert");
var async = require("async");

var orient = require("../lib/orientdb"),
    Db = orient.Db,
    Server = orient.Server;

var serverConfig = require("../config/test/serverConfig");
var dbConfig = require("../config/test/dbConfig");

var server = new Server(serverConfig);
var db = new Db("temp", server, dbConfig);


db.open(function(err) {

    assert(!err, "Error while opening the database: " + err);

    var doc = {
        "@class": "mainClass",
        field: "field value",
        embeddded_list_of_maps: [
            {
                key1: "value1",
                key2: "value2"
            }
        ],
        sub_document: {
            "@class": "subClass",
            sub_field: 1,
            "@type": "d",
            sub_sub_document: {
                "@class": "subClass",
                sub_field: 50,
                "@type": "d"
            }
        },
        sub_documents: [
            {
                "@class": "subClass",
                sub_field: 2,
                "@type": "d",
                sub_sub_document: {
                    "@class": "subClass",
                    sub_field: 99,
                    "@type": "d"
                }
            },
            {
                "@class": "subClass",
                sub_field: 3,
                "@type": "d"
            }
        ],
        linked_map: {
            link1: {
                "@class": "subClass",
                another_field: "another_value",
                "@type": "d"
            }
        },
        "@type": "d"
    };

    prepareDatabase(function(err) {
        assert(!err, err);

        db.cascadingSave(doc, function(err, savedDoc) {
            assert(!err, err);
            assert(null != savedDoc["@rid"]);
            assert(null != savedDoc["@type"]);
            assert(null != savedDoc["@class"]);
            assert(null != savedDoc["@version"]);
            assert(null != savedDoc.sub_document["@rid"]);
            assert(null != savedDoc.sub_document["@type"]);
            assert(null != savedDoc.sub_document["@class"]);
            assert(null != savedDoc.sub_document["@version"]);
            assert(null != savedDoc.sub_document.sub_sub_document["@rid"]);
            assert(null != savedDoc.sub_document.sub_sub_document["@type"]);
            assert(null != savedDoc.sub_document.sub_sub_document["@class"]);
            assert(null != savedDoc.sub_document.sub_sub_document["@version"]);
            assert(null != savedDoc.sub_documents[0]["@rid"]);
            assert(null != savedDoc.sub_documents[0]["@type"]);
            assert(null != savedDoc.sub_documents[0]["@class"]);
            assert(null != savedDoc.sub_documents[0]["@version"]);
            assert(null != savedDoc.sub_documents[0].sub_sub_document["@rid"]);
            assert(null != savedDoc.sub_documents[0].sub_sub_document["@type"]);
            assert(null != savedDoc.sub_documents[0].sub_sub_document["@class"]);
            assert(null != savedDoc.sub_documents[0].sub_sub_document["@version"]);
            assert(null != savedDoc.sub_documents[1]["@rid"]);
            assert(null != savedDoc.sub_documents[1]["@type"]);
            assert(null != savedDoc.sub_documents[1]["@class"]);
            assert(null != savedDoc.sub_documents[1]["@version"]);
            assert(null != savedDoc.linked_map.link1["@rid"]);
            assert(null != savedDoc.linked_map.link1["@type"]);
            assert(null != savedDoc.linked_map.link1["@class"]);
            assert(null != savedDoc.linked_map.link1["@version"]);

            unprepareDatabase(function(err) {
                assert(!err, err);

                db.close();
            });
        });
    });
});

function prepareDatabase(callback) {
    async.series([
        db.createClass.bind(db, "mainClass"),
        db.createClass.bind(db, "subClass"),
        db.command.bind(db, "CREATE PROPERTY mainClass.sub_document link subClass"),
        db.command.bind(db, "CREATE PROPERTY mainClass.sub_documents linklist subClass"),
        db.command.bind(db, "CREATE PROPERTY mainClass.linked_map linkmap subClass")
    ], callback);
}


function unprepareDatabase(callback) {
    async.series([
        db.dropClass.bind(db, "subClass"),
        db.dropClass.bind(db, "mainClass")
    ], callback);
}