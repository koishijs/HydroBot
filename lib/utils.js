module.exports = class {
    constructor(item) {
        this.info = item.info;
        this.RE_AT_ME = new RegExp("CQ:at,qq=" + this.info.id, "i");
        this.RE_AT = /^([\s\S]*)\[CQ:at,qq=[0123456789]+\]([\s\S]*)$/i;
    }
    isAtMe(message) {
        if (!this.RE_AT_ME.test(message)) return false;
        let tmp = this.RE_AT.exec(message);
        if (!tmp) return false;
        return tmp[1] + tmp[2];
    }
};
