class ErrorMessage extends Error {
    constructor(message) {
        super(message);
        this.stack = '';
    }
}
module.exports = {
    ErrorMessage
};