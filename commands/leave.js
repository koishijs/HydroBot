exports.sudo = true;
exports.exec = async (args, e, context, { CQ }) => {
    if (context.group_id) CQ('set_group_leave', { group_id: context.group_id });
    else CQ('set_discuss_leave', { discuss_id: context.discuss_id });
    e.stopPropagation();
}