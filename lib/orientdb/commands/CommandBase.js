var parser = require("../connection/parser");

var command = function() {
    this.readers = [];

    this.result = {};
    this.error = null;
};

command.prototype.done = function() {
    return this.readers.length == 0;
};

command.prototype.wait = function(bytes, callback) {
    this.readers.push({
        bytes: bytes,
        callback: callback
    });
};

command.prototype.waitFront = function(bytes, callback) {
    this.readers.unshift({
        bytes: bytes,
        callback: callback
    });
};

command.prototype.readByte = function(callback) {
    this.wait(1, function(buf,offset) {
        callback.call(this, parser.readByte(buf, offset));
    });
};

command.prototype.readShort = function(callback) {
    this.wait(2, function(buf,offset) {
        callback.call(this, parser.readShort(buf, offset));
    });
};

command.prototype.readInt = function(callback) {
    this.wait(4, function(buf,offset) {
        callback.call(this, parser.readInt(buf, offset));
    });
};

command.prototype.readLong = function(callback) {
    this.wait(8, function(buf,offset) {
        callback.call(this, parser.readLong(buf, offset ));
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
//        console.log('status: ' + status);
        this.readInt(function(sessionId) {
//            console.log('sessionId: ' + sessionId);
            callback.call(this,status, sessionId);
        } );
    } );
};

command.prototype.readRid = function(callback) {
    this.readShort(function(clusterId) {
        this.readLong(function(clusterPosition) {
            var rid = null;
            if (clusterId !== -1)
                rid = "#" + clusterId + ":" + clusterPosition;
            callback.call(this, rid);
        });
    });
};

command.prototype.readRecord = function(callback) {
    var record = {};
    
    // record class
    this.readShort(function(klass) {
        record["class"] = klass;

        if (klass === -2) {
            // no record
            callback(null);
        } else if (klass === -3) {
            this.readRid(function(rid) {
                record["@rid"] = rid;
                callback(record);
            });
        } else if (klass === -1) {
            // no class id
            // TODO
            throw new Error("And what am I supposed to do here?");
        } else if (klass > -1) {
            // valid

            this.readByte(function(type) {
                // record type ('d' or 'b')
                record.type = String.fromCharCode(type);
                this.readRid(function(rid) {
                    if (rid !== -1)
                        record.rid = rid;
                    this.readInt(function(version) {
                        record.version = version;
                        this.readString(function(content) {
                            record.content = content;
                            callback.call(this, record);
                        });
                    });
                });
            });
        } else {
            throw new Error("Unknown record class id: " + record["class"]);
        }
    });
};

command.prototype.readArray = function(count,reader,callback) {
    var ar = [];
    readRemaining.call(this);
    function readRemaining() {
        if (count-- > 0)
            reader.call(this, function(el) {
                ar.push(el);
                readRemaining.call(this);
            });
        else if (callback)
            callback.call(this, ar);
    }
};

command.prototype.readCollection = function(callback) {
    this.readInt(function(count) {
        this.readArray(count,this.readRecord,callback);
    });
};

command.prototype.read = function(buf) {
    var bytesRead = 0,
        bytesLingering = (this.lingeringBuffer && this.lingeringBuffer.length) || 0,
        totalBytesRead = bytesRead,
        localBuffer = new Buffer(buf.length + bytesLingering);

    if (bytesLingering) this.lingeringBuffer.copy(localBuffer);

    buf.copy(localBuffer, bytesLingering);

    while (this.readers.length > 0 && totalBytesRead + this.readers[0].bytes <= localBuffer.length) {
        var reader = this.readers.shift();
        reader.callback.call(this,localBuffer,totalBytesRead);
        totalBytesRead += reader.bytes;
    }
    //console.log( 'exited loop with %d readers, %dB in buffer, %dB read', this.readers.length, localBuffer.length, totalBytesRead );

    this.lingeringBuffer = new Buffer(localBuffer.length - totalBytesRead);

    localBuffer.copy(this.lingeringBuffer, 0, totalBytesRead);

    // Give back the remaining buffer to the caller
    return this.lingeringBuffer;
};

module.exports = command;