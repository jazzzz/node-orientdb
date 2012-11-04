var util = require("util"),
    base = require("./CommandBase"),
    parser = require("../connection/parser"),
    OperationTypes = require("./operation_types"),

    command = function() {
        base.call(this);

        this.readHeader(readPosition);
    };

util.inherits(command, base);

module.exports = command;

command.operation = OperationTypes.RECORD_CREATE;

function readPosition() {
    this.readLong(function(position) {
        this.readInt(function(version) {
            this.result.position = position;
            this.result.version = version;
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

    // data Segment ID
    socket.write(parser.writeInt(data.dataSegmentId));

    // cluster ID
    socket.write(parser.writeShort(data.clusterId));

    // record data
    socket.write(parser.writeBytes(data.content));
    // record type
    socket.write(parser.writeByte(data.type, true));
    // mode
    socket.write(parser.writeByte(data.mode, true));
};

