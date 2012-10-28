var util = require("util"),
    base = require("./CommandBase"),
    parser = require("../connection/parser"),
    OperationTypes = require("./operation_types"),

    command = function() {
        base.call(this);
        
        this.readHeader(readPayloadStatus);
    };

util.inherits(command, base);

module.exports = command;

command.operation = OperationTypes.RECORD_LOAD;

// TODO we don't support fetchPlans in RECORD_LOAD, so we expect to return one and just one record

function readPayloadStatus() {
    this.readByte(onPayloadStatus);
}

function onPayloadStatus(status) {
    console.log( 'status %d', status );
    switch (status) {
        case 0:
            if (!this.result.status)
                this.result.status = 0;
            break;
        case 1:
            this.result.status = status;
            this.readBytes(onRecordContent);
            break;
        default:
            this.error = new Error("Status not implemented: " + status);
            break;
    }
}

function onRecordContent(content) {
    this.result.content = content;
    console.log( 'loaded content' );
    this.readInt(onRecordVersion);
}

function onRecordVersion(version) {
    this.result.version = version;
    console.log( 'loaded version' );
    this.readByte(onRecordType);
}

function onRecordType(type) {
    this.result.type = String.fromCharCode(type);
    console.log( 'loaded type' );
    readPayloadStatus.call(this);
}

command.write = function(socket, sessionId, data, callback) {

    // operation type
    socket.write(parser.writeByte(this.operation, true));

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

