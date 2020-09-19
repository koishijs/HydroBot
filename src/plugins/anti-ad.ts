import path from 'path';
import { App } from 'koishi-core';
import { Logger } from 'koishi-utils';
import boa from '@pipcook/boa';

const logger = new Logger('anti-ad');
logger.info('Loading model');
const { AdPredictor } = boa.import('adfilter.model');
const model = AdPredictor.from_saved_model(path.resolve(process.cwd(), 'lib', 'adfilter', 'data'));
logger.info('Model loaded');

export const apply = (app: App) => {
    app.on('message', async (session) => {
        const result = model.predict_ad(session.rawMessage);
        logger.info('%o', result);
        if (result[0] === 'pssisterad') {
            session.$send(`[CQ:reply,id=${session.messageId}] 疑似广告，置信度${Math.floor(result[1] * 100)}%`);
        }
    });
};
