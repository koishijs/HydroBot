const net = require('net');

class MCServStatus {
    constructor(host, port) {
        this.port = port;
        this.host = host;
        this.status = {
            online: null,
            version: null,
            motd: null,
            current_players: null,
            max_players: null,
            latency: null,
        };
    }

    getStatus() {
        return new Promise((resolve, reject) => {
            const start_time = new Date();
            const client = net.connect(this.port, this.host, () => {
                this.status.latency = Math.round(new Date() - start_time);
                const data = Buffer.from([0xFE, 0x01]);
                client.write(data);
            });
            client.on('data', (response) => {
                const server_info = response.toString().split('\x00\x00');
                this.status = {
                    host: this.host,
                    port: this.port,
                    version: server_info[2].replace(/\u0000/g, ''),
                    motd: server_info[3].replace(/\u0000/g, ''),
                    current_players: server_info[4].replace(/\u0000/g, ''),
                    max_players: server_info[5].replace(/\u0000/g, ''),
                    latency: this.status.latency,
                };
                client.end();
                resolve(this.status);
            });
            client.on('end', () => { });
            client.on('error', reject);
        });
    }
}
exports.register = ({ app }) => {
    app.command('minecraft <host:port>', '查询mc服务器信息').action(async ({ meta }, args) => {
        const [host, port = 25565] = args.split(':');
        const r = await new MCServStatus(host, port).getStatus();
        return meta.$send(`服务器版本：${r.version}
玩家数：${r.current_players}/${r.max_players}  延迟：${r.latency}ms
MOTD: ${r.motd.replace(/\u0000/g, '').replace(/[^\x00-\x7F]/g, '')}`);
    });
};
