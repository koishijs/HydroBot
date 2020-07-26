exports.exec = async (args, meta, { db }) => {
    const coll = db.collection('todo');
    let _args = args.split(' ');
    const status = _args[_args.length - 1];
    _args = args.split(' ', _args.length - 1).join(' ');
    if (_args[0] === '"' && _args[_args.length - 1] === '"') _args = _args.substring(1, _args.length - 1);
    const res = await coll.updateOne({ uid: meta.userId, content: _args }, { $set: { status } });
    if (res.matchedCount) return 'Updated.';
    return `No such todo: ${_args}`;
};
