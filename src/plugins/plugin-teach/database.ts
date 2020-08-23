/* eslint-disable no-await-in-loop */
import { extendDatabase, Context } from 'koishi-core';
import {
    defineProperty, Observed, pick, clone,
} from 'koishi-utils';
import { FilterQuery } from 'mongodb';
import MongoDatabase from 'koishi-plugin-mongo/dist/database';
import { Dialogue, DialogueTest } from './utils';

interface DialogueStats {
    questions: number
    dialogues: number
}

declare module 'koishi-core/dist/database' {
    interface Database {
        dialogueHistory: Record<number, Dialogue>

        getDialoguesById<T extends Dialogue.Field>(ids: number[], fields?: T[]): Promise<Dialogue[]>
        getDialoguesByTest(test: DialogueTest): Promise<Dialogue[]>
        createDialogue(dialogue: Dialogue, argv: Dialogue.Argv, revert?: boolean): Promise<Dialogue>
        removeDialogues(ids: number[], argv: Dialogue.Argv, revert?: boolean): Promise<void>
        updateDialogues(dialogues: Observed<Dialogue>[], argv: Dialogue.Argv): Promise<void>
        revertDialogues(dialogues: Dialogue[], argv: Dialogue.Argv): Promise<string>
        recoverDialogues(dialogues: Dialogue[], argv: Dialogue.Argv): Promise<void>
        getDialogueStats(): Promise<DialogueStats>
    }
}

declare module 'koishi-core/dist/context' {
    interface EventMap {
        'dialogue/'(test: DialogueTest, conditionals?: string[]): void
        'dialogue/mongo'(test: DialogueTest, conditionals?: FilterQuery<Dialogue>[]): void
    }
}

extendDatabase<typeof MongoDatabase>('koishi-plugin-mongo', {
    async getDialoguesById(ids, fields) {
        if (!ids.length) return [];
        let cursor = this.db.collection('dialogue').find({ _id: { $in: ids } });
        if (fields) {
            const p = {};
            for (const field of fields) p[field] = 1;
            cursor = cursor.project(p);
        }
        const dialogues = await cursor.toArray();
        dialogues.forEach((d) => {
            d._id = d.id;
            defineProperty(d, '_backup', clone(d));
        });
        return dialogues;
    },

    async getDialoguesByTest(test: DialogueTest) {
        const query: FilterQuery<Dialogue> = { $and: [] };
        this.app.emit('dialogue/mongo', test, query.$and);
        if (!query.$and.length) delete query.$and;
        const dialogues: Dialogue[] = (await this.db.collection('dialogue').find(query).toArray())
            .filter((dialogue) => !this.app.bail('dialogue/fetch', dialogue, test));
        dialogues.forEach((d) => defineProperty(d, '_backup', clone(d)));
        return dialogues.filter((value) => {
            if (value.flag & Dialogue.Flag.regexp) {
                const regex = new RegExp(value.question);
                return regex.test(test.question) || regex.test(test.original);
            }
            return true;
        });
    },

    async createDialogue(dialogue: Dialogue, argv: Dialogue.Argv, revert = false) {
        if (!dialogue.id) {
            const [latest] = await this.db.collection('dialogue').find().sort('_id', -1).limit(1)
                .toArray();
            if (latest) dialogue.id = latest._id + 1;
            else dialogue.id = 1;
        }
        const v: Partial<Dialogue> = {
            probS: 1.0,
            probA: 0.0,
            startTime: 0,
            endTime: 0,
            successorTimeout: 0,
            writer: 0,
            flag: 0,
        };
        await this.db.collection('dialogue').insertOne({ ...v, _id: dialogue.id, ...dialogue });
        Dialogue.addHistory(dialogue, '添加', argv, revert);
        return dialogue;
    },

    async removeDialogues(ids: number[], argv: Dialogue.Argv, revert = false) {
        if (!ids.length) return;
        await this.db.collection('dialogue').deleteMany({ _id: { $in: ids } });
        for (const id of ids) {
            Dialogue.addHistory(argv.dialogueMap[id], '删除', argv, revert);
        }
    },

    async updateDialogues(dialogues: Observed<Dialogue>[], argv: Dialogue.Argv) {
        const fields = new Set<Dialogue.Field>(['id']);
        for (const { _diff } of dialogues) {
            for (const key in _diff) {
                fields.add(key as Dialogue.Field);
            }
        }
        const temp: Record<number, Dialogue> = {};
        const tasks = [];
        for (const dialogue of dialogues) {
            if (!Object.keys(dialogue._diff).length) {
                argv.skipped.push(dialogue.id);
            } else {
                dialogue._diff = {};
                argv.updated.push(dialogue.id);
                tasks.push(
                    this.db.collection('dialogue').updateOne({ _id: dialogue.id }, { $set: pick(dialogue, fields) }),
                );
                Dialogue.addHistory(dialogue._backup, '修改', argv, false, temp);
            }
        }
        await Promise.all(tasks);
        Object.assign(this.dialogueHistory, temp);
    },

    async revertDialogues(dialogues: Dialogue[], argv: Dialogue.Argv) {
        const created = dialogues.filter((d) => d._type === '添加');
        const edited = dialogues.filter((d) => d._type !== '添加');
        await this.removeDialogues(created.map((d) => d.id), argv, true);
        await this.recoverDialogues(edited, argv);
        return `问答 ${dialogues.map((d) => d.id).sort((a, b) => a - b)} 已回退完成。`;
    },

    async recoverDialogues(dialogues: Dialogue[], argv: Dialogue.Argv) {
        if (!dialogues.length) return;
        const tasks = [];
        for (const dialogue of dialogues) {
            tasks.push(await this.db.collection('dialogue').updateOne({ _id: dialogue.id }, { $set: dialogue }));
        }
        await Promise.all(tasks);
        for (const dialogue of dialogues) {
            Dialogue.addHistory(dialogue, '修改', argv, true);
        }
    },

    async getDialogueStats() {
        const [data, dialogues] = await Promise.all([
            this.db.collection('dialogue').aggregate([
                { $group: { _id: { $toLower: 'question' }, count: { $sum: 1 } } },
                { $group: { _id: null, counts: { $push: { k: '$_id', v: '$count' } } } },
                { $replaceRoot: { newRoot: { $arrayToObject: '$counts' } } },
            ]).toArray(),
            this.db.collection('dialogue').count(),
        ]);
        const questions = Object.keys(data).length;
        return { questions, dialogues };
    },
});

export default function apply(ctx: Context) {
    ctx.on('before-connect', () => {
        ctx.database.dialogueHistory = {};
    });
}
