exports.exec = async (args, e, context, { db }) => {
    let coll = db.collection('todo');
    let _args = args.split(' ');
    let status = _args[_args.length - 1];
    _args = args.split(' ', _args.length - 1).join(' ');
    await coll.updateOne({ uid: context.user_id, content: _args }, { $set: { status } });
    return 'Updated'.translate();
}