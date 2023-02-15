/** 
 * IMPORTANT NOTICE
 * The code bellow does not pass te fcc validation
 * 'date: new Date(splitDate[2], splitDate[1], splitDate[0]).toDateString() '
 *  
 * On the contrary,  
 * 'date: new Date(update.date).toDateString()'
 * PASSES!!!
 */

const express = require('express')
const app = express()
const cors = require('cors')
const dotenv = require('dotenv').config();
const mongoose = require('mongoose')
const { User, CreateOne, FindAll, FindOne } = require('./dataBase')



/** Midleware */
app.use(express.urlencoded({ extended: true }));
app.use(cors())
app.use(express.json());
app.use(express.static('public'))
app.get('/', (req, res) => {
    res.sendFile(__dirname + '/views/index.html')
});

/** Mongoose connection */
mongoose.set('strictQuery', true);
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

function CreateJsonError(e, res){
    res.json({error:e.message, stack:e.stack});
}


/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Requests
 */
// Get all users
app.get('/api/users', async (req, res) => {
    const users = await FindAll(User);
    if (users.length) {
        const usersArr = CreateUsersArr(users);
        if (usersArr.length) return res.json(usersArr);
    }
    else return res.json('no users in database')
})


/**
 * POST to add user
 */
app.post('/api/users', async (req, res) => {
    const username = req.body;

    const user = await CreateOne(User, username);
    if (!user) {
        return res.json({ ERROR: 'Error, user not be ADDED:' })
    }

    res.json({ username: user.username, _id: user._id })
});

/**
 * POST to add exercises to a user's log(array)
 */
app.post('/api/users/:_id/exercises', async (req, res) => {
    const userId = req.params._id;
    const data = req.body;

    // Validation
    if (!ValidateDuration(data.duration)) {
        data.duration = 0;
    } else { data.duration = Number(data.duration); }


    if (!data.date || data.date === undefined) { // If no date is supplied, the current date will be used
        data.date = new Date().toDateString();
    }

    const splitDate = ValidateDate(data.date); // Returns null if date not vaild
    data.date = ConvertToDateFormat(splitDate, 'yyyy mm dd')

    const user = await FindOne(User, { _id: userId });
    if (user) {
        const update = { // The fields with the values to update
            description: data.description,
            duration: data.duration,
            date: data.date,
        }

        User.findByIdAndUpdate(userId,
            { $push: { log: update } },
            { new: true },
            (err, updated) => {
                if (err) CreateJsonError(new Error('Failed to update excersize log'), res);
                const splitDate = update.date.split(' ');
                const excersize = {
                    username: updated.username,
                    description: update.description,
                    duration: update.duration,
                    date: new Date(update.date).toDateString(),
                    _id: updated.id,

                }
                return res.json(excersize);
            });


    } else {
        console.log('Error, user not found. Id:', { id: userId })
        CreateJsonError(new Error(`Error, user not found. Id: ${userId}`), res);
    }
})


/**
 * GET to retrieve all exercise logs of a user based on a field's value
 */
app.get('/api/users/:_id/logs', async (req, res) => {
    const userId = req.params._id;
    let from = req.query.from;
    let to = req.query.to;
    let limit = 100;

    if (req.query.limit || req.query.limit !== undefined) limit = parseInt(req.query.limit)

    // See: https://stackoverflow.com/questions/15415023/mongodb-select-matched-elements-of-subcollection
    const user = await User.findById({ _id: userId });

    if (!user) return;

    const fromDate = ConvertToDateFormat(ValidateDate(from), 'yyyy mm dd');
    const toDate = ConvertToDateFormat(ValidateDate(to), 'yyyy mm dd');

    const resObj = {
        username: user.username,
        count: 0,
        _id: user.id,
        log: []
    }
    if (!fromDate || !toDate) {
        const logsArr = CreateLogArr(user.log, limit)
        resObj.count = logsArr.length;
        resObj.log = logsArr;
        console.log(' --- LOG: \n', resObj)
        return res.json(resObj)
    }

    const result = await User.aggregate([
        { '$unwind': '$log' },
        // { '$sort': { 'log.date': -1 } }, // Get a sorted list
        {
            '$match': {
                'log.date': {
                    '$gte': fromDate,
                    '$lte': toDate
                }
            }
        },
        { '$limit': limit }, // Limit on how many elements the query will return
        { '$group': { '_id': userId, 'log': { '$addToSet': '$log' } } }
    ])

    const logsArr = CreateLogArr(result[0].log, 0);
    resObj.count = result[0].log.length;
    resObj.log = logsArr;
    console.log(' --- LOG2: \n', resObj)
    res.json(resObj)
});




const listener = app.listen(process.env.PORT || 3000, () => {
    console.log('Your app is listening on port ' + listener.address().port)
})




/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Not required for freeCodeCamp exercise
 */

app.get('/api/users/withLogs', async (req, res) => {
    const users = await FindAll(User);
    if (users.length) {
        res.json(users)
    }
    else return res.json('no users in database')
})

/**
 * GET to retrieve all exercise logs of a user based on duration's field value
 * [using mongo aggregations]
 */
app.get('/api/users/:_id/getlogswithduration', async (req, res) => {
    const userId = req.params._id;

    // Get all logs of all users with duration= <number>
    // See: https://stackoverflow.com/questions/15415023/mongodb-select-matched-elements-of-subcollection
    const sort = { '$sort': { 'log.duration': 1 } };
    const duration = { '$gt': 1 };
    const result = await User.aggregate([
        // { '$match' : {'_id':userId, 'log': {'$elemMatch': {'duration': duration }}}},
        // { '$match' : { '_id':userId } },
        { '$match': { 'log': { '$elemMatch': { 'duration': duration } } } },
        { '$unwind': '$log' },
        { '$sort': { 'log.duration': 1 } }, // Get a sorted list
        { '$match': { 'log.duration': duration } },
        //{ '$limit' :   3 }, // Limit on how many elements the query will return
        { '$group': { '_id': '$_id', 'log': { '$addToSet': '$log' } } }
    ])

    return res.json(result)
});

/**
 * POST request with a form to get user's logs based on a 'from-to' date
 */
app.post('/api/users/:_id/getlogs', async (req, res) => {
    const userId = req.body._id;
    const from = req.body.from;
    const to = req.body.to;
    const limit = parseInt(req.body.limit);

    const fromDate = ValidateDate(from);
    const toDate = ValidateDate(to);

    if (!fromDate || !toDate) {
        CreateJsonError(new Error(`Not valid date. fromDate: ${fromDate} toDate:${toDate}`), res);
    }


    // See: https://stackoverflow.com/questions/15415023/mongodb-select-matched-elements-of-subcollection
    const user = await User.findById({ _id: userId });
    const result = await User.aggregate([
        { '$unwind': '$log' },
        { '$sort': { 'log.date': -1 } }, // Get a sorted list
        // { '$match' : { 'log.date': date } },
        {
            '$match': {
                'log.date': {
                    '$gte': from,
                    '$lte': to,
                }
            }
        },
        { '$limit': limit }, // Limit on how many elements the query will return
        { '$group': { '_id': userId, 'log': { '$addToSet': '$log' } } }
    ])
    res.json(result)
})



/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Test Forms
 */
// Test date validation
app.post('/api/checkDate:date', (req, res) => {
    const date = req.body.date;
    const valid = ValidateDate(date)
    res.json(valid)

})

// Create moc users
const { CreateUserLogExercises } = require('./moc.js')
app.post('/api/CreateMocUser:username', async (req, res) => {
    const username = req.body.username;
    const userLog = CreateUserLogExercises();

    const user = await CreateOne(User, { username: username });
    const update = { // The fields with the values to update
        description: 'd1',
        duration: 1,
        date: new Date(),
    }
    if (user) {
        User.findByIdAndUpdate(user._id,
            // { $push: { log: userLog } },
            { log: userLog },
            { new: true },
            (err, updated) => {
                if (err) CreateJsonError(new Error(`Failed to update excersize log. updated:${updated} err: ${err}`), res);
                return res.json(updated);
            }
        );
    }

})


app.get('/api/users/:_id/testfind', async (req, res) => {
    const userId = req.params._id;

    User.find(
        { 'log': { '$in': { 'duration': 1 } } },
        { "log.$": 1 },
        {},
        function (err, result) {
            if (err) { console.log('err:', err); CreateJsonError(new Error(`User not found. result:${result} err: ${err}`), res); }
            console.log(result)
            return res.json(result)
        }
    )
});

/**
 * GET to retrieve exercise logs of a specific period of time
 */
app.post('/api/users/:_id/logstest', async (req, res, next) => {
    const userId = req.body._id;
    let from = req.body.from;
    let to = req.body.to;
    let limit = 100;

    if (req.body.limit || req.body.limit !== undefined) limit = parseInt(req.body.limit)

    // See: https://stackoverflow.com/questions/15415023/mongodb-select-matched-elements-of-subcollection
    const user = await User.findById({ _id: userId });


    if (!from || !to) {
        const logsArr = CreateLogArr(user.log, limit)
        const resObj = {
            username: user.username,
            count: logsArr.length,
            _id: user._id,
            log: logsArr
        }
        return res.json(resObj)
    }

    const fromDate = ValidateDate(from);
    const toDate = ValidateDate(to);

    if (!fromDate || !toDate) {
        CreateJsonError(new Error(`Not valid Date. fromDate:${fromDate} toDate:${toDate}`), res);
    }

    const result = await User.aggregate([
        { '$unwind': '$log' },
        { '$sort': { 'log.date': -1 } }, // Get a sorted list
        {
            '$match': {
                'log.date': {
                    '$gte': from,
                    '$lte': to
                }
            }
        },
        { '$limit': limit }, // Limit on how many elements the query will return
        { '$group': { '_id': userId, 'log': { '$addToSet': '$log' } } }
    ])

    // Convert date back to toDateString type
    const resObj = {
        username: result[0].username,
        count: 1,
        _id: result[0]._id,
        log: []
    }

    for (let i = 0; i < result[0].log.length; i++) {
        const splitDate = result[0].log[i].date;
        resObj.log[i] = {
            description: result[0].log[i].description,
            duration: result[0].log[i].duration,
            date: new Date(result[0].log[i].date).toDateString()
        }
    }

    console.log(resObj)
    res.json(resObj)
});


/* * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * * *
 * Helper Functions
 */

function IsNull(val) {
    if (val === null || val === undefined || val === NAN)
        return true;
    return false;
}
function IsEmpty(str) {
    if (str === '')
        return true;
    return false;
}
function CreateUsersArr(users) {
    const len = users.length;
    let usersArr = [];
    for (let i = 0; i < len; i++) {
        usersArr[i] = { username: users[i].username, _id: users[i]._id };
    }

    return usersArr;
}
function CreateLogArr(logs, limit) {
    let logsArr = [];
    let len = logs.length;
    if (!IsNull(limit) && limit > 0 && limit < len)
        len = limit;

    for (let i = 0; i < len; i++) {
        logsArr[i] = {
            description: logs[i].description,
            duration: logs[i].duration,
            date: new Date(logs[i].date).toDateString(),
        }
    }

    return logsArr;
}
// TODO: Create a solid regex date validation
function ValidateDateRegex(date) {
    const IS_DATE = /^((0[1-9]|1[0-2])|-(0[1-9]|1\d|2\d|3[01])\/|-(19|20)\d{2})|(\d{4}\-(0[1-9]|1[012])\-(0[1-9]|[12][0-9]|3[01]))$/;
    return IS_DATE.test(date);
}
function ValidateDuration(duration) {
    const IS_DURATION = /^([0-9]{1,3})$/;
    return IS_DURATION.test(duration);
}

/**
 * Validates if a day of a month
 * @param {String} day: of format: <'01', '02',...,'31'>
 * @returns {String}: Returns the input 'day' if is valid else null
 */
function IsValidDayNumber(day) {
    const d = parseInt(day);
    if (!IsNull(d) && (d >= 0 && day <= 31))
        return day;
    return null;
}

/**
 * Validates a day of a week
 * @param {String} day: A three letter string
 * @returns {String | null}: Returns the input 'day' if is valid else null
 */
function IsValidDayString(day) {
    const DAYS = ['null', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const REGEX_3_LETTERS = /([A-z]{1}[a-z]{2})/

    if (IsNull(day) || IsEmpty(day)) return null;

    // day string must be 3 letters
    const len = DAYS.length;
    if (day.length === 3 && REGEX_3_LETTERS.test(day)) {
        for (let i = 1; i < len; i++) {
            if (day === DAYS[i]) {
                return DAYS[i];
            }
        }
    }
    return null;
}

/**
 * Validates a day of a week OR a day of a month
 * @param {String|Number} day: String of format: <'Mon, Tue, ...'> or number of format: <'01, 01, ..., 31' >
 * @returns {String|Number|null}: Returns string if is valid string day of a week, or number if is a valid day number else null
 */
function ValidateDay(day) {

    // We check only the first character, if it is a letter A-Z or a-z
    const validDayStr = IsValidDayString(day);
    if (validDayStr) return validDayStr;

    // If day 1-31
    const validDayNum = IsValidDayNumber(day);
    if (validDayNum) return validDayNum;

    return null;
}

/**
 * Validates a month of a year
 * @param {String} month: of format: <'01', '02',...,'12'>
 * @returns {String}: Returns the input 'month' if is valid else null
 */
function IsValidMonthNumber(month) {
    const m = parseInt(month);
    if (!IsNull(m) && (m >= 0 && m <= 12))
        return month;
    return null;
}

/**
 * Validates a month of a year
 * @param {String} month: of format: <'Jan', 'Feb', ...>
 * @returns {String | null}: Returns the input 'month' if is valid else null
 */
function IsValidMonthString(month) {
    const MONTHS = ['null', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Sep', 'Oct', 'Nov', 'Dec'];
    const REGEX_3_LETTERS = /([A-z]{1}[a-z]{2})/

    if (IsNull(month) || IsEmpty(month)) return null;

    // month string must be 3 letters
    const len = MONTHS.length;
    if (month.length === 3 && REGEX_3_LETTERS.test(month)) {
        for (let i = 1; i < len; i++) {
            if (month === MONTHS[i]) {
                return MONTHS[i];
            }
        }
    }
    return null;
}

/**
 * Validates a month of a year
 * @param {String} month: String of format: <'Jan, Feb', ...> or number of format: <'01', '02', ..., '12' >
 * @returns {String|null}: Returns string if is valid string month, or number if is a valid month number else null
 */
function ValidateMonth(month) {
    // If month is type of 'Jan || Feb || ... || Dec'
    const validMonthStr = IsValidMonthString(month);
    if (validMonthStr) return validMonthStr;
    // If month is type of '0-12'
    const validMonthNumber = IsValidMonthNumber(month);
    if (IsValidMonthNumber(month)) return validMonthNumber;

    return null;
}

/**
 * Validate a  year
 * @param {String} year: of format: <'1900', '2020', ...>
 * @returns {String|null}: Returns the input 'year' if is valid else null
 */
function ValidateYear(year) {
    if (year.length === 4
        && (year.charCodeAt(0) === '1'.codePointAt(0) || year.charCodeAt(0) === '2'.codePointAt(0))
        && (year.charCodeAt(1) === '0'.codePointAt(0) || year.charCodeAt(1) === '9'.codePointAt(0))
        && (year.charCodeAt(2) >= '0'.codePointAt(0) && year.charCodeAt(2) <= '9'.codePointAt(0))
        && (year.charCodeAt(3) >= '0'.codePointAt(0) && year.charCodeAt(3) <= '9'.codePointAt(0))
    ) {
        return year;
    }

    return null;
}

/**
 * Checks if a string is a valid date
 * @param {String} date: of format: <any>
 * @returns {Object}: of form: <{ day: '', month: '', year: '', dayStr: '', monthStr: '' }>
 */
function ValidateDate(date) {

    /**
     * First we split the 'date' string to it's parts at spaces.
     * Then according to the numper of the splited parts:
     *      . A length of 4 as the first part suggests a format of input string 'date' of <yyyy ....>
     *      . A length of 3 as the first part suggests a format of input string 'date' of <Mon, ....> OR <Jan, ...>
     *      . A length of 2 as the first part suggests a format of input string 'date' of <01, ...., xx>
     *      . A length of 1 as the first part suggests a format of input string 'date' of <yyyy-03-12>
     *          where date parts are not separeted by spaces
     * If any of the keys of the constructed object 'dateObj' is null, then the validation fails and returns null.
     *      So in order to validate a string that misses a key field of the object 'dateObj',
     *      we set that key as an empty string so the whole validation does not evaluate as not valid 
     * 
     * !Function misses a lot input string checking!
     */

    if (IsNull(date)) return null;

    const splited = date.split(' ');

    let dateObj = { day: '', month: '', year: '', dayStr: '', monthStr: '' }

    if (splited[0].length === 4) { // Date has the view of 'yyyy mm dd' 
        dateObj.year = ValidateYear(splited[0])
        dateObj.month = ValidateMonth(splited[1])
        dateObj.day = ValidateDay(splited[2])
        dateObj.dayStr = ''; // Not used. Must Not be null to pass the validation
        dateObj.monthStr = '' // Same
    }
    else if (splited[0].length === 3) { // Date has the view of 'Sat Feb dd yyy' from function Date().toDateString()
        dateObj.dayStr = ValidateDay(splited[0])
        dateObj.monthStr = ValidateMonth(splited[1])
        dateObj.day = ValidateDay(splited[2])
        dateObj.year = ValidateYear(splited[3])
        dateObj.month = ''; // Month  as number is missing to this view. We set it to empty so it is not null and pass the validation
    }
    else if (splited[0].length === 2) { // Date has the view of 'dd mm yyyy'
        dateObj.day = ValidateDay(splited[0])
        dateObj.month = ValidateMonth(splited[1])
        dateObj.year = ValidateYear(splited[2])
        dateObj.dayStr = ''; // Not used. Must be Not null to pass the validation
        dateObj.monthStr = '' // Same
    }
    else if (splited[0].length === 1) { // Check if the date is just of view: 'yyyy-mm-dd', without any spaces to be splitted 
        let sp = []
        if (date.indexOf('-') > -1) sp = date.split('-')
        else if (date.indexOf('/') > -1) sp = date.split('/')

        if (sp[0].length === 2) { // Case of 'dd-mm-yyyyy'
            dateObj.day = ValidateDay(sp[0])
            dateObj.month = ValidateMonth(sp[1])
            dateObj.year = ValidateYear(sp[2])
        }
        else if (sp[0].length === 4) { // Case of 'yyyy-mm-dd'
            dateObj.year = ValidateYear(sp[0])
            dateObj.month = ValidateMonth(sp[1])
            dateObj.day = ValidateDay(sp[2])
        }
        dateObj.dayStr = ''; // Not used. Must be Not null to pass the validation
        dateObj.monthStr = '' // Same
    }

    // if (dateObj.day === null || dateObj.month === null ||
    //     dateObj.year === null || dateObj.dayStr === null || dateObj.monthStr === null) {
    //     return null;
    // }
    if (IsAnyObjectKeyNull(dateObj)) return null;
    else return dateObj;
}

/**
 * Check and then convert a 'date' to a specific format given by 'format':
 * Currently supported formats:
 *       'yyyy mm dd', 'dd mm yyyy',
 * @param {Object} date: of format:<{day, month, year, dayStr, monthStr}>.
 * @param {String} format: of format:<'yyyy mm dd' || 'dd mm yyyy' || ...>
 * @returns {String} : of format:<'yyyy mm dd' || 'dd mm yyyy' || ...>
 */
function ConvertToDateFormat(date, format) {

    if (IsNull(date) || IsEmpty(date)) return null;

    if ((IsNull(date.day) || IsEmpty(date.day)) && !IsNull(date.dayStr)) {
        date.day = DateGetDayNumber(date.dayStr);
    }
    // If there is no month in number format, check if there is a month in string format, convert to number format and save to .month key 
    if ((IsNull(date.month) || IsEmpty(date.month)) && !IsNull(date.monthStr)) {
        date.month = DateGetMonthNumber(date.monthStr);
    }

    if (format === 'dd mm yyyy') {
        const newDate = `${date.day} ${date.month} ${date.year}`
        return newDate;
    }
    else if (format === 'yyyy mm dd') {
        const newDate = `${date.year} ${date.month} ${date.day}`
        return newDate;
    }

}
function DateGetMonthNumber(monthStr) {
    const MONTHS = ['null', 'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Sep', 'Oct', 'Nov', 'Dec'];

    for (let i = 0; i < MONTHS.length; i++) {
        if (MONTHS[i] == monthStr) {
            if (i < 10) return '0' + i; // Ret type 'xx' not just 'x' as a month type
            else return i;
        }
    }
}

function IsAnyObjectKeyNull(obj) {
    for (var k in obj) {
        if (obj[k] === null || obj[k] === undefined) {
            return true;
        }
    }
    return false
}
