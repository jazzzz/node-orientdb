var util = require("util"),
    base = require("./CommandBase"),
    parser = require("../connection/parser"),
    OperationTypes = require("./operation_types"),

    command = function() {
        base.call(this);

        this.readHeader(readClusters);
    };

util.inherits(command, base);

module.exports = command;

command.operation = OperationTypes.DB_RELOAD;

function readClusters() {
    this.readShort(function(clusterCount) {
        console.log( '%d clusters', clusterCount);
        this.readArray(clusterCount,readCluster,function(clusters) {
            this.result.clusters = clusters;
        });
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
                    callback.call(this, cluster);
                });
            });
        });
    });
}

command.write = function(socket, sessionId, data, callback) {

    // operation type
    socket.write(parser.writeByte(command.operation, true));

    // invoke callback immediately when the operation is sent to the server
    callback();

    // session ID
    socket.write(parser.writeInt(sessionId));
};

