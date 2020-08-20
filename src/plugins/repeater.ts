import { App } from 'koishi-core';

const dataG = {};

export const apply = (app: App) => {
    app.middleware((session) => {
        if (!session.groupId) return;
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
            if (dataG[session.groupId].t === 4) session.$send(dataG[session.groupId].msg);
        }
    });
};
