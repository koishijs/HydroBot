import { resolve } from 'path';
import { tmpdir } from 'os';
import { Context } from 'koishi-core';
import { CQCode, Logger } from 'koishi-utils';
import yaml from 'js-yaml';
import py from '@pipcook/boa';
import axios from 'axios';
import { unlink, writeFile, readFile } from 'fs-extra';

const { list } = py.builtins();
const torch = py.import('torch');
const Image = py.import('PIL.Image');
const { transforms } = py.import('torchvision');
const logger = new Logger('imagetag');
const imageRE = /(\[CQ:image,file=[^,]+,url=[^\]]+\])/;

export const apply = async (ctx: Context, config: any) => {
    const file = await readFile(resolve(process.cwd(), 'database', 'image.tags.translation.yaml'))
    const trans = yaml.safeLoad(file.toString());
    const model = torch.hub.load('RF5/danbooru-pretrained', 'resnet50');
    model.eval();
    if (torch.cuda.is_available()) {
        logger.info('CUDA available');
        model.to('cuda');
    }
    const preprocess = transforms.Compose([
        transforms.Resize(360),
        transforms.ToTensor(),
        transforms.Normalize(py.kwargs({ mean: [0.7137, 0.6628, 0.6519], std: [0.2970, 0.3017, 0.2979] })),
    ]);
    const indexer = py.eval('lambda a: a[0]');
    const filter = py.eval('lambda a: a[a > 0.5]');
    const tensorStr = py.eval('lambda a: str(a)');
    const tensorInt = (t) => {
        const str = tensorStr(t);
        return +str.split('(')[1].split(')')[0];
    };
    const { data: names } = await axios.get('https://raw.githubusercontent.com/RF5/danbooru-pretrained/master/config/class_names_6000.json');

    ctx.command('tag <image>', 'Get image tag', { hidden: true })
        .action(async ({ session }, image) => {
            const file = CQCode.parse(image);
            const { data } = await axios.get<ArrayBuffer>(file.data.url, { responseType: 'arraybuffer' });
            const fp = resolve(tmpdir(), `${Math.random().toString()}.png`);
            await writeFile(fp, data);
            logger.info('downloaded');
            const input_image = Image.open(fp);
            const input_tensor = preprocess(input_image);
            logger.info('preprocess');
            let input_batch = input_tensor.unsqueeze(0);
            if (torch.cuda.is_available()) input_batch = input_batch.to('cuda');
            const output = model(input_batch);
            logger.info('model');
            const probs = torch.sigmoid(indexer(output));
            console.log(probs);
            const tmp = filter(probs);
            const inds = probs.argsort(py.kwargs({ descending: true }));
            let txt = '';
            const l = py.eval('lambda a, b: a[0: len(b)]');
            const g = py.eval('lambda a, b: a[b].detach().numpy()');
            for (const i of list(l(inds, tmp))) txt += `${trans[names[tensorInt(i)]] || names[tensorInt(i)]}: ${Math.floor(g(probs, i) * 100)}% \n`;
            await session.$send(txt);
            await unlink(fp);
        });

    if (config.auto) {
        ctx.middleware(async (session, next) => {
            const capture = imageRE.exec(session.message);
            if (capture) session.$execute(`tag ${capture[1]}`);
            return next();
        });
    }
};
