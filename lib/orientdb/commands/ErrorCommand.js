var util = require("util"),
    base = require("./CommandBase"),
    OperationTypes = require("./operation_types"),

    command = function() {
        base.call(this);

        this.readHeader(readError);
    };

util.inherits(command, base);

module.exports = command;

/*
 This is not a real command, rather a way to correctly handle data chunk reads 
 mimicking other commands behaviour (canRead* + read* sequences)
 */
command.operation = OperationTypes.ERROR_COMMAND;


function readError() {
    var errors = [];
    readNextError.call(this);

    function readNextError() {
        this.readByte(function(more) {
            if( more ) {
                var error = {};

                // exception class
                this.readString(function(errorClass) {
                    error["class"] = errorClass;

                    this.readString(function(errorMessage) {
                        error.message = errorMessage;
                        errors.push(error);
                        readNextError.call(this);
                    });
                });
            } else {
                this.error = new Error(JSON.stringify(errors));
            }
        });
    }
}

command.write = function() {
    throw new Error("Unsupported operation");
};

