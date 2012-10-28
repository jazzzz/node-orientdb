var parser = require("../connection/parser");

var command = function() {
    this.step = 0;

    this.steps = [];
    this.steps.push(command.skipByte);
    this.steps.push(command.skipInt);

    this.useSteps = true;
    this.readers = [];

    this.result = {};
    this.error = null;
};

command.prototype.done = function() {
    if (this.useSteps)
        return this.error !== null || this.step >= this.steps.length;
    else
        return this.readers.length == 0;
};

command.prototype.wait = function(bytes, callback) {
    this.useSteps = false;
    this.readers.push({
        bytes: bytes,
        callback: callback
    });
};

command.prototype.waitFront = function(bytes, callback) {
    this.useSteps = false;
    this.readers.unshift({
        bytes: bytes,
        callback: callback
    });
};

command.prototype.readByte = function(callback) {
    this.wait(1, function(buf,offset) {
        callback.call(this, buf.readUInt8(offset));
    });
};

command.prototype.readShort = function(callback) {
    this.wait(2, function(buf,offset) {
        callback.call(this, buf.readInt16BE(offset));
    });
};

command.prototype.readInt = function(callback) {
    this.wait(4, function(buf,offset) {
        callback.call(this, buf.readInt32BE(offset));
    });
};

command.prototype.readLong = function(callback) {
    this.wait(8, function(buf,offset) {
        callback.call(this, buf.readInt32BE(offset) * 4294967296 + buf.readUInt32BE(offset + 4));
    });
};

command.prototype.readString = function(callback) {
    this.readInt(function(length) {
        if (length>0) {
            this.waitFront(length, function(buf,offset) {
                callback.call(this, buf.toString("utf8", offset, offset + length));
            });
        }
        else
            callback.call(this, '');
    });
};

command.prototype.readBytes = function(callback) {
    this.readInt(function(length) {
        console.log( 'buffer length: %d', length);
        var bytes = new Buffer(length);
        if (length>0) {
            this.waitFront(length, function(buf,offset) {
                buf.copy(bytes, 0, offset, length + offset);
                callback.call(this, bytes);
            });
        } else {
            callback.call(this,bytes);
        }
    });
};

command.prototype.readHeader = function(callback) {
    this.readByte(function(status) {
        console.log('status: ' + status);
        this.readInt(function(transactionId) {
            console.log('transactionId: ' + transactionId);
            callback.call(this,status, transactionId);
        } );
    } );
};

command.prototype.read = function(buf) {
    var bytesRead = 0,
        bytesLingering = (this.lingeringBuffer && this.lingeringBuffer.length) || 0,
        totalBytesRead = bytesRead,
        localBuffer = new Buffer(buf.length + bytesLingering);

    if (bytesLingering) this.lingeringBuffer.copy(localBuffer);

    buf.copy(localBuffer, bytesLingering);

    if (this.useSteps) {
        while (!this.done() && (bytesRead = this.steps[this.step].call(this, localBuffer, totalBytesRead))) {
            totalBytesRead += bytesRead;
        }
    } else {
        while (this.readers.length > 0 && totalBytesRead + this.readers[0].bytes <= localBuffer.length) {
            var reader = this.readers.shift();
            reader.callback.call(this,localBuffer,totalBytesRead);
            totalBytesRead += reader.bytes;
        }
        console.log( 'exited loop with %d readers, %dB in buffer, %dB read', this.readers.length, localBuffer.length, totalBytesRead );
    } 

    this.lingeringBuffer = new Buffer(localBuffer.length - totalBytesRead);

    localBuffer.copy(this.lingeringBuffer, 0, totalBytesRead);

    // Give back the remaining buffer to the caller
    return this.lingeringBuffer;
};

command.skipByte = function(buf, offset) {
    if (!parser.canReadByte(buf, offset)) {
        return 0;
    }
    this.step++;
    return parser.BYTES_BYTE;
};


command.skipInt = function(buf, offset) {
    if (!parser.canReadInt(buf, offset)) {
        return 0;
    }
    this.step++;
    return parser.BYTES_INT;
};


module.exports = command;