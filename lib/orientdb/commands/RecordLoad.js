var util = require("util"),
    base = require("./CommandBase"),
    parser = require("../connection/parser"),
    OperationTypes = require("./operation_types"),

    command = function() {
        base.call(this);

        this.result.cache = {};
        this.readHeader(readPayloadStatus);
    };

util.inherits(command, base);

module.exports = command;

command.operation = OperationTypes.RECORD_LOAD;

function readPayloadStatus() {
    this.readByte(onPayloadStatus);
}

function onPayloadStatus(status) {
    switch (status) {
        case 0:
            break;
        case 1:
            this.readBytes(onRecordContent);
            break;
        case 2:
            readCacheRecords.call(this);
            break;
        default:
            this.emit("error", new Error("Status not implemented: " + status));
            break;
    }
}

function readCacheRecords() {
    this.readRecord(function(record) {
        this.result.cache[record['@rid']] = record;
        readPayloadStatus.call(this);
    });
}

function onRecordContent(content) {
    this.readInt(function(version) {
        this.readChar(function(type) {
            var record = this.result.record = {
                "@version": version
            };
            this.processRecordContent(record, type, content);
            readPayloadStatus.call(this);
        });
    });
}

command.prototype.write = function(socket, sessionId, data, callback) {

    // operation type
    socket.write(parser.writeByte(command.operation, true));

    // invoke callback immediately when the operation is sent to the server
    callback();

    // session ID
    socket.write(parser.writeInt(sessionId));

    // cluster ID
    socket.write(parser.writeShort(data.clusterId));
    // cluster position
    socket.write(parser.writeLong(data.clusterPosition));

    // fetch plan
    socket.write(parser.writeString(data.fetchPlan));

    // ignore cache
    socket.write(parser.writeByte(data.ignoreCache, true));
};

