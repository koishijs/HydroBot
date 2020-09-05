import moment from 'moment';

export function endOfToday() {
    return moment().utc()
        .add(8, 'hours')
        .endOf('day')
        .subtract(8, 'hours')
        .toDate();
}
