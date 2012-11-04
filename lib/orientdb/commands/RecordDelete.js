var util = require("util"),
    base = require("./CommandBase"),
    parser = require("../connection/parser"),
    OperationTypes = require("./operation_types"),

    command = function() {
        base.call(this);

        this.readHeader(readStatus);
    };

util.inherits(command, base);

module.exports = command;

command.operation = OperationTypes.RECORD_DELETE;

function readStatus() {
    this.readByte(function(status) {
        this.result.status = status;
    });
}

command.prototype.write = function(socket, sessionId, data, callback) {

    // operation type
    socket.write(parser.writeByte(command.operation, true));

    // invoke callback imidiately when the operation is sent to the server
    callback();

    // session ID
    socket.write(parser.writeInt(sessionId));

    // cluster ID
    socket.write(parser.writeShort(data.clusterId));
    // cluster position
    socket.write(parser.writeLong(data.clusterPosition));
    // record version
    socket.write(parser.writeInt(data.version));
    // mode
    socket.write(parser.writeByte(data.mode, true));
};

