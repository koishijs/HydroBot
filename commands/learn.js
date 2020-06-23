let knowledge = {};
exports.exec = (args) => {
    args = args.split(' ');
    if (args[0] === 'learn' || args[0] === 'add') {
        const [q, a] = args[1].split(':');
        knowledge[q] = a;
        return 'Learned';
    } if (args[0] === 'get') {
        return `Found: ${knowledge[args[1]]}` || 'NotFound';
    } if (args[0] === 'del') {
        knowledge[args[1]] = null;
        return 'Deleted';
    } if (args[0] === 'clear') {
        knowledge = {};
        return 'Cleared';
    }
};
