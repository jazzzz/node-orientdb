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

function readClusters(next) {
    this.result.clusters = [];
    this.readShort(function(clusterCount) {
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
                    this.result.clusters.push(cluster);
                    callback.call(this);
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
    socket.write(parser.writeInt(sessionId, true));
};

