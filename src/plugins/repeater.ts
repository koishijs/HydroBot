import { App } from 'koishi';

const dataG = {};

export const apply = (app: App, config) => {
    app.on('message/group', (session) => {
        if (!dataG[session.groupId]) {
            dataG[session.groupId] = {};
            dataG[session.groupId].msg = session.message;
            dataG[session.groupId].t = 1;
        } else {
            if (dataG[session.groupId].msg === session.message) dataG[session.groupId].t++;
            else {
                dataG[session.groupId].t = 1;
                dataG[session.groupId].msg = session.message;
            }
            if (dataG[session.groupId].t === config.time) session.$send(dataG[session.groupId].msg);
        }
    });
};
