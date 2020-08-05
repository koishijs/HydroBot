export = class {
    info: any;

    username: string;

    RE_AT_ME: RegExp;

    RE_AT: RegExp;

    constructor(item) {
        this.info = item.info;
        this.username = item.username;
        this.RE_AT_ME = new RegExp(`CQ:at,qq=${this.info.id}`, 'i');
        this.RE_AT = /^([\s\S]*)\[CQ:at,qq=[0123456789]+\]([\s\S]*)$/i;
    }

    isAtMe(message: string) {
        if (message.includes(`@${this.username} `)) return true;
        if (!this.RE_AT_ME.test(message)) return false;
        const tmp = this.RE_AT.exec(message);
        if (!tmp) return false;
        return tmp[1] + tmp[2];
    }
};
