const MONTH_NUMBERS = {
    Jan: '01',
    Feb: '02',
    Mar: '03',
    Apr: '04',
    May: '05',
    Jun: '06',
    Jul: '07',
    Aug: '08',
    Sep: '09',
    Oct: '10',
    Nov: '11',
    Dec: '12',
};

function ensureDateStringFormatted(date: string) {
    if (date.includes('/')) {
        // it's good! (probably)
        return date;
    }

    const parts = date.split(' ');
    if (parts.length !== 2) {
        // not something we can handle; just return as-is
        return date;
    }

    const month = MONTH_NUMBERS[parts[0] as keyof typeof MONTH_NUMBERS];
    if (!month) {
        // as above
        return date;
    }

    const day = parts[1];
    const year = new Date().getFullYear();

    return month + '/' + day + '/' + year;
}

export function stringifyDate(date: string | Date) {
    if (typeof(date) === 'string') {
        return ensureDateStringFormatted(date);
    }

    let month: string | number = date.getMonth() + 1;
    if (month < 10) {
        month = `0${month}`;
    }

    let day: string | number = date.getDate();
    if (day < 10) {
        day = `0${day}`;
    }

    const year = date.getFullYear();
    return month + '/' + day + '/' + year;
}

export function firstDayOfNextMonth(date: Date) {
    if (date.getMonth() === 11) {
        return new Date(date.getFullYear() + 1, 0);
    } else {
        return new Date(date.getFullYear(), date.getMonth() + 1);
    }
}

