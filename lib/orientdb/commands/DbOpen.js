var util = require("util"),
    debug = require("../connection/debug"),
    base = require("./CommandBase"),
    parser = require("../connection/parser"),
    OperationTypes = require("./operation_types"),

    command = function() {
        base.call(this);

        this.readHeader(readSessionId);
    };

util.inherits(command, base);

module.exports = command;

command.operation = OperationTypes.DB_OPEN;

function readSessionId() {
    this.readInt(function(sessionId) {
        console.log( 'sessionId %d', sessionId );
        this.result.sessionId = sessionId;
        readClusters.call(this,readClusterConfig);
    });
}

function readClusters(next) {
    this.result.clusters = [];
    this.readShort(function(clusterCount) {
        console.log( '%d clusters', clusterCount);
        readRemainingClusters.call(this);
        function readRemainingClusters() {
            if (clusterCount > 0)
                readCluster.call(this,function() {
                    clusterCount--;
                    readRemainingClusters.call(this);
                });
            else if (next)
                next.call(this);
        }
    });
}

function readCluster(callback) {
    var cluster = {};
    this.readString(function(clusterName) {
        cluster.name = clusterName;
        this.readShort(function(clusterId) {
            cluster.id = clusterId;
            this.readString(function(clusterType) {
                cluster.type = clusterType;
                this.readShort(function(dataSegmentId) {
                    cluster.dataSegmentId = dataSegmentId;
                    console.log( 'read cluster', cluster );
                    this.result.clusters.push(cluster);
                    callback.call(this);
                });
            });
        });
    });
}

function readClusterConfig() {
    console.log( 'readClusterConfig' );
    this.readBytes(function(clusterConfig){
        //todo
    });
}

command.write = function(socket, sessionId, data, callback) {

    debug.log("Writing on the socket operation " + command.operation + " on session " + sessionId);

    // operation type
    socket.write(parser.writeByte(command.operation, true));

    // invoke callback immediately when the operation is sent to the server
    callback();

    // session ID
    socket.write(parser.writeInt(sessionId, true));

    // driver name
    socket.write(parser.writeString("OrientDB Node.js driver"));
    // driver version
    socket.write(parser.writeString("0.8.0"));
    // protocol version
    socket.write(parser.writeShort(12));
    // client id
    socket.write(parser.writeString(""));
    // database name
    socket.write(parser.writeString(data.database_name));
    // database type
    socket.write(parser.writeString(data.database_type));
    // user name
    socket.write(parser.writeString(data.user_name));
    // user password
    socket.write(parser.writeString(data.user_password));
};

