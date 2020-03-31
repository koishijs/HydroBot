exports.exec = async (args, meta, { db }) => {
    let coll = db.collection('todo');
    let _args = args.split(' ');
    let status = _args[_args.length - 1];
    _args = args.split(' ', _args.length - 1).join(' ');
    if (_args[0] == '"' && _args[_args.length - 1] == '"') _args = _args.substring(1, _args.length - 1);
    let res = await coll.updateOne({ uid: meta.userId, content: _args }, { $set: { status } });
    if (res.matchedCount) return 'Updated.'.translate();
    else return 'No such todo: {0}'.translate().format(_args);
};